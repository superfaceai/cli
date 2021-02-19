import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import {
  EXTENSIONS,
  GRID_DIR,
  SUPER_PATH,
  writeSuperJson,
} from '../common/document';
import { fetchProfile } from '../common/http';
import { exists, readFile, rimraf } from '../common/io';
import Install from './install';

describe('Install CLI command', () => {
  const WORKING_DIR = joinPath('fixtures', 'install', 'playground');

  const STARWARS_SCOPE = 'starwars';
  const profileName = joinPath(STARWARS_SCOPE, 'character-information');

  const fixture = {
    superJson: SUPER_PATH,
    profile: joinPath(GRID_DIR, `${profileName}${EXTENSIONS.profile.source}`),
    scope: joinPath(GRID_DIR, STARWARS_SCOPE),
  };

  // restart super.json to initial state
  async function restartSuperJson() {
    await writeSuperJson(
      fixture.superJson,
      {
        profiles: {
          [profileName]: {
            file: `grid/${profileName}${EXTENSIONS.profile.source}`,
            providers: {},
          },
        },
        providers: {},
      },
      { force: true }
    );
  }

  beforeAll(async () => {
    // change cwd to /fixtures/install/playground/
    process.chdir(WORKING_DIR);

    await restartSuperJson();

    await rimraf(fixture.profile);
    await rimraf(fixture.scope);
  });

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(async () => {
    await restartSuperJson();

    stderr.stop();
    stdout.stop();
  });

  afterAll(async () => {
    await rimraf(fixture.profile);
    await rimraf(fixture.scope);

    // change cwd back
    process.chdir('../../../');
  });

  describe('when no providers are specified', () => {
    afterEach(async () => {
      await rimraf(fixture.scope);
    });

    it('installs profiles in super.json', async () => {
      const expectedProfilesCount = 1;
      const profileId = `${profileName}@1`;

      {
        await expect(Install.run([profileId])).resolves.toBeUndefined();
        const { profiles } = new SuperJson(
          (await SuperJson.loadSuperJson()).match(
            v => v,
            err => {
              console.error(err);

              return {};
            }
          )
        ).normalized;
        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);

        expect(profiles[profileName]).toEqual({
          file: `grid/${profileName}${EXTENSIONS.profile.source}`,
          providers: {},
          defaults: {},
        });

        expect(Object.values(profiles).length).toEqual(expectedProfilesCount);
      }

      {
        await expect(Install.run([])).resolves.toBeUndefined();
        expect(await exists(fixture.profile)).toBe(true);

        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);
      }
    }, 10000);
  });

  describe('when providers are specified', () => {
    it('installs specified profile with default provider configuration into super.json', async () => {
      {
        const profileId = `${profileName}@1.0.1`;
        await expect(
          Install.run([profileId, '-p', 'twillio', 'osm', 'tyntec', '-f'])
        ).resolves.toBeUndefined();

        const { profiles } = new SuperJson(
          (await SuperJson.loadSuperJson()).match(
            v => v,
            err => {
              console.error(err);

              return {};
            }
          )
        ).normalized;
        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);

        expect(profiles[profileName]).toEqual({
          file: `grid/${profileName}${EXTENSIONS.profile.source}`,
          defaults: {},
          providers: {
            twillio: {
              mapVariant: 'default',
              mapRevision: '1',
              defaults: {},
            },
            osm: {
              mapVariant: 'default',
              mapRevision: '1',
              defaults: {},
            },
            tyntec: {
              mapVariant: 'default',
              mapRevision: '1',
              defaults: {},
            },
          },
        });
      }
    });
  });
});
