import { ok, SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { fetchProfiles, fetchProviders } from '../common/http';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { PackageManager } from '../common/package-manager';
import { initSuperface } from './init';
import { detectSuperJson } from './install';
import { interactiveInstall } from './quickstart';
import { profileExists, providerExists } from './quickstart.utils';

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
      mockLoad.mockResolvedValue(ok(mockSuperJson));
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
        //Select profile
        .mockResolvedValueOnce({ profile })
        //Select providers
        .mockResolvedValueOnce({
          providers: ['sendgrid', 'mailgun', 'mock', 'test'],
        })
        //Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockSuperJson.normalized.providers['test'].security[0],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testDigest' })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall({
        logCb,
        warnCb,
        successCb,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SENDGRID_TOKEN=sendgridBearer\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_DIGEST=testDigest\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\n\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "sendgrid" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mock" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nProvider "mock" can be used without authentication'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        'Now you can follow our documentation to use installed capability: "https://docs.superface.ai/getting-started"'
      );
    });

    it('sets up sf correctly - non existing super.json and existing .env', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mockLoad.mockResolvedValue(ok(mockSuperJson));
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
        //Select profile
        .mockResolvedValueOnce({ profile })
        //Select providers
        .mockResolvedValueOnce({
          providers: ['sendgrid', 'mailgun', 'mock', 'test'],
        })
        //Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockSuperJson.normalized.providers['test'].security[1],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall({ logCb, warnCb, successCb });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SOME=env\nSENDGRID_TOKEN=sendgridBearer\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_API_KEY=testApiKey\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\n\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "sendgrid" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mock" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nProvider "mock" can be used without authentication'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        'Now you can follow our documentation to use installed capability: "https://docs.superface.ai/getting-started"'
      );
    });

    it('sets up sf correctly - misconfigured super.json', async () => {
      const mockMisconfiguredSuperJson = new SuperJson({
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
        //Select profile
        .mockResolvedValueOnce({ profile })
        //Select providers
        .mockResolvedValueOnce({
          providers: ['sendgrid', 'mailgun', 'mock', 'test'],
        })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Select security schema
        .mockResolvedValueOnce({
          schema:
            mockMisconfiguredSuperJson.normalized.providers['test'].security[1],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' })
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });

      await interactiveInstall({ logCb, warnCb, successCb });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=env\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\n\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nConfiguring providers security'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "sendgrid" security');
      expect(warnCb).toHaveBeenCalledWith(
        'Value of SENDGRID_TOKEN in "sendgrid" "bearer" security schema does not start with $ character.'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mock" security');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nProvider "mock" can be used without authentication'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '🆗 Superface have been configured successfully!'
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
      mocked(PackageManager.installPackage).mockResolvedValue();
      mocked(profileExists).mockResolvedValueOnce(true);
      mocked(providerExists).mockReturnValue(true);
      mocked(fetchProfiles).mockResolvedValue([profile]);
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
        //Override super.json
        .mockResolvedValueOnce({ continue: true })
        //Select profile
        .mockResolvedValueOnce({ profile })
        //Override profile
        .mockResolvedValueOnce({ continue: true })
        //Select providers
        .mockResolvedValueOnce({
          providers: ['sendgrid', 'mailgun', 'mock', 'test'],
        })
        //Do NOT override first provider
        .mockResolvedValueOnce({ continue: false })
        //Override second provider
        .mockResolvedValueOnce({ continue: true })
        //Override third provider
        .mockResolvedValueOnce({ continue: true })
        //Override forth provider
        .mockResolvedValueOnce({ continue: true })
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
        //Set SDK token
        .mockResolvedValueOnce({
          token:
            'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
        });
      await interactiveInstall({
        logCb,
        warnCb,
        successCb,
      });

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'test=test\nSENDGRID_TOKEN=t\ntest2=test2\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_DIGEST=testDigest\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
      );

      expect(successCb).toHaveBeenCalledWith(
        'Initializing superface directory'
      );
      expect(successCb).toHaveBeenCalledWith('\n\nInstalling providers');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nConfiguring providers security'
      );
      //User dont want to override sendgrid
      expect(logCb).not.toHaveBeenCalledWith(
        '\n\nConfiguring "sendgrid" security'
      );
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mailgun" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "mock" security');
      expect(logCb).toHaveBeenCalledWith('\n\nConfiguring "test" security');
      expect(successCb).toHaveBeenCalledWith(
        '\n\nProvider "mock" can be used without authentication'
      );
      expect(successCb).toHaveBeenCalledWith(
        '\n\nInstalling package "@superfaceai/one-sdk"'
      );
      expect(successCb).toHaveBeenCalledWith(
        '🆗 Superface have been configured successfully!'
      );
      expect(successCb).toHaveBeenCalledWith(
        'Now you can follow our documentation to use installed capability: "https://docs.superface.ai/getting-started"'
      );
    });

    it('sets up sf correctly - do not override existing super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('some/path');
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest
        .spyOn(inquirer, 'prompt')
        //Do NOT override super.json
        .mockResolvedValueOnce({ continue: false });

      await interactiveInstall({
        logCb,
        warnCb,
        successCb,
      });
      expect(initSuperface).not.toHaveBeenCalled();
      expect(successCb).not.toHaveBeenCalledWith(
        'Initializing superface directory'
      );
    });
  });
});