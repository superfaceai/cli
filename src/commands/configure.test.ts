import { isValidDocumentName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';
import Configure from './configure';

//Mock ast
jest.mock('@superfaceai/ast', () => ({
  isValidDocumentName: jest.fn(),
}));

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

describe('Configure CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running configure command', () => {
    const mockProvider = 'twilio';
    const mockPath = 'some/path';
    const mockProfile = 'sms';

    it('does not configure on invalid provider name', async () => {
      mocked(isValidDocumentName).mockReturnValue(false);
      await expect(
        Configure.run(['U7!O', '-p', 'test'])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(installProvider).not.toHaveBeenCalled();
    });

    it('configures provider', async () => {
      mocked(isValidDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      await expect(
        Configure.run([mockProvider, '-p', mockProfile])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

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
      mocked(isValidDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson());

      await expect(
        Configure.run([mockProvider, '-p', mockProfile, '-q'])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

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
  });
});
