import type { UseCaseSlotExample } from '../../stolen-from-air';
import MOCK_MAP_TEMPLATE from './mock-map-templates';
import { makeRenderer } from './template-renderer';

export function serializeMockMap(input: {
  version: {
    major: number;
    minor: number;
  };
  name: string;
  usecases: {
    name: string;
    example?: UseCaseSlotExample;
  }[];
}): string {
  const render = makeRenderer(MOCK_MAP_TEMPLATE, 'MockMapDocument');

  return render(input);
}
