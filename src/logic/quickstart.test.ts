import { ProfileDocumentNode } from '@superfaceai/ast';
import { ok, OnFail, SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { fetchProfiles, fetchProviders, getStoreUrl } from '../common/http';
import { detectSuperJson, exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { initSuperface } from './init';
import { interactiveInstall } from './quickstart';
import {
  loadProfileAst,
  profileExists,
  providerExists,
} from './quickstart.utils';

//Mock package manager
jest.mock('../common/package-manager');

//Mock install logic
jest.mock('./install');

//Mock configure logic
jest.mock('./configure');

//Mock init logic
jest.mock('./init');

//Mock quickstart logic
jest.mock('./quickstart.utils');

//Mock http
jest.mock('../common/http');

//Mock IO
jest.mock('../common/io');

//Mock inquirer
jest.mock('inquirer');

describe('Quickstart logic', () => {
  const logCb = jest.fn();
  const warnCb = jest.fn();
  const successCb = jest.fn();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalLoad = SuperJson.load;
  let mockLoad = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mockLoad = jest.fn();
    SuperJson.load = mockLoad;
  });
  afterAll(() => {
    SuperJson.load = originalLoad;
  });

  const mockProfileAst: ProfileDocumentNode = {
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      scope: 'communication',
      name: 'send-email',
      version: { major: 1, minor: 1, patch: 0 },
      location: { line: 1, column: 1 },
      span: { start: 0, end: 100 },
      title: 'Send Email',
      description: 'Send one transactional email',
    },
    definitions: [
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        title: 'Send transactional email to one recipient',
        description: 'Email can contain text and/or html representation',
      },
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendTemplatedEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        title: 'Send templated transactional email to one recipient',
        description: 'Requires template defined on provider side.',
      },
      {
        kind: 'NamedModelDefinition',
        modelName: 'Error',
      },
    ],
    location: { line: 1, column: 1 },
    span: { start: 0, end: 775 },
  };
  describe('when installing sdk', () => {
    const profile = {
      scope: 'communication',
      profile: 'send-email',
      version: '1.0.1',
    };
    const mockSuperJson = new SuperJson({
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
              digest: '$TEST_DIGEST',
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
    });

    it('sets up sf correctly - non existing super.json and .env', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(loadProfileAst).mockResolvedValue(mockProfileAst);
      mocked(getStoreUrl).mockReturnValue('https://superface.ai/');
      //We re-load superjson after initial install (profile and providers)
      mockLoad.mockResolvedValue(
        ok(
          new SuperJson({
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
                    digest: '$TEST_DIGEST',
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
        )
      );

      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      mocked(exists).mockResolvedValue(false);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        //Select providers priority
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
        //Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        //Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        //Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        //Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        //Select retry policy for test
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Set circuit breaker defauts
        .mockResolvedValueOnce({ continue: true })
        .mockResolvedValueOnce({ maxContiguousRetries: 5 })
        .mockResolvedValueOnce({ requestTimeout: 30_000 })
        .mockResolvedValueOnce({ start: 1000 })
        .mockResolvedValueOnce({ factor: 2 })
        //Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockSuperJson.normalized.providers['test'].security[0],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testDigest' })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Init PM
        .mockResolvedValueOnce({ pm: 'yarn' })
        //Install dotenv
        .mockResolvedValueOnce({ continue: true })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logCb,
        warnCb,
        successCb,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).not.toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();

      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SENDGRID_TOKEN=sendgridBearer\nTEST_DIGEST=testDigest\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "sendgrid" security');
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        `\nNow you can follow our documentation to use installed capability: "https://superface.ai/${profile.scope}/${profile.profile}"`
      );
    });

    it('sets up sf correctly - non existing super.json and existing .env', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(loadProfileAst).mockResolvedValue(mockProfileAst);
      mocked(getStoreUrl).mockReturnValue('https://superface.ai/');
      mockLoad.mockResolvedValue(
        ok(
          new SuperJson({
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
                    digest: '$TEST_DIGEST',
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
        )
      );
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue('SOME=env\n');
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        //Select providers priority
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
        //Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        //Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        //Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        //Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        //Select retry policy for test
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Set circuit breaker defauts
        .mockResolvedValueOnce({ continue: true })
        .mockResolvedValueOnce({ maxContiguousRetries: 5 })
        .mockResolvedValueOnce({ requestTimeout: 30_000 })
        .mockResolvedValueOnce({ start: 1000 })
        .mockResolvedValueOnce({ factor: 2 })
        //Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockSuperJson.normalized.providers['test'].security[1],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Init PM
        .mockResolvedValueOnce({ pm: 'npm' })
        //Install dotenv
        .mockResolvedValueOnce({ continue: true })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(
        `${profile.scope}/${profile.profile}@${profile.version}`,
        { logCb, warnCb, successCb }
      );

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).not.toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SOME=env\nSENDGRID_TOKEN=sendgridBearer\nTEST_API_KEY=testApiKey\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "sendgrid" security');
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        `\nNow you can follow our documentation to use installed capability: "https://superface.ai/${profile.scope}/${profile.profile}"`
      );
    });

    it('sets up sf correctly - misconfigured super.json', async () => {
      const mockMisconfiguredSuperJson = new SuperJson({
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
                //Misconfigured
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
                digest: '$TEST_DIGEST',
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
      });

      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(loadProfileAst).mockResolvedValue(mockProfileAst);
      mocked(getStoreUrl).mockReturnValue('https://superface.ai/');
      mockLoad.mockResolvedValue(ok(mockMisconfiguredSuperJson));
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue('TEST_API_KEY=env\n');
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        //Select providers priority
        .mockResolvedValueOnce({
          provider: { name: 'sendgrid', priority: 1, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: 'mailgun', priority: 2, exit: false },
        })
        .mockResolvedValueOnce({
          provider: { name: undefined, priority: undefined, exit: true },
        })
        //Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        //Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        //Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        //Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Init PM
        .mockResolvedValueOnce({ pm: 'yarn' })
        //Install dotenv
        .mockResolvedValueOnce({ continue: true })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logCb,
        warnCb,
        successCb,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).not.toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        mockMisconfiguredSuperJson.stringified,
        { force: true }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=env\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "sendgrid" security');
      expect(warnCb).toHaveBeenCalledWith(
        'Value of SENDGRID_TOKEN in "sendgrid" "bearer" security schema does not start with $ character.'
      );
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "mailgun" security');
      expect(successCb).toHaveBeenCalledWith(
        '\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n🆗 Superface have been configured successfully!'
      );
    });

    it('sets up sf correctly - existing super.json and existing .env', async () => {
      const mockEnv = `test=test\nMAILGUN_USERNAME=u\nMAILGUN_PASSWORD=p\nSENDGRID_TOKEN=t\ntest2=test2\n`;
      //Super.json affter install
      const mockSuperJson = new SuperJson({
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
                digest: '$TEST_DIGEST',
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
      });
      mocked(detectSuperJson).mockResolvedValue('some/path');
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mockLoad.mockResolvedValue(ok(mockSuperJson));
      mocked(profileExists).mockResolvedValueOnce(true);
      mocked(providerExists).mockReturnValue(true);
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(loadProfileAst).mockResolvedValue(mockProfileAst);
      mocked(getStoreUrl).mockReturnValue('https://superface.ai/');
      mocked(fetchProviders).mockResolvedValue([
        { name: 'sendgrid', services: [], defaultService: '' },
        { name: 'mailgun', services: [], defaultService: '' },
        { name: 'mailchimp', services: [], defaultService: '' },
        { name: 'mock', services: [], defaultService: '' },
        { name: 'test', services: [], defaultService: '' },
      ]);
      //Env
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValueOnce(mockEnv);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        //Override profile
        .mockResolvedValueOnce({ continue: true })
        //Select providers priority
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
        //Do NOT override first provider
        .mockResolvedValueOnce({ continue: false })
        //Override second provider
        .mockResolvedValueOnce({ continue: true })
        //Override third provider
        .mockResolvedValueOnce({ continue: true })
        //Select usecase
        .mockResolvedValueOnce({
          useCase: 'SendEmail',
        })
        //Confirm provider failover
        .mockResolvedValueOnce({ continue: true })
        //Select retry policy for mailgun
        .mockResolvedValueOnce({ policy: OnFail.NONE })
        //Select retry policy for sendgrid
        .mockResolvedValueOnce({ policy: OnFail.CIRCUIT_BREAKER })
        //Use circuit breaker defauts
        .mockResolvedValueOnce({ continue: false })

        //Override first env
        .mockResolvedValueOnce({ continue: true })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Override second env
        .mockResolvedValueOnce({ continue: true })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockSuperJson.normalized.providers['test'].security[0],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testDigest' })
        //Init PM
        .mockResolvedValueOnce({ pm: 'npm' })
        //Install dotenv
        .mockResolvedValueOnce({ continue: true })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });
      await interactiveInstall(`${profile.scope}/${profile.profile}`, {
        logCb,
        warnCb,
        successCb,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).not.toHaveBeenCalled();
      expect(fetchProfiles).not.toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();

      expect(writeOnceSpy).toHaveBeenCalledWith('', mockSuperJson.stringified, {
        force: true,
      });
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'test=test\nSENDGRID_TOKEN=t\ntest2=test2\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_DIGEST=testDigest\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith('\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\nConfiguring providers security'
      );
      //User dont want to override sendgrid
      expect(logCb).not.toHaveBeenCalledWith(
        '\nConfiguring "sendgrid" security'
      );
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        `\nNow you can follow our documentation to use installed capability: "https://superface.ai/${profile.scope}/${profile.profile}"`
      );
    });
  });
});
