import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import { EXTENSIONS, GRID_DIR, SUPER_PATH } from '../common/document';
import { fetchProfile } from '../common/http';
import { readFile, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import Install from './install';

describe('Install CLI command', () => {
  const WORKING_DIR = joinPath('fixtures', 'install', 'playground');

  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.1',
  };

  const FIXTURE = {
    superJson: SUPER_PATH,
    scope: joinPath(GRID_DIR, PROFILE.scope),
    profile: joinPath(
      GRID_DIR,
      PROFILE.scope,
      PROFILE.name + '@' + PROFILE.version + EXTENSIONS.profile.source
    ),
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: SuperJson;
  const INITIAL_LOCAL_PROFILE: { data: string; path: string } = {
    data: '',
    path: '',
  };
  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);

    INITIAL_SUPER_JSON = (await SuperJson.load(FIXTURE.superJson)).unwrap();

    INITIAL_LOCAL_PROFILE.path = INITIAL_SUPER_JSON.resolvePath(
      (INITIAL_SUPER_JSON.normalized.profiles[
        `${PROFILE.scope}/${PROFILE.name}`
      ] as { file: string }).file
    );
    INITIAL_LOCAL_PROFILE.data = await readFile(
      INITIAL_LOCAL_PROFILE.path,
      'utf-8'
    );

    await rimraf(FIXTURE.scope);
  });

  afterAll(async () => {
    await resetSuperJson();
    await resetLocalProfile();
    await rimraf(FIXTURE.scope);

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      JSON.stringify(INITIAL_SUPER_JSON.document, undefined, 2)
    );
  }

  async function resetLocalProfile() {
    await OutputStream.writeOnce(
      INITIAL_LOCAL_PROFILE.path,
      INITIAL_LOCAL_PROFILE.data
    );
    await rimraf(INITIAL_LOCAL_PROFILE.path + '.ast.json');
  }

  beforeEach(async () => {
    await resetSuperJson();
    await resetLocalProfile();
    await rimraf(FIXTURE.scope);

    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();
  });

  describe('when installing new profile', () => {
    async function cleanSuperJson() {
      await OutputStream.writeOnce(
        FIXTURE.superJson,
        JSON.stringify(
          {
            profiles: {},
          },
          undefined,
          2
        )
      );
    }

    it('installs the newest profile', async () => {
      await cleanSuperJson();

      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(Install.run([profileId])).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      const local = await readFile(FIXTURE.profile, { encoding: 'utf-8' });
      const registry = await fetchProfile(profileId);
      expect(local).toEqual(registry);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: {},
      });
    }, 10000);

    it('installs the specified profile version with default provider configuration', async () => {
      await cleanSuperJson();

      const profileId = `${PROFILE.scope}/${PROFILE.name}`;
      const profileIdRequest = `${profileId}@${PROFILE.version}`;

      await expect(
        Install.run([profileIdRequest, '-p', 'twillio', 'osm', 'tyntec'])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      const local = await readFile(FIXTURE.profile, { encoding: 'utf-8' });
      const registry = await fetchProfile(profileIdRequest);
      expect(local).toEqual(registry);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: {
          twillio: {},
          osm: {},
          tyntec: {},
        },
      });
    }, 10000);
  });

  describe('when local files are present', () => {
    it('errors without a force flag', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(Install.run([profileId])).resolves.toBeUndefined();

      const superJson = (await SuperJson.load()).unwrap();
      const localFile = superJson.resolvePath(
        (superJson.normalized.profiles[profileId] as { file: string }).file
      );
      const expectedFile = superJson.resolvePath(
        (INITIAL_SUPER_JSON.normalized.profiles[profileId] as { file: string })
          .file
      );
      expect(localFile).toBe(expectedFile);
      expect(stdout.output).toContain(`File already exists: "${localFile}"`);
    }, 10000);

    it('preserves file field in super.json', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(Install.run([profileId, '-f'])).resolves.toBeUndefined();

      const superJson = (await SuperJson.load()).unwrap();
      const localFile = superJson.resolvePath(
        (superJson.normalized.profiles[profileId] as { file: string }).file
      );
      const expectedFile = superJson.resolvePath(
        (INITIAL_SUPER_JSON.normalized.profiles[profileId] as { file: string })
          .file
      );
      expect(localFile).toBe(expectedFile);

      const local = await readFile(localFile, { encoding: 'utf-8' });
      const registry = await fetchProfile(profileId);
      expect(local).toEqual(registry);
    }, 10000);
  });
});
