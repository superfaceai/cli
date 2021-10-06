import { SuperJson } from '@superfaceai/one-sdk';
import {
  dirname,
  format as formatPath,
  isAbsolute,
  normalize,
  parse as parsePath,
  resolve,
} from 'path';

export const NORMALIZED_CWD_PATH = normalize('./');

export function resolveSuperfaceRelatedPath(
  path: string,
  superJson: SuperJson
): string {
  if (!isAbsolute(path)) {
    path = resolve(process.cwd(), path);
  }

  const superfacePath = resolve(superJson.path);
  if (path.startsWith(dirname(superfacePath))) {
    return NORMALIZED_CWD_PATH + superJson.relativePath(path);
  } else {
    return superJson.relativePath(path);
  }
}
/**
 * In practice, this is the number of starting `../` parts of the normalized relative path.
 */
export function pathParentLevel(path: string): number {
  let current = normalize(path);

  let number = 0;
  while (current.startsWith('../')) {
    current = current.slice('../'.length);
    number += 1;
  }

  return number;
}

export function replaceExt(path: string, newExt: string): string {
  const parsed = parsePath(path);
  const formatted = formatPath({
    root: parsed.root,
    dir: parsed.dir,
    ext: newExt,
    name: parsed.name,
  });

  return formatted;
}
