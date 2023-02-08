import type { ProfileDocumentNode } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import { makeRenderer } from '../shared/template-renderer';
import MOCK_MAP_TEMPLATE from './mock-map-templates';
import { prepareUseCaseDetails } from './usecase';

export function prepareMockMapTemplate(profile: ProfileDocumentNode): string {
  const input = {
    version: {
      major: profile.header.version.major,
      minor: profile.header.version.minor,
    },
    name: ProfileId.fromScopeName(profile.header.scope, profile.header.name).id,
    usecases: prepareUseCaseDetails(profile).map(d => ({
      name: d.name,
      example: d.successExamples?.[0]?.result,
    })),
  };

  const render = makeRenderer(MOCK_MAP_TEMPLATE, 'MockMapDocument');

  return render(input);
}
