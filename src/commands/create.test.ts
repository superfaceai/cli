import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/sdk';
import { mocked } from 'ts-jest/utils';

import { createMap, createProfile, createProviderJson } from '../logic/create';
import Create from './create';

//Mock create logic
jest.mock('../logic/create', () => ({
  createMap: jest.fn(),
  createProfile: jest.fn(),
  createProviderJson: jest.fn(),
}));
describe('Create CLI command', () => {
  let documentName: string;
  let provider: string;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mocked(createProfile).mockResolvedValue(undefined);
    mocked(createMap).mockResolvedValue(undefined);
    mocked(createProviderJson).mockResolvedValue(undefined);
  });

  describe('when running create command', () => {
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      documentName = 'sendsms';
      await expect(
        Create.run(['profile', documentName])
      ).resolves.toBeUndefined();
      expect(createProviderJson).not.toHaveBeenCalled();
      expect(createMap).not.toHaveBeenCalled();
      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: documentName,
          scope: undefined,
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['Sendsms'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates profile with one usecase', async () => {
      documentName = 'sms/service';
      await expect(
        Create.run(['profile', documentName, '-u', 'SendSMS'])
      ).resolves.toBeUndefined();
      expect(createProviderJson).not.toHaveBeenCalled();
      expect(createMap).not.toHaveBeenCalled();
      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates profile with multiple usecases', async () => {
      documentName = 'sms/service';
      await expect(
        Create.run(['profile', documentName, '-u', 'ReceiveSMS', 'SendSMS'])
      ).resolves.toBeUndefined();
      expect(createProviderJson).not.toHaveBeenCalled();
      expect(createMap).not.toHaveBeenCalled();
      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['ReceiveSMS', 'SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates map with one provider (with provider name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
      await expect(
        Create.run(['map', documentName, '-p', provider])
      ).resolves.toBeUndefined();
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).not.toHaveBeenCalled();
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['Service'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates map with one usecase and provider', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
      await expect(
        Create.run(['map', documentName, '-u', 'SendSMS', '-p', provider])
      ).resolves.toBeUndefined();
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).not.toHaveBeenCalled();
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates map with mutiple usecases and one provider', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
      await expect(
        Create.run([
          'map',
          documentName,
          '-p',
          'twillio',
          '-u',
          'ReceiveSMS',
          'SendSMS',
        ])
      ).resolves.toBeUndefined();
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).not.toHaveBeenCalled();
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['ReceiveSMS', 'SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates profile & map with one provider (with provider name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
      await expect(
        Create.run([documentName, '-p', provider])
      ).resolves.toBeUndefined();

      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['Service'],
        'empty',
        { logCb: expect.anything() }
      );

      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['Service'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates profile & map with one usecase', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
      await expect(
        Create.run([documentName, '-u', 'SendSMS', '-p', 'twillio'])
      ).resolves.toBeUndefined();

      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );

      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS'],
        'empty',
        { logCb: expect.anything() }
      );
    });

    it('creates profile & map with multiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twillio';
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
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        provider,
        'empty',
        { logCb: expect.anything() }
      );

      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS', 'ReceiveSMS'],
        'empty',
        { logCb: expect.anything() }
      );

      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson(),
        {
          name: 'service',
          provider,
          scope: 'sms',
          version: { label: undefined, major: 1, minor: 0, patch: 0 },
        },
        ['SendSMS', 'ReceiveSMS'],
        'empty',
        { logCb: expect.anything() }
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

    it('throws error when provider is missing and creating map', async () => {
      documentName = 'test';
      await expect(Create.run(['map', documentName])).rejects.toEqual(
        new CLIError('Provider name must be provided when generating a map.')
      );
    });

    it('throws error when provider is missing and creating map and profile', async () => {
      documentName = 'test';
      await expect(Create.run([documentName])).rejects.toEqual(
        new CLIError('Provider name must be provided when generating a map.')
      );
    });
  });
});
