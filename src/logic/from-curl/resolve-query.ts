export function resolveQuery(
  parsed: Record<string, any> | undefined
): Record<string, string> | undefined {
  if (parsed === undefined || Object.keys(parsed).length === 0) {
    return undefined;
  }
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      query[key] = value.map(v => String(v)).join(',');
    } else {
      query[key] = String(value);
    }
  }

  return query;
}
