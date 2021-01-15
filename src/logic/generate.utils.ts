import { StructureType } from '@superfaceai/parser';
import {
  addSyntheticLeadingComment,
  AsExpression,
  createPrinter,
  EmitHint,
  Expression,
  factory,
  FalseLiteral,
  Identifier,
  ImportDeclaration,
  InterfaceDeclaration,
  KeywordTypeNode,
  LiteralTypeNode,
  NewExpression,
  Node,
  NodeFlags,
  NumericLiteral,
  PropertySignature,
  Statement,
  StringLiteral,
  SyntaxKind,
  TrueLiteral,
  TupleTypeNode,
  TypeAliasDeclaration,
  TypeElement,
  TypeLiteralNode,
  TypeNode,
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
): KeywordTypeNode | TypeReferenceNode {
  switch (structure.kind) {
    case 'PrimitiveStructure':
      return keyword(structure.type);

    case 'ScalarStructure':
      return keyword(untypedType);

    case 'EnumStructure':
      return factory.createTypeReferenceNode(prefix);

    default:
      throw new Error(`err, ${structure.kind}`);
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

  if (doc) {
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

export function createSource(statements: Statement[]): string {
  const document = factory.createSourceFile(
    statements,
    factory.createToken(SyntaxKind.EndOfFileToken),
    0
  );

  const printer = createPrinter();

  return printer.printNode(EmitHint.SourceFile, document, document);
}
