import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { exists, mkdirQuiet } from '../common/io';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import Create from './create';

//Mock io
jest.mock('../common/io', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/io'),
  exists: jest.fn(),
  mkdirQuiet: jest.fn(),
}));

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

describe('Create CLI command', () => {
  let documentName: string;
  let provider: string;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mocked(create).mockResolvedValue(undefined);
  });

  describe('when running create command', () => {
    //Init, no init flags
    it('creates profile with one usecase (with usecase name from cli) and no init flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      documentName = 'sendsms';
      await expect(
        Create.run(['--profileId', documentName, '--profile', '--no-init'])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['Sendsms'],
        {
          name: 'sendsms',
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: undefined },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(initSuperface).not.toHaveBeenCalled();
    });
    it('creates profile with one usecase and init flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      documentName = 'sendsms';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--profile',
          '-u',
          'SendSMS',
          '--init',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['SendSMS'],
        {
          name: 'sendsms',
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        //Pass the super path
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(initSuperface).toHaveBeenCalledTimes(1);
    });

    it('creates map with one usecase and no init or no-init flag, user confirms prompt', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ init: true });

      documentName = 'sendsms';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '-u',
          'SendSMS',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['SendSMS'],
        {
          name: 'sendsms',
          providerNames: [provider],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        //Pass the super path
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledTimes(1);
    });
    it('creates map with one usecase and no init or no-init flag, user does not confirm prompt', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ init: false });

      documentName = 'sendsms';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '-u',
          'SendSMS',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['SendSMS'],
        {
          name: 'sendsms',
          providerNames: [provider],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: undefined },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(initSuperface).not.toHaveBeenCalled();
    });
    //No-super-json flag
    it('creates map with one usecase and  no-super.json flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ init: true });

      documentName = 'sendsms';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '-u',
          'SendSMS',
          '--no-super-json',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['SendSMS'],
        {
          name: 'sendsms',
          providerNames: [provider],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: undefined },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      //We prompt user and init SF but not pass path to create logic
      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalled();
    });
    //Profile
    it('creates profile with one usecase (with usecase name from cli) and quiet flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sendsms';
      await expect(
        Create.run(['--profileId', documentName, '--profile', '-q'])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['Sendsms'],
        {
          name: 'sendsms',
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: undefined, warnCb: undefined }
      );
    });

    it('creates profile with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        Create.run(['--profileId', documentName, '-u', 'SendSMS', '--profile'])
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
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--profile',
        ])
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
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with multiple usecases and version and basePath', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(exists).mockResolvedValue(true);
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--profile',
          '-v',
          '1.1-rev133',
          '-p',
          'test',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: false },
        ['ReceiveSMS', 'SendSMS'],
        {
          name: 'service',
          scope: 'sms',
          version: { label: 'rev133', major: 1, minor: 1, patch: undefined },
        },
        { basePath: 'test', superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    //Map
    it('creates one map', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['Service'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates two maps with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          secondProvider,
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--map',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['ReceiveSMS', 'SendSMS'],
        {
          name: 'service',
          providerNames: [provider, secondProvider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });
    //Provider
    it('creates one provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';
      await expect(
        Create.run(['--providerName', provider, '--provider'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: false, createProvider: true },
        [],
        {
          providerNames: [provider],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        Create.run(['--providerName', provider, secondProvider, '--provider'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: false, createProvider: true },
        [],
        {
          providerNames: [provider, secondProvider],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });
    //Profile and provider
    it('creates profile and provider with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          '--providerName',
          'twilio',
          '--provider',
          '--profile',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: true },
        ['SendSMS'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with mutiple usecases and two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          'ReciveSMS',
          '--providerName',
          provider,
          secondProvider,
          '--provider',
          '--profile',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: true },
        ['SendSMS', 'ReciveSMS'],
        {
          name: 'service',
          providerNames: [provider, secondProvider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with mutiple usecases, version flag and two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          'ReciveSMS',
          '--providerName',
          provider,
          secondProvider,
          '-v',
          '1.1-rev133',
          '--provider',
          '--profile',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: false, createProvider: true },
        ['SendSMS', 'ReciveSMS'],
        {
          name: 'service',
          providerNames: [provider, secondProvider],
          scope: 'sms',
          version: { label: 'rev133', major: 1, minor: 1, patch: undefined },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });
    //Profile and map
    it('creates profile & map with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          '--providerName',
          'twilio',
          '--map',
          '--profile',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: false },
        ['SendSMS'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          'ReceiveSMS',
          '--providerName',
          provider,
          '--profile',
          '--map',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: false },
        ['SendSMS', 'ReceiveSMS'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & multiple maps with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      const secondProvider = 'tyntec';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          'ReceiveSMS',
          '--providerName',
          provider,
          secondProvider,
          '--profile',
          '--map',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: true, createMap: true, createProvider: false },
        ['SendSMS', 'ReceiveSMS'],
        {
          name: 'service',
          providerNames: [provider, secondProvider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });
    //Map and provider
    it('creates map with one provider (with provider name from cli) and variant', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '-t',
          'bugfix',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: false },
        ['Service'],
        {
          name: 'service',
          providerNames: [provider],
          variant: 'bugfix',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with one usecase and provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          '--providerName',
          provider,
          '--map',
          '--provider',
        ])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: true },
        ['SendSMS'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with mutiple usecases and one provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          'twilio',
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--provider',
          '--map',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        { createProfile: false, createMap: true, createProvider: true },
        ['ReceiveSMS', 'SendSMS'],
        {
          name: 'service',
          providerNames: [provider],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });
    //Map, profile and provider
    it('creates profile & map with one provider (with provider name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '--profile',
          '--provider',
        ])
      ).resolves.toBeUndefined();

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
        { basePath: undefined, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with one provider and file names flags', async () => {
      const mockProfileFileName = 'test-profile'
      const mockProviderFileName = 'test-provider'
      const mockMapFileName = 'test-map'

      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '--profile',
          '--provider',
          '--mapFileName',
          mockMapFileName,
          '--profileFileName',
          mockProfileFileName,
          '--providerFileName',
          mockProviderFileName
        ])
      ).resolves.toBeUndefined();

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
        { basePath: undefined, superPath: 'superface' },
        { map: mockMapFileName, profile: mockProfileFileName, provider: mockProviderFileName },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('does not create scope folder in root with path flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(exists).mockResolvedValue(true);
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const path = 'some';
      await expect(
        Create.run([
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
          '--profile',
          '--provider',
          '--path',
          path,
        ])
      ).resolves.toBeUndefined();

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
        { basePath: path, superPath: 'superface' },
        { map: undefined, profile: undefined, provider: undefined },
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(mkdirQuiet).not.toHaveBeenCalled();
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

    it('throws error on missing profileId and providerNamse', async () => {
      await expect(Create.run([])).rejects.toEqual(
        new CLIError('Invalid command! Specify profileId or providerName')
      );
    });

    it('throws error on invalid variant', async () => {
      await expect(
        Create.run([
          '--profileId',
          'sms/service',
          '--providerName',
          'twilio',
          '--map',
          '-t',
          'vT_7!',
        ])
      ).rejects.toEqual(new CLIError('Invalid map variant: vT_7!'));
    });

    it('throws error on invalid provider name', async () => {
      await expect(
        Create.run([
          '--profileId',
          'sms/service',
          '--providerName',
          'vT_7!',
          '--map',
        ])
      ).rejects.toEqual(new CLIError('Invalid provider name: vT_7!'));
    });

    it('throws error on invalid document', async () => {
      documentName = 'vT_7!';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['--profileId', documentName, '-u', 'SendSMS', '--profile'])
      ).rejects.toEqual(
        new CLIError('"vT_7!" is not a valid lowercase identifier')
      );
    });

    it('throws error on invalid version', async () => {
      documentName = 'test';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        Create.run([
          '--profileId',
          documentName,
          '-v',
          '',
          '-u',
          'SendSMS',
          '--profile',
        ])
      ).rejects.toEqual(
        new CLIError(
          'could not parse version: major component is not a valid number'
        )
      );
    });

    it('throws error on invalid usecase', async () => {
      documentName = 'test';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        Create.run(['--profileId', documentName, '-u', '7_L§', '--profile'])
      ).rejects.toEqual(new CLIError('Invalid usecase name: 7_L§'));
    });
  });
});
