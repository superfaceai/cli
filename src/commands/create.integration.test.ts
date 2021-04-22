import { SuperJson } from '@superfaceai/one-sdk';
import * as fs from 'fs';
import { join as joinPath } from 'path';

import { EXTENSIONS, GRID_DIR, SUPER_PATH } from '../common/document';
import { rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { MockStd, mockStd } from '../test/mock-std';
import Create from './create';
import Lint from './lint';

describe('Create CLI command', () => {
  let documentName: string, provider: string, variant: string;

  const WORKING_DIR = joinPath('fixtures', 'create', 'playground');

  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.1',
  };

  const FIXTURE = {
    superJson: SUPER_PATH,
    scope: joinPath(GRID_DIR, PROFILE.scope),
    profile: joinPath(
      GRID_DIR,
      PROFILE.scope,
      PROFILE.name + '@' + PROFILE.version + EXTENSIONS.profile.source
    ),
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: SuperJson;

  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);

    INITIAL_SUPER_JSON = (await SuperJson.load(FIXTURE.superJson)).unwrap();

    await rimraf(FIXTURE.scope);
  });

  afterAll(async () => {
    await resetSuperJson();
    await rimraf(FIXTURE.scope);

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      JSON.stringify(INITIAL_SUPER_JSON.document, undefined, 2)
    );
  }
  let stdout: MockStd;

  beforeEach(async () => {
    await resetSuperJson();
    await rimraf(FIXTURE.scope);

    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();

    // handle profile
    if (fs.existsSync(`${documentName}.supr`)) {
      fs.unlinkSync(`${documentName}.supr`);
    }

    // handle map
    if (variant) {
      if (fs.existsSync(`${documentName}.${provider}.${variant}.suma`)) {
        fs.unlinkSync(`${documentName}.${provider}.${variant}.suma`);
      }
    } else {
      if (fs.existsSync(`${documentName}.${provider}.suma`)) {
        fs.unlinkSync(`${documentName}.${provider}.suma`);
      }
    }

    const documentInfo = documentName.split('/');
    const scope = documentInfo[1] ? documentInfo[0] : undefined;

    // handle scope directory
    if (scope) {
      if (fs.existsSync(scope)) {
        fs.rmdirSync(scope);
      }
    }

    // handle provider file
    if (fs.existsSync(`${provider}.provider.json`)) {
      fs.unlinkSync(`${provider}.provider.json`);
    }
  });

  it('creates profile with one usecase (with usecase name from cli)', async () => {
    documentName = 'sendsms';
    await Create.run(['profile', documentName]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
        },
      },
      providers: {},
    });
  });

  it('creates profile with one usecase', async () => {
    documentName = 'sms/service';
    await Create.run(['profile', documentName, '-u', 'SendSMS']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
        },
      },
      providers: {},
    });
  });

  it('creates profile with multiple usecases', async () => {
    documentName = 'sms/service';
    await Create.run(['profile', documentName, '-u', 'ReceiveSMS', 'SendSMS']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
        },
      },
      providers: {},
    });
  });

  it('creates map with one usecase (with usecase name from cli)', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run(['map', documentName, '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          defaults: {},
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
          version: '0.0.0',
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });

  it('creates map with one usecase', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run(['map', documentName, '-u', 'SendSMS', '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          defaults: {},
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
          version: '0.0.0',
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });

  it('creates map with mutiple usecases', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([
      'map',
      documentName,
      '-p',
      'twillio',
      '-u',
      'ReceiveSMS',
      'SendSMS',
    ]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          defaults: {},
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
          version: '0.0.0',
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });

  it('creates profile & map with one usecase (with usecase name from cli)', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([documentName, '-p', provider]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });

  it('creates profile & map with one usecase', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([documentName, '-u', 'SendSMS', '-p', 'twillio']);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });

  it('creates profile & map with multiple usecases', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([
      documentName,
      '-u',
      'SendSMS',
      'ReceiveSMS',
      '-p',
      provider,
    ]);
    expect(stdout.output).toContain(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    const superJson = (await SuperJson.load()).unwrap();

    expect(superJson.document).toEqual({
      profiles: {
        [documentName]: {
          file: `../${documentName}.supr`,
          providers: {
            [provider]: {
              file: `../${documentName}.${provider}.suma`,
            },
          },
        },
      },
      providers: {
        [provider]: {
          file: `../${provider}.provider.json`,
          security: [],
        },
      },
    });
  });
});
