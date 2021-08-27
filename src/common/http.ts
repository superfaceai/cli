import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  VERSION as SDK_VERSION,
} from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import { ServiceClient } from '@superfaceai/service-client';
import superagent, { Response } from 'superagent';

import { VERSION } from '..';
import {
  DEFAULT_PROFILE_VERSION_STR,
  SF_API_URL_VARIABLE,
  SF_PRODUCTION,
} from './document';
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

export enum ContentType {
  JSON = 'application/json',
  PROFILE_SOURCE = 'application/vnd.superface.profile',
  PROFILE_AST = 'application/vnd.superface.profile+json',
  MAP_SOURCE = 'application/vnd.superface.map',
  MAP_AST = 'application/vnd.superface.map+json',
}
export class SuperfaceClient {
  private static serviceClient: ServiceClient;

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
  const query = new URL('/providers', getServicesUrl()).href;

  const response = await fetch(query, ContentType.JSON, { profile });

  return (response.body as { data: ProviderJson[] }).data;
}

export async function fetchProfileInfo(
  profileId: string
): Promise<ProfileInfo> {
  const query = new URL(profileId, getServicesUrl()).href;

  const response = await fetch(query, ContentType.JSON);

  return response.body as ProfileInfo;
}

export async function fetchProfile(profileId: string): Promise<string> {
  const query = new URL(profileId, getServicesUrl()).href;

  const response = await fetch(query, ContentType.PROFILE_SOURCE);

  return (response.body as Buffer).toString();
}

export async function fetchProfileAST(
  profileId: string
): Promise<ProfileDocumentNode> {
  const query = new URL(profileId, getServicesUrl()).href;

  const response = await fetch(query, ContentType.PROFILE_AST);

  return response.body as ProfileDocumentNode;
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  const query = new URL(providerName, `${getServicesUrl()}/providers/`).href;
  const response = await fetch(query, ContentType.JSON);

  return parseProviderJson(response.body);
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
  const url = new URL(path, getServicesUrl()).href;

  const response = await fetch(url, ContentType.MAP_AST);

  return response.body as MapDocumentNode;
}
