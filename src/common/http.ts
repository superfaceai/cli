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
import { ProfileId } from './profile';

export interface ProfileInfo {
  owner: string;
  owner_url: string;
  profile_id: string;
  profile_name: string;
  profile_version: string;
  published_at: Date;
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
  const response = await SuperfaceClient.getClient().fetch(
    `/providers?profile=${encodeURIComponent(profile)}`,
    {
      //TODO: enable auth
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': ContentType.JSON,
      },
    }
  );

  await checkSuperfaceResponse(response);

  return ((await response.json()) as { data: ProviderJson[] }).data;
}

export async function fetchProfileInfo(
  profile: ProfileId,
  version?: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<ProfileInfo> {
  return SuperfaceClient.getClient().getProfile(
    { name: profile.name, scope: profile.scope, version },
    {
      authenticate: options?.tryToAuthenticate,
    }
  );
}

export async function fetchProfile(
  profile: ProfileId,
  version?: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<string> {
  return SuperfaceClient.getClient().getProfileSource(
    { name: profile.name, scope: profile.scope, version },
    {
      authenticate: options?.tryToAuthenticate,
    }
  );
}

export async function fetchProfileAST(
  profile: ProfileId,
  version?: string,
  options?: {
    tryToAuthenticate?: boolean;
  }
): Promise<ProfileDocumentNode> {
  const response = await SuperfaceClient.getClient().getProfileAST(
    { name: profile.name, scope: profile.scope, version },
    {
      authenticate: options?.tryToAuthenticate,
    }
  );

  return assertProfileDocumentNode(JSON.parse(response));
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  const response = await SuperfaceClient.getClient().getProvider(providerName);

  return assertProviderJson(response.definition);
}

async function checkSuperfaceResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const errorResponse = (await response.json()) as ServiceApiErrorResponse;
    throw userError(new ServiceApiError(errorResponse).message, 1);
  }

  return response;
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
      Accept: ContentType.MAP_AST,
    },
  });

  await checkSuperfaceResponse(response);

  return assertMapDocumentNode(await response.json());
}
