import { format as formatPath, normalize, parse as parsePath } from 'path';

export const NORMALIZED_CWD_PATH = normalize('./');
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
