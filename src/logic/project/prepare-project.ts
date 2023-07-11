import type { SupportedLanguages } from '../application-code';
import { prepareJsProject } from './js';
import { preparePythonProject } from './python';

export async function prepareProject(language: SupportedLanguages): Promise<{
  saved: boolean;
  installationGuide: string;
  path: string;
}> {
  const PROJECT_PREPARATION_MAP: {
    [key in SupportedLanguages]: () => Promise<{
      saved: boolean;
      installationGuide: string;
      path: string;
    }>;
  } = {
    js: prepareJsProject,
    python: preparePythonProject,
  };

  return PROJECT_PREPARATION_MAP[language]();
}
