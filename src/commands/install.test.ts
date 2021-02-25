import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import { EXTENSIONS, GRID_DIR, SUPER_PATH } from '../common/document';
import { fetchProfile } from '../common/http';
import { exists, readFile, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import Install from './install';

describe('Install CLI command', () => {
  const oldCWD = process.cwd();
  const WORKING_DIR = joinPath('fixtures', 'install', 'playground');

  const STARWARS_SCOPE = 'starwars';
  const profileName = joinPath(STARWARS_SCOPE, 'character-information');

  const fixture = {
    superJson: SUPER_PATH,
    profile: joinPath(GRID_DIR, `${profileName}${EXTENSIONS.profile.source}`),
    scope: joinPath(GRID_DIR, STARWARS_SCOPE),
  };

  // reset super.json to initial state
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      fixture.superJson,
      JSON.stringify(
        {
          profiles: {
            [profileName]: {
              file: `grid/${profileName}${EXTENSIONS.profile.source}`,
              providers: {},
            },
          },
          providers: {},
        },
        undefined,
        2
      )
    );
  }

  beforeAll(async () => {
    // change cwd to fixtures/install/playground/
    process.chdir(WORKING_DIR);

    await resetSuperJson();

    await rimraf(fixture.profile);
    await rimraf(fixture.scope);
  });

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(async () => {
    await resetSuperJson();

    stderr.stop();
    stdout.stop();
  });

  afterAll(async () => {
    await rimraf(fixture.profile);
    await rimraf(fixture.scope);

    // change cwd back
    process.chdir(oldCWD);
  });

  describe('when no providers are specified', () => {
    it('installs profiles in super.json', async () => {
      const expectedProfilesCount = 1;
      const profileId = `${profileName}@1`;

      {
        await expect(Install.run([profileId])).resolves.toBeUndefined();
        const loadedResult = await SuperJson.load();
        const { document } = loadedResult.match(
          v => v,
          err => {
            console.error(err);

            return new SuperJson();
          }
        );

        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = await fetchProfile(profileId);

        expect(local).toEqual(registry);

        expect(document.profiles?.[profileName]).toEqual({
          file: `grid/${profileName}${EXTENSIONS.profile.source}`,
          providers: {},
        });

        expect(Object.values(document.profiles ?? {}).length).toEqual(
          expectedProfilesCount
        );
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

        const loadedResult = await SuperJson.load();
        const { document } = loadedResult.match(
          v => v,
          err => {
            console.error(err);

            return new SuperJson({});
          }
        );

        const local = await readFile(fixture.profile, { encoding: 'utf-8' });
        const registry = (await fetchProfile(profileId)).toString();

        expect(local).toEqual(registry);

        expect(document.profiles?.[profileName]).toEqual({
          file: `grid/${profileName}${EXTENSIONS.profile.source}`,
          providers: {
            twillio: {},
            osm: {},
            tyntec: {},
          },
        });
      }
    });
  });
});
