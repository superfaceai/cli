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

  const error = errorModel(scope, usecaseNames.length > 1);

  return [
    `"""
${formattedName}
TODO: What "${formattedName}" does
"""
name = "${id.id}"
version = "${version}"
// Comlink Profile specification: https://superface.ai/docs/comlink/profile`,
    ...usecaseNames.map(u => usecase(u, error.statement)),
    error.namedModel !== undefined ? error.namedModel : '',
  ].join('\n');
}

function usecase(useCaseName: string, errorStatement: string): string {
  const formattedName = startCase(useCaseName);

  return `
"""
${formattedName}
TODO: What "${formattedName}" does
"""
usecase ${useCaseName} unsafe { // change safety to \`safe\` or \`idempotent\` or \`unsafe\`
  input {
    """
    Foo
    TODO: description of "foo"
    """
    foo! string 
  }

  result {
    """
    Bar
    TODO: description of "bar"
    """
    bar string
  }

  error ${errorStatement}

  example success {
    input {
      foo = "example"
    }
    result {
      bar = "result"
    }
  }

  example fail {
    input {
      foo = "error"
    }
    error {
      title = "Not Found"
      detail = "Entity not found"
    }
  }
}`;
}

function errorModel(
  scope: string | undefined,
  reuseModel: boolean
): { statement: string; namedModel?: string } {
  const definition = `{
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
  }`;

  if (reuseModel) {
    const errorName =
      scope !== undefined ? `${startCase(scope, '')}Error` : `DomainError`;

    return {
      statement: errorName,
      namedModel: `model ${errorName}` + definition,
    };
  }

  return {
    statement: definition,
  };
}
