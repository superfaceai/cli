import type { ProfileDocumentNode } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import { prepareUseCaseDetails } from '../prepared-map/usecase';
import { makeRenderer } from '../shared/template-renderer';
import TEST_TEMPLATE from './test-templates';

export function prepareTestTemplate(
  profile: ProfileDocumentNode,
  provider: string
): string {
  const input = {
    profile: ProfileId.fromScopeName(profile.header.scope, profile.header.name)
      .id,
    useCases: prepareUseCaseDetails(profile),
    provider,
  };

  const render = makeRenderer(TEST_TEMPLATE, 'Test');

  return render(input);
}
