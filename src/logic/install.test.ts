import { CLIError } from '@oclif/errors';
import { ProfileDocumentNode } from '@superfaceai/ast';
import { ok, SuperJson } from '@superfaceai/one-sdk';
import { join } from 'path';
import { mocked } from 'ts-jest/utils';

import { getProfileDocument } from '../common/document';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
} from '../common/http';
import { exists, mkdirQuiet, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { transpileFiles } from '../logic/generate';
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

//Mock document
jest.mock('../common/document', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/document'),
  getProfileDocument: jest.fn(),
}));

jest.mock('../common/io', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/io'),
  exists: jest.fn(),
}));

jest.mock('../logic/generate');

describe('Install CLI logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

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
    it('gets profile', async () => {
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
      mocked(fetchProfileInfo).mockResolvedValue(mockProfileInfo);
      //mock profile ast
      const mockProfileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          scope: 'starwars',
          name: 'character-information',
          version: { major: 1, minor: 0, patch: 1 },
          location: { line: 1, column: 1 },
          span: { start: 0, end: 57 },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
      };
      mocked(fetchProfileAST).mockResolvedValue(mockProfileAst);
      //mock profile
      const mockProfile = 'mock profile';
      mocked(fetchProfile).mockResolvedValue(mockProfile);

      const profileId = 'starwars/character-information';

      await expect(getProfileFromStore(profileId)).resolves.toEqual({
        ast: mockProfileAst,
        info: mockProfileInfo,
        profile: mockProfile,
      });
      expect(fetchProfile).toHaveBeenCalledTimes(1);
      expect(fetchProfileAST).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfile).toHaveBeenCalledWith(profileId);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId);
      expect(fetchProfileAST).toHaveBeenCalledWith(profileId);
    }, 10000);

    it('throws user error on invalid profileId', async () => {
      mocked(fetchProfileInfo).mockRejectedValue(
        new CLIError('Not Found', { exit: 1 })
      );

      const profileId = 'made-up';

      await expect(getProfileFromStore(profileId)).resolves.toBeUndefined();
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId);
      expect(fetchProfile).not.toHaveBeenCalled();
      expect(fetchProfileAST).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('when resolving installation requests', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('reads and checks local requests', async () => {
      const stubSuperJson = new SuperJson({
        profiles: {
          'se/cond': {
            file: 'second',
          },
        },
      });

      mocked(getProfileDocument)
        .mockResolvedValueOnce({
          kind: 'ProfileDocument',
          header: {
            kind: 'ProfileHeader',
            name: 'first',
            version: { major: 1, minor: 1, patch: 0 },
          },
          definitions: [],
        })
        .mockRejectedValueOnce('error')
        .mockResolvedValueOnce({
          kind: 'ProfileDocument',
          header: {
            kind: 'ProfileHeader',
            name: 'se/cond',
            version: { major: 2, minor: 2, patch: 0 },
          },
          definitions: [],
        });

      await expect(
        resolveInstallationRequests(stubSuperJson, [
          { kind: 'local', path: 'first' },
          { kind: 'local', path: 'none' },
          { kind: 'local', path: 'second' },
        ])
      ).resolves.toEqual(1);

      expect(stubSuperJson.document).toEqual({
        profiles: {
          first: {
            file: 'first',
          },
          'se/cond': {
            file: 'second',
          },
        },
      });

      expect(transpileFiles).toHaveBeenCalled();
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

      const mockInfoResponse = {
        profile_id: 'starwars/character-information@1.0.1',
        profile_name: 'starwars/character-information',
        profile_version: '1.0.1',
        url: 'https://superface.dev/starwars/character-information@1.0.1',
        owner: 'freaz',
        owner_url: '',
        published_at: '2021-01-29T08:10:50.925Z',
        published_by: '',
      };

      const existsMock = mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      const fetchProfileInfoMock = mocked(fetchProfileInfo).mockImplementation(
        profileId => {
          if (profileId === 'none') {
            return Promise.reject('none does not exist');
          } else {
            return Promise.resolve(mockInfoResponse);
          }
        }
      );
      const fetchProfileMock = mocked(fetchProfile).mockResolvedValue(
        'mock profile'
      );
      const fetchProfileASTMock = mocked(fetchProfileAST).mockResolvedValue({
        kind: 'ProfileDocument',
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
            { kind: 'store', profileId: 'first', version: '1.0.1' },
            { kind: 'store', profileId: 'none' },
            { kind: 'store', profileId: 'se/cond', version: '2.2.0' },
            { kind: 'store', profileId: 'third' },
          ],
          { warnCb: warnCbMock }
        )
      ).resolves.toEqual(1);

      expect(existsMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('first@1.0.1.supr')
      );
      expect(existsMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('second.supr')
      );
      expect(existsMock).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('third@1.0.1.supr')
      );
      expect(existsMock).toHaveBeenCalledTimes(3);

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
        expect.stringContaining('File already exists:')
      );
      expect(warnCbMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Could not fetch none: none does not exist')
      );
      expect(warnCbMock).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('File already exists:')
      );
      expect(warnCbMock).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('when geting profile id', () => {
    it('returns correct id and version', async () => {
      const profileName = 'starwars/character-information';
      const stubSuperJson = new SuperJson({});
      stubSuperJson.addProfile(profileName, { version: '1.0.1' });
      await expect(getExistingProfileIds(stubSuperJson)).resolves.toEqual([
        { profileId: 'starwars/character-information', version: '1.0.1' },
      ]);
    });

    it('returns correct id and version from file', async () => {
      mocked(getProfileDocument).mockResolvedValue({
        header: {
          kind: 'ProfileHeader',
          name: 'test',
          version: { major: 1, minor: 0, patch: 0 },
        },
        kind: 'ProfileDocument',
        definitions: [],
      });
      const profileName = 'starwars/character-information';
      const stubSuperJson = new SuperJson({});
      stubSuperJson.addProfile(profileName, {
        file: 'fixtures/install/playground/character-information.supr',
      });
      await expect(getExistingProfileIds(stubSuperJson)).resolves.toEqual([
        { profileId: 'starwars/character-information', version: '1.0.0' },
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
        header: {
          kind: 'ProfileHeader',
          scope: 'starwars',
          name: 'character-information',
          version: { major: 1, minor: 0, patch: 1 },
          location: { line: 1, column: 1 },
          span: { start: 0, end: 57 },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
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

        const profileName = 'starwars/character-information';

        await expect(
          installProfiles('.', [{ kind: 'store', profileId: profileName }])
        ).resolves.toBeUndefined();

        expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledTimes(1);
        expect(fetchProfileAST).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledWith(profileName);
        expect(fetchProfileInfo).toHaveBeenCalledWith(profileName);
        expect(fetchProfileAST).toHaveBeenCalledWith(profileName);

        //actual path is changing
        expect(mockWrite).toHaveBeenCalledWith(expect.anything(), mockProfile, {
          dirs: true,
        });
        expect(mockWrite).toHaveBeenCalledWith(
          expect.anything(),
          JSON.stringify(mockProfileAst, undefined, 2)
        );
        expect(mockWrite).toHaveBeenCalledWith(
          '',
          JSON.stringify(
            {
              profiles: {
                [profileName]: {
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
        stubSuperJson.addProfile('starwars/first', { version: '1.0.0' });
        stubSuperJson.addProfile('starwars/second', { version: '2.0.0' });

        mockLoad.mockResolvedValue(ok(stubSuperJson));
        SuperJson.load = mockLoad;

        await expect(installProfiles('.', [])).resolves.toBeUndefined();

        expect(fetchProfileInfo).toHaveBeenCalledTimes(2);
        expect(fetchProfile).toHaveBeenCalledTimes(2);
        expect(fetchProfileAST).toHaveBeenCalledTimes(2);
        expect(fetchProfile).toHaveBeenNthCalledWith(1, 'starwars/first@1.0.0');
        expect(fetchProfile).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0'
        );
        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          1,
          'starwars/first@1.0.0'
        );
        expect(fetchProfileInfo).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0'
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          1,
          'starwars/first@1.0.0'
        );
        expect(fetchProfileAST).toHaveBeenNthCalledWith(
          2,
          'starwars/second@2.0.0'
        );

        expect(mockWrite).toHaveBeenCalled();
        //actual path is changing
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('first@1.0.0.supr'),
          mockProfile,
          { dirs: true }
        );
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('first@1.0.0.supr.ast.json'),
          JSON.stringify(mockProfileAst, undefined, 2)
        );
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('second@2.0.0.supr'),
          mockProfile,
          { dirs: true }
        );
        expect(mockWrite).toHaveBeenCalledWith(
          expect.stringContaining('second@2.0.0.supr.ast.json'),
          JSON.stringify(mockProfileAst, undefined, 2)
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
