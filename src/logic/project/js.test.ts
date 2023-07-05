import { MockLogger } from '../../common';
import { buildProjectDefinitionFilePath } from '../../common/file-structure';
import { exists } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import { SupportedLanguages } from '../application-code';
import { prepareJsProject } from './js';

jest.mock('../../common/output-stream');
jest.mock('../../common/io');

describe('prepareJsProject', () => {
  const originalWriteOnce = OutputStream.writeOnce;

  let mockWriteOnce: jest.Mock;

  let logger: MockLogger;

  beforeAll(() => {
    // Mock static side of OutputStream
    mockWriteOnce = jest.fn();
    OutputStream.writeOnce = mockWriteOnce;
  });

  afterAll(() => {
    // Restore static side of OutputStream
    OutputStream.writeOnce = originalWriteOnce;
  });

  beforeEach(() => {
    logger = new MockLogger();

    jest.clearAllMocks();
  });

  it('creates package.json if it does not exist', async () => {
    jest.mocked(exists).mockResolvedValueOnce(false);

    await prepareJsProject('3.0.0-alpha.12', '^16.0.3', { logger });

    expect(mockWriteOnce).toHaveBeenCalledWith(
      buildProjectDefinitionFilePath(SupportedLanguages.JS),
      expect.any(String)
    );
  });

  it('does not create package.json if it exists', async () => {
    jest.mocked(exists).mockResolvedValueOnce(true);

    await prepareJsProject('3.0.0-alpha.12', '^16.0.3', { logger });

    expect(mockWriteOnce).not.toHaveBeenCalled();
  });
});
