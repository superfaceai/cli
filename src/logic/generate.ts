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
  asExpression,
  createSource,
  defaultImport,
  interfaceType,
  literal,
  literalUnion,
  namedImport,
  namedTuple,
  newTypedExpression,
  propertySignature,
  typeAlias,
  typeLiteral,
  variableStatement,
  variableType,
} from './generate.utils';

function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.substring(1);
}

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
  const type = typeLiteral(
    usecaseNames.map(usecaseName =>
      propertySignature(
        usecaseName,
        true,
        namedTuple([
          ['input', usecaseName + 'Input'],
          ['result', usecaseName + 'Result'],
        ])
      )
    )
  );

  return typeAlias(profileName + 'Usecases', type);
}

export function createClient(
  profileId: string,
  profileName: string
): Statement {
  const args = [
    literal(profileId),
    asExpression('profileAST', 'ProfileDocumentNode'),
  ];

  const initializer = newTypedExpression(
    'TypedServiceFinderQuery',
    [profileName + 'Usecases'],
    args
  );

  return variableStatement(profileName + 'Client', initializer);
}

function pascalize(input: string): string {
  return capitalize(input).replace(/-(\w)/g, (_, repl) => {
    return capitalize(repl);
  });
}

export function generateInterfaces(
  profileAST: ProfileDocumentNode,
  profileNam: string,
  untypedType: 'any' | 'unknown'
): string {
  const profileName = pascalize(profileNam);
  const output = getProfileOutput(profileAST);

  const imports = [
    namedImport(['ProfileDocumentNode'], '@superfaceai/ast'),
    namedImport(['TypedServiceFinderQuery'], '@superfaceai/sdk'),
    defaultImport('profileAST', './' + profileName + '.ast.json'),
  ];

  const inputTypes = output.usecases.map(usecase =>
    createUsecaseTypes(usecase, untypedType)
  );
  const usecasesType = createUsecasesType(
    profileName,
    output.usecases.map(usecase => usecase.useCaseName)
  );

  const statements = [
    ...imports,
    ...inputTypes.reduce((acc, input) => [...acc, ...input], []),
    usecasesType,
    createClient(output.header.name, profileName),
  ];

  return createSource(statements);
}
