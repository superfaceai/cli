import * as fs from 'fs';
import { stderr, stdout } from 'stdout-stderr';

import Create from './create';
import Lint from './lint';

describe('Create CLI command', () => {
  let documentName: string;

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();

    const path = `${__dirname}/${documentName}`;

    if (fs.existsSync(`${path}.supr`)) {
      fs.unlinkSync(`${path}.supr`);
    }
    if (fs.existsSync(`${path}.suma`)) {
      fs.unlinkSync(`${path}.suma`);
    }
  });

  it('creates profile with one usecase (with usecase name from cli)', async () => {
    documentName = 'SendSMS';
    await Create.run(['-t', 'profile', documentName]);
    expect(stdout.output).toEqual(
      `-> Created SendSMS.supr (id = "https://example.com/profile/SendSMS")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile with one usecase', async () => {
    documentName = 'SMSService';
    await Create.run(['-t', 'profile', documentName, '-u', 'SendSMS']);
    expect(stdout.output).toEqual(
      `-> Created SMSService.supr (id = "https://example.com/profile/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile with multiple usecases', async () => {
    documentName = 'SMSService';
    await Create.run([
      '-t',
      'profile',
      documentName,
      '-u',
      'ReceiveSMS',
      'SendSMS',
    ]);
    expect(stdout.output).toEqual(
      `-> Created SMSService.supr (id = "https://example.com/profile/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates map with one usecase (with usecase name from cli)', async () => {
    documentName = 'SendSMS';
    await Create.run(['-t', 'map', documentName, '-p', 'Twillio']);
    expect(stdout.output).toEqual(
      `-> Created SendSMS.suma (provider = Twillio, id = "https://example.com/Twillio/SendSMS")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates map with one usecase', async () => {
    documentName = 'SMSService';
    await Create.run(['-t', 'map', documentName, '-u', 'SendSMS']);
    expect(stdout.output).toEqual(
      `-> Created SMSService.suma (provider = Twillio, id = "https://example.com/Twillio/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates map with mutiple usecases', async () => {
    documentName = 'SMSService';
    await Create.run([
      '-t',
      'map',
      documentName,
      '-p',
      'Twillio',
      '-u',
      'ReceiveSMS',
      'SendSMS',
    ]);
    expect(stdout.output).toEqual(
      `-> Created SMSService.suma (provider = Twillio, id = "https://example.com/Twillio/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile & map with one usecase (with usecase name from cli)', async () => {
    documentName = 'SendSMS';
    await Create.run([documentName, '-p', 'Twillio']);
    expect(stdout.output).toEqual(
      `-> Created SendSMS.supr (id = "https://example.com/profile/SendSMS")\n-> Created SendSMS.suma (provider = Twillio, id = "https://example.com/Twillio/SendSMS")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile & map with one usecase', async () => {
    documentName = 'SMSService';
    await Create.run([documentName, '-u', 'SendSMS', '-p', 'Twillio']);
    expect(stdout.output).toEqual(
      `-> Created SMSService.supr (id = "https://example.com/profile/SMSService")\n-> Created SMSService.suma (provider = Twillio, id = "https://example.com/Twillio/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('creates profile & map with multiple usecases', async () => {
    documentName = 'SMSService';
    await Create.run([
      documentName,
      '-u',
      'SendSMS',
      'ReceiveSMS',
      '-p',
      'Twillio',
    ]);
    expect(stdout.output).toEqual(
      `-> Created SMSService.supr (id = "https://example.com/profile/SMSService")\n-> Created SMSService.suma (provider = Twillio, id = "https://example.com/Twillio/SMSService")\n`
    );

    await Lint.run([`${__dirname}/${documentName}.supr`]);
    expect(stdout.output).toContain('Detected 0 problems\n');

    await Lint.run([`${__dirname}/${documentName}.suma`]);
    expect(stdout.output).toContain('Detected 0 problems\n');
  });
});
