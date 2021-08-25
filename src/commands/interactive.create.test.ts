import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import Create from './create';

//Mock create logic
jest.mock('../logic/create', () => ({
  create: jest.fn(),
}));

//Mock init logic
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

describe('Interactive create CLI command', () => {
  let documentName: string;
  let provider: string;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mocked(create).mockResolvedValue(undefined);
  });

  describe('when running create command', () => {
    it('creates profile with one usecase (with usecase name from cli) with path flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sendsms';
      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: false })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-i', '-p', 'test'])).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['Sendsms'],
        {
          name: 'sendsms',
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Pass the base path
        'test',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: false })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'SendSMS', '-i'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['SendSMS'],
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: false })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'ReceiveSMS', 'SendSMS', '-i'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['ReceiveSMS', 'SendSMS'],
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with one provider (with provider name from cli) and variant', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: false })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: provider })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-i', '-t', 'bugfix'])).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['Service'],
        {
          name: 'service',
          providerNames: ['twilio'],
          variant: 'bugfix',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates multiple maps', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: false })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: 'twilio' })
        .mockResolvedValueOnce({ input: 'tyntec' })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-i', '-t', 'bugfix'])).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['Service'],
        {
          name: 'service',
          providerNames: ['twilio', 'tyntec'],
          variant: 'bugfix',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with one usecase and provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: false })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: true })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: provider })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'SendSMS', '-i'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: true },
        ['SendSMS'],
        {
          name: 'service',
          providerNames: ['twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with mutiple usecases and one provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: false })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: true })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: 'twilio' })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'ReceiveSMS', 'SendSMS', '-i'])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: true },
        ['ReceiveSMS', 'SendSMS'],
        {
          name: 'service',
          providerNames: ['twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with one provider (with provider name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: true })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: provider })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-i'])).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: true },
        ['Service'],
        {
          name: 'service',
          providerNames: ['twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: 'twilio' })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'SendSMS', '-i'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: false },
        ['SendSMS'],
        {
          name: 'service',
          providerNames: ['twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      documentName = 'sms/service';
      provider = 'twilio';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider
        .mockResolvedValueOnce({ input: provider })
        .mockResolvedValueOnce({ input: undefined })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-u', 'SendSMS', 'ReceiveSMS', '-i'])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: false },
        ['SendSMS', 'ReceiveSMS'],
        {
          name: 'service',
          providerNames: ['twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'superface',
        //Do not pass the base path
        undefined,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('throws error on invalid command', async () => {
      await expect(Create.run(['profile'])).rejects.toEqual(
        new CLIError('Invalid command! Specify profileId or providerName')
      );
    });

    it('throws error on invalid document name', async () => {
      await expect(
        Create.run(['--profileId', 'map', '--profile'])
      ).rejects.toEqual(new CLIError('ProfileId is reserved!'));

      await expect(
        Create.run(['--profileId', 'profile', '--profile'])
      ).rejects.toEqual(new CLIError('ProfileId is reserved!'));

      await expect(
        Create.run(['--providerName', 'map', '--provider'])
      ).rejects.toEqual(new CLIError('ProviderName "map" is reserved!'));

      await expect(
        Create.run(['--providerName', 'profile', '--provider'])
      ).rejects.toEqual(new CLIError('ProviderName "profile" is reserved!'));
    });

    it('throws error on invalid variant', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run([
          '--profileId',
          'sms/service',
          '--providerName',
          'twilio',
          '-t',
          'vT_7!',
          '--profile',
          '--map',
        ])
      ).rejects.toEqual(new CLIError('Invalid map variant: vT_7!'));
    });

    it('throws error on invalid provider name', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: 'sms/service' })
        //Provider name
        .mockResolvedValueOnce({ input: 'vT_7!' })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-i'])).rejects.toEqual(
        new CLIError('Invalid provider name: vT_7!')
      );
    });

    it('throws error on invalid profile name', async () => {
      documentName = 'vT_7!';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider name
        .mockResolvedValueOnce({ input: 'twilio' })
        //Init
        .mockResolvedValueOnce({ init: true });
      await expect(Create.run(['-u', 'SendSMS', '-i'])).rejects.toEqual(
        new CLIError('"vT_7!" is not a valid lowercase identifier')
      );
    });

    it('throws error on invalid version', async () => {
      documentName = 'test';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider name
        .mockResolvedValueOnce({ input: 'twilio' })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['-v', '', '-u', 'SendSMS', '-i'])
      ).rejects.toEqual(
        new CLIError(
          'could not parse version: major component is not a valid number'
        )
      );
    });

    it('throws error on invalid usecase', async () => {
      documentName = 'test';

      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ create: true })
        //Create map
        .mockResolvedValueOnce({ create: true })
        //Create provider
        .mockResolvedValueOnce({ create: false })
        //Profile ID
        .mockResolvedValueOnce({ input: documentName })
        //Provider name
        .mockResolvedValueOnce({ input: 'twilio' })
        //Init
        .mockResolvedValueOnce({ init: true });

      await expect(Create.run(['-u', '7_L§', '-i'])).rejects.toEqual(
        new CLIError('Invalid usecase name: 7_L§')
      );
    });
  });
});
