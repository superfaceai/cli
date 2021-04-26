import { ProfileDocumentNode } from '@superfaceai/ast';
import { parseProviderJson, ProviderJson } from '@superfaceai/one-sdk';
import superagent, { Response } from 'superagent';

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

export const STORE_URL = new URL('https://superface.dev/').href;

export async function fetch(
  url: string,
  type: ContentType,
  userAgent: string
): Promise<Response> {
  try {
    return superagent.get(url).set('Accept', type).set('User-Agent', userAgent);
  } catch (err) {
    throw userError(err, 1);
  }
}

export async function fetchProfileInfo(
  profileId: string,
  userAgent: string
): Promise<ProfileInfo> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.JSON, userAgent);

  return response.body as ProfileInfo;
}

export async function fetchProfile(
  profileId: string,
  userAgent: string
): Promise<string> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.PROFILE, userAgent);

  return (response.body as Buffer).toString();
}

export async function fetchProfileAST(
  profileId: string,
  userAgent: string
): Promise<ProfileDocumentNode> {
  const query = new URL(profileId, STORE_URL).href;

  const response = await fetch(query, ContentType.AST, userAgent);

  return response.body as ProfileDocumentNode;
}

export async function fetchProviderInfo(
  providerName: string,
  userAgent: string
): Promise<ProviderJson> {
  const query = new URL(providerName, `${STORE_URL}providers/`).href;
  const response = await fetch(query, ContentType.JSON, userAgent);

  return parseProviderJson(response.body);
}
