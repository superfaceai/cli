type ExamplePrimitive = string | number | boolean;

type ExampleObject = Record<string, ExampleArray | ExamplePrimitive>;

type ExampleArray = Array<ExampleArray | ExampleObject | ExamplePrimitive>;

export type UseCaseSlotExample =
  | ExampleObject
  | ExampleArray
  | ExamplePrimitive
  | null;
