import { StructureType } from '@superfaceai/parser';
import {
  addSyntheticLeadingComment,
  ArrayTypeNode,
  AsExpression,
  CallExpression,
  createPrinter,
  createSourceFile,
  EmitHint,
  ExportDeclaration,
  Expression,
  factory,
  FalseLiteral,
  Identifier,
  ImportDeclaration,
  InterfaceDeclaration,
  isExportSpecifier,
  isIdentifier,
  isImportSpecifier,
  isNamedExports,
  isNamedImports,
  KeywordTypeNode,
  LiteralTypeNode,
  NewExpression,
  Node,
  NodeFlags,
  NumericLiteral,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  ScriptTarget,
  SpreadAssignment,
  Statement,
  StringLiteral,
  SyntaxKind,
  TrueLiteral,
  TupleTypeNode,
  TypeAliasDeclaration,
  TypeElement,
  TypeLiteralNode,
  TypeNode,
  TypeQueryNode,
  TypeReferenceNode,
  UnionTypeNode,
  VariableStatement,
} from 'typescript';

function addDoc<T extends Node>(
  node: T,
  doc: { title?: string; description?: string }
): T {
  if (doc.title === undefined) {
    return node;
  }

  let text = '* ';
  if (doc.description === undefined) {
    text += doc.title + ' *';
  } else {
    text += '\n * ' + doc.title;
    text += '\n * ';
    text += doc.description.replace(/\n/g, '\n * ');
    text += '\n *';
  }

  return addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    text,
    true
  );
}

export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.substring(1);
}

export function camelize(input: string): string {
  return input.replace(/[-/](\w)/g, (_, repl) => {
    return capitalize(repl);
  });
}

export function pascalize(input: string): string {
  return capitalize(camelize(input));
}

export function id(name: string): Identifier {
  return factory.createIdentifier(name);
}

export function namedImport(names: string[], from: string): ImportDeclaration {
  return factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(
        names.map(name => factory.createImportSpecifier(undefined, id(name)))
      )
    ),
    factory.createStringLiteral(from, true)
  );
}

export function defaultImport(name: string, from: string): ImportDeclaration {
  return factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(false, id(name), undefined),
    literal(from)
  );
}

export const exportKeyword = factory.createToken(SyntaxKind.ExportKeyword);
export const questionToken = factory.createToken(SyntaxKind.QuestionToken);

export function keyword(
  keywordType: 'string' | 'number' | 'boolean' | 'any' | 'unknown'
): KeywordTypeNode {
  switch (keywordType) {
    case 'string':
      return factory.createToken(SyntaxKind.StringKeyword);
    case 'number':
      return factory.createToken(SyntaxKind.NumberKeyword);
    case 'boolean':
      return factory.createToken(SyntaxKind.BooleanKeyword);
    case 'any':
      return factory.createToken(SyntaxKind.AnyKeyword);
    case 'unknown':
      return factory.createToken(SyntaxKind.UnknownKeyword);
  }
}

export function variableType(
  prefix: string,
  structure: StructureType,
  untypedType: 'any' | 'unknown'
): KeywordTypeNode | TypeReferenceNode | ArrayTypeNode | TypeLiteralNode {
  switch (structure.kind) {
    case 'PrimitiveStructure':
      return keyword(structure.type);

    case 'ScalarStructure':
      return keyword(untypedType);

    case 'EnumStructure':
      return factory.createTypeReferenceNode(prefix);

    case 'ListStructure':
      return factory.createArrayTypeNode(
        variableType(prefix, structure.value, untypedType)
      );

    case 'ObjectStructure': {
      const properties = Object.entries(
        structure.fields ?? {}
      ).map(([name, innerStructure]) =>
        propertySignature(
          name,
          innerStructure.required,
          variableType('', innerStructure, untypedType)
        )
      );

      return factory.createTypeLiteralNode(properties);
    }

    default:
      throw new Error(`Variable type not implemented for: ${structure.kind}`);
  }
}

export function literal(
  from: string | number | boolean
): StringLiteral | NumericLiteral | TrueLiteral | FalseLiteral {
  switch (typeof from) {
    case 'string':
      return factory.createStringLiteral(from, true);

    case 'number':
      return factory.createNumericLiteral(from);

    case 'boolean':
      return from ? factory.createTrue() : factory.createFalse();
  }
}

export function literalType(value: string | number | boolean): LiteralTypeNode {
  return factory.createLiteralTypeNode(literal(value));
}

export function union(types: TypeNode[]): UnionTypeNode {
  return factory.createUnionTypeNode(types);
}

export function literalUnion(
  values: (string | number | boolean)[]
): UnionTypeNode {
  return union(values.map(literalType));
}

export function typeAlias(name: string, type: TypeNode): TypeAliasDeclaration {
  return factory.createTypeAliasDeclaration(
    undefined,
    [exportKeyword],
    name,
    undefined,
    type
  );
}

export function typeLiteral(types: TypeElement[]): TypeLiteralNode {
  return factory.createTypeLiteralNode(types);
}

