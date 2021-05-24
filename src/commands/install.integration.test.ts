import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS, GRID_DIR, SUPER_PATH } from '../common/document';
import { fetchProfile } from '../common/http';
import { exists, readFile, rimraf, rmdir } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { transpileFiles } from '../logic/generate';
import { MockStd, mockStd } from '../test/mock-std';
import Install from './install';

jest.mock('../logic/generate');

describe('Install CLI command', () => {
  const WORKING_DIR = joinPath('fixtures', 'install', 'playground');
  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.2',
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

  let stderr: MockStd;
  let stdout: MockStd;
  let originalSfUrl: string | undefined;

  beforeAll(async () => {
    originalSfUrl = process.env.SUPERFACE_API_URL;
    //Point to dev api
    process.env.SUPERFACE_API_URL = 'https://superface.dev/';

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
    // change url back
    process.env.SUPERFACE_API_URL = originalSfUrl;
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

    stdout = mockStd();
    stderr = mockStd();

    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
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

    beforeEach(async () => {
      await cleanSuperJson();
    });

    it('installs the newest profile', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(Install.run([profileId])).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      const local = await readFile(FIXTURE.profile, { encoding: 'utf-8' });
      const registry = await fetchProfile(profileId);
      expect(local).toEqual(registry);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
      });
    }, 10000);

    it('installs the specified profile version with default provider configuration', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;
      const profileIdRequest = `${profileId}@${PROFILE.version}`;

      await expect(
        Install.run([profileIdRequest, '-p', 'twilio', 'tyntec'])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      const local = await readFile(FIXTURE.profile, { encoding: 'utf-8' });
      const registry = await fetchProfile(profileIdRequest);
      expect(local).toEqual(registry);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: {
          twilio: {},
          tyntec: {},
        },
      });
    }, 10000);

    it('installs local profile', async () => {
      const profileId = 'starwars/character-information';
      const profileIdRequest = 'character-information.supr';

      await expect(
        Install.run(['--local', profileIdRequest])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      expect(superJson.document.profiles![profileId]).toEqual({
        file: `../${profileIdRequest}`,
      });

      expect(transpileFiles).toHaveBeenCalled();
    }, 10000);

    it('error when installing non-existent local profile', async () => {
      const profileIdRequest = 'none.supr';

      await expect(
        Install.run(['--local', profileIdRequest])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load()).unwrap();

      expect(superJson.document.profiles).toStrictEqual({});

      // expect(stdout.output).toContain('❌ No profiles have been installed');
    });

    it.skip('generates typings correctly', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      const superJson = (await SuperJson.load()).unwrap();

      const paths = [
        superJson.resolvePath(
          joinPath('types', PROFILE.scope, PROFILE.name + '.js')
        ),
        superJson.resolvePath(
          joinPath('types', PROFILE.scope, PROFILE.name + '.d.ts')
        ),
        superJson.resolvePath(joinPath('sdk.js')),
        superJson.resolvePath(joinPath('sdk.d.ts')),
      ];
      expect(await exists(paths[0])).toBe(false);
      expect(await exists(paths[1])).toBe(false);
      expect(await exists(paths[2])).toBe(false);
      expect(await exists(paths[3])).toBe(false);

      await expect(Install.run([profileId])).resolves.toBeUndefined();

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);

      for (const path of paths) {
        await rimraf(path);
      }

      try {
        const path = superJson.resolvePath('types');
        await rmdir(path);
        // eslint-disable-next-line no-empty
      } catch { }
    }, 10000);

    it.skip('adds new typings to previously generated', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;
      const anotherProfileId = 'starwars/spaceship-information';
      const profileIdRequest = 'spaceship-information.supr';

      const superJson = (await SuperJson.load()).unwrap();

      const paths = [
        superJson.resolvePath(
          joinPath('types', PROFILE.scope, PROFILE.name + '.js')
        ),
        superJson.resolvePath(
          joinPath('types', PROFILE.scope, PROFILE.name + '.d.ts')
        ),
        superJson.resolvePath(joinPath('sdk.js')),
        superJson.resolvePath(joinPath('sdk.d.ts')),
        superJson.resolvePath(joinPath('types', anotherProfileId + '.js')),
        superJson.resolvePath(joinPath('types', anotherProfileId + '.d.ts')),
      ];
      expect(await exists(paths[0])).toBe(false);
      expect(await exists(paths[1])).toBe(false);
      expect(await exists(paths[2])).toBe(false);
      expect(await exists(paths[3])).toBe(false);
      expect(await exists(paths[4])).toBe(false);
      expect(await exists(paths[5])).toBe(false);

      await expect(Install.run([profileId])).resolves.toBeUndefined();

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);
      expect(await exists(paths[4])).toBe(false);
      expect(await exists(paths[5])).toBe(false);

      await expect(
        Install.run(['--local', profileIdRequest])
      ).resolves.toBeUndefined();

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);
      expect(await exists(paths[4])).toBe(true);
      expect(await exists(paths[5])).toBe(true);

      const sdk = (await readFile(paths[2])).toString();

      expect(sdk).toMatch(/starwarsCharacterInformation/);
      expect(sdk).toMatch(/starwarsSpaceshipInformation/);

      for (const path of paths) {
        await rimraf(path);
      }

      try {
        let path = superJson.resolvePath(joinPath('types', PROFILE.scope));
        await rmdir(path);
        path = superJson.resolvePath('types');
        // eslint-disable-next-line no-empty
      } catch { }
    }, 50000);
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
      // expect(stdout.output).toContain(`File already exists: "${localFile}"`);
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
