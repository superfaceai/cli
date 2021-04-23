export function filterUndefined<T>(item: T): item is Exclude<T, undefined> {
  return item !== undefined;
}

export function arrayFilterUndefined<T>(array: T[]): Exclude<T, undefined>[] {
  return array.filter(filterUndefined);
}
