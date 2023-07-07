import { buildProjectDefinitionFilePath } from '../../../common/file-structure';
import { exists } from '../../../common/io';
import { OutputStream } from '../../../common/output-stream';
import { SupportedLanguages } from '../../application-code';
import { preparePythonProject } from './python';

jest.mock('../../../common/output-stream');
jest.mock('../../../common/io');

describe('preparePythonProject', () => {
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

    await expect(preparePythonProject('3.0.0-alpha.12')).resolves.toEqual({
      saved: true,
      installationGuide: expect.any(String),
      path: expect.stringContaining('superface/requirements.txt'),
    });

    expect(mockWriteOnce).toHaveBeenCalledWith(
      buildProjectDefinitionFilePath(SupportedLanguages.PYTHON),
      expect.any(String)
    );
  });

  it('does not create package.json if it exists', async () => {
    jest.mocked(exists).mockResolvedValueOnce(true);

    await expect(preparePythonProject('3.0.0-alpha.12')).resolves.toEqual({
      saved: false,
      installationGuide: expect.any(String),
      path: expect.stringContaining('superface/requirements.txt'),
    });

    expect(mockWriteOnce).not.toHaveBeenCalled();
  });
});
