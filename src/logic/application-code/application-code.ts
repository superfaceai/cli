import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import { parseProfile, Source } from '@superfaceai/parser';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import { stringifyError } from '../../common/error';
import { prepareUseCaseInput } from './input/prepare-usecase-input';
import { jsApplicationCode } from './js';

export async function writeApplicationCode(
  {
    providerJson,
    profile,
    useCaseName,
  }: // target
  {
    providerJson: ProviderJson;
    profile: {
      source: string;
      name: string;
      scope?: string;
    };
    useCaseName: string;
    // TODO: add more target languages
    // target: 'js';
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<string> {
  let profileAst: ProfileDocumentNode;

  try {
    profileAst = parseProfile(new Source(profile.source));
  } catch (error) {
    throw userError(`Invalid profile source: ${stringifyError(error)}`, 1);
  }

  // TODO: this should be language independent and also take use case name as input
  let inputExample: string;
  try {
    inputExample = prepareUseCaseInput(profileAst);
  } catch (error) {
    // TODO: fallback to empty object?
    throw userError(
      `Input example construction failed: ${stringifyError(error)}`,
      1
    );
  }

  return jsApplicationCode(
    {
      profile: {
        name: profile.name,
        scope: profile.scope,
      },
      useCaseName,
      provider: providerJson.name,
      input: inputExample,
      parameters: providerJson.parameters,
      security: providerJson.securitySchemes,
    },
    { logger }
  );
}
