import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { ServiceClient } from '@superfaceai/service-client';
import { yellow } from 'chalk';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR } from '../common';
import { fetchProviderInfo, getServicesUrl } from '../common/http';
import { ProfileId } from '../common/profile';
import { ProfileMapReport } from '../common/report.interfaces';
import {
  CheckResult,
  formatHuman as checkFormatHuman,
  formatJson as checkFormatJson,
} from './check';
import { findLocalProviderSource } from './check.utils';
import {
  formatHuman as lintFormatHuman,
  formatJson as lintFormatJson,
} from './lint';
import { publish } from './publish';
import {
  loadMap,
  loadProfile,
  prePublishCheck,
  prePublishLint,
} from './publish.utils';

//Mock service client
jest.mock('@superfaceai/service-client');

//Mock http
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
  getServicesUrl: jest.fn(),
}));

//Mock check utils
jest.mock('./check.utils', () => ({
  findLocalProviderSource: jest.fn(),
}));

//Mock publish utils
jest.mock('./publish.utils', () => ({
  loadMap: jest.fn(),
  loadProfile: jest.fn(),
  prePublishCheck: jest.fn(),
  prePublishLint: jest.fn(),
}));

describe('Publish logic', () => {
  describe('when publishing', () => {
    const mockProfileId = 'starwars/character-information';
    const mockProviderName = 'swapi';

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };
    const mockPath = '/test/path.supr';
    const mockProfileSource = 'profile content';
    const mockMapSource = 'map content';

    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'different-test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };

    const mockProviderSource = {
      name: 'swapi',
      services: [
        {
          id: 'default',
          baseUrl: 'https://swapi.dev/api',
        },
      ],
      defaultService: 'default',
    };

    const checkResult: CheckResult[] = [
      {
        kind: 'error',
        message: 'first-error',
      },
      {
        kind: 'warn',
        message: 'first-warn',
      },
      {
        kind: 'error',
        message: 'second-error',
      },
      {
        kind: 'warn',
        message: 'second-warn',
      },
    ];

    const lintResult: ProfileMapReport = {
      path: mockPath,
      kind: 'compatibility',
      profile: 'test-profile',
      errors: [
        {
          kind: 'wrongScope',
          context: {
            expected: 'this',
            actual: 'that',
          },
        },
      ],
      warnings: [
        {
          kind: 'wrongScope',
          context: {
            expected: 'this',
            actual: 'that',
          },
        },
      ],
    };

    const emptyLintResult: ProfileMapReport = {
      kind: 'compatibility',
      profile: '',
      path: '',
      errors: [],
      warnings: [],
    };

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('publishes profile', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(getServicesUrl).mockReturnValue('')
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        source: mockProfileSource,
      });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'profile',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {}
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        undefined,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with map variant', async () => {
      const variant = 'test';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {
                mapVariant: variant,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        source: mockProfileSource,
      });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'profile',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          { variant }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        { variant },
        undefined,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with remote provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        source: mockProfileSource,
      });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'profile',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {}
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        undefined,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).toHaveBeenCalledWith(mockProviderName);
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish profile with --dry-run', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        source: mockProfileSource,
      });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'profile',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          undefined,
          { dryRun: true }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        { dryRun: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        undefined,
        { dryRun: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing profile and profile not found locally', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        source: undefined,
      });

      await expect(
        publish(
          'profile',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          undefined,
          { dryRun: true }
        )
      ).rejects.toEqual(
        new CLIError(
          `Profile: "${mockProfileId}" not found on local file system`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        { dryRun: true }
      );
    });

    it('publishes map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        source: mockMapSource,
      });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'map',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {}
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        undefined,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        undefined,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with profile version', async () => {
      const version = '1.0.6';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: version,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        source: mockMapSource,
      });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'map',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          version
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        version,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        version,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with remote provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        source: mockMapSource,
      });
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'map',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).toHaveBeenCalledWith(mockProviderName);
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish map with --dry-run', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        source: mockMapSource,
      });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'map',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing map and map not found locally', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });

      await expect(
        publish(
          'map',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).rejects.toEqual(
        new CLIError(
          `Map for profile: "${mockProfileId}" and provider: "${mockProviderName}" not found on local filesystem`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
    });

    it('publishes provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource)
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes provider with map varinat', async () => {
      const variant = 'test';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {
                mapVariant: variant,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          { variant },
          DEFAULT_PROFILE_VERSION_STR
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource)
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        { variant },
        DEFAULT_PROFILE_VERSION_STR,
        undefined
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish provider with --dry-run', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing provider and provider not found locally', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).rejects.toEqual(
        new CLIError(
          `Provider: "${mockProviderName}" not found on local file system`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
    });

    it('does not publish when there are check errors', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).resolves.toEqual(
        yellow('Check results:\n') +
        checkFormatHuman(checkResult) +
        yellow('\n\nLint results:\n') +
        lintFormatHuman(emptyLintResult, false)
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint errors', async () => {
      const checkResult: CheckResult[] = [];
      const lintResult: ProfileMapReport = {
        path: mockPath,
        kind: 'compatibility',
        profile: 'test-profile',
        errors: [
          {
            kind: 'wrongScope',
            context: {
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true }
        )
      ).resolves.toEqual(
        yellow('Check results:\n') +
        checkFormatHuman(checkResult) +
        yellow('\n\nLint results:\n') +
        lintFormatHuman(lintResult, false)
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint and check errors and json flag', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({ ast: mockProfileDocument });
      mocked(loadMap).mockResolvedValue({ ast: mockMapDocument });
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderSource);
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          'provider',
          mockSuperJson,
          ProfileId.fromId(mockProfileId),
          mockProviderName,
          {},
          DEFAULT_PROFILE_VERSION_STR,
          { dryRun: true, json: true }
        )
      ).resolves.toEqual(
        JSON.stringify({
          check: {
            reports: checkFormatJson(checkResult),
            total: {
              errors: 2,
              warnings: 2,
            },
          },
          lint: {
            reports: lintFormatJson(lintResult),
            total: {
              errors: 1,
              warnings: 1,
            },
          },
        })
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true, json: true }
      );
      expect(loadMap).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(mockProfileId),
        mockProviderName,
        {},
        DEFAULT_PROFILE_VERSION_STR,
        { dryRun: true, json: true }
      );
      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument,
        mockProviderSource
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });
  });
});
