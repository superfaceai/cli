import type { ProfileDocumentNode } from '@superfaceai/ast';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { SupportedLanguages, writeApplicationCode } from './application-code';

describe('writeApplicationCode', () => {
  const logger = new MockLogger();
  const userError = createUserError(false);

  const ast: ProfileDocumentNode = {
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      scope: 'test-scope',
      name: 'test-name',
      version: {
        major: 1,
        minor: 0,
        patch: 1,
      },
    },
    definitions: [
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'TestUseCase',
        input: {
          kind: 'UseCaseSlotDefinition',
          value: {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'id',
                required: true,
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'number',
                  },
                },
              },
            ],
          },
        },
        result: {
          kind: 'UseCaseSlotDefinition',
          value: {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'name',
                required: true,
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
              },
            ],
          },
        },
        error: {
          kind: 'UseCaseSlotDefinition',
          value: {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'code',
                required: false,
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'number',
                  },
                },
              },
            ],
          },
        },
        examples: [
          {
            kind: 'UseCaseSlotDefinition',
            value: {
              kind: 'UseCaseExample',
              exampleName: 'InputExample',
              input: {
                kind: 'UseCaseSlotDefinition',
                value: {
                  kind: 'ComlinkObjectLiteral',
                  fields: [
                    {
                      kind: 'ComlinkAssignment',
                      key: ['id'],
                      value: {
                        kind: 'ComlinkPrimitiveLiteral',
                        value: 1,
                      },
                    },
                  ],
                },
              },
              result: {
                kind: 'UseCaseSlotDefinition',
                value: {
                  kind: 'ComlinkObjectLiteral',
                  fields: [
                    {
                      kind: 'ComlinkAssignment',
                      key: ['name'],
                      value: {
                        kind: 'ComlinkPrimitiveLiteral',
                        value: 'test',
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
    astMetadata: {
      astVersion: {
        major: 1,
        minor: 3,
        patch: 0,
      },
      parserVersion: {
        major: 2,
        minor: 1,
        patch: 0,
      },
      sourceChecksum:
        '5c6e1b9d962778fd7826f60053c689bce4b0bf7b5b94be4ae6db38bc0b5c8c1d',
    },
  };

  it('should return JS application code', async () => {
    const result = await writeApplicationCode(
      {
        providerJson: {
          name: 'test',
          defaultService: 'test',
          services: [
            {
              baseUrl: 'https://test.com',
              id: 'test',
            },
          ],
          securitySchemes: [],
          parameters: [],
        },
        profileAst: ast,
        language: SupportedLanguages.JS,
      },
      { logger, userError }
    );

    expect(result).toEqual({
      code: expect.stringContaining(`import { config } from 'dotenv'`),
      requiredParameters: [],
      requiredSecurity: [],
    });
  });

  it('should return python application code', async () => {
    const result = await writeApplicationCode(
      {
        providerJson: {
          name: 'test',
          defaultService: 'test',
          services: [
            {
              baseUrl: 'https://test.com',
              id: 'test',
            },
          ],
          securitySchemes: [],
          parameters: [],
        },
        profileAst: ast,
        language: SupportedLanguages.PYTHON,
      },
      { logger, userError }
    );

    expect(result).toEqual({
      code: expect.stringContaining(`import os`),
      requiredParameters: [],
      requiredSecurity: [],
    });
  });

  it('should throw when there is no use case definitions', async () => {
    await expect(
      writeApplicationCode(
        {
          providerJson: {
            name: 'test',
            defaultService: 'test',
            services: [
              {
                baseUrl: 'https://test.com',
                id: 'test',
              },
            ],
            securitySchemes: [],
            parameters: [],
          },
          profileAst: {
            kind: 'ProfileDocument',
            header: {
              kind: 'ProfileHeader',
              scope: 'test-scope',
              name: 'test-name',
              version: {
                major: 1,
                minor: 0,
                patch: 1,
              },
            },
            definitions: [],
            astMetadata: {
              astVersion: {
                major: 1,
                minor: 3,
                patch: 0,
              },
              parserVersion: {
                major: 2,
                minor: 1,
                patch: 0,
              },
              sourceChecksum:
                '5c6e1b9d962778fd7826f60053c689bce4b0bf7b5b94be4ae6db38bc0b5c8c1d',
            },
          },
          language: SupportedLanguages.JS,
        },
        { logger, userError }
      )
    ).rejects.toEqual(userError(`No use cases found in profile test-name`, 1));
  });

  it('should throw when there are more than one use case definitions', async () => {
    await expect(
      writeApplicationCode(
        {
          providerJson: {
            name: 'test',
            defaultService: 'test',
            services: [
              {
                baseUrl: 'https://test.com',
                id: 'test',
              },
            ],
            securitySchemes: [],
            parameters: [],
          },
          profileAst: {
            kind: 'ProfileDocument',
            header: {
              kind: 'ProfileHeader',
              scope: 'test-scope',
              name: 'test-name',
              version: {
                major: 1,
                minor: 0,
                patch: 1,
              },
            },
            definitions: [
              {
                kind: 'UseCaseDefinition',
                useCaseName: 'TestUseCase',
              },
              {
                kind: 'UseCaseDefinition',
                useCaseName: 'TestUseCase',
              },
            ],
            astMetadata: {
              astVersion: {
                major: 1,
                minor: 3,
                patch: 0,
              },
              parserVersion: {
                major: 2,
                minor: 1,
                patch: 0,
              },
              sourceChecksum:
                '5c6e1b9d962778fd7826f60053c689bce4b0bf7b5b94be4ae6db38bc0b5c8c1d',
            },
          },
          language: SupportedLanguages.JS,
        },
        { logger, userError }
      )
    ).rejects.toEqual(
      userError(
        `Multiple use cases found in profile test-name. Currently only one use case is per profile file is supported.`,
        1
      )
    );
  });
});
