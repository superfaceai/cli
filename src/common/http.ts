import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  VERSION as SDK_VERSION,
} from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';
import superagent, { Response } from 'superagent';

import { VERSION } from '..';
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

export const STORE_URL = new URL('https://superface.ai/').href;

export async function fetch(url: string, type: ContentType): Promise<Response> {
  const userAgent = `superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version} (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;
  try {
    return superagent.get(url).set('Accept', type).set('User-Agent', userAgent);
  } catch (err) {
    throw userError(err, 1);
  }
}

export async function fetchProfileInfo(
  profileId: string
): Promise<ProfileInfo> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.JSON);

  return response.body as ProfileInfo;
}

export async function fetchProfile(profileId: string): Promise<string> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.PROFILE);

  return (response.body as Buffer).toString();
}

export async function fetchProfileAST(
  profileId: string
): Promise<ProfileDocumentNode> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.AST);

  return response.body as ProfileDocumentNode;
}

export async function fetchProviderInfo(
  providerName: string
): Promise<ProviderJson> {
  const query = new URL(providerName, `${STORE_URL}providers/`).href;
  const response = await fetch(query, ContentType.JSON);

  return parseProviderJson(response.body);
}
