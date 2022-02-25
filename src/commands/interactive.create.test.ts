import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR, MockLogger } from '..';
import { createUserError } from '../common/error';
import { mkdirQuiet } from '../common/io';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import { CommandInstance } from '../test/utils';
import Create from './create';

jest.mock('../logic/create', () => ({
  create: jest.fn(),
}));
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));
jest.mock('inquirer');

describe('Interactive create CLI command', () => {
  let logger: MockLogger;
  let instance: Create;
  let documentName: string;
  let provider: string;
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Create);
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

      await mkdirQuiet('test');
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            path: 'test',
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['ReceiveSMS', 'SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            variant: 'bugfix',
            interactive: true,
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
            providerNames: ['twilio'],
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

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            variant: 'bugfix',
            interactive: true,
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
            providerNames: ['twilio', 'tyntec'],
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
            providerNames: ['twilio'],
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['ReceiveSMS', 'SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
            providerNames: ['twilio'],
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

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['SendSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
            providerNames: ['twilio'],
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
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: ['SendSMS', 'ReceiveSMS'],
            version: DEFAULT_PROFILE_VERSION_STR,
            interactive: true,
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
            providerNames: ['twilio'],
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

    it('throws error on invalid command', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: [],
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toThrow('Invalid command! Specify profileId or providerName');
    });

    it('throws error on invalid document name', async () => {
      await expect(
        Create.run(['--profileId', 'map', '--profile'])
      ).rejects.toThrow('ProfileId is reserved!');

      await expect(
        Create.run(['--profileId', 'profile', '--profile'])
      ).rejects.toThrow('ProfileId is reserved!');

      await expect(
        Create.run(['--providerName', 'map', '--provider'])
      ).rejects.toThrow('ProviderName "map" is reserved!');

      await expect(
        Create.run(['--providerName', 'profile', '--provider'])
      ).rejects.toThrow('ProviderName "profile" is reserved!');
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
      ).rejects.toThrow('Invalid map variant: vT_7!');
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

      await expect(Create.run(['-i'])).rejects.toThrow(
        'Invalid provider name: vT_7!'
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
      await expect(Create.run(['-u', 'SendSMS', '-i'])).rejects.toThrow(
        '"vT_7!" is not a valid lowercase identifier'
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
      ).rejects.toThrow(' is not a valid version');
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

      await expect(Create.run(['-u', '7_L§', '-i'])).rejects.toThrow(
        'Invalid usecase name: 7_L§'
      );
    });
  });
});
