import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  VERSION as SDK_VERSION,
} from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import {
  AuthToken,
  ServiceApiError,
  ServiceApiErrorResponse,
  ServiceClient,
} from '@superfaceai/service-client';
import superagent, { Response } from 'superagent';

import { VERSION } from '..';
import { DEFAULT_PROFILE_VERSION_STR } from './document';
import { userError } from './error';
import { loadNetrc, saveNetrc } from './netrc';

export interface ProfileInfo {
  owner: string;
  owner_url: string;
  profile_id: string;
  profile_name: string;
  profile_version: string;
  published_at: string;
  published_by: string;
  url: string;
}

export interface GetProfileResponse {
  response: ProfileInfo | string;
}

export interface InitLoginResponse {
  verify_url: string; //'https://superface.ai/auth/cli/verify?token=stub',
  browser_url: string; //'https://superface.ai/auth/cli/browser?code=stub'
  expires_at: string; //'2022-01-01T00:00:00.000Z'
}

export enum ContentType {
  JSON = 'application/json',
  PROFILE_SOURCE = 'application/vnd.superface.profile',
  PROFILE_AST = 'application/vnd.superface.profile+json',
  MAP_SOURCE = 'application/vnd.superface.map',
  MAP_AST = 'application/vnd.superface.map+json',
}
//TODO: not sure about this approach
export class SuperfaceClient {
  private static serviceClient: ServiceClient;

  public static getClient(): ServiceClient {
    if (!SuperfaceClient.serviceClient) {
      //Use refresh token form env if found
      if (process.env.SUPERFACE_REFRESH_TOKEN) {
        SuperfaceClient.serviceClient = new ServiceClient({
          refreshToken: process.env.SUPERFACE_REFRESH_TOKEN,
          refreshTokenUpdatedHandler: saveNetrc,
        });
      } else {
        const netrcRecord = loadNetrc();
        SuperfaceClient.serviceClient = new ServiceClient({
          baseUrl: netrcRecord.baseUrl,
          refreshToken: netrcRecord.refreshToken,
          refreshTokenUpdatedHandler: saveNetrc,
        });
      }
      //TODO: check refresh token validity or left it to actual fetch call
    }

    return SuperfaceClient.serviceClient;
  }
}
export function getStoreUrl(): string {
  const envUrl = process.env.SUPERFACE_API_URL;

  return envUrl ? new URL(envUrl).href : new URL('https://superface.ai/').href;
}
//TODO: use service client
export async function fetch(
  url: string,
  type: ContentType,
  query?: Record<string, string | number>
): Promise<Response> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;
  try {
    if (query) {
      return superagent
        .get(url)
        .query(query)
        .set('Accept', type)
        .set('User-Agent', userAgent);
    }

    return superagent.get(url).set('Accept', type).set('User-Agent', userAgent);
  } catch (err) {
    throw userError(err, 1);
  }
}
export async function fetchProfiles(): Promise<
  { scope: string; profile: string; version: string }[]
> {
  //Mock response for now
  return [{ scope: 'communication', profile: 'send-email', version: '1.0.1' }];
}

export async function fetchProviders(profile: string): Promise<ProviderJson[]> {
  const query = new URL('providers', getStoreUrl()).href;

  const response = await fetch(query, ContentType.JSON, { profile });

  return (response.body as { data: ProviderJson[] }).data;
}

export async function fetchProfileInfo(
  profileId: string
): Promise<ProfileInfo> {
  const query = new URL(profileId, getStoreUrl()).href;

  const response = await fetch(query, ContentType.JSON);

  return response.body as ProfileInfo;
}

export async function fetchProfile(profileId: string): Promise<string> {
  const query = new URL(profileId, getStoreUrl()).href;

  const response = await fetch(query, ContentType.PROFILE_SOURCE);

  return (response.body as Buffer).toString();
}

export async function fetchProfileAST(
  profileId: string
): Promise<ProfileDocumentNode> {
  const query = new URL(profileId, getStoreUrl()).href;

  const response = await fetch(query, ContentType.PROFILE_AST);

  return response.body as ProfileDocumentNode;
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  const query = new URL(providerName, `${getStoreUrl()}providers/`).href;
  const response = await fetch(query, ContentType.JSON);

  return parseProviderJson(response.body);
}

export async function initLogin(): Promise<InitLoginResponse> {
  const initLoginResponse = await SuperfaceClient.getClient().fetch(
    '/auth/cli',
    {
      method: 'POST',
      headers: { 'Content-Type': ContentType.JSON },
    }
  );
  if (!initLoginResponse.ok) {
    const errorResponse = (await initLoginResponse.json()) as ServiceApiErrorResponse;
    throw new ServiceApiError(errorResponse);
  }

  //TODO: where check expiresAt?
  return (await initLoginResponse.json()) as InitLoginResponse;
}

//TODO: check what actual return type is
export async function fetchVerificationUrl(url: string): Promise<AuthToken> {
  const fetchAuth = async (retries = 3): Promise<AuthToken> => {
    try {
      const authResponse = await SuperfaceClient.getClient().fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': ContentType.JSON },
      });

      if (!authResponse.ok) {
        //TODO: use userError
        const errorResponse = (await authResponse.json()) as ServiceApiErrorResponse;
        throw new ServiceApiError(errorResponse);
      }

      //TODO: Call service client login?
      return (await authResponse.json()) as AuthToken;
    } catch (err) {
      //TODO: err resolution
      if (retries > 0 && err instanceof ServiceApiError && err.status > 500)
        return fetchAuth(retries - 1);
      throw err;
    }
  };

  return fetchAuth();
}
//HACK: we don' have service client in this branch so we are making request directly. Use service-client in the future
export async function fetchMapAST(
  profile: string,
  provider: string,
  scope?: string,
  version?: string,
  variant?: string
): Promise<MapDocumentNode> {
  const path = variant
    ? `/${scope ? `${scope}/` : ''}${profile}.${provider}.${variant}@${
        version ? version : DEFAULT_PROFILE_VERSION_STR
      }`
    : `/${scope ? `${scope}/` : ''}${profile}.${provider}@${
        version ? version : DEFAULT_PROFILE_VERSION_STR
      }`;
  const url = new URL(path, getStoreUrl()).href;

  const response = await fetch(url, ContentType.MAP_AST);

  return response.body as MapDocumentNode;
}
