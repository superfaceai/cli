export function formatShellLog(
  initial: string | undefined,
  quoted?: string[],
  env?: Record<string, string>
): string {
  let envString = '';
  if (env !== undefined) {
    envString =
      Object.entries(env)
        .map(([key, value]) => `${key}='${value}'`)
        .join(' ') + ' ';
  }

  let quotedString = '';
  if (quoted !== undefined && quoted.length !== 0) {
    quotedString = quoted.map(q => `'${q}'`).join(' ');
  }

  let initialString = (initial ?? '').trim();
  if (initialString !== '' && quotedString !== '') {
    initialString = initialString + ' ';
  }

  return `$ ${envString}${initialString}${quotedString}`;
}
