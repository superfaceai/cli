export type ExampleScalar = ExampleBoolean | ExampleNumber | ExampleString;

export type ExampleString = {
  kind: 'string';
  value: string;
};

export type ExampleNumber = {
  kind: 'number';
  value: number;
};

export type ExampleBoolean = {
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

export type UseCaseExample = ExampleArray | ExampleObject | ExampleScalar | ExampleNone;
