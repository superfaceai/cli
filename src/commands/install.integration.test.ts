import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  ok,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import { parseProfile, Source } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS } from '../common';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  fetchProviderInfo,
} from '../common/http';
import { readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { generateTypesFile, generateTypingsForProfile } from '../logic';
import { detectSuperJson } from '../logic/install';
import { MockStd, mockStd } from '../test/mock-std';
import Install from './install';

//Mock http
jest.mock('../common/http');

//Mock io
jest.mock('../common/io');

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

  const profileId = `${PROFILE.scope}/${PROFILE.name}`;
  const profileIdRequest = `${profileId}@${PROFILE.version}`;

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
    it('installs the newest profile', async () => {
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

      expect(writeOnceSpy).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.source}`
        ),
        mockSuprFile,
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.build}`
        ),
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      //Types
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('types/starwars/character-information.ts'),
        generateTypingsForProfile(mockProfileDocument),
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('sdk.ts'),
        generateTypesFile([profileId]),
        { dirs: true }
      );
      //SuperJson
      expect(writeOnceSpy).toHaveBeenCalledWith(
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
      );
    }, 10000);

    it('installs the specified profile version with default provider configuration', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {},
        providers: {},
      });
      const mockSuperJsonWithTwilio = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {
              twilio: {},
            },
          },
        },
        providers: {},
      });

      const mockSuperJsonWithTyntec = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {
              twilio: {},
              tyntec: {},
            },
          },
        },
        providers: {
          twilio: {
            security: [],
          },
        },
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

      const mockTyntec: ProviderJson = {
        name: 'tyntec',
        services: [
          {
            id: 'tyntec',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'api',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
        ],
        defaultService: 'swapidev',
      };
      const mockTwilio = {
        name: 'twilio',
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [],
        defaultService: 'swapidev',
      };

      mocked(fetchProviderInfo)
        .mockResolvedValueOnce(mockTwilio)
        .mockResolvedValueOnce(mockTyntec);

      //We need to mock static side of SuperJson
      const loadSpy = jest
        .fn()
        .mockReturnValueOnce(ok(mockSuperJson))
        .mockResolvedValueOnce(ok(mockSuperJsonWithTwilio))
        .mockResolvedValueOnce(ok(mockSuperJsonWithTyntec));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        Install.run([profileIdRequest, '-p', 'twilio', 'tyntec'])
      ).resolves.toBeUndefined();

      expect(writeOnceSpy).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.source}`
        ),
        mockSuprFile,
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${profileId}@${mockProfileInfo.profile_version}${EXTENSIONS.profile.build}`
        ),
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      //Types
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('types/starwars/character-information.ts'),
        generateTypingsForProfile(mockProfileDocument),
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('sdk.ts'),
        generateTypesFile([profileId]),
        { dirs: true }
      );
      //SuperJson with profiles
      expect(writeOnceSpy).toHaveBeenCalledWith(
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
      );
      //SuperJson with twilio
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: {
                  twilio: {},
                },
              },
            },
            providers: {
              twilio: {
                security: [],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
      // SuperJson with twilio and tyntec
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: {
                  twilio: {},
                  tyntec: {},
                },
              },
            },
            providers: {
              twilio: {
                security: [],
              },
              tyntec: {
                security: [
                  {
                    id: 'api',
                    apikey: '$TYNTEC_API_KEY',
                  },
                ],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);

    it('installs local profile', async () => {
      const profileIdRequest = 'character-information.supr';
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

      mocked(readFile).mockResolvedValue(mockSuprFile);

      const mockProfileDocument = parseProfile(new Source(mockSuprFile));

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValueOnce(ok(mockSuperJson));

      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        Install.run(['--local', profileIdRequest])
      ).resolves.toBeUndefined();

      expect(writeOnceSpy).toHaveBeenCalled();

      //Types
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('types/starwars/character-information.ts'),
        generateTypingsForProfile(mockProfileDocument),
        { dirs: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringContaining('sdk.ts'),
        generateTypesFile([profileId]),
        { dirs: true }
      );

      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                file: profileIdRequest,
              },
            },
            providers: {},
          },
          undefined,
          2
        )
      );
    }, 10000);

    // it('error when installing non-existent local profile', async () => {
    //   const profileIdRequest = 'none.supr';

    //   await expect(
    //     Install.run(['--local', profileIdRequest])
    //   ).resolves.toBeUndefined();
    //   const superJson = (await SuperJson.load()).unwrap();

    //   expect(superJson.document.profiles).toStrictEqual({});

    //   // expect(stdout.output).toContain('❌ No profiles have been installed');
    // });

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
