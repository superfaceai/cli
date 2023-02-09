import { EXTENSIONS } from '@superfaceai/ast';

import { getProfileFile, getProviderFile, MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { readFile } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import { ProfileId } from '../../common/profile';
import { mockProfileDocumentNode } from '../../test/profile-document-node';
import { mockProviderJson } from '../../test/provider-json';
import { createMap } from './map';
import { loadProfileAst } from './utils';

jest.mock('../../common/io', () => ({
  ...jest.requireActual('../../common/io'),
  readFile: jest.fn(),
}));

jest.mock('./utils', () => ({
  loadProfileAst: jest.fn(),
}));

jest.mock('../../common/super-json-utils', () => ({
  getProfileFile: jest.fn(),
  getProviderFile: jest.fn(),
}));

describe('Create map logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const profileId = ProfileId.fromScopeName('test', 'profile');
  const profilePath = 'profilePath';

  const provider = 'provider';
  const providerPath = 'providerPath';

  const mockProfile = mockProfileDocumentNode({
    name: profileId.name,
    scope: profileId.scope,
  });
  const mockSuperJson = {
    profiles: {
      [profileId.id]: {
        file: profilePath,
        providers: {
          [provider]: {},
        },
      },
    },
    providers: {
      [provider]: {},
    },
  };

  const superJsonPath = 'path/to/super.json';
  const mockProvider = mockProviderJson({ name: provider });

  const writeOnceSpy = jest.spyOn(OutputStream, 'writeOnce');

  beforeEach(() => {
    writeOnceSpy.mockResolvedValue(undefined);

    jest.mocked(getProfileFile).mockResolvedValue(profilePath);
    jest.mocked(getProviderFile).mockResolvedValue(providerPath);

    jest.mocked(loadProfileAst).mockResolvedValue(mockProfile);
    jest.mocked(readFile).mockResolvedValue(JSON.stringify(mockProvider));

    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Writes created map to file', async () => {
    await createMap(
      {
        id: {
          profile: profileId,
          provider,
        },
        superJson: mockSuperJson,
        superJsonPath,
      },
      {
        logger,
        userError,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.${provider}${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes created map to file with variant', async () => {
    await createMap(
      {
        id: {
          profile: profileId,
          provider,
          variant: 'test',
        },
        superJson: mockSuperJson,
        superJsonPath,
      },
      {
        logger,
        userError,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.${provider}.test${EXTENSIONS.map.source}`,
      expect.stringContaining('variant = "test"'),
      { dirs: true }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes created map to file with force flag', async () => {
    await createMap(
      {
        id: {
          profile: profileId,
          provider,
        },
        superJson: mockSuperJson,
        superJsonPath,
        options: {
          force: true,
        },
      },
      {
        logger,
        userError,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.${provider}${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: true }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes created map to file with station flag', async () => {
    await createMap(
      {
        id: {
          profile: profileId,
          provider,
        },
        superJson: mockSuperJson,
        superJsonPath,
        options: {
          force: false,
          station: true,
        },
      },
      {
        logger,
        userError,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `grid/${profileId.id}/maps/${provider}${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: false }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });
});
