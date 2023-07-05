import type {
  ProfileDocumentNode,
  ProviderJson,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import { stringifyError } from '../../common/error';
import { prepareUseCaseInput } from './input/prepare-usecase-input';
import { jsApplicationCode } from './js';
import { pythonApplicationCode } from './python';

export enum SupportedLanguages {
  PYTHON = 'python',
  JS = 'js',
}

export async function writeApplicationCode(
  {
    providerJson,
    profileAst,
    language,
  }: // useCaseName,
  {
    providerJson: ProviderJson;
    profileAst: ProfileDocumentNode;
    language: SupportedLanguages;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<string> {
  const useCases = profileAst.definitions.filter(
    (definition): definition is UseCaseDefinitionNode => {
      return definition.kind === 'UseCaseDefinition';
    }
  );

  if (useCases.length === 0) {
    throw userError(
      `No use cases found in profile ${profileAst.header.name}`,
      1
    );
  }

  if (useCases.length > 1) {
    throw userError(
      `Multiple use cases found in profile ${profileAst.header.name}. Currently only one use case is per profile file is supported.`,
      1
    );
  }

  const useCaseName = useCases[0].useCaseName;

  // TODO: this should be language independent and also take use case name as input
  let inputExample: string;
  try {
    inputExample = prepareUseCaseInput(profileAst);
  } catch (error) {
    // TODO: fallback to empty object?
    throw userError(
      `Input example construction failed: ${stringifyError(error)}`,
      1
    );
  }

  switch (language) {
    case SupportedLanguages.PYTHON:
      return pythonApplicationCode(
        {
          profile: {
            name: profileAst.header.name,
            scope: profileAst.header.scope,
          },
          useCaseName,
          provider: providerJson.name,
          input: inputExample,
          parameters: providerJson.parameters,
          security: providerJson.securitySchemes,
        },
        { logger }
      );

    case SupportedLanguages.JS:
      return jsApplicationCode(
        {
          profile: {
            name: profileAst.header.name,
            scope: profileAst.header.scope,
          },
          useCaseName,
          provider: providerJson.name,
          input: inputExample,
          parameters: providerJson.parameters,
          security: providerJson.securitySchemes,
        },
        { logger }
      );
  }
}
