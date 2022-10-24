import type { ProfileDocumentNode } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import { ProfileASTAdapter } from '../../stolen-from-air/profile-adapter';
import MOCK_MAP_TEMPLATE from './mock-map-templates';
import { makeRenderer } from './template-renderer';

export function serializeMockMap(profile: ProfileDocumentNode): string {
  const input = {
    version: {
      major: profile.header.version.major,
      minor: profile.header.version.minor,
    },
    name: ProfileId.fromScopeName(profile.header.scope, profile.header.name).id,
    usecases: new ProfileASTAdapter(profile).getUseCaseDetailList().map(d => ({
      name: d.name,
      example: d.successExample?.result,
    })),
  };

  const render = makeRenderer(MOCK_MAP_TEMPLATE, 'MockMapDocument');

  return render(input);
}
