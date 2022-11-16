import type {
  AstMetadata,
  ProfileDocumentNode,
  SuperJsonDocument,
} from '@superfaceai/ast';
import { OnFail } from '@superfaceai/ast';
import type { Result, SDKExecutionError } from '@superfaceai/one-sdk';
import { normalizeSuperJsonDocument, ok } from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import inquirer from 'inquirer';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { fetchProviders, getServicesUrl } from '../common/http';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { PackageManager } from '../common/package-manager';
import { findLocalProfileAst } from './check.utils';
import { initSuperface } from './init';
import { detectSuperJson } from './install';
import { interactiveInstall } from './quickstart';
import { profileExists, providerExists } from './quickstart.utils';

jest.mock('../common/package-manager');
jest.mock('./install');
jest.mock('./configure');
jest.mock('./init');
jest.mock('./check.utils');
jest.mock('./quickstart.utils');
jest.mock('../common/http');
jest.mock('../common/io');
jest.mock('inquirer');

describe('Quickstart logic', () => {
  let logger: MockLogger;
  let pm: PackageManager;
  const userError = createUserError(false);
  let mockLoad = jest.fn();

  beforeEach(() => {
    logger = new MockLogger();
    pm = new PackageManager(logger);
    mockLoad = jest.fn(
      async (): Promise<Result<SuperJsonDocument, SDKExecutionError>> => ok({})
    );
    jest.spyOn(SuperJson, 'loadSuperJson').mockImplementation(mockLoad);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const astMetadata: AstMetadata = {
    sourceChecksum: 'check',
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
  };

  const mockProfileAst: ProfileDocumentNode = {
    kind: 'ProfileDocument',
    astMetadata,
    header: {
      kind: 'ProfileHeader',
      scope: 'communication',
      name: 'send-email',
      version: { major: 1, minor: 1, patch: 0 },
      location: {
        start: { line: 1, column: 1, charIndex: 0 },
        end: { line: 1, column: 1, charIndex: 0 },
      },
      documentation: {
        title: 'Send Email',
        description: 'Send one transactional email',
      },
    },
    definitions: [
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        documentation: {
          title: 'Send transactional email to one recipient',
          description: 'Email can contain text and/or html representation',
        },
      },
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendTemplatedEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        documentation: {
          title: 'Send templated transactional email to one recipient',
          description: 'Requires template defined on provider side.',
        },
      },
      {
        kind: 'NamedModelDefinition',
        modelName: 'Error',
      },
    ],
    location: {
      start: { line: 1, column: 1, charIndex: 0 },
      end: { line: 1, column: 1, charIndex: 0 },
    },
  };

  describe('when installing sdk', () => {
    const profile = {
      scope: 'communication',
      profile: 'send-email',
      version: '1.0.1',
    };

    const mockSuperJson = {
      profiles: {
        [`${profile.scope}/${profile.profile}`]: {
          version: profile.version,
          providers: {
            mailchimp: {},
            sendgrid: {},
            mock: {},
            mailgun: {},
          },
        },
      },
      providers: {
        sendgrid: {
          security: [
            {
              id: 'bearer_token',
              token: '$SENDGRID_TOKEN',
            },
          ],
        },
        mailgun: {
          security: [
            {
              id: 'basic',
              username: '$MAILGUN_USERNAME',
              password: '$MAILGUN_PASSWORD',
            },
          ],
        },
        test: {
          security: [
            {
              id: 'digest',
              username: '$DIGEST_USERNAME',
              password: '$DIGEST_PASSWORD',
            },
            {
              id: 'apikey',
              apikey: '$TEST_API_KEY',
            },
          ],
        },
        mock: {
          security: [],
        },
      },
    };

    it('sets up sf correctly - non existing super.json and .env', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      jest.mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      jest.mocked(findLocalProfileAst).mockResolvedValue({
        ast: mockProfileAst,
        path: 'mockpath',
      });
      jest.mocked(getServicesUrl).mockReturnValue('https://superface.ai/');
      // We re-load superjson after initial install (profile and providers)
      mockLoad.mockResolvedValue(
        ok({
          profiles: {
            [`${profile.scope}/${profile.profile}`]: {
              version: profile.version,
              providers: {
                sendgrid: {},
                mailgun: {},
                test: {},
              },
            },
          },
          providers: {
            sendgrid: {
              security: [
                {
                  id: 'bearer_token',
                  token: '$SENDGRID_TOKEN',
                },
              ],
            },
            test: {
              security: [
                {
                  id: 'digest',
                  username: '$DIGEST_USERNAME',
                  password: '$DIGEST_PASSWORD',
                },
                {
                  id: 'apikey',
                  apikey: '$TEST_API_KEY',
                },
              ],
            },
            mailgun: {
              security: [
                {
                  id: 'basic',
                  username: '$MAILGUN_USERNAME',
                  password: '$MAILGUN_PASSWORD',
                },
              ],
            },
          },
        })
      );

      jest.mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      jest.mocked(exists).mockResolvedValue(false);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        // Select providers priority
        .mockResolvedValueOnce({
          provider: { name: 'sendgrid', priority: 1, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'mailgun', priority: 2, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'test', priority: 3, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: undefined, priority: undefined, exit: true },
        })
        // Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        // Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        // Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        // Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        // Select retry policy for test
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Set circuit breaker defauts
        .mockResolvedValueOnce({ continue: true })
        .mockResolvedValueOnce({ maxContiguousRetries: 5 })
        .mockResolvedValueOnce({ requestTimeout: 30_000 })
        .mockResolvedValueOnce({ start: 1000 })
        .mockResolvedValueOnce({ factor: 2 })
        // Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        // Select security schema
        .mockResolvedValueOnce({
          schema: normalizeSuperJsonDocument(mockSuperJson).providers['test']
            .security[0],
        })
        // Set digest
        .mockResolvedValueOnce({ value: 'testDigestUsername' })
        .mockResolvedValueOnce({ value: 'testDigestPassword' })
        // Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        // Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        // Init PM
        .mockResolvedValueOnce({ pm: 'yarn' })
        // Install dotenv
        .mockResolvedValueOnce({ continue: true })
        // Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logger,
        pm,
        userError,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();

      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SENDGRID_TOKEN=sendgridBearer\nDIGEST_USERNAME=testDigestUsername\nDIGEST_PASSWORD=testDigestPassword\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(logger.stdout).toContainEqual(['initSuperface', []]);
      expect(logger.stdout).toContainEqual(['installMultipleProviders', []]);
      expect(logger.stdout).toContainEqual([
        'configureMultipleProviderSecurity',
        [],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['sendgrid'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['mailgun'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['test'],
      ]);
      expect(logger.stdout).toContainEqual([
        'installPackage',
        ['@superfaceai/one-sdk'],
      ]);
      expect(logger.stdout).toContainEqual(['superfaceConfigureSuccess', []]);
      expect(logger.stdout).toContainEqual([
        'capabilityDocsUrl',
        [`https://superface.ai/${profile.scope}/${profile.profile}`],
      ]);
    });

    it('sets up sf correctly - non existing super.json and existing .env', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      jest.mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      jest.mocked(findLocalProfileAst).mockResolvedValue({
        ast: mockProfileAst,
        path: 'mockpath',
      });
      jest.mocked(getServicesUrl).mockReturnValue('https://superface.ai/');
      mockLoad.mockResolvedValue(
        ok({
          profiles: {
            [`${profile.scope}/${profile.profile}`]: {
              version: profile.version,
              providers: {
                sendgrid: {},
                mailgun: {},
                test: {},
              },
            },
          },
          providers: {
            sendgrid: {
              security: [
                {
                  id: 'bearer_token',
                  token: '$SENDGRID_TOKEN',
                },
              ],
            },
            test: {
              security: [
                {
                  id: 'digest',
                  username: '$DIGEST_USERNAME',
                  password: '$DIGEST_PASSWORD',
                },
                {
                  id: 'apikey',
                  apikey: '$TEST_API_KEY',
                },
              ],
            },
            mailgun: {
              security: [
                {
                  id: 'basic',
                  username: '$MAILGUN_USERNAME',
                  password: '$MAILGUN_PASSWORD',
                },
              ],
            },
          },
        })
      );
      jest.mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValue('SOME=env\n');
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        // Select providers priority
        .mockResolvedValueOnce({
          provider: { name: 'sendgrid', priority: 1, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'mailgun', priority: 2, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'test', priority: 3, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: undefined, priority: undefined, exit: true },
        })
        // Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        // Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        // Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        // Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        // Select retry policy for test
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Set circuit breaker defauts
        .mockResolvedValueOnce({ continue: true })
        .mockResolvedValueOnce({ maxContiguousRetries: 5 })
        .mockResolvedValueOnce({ requestTimeout: 30_000 })
        .mockResolvedValueOnce({ start: 1000 })
        .mockResolvedValueOnce({ factor: 2 })
        // Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        // Select security schema
        .mockResolvedValueOnce({
          schema: normalizeSuperJsonDocument(mockSuperJson).providers['test']
            .security[1],
        })
        // Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' })
        // Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        // Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        // Init PM
        .mockResolvedValueOnce({ pm: 'npm' })
        // Install dotenv
        .mockResolvedValueOnce({ continue: true })
        // Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(
        `${profile.scope}/${profile.profile}@${profile.version}`,
        { logger, pm, userError }
      );

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SOME=env\nSENDGRID_TOKEN=sendgridBearer\nTEST_API_KEY=testApiKey\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(logger.stdout).toContainEqual(['initSuperface', []]);
      expect(logger.stdout).toContainEqual(['installMultipleProviders', []]);
      expect(logger.stdout).toContainEqual([
        'configureMultipleProviderSecurity',
        [],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['sendgrid'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['mailgun'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['test'],
      ]);
      expect(logger.stdout).toContainEqual([
        'installPackage',
        ['@superfaceai/one-sdk'],
      ]);
      expect(logger.stdout).toContainEqual(['superfaceConfigureSuccess', []]);
      expect(logger.stdout).toContainEqual([
        'capabilityDocsUrl',
        [`https://superface.ai/${profile.scope}/${profile.profile}`],
      ]);
    });

    it('sets up sf correctly - misconfigured super.json', async () => {
      const mockMisconfiguredSuperJson = {
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            providers: {
              test: {},
              mock: {},
              sendgrid: {},
              mailgun: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [
              {
                id: 'bearer_token',
                // Misconfigured
                token: 'SENDGRID_TOKEN',
              },
            ],
          },
          mailgun: {
            security: [
              {
                id: 'basic',
                username: '$MAILGUN_USERNAME',
                password: '$MAILGUN_PASSWORD',
              },
            ],
          },
          test: {
            security: [
              {
                id: 'digest',
                username: '$DIGEST_USERNAME',
                password: '$DIGEST_PASSWORD',
              },
              {
                id: 'apikey',
                apikey: '$TEST_API_KEY',
              },
            ],
          },
          mock: {
            security: [],
          },
        },
      };

      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      jest.mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      jest.mocked(findLocalProfileAst).mockResolvedValue({
        ast: mockProfileAst,
        path: 'mockpath',
      });
      jest.mocked(getServicesUrl).mockReturnValue('https://superface.ai/');
      mockLoad.mockResolvedValue(ok(mockMisconfiguredSuperJson));
      jest.mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValue('TEST_API_KEY=env\n');
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        // Select providers priority
        .mockResolvedValueOnce({
          provider: { name: 'sendgrid', priority: 1, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'mailgun', priority: 2, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: undefined, priority: undefined, exit: true },
        })
        // Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        // Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        // Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        // Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        // Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        // Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        // Init PM
        .mockResolvedValueOnce({ pm: 'yarn' })
        // Install dotenv
        .mockResolvedValueOnce({ continue: true })
        // Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logger,
        pm,
        userError,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringMatching('super.json'),
        JSON.stringify(mockMisconfiguredSuperJson, undefined, 2),
        { force: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=env\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(logger.stdout).toContainEqual(['initSuperface', []]);
      expect(logger.stdout).toContainEqual(['installMultipleProviders', []]);
      expect(logger.stdout).toContainEqual([
        'configureMultipleProviderSecurity',
        [],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['sendgrid'],
      ]);
      expect(logger.stdout).toContainEqual([
        'unexpectedSecurityValue',
        ['SENDGRID_TOKEN', 'sendgrid', 'bearer'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['mailgun'],
      ]);
      expect(logger.stdout).toContainEqual([
        'installPackage',
        ['@superfaceai/one-sdk'],
      ]);
      expect(logger.stdout).toContainEqual(['superfaceConfigureSuccess', []]);
    });

    it('sets up sf correctly - existing super.json and existing .env', async () => {
      const mockEnv =
        'test=test\nMAILGUN_USERNAME=u\nMAILGUN_PASSWORD=p\nSENDGRID_TOKEN=t\ntest2=test2\n';
      // Super.json affter install
      const mockSuperJson = {
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: '1.0.1',
            providers: {
              mailgun: {},
              mock: {},
              test: {},
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [
              {
                id: 'bearer_token',
                token: '$SENDGRID_TOKEN',
              },
            ],
          },
          mailgun: {
            security: [
              {
                id: 'basic',
                username: '$MAILGUN_USERNAME',
                password: '$MAILGUN_PASSWORD',
              },
            ],
          },
          test: {
            security: [
              {
                id: 'digest',
                username: '$DIGEST_USERNAME',
                password: '$DIGEST_PASSWORD',
              },
              {
                id: 'apikey',
                apikey: '$TEST_API_KEY',
              },
            ],
          },
          mock: {
            security: [],
          },
        },
      };
      jest.mocked(detectSuperJson).mockResolvedValue('some/path');
      jest.mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      mockLoad.mockResolvedValue(ok(mockSuperJson));
      jest.mocked(profileExists).mockResolvedValueOnce(true);
      jest.mocked(providerExists).mockReturnValue(true);
      jest.mocked(findLocalProfileAst).mockResolvedValue({
        ast: mockProfileAst,
        path: 'mockpath',
      });
      jest.mocked(getServicesUrl).mockReturnValue('https://superface.ai/');
      jest.mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      // Env
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValueOnce(mockEnv);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        // Override profile
        .mockResolvedValueOnce({ continue: true })
        // Select providers priority
        .mockResolvedValueOnce({
          provider: { name: 'sendgrid', priority: 1, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'mailgun', priority: 2, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'test', priority: 3, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: undefined, priority: undefined, exit: true },
        })
        // Do NOT override first provider
        .mockResolvedValueOnce({ continue: false })
        // Override second provider
        .mockResolvedValueOnce({ continue: true })
        // Override third provider
        .mockResolvedValueOnce({ continue: true })
        // Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        // Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        // Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        // Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        // Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })

        // Override first env
        .mockResolvedValueOnce({ continue: true })
        // Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        // Override second env
        .mockResolvedValueOnce({ continue: true })
        // Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        // Select security schema
        .mockResolvedValueOnce({
          schema: normalizeSuperJsonDocument(mockSuperJson).providers['test']
            .security[0],
        })
        // Set test digest
        .mockResolvedValueOnce({ value: 'testDigestUsername' })
        .mockResolvedValueOnce({ value: 'testDigestPassword' })
        // Init PM
        .mockResolvedValueOnce({ pm: 'npm' })
        // Install dotenv
        .mockResolvedValueOnce({ continue: true })
        // Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });
      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logger,
        pm,
        userError,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).not.toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();

      expect(writeOnceSpy).toHaveBeenCalledWith(
        expect.stringMatching('super.json'),
        JSON.stringify(mockSuperJson, undefined, 2),
        {
          force: true,
        }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'test=test\nSENDGRID_TOKEN=t\ntest2=test2\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nDIGEST_USERNAME=testDigestUsername\nDIGEST_PASSWORD=testDigestPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(logger.stdout).toContainEqual(['installMultipleProviders', []]);
      expect(logger.stdout).toContainEqual([
        'configureMultipleProviderSecurity',
        [],
      ]);
      // User dont want to override sendgrid
      expect(logger.stdout).not.toContain([
        'configureProviderSecurity',
        ['sendgrid'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['mailgun'],
      ]);
      expect(logger.stdout).toContainEqual([
        'configureProviderSecurity',
        ['test'],
      ]);
      expect(logger.stdout).toContainEqual([
        'installPackage',
        ['@superfaceai/one-sdk'],
      ]);
      expect(logger.stdout).toContainEqual(['superfaceConfigureSuccess', []]);
      expect(logger.stdout).toContainEqual([
        'capabilityDocsUrl',
        [`https://superface.ai/${profile.scope}/${profile.profile}`],
      ]);
    });
  });
});
