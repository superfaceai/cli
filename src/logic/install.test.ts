import { CLIError } from '@oclif/errors';
import { AstMetadata, EXTENSIONS, ProfileDocumentNode } from '@superfaceai/ast';
import {
  err,
  mergeProfile,
  NodeFileSystem,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import { parseProfile, Source } from '@superfaceai/parser';
import { join as joinPath, resolve as resolvePath } from 'path';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
} from '../common/http';
import { exists, mkdirQuiet, readFile, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import {
  detectSuperJson,
  getExistingProfileIds,
  getProfileFromStore,
  installProfiles,
  resolveInstallationRequests,
} from './install';

jest.mock('../common/http', () => ({
  fetchProfileInfo: jest.fn(),
  fetchProfile: jest.fn(),
  fetchProfileAST: jest.fn(),
}));

jest.mock('../common/io', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/io'),
  exists: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual('@superfaceai/parser'),
  parseProfile: jest.fn(),
}));

describe('Install CLI logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  beforeEach(async () => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const astMetadata: AstMetadata = {
    sourceChecksum: 'check',
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
  };

  describe('when detecting super json', () => {
    let INITIAL_CWD: string;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalWriteOnce = OutputStream.writeOnce;

    beforeAll(async () => {
      INITIAL_CWD = process.cwd();
      //Mock static side of OutputStream
      const mockWrite = jest.fn();
      OutputStream.writeOnce = mockWrite;

      //create mock nested paths
      let path = joinPath(
        'fixtures',
        'install',
        'playground',
        'superface',
        'nested1'
      );
      await mkdirQuiet(path);
      path = joinPath(
        'fixtures',
        'install',
        'playground',
        'superface',
        'nested1',
        'nested2'
      );
      await mkdirQuiet(path);
    });

    afterAll(async () => {
      OutputStream.writeOnce = originalWriteOnce;
      process.chdir(INITIAL_CWD);
      await rimraf(
        joinPath('fixtures', 'install', 'playground', 'superface', 'nested1')
      );
    });

    afterEach(() => {
      process.chdir(INITIAL_CWD);
      jest.resetAllMocks();
    });

    it('detects super.json in cwd', async () => {
      process.chdir(joinPath('fixtures', 'install', 'playground', 'superface'));
      expect(await detectSuperJson(process.cwd())).toEqual('.');
    }, 10000);

    it('detects super.json from 1 level above', async () => {
      process.chdir(joinPath('fixtures', 'install', 'playground'));
      expect(await detectSuperJson(process.cwd())).toEqual('superface');
    }, 10000);

    it('does not detect super.json from 2 levels above', async () => {
      process.chdir(joinPath('fixtures', 'install'));
      expect(await detectSuperJson(process.cwd())).toBeUndefined();
    }, 10000);

    it('detects super.json from 1 level below', async () => {
      process.chdir(
        joinPath('fixtures', 'install', 'playground', 'superface', 'nested1')
      );
      expect(await detectSuperJson(process.cwd(), 1)).toEqual('..');
    }, 10000);

    it('detects super.json from 2 levels below', async () => {
      process.chdir(
        joinPath(
          'fixtures',
          'install',
          'playground',
          'superface',
          'nested1',
          'nested2'
        )
      );
      expect(await detectSuperJson(process.cwd(), 2)).toEqual('../..');
    }, 10000);

    it('does not detect super.json from 2 levels below without level', async () => {
      process.chdir(
        joinPath(
          'fixtures',
          'install',
          'playground',
          'superface',
          'nested1',
          'nested2'
        )
      );
      expect(await detectSuperJson(process.cwd())).toBeUndefined();
    }, 10000);
  });

  describe('when geting profile from store', () => {
    const mockProfileInfo = {
      profile_id: 'starwars/character-information@1.0.1',
      profile_name: 'starwars/character-information',
      profile_version: '1.0.1',
      url: 'https://superface.dev/starwars/character-information@1.0.1',
      owner: 'freaz',
      owner_url: '',
      published_at: new Date(),
      published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
    };

    const mockProfileAst: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      astMetadata,
      header: {
        kind: 'ProfileHeader',
        scope: 'starwars',
        name: 'character-information',
        version: { major: 1, minor: 0, patch: 1 },
        location: {
          start: { line: 1, column: 1, charIndex: 0 },
          end: { line: 1, column: 1, charIndex: 0 },
        },
      },
      definitions: [
        {
          kind: 'UseCaseDefinition',
          useCaseName: 'RetrieveCharacterInformation',
          safety: 'safe',
          documentation: {
            title: 'Starwars',
          },
        },
      ],
      location: {
        start: { line: 1, column: 1, charIndex: 0 },
        end: { line: 1, column: 1, charIndex: 0 },
      },
    };

    it('gets profile', async () => {
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);

      const profileId = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );

      await expect(
        getProfileFromStore({ profileId }, { logger })
      ).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
      });
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: undefined,
      });
    }, 10000);

    it('returns undefined when AST validation failed', async () => {
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      mocked(fetchProfileAST).mockRejectedValue(new Error('validation error'));

      const profileId = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );

      await expect(
        getProfileFromStore({ profileId }, { logger })
      ).resolves.toBeUndefined();
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: undefined,
      });
    }, 10000);

    it('gets profile with auth', async () => {
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);

      const profileId = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );

      await expect(
        getProfileFromStore(
          {
            profileId,
            options: {
              tryToAuthenticate: true,
            },
          },
          { logger }
        )
      ).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
      });
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: true,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: true,
      });
      10000;
    });

    it('throws user error on invalid profileId', async () => {
      mocked(fetchProfileInfo).mockRejectedValue(
        new CLIError('Not Found', { exit: 1 })
      );

      const profileId = ProfileId.fromScopeName(undefined, 'made-up');

      await expect(
        getProfileFromStore({ profileId }, { logger })
      ).resolves.toBeUndefined();
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, undefined, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfile).not.toHaveBeenCalled();
      expect(fetchProfileAST).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('when resolving installation requests', () => {
    const MOCK_PROFILE_RESPONSE = {
      profile_id: 'starwars/character-information@1.0.1',
      profile_name: 'starwars/character-information',
      profile_version: '1.0.1',
      url: 'https://superface.dev/starwars/character-information@1.0.1',
      owner: 'freaz',
      owner_url: '',
      published_at: new Date(),
      published_by: '',
    };

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('reads and checks local requests', async () => {
      const stubSuperJson = {
        profiles: {
          'se/cond': {
            file: 'second.supr',
          },
        },
      };
      mocked(readFile).mockResolvedValueOnce('.');

      //We are running static function inside of promise all - we can't be sure about order of calls
      mocked(parseProfile).mockImplementation((source: Source) => {
        if (source.fileName.includes('first')) {
          return {
            kind: 'ProfileDocument',
            astMetadata,
            header: {
              kind: 'ProfileHeader',
              name: 'first',
              version: { major: 1, minor: 1, patch: 0 },
            },
            definitions: [],
          };
        } else if (source.fileName.includes('second')) {
          return {
            kind: 'ProfileDocument',
            astMetadata,
            header: {
              kind: 'ProfileHeader',
              scope: 'se',
              name: 'cond',
              version: { major: 2, minor: 2, patch: 0 },
            },
            definitions: [],
          };
        } else {
          throw new Error('error');
        }
      });

      await expect(
        resolveInstallationRequests(
          {
            superJson: stubSuperJson,
            superJsonPath: '',
            requests: [
              { kind: 'local', path: 'first.supr' },
              { kind: 'local', path: 'none.supr' },
              { kind: 'local', path: 'second.supr' },
            ],
          },
          { logger }
        )
      ).resolves.toEqual(1);

      expect(stubSuperJson).toEqual({
        profiles: {
          first: {
            file: './first.supr',
          },
          'se/cond': {
            file: 'second.supr',
          },
        },
      });
    }, 10000);

    it('checks and fetched store requests', async () => {
      jest.spyOn(OutputStream, 'writeOnce').mockResolvedValue();

      const stubSuperJson = {
        profiles: {
          'se/cond': {
            file: 'second.supr',
          },
        },
      };

      const existsMock = mocked(exists).mockImplementation(async path => {
        if (path.includes('third')) {
          return true;
        } else {
          return false;
        }
      });
      const fetchProfileInfoMock = mocked(fetchProfileInfo).mockImplementation(
        profile => {
          if (profile.name === 'none') {
            return Promise.reject('none does not exist');
          } else {
            return Promise.resolve(MOCK_PROFILE_RESPONSE);
          }
        }
      );

      const fetchProfileASTMock = mocked(fetchProfileAST).mockResolvedValue({
        kind: 'ProfileDocument',
        astMetadata,
        header: {
          kind: 'ProfileHeader',
          name: 'mock profile',
          version: {
            major: 1,
            minor: 0,
            patch: 1,
          },
        },
        definitions: [],
      });

      await expect(
        resolveInstallationRequests(
          {
            superJson: stubSuperJson,
            superJsonPath: '',
            requests: [
              {
                kind: 'store',
                profileId: ProfileId.fromId('first', { userError }),
                version: '1.0.1',
              },
              {
                kind: 'store',
                profileId: ProfileId.fromId('none', { userError }),
                version: undefined,
              },
              {
                kind: 'store',
                profileId: ProfileId.fromId('se/cond', { userError }),
                version: '2.2.0',
              },
              {
                kind: 'store',
                profileId: ProfileId.fromId('third', { userError }),
                version: undefined,
              },
            ],
          },
          { logger }
        )
      ).resolves.toEqual(1);

      expect(existsMock).toHaveBeenCalled();

      expect(stubSuperJson).toEqual({
        profiles: {
          first: {
            version: '1.0.1',
          },
          'se/cond': {
            file: 'second.supr',
          },
        },
      });

      expect(fetchProfileInfoMock).toHaveBeenCalledTimes(3);
      expect(fetchProfileASTMock).toHaveBeenCalledTimes(2);

      expect(logger.stderr).toContainEqual([
        'profileInstalledFromPath',
        ['se/cond', 'second.supr'],
      ]);
      expect(logger.stderr).toContainEqual([
        'fetchProfileInfoFailed',
        ['none', 'none does not exist'],
      ]);
      expect(logger.stderr).toContainEqual([
        'fileAlreadyExists',
        [
          resolvePath(
            joinPath(
              'grid',
              `${ProfileId.fromId('third', { userError }).withVersion(
                '1.0.1'
              )}${EXTENSIONS.profile.source}`
            )
          ),
        ],
      ]);
    }, 10000);

    it('overrides everything with force flag', async () => {
      jest.spyOn(OutputStream, 'writeOnce').mockResolvedValue();

      const stubSuperJson = {
        profiles: {
          'local/first': {
            file: 'first.supr',
          },
          'local/second': {
            file: 'second.supr',
          },
          'local/third': {
            file: 'third.supr',
          },
          'remote/first': {
            version: '1.0.0',
          },
          'remote/second': {
            version: '1.0.1',
          },
          'remote/third': {
            version: '1.0.1',
          },
        },
      };

      mocked(exists).mockResolvedValue(true);
      mocked(fetchProfileInfo).mockResolvedValue(MOCK_PROFILE_RESPONSE);
      mocked(fetchProfile).mockResolvedValue('mock profile');
      mocked(fetchProfileAST).mockResolvedValue({
        kind: 'ProfileDocument',
        astMetadata,
        header: {
          kind: 'ProfileHeader',
          name: 'mock profile',
          version: {
            major: 1,
            minor: 0,
            patch: 1,
          },
        },
        definitions: [],
      });
      mocked(parseProfile).mockImplementation((source: Source) => {
        let scope;
        let name;
        let version;

        if (source.fileName === 'local-second.supr') {
          scope = 'local';
          name = 'second';
          version = { major: 1, minor: 1, patch: 0 };
        } else if (source.fileName === 'local-third.supr') {
          scope = 'local';
          name = 'third';
          version = { major: 1, minor: 1, patch: 0 };
        } else if (source.fileName === 'remote-third.supr') {
          scope = 'remote';
          name = 'third';
          version = { major: 1, minor: 1, patch: 0 };
        } else {
          name = '';
          version = { major: 0, minor: 0, patch: 0 };
        }

        return {
          kind: 'ProfileDocument',
          astMetadata,
          header: {
            kind: 'ProfileHeader',
            scope,
            name,
            version,
          },
          definitions: [],
        };
      });

      await expect(
        resolveInstallationRequests(
          {
            superJson: stubSuperJson,
            superJsonPath: '',
            requests: [
              {
                kind: 'store',
                profileId: ProfileId.fromId('local/first', { userError }),
                version: '1.0.1',
              },
              {
                kind: 'local',
                path: 'local-second.supr',
              },
              {
                kind: 'local',
                path: 'local-third.supr',
              },

              {
                kind: 'store',
                profileId: ProfileId.fromId('remote/first', { userError }),
                version: '1.0.1',
              },
              {
                kind: 'store',
                profileId: ProfileId.fromId('remote/second', { userError }),
                version: '1.0.1',
              },
              {
                kind: 'local',
                path: 'remote-third.supr',
              },
            ],
            options: { force: true },
          },
          { logger }
        )
      ).resolves.toEqual(6);

      expect(stubSuperJson).toEqual({
        profiles: {
          'local/first': {
            version: '1.0.1',
          },
          'local/second': {
            file: './local-second.supr',
          },
          'local/third': {
            file: './local-third.supr',
          },
          'remote/first': {
            version: '1.0.1',
          },
          'remote/second': {
            version: '1.0.1',
          },
          'remote/third': {
            file: './remote-third.supr',
          },
        },
      });
    });
  });

  describe('when geting profile id', () => {
    it('returns correct id and version', async () => {
      const profileId = 'starwars/character-information';
      const stubSuperJson = {};

      mergeProfile(
        stubSuperJson,
        profileId,
        { version: '1.0.1' },
        NodeFileSystem
      );
      await expect(
        getExistingProfileIds(stubSuperJson, '', { logger, userError })
      ).resolves.toEqual([
        {
          profileId: ProfileId.fromId(profileId, { userError }),
          version: '1.0.1',
        },
      ]);
    });

    it('returns correct id and version from file', async () => {
      mocked(parseProfile).mockReturnValue({
        header: {
          kind: 'ProfileHeader',
          name: 'test',
          scope: 'scope',
          version: { major: 1, minor: 0, patch: 0 },
        },
        kind: 'ProfileDocument',
        astMetadata,
        definitions: [],
      });

      const profileId = 'starwars/character-information';
      const stubSuperJson = {};
      mergeProfile(
        stubSuperJson,
        profileId,
        {
          file: 'fixtures/install/playground/character-information.supr',
        },
        NodeFileSystem
      );
      await expect(
        getExistingProfileIds(stubSuperJson, '', { logger, userError })
      ).resolves.toEqual([
        {
          profileId: ProfileId.fromScopeName('scope', 'test'),
          version: '1.0.0',
        },
      ]);
    });

    describe('when installing profiles', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const originalWriteOnce = OutputStream.writeOnce;
      const mockWrite = jest.fn();

      //mock profile info
      const mockProfileInfo = {
        profile_id: 'starwars/character-information@1.0.1',
        profile_name: 'starwars/character-information',
        profile_version: '1.0.1',
        url: 'https://superface.dev/starwars/character-information@1.0.1',
        owner: 'freaz',
        owner_url: '',
        published_at: new Date(),
        published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
      };
      //mock profile ast
      const mockProfileAst = ({
        major,
        minor,
        patch,
      }: {
        major?: number;
        minor?: number;
        patch?: number;
      }): ProfileDocumentNode => ({
        kind: 'ProfileDocument',
        astMetadata,
        header: {
          kind: 'ProfileHeader',
          scope: 'starwars',
          name: 'character-information',
          version: { major: major ?? 1, minor: minor ?? 0, patch: patch ?? 0 },
          location: {
            start: { line: 1, column: 1, charIndex: 0 },
            end: { line: 1, column: 1, charIndex: 0 },
          },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            documentation: {
              title: 'Starwars',
            },
          },
        ],
        location: {
          start: { line: 1, column: 1, charIndex: 0 },
          end: { line: 1, column: 1, charIndex: 0 },
        },
      });
      //mock profile
      const mockProfile = 'mock profile';

      beforeEach(async () => {
        OutputStream.writeOnce = mockWrite;
      });

      afterAll(() => {
        OutputStream.writeOnce = originalWriteOnce;
      });

      afterEach(() => {
        jest.resetAllMocks();
      });

      it('does not install profile when super.json not found', async () => {
        mocked(fetchProfileAST).mockResolvedValue(mockProfileAst({}));
        mocked(fetchProfile).mockResolvedValue(mockProfile);
        mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);

        jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));

        await expect(
          installProfiles(
            {
              superPath: '.',
              requests: [
                {
                  kind: 'store',
                  profileId: ProfileId.fromScopeName(
                    'starwars',
                    'character-information'
                  ),
                  version: undefined,
                },
              ],
            },
            { logger, userError }
          )
        ).resolves.toEqual({ continueWithInstall: false });

        expect(fetchProfileInfo).not.toHaveBeenCalled();
        expect(fetchProfile).not.toHaveBeenCalled();
        expect(fetchProfileAST).not.toHaveBeenCalled();
      }, 10000);

      it('installs single profile', async () => {
        mocked(fetchProfileAST).mockResolvedValue(
          mockProfileAst({ major: 1, minor: 0, patch: 1 })
        );
        mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);

        const stubSuperJson = {};

        jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(stubSuperJson));

        const profileId = ProfileId.fromId('starwars/character-information', {
          userError,
        });

        await expect(
          installProfiles(
            {
              superPath: '.',
              requests: [
                {
                  kind: 'store',
                  profileId: ProfileId.fromScopeName(
                    'starwars',
                    'character-information'
                  ),
                  version: undefined,
                },
              ],
            },
            { logger, userError }
          )
        ).resolves.toEqual({ continueWithInstall: true });

        expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
        expect(fetchProfileAST).toHaveBeenCalledTimes(1);

        expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, undefined, {
          tryToAuthenticate: undefined,
        });
        expect(fetchProfileAST).toHaveBeenCalledWith(profileId, undefined, {
          tryToAuthenticate: undefined,
        });
        //actual path is changing

        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('character-information@1.0.1.supr.ast.json'),
          JSON.stringify(
            mockProfileAst({ major: 1, minor: 0, patch: 1 }),
            undefined,
            2
          ),
          {
            dirs: true,
          }
        );
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringMatching('super.json'),
          JSON.stringify(
            {
              profiles: {
                [profileId.id]: {
                  version: '1.0.1',
                },
              },
            },
            undefined,
            2
          )
        );
      }, 10000);

      it('installs profiles from super.json', async () => {
        mocked(fetchProfileAST)
          .mockResolvedValueOnce(mockProfileAst({ major: 1 }))
          .mockResolvedValueOnce(mockProfileAst({ major: 2 }));
        mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);

        const stubSuperJson = {};
        mergeProfile(
          stubSuperJson,
          'starwars/first',
          { version: '1.0.0' },
          NodeFileSystem
        );
        mergeProfile(
          stubSuperJson,
          'starwars/second',
          { version: '2.0.0' },
          NodeFileSystem
        );

        jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(stubSuperJson));

        await expect(
          installProfiles(
            { superPath: '.', requests: [] },
            { logger, userError }
          )
        ).resolves.toEqual({ continueWithInstall: true });

        expect(fetchProfileInfo).toHaveBeenCalledTimes(2);
        expect(fetchProfileAST).toHaveBeenCalledTimes(2);

        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          1,
          ProfileId.fromId('starwars/first', { userError }),
          '1.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          2,
          ProfileId.fromId('starwars/second', { userError }),
          '2.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          1,
          ProfileId.fromId('starwars/first', { userError }),
          '1.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          2,
          ProfileId.fromId('starwars/second', { userError }),
          '2.0.0',
          { tryToAuthenticate: undefined }
        );

        // actual path is changing
        expect(mockWrite).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('first@1.0.0.supr.ast.json'),
          JSON.stringify(mockProfileAst({ major: 1 }), undefined, 2),
          {
            dirs: true,
          }
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('second@2.0.0.supr.ast.json'),
          JSON.stringify(mockProfileAst({ major: 2 }), undefined, 2),
          {
            dirs: true,
          }
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          3,
          'super.json',
          JSON.stringify(
            {
              profiles: {
                ['starwars/first']: {
                  version: mockProfileInfo.profile_version,
                },
                ['starwars/second']: {
                  version: mockProfileInfo.profile_version,
                },
              },
            },
            undefined,
            2
          )
        );
      });
    });
  });
});
