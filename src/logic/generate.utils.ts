import {
  DocumentedStructureType,
  ProfileOutput,
  StructureType,
} from '@superfaceai/parser';
import {
  addSyntheticLeadingComment,
  ArrayTypeNode,
  CallExpression,
  createPrinter,
  EmitHint,
  ExportDeclaration,
  Expression,
  factory,
  FalseLiteral,
  Identifier,
  ImportDeclaration,
  KeywordTypeNode,
  LiteralTypeNode,
  Node,
  NodeFlags,
  NumericLiteral,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  SpreadAssignment,
  Statement,
  StringLiteral,
  SyntaxKind,
  TrueLiteral,
  TypeAliasDeclaration,
  TypeLiteralNode,
  TypeNode,
  TypeQueryNode,
  TypeReferenceNode,
  UnionTypeNode,
  VariableStatement,
} from 'typescript';

/*
 * Various utils
 */

/**
 * Adds JSDoc comments to a single TS node
 */
export function addDoc<T extends Node>(
  node: T,
  doc?: { title?: string; description?: string }
): T {
  if (doc === undefined || doc.title === undefined) {
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

/**
 * Just capitalizes a string
 */
export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.substring(1);
}

/**
 * Transforms a kebap-case string to camelCase
 */
export function camelize(input: string): string {
  return input.replace(/[-/](\w)/g, (_, repl) => {
    return capitalize(repl);
  });
}

/**
 * Transforms a kebap-case string to PascalCase
 */
export function pascalize(input: string): string {
  return capitalize(camelize(input));
}

/**
 * Checks if a structure has doc strings
 */
export function isDocumentedStructure(
  structure: StructureType
): structure is DocumentedStructureType {
  return 'title' in structure;
}

/**
 * Creates actual source text from a list of statements
 */
export function createSource(statements: Statement[]): string {
  const document = factory.createSourceFile(
    statements,
    factory.createToken(SyntaxKind.EndOfFileToken),
    0
  );

  const printer = createPrinter();

  return printer.printNode(EmitHint.SourceFile, document, document);
}

/*
 * TypeScript keywords
 */

const exportKeyword = factory.createToken(SyntaxKind.ExportKeyword);
const questionToken = factory.createToken(SyntaxKind.QuestionToken);
const nullKeyword = factory.createLiteralTypeNode(
  factory.createToken(SyntaxKind.NullKeyword)
);

/**
 * Creates a node of one the specified keyword
 *
 * Output example:
 * > string
 */
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

/*
 * TypeScript node factory functions
 */

/**
 * Turns type into an array of that type
 *
 * Output example:
 * > *type*[]
 */
function arrayType(elementType: TypeNode): ArrayTypeNode {
  return factory.createArrayTypeNode(elementType);
}

/**
 * Creates a call expression
 *
 * Output:
 * > *functionName*&lt;*...typeArguments*&gt;(*...functionArguments*)
 */
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

/**
 * Creates an identifier node
 *
 * Output example:
 * > myVariable
 */
export function id(name: string): Identifier {
  return factory.createIdentifier(name);
}

function literal(
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

/**
 * Creates a literal type node
 *
 * Output examples:
 * > 42
 * > 'Hello world!'
 * > true
 */
export function literalType(value: string | number | boolean): LiteralTypeNode {
  return factory.createLiteralTypeNode(literal(value));
}

/**
 * Creates a union of literal types
 *
 * Output:
 * > *values[0]* | *values[1]*
 */
export function literalUnion(
  values: (string | number | boolean)[]
): UnionTypeNode {
  return union(values.map(literalType));
}

/**
 * Creates a named import node
 *
 * Output:
 * > import { *names[0]*, *names[1]* } from '*from*';
 */
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

/**
 * Creates an object literal
 *
 * Output:
 * > { *...properties* }
 */
export function objectLiteral(
  properties: ObjectLiteralElementLike[]
): ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(properties, true);
}

/**
 * Creates a property assignment for an object literal
 *
 * Output:
 * > { *name*: *initializer* }
 */
export function propertyAssignment(
  name: string,
  initializer: Expression
): PropertyAssignment {
  return factory.createPropertyAssignment(stringLiteral(name), initializer);
}

/**
 * Creates an object type property signature
 *
 * Output:
 * > { *name*?: *type* }
 */
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

/**
 * Creates an export from a module
 *
 * Output:
 * > export { *names[0]*, *names[1]* } from '*from*'
 */
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

/**
 * Creates a spread assignment
 *
 * Output:
 * > ...*name*
 */
export function spreadAssignment(name: string): SpreadAssignment {
  return factory.createSpreadAssignment(id(name));
}

/**
 * Creates a string literal
 *
 * Output:
 * > '*text*'
 */
export function stringLiteral(text: string): StringLiteral {
  return factory.createStringLiteral(text);
}

/**
 * Creates a type alias
 *
 * Output:
 * > export type *name* = *type*
 */
export function typeAlias(name: string, type: TypeNode): TypeAliasDeclaration {
  return factory.createTypeAliasDeclaration(
    undefined,
    [exportKeyword],
    name,
    undefined,
    type
  );
}

/**
 * Creates a type query
 *
 * Output:
 * > typeof *name*
 */
export function typeQuery(name: string): TypeQueryNode {
  return factory.createTypeQueryNode(id(name));
}

/**
 * Creates a type reference node
 *
 * Output:
 * > *name* &lt;*...typeArguments*&gt;
 */
export function typeReference(
  name: string,
  typeArguments?: TypeNode[]
): TypeReferenceNode {
  return factory.createTypeReferenceNode(name, typeArguments);
}

/**
 * Creates a union type
 *
 * Output:
 * > *values[0]* | *values[1]*
 */
export function union(types: TypeNode[]): UnionTypeNode {
  return factory.createUnionTypeNode(types);
}

/**
 * Creates a variable statement
 *
 * Output:
 * > export *name* = *initializer*
 */
export function variableStatement(
  name: string,
  initializer: Expression,
  skipExport = false
): VariableStatement {
  return factory.createVariableStatement(
    skipExport ? [] : [factory.createToken(SyntaxKind.ExportKeyword)],
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

/**
 * Creates a variable type of given type from a structure
 *
 * Output examples:
 * > boolean
 * > { something: number }
 * > unknown
 * > 'literal' | 'union'
 * > string[]
 * > number | null
 */
export function variableType(
  prefix: string,
  structure: StructureType,
  untypedType: 'any' | 'unknown',
  nonNullable = false
): KeywordTypeNode | UnionTypeNode | ArrayTypeNode | TypeLiteralNode {
  switch (structure.kind) {
    case 'PrimitiveStructure':
      return nonNullable
        ? keyword(structure.type)
        : union([keyword(structure.type), nullKeyword]);

    case 'ScalarStructure':
      return keyword(untypedType);

    case 'EnumStructure':
      return literalUnion(structure.enums.map(enumValue => enumValue.value));

    case 'ListStructure':
      return arrayType(variableType(prefix, structure.value, untypedType));

    case 'ObjectStructure': {
      const properties = Object.entries(structure.fields ?? {}).map(
        ([name, innerStructure]) => {
          const doc = isDocumentedStructure(innerStructure)
            ? {
                title: innerStructure.documentation?.title,
                description: innerStructure.documentation?.description,
              }
            : undefined;

          return addDoc(
            propertySignature(
              name,
              innerStructure.required,
              variableType('', innerStructure, untypedType)
            ),
            doc
          );
        }
      );

      return factory.createTypeLiteralNode(properties);
    }

    case 'NonNullStructure':
      return variableType(prefix, structure.value, untypedType, true);

    default:
      throw new Error(`Variable type not implemented for: ${structure.kind}`);
  }
}

/*
 * More complex Superface-specific constructs
 */

/**
 * Creates a typed client statement
 *
 * Output:
 * > export SuperfaceClient = createTypedClient(typeDefinitions)
 * > export type SuperfaceClient = InstanceType&lt;typeof SuperfaceClient&gt;
 */
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

/**
 * Creates combined type definitions object
 *
 * Output example:
 * > const typeDefinitions = {
 * >   ...myProfile
 * > }
 */
export function typeDefinitions(profiles: string[]): Statement[] {
  const camelizedProfiles = profiles.map(camelize);
  const definitions = variableStatement(
    'typeDefinitions',
    objectLiteral(camelizedProfiles.map(spreadAssignment)),
    true
  );

  return [definitions];
}

/**
 * Creates the TypedProfile object and its dependencies
 *
 * Output example:
 * > const profile = {
 * >   "MyProfile": typeHelper<MyProfileInput, MyProfileResult>()
 * > };
 * > export type MyProfileProfile = TypedProfile&lt;typeof profile&gt;
 * > export const myProfile = {
 * >   "my-profile": profile
 * > };
 */
export function createProfileType(
  profileName: string,
  usecases: { name: string; doc: { title?: string; description?: string } }[]
): Statement[] {
  const usecaseAssignments = usecases.map(usecase => {
    const pascalizedUsecaseName =
      pascalize(profileName) + pascalize(usecase.name);
    const helperCall = callExpression(
      'typeHelper',
      [],
      [pascalizedUsecaseName + 'Input', pascalizedUsecaseName + 'Result']
    );

    return addDoc(propertyAssignment(usecase.name, helperCall), usecase.doc);
  });

  const profile = variableStatement(
    'profile',
    objectLiteral(usecaseAssignments),
    true
  );
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

/**
 * Creates types from usecase Input and Result
 *
 * Output example:
 * > export type MyUsecaseInput = {
 * >   name: string
 * > }
 * > export type MyUsecaseResult = {
 * >   age: number
 * > }
 */
export function createUsecaseTypes(
  profileName: string,
  usecase: ProfileOutput['usecases'][number],
  untypedType: 'any' | 'unknown'
): Statement[] {
  const createTypes = (
    structure: StructureType,
    suffix: 'Input' | 'Result'
  ) => {
    const doc = isDocumentedStructure(structure)
      ? {
          title: structure.documentation?.title,
          description: structure.documentation?.description,
        }
      : undefined;

    return [
      addDoc(
        typeAlias(
          pascalize(profileName) + camelize(usecase.useCaseName) + suffix,
          variableType(capitalize(usecase.useCaseName), structure, untypedType)
        ),
        doc
      ),
    ];
  };

  const inputs =
    usecase.input !== undefined ? createTypes(usecase.input, 'Input') : [];
  const results =
    usecase.result !== undefined ? createTypes(usecase.result, 'Result') : [];

  return [...inputs, ...results];
}
