import {
  AstMetadata,
  MapDocumentNode,
  MapHeaderNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import {
  MapDocumentId,
  parseMap,
  parseMapId,
  parseProfile,
  ProfileHeaderStructure,
  Source,
  SyntaxError,
  ValidationIssue,
  ValidationResult,
} from '@superfaceai/parser';
import { SyntaxErrorCategory } from '@superfaceai/parser/dist/language/error';
import { MatchAttempts } from '@superfaceai/parser/dist/language/syntax/rule';
import { red, yellow } from 'chalk';
import { mocked } from 'ts-jest/utils';

import { createUserError } from '../common/error';
import { fetchMapAST, fetchProfileAST } from '../common/http';
import { MockLogger } from '../common/log';
import { ProfileId } from '../common/profile';
import { ReportFormat } from '../common/report.interfaces';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';
import {
  createProfileMapReport,
  formatHuman,
  formatJson,
  isValidHeader,
  isValidMapId,
  lint,
  ProfileToValidate,
} from './lint';

jest.mock('../common/io', () => ({
  readFile: jest.fn(),
}));
jest.mock('../common/output-stream');
jest.mock('./check.utils', () => ({
  findLocalMapSource: jest.fn(),
  findLocalProfileSource: jest.fn(),
}));
jest.mock('../common/http', () => ({
  fetchMapAST: jest.fn(),
  fetchProfileAST: jest.fn(),
}));
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseMap: jest.fn(),
  parseMapId: jest.fn(),
}));

