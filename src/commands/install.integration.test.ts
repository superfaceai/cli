import { ProfileDocumentNode } from '@superfaceai/ast';
import { ok, SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS } from '../common';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
} from '../common/http';
import { OutputStream } from '../common/output-stream';
import { generateTypesFile, generateTypingsForProfile } from '../logic';
import { detectSuperJson } from '../logic/install';
import { MockStd, mockStd } from '../test/mock-std';
import Install from './install';

//Mock only fetchProviderInfo response
jest.mock('../common/http');

//Mock install logic
jest.mock('../logic/install', () => ({
  ...jest.requireActual<Record<string, unknown>>('../logic/install'),
  detectSuperJson: jest.fn(),
}));

describe('Install CLI command', () => {
  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.0',
  };

  let stderr: MockStd;
  let stdout: MockStd;

  beforeEach(async () => {
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
    // async function cleanSuperJson() {
    //   await OutputStream.writeOnce(
    //     FIXTURE.superJson,
    //     JSON.stringify(
    //       {
    //         profiles: {},
    //       },
    //       undefined,
    //       2
    //     )
    //   );
    // }

    // beforeEach(async () => {
    //   await cleanSuperJson();
    // });

    it('installs the newest profile', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {},
        providers: {},
      });

      const mockSuprFile = `name = "starwars/character-information"
      version = "1.0.0"
      
      "Starwars"
      usecase RetrieveCharacterInformation safe {
        input {
          characterName
        }
      
        result {
          height
          weight
          yearOfBirth
        }
      
        error {
          message
        }
      }`;
      mocked(fetchProfile).mockResolvedValue(mockSuprFile);

      const mockProfileInfo = {
        owner: 'test',
        owner_url: 'test',
        profile_id: 'test',
        profile_name: 'test',
        profile_version: '1.0.0',
        published_at: new Date().toString(),
        published_by: 'test',
        url: 'test',
      };

      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      const mockProfileDocument: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          name: 'test-profile',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        definitions: [],
      };
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(Install.run([profileId])).resolves.toBeUndefined();

      expect(writeOnceSpy).toHaveBeenCalledTimes(5);
      expect(writeOnceSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.source}`
        ),
        mockSuprFile,
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.build}`
        ),
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      //Types
      expect(writeOnceSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('types/starwars/character-information.ts'),
        generateTypingsForProfile(mockProfileDocument),
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('sdk.ts'),
        generateTypesFile([profileId]),
        { dirs: true }
      );
      //SuperJson
      expect(writeOnceSpy).toHaveBeenNthCalledWith(
        5,
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
              },
            },
            providers: {},
          },
          undefined,
          2
        )
      ),
        { dirs: true };
    }, 10000);

    // it('installs the specified profile version with default provider configuration', async () => {
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;
    //   const profileIdRequest = `${profileId}@${PROFILE.version}`;

    //   await expect(
    //     Install.run([profileIdRequest, '-p', 'twilio', 'tyntec'])
    //   ).resolves.toBeUndefined();
    //   const superJson = (await SuperJson.load()).unwrap();

    //   const local = await readFile(FIXTURE.profile, { encoding: 'utf-8' });
    //   const registry = await fetchProfile(profileIdRequest);
    //   expect(local).toEqual(registry);

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     version: PROFILE.version,
    //     providers: {
    //       twilio: {},
    //       tyntec: {},
    //     },
    //   });
    // }, 10000);

    // it('installs local profile', async () => {
    //   const profileId = 'starwars/character-information';
    //   const profileIdRequest = 'character-information.supr';

    //   await expect(
    //     Install.run(['--local', profileIdRequest])
    //   ).resolves.toBeUndefined();
    //   const superJson = (await SuperJson.load()).unwrap();

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     file: `../${profileIdRequest}`,
    //   });

    //   expect(transpileFiles).toHaveBeenCalled();
    // }, 10000);

    // it('error when installing non-existent local profile', async () => {
    //   const profileIdRequest = 'none.supr';

    //   await expect(
    //     Install.run(['--local', profileIdRequest])
    //   ).resolves.toBeUndefined();
    //   const superJson = (await SuperJson.load()).unwrap();

    //   expect(superJson.document.profiles).toStrictEqual({});

    //   // expect(stdout.output).toContain('❌ No profiles have been installed');
    // });

    // it.skip('generates typings correctly', async () => {
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;
    //   //Mock path do super.json
    //   const mockPath = 'some/path/';
    //   mocked(detectSuperJson).mockResolvedValue(mockPath);

    //   //Mock super.json
    //   const mockSuperJson = new SuperJson({
    //     profiles: {},
    //     providers: {},
    //   });

    //   const mockSuprFile = `name = "starwars/character-information"
    //     version = "1.0.0"

    //     "Starwars"
    //     usecase RetrieveCharacterInformation safe {
    //       input {
    //         characterName
    //       }

    //       result {
    //         height
    //         weight
    //         yearOfBirth
    //       }

    //       error {
    //         message
    //       }
    //     }`
    //   mocked(fetchProfile).mockResolvedValue(mockSuprFile)

    //   const mockProfileInfo = {
    //     owner: 'test',
    //     owner_url: 'test',
    //     profile_id: 'test',
    //     profile_name: 'test',
    //     profile_version: '1.0.0',
    //     published_at: new Date().toString(),
    //     published_by: 'test',
    //     url: 'test'
    //   }

    //   mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo)
    //   const mockProfileDocument: ProfileDocumentNode = {
    //     kind: 'ProfileDocument',
    //     header: {
    //       kind: 'ProfileHeader',
    //       name: 'test-profile',
    //       version: {
    //         major: 1,
    //         minor: 0,
    //         patch: 0,
    //       },
    //     },
    //     definitions: [],
    //   };
    //   mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument)

    //   //We need to mock static side of SuperJson
    //   const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
    //   SuperJson.load = loadSpy;

    //   const writeOnceSpy = jest
    //     .spyOn(OutputStream, 'writeOnce')
    //     .mockResolvedValue(undefined);

    //   await expect(Install.run([profileId])).resolves.toBeUndefined();

    //   expect(writeOnceSpy).toHaveBeenCalledTimes(3);

    //   // expect(await exists(paths[0])).toBe(true);
    //   // expect(await exists(paths[1])).toBe(true);
    //   // expect(await exists(paths[2])).toBe(true);
    //   // expect(await exists(paths[3])).toBe(true);

    //   // for (const path of paths) {
    //   //   await rimraf(path);
    //   // }

    //   // try {
    //   //   const path = superJson.resolvePath('types');
    //   //   await rmdir(path);
    //   //   // eslint-disable-next-line no-empty
    //   // } catch { }
    // }, 10000);

    // it.skip('adds new typings to previously generated', async () => {
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;
    //   const anotherProfileId = 'starwars/spaceship-information';
    //   const profileIdRequest = 'spaceship-information.supr';

    //   const superJson = (await SuperJson.load()).unwrap();

    //   const paths = [
    //     superJson.resolvePath(
    //       joinPath('types', PROFILE.scope, PROFILE.name + '.js')
    //     ),
    //     superJson.resolvePath(
    //       joinPath('types', PROFILE.scope, PROFILE.name + '.d.ts')
    //     ),
    //     superJson.resolvePath(joinPath('sdk.js')),
    //     superJson.resolvePath(joinPath('sdk.d.ts')),
    //     superJson.resolvePath(joinPath('types', anotherProfileId + '.js')),
    //     superJson.resolvePath(joinPath('types', anotherProfileId + '.d.ts')),
    //   ];
    //   expect(await exists(paths[0])).toBe(false);
    //   expect(await exists(paths[1])).toBe(false);
    //   expect(await exists(paths[2])).toBe(false);
    //   expect(await exists(paths[3])).toBe(false);
    //   expect(await exists(paths[4])).toBe(false);
    //   expect(await exists(paths[5])).toBe(false);

    //   await expect(Install.run([profileId])).resolves.toBeUndefined();

    //   expect(await exists(paths[0])).toBe(true);
    //   expect(await exists(paths[1])).toBe(true);
    //   expect(await exists(paths[2])).toBe(true);
    //   expect(await exists(paths[3])).toBe(true);
    //   expect(await exists(paths[4])).toBe(false);
    //   expect(await exists(paths[5])).toBe(false);

    //   await expect(
    //     Install.run(['--local', profileIdRequest])
    //   ).resolves.toBeUndefined();

    //   expect(await exists(paths[0])).toBe(true);
    //   expect(await exists(paths[1])).toBe(true);
    //   expect(await exists(paths[2])).toBe(true);
    //   expect(await exists(paths[3])).toBe(true);
    //   expect(await exists(paths[4])).toBe(true);
    //   expect(await exists(paths[5])).toBe(true);

    //   const sdk = (await readFile(paths[2])).toString();

    //   expect(sdk).toMatch(/starwarsCharacterInformation/);
    //   expect(sdk).toMatch(/starwarsSpaceshipInformation/);

    //   for (const path of paths) {
    //     await rimraf(path);
    //   }

    //   try {
    //     let path = superJson.resolvePath(joinPath('types', PROFILE.scope));
    //     await rmdir(path);
    //     path = superJson.resolvePath('types');
    //     // eslint-disable-next-line no-empty
    //   } catch {}
    // }, 50000);
  });

  // describe('when local files are present', () => {
  //   it('errors without a force flag', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     await expect(Install.run([profileId])).resolves.toBeUndefined();

  //     const superJson = (await SuperJson.load()).unwrap();
  //     const localFile = superJson.resolvePath(
  //       (superJson.normalized.profiles[profileId] as { file: string }).file
  //     );
  //     const expectedFile = superJson.resolvePath(
  //       (INITIAL_SUPER_JSON.normalized.profiles[profileId] as { file: string })
  //         .file
  //     );
  //     expect(localFile).toBe(expectedFile);
  //     // expect(stdout.output).toContain(`File already exists: "${localFile}"`);
  //   }, 10000);

  //   it('preserves file field in super.json', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     await expect(Install.run([profileId, '-f'])).resolves.toBeUndefined();

  //     const superJson = (await SuperJson.load()).unwrap();
  //     const localFile = superJson.resolvePath(
  //       (superJson.normalized.profiles[profileId] as { file: string }).file
  //     );
  //     const expectedFile = superJson.resolvePath(
  //       (INITIAL_SUPER_JSON.normalized.profiles[profileId] as { file: string })
  //         .file
  //     );
  //     expect(localFile).toBe(expectedFile);

  //     const local = await readFile(localFile, { encoding: 'utf-8' });
  //     const registry = await fetchProfile(profileId);
  //     expect(local).toEqual(registry);
  //   }, 10000);
  // });
});
