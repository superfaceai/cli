import type { UseCaseDetail } from '../../stolen-from-air';
import MAP_TEMPLATE from './map-templates';
import { makeRenderer } from './template-renderer';

export function serializeMap(input: {
  profile: {
    version: {
      major: number;
      minor: number;
    };
    name: string;
    useCases: UseCaseDetail[];
  };
  provider: {
    name: string;
    securityIds?: string[];
    integrationParameters?: string[];
  };
}): string {
  const render = makeRenderer(MAP_TEMPLATE, 'MapDocument');

  return render(input);
}
