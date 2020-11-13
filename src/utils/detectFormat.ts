
/**
 * Detects whether the file on path is Superface Map or Superface Profile based on the extension.
 * @param path 
 */
export function detectFormat(path: string): SuperfaceFormat {
  const normalizedPath = path.toLowerCase().trim();
  if (normalizedPath.endsWith('.suma')) {
    return SuperfaceFormat.Map;
  }
  if (normalizedPath.endsWith('.supr')) {
    return SuperfaceFormat.Profile;
  }

  return SuperfaceFormat.UNKNOWN;
}

export enum SuperfaceFormat {
  Profile,
  Map,
  UNKNOWN
}
