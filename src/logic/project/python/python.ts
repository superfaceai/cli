import { buildProjectDefinitionFilePath } from '../../../common/file-structure';
import { exists } from '../../../common/io';
import { OutputStream } from '../../../common/output-stream';
import { SupportedLanguages } from '../../application-code';

export async function preparePythonProject(
  sdkVersion = '1b' // beta on major 1
): Promise<{
  saved: boolean;
  dependencyInstallCommand: string;
  languageDependency: string;
  path: string;
}> {
  const requirements = `one-sdk>=${sdkVersion}
python-dotenv==1.0.0
Brotli==1.0.9
certifi==2023.5.7
charset-normalizer==3.1.0
idna==3.4
urllib3==2.0.3
wasmtime==10.0.0`;

  const requirementsPath = buildProjectDefinitionFilePath(
    SupportedLanguages.PYTHON
  );

  const languageDependency = 'Python >= 3.8';
  const dependencyInstallCommand = 'python3 -m pip install -r requirements.txt';

  if (!(await exists(requirementsPath))) {
    await OutputStream.writeOnce(requirementsPath, requirements);

    return {
      saved: true,
      languageDependency,
      dependencyInstallCommand,
      path: requirementsPath,
    };
  }

  return {
    saved: false,
    languageDependency,
    dependencyInstallCommand,
    path: requirementsPath,
  };
}
