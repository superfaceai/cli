import { CLIError } from '@oclif/errors';
import { ProfileDocumentNode } from '@superfaceai/ast';
import { ok, SuperJson } from '@superfaceai/sdk';
import { join } from 'path';
import { mocked } from 'ts-jest/utils';

import { getProfileDocument } from '../common/document';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
} from '../common/http';
import { mkdirQuiet, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  detectSuperJson,
  getProfileFromStore,
  getProfileIds,
  handleProfileResponses,
  installProfiles,
  ProfileResponse,
} from './install';

//Mock http
jest.mock('../common/http', () => ({
  fetchProfileInfo: jest.fn(),
  fetchProfile: jest.fn(),
  fetchProfileAST: jest.fn(),
}));

//Mock document
jest.mock('../common/document', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ...(jest.requireActual('../common/document') as Record<string, unknown>),
  getProfileDocument: jest.fn(),
}));
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

      await expect(getProfileFromStore(profileId)).rejects.toEqual(
        new CLIError('Not Found', { exit: 1 })
      );
      expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
      expect(fetchProfileInfo).toHaveBeenCalledWith(profileId);
      expect(fetchProfile).not.toHaveBeenCalled();
      expect(fetchProfileAST).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('when handling profile responses', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalWriteOnce = OutputStream.writeOnce;
    const mockWrite = jest.fn();

    //mock profile response
    const mockProfileResponse: ProfileResponse = {
      info: {
        profile_id: 'starwars/character-information@1.0.1',
        profile_name: 'starwars/character-information',
        profile_version: '1.0.1',
        url: 'https://superface.dev/starwars/character-information@1.0.1',
        owner: 'freaz',
        owner_url: '',
        published_at: '2021-01-29T08:10:50.925Z',
        published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
      },
      ast: {
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
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
      },
      profile: 'mock profile',
    };

    beforeEach(async () => {
      OutputStream.writeOnce = mockWrite;
    });

    afterAll(() => {
      OutputStream.writeOnce = originalWriteOnce;
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns correct number of installed profiles', async () => {
      const profileName = 'starwars/character-information';

      const stubSuperJson = new SuperJson({});

      await expect(
        handleProfileResponses(stubSuperJson, [mockProfileResponse])
      ).resolves.toEqual(1);
      expect(mockWrite).toHaveBeenCalledTimes(2);
      //actual path is changing
      expect(mockWrite).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        mockProfileResponse.profile,
        { dirs: true }
      );
      expect(mockWrite).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        JSON.stringify(mockProfileResponse.ast, undefined, 2)
      );
      //super json
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(stubSuperJson.document.profiles![profileName]).toEqual({
        version: mockProfileResponse.info.profile_version,
      });
    }, 10000);

    it('returns correct number of installed profiles - use local file', async () => {
      const profileName = 'starwars/character-information';

      const stubSuperJson = new SuperJson({});
      stubSuperJson.addProfile(profileName, {
        file: '../fixtures/install/playground/character-information.supr',
      });

      await expect(
        handleProfileResponses(stubSuperJson, [mockProfileResponse])
      ).resolves.toEqual(1);

      expect(mockWrite).toHaveBeenCalledTimes(2);
      //actual path is changing
      expect(mockWrite).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        mockProfileResponse.profile,
        { dirs: true }
      );
      expect(mockWrite).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        JSON.stringify(mockProfileResponse.ast, undefined, 2)
      );
      //super json
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(stubSuperJson.document.profiles![profileName]).toEqual({
        file: '../fixtures/install/playground/character-information.supr',
        defaults: undefined,
        providers: undefined,
      });
    }, 10000);

    it('returns correct number of installed profiles - use already existing local file', async () => {
      const profileName = 'starwars/character-information';

      const stubSuperJson = new SuperJson({});
      stubSuperJson.addProfile(profileName, {
        file: 'fixtures/install/playground/character-information.supr',
      });

      await expect(
        handleProfileResponses(stubSuperJson, [mockProfileResponse])
      ).resolves.toEqual(0);

      expect(mockWrite).toHaveBeenCalledTimes(0);
      //super json
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(stubSuperJson.document.profiles![profileName]).toEqual({
        file: 'fixtures/install/playground/character-information.supr',
      });
    }, 10000);
  });

  describe('when geting profile id', () => {
    it('returns correct id and version', async () => {
      const profileName = 'starwars/character-information';
      const stubSuperJson = new SuperJson({});
      stubSuperJson.addProfile(profileName, { version: '1.0.1' });
      await expect(getProfileIds(stubSuperJson)).resolves.toEqual([
        'starwars/character-information@1.0.1',
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
      await expect(getProfileIds(stubSuperJson)).resolves.toEqual([
        'starwars/character-information@1.0.0',
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
          installProfiles('.', profileName)
        ).resolves.toBeUndefined();

        expect(fetchProfileInfo).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledTimes(1);
        expect(fetchProfileAST).toHaveBeenCalledTimes(1);
        expect(fetchProfile).toHaveBeenCalledWith(profileName);
        expect(fetchProfileInfo).toHaveBeenCalledWith(profileName);
        expect(fetchProfileAST).toHaveBeenCalledWith(profileName);

        expect(mockWrite).toHaveBeenCalledTimes(3);
        //actual path is changing
        expect(mockWrite).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          mockProfile,
          { dirs: true }
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          JSON.stringify(mockProfileAst, undefined, 2)
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          3,
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
      });

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

        await expect(installProfiles('.')).resolves.toBeUndefined();

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

        expect(mockWrite).toHaveBeenCalledTimes(5);
        //actual path is changing
        expect(mockWrite).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          mockProfile,
          { dirs: true }
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          JSON.stringify(mockProfileAst, undefined, 2)
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          3,
          expect.anything(),
          mockProfile,
          { dirs: true }
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          4,
          expect.anything(),
          JSON.stringify(mockProfileAst, undefined, 2)
        );
        expect(mockWrite).toHaveBeenNthCalledWith(
          5,
          '',
          JSON.stringify(
            {
              profiles: {
                ['starwars/first']: {
                  version: '1.0.0',
                },
                ['starwars/second']: {
                  version: '2.0.0',
                },
                ['starwars/character-information']: {
                  version: '1.0.1',
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
