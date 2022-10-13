import {
  ComlinkLiteralNode,
  EnumDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  NonNullDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileDocumentNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';
import { ProfileHeader } from './header';
import { EnumModel } from './models/enum.model';
import { ListModel } from './models/list.model';
import { Model, ModelType } from './models/model-base';
import { ObjectModel } from './models/object.model';
import { ScalarModel, ScalarType } from './models/scalar.model';
import { UnionModel } from './models/union.model';
import { Profile } from './profile';
import { UseCase } from './usecase';
import { UseCaseBase } from './usecase-base';
import { UseCaseDetail, UseCaseSlot } from './usecase-detail';
import { UseCaseSlotExample } from './usecase-example';

export class ProfileASTAdapter implements Profile {
  private options: ProfileDocumentNode;
  private namedModelDefinitionsCache!: {
    [key: string]: NamedModelDefinitionNode;
  };
  private namedFieldDefinitionsCache!: {
    [key: string]: NamedFieldDefinitionNode;
  };

  public constructor(options: ProfileDocumentNode) {
    this.options = options;
  }

  public getProfileHeader(): ProfileHeader {
    const ast = this.options;
    const header = {
      name: this.getProfileName(ast),
      scope: this.getProfileScope(ast),
      title: this.getProfileTitle(ast),
      version: this.getProfileVersion(ast),
      description: this.getProfileDescription(ast),
    };

    return {
      profileId: header.scope ? `${header.scope}/${header.name}` : header.name,
      ...header,
    };
  }

  public getUseCaseList(): UseCase[] {
    const ast = this.options;
    return ast.definitions
      .filter(definition => {
        return definition.kind === 'UseCaseDefinition';
      })
      .map(usecase => this.getUseCase(usecase as UseCaseDefinitionNode));
  }

  public getUseCaseDetailList(): UseCaseDetail[] {
    const ast = this.options;
    return ast.definitions
      .filter(definition => {
        return definition.kind === 'UseCaseDefinition';
      })
      .map(usecase => this.mapUseCaseDetail(usecase as UseCaseDefinitionNode));
  }

  private getProfileName(ast: ProfileDocumentNode): string {
    return ast.header.name;
  }

  private getProfileScope(ast: ProfileDocumentNode): string {
    return ast.header.scope ?? '';
  }

  private getProfileTitle(ast: ProfileDocumentNode): string {
    return ast.header?.documentation?.title ?? '';
  }

  private getProfileVersion(ast: ProfileDocumentNode): string {
    return `${ast.header.version.major}.${ast.header.version.minor}.${ast.header.version.patch}`;
  }

  private getProfileDescription(ast: ProfileDocumentNode): string {
    return ast.header?.documentation?.description ?? '';
  }

  private populateCache(): void {
    this.namedModelDefinitionsCache = {};
    this.namedFieldDefinitionsCache = {};

    this.options.definitions.forEach(definition => {
      if (definition.kind === 'NamedFieldDefinition') {
        this.namedFieldDefinitionsCache[definition.fieldName] = definition;
      } else if (definition.kind === 'NamedModelDefinition') {
        this.namedModelDefinitionsCache[definition.modelName] = definition;
      }
    });
  }

  private findNamedModelDefinition(
    modelName: string
  ): NamedModelDefinitionNode {
    if (!this.namedModelDefinitionsCache) this.populateCache();
    return this.namedModelDefinitionsCache[modelName];
  }

  private findNamedFieldDefinition(
    fieldName: string
  ): NamedFieldDefinitionNode | null {
    if (!this.namedFieldDefinitionsCache) this.populateCache();
    return this.namedFieldDefinitionsCache[fieldName] || null;
  }

  private getFieldsOverview(item?: Type): string[] {
    if (item === undefined) return [];

    switch (item.kind) {
      case 'ObjectDefinition':
        return item.fields.map(field => {
          const namedFieldNode = this.findNamedFieldDefinition(field.fieldName);

          // always prefer inlined metadata over named field definition
          return (
            field?.documentation?.title ||
            namedFieldNode?.documentation?.title ||
            field.fieldName
          );
        });
      case 'ListDefinition':
        return this.getFieldsOverview(item.elementType);
      case 'ModelTypeName': {
        const node = this.findNamedModelDefinition(item.name);
        return node ? this.getFieldsOverview(node.type) : [item.name];
      }
      case 'NonNullDefinition':
        return this.getFieldsOverview(item.type);
      case 'PrimitiveTypeName':
        return [item.name];
      case 'EnumDefinition':
        return [
          item.values.map(enumValue => String(enumValue.value)).join(', '),
        ];
      case 'UnionDefinition':
        // TODO: Solve union type rendering: https://github.com/superfaceai/air/issues/123
        if (item.types.every(type => type.kind === 'ModelTypeName')) {
          return [
            (item.types as ModelTypeNameNode[])
              .map(type => type.name)
              .join(' or '),
          ];
        } else {
          return ['more result variants'];
        }
      default:
        return [];
    }
  }

  private getGenericModelDetails(astType?: Type): Model {
    if (astType === undefined) {
      return null;
    }
    switch (astType.kind) {
      case 'ObjectDefinition':
        return this.getObjectModelDetails(astType as ObjectDefinitionNode);
      case 'PrimitiveTypeName':
        return this.getScalarModelDetails(astType as PrimitiveTypeNameNode);
      case 'ListDefinition':
        return this.getListModelDetails(astType as ListDefinitionNode);
      case 'EnumDefinition':
        return this.getEnumModelDetails(astType as EnumDefinitionNode);
      case 'ModelTypeName': {
        const node = this.findNamedModelDefinition(astType.name);
        return node ? this.getGenericModelDetails(node.type) : null;
      }
      case 'NonNullDefinition':
        return this.getGenericModelDetails(
          (astType as NonNullDefinitionNode).type
        );
      case 'UnionDefinition':
        return this.getUnionModelDetails(astType as UnionDefinitionNode);
      default:
        return null;
    }
  }

  private getScalarModelDetails(primitive: PrimitiveTypeNameNode): ScalarModel {
    return {
      modelType: ModelType.SCALAR,
      scalarType: primitive.name as ScalarType,
    } as ScalarModel;
  }

  private getListModelDetails(list: ListDefinitionNode): ListModel {
    return {
      modelType: ModelType.LIST,
      elementModel: this.getGenericModelDetails(list.elementType),
    } as ListModel;
  }

  private getObjectModelDetails(object: ObjectDefinitionNode): ObjectModel {
    return {
      modelType: ModelType.OBJECT,
      fields: object.fields
        .filter(item => item.kind === 'FieldDefinition')
        .map(field => {
          const namedFieldNode = this.findNamedFieldDefinition(field.fieldName);

          const model = this.getGenericModelDetails(
            field.type || namedFieldNode?.type || undefined
          );

          return {
            fieldName: field.fieldName,
            required: field.required,
            model: model,

            // If the field has an inline title provided, use the description
            // from inlined definition only (or fallback to title if not present).

            // E.g. Named field definition could contain both title & description
            //      while the inline definition only has a title. These 2 definitions
            //      could possibly have different meanings, mixing title from one
            //      with the description from the other is not desirable.
            description: field?.documentation?.title
              ? field?.documentation?.description || field?.documentation?.title
              : namedFieldNode?.documentation?.description,
          };
        }),
    } as ObjectModel;
  }

  private getEnumModelDetails(object: EnumDefinitionNode): EnumModel {
    return {
      modelType: ModelType.ENUM,
      enumElemets: object.values.map(({ value, documentation }) => ({
        value,
        title: documentation?.title,
      })),
    };
  }

  private getUnionModelDetails(object: UnionDefinitionNode): UnionModel {
    return {
      modelType: ModelType.UNION,
      types: object.types.map(this.getGenericModelDetails.bind(this)),
    };
  }

  private mapUseCaseBase(usecase: UseCaseDefinitionNode): UseCaseBase {
    return {
      name: usecase.useCaseName,
      title: usecase?.documentation?.title,
      description: usecase?.documentation?.description,
    };
  }

  private getUseCase(usecase: UseCaseDefinitionNode): UseCase {
    const inputs = this.getFieldsOverview(usecase?.input?.value);
    const outputs = this.getFieldsOverview(usecase?.result?.value);

    return {
      ...this.mapUseCaseBase(usecase),
      ...(inputs ? { inputs } : null),
      ...(outputs ? { outputs } : null),
    };
  }

  private pluralizeFirstWord(phrase: string): string {
    const [firstWord, ...words] = phrase.split(' ');
    return [`${firstWord}s`, ...words].join(' ');
  }

  private getUseCaseSlot(item: Model): UseCaseSlot {
    if (item === null) {
      throw new Error('Item is null');
    }
    switch (item.modelType) {
      case ModelType.OBJECT:
        return {
          title: 'object',
          fields: item.fields.map(field => ({
            fieldName: field.fieldName,
            description: field.description,
            required: field.required ?? false,
            ...(field?.model?.modelType === ModelType.SCALAR
              ? {
                  type: field?.model?.scalarType,
                }
              : field?.model?.modelType === ModelType.ENUM
              ? {
                  type: 'enum',
                  typeValues: field.model.enumElemets.map(el => el.value),
                }
              : null),
          })),
        };
      case ModelType.LIST: {
        const elementSlot = this.getUseCaseSlot(item.elementModel);

        return {
          title: `list of ${this.pluralizeFirstWord(elementSlot.title)}`,
          ...(elementSlot.fields ? { fields: elementSlot.fields } : null),
        };
      }
      case ModelType.ENUM:
        return {
          title: 'enum',
          fields: item.enumElemets.map(enumEl => ({
            fieldName: String(enumEl.value),
            description: enumEl.title,
            required: false,
          })),
        };
      case ModelType.SCALAR:
        return {
          title: item.scalarType,
        };
      case ModelType.UNION:
        return this.getUseCaseSlot(item.types[0]);
    }
  }

  private getUseCaseSlotExample(item: Model): UseCaseSlotExample {
    if (item === null) {
      throw new Error('Item is null');
    }
    const DEFAULT_OBJECT_FIELD: Model = {
      modelType: ModelType.SCALAR,
      scalarType: ScalarType.STRING,
    };

    const SCALAR_MAPPING: {
      [key in ScalarType]: string | number | boolean;
    } = {
      [ScalarType.STRING]: '',
      [ScalarType.NUMBER]: 42,
      [ScalarType.BOOLEAN]: true,
    };

    switch (item.modelType) {
      case ModelType.OBJECT: {
        return (item.fields || []).reduce(
          (objectExample, field) =>
            Object.assign(objectExample, {
              [field.fieldName]: this.getUseCaseSlotExample(
                field?.model || DEFAULT_OBJECT_FIELD
              ),
            }),
          {}
        );
      }
      case ModelType.LIST: {
        const elementExample = this.getUseCaseSlotExample(item.elementModel);
        return elementExample;
      }
      case ModelType.ENUM:
        return item.enumElemets?.[0]?.value || null;
      case ModelType.SCALAR:
        return item.scalarType
          ? SCALAR_MAPPING[item.scalarType]
          : SCALAR_MAPPING[ScalarType.STRING];
      case ModelType.UNION:
        return this.getUseCaseSlotExample(item.types[0]);
      default:
        return null;
    }
  }

  private findUseCaseExample(
    usecase: UseCaseDefinitionNode
  ): {
    errorExample?: {
      input?: ComlinkLiteralNode;
      error?: ComlinkLiteralNode;
    };
    successExample?: {
      input?: ComlinkLiteralNode;
      result?: ComlinkLiteralNode;
    };
  } {
    let successExample = undefined,
      errorExample = undefined;
    if (!usecase.examples?.length)
      return { successExample: undefined, errorExample: undefined };

    const exampleNodes = usecase.examples.filter(
      slot =>
        slot.kind === 'UseCaseSlotDefinition' &&
        slot.value.kind === 'UseCaseExample'
    );
    const successExampleNode = exampleNodes.find(
      example => !!example.value?.result
    )?.value;

    const errorExampleNode = exampleNodes.find(
      example => !!example.value?.error
    )?.value;

    console.log('err', errorExampleNode);

    if (successExampleNode !== undefined) {
      successExample = {
        input: successExampleNode.input?.value,
        result: successExampleNode.result?.value,
      };
    }

    if (errorExampleNode !== undefined) {
      errorExample = {
        input: errorExampleNode.input?.value,
        error: errorExampleNode.error?.value,
      };
    }

    return {
      successExample,
      errorExample,
    };
  }

  private parseLiteralExample(
    exampleNode: ComlinkLiteralNode
  ): UseCaseSlotExample {
    switch (exampleNode?.kind) {
      case 'ComlinkObjectLiteral': {
        return (exampleNode.fields || []).reduce(
          (objectExample, field) =>
            Object.assign(objectExample, {
              [field.key[0]]: this.parseLiteralExample(field?.value),
            }),
          {}
        );
      }
      case 'ComlinkListLiteral': {
        const elementExample = this.parseLiteralExample(exampleNode.items[0]);
        return elementExample;
      }
      case 'ComlinkPrimitiveLiteral':
        return exampleNode.value;
      default:
        return null;
    }
  }

  private mapUseCaseDetail(usecase: UseCaseDefinitionNode): UseCaseDetail {
    const resolvedInputTree = this.getGenericModelDetails(
      usecase?.input?.value
    );

    const resolvedResultTree = this.getGenericModelDetails(
      usecase?.result?.value
    );

    const resolvedErrorTree = this.getGenericModelDetails(
      usecase?.error?.value
    );

    const { successExample, errorExample } = this.findUseCaseExample(usecase);

    return {
      ...this.mapUseCaseBase(usecase),
      error: this.getUseCaseSlot(resolvedErrorTree),
      input: this.getUseCaseSlot(resolvedInputTree),
      result: this.getUseCaseSlot(resolvedResultTree),
      successExample: {
        input: successExample?.input
          ? this.parseLiteralExample(successExample.input)
          : undefined,
        result: successExample?.result
          ? this.parseLiteralExample(successExample.result)
          : undefined,
      },
      errorExample: {
        input: errorExample?.input
          ? this.parseLiteralExample(errorExample.input)
          : undefined,
        error: errorExample?.error
          ? this.parseLiteralExample(errorExample.error)
          : undefined,
      },
    };
    // const useCaseDetailError =
    //   resolvedErrorTree !== undefined
    //     ? {
    //       error: this.getUseCaseSlot(resolvedErrorTree),
    //       errorExample: errorExample
    //         ? this.parseLiteralExample(errorExample.input)
    //         : this.getUseCaseSlotExample(resolvedErrorTree),
    //     }
    //     : null;

    // const useCaseDetailInput =
    //   resolvedInputTree !== undefined
    //     ? {
    //       input: this.getUseCaseSlot(resolvedInputTree),
    //       inputExample: inputExample
    //         ? this.parseLiteralExample(inputExample)
    //         : this.getUseCaseSlotExample(resolvedInputTree),
    //     }
    //     : null;

    // const useCaseDetailResult =
    //   resolvedResultTree !== undefined
    //     ? {
    //       result: this.getUseCaseSlot(resolvedResultTree),
    //       resultExample: resultExample
    //         ? this.parseLiteralExample(resultExample)
    //         : this.getUseCaseSlotExample(resolvedResultTree),
    //     }
    //     : null;

    // return {
    //   ...this.mapUseCaseBase(usecase),
    //   ...useCaseDetailInput,
    //   ...useCaseDetailResult,
    //   ...useCaseDetailError
    // };
  }
}
