import { buildProjectDefinitionFilePath } from '../../../common/file-structure';
import { exists } from '../../../common/io';
import { OutputStream } from '../../../common/output-stream';
import { SupportedLanguages } from '../../application-code';
import { prepareJsProject } from './js';

jest.mock('../../../common/output-stream');
jest.mock('../../../common/io');

describe('prepareJsProject', () => {
  const originalWriteOnce = OutputStream.writeOnce;

  let mockWriteOnce: jest.Mock;

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
    jest.clearAllMocks();
  });

  it('creates package.json if it does not exist', async () => {
    jest.mocked(exists).mockResolvedValueOnce(false);

    await expect(
      prepareJsProject('3.0.0-alpha.12', '^16.0.3')
    ).resolves.toEqual({
      saved: true,
      dependencyInstallCommand: expect.any(String),
      languageDependency: expect.any(String),
      path: expect.stringContaining('superface/package.json'),
    });

    expect(mockWriteOnce).toHaveBeenCalledWith(
      buildProjectDefinitionFilePath(SupportedLanguages.JS),
      expect.any(String)
    );
  });

  it('does not create package.json if it exists', async () => {
    jest.mocked(exists).mockResolvedValueOnce(true);

    await expect(
      prepareJsProject('3.0.0-alpha.12', '^16.0.3')
    ).resolves.toEqual({
      saved: false,
      dependencyInstallCommand: expect.any(String),
      languageDependency: expect.any(String),
      path: expect.stringContaining('superface/package.json'),
    });

    expect(mockWriteOnce).not.toHaveBeenCalled();
  });
});
