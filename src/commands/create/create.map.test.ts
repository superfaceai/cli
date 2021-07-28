import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { META_FILE, SUPERFACE_DIR } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { createMap } from '../../logic/create';
import { initSuperface } from '../../logic/init';
import CreateMap from './map';

//Mock create logic
jest.mock('../../logic/create', () => ({
  createMap: jest.fn(),
}));

//Mock init logic
jest.mock('../../logic/init', () => ({
  initSuperface: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

describe('Create map CLI command', () => {
  let documentName: string;
  let provider: string;
  let mockSuperJson: SuperJson;

  beforeEach(() => {
    mockSuperJson = new SuperJson({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mocked(createMap).mockResolvedValue(undefined);
  });

  describe('when running create map command', () => {
    it('exits when user does not want to init superface', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: false });

      documentName = 'sendsms';
      provider = 'twillio';
      await expect(
        CreateMap.run([documentName, '-p', provider])
      ).rejects.toEqual(new CLIError('EEXIT: 0'));

      expect(loadSpy).not.toHaveBeenCalled();
      expect(createMap).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('creates map using new super.json with one usecase (with usecase name from cli) and quiet flag', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err('test'));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sendsms';
      provider = 'twillio';

      await expect(
        CreateMap.run([documentName, '-p', provider, '-q'])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith(joinPath(SUPERFACE_DIR, META_FILE));
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        new SuperJson({}),
        {
          name: documentName,
          provider,
          variant: '',
          scope: undefined,
          version: { major: 1, minor: 0, patch: 0, label: undefined },
        },
        ['Sendsms'],
        { logCb: undefined }
      );
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('creates map with one usecase', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';
      provider = 'twillio';

      await expect(
        CreateMap.run([documentName, '-p', provider, '-u', 'SendSMS'])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith(joinPath(SUPERFACE_DIR, META_FILE));
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        mockSuperJson,
        {
          name: 'service',
          provider,
          variant: '',
          scope: 'sms',
          version: { major: 1, minor: 0, patch: 0, label: undefined },
        },
        ['SendSMS'],
        { logCb: expect.anything() }
      );
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('creates map with multiple usecases', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      documentName = 'sms/service';

      await expect(
        CreateMap.run([
          documentName,
          '-p',
          provider,
          '-u',
          'ReceiveSMS',
          'SendSMS',
        ])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith(joinPath(SUPERFACE_DIR, META_FILE));
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(
        '',
        mockSuperJson,
        {
          name: 'service',
          provider,
          variant: '',
          scope: 'sms',
          version: { major: 1, minor: 0, patch: 0, label: undefined },
        },
        ['ReceiveSMS', 'SendSMS'],
        { logCb: expect.anything() }
      );
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error on invalid document name', async () => {
      await expect(CreateMap.run(['map', '-p', 'test'])).rejects.toEqual(
        new CLIError('Name of your document is reserved!')
      );

      await expect(CreateMap.run(['profile', '-p', 'test'])).rejects.toEqual(
        new CLIError('Name of your document is reserved!')
      );
    });

    it('throws error on invalid document', async () => {
      documentName = 'vT_7!';
      provider = 'twillio';
      await expect(
        CreateMap.run([documentName, '-p', provider, '-u', 'SendSMS'])
      ).rejects.toEqual(
        new CLIError('"vT_7!" is not a valid lowercase identifier')
      );
    });

    it('throws error on invalid usecase', async () => {
      documentName = 'test';
      provider = 'twillio';
      await expect(
        CreateMap.run([documentName, '-p', provider, '-u', '7_L§'])
      ).rejects.toEqual(new CLIError('Invalid usecase name: 7_L§'));
    });
  });
});
