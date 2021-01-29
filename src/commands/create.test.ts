import * as fs from 'fs';
import { stderr, stdout } from 'stdout-stderr';

import Create from './create';
import Lint from './lint';

describe.skip('Create CLI command', () => {
  let documentName: string, provider: string, variant: string | undefined;

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();

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
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile with one usecase', async () => {
    documentName = 'sms/service';
    await Create.run(['profile', documentName, '-u', 'SendSMS']);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile with multiple usecases', async () => {
    documentName = 'sms/service';
    await Create.run(['profile', documentName, '-u', 'ReceiveSMS', 'SendSMS']);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates map with one usecase (with usecase name from cli)', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run(['map', documentName, '-p', provider]);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates map with one usecase', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run(['map', documentName, '-u', 'SendSMS', '-p', provider]);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
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
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile & map with one usecase (with usecase name from cli)', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([documentName, '-p', provider]);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile & map with one usecase', async () => {
    documentName = 'sms/service';
    provider = 'twillio';
    await Create.run([documentName, '-u', 'SendSMS', '-p', 'twillio']);
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
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
    expect(stdout.output).toEqual(
      `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")\n-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0.0", provider = "${provider}")\n-> Created ${provider}.provider.json\n`
    );

    await Lint.run([`${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${documentName}.${provider}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });
});