describe('Lint logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const mockMapPath = 'mockMapPath';
  const mockProfilePath = 'mockProfilePath';

  beforeEach(() => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const astMetadata: AstMetadata = {
    sourceChecksum: 'check',
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
  };

  const mockSyntaxErr = new SyntaxError(
    new Source('test'),
    {
      start: {
        line: 0,
        column: 0,
        charIndex: 0,
      },
      end: {
        line: 0,
        column: 0,
        charIndex: 0,
      },
    },
    SyntaxErrorCategory.PARSER,
    'detail'
  );

  describe('when validating header', () => {
    let mockValidProfileHeader: ProfileHeaderStructure;
    let mocValidMapHeader: MapHeaderNode;

    beforeEach(() => {
      mockValidProfileHeader = {
        name: 'mockProfileHeader',
        scope: 'some-scope',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      mocValidMapHeader = {
        kind: 'MapHeader',
        profile: {
          name: 'mockProfileHeader',
          scope: 'some-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      };
    });

    it('returns true on valid headers', async () => {
      expect(isValidHeader(mockValidProfileHeader, mocValidMapHeader)).toEqual(
        true
      );
    });

    it('returns false on invalid scope', async () => {
      mockValidProfileHeader.scope = 'different-scope';
      expect(isValidHeader(mockValidProfileHeader, mocValidMapHeader)).toEqual(
        false
      );
    });

    it('returns false on invalid name', async () => {
      mocValidMapHeader.profile.name = 'different-name';
      expect(isValidHeader(mockValidProfileHeader, mocValidMapHeader)).toEqual(
        false
      );
    });

    it('returns false on invalid major version', async () => {
      mocValidMapHeader.profile.version.major = 3;
      expect(isValidHeader(mockValidProfileHeader, mocValidMapHeader)).toEqual(
        false
      );
    });

    it('returns false on invalid minor version', async () => {
      mocValidMapHeader.profile.version.minor = 3;
      expect(isValidHeader(mockValidProfileHeader, mocValidMapHeader)).toEqual(
        false
      );
    });
  });

  describe('when validating map id', () => {
    let mockValidProfileHeader: ProfileHeaderStructure;
    let mocValidMapHeader: MapHeaderNode;
    beforeEach(() => {
      mockValidProfileHeader = {
        name: 'mockProfileHeader',
        scope: 'some-scope',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      mocValidMapHeader = {
        kind: 'MapHeader',
        profile: {
          name: 'mockProfileHeader',
          scope: 'some-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      };
    });

    it('returns true on valid map id', async () => {
      const mockDocument: MapDocumentId = {
        scope: 'some-map-scope',
        name: 'mockProfileHeader',
        provider: 'test-provider',
        version: {
          major: 1,
          minor: 0,
        },
      };
      const mockMapPath = 'testMapPath';
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: mockDocument,
      });
      expect(
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toEqual(true);
    });

    it('returns false on invalid scope', async () => {
      mockValidProfileHeader.scope = 'different-scope';
      const mockDocument: MapDocumentId = {
        scope: 'some-map-scope',
        name: 'mockProfileHeader',
        provider: 'test-provider',
        version: {
          major: 1,
          minor: 0,
        },
      };
      const mockMapPath = 'testMapPath';
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: mockDocument,
      });
      expect(
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toEqual(false);
    });

    it('returns false on invalid name', async () => {
      mocValidMapHeader.profile.name = 'different-name';
      const mockDocument: MapDocumentId = {
        scope: 'some-map-scope',
        name: 'different-name',
        provider: 'test-provider',
        version: {
          major: 1,
          minor: 0,
        },
      };
      const mockMapPath = 'testMapPath';
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: mockDocument,
      });
      expect(
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toEqual(false);
    });

    it('returns false on invalid major version', async () => {
      const mockDocument: MapDocumentId = {
        scope: 'some-map-scope',
        name: 'mockProfileHeader',
        provider: 'test-provider',
        version: {
          major: 2,
          minor: 0,
        },
      };
      const mockMapPath = 'testMapPath';
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: mockDocument,
      });
      expect(
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toEqual(false);
    });

    it('returns false on invalid minor version', async () => {
      const mockDocument: MapDocumentId = {
        scope: 'some-map-scope',
        name: 'mockProfileHeader',
        provider: 'test-provider',
        version: {
          major: 1,
          minor: 3,
        },
      };
      const mockMapPath = 'testMapPath';
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: mockDocument,
      });
      expect(
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toEqual(false);
    });

    it('throws error if there is a parse error', async () => {
      mocked(parseMapId).mockReturnValue({
        kind: 'error',
        message: 'parse-error',
      });
      const mockMapPath = 'testMapPath';
      expect(() =>
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath, {
          userError,
        })
      ).toThrow('parse-error');
    });
  });

  describe('when creating profile map report', () => {
    const mockMapPath = 'map-path';
    const mockProfilePath = 'profile-path';

    it('returns empty error array if result pass is true', async () => {
      const mockValidationResult: ValidationResult = {
        pass: true,
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };

      expect(
        createProfileMapReport(
          mockValidationResult,
          mockProfilePath,
          mockMapPath
        )
      ).toEqual({
        kind: 'compatibility',
        profile: mockProfilePath,
        path: mockMapPath,
        errors: [],
        warnings: mockValidationResult.warnings,
      });
    });

    it('returns error array if result pass is false', async () => {
      const mockValidationResult: ValidationResult = {
        pass: false,
        errors: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };

      expect(
        createProfileMapReport(
          mockValidationResult,
          mockProfilePath,
          mockMapPath
        )
      ).toEqual({
        kind: 'compatibility',
        profile: mockProfilePath,
        path: mockMapPath,
        errors: mockValidationResult.errors,
        warnings: mockValidationResult.warnings,
      });
    });
  });

  describe('when linting maps to profile', () => {
    const mockProfileContent = 'profile-content';
    const mockMapContent = 'map-content';

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      astMetadata,
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        scope: 'some-map-scope',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };

    const mockMapDocumentMatching: MapDocumentNode = {
      kind: 'MapDocument',
      astMetadata,
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };
    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      astMetadata,
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'different-test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };

    it('returns correct counts, local profile and map', async () => {
      const profile = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );
      const mockSuperJson = new SuperJson();
      const mockProfiles: ProfileToValidate[] = [
        {
          id: profile,
          maps: [
            {
              provider: 'swapi',
            },
            {
              provider: 'starwars',
            },
          ],
        },
      ];

      mocked(findLocalMapSource)
        .mockResolvedValueOnce({ source: mockMapContent, path: 'swapi path' })
        .mockResolvedValueOnce({
          source: mockMapContent,
          path: 'starwars path',
        });
      mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileContent,
        path: mockProfilePath,
      });
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(parseMap)
        .mockReturnValueOnce(mockMapDocument)
        .mockReturnValueOnce(mockMapDocumentMatching);

      await expect(
        lint(mockSuperJson, mockProfiles, { logger })
      ).resolves.toEqual({
        reports: [
          {
            errors: [],
            kind: 'file',
            path: 'mockProfilePath',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'swapi path',
            warnings: [],
          },
          {
            errors: [
              {
                context: {
                  actual: 'different-test-profile',
                  expected: 'test-profile',
                  path: { kind: 'MapHeader' },
                },
                kind: 'wrongProfileName',
              },
            ],
            kind: 'compatibility',
            path: 'swapi path',
            profile: 'mockProfilePath',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'starwars path',
            warnings: [],
          },
          {
            errors: [],
            kind: 'compatibility',
            path: 'starwars path',
            profile: 'mockProfilePath',
            warnings: [],
          },
        ],
        total: { errors: 1, warnings: 0 },
      });
    });

    it('returns correct counts, local profile and remote maps', async () => {
      const profile = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );
      const mockSuperJson = new SuperJson();
      const mockProfiles: ProfileToValidate[] = [
        {
          id: profile,
          maps: [
            {
              provider: 'swapi',
              variant: 'test',
            },
            {
              provider: 'starwars',
              variant: 'test',
            },
          ],
        },
      ];

      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileContent,
        path: mockProfilePath,
      });
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(fetchMapAST)
        .mockResolvedValueOnce(mockMapDocument)
        .mockResolvedValueOnce(mockMapDocumentMatching);

      await expect(
        lint(mockSuperJson, mockProfiles, { logger })
      ).resolves.toEqual({
        reports: [
          {
            errors: [],
            kind: 'file',
            path: 'mockProfilePath',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'starwars/character-information.swapi.test@1.0.0',
            warnings: [],
          },
          {
            errors: [
              {
                context: {
                  actual: 'different-test-profile',
                  expected: 'test-profile',
                  path: { kind: 'MapHeader' },
                },
                kind: 'wrongProfileName',
              },
            ],
            kind: 'compatibility',
            path: 'starwars/character-information.swapi.test@1.0.0',
            profile: 'mockProfilePath',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'starwars/character-information.starwars.test@1.0.0',
            warnings: [],
          },
          {
            errors: [],
            kind: 'compatibility',
            path: 'starwars/character-information.starwars.test@1.0.0',
            profile: 'mockProfilePath',
            warnings: [],
          },
        ],
        total: { errors: 1, warnings: 0 },
      });
    });

    it('returns correct counts, remote profile and map', async () => {
      const profile = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );
      const mockSuperJson = new SuperJson();
      const mockProfiles: ProfileToValidate[] = [
        {
          id: profile,
          maps: [
            {
              provider: 'swapi',
              variant: 'test',
            },
            {
              provider: 'starwars',
              variant: 'test',
            },
          ],
          version: '1.0.0',
        },
      ];

      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(fetchMapAST)
        .mockResolvedValueOnce(mockMapDocument)
        .mockResolvedValueOnce(mockMapDocumentMatching);

      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);

      await expect(
        lint(mockSuperJson, mockProfiles, { logger })
      ).resolves.toEqual({
        reports: [
          {
            errors: [],
            kind: 'file',
            path: 'starwars/character-information@1.0.0',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'starwars/character-information.swapi.test@1.0.0',
            warnings: [],
          },

          {
            errors: [
              {
                context: {
                  actual: 'different-test-profile',
                  expected: 'test-profile',
                  path: { kind: 'MapHeader' },
                },
                kind: 'wrongProfileName',
              },
            ],
            kind: 'compatibility',
            path: 'starwars/character-information.swapi.test@1.0.0',
            profile: 'starwars/character-information@1.0.0',
            warnings: [],
          },
          {
            errors: [],
            kind: 'file',
            path: 'starwars/character-information.starwars.test@1.0.0',
            warnings: [],
          },
          {
            errors: [],
            kind: 'compatibility',
            path: 'starwars/character-information.starwars.test@1.0.0',
            profile: 'starwars/character-information@1.0.0',
            warnings: [],
          },
        ],
        total: { errors: 1, warnings: 0 },
      });
    });

    it('returns correct counts, corrupted profile', async () => {
      const mockSyntaxErr: SyntaxError = {
        source: new Source('test'),
        formatHints: () => '',
        formatVisualization: () => '',
        hints: [],
        location: {
          start: {
            line: 0,
            column: 0,
            charIndex: 0,
          },
          end: {
            line: 0,
            column: 0,
            charIndex: 0,
          },
        },
        category: SyntaxErrorCategory.PARSER,
        detail: '',
        format: () => 'detail',
        message: 'message',
      };

      const profile = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );
      const mockSuperJson = new SuperJson();
      const mockProfiles: ProfileToValidate[] = [
        {
          id: profile,
          maps: [
            {
              provider: 'swapi',
              variant: 'test',
            },
            {
              provider: 'starwars',
              variant: 'test',
            },
          ],
          version: '1.0.0',
        },
      ];

      mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileContent,
        path: mockProfilePath,
      });
      mocked(parseProfile).mockImplementation(() => {
        throw mockSyntaxErr;
      });

      await expect(
        lint(mockSuperJson, mockProfiles, { logger })
      ).resolves.toEqual({
        reports: [
          {
            errors: [
              {
                category: 'Parser',
                detail: '',
                format: expect.any(Function),
                formatHints: expect.any(Function),
                formatVisualization: expect.any(Function),
                hints: [],
                location: {
                  end: {
                    charIndex: 0,
                    column: 0,
                    line: 0,
                  },
                  start: {
                    charIndex: 0,
                    column: 0,
                    line: 0,
                  },
                },
                message: 'message',
                source: new Source('test', undefined, {
                  column: 0,
                  line: 0,
                }),
              },
            ],
            kind: 'file',
            path: 'mockProfilePath',
            warnings: [],
          },
        ],
        total: { errors: 1, warnings: 0 },
      });
    });
    it('returns correct counts, corrupted map', async () => {
      const mockSyntaxErr: SyntaxError = {
        source: new Source('test'),
        formatHints: () => '',
        formatVisualization: () => '',
        hints: [],
        location: {
          start: {
            line: 0,
            column: 0,
            charIndex: 0,
          },
          end: {
            line: 0,
            column: 0,
            charIndex: 0,
          },
        },
        category: SyntaxErrorCategory.PARSER,
        detail: '',
        format: () => 'detail',
        message: 'message',
      };

      const profile = ProfileId.fromScopeName(
        'starwars',
        'character-information'
      );
      const mockSuperJson = new SuperJson();
      const mockProfiles: ProfileToValidate[] = [
        {
          id: profile,
          maps: [
            {
              provider: 'swapi',
              variant: 'test',
            },
          ],
          version: '1.0.0',
        },
      ];

      mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileContent,
        path: mockProfilePath,
      });
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(findLocalMapSource).mockResolvedValue({
        source: mockMapContent,
        path: mockMapPath,
      });
      mocked(parseMap).mockImplementation(() => {
        throw mockSyntaxErr;
      });

      await expect(
        lint(mockSuperJson, mockProfiles, { logger })
      ).resolves.toEqual({
        reports: [
          {
            errors: [],
            kind: 'file',
            path: 'mockProfilePath',
            warnings: [],
          },
          {
            errors: [
              {
                category: 'Parser',
                detail: '',
                format: expect.any(Function),
                formatHints: expect.any(Function),
                formatVisualization: expect.any(Function),
                hints: [],
                location: {
                  end: {
                    charIndex: 0,
                    column: 0,
                    line: 0,
                  },
                  start: {
                    charIndex: 0,
                    column: 0,
                    line: 0,
                  },
                },
                message: 'message',
                source: new Source('test', undefined, {
                  column: 0,
                  line: 0,
                }),
              },
            ],
            kind: 'file',
            path: 'mockMapPath',
            warnings: [],
          },
        ],
        total: { errors: 1, warnings: 0 },
      });
    });
  });

  describe('when formating for human', () => {
    const mockWarning: ValidationIssue = {
      kind: 'wrongScope',
      context: {
        path: {
          kind: 'test',
        },
        expected: 'foo',
        actual: 'bar',
      },
    };
    it('formats file with errors and warnings correctly', async () => {
      const mockPath = 'some/path.suma';
      const mockErr = SyntaxError.fromSyntaxRuleNoMatch(
        new Source('mock-content', mockPath),
        {
          kind: 'nomatch',
          attempts: ({
            token: undefined,
            rules: [],
          } as unknown) as MatchAttempts,
        }
      );

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockErr],
        warnings: [mockWarning],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(`Parsing map file: ${mockPath}`);
      expect(formated).toMatch('SyntaxError: Expected  but found <NONE>');
      expect(formated).toMatch('--> some/path.suma:0:0');

      expect(formated).toMatch('test - Wrong Scope: expected foo, but got bar');
    });

    it('formats file with errors and warnings correctly - with color', async () => {
      const mockPath = 'some/path.suma';
      const mockErr = SyntaxError.fromSyntaxRuleNoMatch(
        new Source('mock-content', mockPath),
        {
          kind: 'nomatch',
          attempts: ({
            token: undefined,
            rules: [],
          } as unknown) as MatchAttempts,
        }
      );

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockErr],
        warnings: [mockWarning],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: true,
      });
      expect(formated).toMatch(red(` Parsing map file: ${mockPath}`));
      expect(formated).toMatch('SyntaxError: Expected  but found <NONE>');
      expect(formated).toMatch('--> some/path.suma:0:0');

      expect(formated).toMatch(
        yellow('test - Wrong Scope: expected foo, but got bar')
      );
    });

    it('formats file with errors and warnings correctly - short output', async () => {
      const mockPath = 'some/path.supr';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: [mockWarning],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        short: true,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(`Parsing profile file: ${mockPath}`);
      expect(formated).toMatch('0:0 detail');
      expect(formated).toMatch('test - Wrong Scope: expected foo, but got bar');
    });

    it('formats file with errors and warnings correctly - quiet', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: [mockWarning],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: true,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch('Parsing map file: some/path.suma');
      expect(formated).toMatch('detail');
    });

    it('formats file with errors correctly', async () => {
      const mockPath = 'some/path.supr';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: [],
      };
      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(`Parsing profile file: ${mockPath}`);
      expect(formated).toMatch('detail');
    });

    it('formats file with warnings correctly', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: [mockWarning],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(`Parsing map file: ${mockPath}`);
      expect(formated).toMatch(
        ' Parsing map file: some/path.suma\ntest - Wrong Scope: expected foo, but got bar\n'
      );
    });

    it('formats ok file correctly', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: [],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(`Parsing map file: ${mockPath}`);
    });

    it('formats compatibility correctly', async () => {
      const mockPath = 'some/path.supr';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'compatibility',
        profile: 'test-profile',
        errors: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };

      const formated = formatHuman({
        report: mockFileReport,
        quiet: false,
        emoji: false,
        color: false,
      });
      expect(formated).toMatch(
        `Validating profile: test-profile to map: ${mockPath}`
      );
      expect(formated).toMatch(' - Wrong Scope: expected this, but got that');
      expect(formated).toMatch(' - Wrong Scope: expected this, but got that');
    });
  });
  describe('when formating json', () => {
    const mockPath = 'some/path';

    const mockFileReport: ReportFormat = {
      path: mockPath,
      kind: 'file',
      errors: [mockSyntaxErr],
      warnings: [],
    };
    it('formats json correctly', async () => {
      expect(formatJson(mockFileReport)).toEqual(
        expect.not.stringMatching('source')
      );
    });
  });
});
