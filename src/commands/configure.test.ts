import { CLIError } from '@oclif/errors';
import { isValidDocumentName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { exists } from '../common/io';
import { ProfileId } from '../common/profile';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';
import Configure from './configure';

//Mock io
jest.mock('../common/io', () => ({
  exists: jest.fn(),
}));

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
    const profileId = ProfileId.fromId('sms');

    it('does not configure on invalid provider name', async () => {
      mocked(isValidDocumentName).mockReturnValue(false);
      await expect(Configure.run(['U7!O', '-p', 'test'])).rejects.toEqual(
        new CLIError('Invalid provider name')
      );

      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(installProvider).not.toHaveBeenCalled();
    });

    it('does not configure on non-existent map path', async () => {
      mocked(isValidDocumentName).mockReturnValue(false);
      mocked(exists).mockResolvedValue(false);
      await expect(
        Configure.run(['swapi', '-p', 'test', '--localMap', 'some/path'])
      ).rejects.toEqual(new CLIError('Local path: "some/path" does not exist'));

      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(installProvider).not.toHaveBeenCalled();
    });

    it('does not configure on non-existent provider path', async () => {
      mocked(isValidDocumentName).mockReturnValue(false);
      mocked(exists).mockResolvedValue(false);
      await expect(
        Configure.run(['swapi', '-p', 'test', '--localProvider', 'some/path'])
      ).rejects.toEqual(new CLIError('Local path: "some/path" does not exist'));

      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(installProvider).not.toHaveBeenCalled();
    });

    it('configures provider', async () => {
      mocked(isValidDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(superPath);

      await expect(
        Configure.run([provider, '-p', profileId.id])
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
          localMap: undefined,
          localProvider: undefined,
          updateEnv: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        },
      });
    });

    it('configures provider with env flag', async () => {
      mocked(isValidDocumentName).mockReturnValue(true);
      mocked(detectSuperJson).mockResolvedValue(superPath);

      await expect(
        Configure.run([provider, '-p', profileId.id, '--write-env'])
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
          localMap: undefined,
          localProvider: undefined,
          updateEnv: true,
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
        Configure.run([provider, '-p', profileId.id, '-q'])
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
          updateEnv: false,
          localMap: undefined,
          localProvider: undefined,
          logCb: undefined,
          warnCb: undefined,
        },
      });
    });
  });
});
