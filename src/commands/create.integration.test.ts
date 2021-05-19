import { ok,SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { composeUsecaseName, EXTENSIONS } from '../common';
import { mkdirQuiet, WritingOptions } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { detectSuperJson } from '../logic/install';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import * as providerTemplate from '../templates/provider';
import { MockStd, mockStd } from '../test/mock-std';
import Create from './create';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock IO
jest.mock('../common/io');

describe('Create CLI command', () => {
  const originalLoad = SuperJson.load;

  const PROFILE = {
    scope: 'sms',
    name: 'service',
    version: '1.0.1',
  };

  const documentName = `${PROFILE.scope}/${PROFILE.name}`;
  const provider = 'twilio';

  let writeOnceSpy: jest.SpyInstance<
    Promise<void>,
    [string, string, (WritingOptions | undefined)?]
  >;
  let writeIfAbsentSpy: jest.SpyInstance<
    Promise<boolean>,
    [string, string | (() => string), (WritingOptions | undefined)?]
  >;
  let loadSpy: jest.Mock<any, any>;

  afterAll(async () => {
    SuperJson.load = originalLoad;
  });
  let stdout: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);

    //Command context
    //Mock path do super.json
    const mockPath = 'some/path/';
    mocked(mkdirQuiet).mockResolvedValue(true);

    mocked(detectSuperJson).mockResolvedValue(mockPath);

    //Logic context
    //Mock super.json
    const mockSuperJson = new SuperJson({
      profiles: {},
      providers: {},
    });

    //We need to mock static side of SuperJson
    loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
    SuperJson.load = loadSpy;

    writeOnceSpy = jest
      .spyOn(OutputStream, 'writeOnce')
      .mockResolvedValue(undefined);

    writeIfAbsentSpy = jest
      .spyOn(OutputStream, 'writeIfAbsent')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates profile with one usecase (with usecase name from cli)', async () => {
    await Create.run(['profile', documentName]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', composeUsecaseName(PROFILE.name)),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${PROFILE.scope}/${PROFILE.name}${EXTENSIONS.profile.source}`,
            },
          },
          providers: {},
        },
        undefined,
        2
      )
    );
  });

  it('creates profile with one usecase', async () => {
    await Create.run(['profile', documentName, '-u', 'SendSMS']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );
    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${PROFILE.scope}/${PROFILE.name}${EXTENSIONS.profile.source}`,
            },
          },
          providers: {},
        },
        undefined,
        2
      )
    );
  });

  it('creates profile with multiple usecases', async () => {
    await Create.run(['profile', documentName, '-u', 'ReceiveSMS', 'SendSMS']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', 'ReceiveSMS'),
        profileTemplate.usecase('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${PROFILE.scope}/${PROFILE.name}${EXTENSIONS.profile.source}`,
            },
          },
          providers: {},
        },
        undefined,
        2
      )
    );
  });

  it('creates map with one usecase (with usecase name from cli)', async () => {
    await Create.run(['map', documentName, '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', composeUsecaseName(PROFILE.name)),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              version: '0.0.0',
              defaults: {},
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });

  it('creates map with one usecase', async () => {
    await Create.run(['map', documentName, '-u', 'SendSMS', '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              version: '0.0.0',
              defaults: {},
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });

  it('creates map with mutiple usecases', async () => {
    await Create.run([
      'map',
      documentName,
      '-p',
      'twilio',
      '-u',
      'ReceiveSMS',
      'SendSMS',
    ]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', 'ReceiveSMS'),
        mapTemplate.map('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              version: '0.0.0',
              defaults: {},
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });

  it('creates profile & map with one usecase (with usecase name from cli)', async () => {
    await Create.run([documentName, '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(3);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', composeUsecaseName(PROFILE.name)),
      ].join(''),
      { dirs: true, force: undefined }
    );
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', composeUsecaseName(PROFILE.name)),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      3,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${documentName}${EXTENSIONS.profile.source}`,
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });

  it('creates profile & map with one usecase', async () => {
    await Create.run([documentName, '-u', 'SendSMS', '-p', 'twilio']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(3);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      3,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${PROFILE.scope}/${PROFILE.name}${EXTENSIONS.profile.source}`,
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });

  it('creates profile & map with multiple usecases', async () => {
    await Create.run([
      documentName,
      '-u',
      'ReceiveSMS',
      'SendSMS',
      '-p',
      provider,
    ]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    expect(detectSuperJson).toHaveBeenCalledTimes(1);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(3);
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      1,
      `${documentName}${EXTENSIONS.profile.source}`,
      [
        //Default version
        profileTemplate.header(documentName, '1.0.0'),
        profileTemplate.usecase('empty', 'ReceiveSMS'),
        profileTemplate.usecase('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );
    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      2,
      `${documentName}.${provider}${EXTENSIONS.map.source}`,
      [
        //Default version
        mapTemplate.header(documentName, provider, '1.0', ''),
        mapTemplate.map('empty', 'ReceiveSMS'),
        mapTemplate.map('empty', 'SendSMS'),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
      3,
      `${provider}.provider.json`,
      providerTemplate.provider('empty', provider),
      { force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    expect(writeOnceSpy).toHaveBeenCalledWith(
      '',
      JSON.stringify(
        {
          profiles: {
            [documentName]: {
              file: `${documentName}${EXTENSIONS.profile.source}`,
              providers: {
                [provider]: {
                  file: `${documentName}.${provider}.suma`,
                },
              },
            },
          },
          providers: {
            [provider]: {
              file: `${provider}.provider.json`,
              security: [],
            },
          },
        },
        undefined,
        2
      )
    );
  });
});
