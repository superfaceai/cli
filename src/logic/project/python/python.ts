import { buildProjectDefinitionFilePath } from '../../../common/file-structure';
import { exists } from '../../../common/io';
import { OutputStream } from '../../../common/output-stream';
import { SupportedLanguages } from '../../application-code';

export async function preparePythonProject(sdkVerion = '1.0.0b0'): Promise<{
  saved: boolean;
  installationGuide: string;
  path: string;
}> {
  // TODO: revisit when SDK supports python
  const requirements = `
one-sdk==${sdkVerion}
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

  const installationGuide = `You need to have Python version 3.0.0 or higher installed to run the integration. You can check used dependencies in: ${requirementsPath}\nYou can install defined dependencies by running \`python3 -m pip install -r requirements.txt\` in \`superface\` directory.`;

  if (!(await exists(requirementsPath))) {
    await OutputStream.writeOnce(requirementsPath, requirements);

    return { saved: true, installationGuide, path: requirementsPath };
  }

  return { saved: false, installationGuide, path: requirementsPath };
}
