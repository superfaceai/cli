import type { UseCaseDefinitionNode } from '@superfaceai/ast';

import { buildUseCaseExamples } from '../../templates/prepared-map/usecase/example/build';
import type { UseCaseExample } from '../../templates/prepared-map/usecase/example/usecase-example';

export function prepareExampleInput(
  useCase: UseCaseDefinitionNode
): Record<string, unknown> {
  // TODO named fields and model
  const success = buildUseCaseExamples(useCase, {}, {}).successExample;

  if (success.input === undefined) {
    return {};
  }

  return visit(success.input);
}

function visit(node: UseCaseExample, name?: string): Record<string, unknown> {
  if (node.kind === 'object') {
    let r: Record<string, unknown> = {};

    for (const p of node.properties) {
      r = { ...r, ...visit(p, p.name) };
    }

    return r;
  } else if (
    node.kind === 'string' ||
    node.kind === 'boolean' ||
    node.kind === 'number'
  ) {
    return { [name ?? 'unknown']: node.value };
  } else {
    throw new Error('not implemented ');
  }
}
