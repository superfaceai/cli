export interface Usecases {
  // TODO: input can contain non primitive values as well
  [usecaseName: string]: {
    input: {
      [key: string]: unknown;
    };
  };
}

export interface ProfileProvider {
  [providerName: string]: {
    mapVariant?: string;
    mapRevision?: string;
    file: string;
    defaults?: Usecases;
  } | string;
}

export interface ProfileSettings {
  [profileName: string]:
    | string
    | {
        version?: string;
        file?: string;
        providers?: ProfileProvider;
        defaults?: Usecases;
      };
}

export interface ProviderSettings {
  [providerName: string]: {
    auth: {
      [authType: string]: unknown;
    };
  } | string;
}

export interface SuperJsonStructure {
  profiles: ProfileSettings;
  providers: ProviderSettings;
  lock?: unknown;
}
