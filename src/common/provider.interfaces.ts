export interface Service {
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
  services: Service[];
  defaultService: string;
  security?: Security[];
}
