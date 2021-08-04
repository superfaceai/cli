/**
 * Returns a map header with filled in `name` with `version`, `provider` and `variant`.
 */
export function header(
  name: string,
  provider: string,
  version: string,
  variant?: string
): string {
  const variantAssignment = variant ? `variant = "${variant}"\n` : '';

  return `profile = "${name}@${version}"
provider = "${provider}"
${variantAssignment}`;
}

export function empty(name: string): string {
  return `
"""
${name} map
"""
map ${name} {}
`;
}
