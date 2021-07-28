import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { META_FILE, SUPERFACE_DIR } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { createProviderJson } from '../../logic/create';
import { initSuperface } from '../../logic/init';
import CreateProvider from './provider';

//Mock create logic
jest.mock('../../logic/create', () => ({
  createProviderJson: jest.fn(),
}));

//Mock init logic
jest.mock('../../logic/init', () => ({
  initSuperface: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

describe('Create provider CLI command', () => {
  let provider: string;
  let mockSuperJson: SuperJson;

  beforeEach(() => {
    mockSuperJson = new SuperJson({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mocked(createProviderJson).mockResolvedValue(undefined);
  });

  describe('when running create provider command', () => {
    it('exits when user does not want to init superface', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: false });

      provider = 'twilio';

      await expect(CreateProvider.run([provider])).rejects.toEqual(
        new CLIError('EEXIT: 0')
      );

      expect(loadSpy).not.toHaveBeenCalled();
      expect(createProviderJson).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('creates provider using new super.json', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err('test'));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';

      await expect(CreateProvider.run([provider])).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith(joinPath(SUPERFACE_DIR, META_FILE));
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        new SuperJson({}),
        'twilio',
        { logCb: expect.anything() }
      );
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('creates provider with quiet flag', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      provider = 'twilio';

      await expect(
        CreateProvider.run([provider, '-q'])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith(joinPath(SUPERFACE_DIR, META_FILE));
      expect(createProviderJson).toHaveBeenCalledTimes(1);
      expect(createProviderJson).toHaveBeenCalledWith(
        '',
        mockSuperJson,
        'twilio',
        { logCb: undefined }
      );
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });
  });
});
