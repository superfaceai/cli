import { MockLogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { ProfileId } from '../../common/profile';
import { mockProfileDocumentNode } from '../../test/profile-document-node';
import { loadProfile } from '../publish.utils';
import { createTest } from './test';

jest.mock('../publish.utils', () => ({
  loadProfile: jest.fn(),
}));

describe('Create test logic', () => {
  let logger: MockLogger;
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

    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Writes created test to file', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createTest(
      {
        profile: profileId,
        provider,
        superJson: mockSuperJson,
        superJsonPath,
      },
      {
        logger,
      }
    );

    expect(writeOnceSpy).toBeCalledWith(
      `${profileId.toString()}.${provider}.test.ts`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
  });

  it('Writes created test to file with force flag', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createTest(
      {
        profile: profileId,
        provider,
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
      `${profileId.toString()}.${provider}.test.ts`,
      expect.any(String),
      { dirs: true, force: true }
    );
  });

  it('Writes created test to file with station flag', async () => {
    jest.mocked(loadProfile).mockResolvedValue({
      ast: mockProfile,
      from: { kind: 'local', path: '', source: '' },
    });

    await createTest(
      {
        profile: profileId,
        provider,
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
      `grid/${profileId.toString()}/maps/${provider}.test.ts`,
      expect.any(String),
      { dirs: true, force: undefined }
    );
  });
});
