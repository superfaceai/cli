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
  DOWN,
  ENTER,
  execCLI,
  mockResponsesForProfile,
  mockResponsesForProfileProviders,
  mockResponsesForProvider,
  setUpTempDir,
  UP,
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
    //Profile with version
    await mockResponsesForProfile(
      mockServer,
      `${profile.scope}/${profile.name}@${profile.version}`
    );
    //Providers list with version
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

      const result = await execCLI(
        tempDir,
        [
          'install',
          `${profile.scope}/${profile.name}@${profile.version}`,
          '-i',
        ],
        mockServer.url,
        {
          inputs: [
            //Select providers priority
            //Sendgrid
            { value: DOWN, timeout: 6000 },
            //Confirm slection
            { value: ENTER, timeout: 200 },
            //Mailgun
            { value: DOWN, timeout: 6000 },
            //Confirm slection
            { value: ENTER, timeout: 200 },
            //Exit
            { value: UP, timeout: 6000 },
            //Confirm slection
            { value: ENTER, timeout: 200 },
            //Sendgrid token
            { value: 'sendgridToken', timeout: 10000 },
            { value: ENTER, timeout: 100 },
            //Mailgun username
            { value: 'username', timeout: 6000 },
            { value: ENTER, timeout: 100 },
            //Mailgun password
            { value: 'password', timeout: 6000 },
            { value: ENTER, timeout: 100 },
            //Confirm dotenv installation
            { value: ENTER, timeout: 6000 },
            //Incorrect SDK token
            {
              value:
                'XXX_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
              timeout: 6000,
            },
            { value: ENTER, timeout: 100 },
            //Correct SDK token
            {
              value:
                'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
              timeout: 6000,
            },
            { value: ENTER, timeout: 500 },
          ],
        }
      );

      //Check output
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(result.stdout).toMatch('Installing providers');
      expect(result.stdout).toMatch('Configuring "sendgrid" security');
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
            priority: ['sendgrid', 'mailgun'],
            providers: {
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
        },
      });
      //Check .env
      const env = (await readFile(joinPath(tempDir, '.env'))).toString();
      expect(env).toMatch('SENDGRID_TOKEN=sendgridToken\n');
      expect(env).toMatch('MAILGUN_USERNAME=username\n');
      expect(env).toMatch('MAILGUN_PASSWORD=password\n');
      expect(env).toMatch(
        'SUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
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

      const result = await execCLI(
        tempDir,
        [
          'install',
          `${profile.scope}/${profile.name}@${profile.version}`,
          '-i',
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm super.json override
            { value: 'y', timeout: 2000 },
            { value: ENTER, timeout: 100 },
            //Confirm profile override
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 100 },
            //Select sendgrid provider
            { value: DOWN, timeout: 10000 },
            { value: ENTER, timeout: 500 },
            //exit
            { value: UP, timeout: 6000 },
            //Confirm selection
            { value: ENTER, timeout: 100 },
            //Confirm first provider override
            { value: 'y', timeout: 6000 },
            { value: ENTER, timeout: 500 },
            //Confirm env override
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Sendgrid token
            { value: 'newSendgridToken', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm dotenv installation
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //SDK token
            {
              value:
                'sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5',
              timeout: 4000,
            },
            { value: ENTER, timeout: 100 },
          ],
        }
      );

      //Check output
      expect(result.stdout).toMatch(
        'Profile "communication/send-email" already exists.'
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(result.stdout).toMatch('Installing providers');
      expect(result.stdout).toMatch('Provider "sendgrid" already exists.');
      expect(result.stdout).toMatch('Configuring "sendgrid" security');
      expect(result.stdout).toMatch(
        'Value of "SENDGRID_TOKEN" for "sendgrid" is already set.'
      );

      expect(result.stdout).toMatch(
        'Installing package "@superfaceai/one-sdk"'
      );
      expect(result.stdout).toMatch('Installing package "dotenv"');
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
            priority: ['sendgrid'],
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
      expect(env).toMatch('TEST=test\n');
      expect(env).toMatch('MAILGUN_USERNAME=username\n');
      expect(env).toMatch('MAILGUN_PASSWORD=password\n');
      expect(env).toMatch('ANOTHER_TEST=anotherTest\n');
      expect(env).toMatch(
        'SENDGRID_TOKEN=newSendgridToken\nSUPERFACE_SDK_TOKEN=sfs_bb064dd57c302911602dd097bc29bedaea6a021c25a66992d475ed959aa526c7_37bce8b5\n'
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
