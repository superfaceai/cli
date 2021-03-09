import {
  ApiKeySecurityIn,
  AuthSecurityType,
  BasicAuthSecurityScheme,
  BearerTokenSecurityScheme,
} from './provider.enums';

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

export type ApiKeySecurity = {
  id: string;
  type: AuthSecurityType;
  in: ApiKeySecurityIn;
  name: string;
};

export function isApiKeySecurity(
  auth: ApiKeySecurity | BasicAuthSecurity | BearerTokenSecurity
): auth is ApiKeySecurity {
  return auth.type === AuthSecurityType.API_KEY;
}

export type BasicAuthSecurity = {
  id: string;
  type: AuthSecurityType;
  scheme: BasicAuthSecurityScheme;
};

export function isBasicAuthSecurity(
  auth: ApiKeySecurity | BasicAuthSecurity | BearerTokenSecurity
): auth is BasicAuthSecurity {
  return (
    auth.type === AuthSecurityType.HTTP &&
    (auth as BasicAuthSecurity).scheme === BasicAuthSecurityScheme.BASIC
  );
}

export type BearerTokenSecurity = {
  id: string;
  type: AuthSecurityType;
  scheme: BearerTokenSecurityScheme;
  bearerFormat?: string;
};

export function isBearerTokenSecurity(
  auth: ApiKeySecurity | BasicAuthSecurity | BearerTokenSecurity
): auth is BearerTokenSecurity {
  return (
    auth.type === AuthSecurityType.HTTP &&
    (auth as BearerTokenSecurity).scheme === BearerTokenSecurityScheme.BEARER
  );
}
//TODO: update structure
export interface ProviderStructure {
  name: string;
  services: Service[];
  defaultService: string;
  securitySchemes?: (
    | ApiKeySecurity
    | BasicAuthSecurity
    | BearerTokenSecurity
  )[];
  security?: Security[];
}
