import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { execFile, exists, mkdir, readFile, rimraf } from '../common/io';
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
          '\x0D',
          //Select all providers
          'a',
          //Confirm slection
          '\x0D',
          //Sendgrid token
          'sendgridToken',
          '\x0D',
          //Mailgun username
          'username',
          '\x0D',
          //Mailgun password
          'password',
          '\x0D',
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

    // it('installs the specified profile version with default provider configuration', async () => {
    //   const result = await execCLI(
    //     tempDir,
    //     ['install', 'starwars/character-information@1.0.2'],
    //     mockServer.url
    //   );
    //   expect(result.stdout).toMatch(
    //     'All profiles (1) have been installed successfully.'
    //   );
    //   await expect(
    //     exists(joinPath(tempDir, 'superface', 'super.json'))
    //   ).resolves.toBe(true);

    //   await expect(
    //     exists(
    //       joinPath(
    //         tempDir,
    //         'superface',
    //         'grid',
    //         'starwars',
    //         'character-information@1.0.2.supr'
    //       )
    //     )
    //   ).resolves.toBe(true);
    // }, 20000);

    // it('installs local profile', async () => {
    //   const profileId = 'starwars/character-information';
    //   const profileIdRequest =
    //     '../../../fixtures/profiles/starwars/character-information.supr';

    //   const result = await execCLI(
    //     tempDir,
    //     ['install', profileIdRequest, '--local'],
    //     mockServer.url
    //   );
    //   expect(result.stdout).toMatch(
    //     'All profiles (1) have been installed successfully.'
    //   );
    //   await expect(
    //     exists(joinPath(tempDir, 'superface', 'super.json'))
    //   ).resolves.toBe(true);

    //   const superJson = (
    //     await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
    //   ).unwrap();

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     file: `../${profileIdRequest}`,
    //   });
    // }, 20000);

    // it('adds new typings to previously generated', async () => {
    //   const profileId = 'starwars/character-information';
    //   const anotherProfileId = 'starwars/spaceship-information';
    //   const profileIdRequest =
    //     '../../../fixtures/profiles/starwars/spaceship-information.supr';

    //   const paths = [
    //     joinPath(tempDir, 'superface', 'types', profileId + '.js'),
    //     joinPath(tempDir, 'superface', 'types', profileId + '.d.ts'),
    //     joinPath(tempDir, 'superface', 'sdk.js'),
    //     joinPath(tempDir, 'superface', 'sdk.d.ts'),
    //     joinPath(tempDir, 'superface', 'types', anotherProfileId + '.js'),
    //     joinPath(tempDir, 'superface', 'types', anotherProfileId + '.d.ts'),
    //   ];
    //   await expect(exists(paths[0])).resolves.toBe(false);
    //   await expect(exists(paths[1])).resolves.toBe(false);
    //   await expect(exists(paths[2])).resolves.toBe(false);
    //   await expect(exists(paths[3])).resolves.toBe(false);
    //   await expect(exists(paths[4])).resolves.toBe(false);
    //   await expect(exists(paths[5])).resolves.toBe(false);

    //   let result = await execCLI(
    //     tempDir,
    //     ['install', 'starwars/character-information'],
    //     mockServer.url
    //   );
    //   expect(result.stdout).toMatch(
    //     'All profiles (1) have been installed successfully.'
    //   );

    //   await expect(exists(paths[0])).resolves.toBe(true);
    //   await expect(exists(paths[1])).resolves.toBe(true);
    //   await expect(exists(paths[2])).resolves.toBe(true);
    //   await expect(exists(paths[3])).resolves.toBe(true);
    //   await expect(exists(paths[4])).resolves.toBe(false);
    //   await expect(exists(paths[5])).resolves.toBe(false);

    //   result = await execCLI(
    //     tempDir,
    //     ['install', profileIdRequest, '--local'],
    //     mockServer.url
    //   );
    //   expect(result.stdout).toMatch(
    //     'All profiles (1) have been installed successfully.'
    //   );

    //   await expect(exists(paths[0])).resolves.toBe(true);
    //   await expect(exists(paths[1])).resolves.toBe(true);
    //   await expect(exists(paths[2])).resolves.toBe(true);
    //   await expect(exists(paths[3])).resolves.toBe(true);
    //   await expect(exists(paths[4])).resolves.toBe(true);
    //   await expect(exists(paths[5])).resolves.toBe(true);

    //   const sdk = (await readFile(paths[2])).toString();

    //   expect(sdk).toMatch(/starwarsCharacterInformation/);
    //   expect(sdk).toMatch(/starwarsSpaceshipInformation/);
    // }, 50000);

    // it('error when installing non-existent local profile', async () => {
    //   const profileIdRequest = 'none.supr';

    //   const result = await execCLI(
    //     tempDir,
    //     ['install', profileIdRequest, '--local'],
    //     mockServer.url
    //   );
    //   expect(result.stdout).toMatch('❌ No profiles have been installed');

    //   await expect(
    //     exists(joinPath(tempDir, 'superface', 'super.json'))
    //   ).resolves.toBe(true);

    //   const superJson = (
    //     await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
    //   ).unwrap();

    //   expect(superJson.document.profiles).toStrictEqual({});
    // }, 20000);

    // it('errors without a force flag', async () => {
    //   const profileId = 'starwars/character-information';

    //   //set existing super.json
    //   const localSuperJson = {
    //     profiles: {
    //       [profileId]: {
    //         file:
    //           '../../../../fixtures/profiles/starwars/character-information.supr',
    //       },
    //     },
    //     providers: {},
    //   };
    //   await mkdirQuiet(joinPath(tempDir, 'superface'));
    //   await OutputStream.writeOnce(
    //     joinPath(tempDir, 'superface', 'super.json'),
    //     JSON.stringify(localSuperJson, undefined, 2)
    //   );

    //   const result = await execCLI(
    //     tempDir,
    //     ['install', 'starwars/character-information'],
    //     mockServer.url
    //   );

    //   expect(result.stdout).toMatch('File already exists:');

    //   expect(result.stdout).toMatch('❌ No profiles have been installed');
    // }, 20000);
  });
});
