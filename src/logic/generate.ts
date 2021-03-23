import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  DocumentedStructureType,
  EnumStructure,
  getProfileOutput,
  ProfileOutput,
  StructureType,
} from '@superfaceai/parser';
import {
  InterfaceDeclaration,
  Statement,
  TypeAliasDeclaration,
} from 'typescript';

import {
  callExpression,
  camelize,
  capitalize,
  createSource,
  interfaceType,
  literalUnion,
  namedImport,
  objectLiteral,
  pascalize,
  propertyAssignment,
  propertySignature,
  typeAlias,
  typedClientStatement,
  typeDefinitions,
  variableStatement,
  variableType,
} from './generate.utils';

export function isDocumentedStructure(
  structure: StructureType
): structure is DocumentedStructureType {
  return 'title' in structure;
}

export function createEnumTypes(
  prefix: string,
  fields: Record<string, StructureType | undefined>
): TypeAliasDeclaration[] {
  return Object.entries(fields)
    .filter(
      (entry): entry is [string, EnumStructure] =>
        entry[1]?.kind === 'EnumStructure'
    )
    .map(([field, value]) =>
      typeAlias(
        prefix + capitalize(field),
        literalUnion(value.enums.map(enumValue => enumValue.value))
      )
    );
}

export function createInterfaceFromStructure(
  prefix: string,
  fields: Record<string, StructureType>,
  untypedType: 'any' | 'unknown',
  doc?: { title?: string; description?: string }
): InterfaceDeclaration {
  const members = Object.entries(fields).map(([property, value]) =>
    propertySignature(
      property,
      value.required,
      variableType(prefix + capitalize(property), value, untypedType),
      isDocumentedStructure(value)
        ? { title: value.title, description: value.description }
        : undefined
    )
  );

  return interfaceType(prefix, members, doc);
}

export function createUsecaseTypes(
  usecase: ProfileOutput['usecases'][number],
  untypedType: 'any' | 'unknown'
): Statement[] {
  let inputs: Statement[] = [];
  let results: Statement[] = [];

  if (usecase.input?.fields) {
    inputs = [
      ...createEnumTypes(usecase.useCaseName + 'Input', usecase.input.fields),
      createInterfaceFromStructure(
        usecase.useCaseName + 'Input',
        usecase.input.fields,
        untypedType,
        { title: usecase.title, description: usecase.description }
      ),
    ];
  }

  if (usecase.result?.kind === 'ObjectStructure' && usecase.result.fields) {
    results = [
      ...createEnumTypes(usecase.useCaseName + 'Result', usecase.result.fields),
      createInterfaceFromStructure(
        usecase.useCaseName + 'Result',
        usecase.result.fields,
        untypedType,
        { title: usecase.title, description: usecase.description }
      ),
    ];
  }

  return [...inputs, ...results];
}

export function createUsecasesType(
  profileName: string,
  usecaseNames: string[]
): Statement {
  const usecases = usecaseNames.map(usecaseName => {
    const pascalizedUsecaseName = pascalize(usecaseName);
    const helperCall = callExpression(
      'typeHelper',
      [],
      [pascalizedUsecaseName + 'Input', pascalizedUsecaseName + 'Result']
    );

    return propertyAssignment(usecaseName, helperCall);
  });
  const profile = objectLiteral([
    propertyAssignment(profileName, objectLiteral(usecases)),
  ]);

  return variableStatement(camelize(profileName), profile);
}

export function generateTypesFile(profiles: string[]): string {
  const statements = [
    namedImport(['createTypedClient'], '@superfaceai/sdk'),
    ...typeDefinitions(profiles),
    typedClientStatement(),
  ];

  return createSource(statements);
}

export function generateTypingsForProfile(
  profileName: string,
  profileAST: ProfileDocumentNode
): string {
  const output = getProfileOutput(profileAST);
  const inputTypes = output.usecases.map(usecase =>
    createUsecaseTypes(usecase, 'unknown')
  );

  const statements = [
    namedImport(['typeHelper'], '@superfaceai/sdk'),
    ...inputTypes.reduce((acc, input) => [...acc, ...input], []),
    createUsecasesType(
      profileName,
      output.usecases.map(usecase => usecase.useCaseName)
    ),
  ];

  return createSource(statements);
}
