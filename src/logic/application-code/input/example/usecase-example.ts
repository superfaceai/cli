export type ExampleScalar = ExampleBoolean | ExampleNumber | ExampleString;

type ExampleString = {
  kind: 'string';
  value: string;
};

type ExampleNumber = {
  kind: 'number';
  value: number;
};

type ExampleBoolean = {
  kind: 'boolean';
  value: boolean;
};

export type ExampleObject = {
  kind: 'object';
  properties: ({ name: string } & (
    | ExampleArray
    | ExampleScalar
    | ExampleNone
    | ExampleObject
  ))[];
};

export type ExampleArray = {
  kind: 'array';
  items: (ExampleArray | ExampleObject | ExampleScalar | ExampleNone)[];
};

export type ExampleNone = {
  kind: 'none';
};

export type UseCaseExample =
  | ExampleArray
  | ExampleObject
  | ExampleScalar
  | ExampleNone;
