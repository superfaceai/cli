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
${name} usecase
"""
usecase ${name} {}
`;
}
