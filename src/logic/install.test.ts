import { CLIError } from '@oclif/errors';
import { AstMetadata, ProfileDocumentNode } from '@superfaceai/ast';
import { ok, Parser, SuperJson } from '@superfaceai/one-sdk';
import { join } from 'path';
import { mocked } from 'ts-jest/utils';

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

//Mock http
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

describe('Install CLI logic', () => {
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
      let path = join(
        'fixtures',
        'install',
        'playground',
        'superface',
        'nested1'
      );
      await mkdirQuiet(path);
      path = join(
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
        join('fixtures', 'install', 'playground', 'superface', 'nested1')
      );
    });

    afterEach(() => {
      process.chdir(INITIAL_CWD);
      jest.resetAllMocks();
    });

    it('detects super.json in cwd', async () => {
      process.chdir(join('fixtures', 'install', 'playground', 'superface'));
      expect(await detectSuperJson(process.cwd())).toEqual('.');
    }, 10000);

    it('detects super.json from 1 level above', async () => {
      process.chdir(join('fixtures', 'install', 'playground'));
      expect(await detectSuperJson(process.cwd())).toEqual('superface');
    }, 10000);

    it('does not detect super.json from 2 levels above', async () => {
      process.chdir(join('fixtures', 'install'));
      expect(await detectSuperJson(process.cwd())).toBeUndefined();
    }, 10000);

    it('detects super.json from 1 level below', async () => {
      process.chdir(
        join('fixtures', 'install', 'playground', 'superface', 'nested1')
      );
      expect(await detectSuperJson(process.cwd(), 1)).toEqual('..');
    }, 10000);

    it('detects super.json from 2 levels below', async () => {
      process.chdir(
        join(
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
        join(
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
    //mock profile info
    const mockProfileInfo = {
      profile_id: 'starwars/character-information@1.0.1',
      profile_name: 'starwars/character-information',
      profile_version: '1.0.1',
      url: 'https://superface.dev/starwars/character-information@1.0.1',
      owner: 'freaz',
      owner_url: '',
      published_at: '2021-01-29T08:10:50.925Z',
      published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
    };
    //mock profile ast
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
      //mock profile
      const mockProfile = 'mock profile';
      mocked(fetchProfile).mockResolvedValue(mockProfile);

      const profileId = 'starwars/character-information';

      await expect(
        getProfileFromStore(ProfileId.fromId(profileId))
      ).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
        profile: mockProfile,
      });
      expect(fetchProfile).toHaveBeenCalledTimes(1);
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfile).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
    }, 10000);

    it('gets profile when AST validation failed', async () => {
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      mocked(fetchProfileAST).mockRejectedValue(new Error('validation error'));
      //mock profile
      const mockProfile = 'mock profile';
      mocked(fetchProfile).mockResolvedValue(mockProfile);

      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileAst);

      const profileId = 'starwars/character-information';

      await expect(
        getProfileFromStore(ProfileId.fromId(profileId))
      ).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
        profile: mockProfile,
      });
      expect(fetchProfile).toHaveBeenCalledTimes(1);
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfile).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: undefined,
      });
      expect(parseProfileSpy).toHaveBeenCalledWith(mockProfile, profileId, {
        profileName: 'character-information',
        scope: 'starwars',
      });
    }, 10000);

    it('gets profile with auth', async () => {
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);
      //mock profile
      const mockProfile = 'mock profile';
      mocked(fetchProfile).mockResolvedValue(mockProfile);

      const profileId = 'starwars/character-information';

      await expect(
        getProfileFromStore(ProfileId.fromId(profileId), undefined, {
          tryToAuthenticate: true,
        })
      ).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
        profile: mockProfile,
      });
      expect(fetchProfile).toHaveBeenCalledTimes(1);
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfile).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: true,
      });
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: true,
      });
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId, {
        tryToAuthenticate: true,
      });
      10000;
    });

    it('throws user error on invalid profileId', async () => {
      mocked(fetchProfileInfo).mockRejectedValue(
        new CLIError('Not Found', { exit: 1 })
      );

      const profileId = 'made-up';

      await expect(
        getProfileFromStore(ProfileId.fromId(profileId))
      ).resolves.toBeUndefined();
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, {
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
      published_at: '2021-01-29T08:10:50.925Z',
      published_by: '',
    };

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('reads and checks local requests', async () => {
      const stubSuperJson = new SuperJson({
        profiles: {
          'se/cond': {
            file: 'second.supr',
          },
        },
      });
      mocked(readFile).mockResolvedValueOnce('.');

      //We are running static function inside of promise all - we can't be sure about order of calls
      jest
        .spyOn(Parser, 'parseProfile')
        .mockImplementation(
          (
            _input: string,
            _fileName: string,
            _info: { profileName: string; scope?: string }
          ) => {
            if (_info.profileName === 'first') {
              return Promise.resolve({
                kind: 'ProfileDocument',
                astMetadata,
                header: {
                  kind: 'ProfileHeader',
                  name: 'first',
                  version: { major: 1, minor: 1, patch: 0 },
                },
                definitions: [],
              });
            } else if (_info.profileName === 'second') {
              return Promise.resolve({
                kind: 'ProfileDocument',
                astMetadata,
                header: {
                  kind: 'ProfileHeader',
                  scope: 'se',
                  name: 'cond',
                  version: { major: 2, minor: 2, patch: 0 },
                },
                definitions: [],
              });
            } else {
              return Promise.reject('error');
            }
          }
        );

      await expect(
        resolveInstallationRequests(stubSuperJson, [
          { kind: 'local', path: 'first.supr' },
          { kind: 'local', path: 'none.supr' },
          { kind: 'local', path: 'second.supr' },
        ])
      ).resolves.toEqual(1);

      expect(stubSuperJson.document).toEqual({
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

      const stubSuperJson = new SuperJson({
        profiles: {
          'se/cond': {
            file: 'second.supr',
          },
        },
      });

      const existsMock = mocked(exists).mockImplementation(async path => {
        if (path.includes('third')) {
          return true;
        } else {
          return false;
        }
      });
      const fetchProfileInfoMock = mocked(fetchProfileInfo).mockImplementation(
        profileId => {
          if (profileId === 'none') {
            return Promise.reject('none does not exist');
          } else {
            return Promise.resolve(MOCK_PROFILE_RESPONSE);
          }
        }
      );
      const fetchProfileMock = mocked(fetchProfile).mockResolvedValue(
        'mock profile'
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
      const warnCbMock = jest.fn();

      await expect(
        resolveInstallationRequests(
          stubSuperJson,
          [
            {
              kind: 'store',
              profileId: ProfileId.fromId('first'),
              version: '1.0.1',
            },
            {
              kind: 'store',
              profileId: ProfileId.fromId('none'),
              version: undefined,
            },
            {
              kind: 'store',
              profileId: ProfileId.fromId('se/cond'),
              version: '2.2.0',
            },
            {
              kind: 'store',
              profileId: ProfileId.fromId('third'),
              version: undefined,
            },
          ],
          { warnCb: warnCbMock }
        )
      ).resolves.toEqual(1);

      expect(existsMock).toHaveBeenCalled();

      expect(stubSuperJson.document).toEqual({
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
      expect(fetchProfileMock).toHaveBeenCalledTimes(2);
      expect(fetchProfileASTMock).toHaveBeenCalledTimes(2);

      expect(warnCbMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('already installed from a path')
      );
      expect(warnCbMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Could not fetch none: none does not exist')
      );
      expect(warnCbMock).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('Target file already exists:')
      );
      expect(warnCbMock).toHaveBeenCalledTimes(3);
    }, 10000);

    it('overrides everything with force flag', async () => {
      jest.spyOn(OutputStream, 'writeOnce').mockResolvedValue();

      const stubSuperJson = new SuperJson({
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
      });

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
      jest
        .spyOn(Parser, 'parseProfile')
        .mockImplementation((_input: string, fileName: string) => {
          let scope;
          let name;
          let version;

          if (fileName === 'local-second.supr') {
            scope = 'local';
            name = 'second';
            version = { major: 1, minor: 1, patch: 0 };
          } else if (fileName === 'local-third.supr') {
            scope = 'local';
            name = 'third';
            version = { major: 1, minor: 1, patch: 0 };
          } else if (fileName === 'remote-third.supr') {
            scope = 'remote';
            name = 'third';
            version = { major: 1, minor: 1, patch: 0 };
          } else {
            name = '';
            version = { major: 0, minor: 0, patch: 0 };
          }

          return Promise.resolve({
            kind: 'ProfileDocument',
            astMetadata,
            header: {
              kind: 'ProfileHeader',
              scope,
              name,
              version,
            },
            definitions: [],
          });
        });

      await expect(
        resolveInstallationRequests(
          stubSuperJson,
          [
            {
              kind: 'store',
              profileId: ProfileId.fromId('local/first'),
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
              profileId: ProfileId.fromId('remote/first'),
              version: '1.0.1',
            },
            {
              kind: 'store',
              profileId: ProfileId.fromId('remote/second'),
              version: '1.0.1',
            },
            {
              kind: 'local',
              path: 'remote-third.supr',
            },
          ],
          { warnCb: console.log, force: true }
        )
      ).resolves.toEqual(6);

      expect(stubSuperJson.document).toEqual({
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
      const stubSuperJson = new SuperJson({});

      stubSuperJson.mergeProfile(profileId, { version: '1.0.1' });
      await expect(getExistingProfileIds(stubSuperJson)).resolves.toEqual([
        {
          profileId: ProfileId.fromId(profileId),
          version: '1.0.1',
        },
      ]);
    });

    it('returns correct id and version from file', async () => {
      jest.spyOn(Parser, 'parseProfile').mockResolvedValue({
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
      const stubSuperJson = new SuperJson({});
      stubSuperJson.mergeProfile(profileId, {
        file: 'fixtures/install/playground/character-information.supr',
      });
      await expect(getExistingProfileIds(stubSuperJson)).resolves.toEqual([
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
        published_at: '2021-01-29T08:10:50.925Z',
        published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
      };
      //mock profile ast
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

      it('installs single profile', async () => {
        mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);
        mocked(fetchProfile).mockResolvedValue(mockProfile);
        mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
        const parsedProfileSpy = jest
          .spyOn(Parser, 'parseProfile')
          .mockResolvedValue(mockProfileAst);
        const profileId = 'starwars/character-information';

        await expect(
          installProfiles({
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
          })
        ).resolves.toBeUndefined();

        expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledTimes(1);
        expect(fetchProfileAST).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledWith(profileId, {
          tryToAuthenticate: undefined,
        });
        expect(fetchProfileInfo).toHaveBeenCalledWith(profileId, {
          tryToAuthenticate: undefined,
        });
        expect(fetchProfileAST).toHaveBeenCalledWith(profileId, {
          tryToAuthenticate: undefined,
        });

        //actual path is changing
        expect(mockWrite).toHaveBeenCalledWith(expect.anything(), mockProfile, {
          dirs: true,
        });
        expect(parsedProfileSpy).toHaveBeenCalledWith(mockProfile, profileId, {
          profileName: 'character-information',
          scope: 'starwars',
        });
        expect(mockWrite).toHaveBeenCalledWith(
          '',
          JSON.stringify(
            {
              profiles: {
                [profileId]: {
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
        mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);
        mocked(fetchProfile).mockResolvedValue(mockProfile);
        mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);

        //Mock super json load
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalLoad = SuperJson.load;
        const mockLoad = jest.fn();

        const stubSuperJson = new SuperJson({});
        stubSuperJson.mergeProfile('starwars/first', { version: '1.0.0' });
        stubSuperJson.mergeProfile('starwars/second', { version: '2.0.0' });

        mockLoad.mockResolvedValue(ok(stubSuperJson));
        SuperJson.load = mockLoad;
        const parsedProfileSpy = jest.spyOn(Parser, 'parseProfile');

        await expect(
          installProfiles({ superPath: '.', requests: [] })
        ).resolves.toBeUndefined();

        expect(fetchProfileInfo).toHaveBeenCalledTimes(2);
        expect(fetchProfile).toHaveBeenCalledTimes(2);
        expect(fetchProfileAST).toHaveBeenCalledTimes(2);
        expect(fetchProfile).toHaveBeenNthCalledWith(
          1,
          'starwars/first@1.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfile).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          1,
          'starwars/first@1.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          1,
          'starwars/first@1.0.0',
          { tryToAuthenticate: undefined }
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0',
          { tryToAuthenticate: undefined }
        );

        expect(mockWrite).toHaveBeenCalled();
        //actual path is changing
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('first@1.0.0.supr'),
          mockProfile,
          { dirs: true }
        );
        expect(parsedProfileSpy).toHaveBeenCalledWith(
          mockProfile,
          'starwars/first',
          { profileName: 'first', scope: 'starwars' }
        );

        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('second@2.0.0.supr'),
          mockProfile,
          { dirs: true }
        );
        expect(parsedProfileSpy).toHaveBeenCalledWith(
          mockProfile,
          'starwars/second',
          { profileName: 'second', scope: 'starwars' }
        );

        expect(mockWrite).toHaveBeenCalledWith(
          '',
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
        SuperJson.load = originalLoad;
      });
    });
  });
});
