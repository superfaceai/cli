import { SuperJson } from '@superfaceai/one-sdk';
import { parseProfile, Source } from '@superfaceai/parser';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { exists, mkdir } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { prepareTest } from './prepare-test';
import { loadProfile } from './publish.utils';

jest.mock('./publish.utils', () => ({
  loadProfile: jest.fn(),
}));

jest.mock('../common/io', () => ({
  exists: jest.fn(),
  mkdir: jest.fn(),
}));

describe('prepareTest logic', () => {
  const mockProfileId = ProfileId.fromId('starwars/character-information');
  const provider = 'swapi';
  const mockSuperJson = new SuperJson({
    profiles: {
      [mockProfileId.id]: {
        version: '1.0.4',
        providers: {
          swapi: {},
        },
        priority: ['swapi'],
      },
    },
    providers: {
      swapi: {
        security: [],
      },
    },
  });
  const mockProfileSource = `
  name = "starwars/character-information"
version = "1.0.4"

usecase RetrieveCharacterInformation safe {
  input {
    characterName string
  }

  result {
    height string
  }

  error {
    message
    characters
  }

  example success {
    input {
      firstLeveNumber = 1,
      firstLeveBoolean = true,
      firstLeveString = "test",
      firstLevelList = [
        {
          foo = 1,
          bar = false,
          xyz = []
          obj = {}
        },
        {
          foo = 2,
          bar = true,
          xyz = []
          obj = {}
        }
      ],
      firstLevelObject = {
        secondLeveNumber = 2,
        secondLeveBoolean = false,
        secondLeveString = "test2",
        secondLevelList = [
          1, 2, 3
        ],
        secondLevelObject = {
          list = []
          obj = {} 
        }
      }
    }

    result {
      height = "172",
    }
  }

  example errorNoMatch {
    input {
      characterName = "madeUp"
    }

    error {
      message = "No character found"
    }
  }

  example errorWithSuggestions {
    input {
      characterName = "Luke"
    }

    error {
      message = "Specified character name is incorrect, did you mean to enter one of following?"
      characters = ["Luke Skywalker"]
    }
  }
}`;

  const expectedOutput = `import { SuperfaceTest } from '@superfaceai/testing';

describe('starwars/character-information/swapi', () => {
  let superface: SuperfaceTest;

  beforeEach(() => {
    superface = new SuperfaceTest({
      profile: 'starwars/character-information',
      provider: 'swapi',
    });
  });
  
  describe('RetrieveCharacterInformation', () => {
    
    it('should perform successfully', async () => {
      await expect(
        superface.run({
          useCase: 'RetrieveCharacterInformation',
          input: {
						firstLeveNumber: 1,
						firstLeveBoolean: true,
						firstLeveString: "test",
						firstLevelList: [{
								foo: 1,
								bar: false,
								xyz: [],
								obj: {},
							},{
								foo: 2,
								bar: true,
								xyz: [],
								obj: {},
							}],
						firstLevelObject: {
							secondLeveNumber: 2,
							secondLeveBoolean: false,
							secondLeveString: "test2",
							secondLevelList: [1,2,3],
							secondLevelObject: {
								list: [],
								obj: {},
							},
						},
					}
        })
      ).resolves.toMatchSnapshot();
    });
    it('should map error', async () => {
      await expect(
        superface.run({
          useCase: 'RetrieveCharacterInformation',
          input: {
						characterName: "madeUp",
					}
        })
      ).resolves.toMatchSnapshot();
    });
    it('should map error', async () => {
      await expect(
        superface.run({
          useCase: 'RetrieveCharacterInformation',
          input: {
						characterName: "Luke",
					}
        })
      ).resolves.toMatchSnapshot();
    });
  });

});`;
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('calling prepare test', () => {
    it('prepares test for profile, default path and name', async () => {
      const ast = parseProfile(new Source(mockProfileSource));

      mocked(loadProfile).mockResolvedValue({
        ast,
        from: { kind: 'remote', version: '1.0.4' },
      });

      const writeSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        prepareTest(mockSuperJson, mockProfileId, 'swapi')
      ).resolves.toBeUndefined();

      expect(writeSpy).toHaveBeenCalledWith(
        joinPath(process.cwd(), mockProfileId.id, `${provider}.test.ts`),
        expectedOutput
      );
    });

    it('prepares test for profile, custom path', async () => {
      const ast = parseProfile(new Source(mockProfileSource));

      mocked(loadProfile).mockResolvedValue({
        ast,
        from: { kind: 'remote', version: '1.0.4' },
      });

      mocked(exists).mockResolvedValue(false);
      mocked(mkdir).mockResolvedValue('');

      const writeSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        prepareTest(mockSuperJson, mockProfileId, 'swapi', 'custom/path')
      ).resolves.toBeUndefined();

      expect(writeSpy).toHaveBeenCalledWith(
        joinPath('custom/path', `${provider}.test.ts`),
        expectedOutput
      );
    });

    it('prepares test for profile, custom path and name', async () => {
      const ast = parseProfile(new Source(mockProfileSource));

      mocked(loadProfile).mockResolvedValue({
        ast,
        from: { kind: 'remote', version: '1.0.4' },
      });

      mocked(exists).mockResolvedValue(false);
      mocked(mkdir).mockResolvedValue('');

      const writeSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        prepareTest(
          mockSuperJson,
          mockProfileId,
          'swapi',
          'custom/path',
          'custom-name.ts'
        )
      ).resolves.toBeUndefined();

      expect(writeSpy).toHaveBeenCalledWith(
        joinPath('custom/path', 'custom-name.ts'),
        expectedOutput
      );
    });
  });
});
