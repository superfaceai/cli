import type { UseCaseDefinitionNode } from '@superfaceai/ast';
import { assertProfileDocumentNode } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import { readFile } from '../../../../common/io';
import { buildUseCaseExamples } from './build';

describe('Build examples', () => {
  let useCase: UseCaseDefinitionNode;

  beforeEach(async () => {
    const fixture = joinPath(
      process.cwd(),
      'fixtures',
      'compiled',
      'with-examples.supr.ast.json'
    );

    const profile = assertProfileDocumentNode(
      JSON.parse(await readFile(fixture, { encoding: 'utf-8' }))
    );

    useCase = profile.definitions.filter(
      (u): u is UseCaseDefinitionNode => u.kind === 'UseCaseDefinition'
    )[0];
  });

  it('builds example from example nodes', async () => {
    expect(buildUseCaseExamples(useCase, {}, {})).toEqual({
      errorExamples: [
        {
          input: {
            kind: 'object',
            properties: [{ name: 'foo', kind: 'string', value: 'error' }],
          },
          error: {
            kind: 'object',
            properties: [{ name: 'baz', kind: 'number', value: 12 }],
          },
        },
        {
          input: {
            kind: 'object',
            properties: [
              { name: 'foo', kind: 'string', value: 'different error' },
            ],
          },
          error: {
            kind: 'object',
            properties: [{ name: 'baz', kind: 'number', value: 16 }],
          },
        },
      ],
      successExamples: [
        {
          input: {
            kind: 'object',
            properties: [{ name: 'foo', kind: 'string', value: 'example' }],
          },
          result: {
            kind: 'object',
            properties: [{ name: 'bar', kind: 'string', value: 'result' }],
          },
        },
        {
          input: {
            kind: 'object',
            properties: [
              { name: 'foo', kind: 'string', value: 'second example' },
            ],
          },
          result: {
            kind: 'object',
            properties: [
              { name: 'bar', kind: 'string', value: 'second result' },
            ],
          },
        },
      ],
    });
  });

  it('builds example from type definitions', async () => {
    delete useCase.examples;

    expect(buildUseCaseExamples(useCase, {}, {})).toEqual({
      errorExamples: [
        {
          input: {
            kind: 'object',
            properties: [{ name: 'foo', kind: 'string', value: '' }],
          },
          error: {
            kind: 'object',
            properties: [{ name: 'baz', kind: 'number', value: 0 }],
          },
        },
      ],
      successExamples: [
        {
          input: {
            kind: 'object',
            properties: [{ name: 'foo', kind: 'string', value: '' }],
          },
          result: {
            kind: 'object',
            properties: [
              {
                name: 'bar',
                kind: 'string',
                value: '',
              },
            ],
          },
        },
      ],
    });
  });
});
