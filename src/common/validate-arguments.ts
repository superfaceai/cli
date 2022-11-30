import { isValidProviderName } from '@superfaceai/ast';
import { parseDocumentId } from '@superfaceai/parser';

import type { UserError } from './error';

export function validateArguments(
  possibleProfileId: string | undefined,
  possibleProviderName: string | undefined,
  { userError }: { userError: UserError }
) {
  if (possibleProfileId === undefined) {
    throw userError('Missing profile id argument', 1);
  }

  if (possibleProviderName === undefined) {
    throw userError('Missing provider name argument', 1);
  }

  let profileId: string, providerName: string;
  const parsedProfileId = parseDocumentId(possibleProfileId);
  if (parsedProfileId.kind === 'error') {
    throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
  } else {
    profileId = possibleProfileId;
  }

  if (!isValidProviderName(possibleProviderName)) {
    throw userError(`Invalid provider name: ${possibleProviderName}`, 1);
  } else {
    providerName = possibleProviderName;
  }

  return {
    profileId,
    providerName,
  };
}
