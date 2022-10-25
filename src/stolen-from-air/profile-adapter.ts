import type {
  EnumDefinitionNode,
  ListDefinitionNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileDocumentNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { buildUseCaseExamples } from './example/build';
import type { EnumModel } from './models/enum.model';
import type { ListModel } from './models/list.model';
import type { Model } from './models/model-base';
import { ModelType } from './models/model-base';
import type { ObjectModel } from './models/object.model';
import type { ScalarModel, ScalarType } from './models/scalar.model';
import type { UnionModel } from './models/union.model';
import type { UseCaseDetail } from './usecase-detail';

export class ProfileASTAdapter {
  private options: ProfileDocumentNode;
  private namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  };

  private namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  };

  constructor(options: ProfileDocumentNode) {
    this.options = options;
    this.namedFieldDefinitionsCache = {};
    this.namedModelDefinitionsCache = {};
  }

  public getUseCaseDetailList(): UseCaseDetail[] {
    return this.options.definitions
      .filter(definition => {
        return definition.kind === 'UseCaseDefinition';
      })
      .map(usecase => this.mapUseCaseDetail(usecase as UseCaseDefinitionNode));
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
    if (Object.keys(this.namedModelDefinitionsCache).length === 0)
      this.populateCache();

    return this.namedModelDefinitionsCache[modelName];
  }

  private findNamedFieldDefinition(
    fieldName: string
  ): NamedFieldDefinitionNode | null {
    if (Object.keys(this.namedFieldDefinitionsCache).length === 0)
      this.populateCache();

    return this.namedFieldDefinitionsCache[fieldName] ?? null;
  }

  private getGenericModelDetails(astType?: Type, nonNull?: boolean): Model {
    if (astType === undefined) {
      return null;
    }
    switch (astType.kind) {
      case 'ObjectDefinition':
        return this.getObjectModelDetails(astType, nonNull);
      case 'PrimitiveTypeName':
        return this.getScalarModelDetails(astType, nonNull);
      case 'ListDefinition':
        return this.getListModelDetails(astType, nonNull);
      case 'EnumDefinition':
        return this.getEnumModelDetails(astType, nonNull);
      case 'ModelTypeName': {
        const node = this.findNamedModelDefinition(astType.name);

        return this.getGenericModelDetails(node.type);
      }
      case 'NonNullDefinition':
        return this.getGenericModelDetails(astType.type, true);
      case 'UnionDefinition':
        return this.getUnionModelDetails(astType, nonNull);
      default:
        return null;
    }
  }

  private getScalarModelDetails(
    primitive: PrimitiveTypeNameNode,
    nonNull?: boolean
  ): ScalarModel {
    return {
      modelType: ModelType.SCALAR,
      nonNull,
      scalarType: primitive.name as ScalarType,
    } as ScalarModel;
  }

  private getListModelDetails(
    list: ListDefinitionNode,
    nonNull?: boolean
  ): ListModel {
    return {
      modelType: ModelType.LIST,
      nonNull,
      model: this.getGenericModelDetails(list.elementType),
    } as ListModel;
  }

  private getObjectModelDetails(
    object: ObjectDefinitionNode,
    nonNull?: boolean
  ): ObjectModel {
    return {
      modelType: ModelType.OBJECT,
      nonNull,
      fields: object.fields
        .filter(item => item.kind === 'FieldDefinition')
        .map(field => {
          const namedFieldNode = this.findNamedFieldDefinition(field.fieldName);

          const model = this.getGenericModelDetails(
            field.type ?? namedFieldNode?.type ?? undefined
          );

          const description: string | undefined =
            field?.documentation?.title !== undefined
              ? field?.documentation?.description ?? field?.documentation?.title
              : namedFieldNode !== null
              ? namedFieldNode.documentation?.description
              : undefined;

          return {
            fieldName: field.fieldName,
            required: field.required,
            nonNull: model?.nonNull,
            model: model,

            // If the field has an inline title provided, use the description
            // from inlined definition only (or fallback to title if not present).

            // E.g. Named field definition could contain both title & description
            //      while the inline definition only has a title. These 2 definitions
            //      could possibly have different meanings, mixing title from one
            //      with the description from the other is not desirable.
            description,
          };
        }),
    } as ObjectModel;
  }

  private getEnumModelDetails(
    object: EnumDefinitionNode,
    nonNull?: boolean
  ): EnumModel {
    return {
      modelType: ModelType.ENUM,
      nonNull: nonNull ?? false,
      enumElements: object.values.map(({ value, documentation }) => ({
        value,
        title: documentation?.title,
      })),
    };
  }

  private getUnionModelDetails(
    object: UnionDefinitionNode,
    nonNull?: boolean
  ): UnionModel {
    return {
      nonNull: nonNull ?? true,
      modelType: ModelType.UNION,
      types: object.types.map(t => this.getGenericModelDetails(t)),
    };
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

    return {
      name: usecase.useCaseName,
      title: usecase?.documentation?.title,
      description: usecase?.documentation?.description,
      error: resolvedErrorTree,
      input: resolvedInputTree,
      result: resolvedResultTree,
      ...buildUseCaseExamples(this.options, usecase.useCaseName),
    };
  }
}
