import { SupportedLanguages } from '../application-code';
import { prepareJsProject } from './js';
import { preparePythonProject } from './python';

export async function prepareProject(language: SupportedLanguages): Promise<{
  saved: boolean;
  installationGuide: string;
}> {
  switch (language) {
    case SupportedLanguages.JS:
      return prepareJsProject();
    case SupportedLanguages.PYTHON:
      return preparePythonProject();
  }
}
