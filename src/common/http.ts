import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  VERSION as SDK_VERSION,
} from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import superagent, { Response } from 'superagent';

import { VERSION } from '..';
import { DEFAULT_PROFILE_VERSION_STR } from './document';
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
  PROFILE_SOURCE = 'application/vnd.superface.profile',
  PROFILE_AST = 'application/vnd.superface.profile+json',
  MAP_SOURCE = 'application/vnd.superface.map',
  MAP_AST = 'application/vnd.superface.map+json',
}

export function getStoreUrl(): string {
  const envUrl = process.env.SUPERFACE_API_URL;

  return envUrl ? new URL(envUrl).href : new URL('https://superface.ai/').href;
}

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
