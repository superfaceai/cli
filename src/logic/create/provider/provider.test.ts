import type { SuperJsonDocument } from '@superfaceai/ast';
import { ServiceApiError } from '@superfaceai/service-client';
import inquirer from 'inquirer';

import { MockLogger, UNVERIFIED_PROVIDER_PREFIX } from '../../../common';
import { createUserError } from '../../../common/error';
import { fetchProviderInfo } from '../../../common/http';
import { OutputStream } from '../../../common/output-stream';
import { mockProviderJson } from '../../../test/provider-json';
import { selecetBaseUrl } from './base-url';
import { selectIntegrationParameters } from './parameters';
import { createProvider } from './provider';
import { selectSecurity } from './security';

jest.mock('inquirer');

jest.mock('../../../common/http', () => ({
  fetchProviderInfo: jest.fn(),
}));

jest.mock('./security', () => ({
  selectSecurity: jest.fn(),
}));

jest.mock('./base-url', () => ({
  selecetBaseUrl: jest.fn(),
}));

jest.mock('./parameters', () => ({
  selectIntegrationParameters: jest.fn(),
}));

describe('Prepare map logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  const provider = 'provider';
  const unverfiedProvider = `${UNVERIFIED_PROVIDER_PREFIX}provider`;

  const superJsonPath = 'path/to/super.json';
  const writeIfAbsentSpy = jest.spyOn(OutputStream, 'writeIfAbsent');
  const writeOnceSpy = jest.spyOn(OutputStream, 'writeOnce');

  let mockSuperJson: SuperJsonDocument;

  beforeEach(() => {
    logger = new MockLogger();
    mockSuperJson = {
      profiles: {},
      providers: {},
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('warns user when provider is already defined in super.json', async () => {
    await createProvider(
      {
        provider,
        superJson: {
          providers: {
            [provider]: {},
          },
        },
        superJsonPath,
      },
      {
        logger,
        userError,
      }
    );

    expect(logger.stdout).toContainEqual(['providerAlreadyExists', [provider]]);
  });

  describe('when provider does not have unverfied prefix', () => {
    describe('when provider exists in registry', () => {
      it('updates only super.json when user uses remote provider', async () => {
        jest
          .mocked(fetchProviderInfo)
          .mockResolvedValue(mockProviderJson({ name: provider }));

        jest
          .spyOn(inquirer, 'prompt')
          .mockResolvedValueOnce({ continue: true });

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider,
            superJson: mockSuperJson,
            superJsonPath,
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).not.toHaveBeenCalled();
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });
    });

    describe('when provider does not exist in registry', () => {
      it('throws on unknown fetch error', async () => {
        const error = new ServiceApiError({
          status: 400,
          instance: 'test',
          title: 'test',
          detail: 'test',
        });
        jest.mocked(fetchProviderInfo).mockRejectedValue(error);

        await expect(
          createProvider(
            {
              provider,
              superJson: mockSuperJson,
              superJsonPath,
            },
            {
              logger,
              userError,
            }
          )
        ).rejects.toThrow(
          `Error when fetching provider info: ${String(error)}`
        );
      });

      it('writes prepared provider to file with --station flag', async () => {
        jest.mocked(fetchProviderInfo).mockRejectedValue(
          new ServiceApiError({
            status: 404,
            instance: 'test',
            title: 'test',
            detail: 'test',
          })
        );

        jest
          .spyOn(inquirer, 'prompt')
          .mockResolvedValueOnce({ continue: false });

        jest.mocked(selecetBaseUrl).mockResolvedValue('https://swapi.dev/api');
        jest
          .mocked(selectIntegrationParameters)
          .mockResolvedValue({ parameters: [], values: {} });
        jest.mocked(selectSecurity).mockResolvedValue({});

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider,
            superJson: mockSuperJson,
            superJsonPath,
            options: {
              station: true,
            },
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).toBeCalledWith(
          `providers/${provider}.json`,
          expect.any(String),
          { dirs: true, force: undefined }
        );
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });
    });
  });

  describe('when provider has unverfied prefix', () => {
    describe('when provider exists in registry', () => {
      it('updates only super.json when user uses remote provider', async () => {
        jest
          .mocked(fetchProviderInfo)
          .mockResolvedValue(mockProviderJson({ name: unverfiedProvider }));

        jest
          .spyOn(inquirer, 'prompt')
          .mockResolvedValueOnce({ continue: true });

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider,
            superJson: mockSuperJson,
            superJsonPath,
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).not.toHaveBeenCalled();
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });
    });

    describe('when provider does not exist in registry', () => {
      it('writes prepared provider to file', async () => {
        jest.mocked(fetchProviderInfo).mockRejectedValue(
          new ServiceApiError({
            status: 404,
            instance: 'test',
            title: 'test',
            detail: 'test',
          })
        );

        jest.mocked(selecetBaseUrl).mockResolvedValue('https://swapi.dev/api');
        jest
          .mocked(selectIntegrationParameters)
          .mockResolvedValue({ parameters: [], values: {} });
        jest.mocked(selectSecurity).mockResolvedValue({});

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider: unverfiedProvider,
            superJson: mockSuperJson,
            superJsonPath,
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).toBeCalledWith(
          `${unverfiedProvider}.provider.json`,
          expect.any(String),
          { dirs: true, force: undefined }
        );
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });

      it('writes prepared provider to file with station flag', async () => {
        jest.mocked(selecetBaseUrl).mockResolvedValue('https://swapi.dev/api');
        jest
          .mocked(selectIntegrationParameters)
          .mockResolvedValue({ parameters: [], values: {} });
        jest.mocked(selectSecurity).mockResolvedValue({});

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider: unverfiedProvider,
            superJson: mockSuperJson,
            superJsonPath,
            options: {
              station: true,
            },
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).toBeCalledWith(
          `providers/${unverfiedProvider}.json`,
          expect.any(String),
          { dirs: true, force: undefined }
        );
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });

      it('overwrites existing provider with force flag', async () => {
        jest.mocked(selecetBaseUrl).mockResolvedValue('https://swapi.dev/api');
        jest
          .mocked(selectIntegrationParameters)
          .mockResolvedValue({ parameters: [], values: {} });
        jest.mocked(selectSecurity).mockResolvedValue({});

        writeIfAbsentSpy.mockResolvedValue(true);
        writeOnceSpy.mockResolvedValue(undefined);

        await createProvider(
          {
            provider: unverfiedProvider,
            superJson: {
              providers: {
                [unverfiedProvider]: {},
              },
            },
            superJsonPath,
            options: {
              station: true,
              force: true,
            },
          },
          {
            logger,
            userError,
          }
        );

        expect(writeIfAbsentSpy).toBeCalledWith(
          `providers/${unverfiedProvider}.json`,
          expect.any(String),
          { dirs: true, force: true }
        );
        expect(writeOnceSpy).toBeCalledWith(superJsonPath, expect.any(String));
      });
    });
  });
});
