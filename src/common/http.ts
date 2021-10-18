import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  assertProviderJson,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import { VERSION as SDK_VERSION } from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import {
  ServiceApiError,
  ServiceApiErrorResponse,
  ServiceClient,
} from '@superfaceai/service-client';

import { VERSION } from '..';
import {
  DEFAULT_PROFILE_VERSION_STR,
  SF_API_URL_VARIABLE,
  SF_PRODUCTION,
} from './document';
import { userError } from './error';
import { MapId } from './map';
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

export enum ContentType {
  JSON = 'application/json',
  TEXT = 'text/plain',
  PROFILE_SOURCE = 'application/vnd.superface.profile',
  PROFILE_AST = 'application/vnd.superface.profile+json',
  MAP_SOURCE = 'application/vnd.superface.map',
  MAP_AST = 'application/vnd.superface.map+json',
}
export class SuperfaceClient {
  private static serviceClient: ServiceClient | undefined;

  public static getClient(): ServiceClient {
    if (!SuperfaceClient.serviceClient) {
      const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;
      //Use refresh token from env if found
      if (process.env.SUPERFACE_REFRESH_TOKEN) {
        SuperfaceClient.serviceClient = new ServiceClient({
          //still use getStoreUrl function to cover cases when user sets baseUrl and refresh token thru env
          baseUrl: getServicesUrl(),
          refreshToken: process.env.SUPERFACE_REFRESH_TOKEN,
          commonHeaders: { 'User-Agent': userAgent },
          //Do not use seveNetrc - refresh token from enviroment should not be saved
        });
      } else {
        const netrcRecord = loadNetrc();
        SuperfaceClient.serviceClient = new ServiceClient({
          baseUrl: netrcRecord.baseUrl,
          refreshToken: netrcRecord.refreshToken,
          commonHeaders: { 'User-Agent': userAgent },
          refreshTokenUpdatedHandler: saveNetrc,
        });
      }
    }

    return SuperfaceClient.serviceClient;
  }
}
export function getServicesUrl(): string {
  const envUrl = process.env[SF_API_URL_VARIABLE];

  if (envUrl) {
    const passedValue = new URL(envUrl).href;
    //remove ending /
    if (passedValue.endsWith('/')) {
      return passedValue.substring(0, passedValue.length - 1);
    }

    return passedValue;
  }

  return SF_PRODUCTION;
}

export async function fetchProviders(profile: string): Promise<ProviderJson[]> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;

  const response = await SuperfaceClient.getClient().fetch(
    `/providers?profile=${encodeURIComponent(profile)}`,
    {
      //TODO: enable auth
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': ContentType.JSON,
        'User-Agent': userAgent,
      },
    }
  );

  await checkSuperfaceResponse(response);

  return ((await response.json()) as { data: ProviderJson[] }).data;
}

//Unable to reuse service client getProfile due to profile ID resolution - version is always defined in service client
export async function fetchProfileInfo(
  profileId: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<ProfileInfo> {
  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    authenticate: options?.tryToAuthenticate || false,
    method: 'GET',
    headers: {
      ...commonHeaders(),
      Accept: ContentType.JSON,
    },
  });

  await checkSuperfaceResponse(response);

  return (await response.json()) as ProfileInfo;
}

export async function fetchProfile(
  profileId: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<string> {
  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    authenticate: options?.tryToAuthenticate || false,
    method: 'GET',
    headers: {
      ...commonHeaders(),
      Accept: ContentType.PROFILE_SOURCE,
    },
  });

  await checkSuperfaceResponse(response);

  return response.text();
}

export async function fetchProfileAST(
  profileId: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<ProfileDocumentNode> {
  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    authenticate: options?.tryToAuthenticate || false,
    method: 'GET',
    headers: {
      ...commonHeaders(),
      Accept: ContentType.PROFILE_AST,
    },
  });

  await checkSuperfaceResponse(response);

  return assertProfileDocumentNode(await response.json());
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  //TODO: user agent? Control authenticate?
  const response = await SuperfaceClient.getClient().getProvider(providerName);

  return assertProviderJson(response);
}

async function checkSuperfaceResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const errorResponse = (await response.json()) as ServiceApiErrorResponse;
    throw userError(new ServiceApiError(errorResponse).message, 1);
  }

  return response;
}

function commonHeaders(): Record<string, string> {
  return {
    'User-Agent': `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`,
  };
}
export async function fetchMapAST(
  profile: string,
  provider: string,
  scope?: string,
  version?: string,
  variant?: string
): Promise<MapDocumentNode> {
  const mapId = MapId.fromName({
    profile: {
      name: profile,
      scope,
    },
    provider,
    variant,
  });
  const path = '/' + mapId.withVersion(version || DEFAULT_PROFILE_VERSION_STR);

  const response = await SuperfaceClient.getClient().fetch(path, {
    //TODO: enable auth
    authenticate: false,
    method: 'GET',
    headers: {
      ...commonHeaders(),
      Accept: ContentType.MAP_AST,
    },
  });

  await checkSuperfaceResponse(response);

  return assertMapDocumentNode(await response.json());
}
