import {
  ApiKeyPlacement,
  HttpScheme,
  SecurityType,
  SuperJson,
  ok,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { fetchProviderInfo } from '../common/http';
import { MockStd, mockStd } from '../test/mock-std';
import Configure from './configure';
import { detectSuperJson } from '../logic/install';
import { OutputStream } from '../common/output-stream';

//Mock only fetchProviderInfo response
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
}));

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

jest.mock('../common/io');


describe('Configure CLI command', () => {

  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.1',
  };
  const PROVIDER_NAME = 'test';

  let stdout: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when configuring new provider', () => {
    it('configures provider with security schemes correctly', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //Mock path do super.json
      const mockPath = 'some/path/'
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {}
          }
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson))
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'api',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
          {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
          {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
          },
          {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
          },
        ],
        defaultService: 'swapidev',
      });


      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith('', JSON.stringify({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: { [PROVIDER_NAME]: {} }
          }
        },
        providers: {
          [PROVIDER_NAME]: {
            security: [
              {
                id: 'api',
                apikey: `$${PROVIDER_NAME.toUpperCase()}_API_KEY`,
              },
              {
                id: 'bearer',
                token: `$${PROVIDER_NAME.toUpperCase()}_TOKEN`,
              },
              {
                id: 'basic',
                username: `$${PROVIDER_NAME.toUpperCase()}_USERNAME`,
                password: `$${PROVIDER_NAME.toUpperCase()}_PASSWORD`,
              },
              {
                id: 'digest',
                digest: `$${PROVIDER_NAME.toUpperCase()}_DIGEST`,
              },
            ]
          }
        }
      }, undefined, 2), { force: false, local: false, logCb: expect.anything(), warnCb: expect.anything() })

      expect(stdout.output).toContain(
        '🆗 All security schemes have been configured successfully.'
      );
    }, 10000);

    // it('configures provider with empty security schemes correctly', async () => {
    //   //mock provider structure
    //   mocked(fetchProviderInfo).mockResolvedValue({
    //     name: PROVIDER_NAME,
    //     services: [
    //       {
    //         id: 'swapidev',
    //         baseUrl: 'https://swapi.dev/api',
    //       },
    //     ],
    //     //empty
    //     securitySchemes: [],
    //     defaultService: 'swapidev',
    //   });

    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;

    //   await expect(
    //     Configure.run([PROVIDER_NAME, `-p ${profileId}`])
    //   ).resolves.toBeUndefined();

    //   expect(stdout.output).toContain(
    //     'No security schemes found to configure.'
    //   );

    //   const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
    //   expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
    //     security: [],
    //   });

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     version: PROFILE.version,
    //     providers: { [PROVIDER_NAME]: {} },
    //   });
    // }, 10000);

    // it('configures provider without security schemes correctly', async () => {
    //   //mock provider structure
    //   mocked(fetchProviderInfo).mockResolvedValue({
    //     name: PROVIDER_NAME,
    //     services: [
    //       {
    //         id: 'swapidev',
    //         baseUrl: 'https://swapi.dev/api',
    //       },
    //     ],
    //     defaultService: 'swapidev',
    //   });
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;

    //   await expect(
    //     Configure.run([PROVIDER_NAME, `-p ${profileId}`])
    //   ).resolves.toBeUndefined();

    //   expect(stdout.output).toContain(
    //     'No security schemes found to configure.'
    //   );

    //   const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
    //   expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
    //     security: [],
    //   });

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     version: PROFILE.version,
    //     providers: { [PROVIDER_NAME]: {} },
    //   });
    // }, 10000);

    // it('configures provider with unknown security scheme correctly', async () => {
    //   //mock provider structure
    //   mocked(fetchProviderInfo).mockResolvedValue({
    //     name: PROVIDER_NAME,
    //     services: [
    //       {
    //         id: 'swapidev',
    //         baseUrl: 'https://swapi.dev/api',
    //       },
    //     ],
    //     securitySchemes: [
    //       {
    //         id: 'swapidev',
    //         //unknown
    //         type: 'unknown' as SecurityType.APIKEY,
    //         in: ApiKeyPlacement.HEADER,
    //         name: 'X-API-Key',
    //       },
    //     ],
    //     defaultService: 'swapidev',
    //   });
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;

    //   await expect(
    //     Configure.run([PROVIDER_NAME, `-p ${profileId}`])
    //   ).resolves.toBeUndefined();

    //   expect(stdout.output).toContain(
    //     '❌ No security schemes have been configured.'
    //   );

    //   const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
    //   expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
    //     security: [],
    //   });

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     version: PROFILE.version,
    //     providers: { [PROVIDER_NAME]: {} },
    //   });
    // }, 10000);

    // it('does not log to stdout with --quiet', async () => {
    //   //mock provider structure
    //   mocked(fetchProviderInfo).mockResolvedValue({
    //     name: PROVIDER_NAME,
    //     services: [
    //       {
    //         id: 'swapidev',
    //         baseUrl: 'https://swapi.dev/api',
    //       },
    //     ],
    //     securitySchemes: [
    //       {
    //         id: 'swapidev',
    //         type: SecurityType.APIKEY,
    //         in: ApiKeyPlacement.HEADER,
    //         name: 'X-API-Key',
    //       },
    //     ],
    //     defaultService: 'swapidev',
    //   });
    //   const profileId = `${PROFILE.scope}/${PROFILE.name}`;

    //   await expect(
    //     Configure.run([PROVIDER_NAME, `-p ${profileId}`, '-q'])
    //   ).resolves.toBeUndefined();
    //   const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
    //   expect(
    //     superJson.normalized.providers[PROVIDER_NAME].security
    //   ).toContainEqual({
    //     apikey: '$TEST_API_KEY',
    //     id: 'swapidev',
    //   });

    //   expect(superJson.document.profiles![profileId]).toEqual({
    //     version: PROFILE.version,
    //     providers: { [PROVIDER_NAME]: {} },
    //   });
    // });
  });

  // describe('when providers are present in super.json', () => {
  //   it('errors without a force flag', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     //set existing super.json
  //     const localSuperJson = {
  //       profiles: {
  //         [profileId]: {
  //           version: PROFILE.version,
  //           providers: {
  //             [PROVIDER_NAME]: {},
  //           },
  //         },
  //       },
  //       providers: {
  //         [PROVIDER_NAME]: {
  //           security: [
  //             {
  //               id: 'apiKey',
  //               apikey: '$TEST_API_KEY',
  //             },
  //           ],
  //         },
  //       },
  //     };
  //     await OutputStream.writeOnce(
  //       FIXTURE.superJson,
  //       JSON.stringify(localSuperJson, undefined, 2)
  //     );
  //     //mock provider structure with same provider name but different auth scheme
  //     mocked(fetchProviderInfo).mockResolvedValue({
  //       name: PROVIDER_NAME,
  //       services: [
  //         {
  //           id: 'swapidev',
  //           baseUrl: 'https://swapi.dev/api',
  //         },
  //       ],
  //       securitySchemes: [
  //         {
  //           id: 'swapidev',
  //           type: SecurityType.HTTP,
  //           scheme: HttpScheme.BEARER,
  //         },
  //       ],
  //       defaultService: 'swapidev',
  //     });

  //     await expect(
  //       Configure.run([PROVIDER_NAME, `-p ${profileId}`])
  //     ).resolves.toBeUndefined();

  //     expect(stdout.output).toContain(
  //       `Provider already exists: "${PROVIDER_NAME}"`
  //     );

  //     const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

  //     expect(superJson.document).toEqual(localSuperJson);
  //   }, 10000);

  //   it('overrides existing super.json with a force flag', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     //set existing super.json
  //     const localSuperJson = {
  //       profiles: {
  //         [profileId]: {
  //           version: PROFILE.version,
  //           providers: {
  //             [PROVIDER_NAME]: {},
  //           },
  //         },
  //       },
  //       providers: {
  //         [PROVIDER_NAME]: {
  //           security: [
  //             {
  //               id: 'apiKey',
  //               apikey: '$TEST_API_KEY',
  //             },
  //           ],
  //         },
  //       },
  //     };
  //     await OutputStream.writeOnce(
  //       FIXTURE.superJson,
  //       JSON.stringify(localSuperJson, undefined, 2)
  //     );
  //     //mock provider structure with same provider name but different auth scheme
  //     mocked(fetchProviderInfo).mockResolvedValue({
  //       name: PROVIDER_NAME,
  //       services: [
  //         {
  //           id: 'swapidev',
  //           baseUrl: 'https://swapi.dev/api',
  //         },
  //       ],
  //       securitySchemes: [
  //         {
  //           id: 'swapidev',
  //           type: SecurityType.HTTP,
  //           scheme: HttpScheme.BEARER,
  //         },
  //       ],
  //       defaultService: 'swapidev',
  //     });

  //     //force flag
  //     await expect(
  //       Configure.run([PROVIDER_NAME, `-p ${profileId}`, '-f'])
  //     ).resolves.toBeUndefined();

  //     expect(stdout.output).not.toContain(
  //       `Provider already exists: "${PROVIDER_NAME}"`
  //     );

  //     const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

  //     expect(superJson.normalized.providers[PROVIDER_NAME].security).toEqual([
  //       {
  //         id: 'apiKey',
  //         apikey: '$TEST_API_KEY',
  //       },
  //       {
  //         id: 'swapidev',
  //         token: '$TEST_TOKEN',
  //       },
  //     ]);

  //     expect(superJson.document.profiles![profileId]).toEqual({
  //       version: PROFILE.version,
  //       providers: { [PROVIDER_NAME]: {} },
  //     });
  //   }, 10000);
  // });

  // describe('when there is a path flag', () => {
  //   it('loads provider data from file', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     //local flag
  //     await expect(
  //       Configure.run([
  //         './superface/swapidev.provider.json',
  //         `-p ${profileId}`,
  //         '-l',
  //       ])
  //     ).resolves.toBeUndefined();

  //     const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

  //     expect(superJson.normalized.providers[PROVIDER_NAME].security).toEqual([
  //       {
  //         id: 'api',
  //         apikey: '$TEST_API_KEY',
  //       },
  //       {
  //         id: 'digest',
  //         digest: '$TEST_DIGEST',
  //       },
  //     ]);

  //     expect(superJson.document.profiles![profileId]).toEqual({
  //       version: PROFILE.version,
  //       providers: { [PROVIDER_NAME]: {} },
  //     });
  //   }, 10000);

  //   it('does not load provider data from corupted file', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     //local flag
  //     await expect(
  //       Configure.run([
  //         './superface/swapidev.provider.corupted.json',
  //         `-p ${profileId}`,
  //         '-l',
  //       ])
  //     ).rejects.toEqual(
  //       userError('Unexpected string in JSON at position 168', 1)
  //     );

  //     const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

  //     expect(superJson.document).toEqual(INITIAL_SUPER_JSON.document);
  //   }, 10000);

  //   it('does not load provider data from nonexistent file', async () => {
  //     const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  //     //local flag
  //     await expect(
  //       Configure.run([
  //         './very/nice/path/superface/swapidev.provider.json',
  //         `-p ${profileId}`,
  //         '-l',
  //       ])
  //     ).rejects.toEqual(
  //       userError(
  //         `Error: ENOENT: no such file or directory, open './very/nice/path/superface/swapidev.provider.json'`,
  //         1
  //       )
  //     );

  //     const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

  //     expect(superJson.document).toEqual(INITIAL_SUPER_JSON.document);
  //   }, 10000);
  // });
});
