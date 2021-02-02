export interface Deployment {
  id: string;
  baseUrl: string;
}

export interface Auth {
  [authType: string]: {
    type: string;
    scheme: string;
  };
}

export interface Security {
  auth: Auth;
  hosts: string[];
}

export interface ProviderStructure {
  name: string;
  deployments: Deployment[];
  security?: Security[];
}
