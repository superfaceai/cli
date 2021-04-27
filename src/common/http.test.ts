import { CLIError } from '@oclif/errors';
import superagent from 'superagent';

import {
  ContentType,
  fetch,
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  getStoreUrl,
} from '../common/http';

//Mock superagent
const mockInnerSet = jest.fn();
const mockSet = jest.fn().mockReturnValue({ set: mockInnerSet });

jest.mock('superagent');

describe('HTTP functions', () => {
  const profileId = 'starwars/character-information';

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when fetching data', () => {
    it('calls superagent correctly', async () => {
      mockInnerSet.mockResolvedValue({ body: 'test' });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetch(mockUrl, ContentType.JSON)).resolves.toEqual({
        body: 'test',
      });

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);

    it('catches error during superagent call', async () => {
      mockInnerSet.mockRejectedValue(new Error('Not found'));
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetch(mockUrl, ContentType.JSON)).rejects.toEqual(
        new CLIError('Not found')
      );

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile info', () => {
    it('calls superagent correctly', async () => {
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
      mockInnerSet.mockResolvedValue({ body: mockProfileInfo });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfileInfo(profileId)).resolves.toEqual(
        mockProfileInfo
      );

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile', () => {
    it('calls superagent correctly', async () => {
      const mockProfile = 'mock profile';

      mockInnerSet.mockResolvedValue({ body: mockProfile });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfile(profileId)).resolves.toEqual(mockProfile);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.PROFILE);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile ast', () => {
    it('calls superagent correctly', async () => {
      //mock profile ast
      const mockProfileAst = {
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
            input: [],
            result: [],
            error: [],
            location: [],
            span: [],
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
      };
      mockInnerSet.mockResolvedValue({ body: mockProfileAst });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfileAST(profileId)).resolves.toEqual(mockProfileAst);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.AST);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });
});
