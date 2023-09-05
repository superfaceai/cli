import { relative } from 'path';

export function formatPath(
  absolutePath: string,
  relativeTo = process.cwd()
): string {
  return relative(relativeTo, absolutePath);
}
