import { relative } from 'path';

export function formatWordPlurality(num: number, word: string): string {
  if (num === 1) {
    return `${num} ${word}`;
  } else {
    return `${num} ${word}s`;
  }
}

function sfWords(input: string): string[] {
  return input.split(/[,|\-|/]+|(?=[A-Z])/g) ?? [];
}

export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.substring(1);
}

// https://github.com/lodash/lodash/blob/master/startCase.js
export function startCase(input: string, delimiter = ' '): string {
  return sfWords(`${input}`.trim().replace(/['\u2019]/g, '')).reduce(
    (result, word, index) =>
      result + (index ? delimiter : '') + capitalize(word),
    ''
  );
}

export function formatPath(
  absolutePath: string,
  relativeTo = process.cwd()
): string {
  return relative(relativeTo, absolutePath);
}
