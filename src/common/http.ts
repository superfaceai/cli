import { ProfileDocumentNode } from '@superfaceai/ast';
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

export async function fetch(url: string, type: ContentType): Promise<Response> {
  try {
    return await superagent.get(url).set('Accept', type);
  } catch (err) {
    throw userError(err, 1);
  }
}

export async function fetchProfileInfo(
  profileId: string
): Promise<ProfileInfo> {
  const query = new URL(profileId, STORE_URL).href;

  return (await fetch(query, ContentType.JSON)).body as ProfileInfo;
}

export async function fetchProfile(profileId: string): Promise<string> {
  const query = new URL(profileId, STORE_URL).href;

  return (await fetch(query, ContentType.PROFILE)).body as string;
}

export async function fetchProfileAST(
  profileId: string
): Promise<ProfileDocumentNode> {
  const query = new URL(profileId, STORE_URL).href;

  return (await fetch(query, ContentType.AST)).body as ProfileDocumentNode;
}
