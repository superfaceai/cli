import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ProfileDocumentNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { buildUseCaseExamples } from './example/build';
import { getTypeDetails } from './get-type-details';
import { prepareExampleScalar } from './prepare-input-scalar';
import type { UseCase } from './usecase';

export function prepareUseCaseDetails(ast: ProfileDocumentNode): UseCase[] {
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

  return ast.definitions
    .filter((definition): definition is UseCaseDefinitionNode => {
      return definition.kind === 'UseCaseDefinition';
    })
    .map(usecase => {
      const examples = buildUseCaseExamples(
        usecase,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      return {
        name: usecase.useCaseName,
        title: usecase?.documentation?.title,
        description: usecase?.documentation?.description,
        error: getTypeDetails(
          usecase?.error?.value,
          undefined,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache
        ),
        input: getTypeDetails(
          usecase?.input?.value,
          undefined,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache
        ),
        result: getTypeDetails(
          usecase?.result?.value,
          undefined,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache
        ),
        ...examples,
        inputExampleScalarName: prepareExampleScalar(
          'input',
          examples.successExample.input
        ),
      };
    });
}
