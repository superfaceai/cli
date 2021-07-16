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
    const provider = 'twilio';
    const superPath = 'some/path';
    const profileId = 'sms';

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
      mocked(detectSuperJson).mockResolvedValue(superPath);

      await expect(
        Configure.run([provider, '-p', profileId])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(installProvider).toHaveBeenCalledTimes(1);
      expect(installProvider).toHaveBeenCalledWith({
        superPath,
        provider,
        profileId,
        defaults: undefined,
        options: {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        },
      });
    });

    it('configures provider with superface initialization', async () => {
      mocked(isValidDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson());

      await expect(
        Configure.run([provider, '-p', profileId, '-q'])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        './',
        { profiles: {}, providers: {} },
        { logCb: undefined }
      );

      expect(installProvider).toHaveBeenCalledTimes(1);
      expect(installProvider).toHaveBeenCalledWith({
        superPath: 'superface',
        provider,
        profileId,
        defaults: undefined,
        options: {
          force: false,
          local: false,
          logCb: undefined,
          warnCb: undefined,
        },
      });
    });
  });
});
