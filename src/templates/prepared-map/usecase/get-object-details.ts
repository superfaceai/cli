import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
} from '@superfaceai/ast';

import { getTypeDetails } from './get-type-details';
import type { ObjectModel } from './models';
import { ModelType } from './models';

export function getObjectModelDetails(
  object: ObjectDefinitionNode,
  nonNull: boolean | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ObjectModel {
  return {
    modelType: ModelType.OBJECT,
    nonNull: nonNull ?? false,
    fields: object.fields
      .filter(item => item.kind === 'FieldDefinition')
      .map(field => {
        const namedFieldNode = namedModelDefinitionsCache[field.fieldName];

        const model = getTypeDetails(
          field.type ?? namedFieldNode?.type ?? undefined,
          false,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache
        );

        const description: string | undefined =
          field?.documentation?.title !== undefined
            ? field?.documentation?.description ?? field?.documentation?.title
            : namedFieldNode !== null
            ? namedFieldNode?.documentation?.description
            : undefined;

        return {
          fieldName: field.fieldName,
          required: field.required,
          model: model,

          // If the field has an inline title provided, use the description
          // from inlined definition only (or fallback to title if not present).

          // E.g. Named field definition could contain both title & description
          //      while the inline definition only has a title. These 2 definitions
          //      could possibly have different meanings, mixing title from one
          //      with the description from the other is not desirable.
          description,
        };
      }),
  };
}
