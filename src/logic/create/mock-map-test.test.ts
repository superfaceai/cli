import { MockLogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { ProfileId } from '../../common/profile';
import { mockProfileDocumentNode } from '../../test/profile-document-node';
import { loadProfile } from '../publish.utils';
import { createMockMapTest } from './mock-map-test';

jest.mock('../publish.utils', () => ({
  loadProfile: jest.fn(),
}));

describe('Prepare mock map test logic', () => {
  let logger: MockLogger;
  const profileId = ProfileId.fromScopeName('test', 'profile');
  const profilePath = 'profilePath';

  const mockProfile = mockProfileDocumentNode({
    name: profileId.name,
    scope: profileId.scope,
  });
  const mockSuperJson = {
    profiles: {
      [profileId.id]: {
        file: profilePath,
      },
    },
  };

  const superJsonPath = 'path/to/super.json';

  const writeOnceSpy = jest.spyOn(OutputStream, 'writeOnce');

  beforeEach(() => {
    writeOnceSpy.mockResolvedValue(undefined);

    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Writes prepared test to file', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createMockMapTest(
      {
        profile: profileId,
        superJson: mockSuperJson,
        superJsonPath,
      },
      {
        logger,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.mock.test.ts`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
  });

  it('Writes prepared test to file with force flag', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createMockMapTest(
      {
        profile: profileId,
        superJson: mockSuperJson,
        superJsonPath,
        options: {
          force: true,
        },
      },
      {
        logger,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.mock.test.ts`,
      expect.any(String),
      { dirs: true, force: true }
    );
  });

  it('Writes prepared test to file with station flag', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createMockMapTest(
      {
        profile: profileId,
        superJson: mockSuperJson,
        superJsonPath,
        options: {
          station: true,
        },
      },
      {
        logger,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `grid/${profileId.toString()}/maps/mock.test.ts`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
  });
});
