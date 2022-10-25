import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import { prepareUseCaseDetails } from '../../stolen-from-air';
import MAP_TEMPLATE from './map-templates';
import { makeRenderer } from './template-renderer';

export function serializeMap(
  profile: ProfileDocumentNode,
  provider: ProviderJson
): string {
  // security
  let securityIds: string[] | undefined = undefined;

  if (provider.securitySchemes !== undefined) {
    if (provider.securitySchemes.length === 1) {
      securityIds = [provider.securitySchemes[0].id];
    }

    if (provider.securitySchemes.length > 1) {
      securityIds = provider.securitySchemes.map(s => s.id);
    }
  }
  // parameters
  let integrationParameters: string[] | undefined = undefined;

  if (provider.parameters !== undefined) {
    integrationParameters = provider.parameters.map(p => p.name);
  }

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
      securityIds,
      integrationParameters,
    },
  };

  const render = makeRenderer(MAP_TEMPLATE, 'MapDocument');

  return render(input);
}
