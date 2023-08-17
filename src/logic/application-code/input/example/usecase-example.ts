export type ExampleScalar = ExampleBoolean | ExampleNumber | ExampleString;

export type ExampleString = {
  kind: 'string';
  value: string;
  required: boolean;
};

export type ExampleNumber = {
  kind: 'number';
  value: number;
  required: boolean;
};

export type ExampleBoolean = {
  kind: 'boolean';
  value: boolean;
  required: boolean;
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
  required: boolean;
};

export type ExampleNone = {
  kind: 'none';
};

export type UseCaseExample =
  | ExampleArray
  | ExampleObject
  | ExampleScalar
  | ExampleNone;
