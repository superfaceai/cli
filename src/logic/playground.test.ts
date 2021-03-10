import { realpathSync } from 'fs';
import { join as joinPath } from 'path';

import { detectPlayground } from './playground';

describe('playground logic', () => {
  const baseFixtures = realpathSync(joinPath('fixtures', 'playgrounds'));

  const invalidPlayground = {
    name: 'invalid',
    path: joinPath(baseFixtures, 'invalid'),
  };
  const fixedPlayground = {
    name: 'pub-hours',
    path: joinPath(baseFixtures, 'pub-hours'),
    profilePath: joinPath(baseFixtures, 'pub-hours', 'pub-hours.supr'),
    providers: [
      {
        name: 'osm',
        mapPath: joinPath(baseFixtures, 'pub-hours', 'pub-hours.osm.suma'),
      },
      {
        name: 'noop',
        mapPath: joinPath(baseFixtures, 'pub-hours', 'pub-hours.noop.suma'),
      },
    ],
  };

  it('detects a valid playground', async () => {
    await expect(detectPlayground(fixedPlayground.path)).resolves.toEqual([
      fixedPlayground,
    ]);
  });

  it('rejects an invalid playground', async () => {
    await expect(detectPlayground(invalidPlayground.path)).rejects.toThrowError(
      '/package.json" found'
    );
  });
});
