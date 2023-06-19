import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { prepareProviderJson } from '../logic/prepare';
import { mockProviderJson } from '../test/provider-json';
import { CommandInstance } from '../test/utils';
import Prepare from './prepare';

jest.mock('../logic/prepare');
jest.mock('../common/io');
jest.mock('../common/output-stream');

describe('prepare CLI command', () => {
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running prepare command', () => {
    const originalWriteOnce = OutputStream.writeOnce;

    let mockWriteOnce: jest.Mock;
    let instance: Prepare;
    let logger: MockLogger;

    beforeAll(() => {
      // Mock static side of OutputStream
      mockWriteOnce = jest.fn();
      OutputStream.writeOnce = mockWriteOnce;
    });

    beforeEach(() => {
      instance = CommandInstance(Prepare);
      logger = new MockLogger();
    });

    afterAll(() => {
      // Restore static side of OutputStream
      OutputStream.writeOnce = originalWriteOnce;
    });

    it('throws when first argument is not provided', async () => {
      await expect(
        instance.execute({ logger, userError, flags: {}, args: {} })
      ).rejects.toThrow(
        'Missing first argument, please provide URL or filepath of API documentation.'
      );
    });

    it('throws when filepath leads to unsupported file', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { urlOrPath: 'path/to/file.py' },
        })
      ).rejects.toThrow(
        'Invalid file extension. Supported extensions are: .txt, .json, .yaml, .yml.'
      );
    });

    it('throws when filepath leads to not existing file', async () => {
      jest.mocked(exists).mockResolvedValueOnce(false);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { urlOrPath: 'path/to/file.yaml' },
        })
      ).rejects.toThrow('File path/to/file.yaml does not exist.');
    });

    it('throws when reading of file fails', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockRejectedValueOnce(new Error('File read error'));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { urlOrPath: 'path/to/file.yaml' },
        })
      ).rejects.toThrow('Could not read file path/to/file.yaml.');
    });

    it('throws when provider already exists', async () => {
      const providerJson = mockProviderJson();
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce('file content');
      jest.mocked(prepareProviderJson).mockResolvedValueOnce(providerJson);
      jest.mocked(exists).mockResolvedValueOnce(true);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { urlOrPath: 'path/to/file.yaml' },
        })
      ).rejects.toThrow(`Provider ${providerJson.name} already exists.`);
    });

    it('prepares provider json from url', async () => {
      const providerJson = mockProviderJson();
      jest.mocked(exists).mockResolvedValue(false);
      jest.mocked(prepareProviderJson).mockResolvedValueOnce(providerJson);
      const url = 'https://geocode.search.hereapi.com/oas.yaml';

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { urlOrPath: url },
      });

      expect(prepareProviderJson).toHaveBeenCalledWith(
        {
          urlOrSource: url,
          name: undefined,
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${providerJson.name}.provider.json`),
        JSON.stringify(providerJson, null, 2)
      );
    });

    it('prepares provider json from url - with name', async () => {
      const name = 'test';
      const providerJson = mockProviderJson({ name });
      jest.mocked(exists).mockResolvedValue(false);
      jest.mocked(prepareProviderJson).mockResolvedValueOnce(providerJson);
      const url = 'https://geocode.search.hereapi.com/oas.yaml';

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { urlOrPath: url, name },
      });

      expect(prepareProviderJson).toHaveBeenCalledWith(
        {
          urlOrSource: url,
          name,
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${name}.provider.json`),
        JSON.stringify(providerJson, null, 2)
      );
    });

    it('prepares provider json from file', async () => {
      const fileContent = 'file content';
      const providerJson = mockProviderJson();
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest.mocked(readFile).mockResolvedValueOnce(fileContent);
      jest.mocked(prepareProviderJson).mockResolvedValueOnce(providerJson);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { urlOrPath: 'path/to/file.yaml' },
      });

      expect(prepareProviderJson).toHaveBeenCalledWith(
        {
          urlOrSource: fileContent,
          name: 'file',
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${providerJson.name}.provider.json`),
        JSON.stringify(providerJson, null, 2)
      );
    });

    it('prepares provider json from file - with name', async () => {
      const fileContent = 'file content';
      const name = 'test';
      const providerJson = mockProviderJson({ name });
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest.mocked(readFile).mockResolvedValueOnce(fileContent);
      jest.mocked(prepareProviderJson).mockResolvedValueOnce(providerJson);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { urlOrPath: 'path/to/name.yaml', name },
      });

      expect(prepareProviderJson).toHaveBeenCalledWith(
        {
          urlOrSource: fileContent,
          name,
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${name}.provider.json`),
        JSON.stringify(providerJson, null, 2)
      );
    });
  });
});
