import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { create } from '../../logic/create';
import { initSuperface } from '../../logic/init';
import Create from '.';

//Mock create logic
jest.mock('../../logic/create', () => ({
  create: jest.fn(),
}));

//Mock init logic
jest.mock('../../logic/init', () => ({
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
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sendsms';
      await expect(
        Create.run(['profile', documentName, '-q'])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'profile',
        ['Sendsms'],
        {
          middle: ['sendsms'],
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: undefined, warnCb: undefined }
      );
    });

    it('creates profile with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        Create.run(['profile', documentName, '-u', 'SendSMS'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'profile',
        ['SendSMS'],
        {
          middle: ['service'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile with multiple usecases', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      await expect(
        Create.run(['profile', documentName, '-u', 'ReceiveSMS', 'SendSMS'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'profile',
        ['ReceiveSMS', 'SendSMS'],
        {
          middle: ['service'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with one provider (with provider name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run(['map', documentName, '-p', provider])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'map',
        ['Service'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates map with one usecase and provider', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run(['map', documentName, '-u', 'SendSMS', '-p', provider])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'map',
        ['SendSMS'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
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
          'map',
          documentName,
          '-p',
          'twilio',
          '-u',
          'ReceiveSMS',
          'SendSMS',
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'map',
        ['ReceiveSMS', 'SendSMS'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with one provider (with provider name from cli)', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([documentName, '-p', provider])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'both',
        ['Service'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('creates profile & map with one usecase', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twilio';
      await expect(
        Create.run([documentName, '-u', 'SendSMS', '-p', 'twilio'])
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'both',
        ['SendSMS'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
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
          documentName,
          '-u',
          'SendSMS',
          'ReceiveSMS',
          '-p',
          provider,
        ])
      ).resolves.toBeUndefined();
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        'superface',
        'both',
        ['SendSMS', 'ReceiveSMS'],
        {
          middle: ['service', 'twilio'],
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        'empty',
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
    });

    it('throws error on invalid command', async () => {
      await expect(Create.run(['profile', 'map', 'test'])).rejects.toEqual(
        new CLIError('Invalid command!')
      );
    });

    it('throws error on invalid create mode', async () => {
      await expect(Create.run(['test', 'test'])).rejects.toEqual(
        new CLIError('Could not infer create mode')
      );
    });

    it('throws error on invalid document name', async () => {
      await expect(Create.run(['map'])).rejects.toEqual(
        new CLIError('Name of your document is reserved!')
      );

      await expect(Create.run(['profile'])).rejects.toEqual(
        new CLIError('Name of your document is reserved!')
      );

      await expect(Create.run(['both'])).rejects.toEqual(
        new CLIError('Name of your document is reserved!')
      );
    });

    it('throws error on invalid document', async () => {
      documentName = 'vT_7!';
      await expect(
        Create.run(['profile', documentName, '-u', 'SendSMS'])
      ).rejects.toEqual(
        new CLIError('"vT_7!" is not a valid lowercase identifier')
      );
    });

    it('throws error on invalid version', async () => {
      documentName = 'test';
      await expect(
        Create.run(['profile', documentName, '-v', '', '-u', 'SendSMS'])
      ).rejects.toEqual(
        new CLIError(
          'could not parse version: major component is not a valid number'
        )
      );
    });

    it('throws error on invalid usecase', async () => {
      documentName = 'test';
      await expect(
        Create.run(['profile', documentName, '-u', '7_L§'])
      ).rejects.toEqual(new CLIError('Invalid usecase name: 7_L§'));
    });
  });
});
