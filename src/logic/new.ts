import type { ProviderJson } from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';
import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from '../common';
import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import type { UX } from '../common/ux';

export type ProfilePreparationResponse = {
  // Id of the profile with . separated scope and name
  id: string;
  // TODO: get AST from server to avoid parsing (possible problems with AST/Parser versioning)?
  profile: {
    source: string;
  };
};

function assertProfileResponse(
  input: unknown
): asserts input is ProfilePreparationResponse {
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    'profile' in input
  ) {
    const tmp = input as { id: string; profile: { source?: string } };

    if (typeof tmp.profile.source !== 'string') {
      throw Error(
        `Unexpected response received - missing profile source: ${JSON.stringify(
          tmp,
          null,
          2
        )}`
      );
    }

    try {
      parseProfile(new Source(tmp.profile.source));
    } catch (e) {
      throw Error(
        `Unexpected response received - unable to parse profile source: ${JSON.stringify(
          e,
          null,
          2
        )}`
      );
    }

    // TODO: validate id format?
    if (typeof tmp.id === 'string') {
      return;
    }
  }

  throw Error(`Unexpected response received`);
}

export async function newProfile(
  {
    providerJson,
    prompt,
    options,
  }: {
    providerJson: ProviderJson;
    prompt: string;
    options?: { quiet?: boolean };
  },
  { logger, userError, ux }: { logger: ILogger; userError: UserError; ux: UX }
): Promise<{ source: string; scope?: string; name: string }> {
  logger.info('startProfileGeneration', providerJson.name);

  const client = SuperfaceClient.getClient();

  const jobUrl = await startProfilePreparation(
    { providerJson, prompt },
    { client, userError }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { client, userError, ux }
  );

  const profileResponse = await finishProfilePreparation(resultUrl, {
    client,
  });

  // Supports both . and / in profile id
  const parsedProfileId = parseDocumentId(
    profileResponse.id.replace(/\./, '/')
  );
  if (parsedProfileId.kind == 'error') {
    throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
  }

  return {
    source: profileResponse.profile.source,
    scope: parsedProfileId.value.scope,
    name: parsedProfileId.value.middle[0],
  };
}

async function startProfilePreparation(
  { providerJson, prompt }: { providerJson: ProviderJson; prompt: string },
  { client, userError }: { client: ServiceClient; userError: UserError }
): Promise<string> {
  // TODO: check real url
  const jobUrlResponse = await client.fetch(`/authoring/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, provider: providerJson }),
  });

  if (jobUrlResponse.status !== 202) {
    if (jobUrlResponse.status === 401) {
      throw userError(
        `You are not authorized to access this resource. Make sure that you are logged in.`,
        1
      );
    }
    throw userError(
      `Unexpected status code ${jobUrlResponse.status} received`,
      1
    );
  }

  const responseBody = (await jobUrlResponse.json()) as Record<string, unknown>;

  if (
    typeof responseBody === 'object' &&
    responseBody !== null &&
    'href' in responseBody &&
    typeof responseBody.href === 'string'
  ) {
    return responseBody.href;
  } else {
    throw userError(
      `Unexpected response body ${JSON.stringify(responseBody)} received`,
      1
    );
  }
}

async function finishProfilePreparation(
  resultUrl: string,
  { client }: { client: ServiceClient }
): Promise<ProfilePreparationResponse> {
  const resultResponse = await client.fetch(resultUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    // Url from server is complete, so we don't need to add baseUrl
    baseUrl: '',
  });

  if (resultResponse.status !== 200) {
    throw Error(`Unexpected status code ${resultResponse.status} received`);
  }

  const body = (await resultResponse.json()) as unknown;

  assertProfileResponse(body);

  return body;
}
