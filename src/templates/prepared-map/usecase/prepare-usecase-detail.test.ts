import type { ProfileDocumentNode } from '@superfaceai/ast';

import { readFile } from '../../../common/io';
import { prepareUseCaseDetails } from './prepare-usecase-detail';

describe('Parse use case details', () => {
  let swFixture: ProfileDocumentNode, strictFixture: ProfileDocumentNode;

  beforeAll(async () => {
    swFixture = JSON.parse(
      await readFile(
        'fixtures/profiles/starwars/character-information@1.0.2.supr.ast.json',
        { encoding: 'utf-8' }
      )
    ) as ProfileDocumentNode;

    strictFixture = JSON.parse(
      await readFile('fixtures/compiled/strict.supr.ast.json', {
        encoding: 'utf-8',
      })
    ) as ProfileDocumentNode;
  });

  it('prepares strict profile ast corectly', async () => {
    expect(prepareUseCaseDetails(strictFixture)).toEqual([
      {
        name: 'Foo',
        title: 'usecase title',
        error: {
          modelType: 'Enum',
          nonNull: false,
          enumElements: [
            {
              value: 404,
            },
            {
              value: 400,
            },
          ],
        },
        input: {
          modelType: 'Object',
          nonNull: false,
          fields: [
            {
              fieldName: 'field',
              required: true,
              model: {
                modelType: 'Scalar',
                nonNull: true,
                scalarType: 'string',
              },
              description: 'field title',
            },
            {
              fieldName: 'field',
              required: false,
              model: {
                nonNull: false,
                modelType: 'Union',
                types: [
                  {
                    modelType: 'Scalar',
                    nonNull: false,
                    scalarType: 'number',
                  },
                  {
                    modelType: 'Scalar',
                    nonNull: false,
                    scalarType: 'boolean',
                  },
                ],
              },
            },
            {
              fieldName: 'field',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'boolean',
              },
            },
          ],
        },
        result: {
          modelType: 'Scalar',
          nonNull: false,
          scalarType: 'number',
        },
        errorExample: {
          input: {
            kind: 'object',
            properties: [
              {
                name: 'field',
                kind: 'string',
                value: '',
              },
              {
                name: 'field',
                kind: 'number',
                value: 0,
              },
              {
                name: 'field',
                kind: 'boolean',
                value: true,
              },
            ],
          },
          error: {
            kind: 'number',
            value: 404,
          },
        },
        successExample: {
          input: {
            kind: 'object',
            properties: [
              {
                name: 'field',
                kind: 'string',
                value: '',
              },
              {
                name: 'field',
                kind: 'number',
                value: 0,
              },
              {
                name: 'field',
                kind: 'boolean',
                value: true,
              },
            ],
          },
          result: {
            kind: 'number',
            value: 0,
          },
        },
      },
    ]);
  });

  it('prepares star wars profile ast corectly', async () => {
    expect(prepareUseCaseDetails(swFixture)).toEqual([
      {
        name: 'RetrieveCharacterInformation',
        title:
          'Retrieve information about Star Wars characters from the Star Wars API.',
        error: {
          modelType: 'Object',
          nonNull: false,
          fields: [
            {
              fieldName: 'message',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'string',
              },
              description:
                'The message for when an error occurs looking up character information',
            },
          ],
        },
        input: {
          modelType: 'Object',
          nonNull: false,
          fields: [
            {
              fieldName: 'characterName',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'string',
              },
              description:
                'The character name to use when looking up character information',
            },
          ],
        },
        result: {
          modelType: 'Object',
          nonNull: false,
          fields: [
            {
              fieldName: 'height',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'string',
              },
              description: 'The height of the character',
            },
            {
              fieldName: 'weight',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'string',
              },
              description: 'The weight of the character',
            },
            {
              fieldName: 'yearOfBirth',
              required: false,
              model: {
                modelType: 'Scalar',
                nonNull: false,
                scalarType: 'string',
              },
              description: 'The year of birth of the character',
            },
          ],
        },
        errorExample: {
          input: {
            kind: 'object',
            properties: [
              {
                name: 'characterName',
                kind: 'string',
                value: '',
              },
            ],
          },
          error: {
            kind: 'object',
            properties: [
              {
                name: 'message',
                kind: 'string',
                value: '',
              },
            ],
          },
        },
        successExample: {
          input: {
            kind: 'object',
            properties: [
              {
                name: 'characterName',
                kind: 'string',
                value: '',
              },
            ],
          },
          result: {
            kind: 'object',
            properties: [
              {
                name: 'height',
                kind: 'string',
                value: '',
              },
              {
                name: 'weight',
                kind: 'string',
                value: '',
              },
              {
                name: 'yearOfBirth',
                kind: 'string',
                value: '',
              },
            ],
          },
        },
      },
    ]);
  });
});
