import { startCase } from '../common/format';
import { ProfileId } from '../common/profile';

/**
 * Returns a usecase header with filled in `name` and `version`.
 */
export function header(name: string, version: string): string {
  return `name = "${name}"
version = "${version}"
`;
}

export function empty(name: string): string {
  return `
"""
${name} use case
Use case description
"""
usecase ${name} {}
`;
}
export function completeProfile({
  scope,
  name,
  version,
  usecaseNames,
}: {
  name: string;
  scope?: string;
  version: string;
  usecaseNames: string[];
}): string {
  const id = ProfileId.fromScopeName(scope, name);
  const formattedName = startCase(id.id);

  const error = errorModel(scope);

  return [
    `"""
${formattedName}
TODO: What "${formattedName}" does
"""
name = "${id.id}"
version = "${version}"
// Comlink Profile specification: https://superface.ai/docs/comlink/profile`,
    ...usecaseNames.map(u => usecase(u, error.statement)),
    error.namedModel,
  ].join('\n');
}

function usecase(useCaseName: string, errorStatement: string): string {
  const formattedName = startCase(useCaseName);

  return `
"""
${formattedName}
TODO: What "${formattedName}" does
"""
usecase ${useCaseName} unsafe { // change safety to \`safe\`, \`idempotent\` or \`unsafe\`
  input {
    "Foo title"
    field! string!
  }

  result {
    outputField string
  }

  error ${errorStatement}

  example Success {
    input {
      field = "example"
    }
    result {
      outputField = "result"
    }
  }

  example Fail {
    input {
      input = "error"
    }
    error {
      title = "Not Found"
      detail = "Entity not found"
    }
  }
}`;
}

function errorModel(scope: string | undefined): {
  statement: string;
  namedModel: string;
} {
  const errorName =
    scope !== undefined ? `${startCase(scope, '')}Error` : `DomainError`;

  return {
    statement: errorName,
    namedModel: `
model ${errorName} {
  """
  Title
  A short, human-readable summary of the problem type.
  """
  title! string!

  """
  Detail
  A human-readable explanation specific to this occurrence of the problem.
  """
  detail string! 
}`,
  };
}
