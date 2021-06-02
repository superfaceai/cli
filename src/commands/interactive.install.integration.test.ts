import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '../common';
import {
  execFile,
  exists,
  mkdir,
  mkdirQuiet,
  readFile,
  rimraf,
} from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  execCLI,
  mockResponsesForProfile,
  mockResponsesForProfileProviders,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Interactive install CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  const profile = {
    name: 'send-email',
    scope: 'communication',
    version: '1.0.1',
  };

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    //Profile
    await mockResponsesForProfile(
      mockServer,
      `${profile.scope}/${profile.name}@${profile.version}`
    );
    //Providers list
    await mockResponsesForProfileProviders(
      mockServer,
      ['mailchimp', 'sendgrid', 'mock', 'mailgun'],
      `${profile.scope}/${profile.name}@${profile.version}`
    );
    //Mock provider
    await mockResponsesForProvider(mockServer, 'mock');
    await mockResponsesForProvider(mockServer, 'mailchimp');
    await mockResponsesForProvider(mockServer, 'sendgrid');
    await mockResponsesForProvider(mockServer, 'mailgun');
  });

  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
    //Init package.json
    await execFile('npm', ['init', '-y'], {
      cwd: `./${tempDir}`,
    });
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('when installing non existing profile', () => {
    it('installs the profile', async () => {
      const paths = [
        joinPath(
          tempDir,
          'superface',
          'types',
          profile.scope,
          profile.name + '.js'
        ),
        joinPath(
          tempDir,
          'superface',
          'types',
          profile.scope,
          profile.name + '.d.ts'
        ),
        joinPath(tempDir, 'superface', 'sdk.js'),
        joinPath(tempDir, 'superface', 'sdk.d.ts'),
      ];
      await expect(exists(paths[0])).resolves.toBe(false);
      await expect(exists(paths[1])).resolves.toBe(false);
      await expect(exists(paths[2])).resolves.toBe(false);
      await expect(exists(paths[3])).resolves.toBe(false);

      const result = await execCLI(tempDir, ['install', '-i'], mockServer.url, {
        inputs: [
          //Confirm profile
          { value: '\x0D', timeout: 1000 },
          //Select all providers
          { value: 'a', timeout: 8000 },
          //Confirm slection
          { value: '\x0D', timeout: 100 },
          //Sendgrid token
          { value: 'sendgridToken', timeout: 10000 },
          { value: '\x0D', timeout: 100 },
          //Mailgun username
          { value: 'username', timeout: 4000 },
          { value: '\x0D', timeout: 100 },
          //Mailgun password
          { value: 'password', timeout: 4000 },
          { value: '\x0D', timeout: 100 },
        ],
      });

      //Check output
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(result.stdout).toMatch('Installing providers');
      expect(result.stdout).toMatch('Configuring "mailchimp" security');
      expect(result.stdout).toMatch(
        'Provider "mailchimp" can be used without authenticatio'
      );
      expect(result.stdout).toMatch('Configuring "sendgrid" security');
      expect(result.stdout).toMatch('Configuring "mock" security');
      expect(result.stdout).toMatch(
        'Provider "mock" can be used without authentication'
      );
      expect(result.stdout).toMatch(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(result.stdout).toMatch(
        '🆗 Superface have been configured successfully!'
      );
      expect(result.stdout).toMatch(
        'Now you can follow our documentation to use installed capability: "https://docs.superface.ai/getting-started"'
      );
      //Check file existance
      await expect(
        exists(joinPath(tempDir, 'superface', 'super.json'))
      ).resolves.toBe(true);
      await expect(
        exists(
          joinPath(
            tempDir,
            'superface',
            'grid',
            profile.scope,
            `${profile.name}@${profile.version}.supr`
          )
        )
      ).resolves.toBe(true);

      await expect(exists(paths[0])).resolves.toBe(true);
      await expect(exists(paths[1])).resolves.toBe(true);
      await expect(exists(paths[2])).resolves.toBe(true);
      await expect(exists(paths[3])).resolves.toBe(true);
      await expect(exists(joinPath(tempDir, '.env'))).resolves.toBe(true);
      await expect(exists(joinPath(tempDir, 'package.json'))).resolves.toBe(
        true
      );
      await expect(
        exists(joinPath(tempDir, 'package-lock.json'))
      ).resolves.toBe(true);

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
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
          mailchimp: {
            security: [],
          },
          sendgrid: {
            security: [
              {
                id: 'bearer_token',
                token: '$SENDGRID_TOKEN',
              },
            ],
          },
          mock: {
            security: [],
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
      });
      //Check .env
      const env = (await readFile(joinPath(tempDir, '.env'))).toString();
      expect(env).toMatch(
        'SENDGRID_TOKEN=sendgridToken\nMAILGUN_USERNAME=username\nMAILGUN_PASSWORD=password\n'
      );
      //Check package.json
      const packageFile = (
        await readFile(joinPath(tempDir, 'package.json'))
      ).toString();
      const parsed = JSON.parse(packageFile);
      expect(
        (parsed as { dependencies: Record<string, string> }).dependencies
      ).not.toBeUndefined();
    }, 60000);

    it('installs the profile, overrides existing super.json and updates .env', async () => {
      //Existing env
      await OutputStream.writeOnce(
        joinPath(tempDir, '.env'),
        'TEST=test\nSENDGRID_TOKEN=token\nMAILGUN_USERNAME=username\nMAILGUN_PASSWORD=password\nANOTHER_TEST=anotherTest\n'
      );
      //Existing super.json
      await mkdirQuiet(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify({
          profiles: {
            [`${profile.scope}/${profile.name}`]: {
              version: profile.version,
              providers: {
                mailchimp: {},
                sendgrid: {},
                mock: {},
                mailgun: {},
              },
            },
            other: {
              version: '1.0.0',
              providers: {
                github: {},
              },
            },
          },
          providers: {
            github: {
              security: [],
            },
            mailchimp: {
              security: [],
            },
            sendgrid: {
              security: [
                {
                  id: 'bearer_token',
                  token: '$SENDGRID_TOKEN',
                },
              ],
            },
            mock: {
              security: [],
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
      //Existing profile source file
      await mkdirQuiet(joinPath(tempDir, 'superface', 'grid'));
      await mkdirQuiet(joinPath(tempDir, 'superface', 'grid', profile.scope));
      await OutputStream.writeOnce(
        joinPath(
          tempDir,
          'superface',
          'grid',
          profile.scope,
          `${profile.name}@${profile.version}${EXTENSIONS.profile.source}`
        ),
        ''
      );

      const paths = [
        joinPath(
          tempDir,
          'superface',
          'types',
          profile.scope,
          profile.name + '.js'
        ),
        joinPath(
          tempDir,
          'superface',
          'types',
          profile.scope,
          profile.name + '.d.ts'
        ),
        joinPath(tempDir, 'superface', 'sdk.js'),
        joinPath(tempDir, 'superface', 'sdk.d.ts'),
      ];
      await expect(exists(paths[0])).resolves.toBe(false);
      await expect(exists(paths[1])).resolves.toBe(false);
      await expect(exists(paths[2])).resolves.toBe(false);
      await expect(exists(paths[3])).resolves.toBe(false);

      const result = await execCLI(tempDir, ['install', '-i'], mockServer.url, {
        inputs: [
          //Confirm super.json override
          { value: 'y', timeout: 2000 },
          { value: '\x0D', timeout: 100 },
          //Confirm profile
          { value: '\x0D', timeout: 4000 },
          //Confirm profile override
          { value: 'y', timeout: 4000 },
          { value: '\x0D', timeout: 100 },
          //Select sendgrid provider
          { value: '\x1B\x5B\x42', timeout: 10000 },
          { value: '\x1B\x5B\x42', timeout: 500 },
          { value: '\x20', timeout: 500 },
          { value: '\x1B\x5B\x41', timeout: 500 },
          { value: '\x20', timeout: 500 },
          { value: '\x0D', timeout: 500 },
          //Confirm first provider override
          { value: 'y', timeout: 6000 },
          { value: '\x0D', timeout: 500 },
          //Confirm env override
          { value: 'y', timeout: 4000 },
          { value: '\x0D', timeout: 500 },
          //Sendgrid token
          { value: 'newSendgridToken', timeout: 4000 },
          { value: '\x0D', timeout: 500 },
        ],
      });

      //Check output
      expect(result.stdout).toMatch(
        'Profile "communication/send-email" already exists. Do you want to override it?'
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(result.stdout).toMatch('Installing providers');
      expect(result.stdout).toMatch(
        'Provider "sendgrid" already exists. Do you want to override it?'
      );
      expect(result.stdout).toMatch('Configuring "sendgrid" security');
      expect(result.stdout).toMatch(
        'Value of "SENDGRID_TOKEN" for "sendgrid" is already set.'
      );

      expect(result.stdout).toMatch(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(result.stdout).toMatch(
        '🆗 Superface have been configured successfully!'
      );
      expect(result.stdout).toMatch(
        'Now you can follow our documentation to use installed capability: "https://docs.superface.ai/getting-started"'
      );
      //Check file existance
      await expect(
        exists(joinPath(tempDir, 'superface', 'super.json'))
      ).resolves.toBe(true);
      await expect(
        exists(
          joinPath(
            tempDir,
            'superface',
            'grid',
            profile.scope,
            `${profile.name}@${profile.version}.supr`
          )
        )
      ).resolves.toBe(true);

      await expect(exists(paths[0])).resolves.toBe(true);
      await expect(exists(paths[1])).resolves.toBe(true);
      await expect(exists(paths[2])).resolves.toBe(true);
      await expect(exists(paths[3])).resolves.toBe(true);
      await expect(exists(joinPath(tempDir, '.env'))).resolves.toBe(true);
      await expect(exists(joinPath(tempDir, 'package.json'))).resolves.toBe(
        true
      );
      await expect(
        exists(joinPath(tempDir, 'package-lock.json'))
      ).resolves.toBe(true);

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            version: profile.version,
            providers: {
              mailchimp: {},
              sendgrid: {},
              mock: {},
              mailgun: {},
            },
          },
          other: {
            version: '1.0.0',
            providers: {
              github: {},
            },
          },
        },
        providers: {
          github: {
            security: [],
          },
          mailchimp: {
            security: [],
          },
          sendgrid: {
            security: [
              {
                id: 'bearer_token',
                token: '$SENDGRID_TOKEN',
              },
            ],
          },
          mock: {
            security: [],
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
      });
      //Check .env
      const env = (await readFile(joinPath(tempDir, '.env'))).toString();
      expect(env).toMatch(
        'TEST=test\nMAILGUN_USERNAME=username\nMAILGUN_PASSWORD=password\nANOTHER_TEST=anotherTest\nSENDGRID_TOKEN=newSendgridToken\n'
      );
      //Check package.json
      const packageFile = (
        await readFile(joinPath(tempDir, 'package.json'))
      ).toString();
      const parsed = JSON.parse(packageFile);
      expect(
        (parsed as { dependencies: Record<string, string> }).dependencies
      ).not.toBeUndefined();
    }, 60000);
  });
});
