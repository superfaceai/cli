export interface Usecases {
  [usecaseName: string]: {
    input: {
      [key: string]: string | number | boolean;
    };
  };
}

export interface ProfileProvider {
  [providerName: string]: {
    mapVariant: string;
    mapRevision: string;
    defaults?: Usecases;
  };
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
    deployments?: {
      default: {
        baseUrl: string;
      };
    };
  };
}

export interface SuperJsonStructure {
  profiles: ProfileSettings;
  providers: ProviderSettings;
  lock?: unknown;
}
