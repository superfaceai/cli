export type ExamplePrimitive = string | number | boolean;

export type ExampleObject = Record<string, ExampleArray | ExamplePrimitive>;

export type ExampleArray = Array<
  ExampleArray | ExampleObject | ExamplePrimitive
>;

export type UseCaseSlotExample =
  | ExampleObject
  | ExampleArray
  | ExamplePrimitive
  | null;

export type ParsedExamplePrimitive =
  | ParsedExampleBoolean
  | ParsedExampleNumber
  | ParsedExampleString;

export type ParsedExampleString = {
  kind: 'string';
  value: string;
};

export type ParsedExampleNumber = {
  kind: 'number';
  value: number;
};

export type ParsedExampleBoolean = {
  kind: 'boolean';
  value: boolean;
};

export type ParsedExampleObject = {
  kind: 'object';
  properties: Array<
    { name: string } & (ParsedExampleArray | ParsedExamplePrimitive)
  >;
};

export type ParsedExampleArray = {
  kind: 'array';
  items: Array<
    ParsedExampleArray | ParsedExampleObject | ParsedExamplePrimitive
  >;
};

export type ParsedUseCaseSlotExample =
  | ParsedExampleArray
  | ParsedExampleObject
  | ParsedExamplePrimitive
  | undefined;
