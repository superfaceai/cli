import { EXTENSIONS } from '@superfaceai/ast';

import { getProfileFile, MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { OutputStream } from '../../common/output-stream';
import { ProfileId } from '../../common/profile';
import { mockProfileDocumentNode } from '../../test/profile-document-node';
import { prepareMockMap } from './mock-map';
import { loadProfileAst } from './utils';

jest.mock('./utils', () => ({
  loadProfileAst: jest.fn(),
}));

jest.mock('../../common/super-json-utils', () => ({
  getProfileFile: jest.fn(),
}));

describe('Prepare mock map logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const profileId = ProfileId.fromScopeName('test', 'profile');
  const profilePath = 'profilePath';

  const provider = 'provider';

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

  const writeOnceSpy = jest.spyOn(OutputStream, 'writeOnce');

  beforeEach(() => {
    writeOnceSpy.mockResolvedValue(undefined);

    jest.mocked(getProfileFile).mockResolvedValue(profilePath);
    jest.mocked(loadProfileAst).mockResolvedValue(mockProfile);

    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Writes prepared mock map to file', async () => {
    await prepareMockMap(
      {
        id: {
          profile: profileId,
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
      `${profileId.toString()}.mock${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes prepared mock map to file with provider name', async () => {
    await prepareMockMap(
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
      { dirs: true }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes prepared mock map to file with force flag', async () => {
    await prepareMockMap(
      {
        id: {
          profile: profileId,
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
      `${profileId.toString()}.mock${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: true }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });

  it('Writes prepared mock map to file with station flag', async () => {
    await prepareMockMap(
      {
        id: {
          profile: profileId,
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
      `grid/${profileId.id}/maps/mock${EXTENSIONS.map.source}`,
      expect.any(String),
      { dirs: true, force: false }
    );
    expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
  });
});
