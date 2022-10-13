import type { UseCaseDetail } from '../../stolen-from-air';
import { makeRenderer } from './template-renderer';
import MAP_TEMPLATE from './templates';

export function serializeMap(input: {
  version: {
    major: number;
    minor: number;
  };
  name: string;
  provider: string;
  defaultSecurityId?: string;
  details: UseCaseDetail[];
}): string {
  const render = makeRenderer(MAP_TEMPLATE, 'MapDocument');

  return render(input);
}
