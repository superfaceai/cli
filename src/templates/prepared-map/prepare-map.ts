import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import { inspect } from 'util';

import { ProfileId } from '../../common/profile';
import { makeRenderer } from '../shared/template-renderer';
import MAP_TEMPLATE from './map-templates';
import { prepareUseCaseDetails } from './usecase';
import type { Model } from './usecase/models';

export function prepareMapTemplate(
  profile: ProfileDocumentNode,
  provider: ProviderJson,
  fromCurl?: {
    url?: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    method?: string;
    body?: Model;
  }
): string {
  const input = {
    profile: {
      version: {
        major: profile.header.version.major,
        minor: profile.header.version.minor,
      },
      name: ProfileId.fromScopeName(profile.header.scope, profile.header.name)
        .id,
      useCases: prepareUseCaseDetails(profile, fromCurl),
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

  console.log('in', inspect(input.profile.useCases[0].realData, true, 20));

  const render = makeRenderer(MAP_TEMPLATE, 'MapDocument');

  return render(input);
}
