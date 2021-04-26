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
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isObjectLiteralExpression,
  isSpreadAssignment,
  isVariableStatement,
  Statement,
  TypeAliasDeclaration,
  VariableStatement,
} from 'typescript';

import { developerError } from '../common/error';
import { filterUndefined } from '../common/util';
import {
  callExpression,
  camelize,
  capitalize,
  createSource,
  getExportText,
  getImportText,
  getVariableName,
  id,
  interfaceType,
  literalUnion,
  namedImport,
  objectLiteral,
  parseSource,
  pascalize,
  propertyAssignment,
  propertySignature,
  reexport,
  typeAlias,
  typedClientStatement,
  typeDefinitions,
  typeQuery,
  typeReference,
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

export function createProfileType(
  profileName: string,
  usecaseNames: string[]
): Statement[] {
  const usecases = usecaseNames.map(usecaseName => {
    const pascalizedUsecaseName = pascalize(usecaseName);
    const helperCall = callExpression(
      'typeHelper',
      [],
      [pascalizedUsecaseName + 'Input', pascalizedUsecaseName + 'Result']
    );

    return propertyAssignment(usecaseName, helperCall);
  });

  const profile = variableStatement('profile', objectLiteral(usecases));
  const profileType = typeAlias(
    pascalize(profileName) + 'Profile',
    typeReference('TypedProfile', [typeQuery('profile')])
  );
  const profileWrapper = variableStatement(
    camelize(profileName),
    objectLiteral([propertyAssignment(profileName, id('profile'))])
  );

  return [profile, profileType, profileWrapper];
}

export function generateTypesFile(
  profiles: string[],
  typesFile?: string
): string {
  const imports = profiles.flatMap(profile => [
    namedImport([camelize(profile)], './types/' + profile),
    reexport([pascalize(profile) + 'Profile'], './types/' + profile),
  ]);
  const statements = [
    namedImport(['createTypedClient'], '@superfaceai/one-sdk'),
    ...imports,
    ...typeDefinitions(profiles),
    typedClientStatement(),
  ];

  if (typesFile !== undefined) {
    return updateTypesFile(statements, typesFile);
  }

  return createSource(statements);
}

export function updateTypesFile(
  statements: Statement[],
  typesFile: string
): string {
  const extractIdentifiers = (typeDefinition?: VariableStatement): string[] =>
    typeDefinition?.declarationList.declarations
      .map(declaration => declaration.initializer)
      .filter(filterUndefined)
      .filter(isObjectLiteralExpression)
      .flatMap(expression =>
        expression.properties
          .filter(isSpreadAssignment)
          .map(assignment => assignment.expression)
          .filter(isIdentifier)
          .map(identifier => identifier.text)
      ) ?? [];

  const originalStatements = parseSource(typesFile);
  const newImports = statements.filter(isImportDeclaration);
  const newExports = statements.filter(isExportDeclaration);
  const originalImports = originalStatements.filter(isImportDeclaration);
  const originalExports = originalStatements.filter(isExportDeclaration);
  const newTypeDefinition = statements
    .filter(isVariableStatement)
    .find(node => getVariableName(node) === 'typeDefinitions');
  const originalTypeDefinition = originalStatements
    .filter(isVariableStatement)
    .find(node => getVariableName(node) === 'typeDefinitions');

  const mergedStatements: Statement[] = [
    ...originalImports,
    ...originalExports,
  ];

  for (const newImport of newImports) {
    const importText = getImportText(newImport);
    if (
      importText !== undefined &&
      originalImports.find(
        originalImport => getImportText(originalImport) === importText
      ) === undefined
    ) {
      mergedStatements.push(newImport);
    }
  }

  for (const newExport of newExports) {
    const exportText = getExportText(newExport);
    if (
      exportText !== undefined &&
      originalExports.find(
        originalExport => getExportText(originalExport) === exportText
      ) === undefined
    ) {
      mergedStatements.push(newExport);
    }
  }

  if (newTypeDefinition === undefined && originalTypeDefinition !== undefined) {
    mergedStatements.push(originalTypeDefinition);
  } else if (
    newTypeDefinition !== undefined &&
    originalTypeDefinition === undefined
  ) {
    mergedStatements.push(newTypeDefinition);
  } else if (
    newTypeDefinition === undefined &&
    originalTypeDefinition === undefined
  ) {
    throw developerError(
      'Something unexpected happened. This should not be reachable.',
      9001
    );
  } else {
    const originalTypeDefinitions = extractIdentifiers(originalTypeDefinition);
    const newTypeDefinitions = extractIdentifiers(newTypeDefinition);
    const mergedTypeDefinitions = [
      ...originalTypeDefinitions,
      ...newTypeDefinitions?.filter(
        definition => !originalTypeDefinitions?.includes(definition)
      ),
    ];

    mergedStatements.push(...typeDefinitions(mergedTypeDefinitions));
  }

  mergedStatements.push(typedClientStatement());

  return createSource(mergedStatements);
}

export function generateTypingsForProfile(
  profileName: string,
  profileAST: ProfileDocumentNode
): string {
  const output = getProfileOutput(profileAST);
  const inputTypes = output.usecases.flatMap(usecase =>
    createUsecaseTypes(usecase, 'unknown')
  );

  const statements = [
    namedImport(['typeHelper', 'TypedProfile'], '@superfaceai/one-sdk'),
    ...inputTypes,
    ...createProfileType(
      profileName,
      output.usecases.map(usecase => usecase.useCaseName)
    ),
  ];

  return createSource(statements);
}
