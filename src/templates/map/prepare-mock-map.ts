import { inspect } from 'util';
import type {
  ExampleArray,
  ExampleObject,
  ExamplePrimitive,
  ParsedExampleArray,
  ParsedExampleObject,
  ParsedExamplePrimitive,
  ParsedUseCaseSlotExample,
  UseCaseSlotExample,
} from '../../stolen-from-air';
import { makeRenderer } from './template-renderer';
import MOCK_MAP_TEMPLATE from './mock-templates';

export function serializeMockMap(input: {
  version: {
    major: number;
    minor: number;
  };
  name: string;
  usecases: {
    name: string;
    example?: UseCaseSlotExample;
  }[];
}): string {
  const parsed = input.usecases.map(u => ({
    name: u.name,
    example: parse(u.example),
  }));
  const parsedInput = {
    ...input,
    usecases: parsed,
  };
  console.log('parsed', inspect(parsedInput, true, 20));
  const render = makeRenderer(MOCK_MAP_TEMPLATE, 'MockMapDocument');

  return render(parsedInput);
}

function parse(example?: UseCaseSlotExample): ParsedUseCaseSlotExample {
  if (example === undefined || example === null) {
    return;
  }

  if (Array.isArray(example)) {
    return parseArray(example);
  }

  if (typeof example === 'object') {
    return parseObject(example);
  }

  return parsePrimitive(example);
}
function parsePrimitive(primitive: ExamplePrimitive): ParsedExamplePrimitive {
  if (typeof primitive === 'boolean') {
    return {
      kind: 'boolean',
      value: primitive,
    };
  }

  if (typeof primitive === 'number') {
    return {
      kind: 'number',
      value: primitive,
    };
  }

  return {
    kind: 'string',
    value: primitive,
  };
}

function parseObject(object: ExampleObject): ParsedExampleObject {
  const properties: ({
    name: string;
  } & (ParsedExamplePrimitive | ParsedExampleArray))[] = [];

  for (const [name, value] of Object.entries(object)) {
    if (Array.isArray(value)) {
      properties.push({
        name,
        ...parseArray(value),
      });
    } else {
      properties.push({
        name,
        ...parsePrimitive(value),
      });
    }
  }

  return {
    kind: 'object',
    properties,
  };
}

function parseArray(array: ExampleArray): ParsedExampleArray {
  const items: Array<
    ParsedExampleArray | ParsedExampleObject | ParsedExamplePrimitive
  > = [];

  for (const item of array) {
    if (typeof item === 'object') {
      items.push(parseObject(item as ExampleObject));
    } else if (Array.isArray(item)) {
      items.push(parseArray(item));
    } else {
      items.push(parsePrimitive(item));
    }
  }

  return {
    kind: 'array',
    items,
  };
}
