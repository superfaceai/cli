import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ProfileDocumentNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { buildUseCaseExamples } from './example/build';
import type { UseCaseExample } from './example/usecase-example';
import INPUT_TEMPLATE from './templates';
import { makeRenderer } from './templates/template-renderer';

export function prepareUseCaseInput(ast: ProfileDocumentNode): string {
  const namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  } = {};

  const namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  } = {};

  ast.definitions.forEach(definition => {
    if (definition.kind === 'NamedFieldDefinition') {
      namedFieldDefinitionsCache[definition.fieldName] = definition;
    } else if (definition.kind === 'NamedModelDefinition') {
      namedModelDefinitionsCache[definition.modelName] = definition;
    }
  });

  // const errorExamples: {
  //   input?: UseCaseExample;
  //   error?: UseCaseExample;
  // }[] = [];

  const successExamples: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  }[] = [];

  ast.definitions
    .filter((definition): definition is UseCaseDefinitionNode => {
      return definition.kind === 'UseCaseDefinition';
    })
    .forEach(useCase => {
      const {
        // errorExamples: errorExamplesForUseCase,
        successExamples: successExamplesForUseCase,
      } = buildUseCaseExamples(
        useCase,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      // errorExamples.push(...errorExamplesForUseCase);
      successExamples.push(...successExamplesForUseCase);
    });

  const inputExample = successExamples.find(e => e.input !== undefined)?.input;

  const render = makeRenderer(INPUT_TEMPLATE, 'Input');

  return render({ input: inputExample });
}
