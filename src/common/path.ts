import {
  dirname,
  format as formatPath,
  isAbsolute,
  normalize,
  parse as parsePath,
  relative as relativePath,
  resolve,
} from 'path';

export const NORMALIZED_CWD_PATH = normalize('./');
/**
 * Resolves specified path according to provided SuperJson
 * @param path relative or absolute path
 * @param superJson SuperJson to be used to resolution
 * @returns relative path from super.json. Starts with ./ if original path leads to superface directory
 */
export function resolveSuperfaceRelativePath(
  superJsonPath: string,
  path: string
): string {
  // Make input path absolute
  if (!isAbsolute(path)) {
    path = resolve(process.cwd(), path);
  }
  // Absolute path to super.json
  const superfacePath = resolve(superJsonPath);
  // If path leads to superface directory
  if (path.startsWith(dirname(superfacePath))) {
    return NORMALIZED_CWD_PATH + relativePath(dirname(superJsonPath), path);
  } else {
    return relativePath(dirname(superJsonPath), path);
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
