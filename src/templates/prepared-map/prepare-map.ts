import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';

import { ProfileId } from '../../common/profile';
import { makeRenderer } from '../shared/template-renderer';
import MAP_TEMPLATE from './map-templates';
import { prepareUseCaseDetails } from './usecase';

export function prepareMapTemplate(
  profile: ProfileDocumentNode,
  provider: ProviderJson,
  variant?: string
): string {
  const input = {
    variant,
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
      baseUrl:
        provider.services.find(s => s.id === provider.defaultService)
          ?.baseUrl ??
        provider.services[0]?.baseUrl ??
        'undefined',
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
