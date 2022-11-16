import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import MAP_TEMPLATE from './map-templates';
import { makeRenderer } from './template-renderer';
import { prepareUseCaseDetails } from './usecase';

export function prepareMapTemplate(
  profile: ProfileDocumentNode,
  provider: ProviderJson
): string {
  const input = {
    profile: {
      version: {
        major: profile.header.version.major,
        minor: profile.header.version.minor,
      },
      name: ProfileId.fromScopeName(profile.header.scope, profile.header.name)
        .id,
      useCases: prepareUseCaseDetails(profile),
    },
    provider: {
      name: provider.name,
      securityIds:
        provider.securitySchemes !== undefined
          ? provider.securitySchemes.map(s => s.id)
          : undefined,
      integrationParameters:
        provider.parameters !== undefined
          ? provider.parameters.map(p => p.name)
          : undefined,
    },
  };

  const render = makeRenderer(MAP_TEMPLATE, 'MapDocument');

  return render(input);
}
