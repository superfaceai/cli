import { buildProjectDefinitionFilePath } from '../../../common/file-structure';
import { exists } from '../../../common/io';
import { OutputStream } from '../../../common/output-stream';
import { SupportedLanguages } from '../../application-code';

export async function prepareJsProject(
  // https://www.npmjs.com/package/@superfaceai/one-sdk?activeTab=versions
  sdkVersion = 'beta', // get latest beta using the `beta` tag
  dotenvVersion = '^16.0.3'
): Promise<{
  saved: boolean;
  dependencyInstallCommand: string;
  languageDependency: string;
  path: string;
}> {
  const packageJson = `{
    "name": "auto-generated-superface-project",
    "version": "1.0.0",
    "description": "",
    "main": "index.js",
    "engines" : { 
      "node" : ">=18.0.0"
    },
    "keywords": [],
    "author": "",
    "license": "ISC",
    "dependencies": {
      "@superfaceai/one-sdk": "${sdkVersion}",
      "dotenv": "${dotenvVersion}"
    }
  }`;

  const packageJsonPath = buildProjectDefinitionFilePath(SupportedLanguages.JS);

  const languageDependency = 'Node.js > 18.0.0';
  const dependencyInstallCommand = 'npm install';

  if (!(await exists(packageJsonPath))) {
    await OutputStream.writeOnce(packageJsonPath, packageJson);

    return {
      saved: true,
      dependencyInstallCommand,
      languageDependency,
      path: packageJsonPath,
    };
  }

  return {
    saved: false,
    dependencyInstallCommand,
    languageDependency,
    path: packageJsonPath,
  };
}
