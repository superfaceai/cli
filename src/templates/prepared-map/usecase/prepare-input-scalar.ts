import type {
  ExampleArray,
  ExampleObject,
  UseCaseExample,
} from './example/usecase-example';

export function prepareExampleScalar(
  place: string,
  example?: UseCaseExample
): undefined | string {
  if (example === undefined) {
    return example;
  }
  if (
    example.kind === 'boolean' ||
    example.kind === 'number' ||
    example.kind === 'string' ||
    example.kind === 'none'
  ) {
    return place;
  }

  if (example.kind === 'array') {
    return visitArray(example, place ?? '');
  } else {
    return visitObject(example, place ?? '');
  }
}

function visitObject(object: ExampleObject, path: string): string {
  if (object.properties.length === 0) {
    return path;
  }
  const newpath = `${path}.${object.properties[0].name}`;

  if (object.properties[0].kind === 'array') {
    return visitArray(object.properties[0], newpath);
  } else if (object.properties[0].kind === 'object') {
    return visitObject(object.properties[0], newpath);
  }

  return newpath;
}

function visitArray(array: ExampleArray, path: string): string {
  if (array.items.length === 0) {
    return path;
  }
  const newpath = `${path}[0]`;
  if (array.items[0].kind === 'array') {
    return visitArray(array.items[0], newpath);
  } else if (array.items[0].kind === 'object') {
    return visitObject(array.items[0], newpath);
  } else {
    return newpath;
  }
}
