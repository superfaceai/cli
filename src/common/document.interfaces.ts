export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile',
  MAP_AST = 'map.ast',
  PROFILE_AST = 'profile.ast',
}

export enum CreateMode {
  PROFILE = 'profile',
  MAP = 'map',
  BOTH = 'both',
  UNKNOWN = 'unknown',
}

export interface VersionStructure {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}

export interface WritingOptions {
  append?: boolean;
  force?: boolean;
  dirs?: boolean;
}
