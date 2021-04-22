import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { validateDocumentName } from '../common/document';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';
import Configure from './configure';

//Mock init logic
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock configure logic
jest.mock('../logic/configure', () => ({
  installProvider: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

//Mock document
jest.mock('../common/document');

describe('Configure CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running play command', () => {
    const mockProvider = 'twilio';
    const mockPath = 'some/path';
    const mockProfile = 'sms';

    it('does not configure on invalid provider name', async () => {
      mocked(validateDocumentName).mockReturnValue(false);
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        Configure.run(['U7!O', '-p', 'test'])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(installProvider).not.toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('configures provider', async () => {
      mocked(validateDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(mockPath);
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        Configure.run([mockProvider, '-p', mockProfile])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(promptSpy).not.toHaveBeenCalled();

      expect(installProvider).toHaveBeenCalledTimes(1);
      expect(installProvider).toHaveBeenCalledWith(
        mockPath,
        mockProvider,
        mockProfile,
        {
          force: false,
          local: false,
          logCb: expect.any(Function),
          warnCb: expect.any(Function),
        }
      );
    });

    it('configures provider with superface initialization', async () => {
      mocked(validateDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValue({ init: true });
      mocked(initSuperface).mockResolvedValue(new SuperJson());

      await expect(
        Configure.run([mockProvider, '-p', mockProfile, '-q'])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(promptSpy).toHaveBeenCalledTimes(1);

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        './',
        { profiles: {}, providers: {} },
        { logCb: undefined }
      );

      expect(installProvider).toHaveBeenCalledTimes(1);
      expect(installProvider).toHaveBeenCalledWith(
        'superface',
        mockProvider,
        mockProfile,
        {
          force: false,
          local: false,
          logCb: undefined,
          warnCb: undefined,
        }
      );
    });

    it('does not configure provider - rejected superface initialization', async () => {
      mocked(validateDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValue({ init: false });
      mocked(initSuperface).mockResolvedValue(new SuperJson());

      await expect(
        Configure.run([mockProvider, '-p', mockProfile, '-q'])
      ).rejects.toEqual(new Error('EEXIT: 0'));

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(promptSpy).toHaveBeenCalledTimes(1);

      expect(initSuperface).not.toHaveBeenCalled();

      expect(installProvider).not.toHaveBeenCalled();
    });
  });
});