export function namedTuple(
  items: [name: string, typeName: string][]
): TupleTypeNode {
  return factory.createTupleTypeNode(
    items.map(([name, typeName]) =>
      factory.createNamedTupleMember(
        undefined,
        id(name),
        undefined,
        factory.createTypeReferenceNode(typeName)
      )
    )
  );
}

export function interfaceType(
  name: string,
  members: TypeElement[],
  doc?: { title?: string; description?: string }
): InterfaceDeclaration {
  const interfaceType = factory.createInterfaceDeclaration(
    undefined,
    [exportKeyword],
    id(name),
    undefined,
    undefined,
    members
  );

  if (doc !== undefined) {
    return addDoc(interfaceType, doc);
  }

  return interfaceType;
}

export function propertySignature(
  name: string,
  required: boolean | undefined,
  type: TypeNode,
  doc?: { title?: string; description?: string }
): PropertySignature {
  const signature = factory.createPropertySignature(
    undefined,
    id(name),
    required ? undefined : questionToken,
    type
  );

  if (doc !== undefined) {
    return addDoc(signature, doc);
  }

  return signature;
}

export function variableStatement(
  name: string,
  initializer: Expression
): VariableStatement {
  return factory.createVariableStatement(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          name,
          undefined,
          undefined,
          initializer
        ),
      ],
      NodeFlags.Const
    )
  );
}

export function newTypedExpression(
  typeName: string,
  parameters: string[],
  args: Expression[]
): NewExpression {
  return factory.createNewExpression(
    id(typeName),
    parameters.map(parameter => factory.createTypeReferenceNode(parameter)),
    args
  );
}

export function asExpression(name: string, asType: string): AsExpression {
  return factory.createAsExpression(
    id(name),
    factory.createTypeReferenceNode(asType)
  );
}

export function typeReference(
  name: string,
  typeArguments?: TypeNode[]
): TypeReferenceNode {
  return factory.createTypeReferenceNode(name, typeArguments);
}

export function callExpression(
  functionName: string,
  functionArguments: Expression[],
  typeArguments?: string[]
): CallExpression {
  return factory.createCallExpression(
    id(functionName),
    typeArguments?.map(argument => typeReference(argument)) ?? [],
    functionArguments
  );
}

export function objectLiteral(
  properties: ObjectLiteralElementLike[]
): ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(properties, true);
}

export function spreadAssignment(name: string): SpreadAssignment {
  return factory.createSpreadAssignment(id(name));
}

export function stringLiteral(text: string): StringLiteral {
  return factory.createStringLiteral(text);
}

export function propertyAssignment(
  name: string,
  initializer: Expression
): PropertyAssignment {
  return factory.createPropertyAssignment(stringLiteral(name), initializer);
}

export function typeDefinitions(profiles: string[]): Statement[] {
  const camelizedProfiles = profiles.map(camelize);
  const definitions = variableStatement(
    'typeDefinitions',
    objectLiteral(camelizedProfiles.map(spreadAssignment))
  );

  return [definitions];
}

export function typedClientStatement(): Statement[] {
  const client = variableStatement(
    'SuperfaceClient',
    callExpression('createTypedClient', [id('typeDefinitions')])
  );
  const clientType = typeAlias(
    'SuperfaceClient',
    typeReference('InstanceType', [typeQuery('SuperfaceClient')])
  );

  return [client, clientType];
}

export function parseSource(source: string): Statement[] {
  const sourceFile = createSourceFile('', source, ScriptTarget.Latest);

  return sourceFile.statements.map(statement => statement);
}

export function createSource(statements: Statement[]): string {
  const document = factory.createSourceFile(
    statements,
    factory.createToken(SyntaxKind.EndOfFileToken),
    0
  );

  const printer = createPrinter();

  return printer.printNode(EmitHint.SourceFile, document, document);
}

export function getImportText(node: ImportDeclaration): string | undefined {
  if (
    node.importClause?.namedBindings !== undefined &&
    isNamedImports(node.importClause.namedBindings)
  ) {
    return node.importClause.namedBindings.elements.find(isImportSpecifier)
      ?.name.text;
  }

  return undefined;
}

export function getExportText(node: ExportDeclaration): string | undefined {
  if (node.exportClause !== undefined && isNamedExports(node.exportClause)) {
    return node.exportClause.elements.find(isExportSpecifier)?.name.text;
  }

  return undefined;
}

export function getVariableName(node: VariableStatement): string | undefined {
  if (
    node.declarationList.declarations.length > 0 &&
    isIdentifier(node.declarationList.declarations[0].name)
  ) {
    return node.declarationList.declarations[0].name.escapedText.toString();
  }

  return undefined;
}

export function typeQuery(name: string): TypeQueryNode {
  return factory.createTypeQueryNode(id(name));
}

export function reexport(names: string[], from: string): ExportDeclaration {
  return factory.createExportDeclaration(
    undefined,
    undefined,
    false,
    factory.createNamedExports(
      names.map(name => factory.createExportSpecifier(undefined, name))
    ),
    stringLiteral(from)
  );
}
