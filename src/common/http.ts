import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  VERSION as SDK_VERSION,
} from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import {
  ServiceApiErrorResponse,
  ServiceClient,
} from '@superfaceai/service-client';

import { SF_API_URL_VARIABLE, VERSION } from '..';
import { SF_PRODUCTION } from './document';
import { userError } from './error';

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
  PROFILE = 'application/vnd.superface.profile',
  AST = 'application/vnd.superface.profile+json',
}

export class SuperfaceClient {
  private static serviceClient: ServiceClient;

  public static getClient(): ServiceClient {
    if (!SuperfaceClient.serviceClient) {
      SuperfaceClient.serviceClient = new ServiceClient({
        baseUrl: getStoreUrl(),
      });
    }

    return SuperfaceClient.serviceClient;
  }
}

export function getStoreUrl(): string {
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
  profileId: string
): Promise<ProfileInfo> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;
  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    //TODO: enable auth
    authenticate: false,
    method: 'GET',
    headers: {
      Accept: ContentType.JSON,
      'User-Agent': userAgent,
    },
  });

  await checkSuperfaceResponse(response);

  return (await response.json()) as ProfileInfo;
}

export async function fetchProfile(profileId: string): Promise<string> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;

  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    //TODO: enable auth
    authenticate: false,
    method: 'GET',
    headers: {
      Accept: ContentType.PROFILE,
      'User-Agent': userAgent,
    },
  });

  await checkSuperfaceResponse(response);

  return response.text();
}

export async function fetchProfileAST(
  profileId: string
): Promise<ProfileDocumentNode> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;

  const response = await SuperfaceClient.getClient().fetch(`/${profileId}`, {
    //TODO: enable auth
    authenticate: false,
    method: 'GET',
    headers: {
      Accept: ContentType.AST,
      'User-Agent': userAgent,
    },
  });

  await checkSuperfaceResponse(response);

  return (await response.json()) as ProfileDocumentNode;
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  //TODO: user agent?
  const response = await SuperfaceClient.getClient().findOneProvider(
    providerName
  );

  return parseProviderJson(response);
}

async function checkSuperfaceResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const errorResponse = (await response.json()) as ServiceApiErrorResponse;
    throw userError(errorResponse.detail, 1);
  }

  return response;
}
