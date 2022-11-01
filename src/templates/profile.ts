/**
 * Returns a usecase header with filled in `name` and `version`.
 */
export function header(name: string, version: string): string {
  return `name = "${name}"
version = "${version}"
// Profile specification: https://superface.ai/docs/comlink/profile
`;
}

export function empty(name: string): string {
  return `
"""
${name} usecase
"""
usecase ${name} {}
`;
}

export function withInputs(name: string): string {
  return `
"""
${name} usecase
"""
usecase ${name} {
  input {}
  result {}
  error {}

  example success {
    input {}
    result {}
  }

  example fail {
    input {}
    error {}
  }
}
`;
}
