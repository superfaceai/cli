import type { Field, Model } from '../../templates/prepared-map/usecase/models';
import {
  ModelType,
  ScalarType,
} from '../../templates/prepared-map/usecase/models';

export function resolveBody(body: unknown): Model | undefined {
  if (body === undefined) {
    return undefined;
  }

  return visit(body);
}

function visit(body: unknown): Model {
  if (body === null) {
    return null;
  } else if (typeof body === 'boolean') {
    return visitBoolean(body);
  } else if (typeof body === 'string') {
    return visitString(body);
  } else if (typeof body === 'number') {
    return visitNumber(body);
  } else if (Array.isArray(body)) {
    return visitArray(body);
  } else if (typeof body === 'object') {
    return visitObject(body as Record<string, unknown>);
  }

  throw new Error(`Unable to parse: ${String(body)}`);
}

function visitBoolean(input: boolean): Model {
  return {
    nonNull: true,
    scalarType: ScalarType.BOOLEAN,
    modelType: ModelType.SCALAR,
    value: input,
  };
}

function visitString(input: string): Model {
  return {
    nonNull: true,
    scalarType: ScalarType.STRING,
    modelType: ModelType.SCALAR,
    value: input,
  };
}

function visitNumber(input: number): Model {
  return {
    nonNull: true,
    scalarType: ScalarType.NUMBER,
    modelType: ModelType.SCALAR,
    value: input,
  };
}

function visitArray(input: unknown[]): Model {
  return {
    nonNull: true,
    modelType: ModelType.LIST,
    model: visit(input[0]),
  };
}

function visitObject(input: Record<string, unknown>): Model {
  const fields: Field<Model>[] = [];

  for (const [key, value] of Object.entries(input)) {
    fields.push({
      fieldName: key,
      required: true,
      model: visit(value),
    });
  }

  return {
    nonNull: true,
    modelType: ModelType.OBJECT,
    fields,
  };
}
