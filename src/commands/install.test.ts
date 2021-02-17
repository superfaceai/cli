import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import {
  META_FILE,
  parseSuperJson,
  SUPERFACE_DIR,
  writeSuperJson,
} from '../common/document';
import { fetchProfile } from '../common/http';
import { exists, readFile, rimraf } from '../common/io';
import Install from './install';

describe('Install CLI command', () => {
  const WORKING_DIR = joinPath(
    'fixtures',
    'install',
    'playground',
    SUPERFACE_DIR
  );

  const STARWARS_SCOPE = 'starwars';
  const profileName = joinPath(STARWARS_SCOPE, 'character-information');

  const fixture = {
    superJson: META_FILE,
    profile: joinPath('grid', profileName),
    scope: joinPath('grid', STARWARS_SCOPE),
  };

  // restart super.json to initial state
  async function restartSuperJson() {
    await writeSuperJson(
      fixture.superJson,
      {
        profiles: {
          [profileName]: {
            file: `file:${fixture.profile}`,
            version: '1.0.0',
          },
        },
        providers: {},
      },
      { force: true }
    );
  }

  beforeAll(async () => {
    // change cwd to /fixtures/install
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
    process.chdir('../../../../');
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

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);

        expect(profiles[profileName]).toEqual({
          file: `file:${fixture.profile}`,
          version: '1.0.1',
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

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);

        expect(profiles[profileName]).toEqual({
          file: `file:${fixture.profile}`,
          version: '1.0.1',
          providers: {
            twillio: {
              mapVariant: 'default',
              mapRevision: '1',
            },
            osm: {
              mapVariant: 'default',
              mapRevision: '1',
            },
            tyntec: {
              mapVariant: 'default',
              mapRevision: '1',
            },
          },
        });
      }
    });
  });
});
