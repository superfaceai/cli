import type { ILogger } from '../../common';
import { buildProjectDefinitionFilePath } from '../../common/file-structure';
import { exists } from '../../common/io';
import { OutputStream } from '../../common/output-stream';

export async function prepareJsProject(
  sdkVerion = '3.0.0-alpha.12',
  dotenvVersion = '^16.0.3',
  { logger }: { logger: ILogger }
): Promise<void> {
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
      "@superfaceai/one-sdk": "${sdkVerion}",
      "dotenv": "${dotenvVersion}"
    }
  }`;

  const packageJsonPath = buildProjectDefinitionFilePath('JS');

  if (!(await exists(packageJsonPath))) {
    await OutputStream.writeOnce(packageJsonPath, packageJson);

    logger.success(
      'projectDefinitionFileCreated',
      packageJsonPath,
      'package.json'
    );
  }

  logger.info('projectDefinitionFileExists', packageJsonPath, 'package.json');
}
