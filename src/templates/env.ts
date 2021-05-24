export function envVariable(name: string, value: string): string {
  return `${name}=${value}\n`;
}
