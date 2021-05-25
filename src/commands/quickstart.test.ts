import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { fetchProfiles, fetchProviders } from '../common/http';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';
import { getProviders } from '../logic/quickstart';
import { MockStd, mockStd } from '../test/mock-std';
import Quickstart from './quickstart';

//Mock install logic
jest.mock('../logic/install');

//Mock configure logic
jest.mock('../logic/configure');

//Mock init logic
jest.mock('../logic/init');

//Mock quickstart logic
jest.mock('../logic/quickstart');

//Mock http
jest.mock('../common/http');

//Mock IO
jest.mock('../common/io');

//Mock inquirer
jest.mock('inquirer');

describe('Quickstart CLI command', () => {
  let stdout: MockStd;
  let stderr: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    stderr = mockStd();
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running quickstart command', () => {
    const mockInstaledProviders = {
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
    };
    const profile = {
      scope: 'communication',
      profile: 'send-email',
      version: '1.0.1',
    };

    it('sets up sf correctly - non existing super.json and .env', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        'sendgrid',
        'mailgun',
        'mailchimp',
        'mock',
        'test',
      ]);
      mocked(getProviders).mockResolvedValue(mockInstaledProviders);
      mocked(exists).mockResolvedValue(false);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      jest
        .spyOn(inquirer, 'prompt')
        //Select profile
        .mockResolvedValueOnce({ profile })
        //Select providers
        .mockResolvedValueOnce({ providers: ['sendgrid', 'mailgun', 'mock'] })
        //Set sendgrid bearer
        .mockResolvedValueOnce({ value: 'sendgridBearer' })
        //Set mailgun username
        .mockResolvedValueOnce({ value: 'mailgunUsername' })
        //Set mailgun password
        .mockResolvedValueOnce({ value: 'mailgunPassword' })
        //Select security schema
        .mockResolvedValueOnce({
          schema: mockInstaledProviders.test.security[0],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testDigest' });

      await Quickstart.run();

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(getProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SENDGRID_TOKEN=sendgridBearer\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_DIGEST=testDigest\n'
      );

      expect(stdout.output).toContain('Initializing superface directory');
      expect(stdout.output).toContain('Installing providers');
      expect(stdout.output).toContain('Configuring providers security');
      expect(stdout.output).toContain('Configuring "sendgrid" security');
      expect(stdout.output).toContain('Configuring "mailgun" security');
      expect(stdout.output).toContain('Configuring "mock" security');
      expect(stdout.output).toContain('Configuring "test" security');
      expect(stdout.output).toContain(
        'Provider "mock" can be used without authentication'
      );
      expect(stdout.output).toContain(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(stdout.output).toContain(
        '🆗 Superface have been configured successfully!'
      );
    });

    it('sets up sf correctly - non existing super.json and existing .env', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        'sendgrid',
        'mailgun',
        'mailchimp',
        'mock',
        'test',
      ]);
      mocked(getProviders).mockResolvedValue(mockInstaledProviders);
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
          schema: mockInstaledProviders.test.security[1],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' });

      await Quickstart.run();

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(getProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'SOME=env\nSENDGRID_TOKEN=sendgridBearer\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\nTEST_API_KEY=testApiKey\n'
      );

      expect(stdout.output).toContain('Initializing superface directory');
      expect(stdout.output).toContain('Installing providers');
      expect(stdout.output).toContain('Configuring providers security');
      expect(stdout.output).toContain('Configuring "sendgrid" security');
      expect(stdout.output).toContain('Configuring "mailgun" security');
      expect(stdout.output).toContain('Configuring "mock" security');
      expect(stdout.output).toContain('Configuring "test" security');
      expect(stdout.output).toContain(
        'Provider "mock" can be used without authentication'
      );
      expect(stdout.output).toContain(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(stdout.output).toContain(
        '🆗 Superface have been configured successfully!'
      );
    });

    it('sets up sf correctly - misconfigured super.json', async () => {
      const mockInstaledProviders = {
        sendgrid: {
          security: [
            {
              id: 'bearer_token',
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
      };

      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(fetchProfiles).mockResolvedValue([profile]);
      mocked(fetchProviders).mockResolvedValue([
        'sendgrid',
        'mailgun',
        'mailchimp',
        'mock',
        'test',
      ]);
      mocked(getProviders).mockResolvedValue(mockInstaledProviders);
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
          schema: mockInstaledProviders.test.security[1],
        })
        //Set test digest
        .mockResolvedValueOnce({ value: 'testApiKey' });

      await Quickstart.run();

      expect(detectSuperJson).toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalled();
      expect(fetchProfiles).toHaveBeenCalled();
      expect(fetchProviders).toHaveBeenCalled();
      expect(getProviders).toHaveBeenCalled();
      expect(exists).toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=env\nMAILGUN_USERNAME=mailgunUsername\nMAILGUN_PASSWORD=mailgunPassword\n'
      );

      expect(stdout.output).toContain('Initializing superface directory');
      expect(stdout.output).toContain('Installing providers');
      expect(stdout.output).toContain('Configuring providers security');
      expect(stdout.output).toContain('Configuring "sendgrid" security');
      expect(stdout.output).toContain(
        'Value of SENDGRID_TOKEN in "sendgrid" "bearer" security schema does not start with $ character.'
      );
      expect(stdout.output).toContain('Configuring "mailgun" security');
      expect(stdout.output).toContain('Configuring "mock" security');
      expect(stdout.output).toContain(
        'Provider "mock" can be used without authentication'
      );
      expect(stdout.output).toContain('Configuring "test" security');
      expect(stdout.output).toContain(
        'Value of "TEST_API_KEY" for "test" is already set'
      );
      expect(stdout.output).toContain(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(stdout.output).toContain(
        '🆗 Superface have been configured successfully!'
      );
    });
  });
});
