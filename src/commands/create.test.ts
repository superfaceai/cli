import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR, MockLogger } from '../common';
import { createUserError } from '../common/error';
import { exists, mkdirQuiet } from '../common/io';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import { CommandInstance } from '../test/utils';
import Create from './create';

jest.mock('../common/io', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/io'),
  exists: jest.fn(),
  mkdirQuiet: jest.fn(),
}));
jest.mock('../logic/create', () => ({
  create: jest.fn(),
}));
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));
jest.mock('inquirer');

describe('Create CLI command', () => {
  const userError = createUserError(false);
  let documentName: string;
  let provider: string;
  let logger: MockLogger;
  let instance: Create;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Create);
    mocked(create).mockResolvedValue(undefined);
  });

  describe('when running create command', () => {
    //Init, no init flags
    it('creates profile with one usecase (with usecase name from cli) and no init flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      documentName = 'sendsms';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            profile: true,
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            ['no-init']: true,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [],
            scope: undefined,
            usecases: ['Sendsms'],
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: undefined },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(initSuperface).not.toHaveBeenCalled();
    });
    it('creates profile with one usecase and init flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      documentName = 'sendsms';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            profile: true,
            usecase: ['SendSMS'],
            init: true,
            providerName: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [],
            scope: undefined,
            usecases: ['SendSMS'],
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths:
            //Pass the super path
            { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
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
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths:
            //Pass the super path
            { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
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
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: undefined },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
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
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            ['no-super-json']: true,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: undefined },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
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
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            profile: true,
            quiet: true,
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'sendsms',
            providerNames: [],
            usecases: ['Sendsms'],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            profile: true,
            providerName: [],
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'service',
            providerNames: [],
            usecases: ['SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['ReceiveSMS', 'SendSMS'],
            profile: true,
            providerName: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'service',
            providerNames: [],
            usecases: ['ReceiveSMS', 'SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile with multiple usecases and version and basePath', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(exists).mockResolvedValue(true);
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['ReceiveSMS', 'SendSMS'],
            profile: true,
            version: '1.1-rev133',
            path: 'test',
            providerName: [],
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: false,
          document: {
            name: 'service',
            providerNames: [],
            usecases: ['ReceiveSMS', 'SendSMS'],
            scope: 'sms',
            version: { label: 'rev133', major: 1, minor: 1, patch: undefined },
          },
          paths: { basePath: 'test', superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    //Map
    it('creates one map', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['Service'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates two maps with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider, secondProvider],
            usecase: ['ReceiveSMS', 'SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            map: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'service',
            usecases: ['ReceiveSMS', 'SendSMS'],
            providerNames: [provider, secondProvider],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });
    //Provider
    it('creates one provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [provider],
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            provider: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: false,
          provider: true,
          document: {
            providerNames: [provider],
            usecases: [],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [provider, secondProvider],
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            provider: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: false,
          provider: true,
          document: {
            providerNames: [provider, secondProvider],
            usecases: [],
            scope: undefined,
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });
    //Profile and provider
    it('creates profile and provider with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS'],
            providerName: ['twilio'],
            provider: true,
            profile: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: true,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile with mutiple usecases and two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS', 'ReciveSMS'],
            providerName: [provider, secondProvider],
            provider: true,
            profile: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: true,
          document: {
            name: 'service',
            providerNames: [provider, secondProvider],
            usecases: ['SendSMS', 'ReciveSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile with mutiple usecases, version flag and two providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS', 'ReciveSMS'],
            providerName: [provider, secondProvider],
            version: '1.1-rev133',
            provider: true,
            profile: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: false,
          provider: true,
          document: {
            name: 'service',
            providerNames: [provider, secondProvider],
            usecases: ['SendSMS', 'ReciveSMS'],
            scope: 'sms',
            version: { label: 'rev133', major: 1, minor: 1, patch: undefined },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });
    //Profile and map
    it('creates profile & map with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS'],
            providerName: ['twilio'],
            version: DEFAULT_PROFILE_VERSION_STR,
            map: true,
            profile: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: false,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile & map with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS', 'ReceiveSMS'],
            providerName: [provider],
            profile: true,
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: false,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['SendSMS', 'ReceiveSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile & multiple maps with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      const secondProvider = 'tyntec';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS', 'ReceiveSMS'],
            providerName: [provider, secondProvider],
            profile: true,
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: false,
          document: {
            name: 'service',
            providerNames: [provider, secondProvider],
            usecases: ['SendSMS', 'ReceiveSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });
    //Map and provider
    it('creates map with one provider (with provider name from cli) and variant', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            variant: 'bugfix',
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: false,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['Service'],
            variant: 'bugfix',
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates map with one usecase and provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS'],
            providerName: [provider],
            map: true,
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: true,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates map with mutiple usecases and one provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: ['twilio'],
            usecase: ['ReceiveSMS', 'SendSMS'],
            provider: true,
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: false,
          map: true,
          provider: true,
          document: {
            name: 'service',
            providerNames: [provider],
            usecases: ['ReceiveSMS', 'SendSMS'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });
    //Map, profile and provider
    it('creates profile & map with one provider (with provider name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            profile: true,
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: true,
          document: {
            name: 'service',
            providerNames: ['twilio'],
            usecases: ['Service'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
    });

    it('creates profile & map with one provider and file names flags', async () => {
      const mockProfileFileName = 'test-profile';
      const mockProviderFileName = 'test-provider';
      const mockMapFileName = 'test-map';

      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            profile: true,
            provider: true,
            mapFileName: mockMapFileName,
            profileFileName: mockProfileFileName,
            providerFileName: mockProviderFileName,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: true,
          document: {
            name: 'service',
            providerNames: ['twilio'],
            usecases: ['Service'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: undefined, superPath: 'superface' },
          fileNames: {
            map: mockMapFileName,
            profile: mockProfileFileName,
            provider: mockProviderFileName,
          },
        },
        expect.anything()
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
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: [provider],
            map: true,
            profile: true,
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            path,
          },
        })
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        {
          profile: true,
          map: true,
          provider: true,
          document: {
            name: 'service',
            providerNames: ['twilio'],
            usecases: ['Service'],
            scope: 'sms',
            version: { label: undefined, major: 1, minor: 0, patch: 0 },
          },
          paths: { basePath: path, superPath: 'superface' },
          fileNames: {
            map: undefined,
            profile: undefined,
            provider: undefined,
          },
        },
        expect.anything()
      );
      expect(mkdirQuiet).not.toHaveBeenCalled();
    });

    it('throws error on mutiple provider names and single provider file name', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(exists).mockResolvedValue(true);
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      const path = 'some';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: ['first', 'second'],
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            path,
            providerFileName: 'test',
          },
        })
      ).rejects.toThrow(
        'Unable to create mutiple providers with same file name: "test"'
      );

      expect(create).not.toHaveBeenCalled();
      expect(mkdirQuiet).not.toHaveBeenCalled();
    });

    it('throws error on mutiple provider names and single map file name', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(exists).mockResolvedValue(true);
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      const path = 'some';
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            providerName: ['first', 'second'],
            map: true,
            profile: true,
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            path,
            mapFileName: 'test',
          },
        })
      ).rejects.toThrow(
        'Unable to create mutiple maps with same file name: "test"'
      );

      expect(create).not.toHaveBeenCalled();
      expect(mkdirQuiet).not.toHaveBeenCalled();
    });

    it('throws error on invalid document name', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'map',
            profile: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            providerName: [],
          },
        })
      ).rejects.toThrow('ProfileId is reserved!');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'profile',
            profile: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            providerName: [],
          },
        })
      ).rejects.toThrow('ProfileId is reserved!');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: ['map'],
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
          },
        })
      ).rejects.toThrow('ProviderName "map" is reserved!');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: ['profile'],
            provider: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
          },
        })
      ).rejects.toThrow('ProviderName "profile" is reserved!');
    });

    it('throws error on missing profileId and providerNamse', async () => {
      await expect(Create.run([])).rejects.toThrow(
        'Invalid command! Specify profileId or providerName'
      );
    });

    it('throws error on invalid variant', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'sms/service',
            providerName: ['twilio'],
            map: true,
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            variant: 'vT_7!',
          },
        })
      ).rejects.toThrow('Invalid map variant: vT_7!');
    });

    it('throws error on invalid provider name', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'sms/service',
            version: DEFAULT_PROFILE_VERSION_STR,
            usecase: [],
            providerName: ['vT_7!'],
            map: true,
          },
        })
      ).rejects.toThrow('Invalid provider name: vT_7!');
    });

    it('throws error on invalid document', async () => {
      documentName = 'vT_7!';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['SendSMS'],
            providerName: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            profile: true,
          },
        })
      ).rejects.toThrow('"vT_7!" is not a valid lowercase identifier');
    });

    it('throws error on invalid version', async () => {
      documentName = 'test';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            version: '',
            usecase: ['SendSMS'],
            profile: true,
            providerName: [],
          },
        })
      ).rejects.toThrow(' is not a valid version');
    });

    it('throws error on invalid usecase', async () => {
      documentName = 'test';

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: documentName,
            usecase: ['7_L§'],
            version: DEFAULT_PROFILE_VERSION_STR,
            providerName: [],
            profile: true,
          },
        })
      ).rejects.toThrow('Invalid usecase name: 7_L§');
    });
  });
});
