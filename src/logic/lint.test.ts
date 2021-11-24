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
  ValidationResult,
} from '@superfaceai/parser';
import { SyntaxErrorCategory } from '@superfaceai/parser/dist/language/error';
import { MatchAttempts } from '@superfaceai/parser/dist/language/syntax/rule';
import { mocked } from 'ts-jest/utils';

import { fetchMapAST, fetchProfileAST } from '../common/http';
import { ListWriter } from '../common/list-writer';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { ReportFormat } from '../common/report.interfaces';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';
import {
  createFileReport,
  createProfileMapReport,
  formatHuman,
  formatJson,
  isValidHeader,
  isValidMapId,
  lint,
  ProfileToValidate,
} from './lint';
//Mock io
jest.mock('../common/io', () => ({
  readFile: jest.fn(),
}));

//Mock output stream
jest.mock('../common/output-stream');

//Mock check utils
jest.mock('./check.utils', () => ({
  findLocalMapSource: jest.fn(),
  findLocalProfileSource: jest.fn(),
}));

//Mock http
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
  const mockMapPath = 'mockMapPath';
  const mockProfilePath = 'mockProfilePath';
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

  const mockSyntaxErr: SyntaxError = {
    source: new Source('test'),
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
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
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
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
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
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
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
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
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
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
      ).toEqual(false);
    });

    it('throws error if there is a parse error', async () => {
      mocked(parseMapId).mockReturnValue({
        kind: 'error',
        message: 'parse-error',
      });
      const mockMapPath = 'testMapPath';
      expect(() =>
        isValidMapId(mockValidProfileHeader, mocValidMapHeader, mockMapPath)
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
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
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

  describe('when creating file report', () => {
    it('creates file report correctly', async () => {
      const mockPath = 'test-path';
      const mockWarning = 'ouch!';

      expect(
        createFileReport(mockPath, [mockSyntaxErr], [mockWarning])
      ).toEqual({
        kind: 'file',
        path: mockPath,
        errors: [mockSyntaxErr],
        warnings: [mockWarning],
      });
    });
  });

  describe('when linting maps to profile', () => {
    const mockListWriter = new ListWriter(new OutputStream('test'), '');
    const mockReportFn: (report: ReportFormat) => string = (
      report: ReportFormat
    ) => JSON.stringify(report);
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

      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lint(mockSuperJson, mockProfiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([
        [1, 0],
        [0, 0],
      ]);

      expect(writeElementSpy).toHaveBeenCalledTimes(5);

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        1,
        mockReportFn({
          kind: 'file',
          path: mockProfilePath,
          errors: [],
          warnings: [],
        })
      );

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        2,
        mockReportFn({
          kind: 'file',
          path: 'swapi path',
          errors: [],
          warnings: [],
        })
      );

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        3,
        mockReportFn({
          kind: 'compatibility',
          profile: mockProfilePath,
          path: 'swapi path',
          errors: [
            {
              kind: 'wrongProfileName',
              context: {
                path: ['MapHeader'],
                expected: 'test-profile',
                actual: 'different-test-profile',
              },
            },
          ],
          warnings: [],
        })
      );

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        4,
        mockReportFn({
          kind: 'file',
          path: 'starwars path',
          errors: [],
          warnings: [],
        })
      );

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        5,
        mockReportFn({
          kind: 'compatibility',
          profile: mockProfilePath,
          path: 'starwars path',
          errors: [],
          warnings: [],
        })
      );
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

      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lint(mockSuperJson, mockProfiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([
        [1, 0],
        [0, 0],
      ]);

      expect(writeElementSpy).toHaveBeenCalledTimes(3);

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        1,
        mockReportFn({
          kind: 'file',
          path: mockProfilePath,
          errors: [],
          warnings: [],
        })
      );

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        2,
        mockReportFn({
          kind: 'compatibility',
          profile: mockProfilePath,
          path: `${profile.id}.swapi.test@1.0.0`,
          errors: [
            {
              kind: 'wrongProfileName',
              context: {
                path: ['MapHeader'],
                expected: 'test-profile',
                actual: 'different-test-profile',
              },
            },
          ],
          warnings: [],
        })
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        3,
        mockReportFn({
          kind: 'compatibility',
          profile: mockProfilePath,
          path: `${profile.id}.starwars.test@1.0.0`,
          errors: [],
          warnings: [],
        })
      );
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

      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lint(mockSuperJson, mockProfiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([
        [1, 0],
        [0, 0],
      ]);

      expect(writeElementSpy).toHaveBeenCalledTimes(2);

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        1,
        mockReportFn({
          kind: 'compatibility',
          profile: profile.withVersion('1.0.0'),
          path: `${profile.id}.swapi.test@1.0.0`,
          errors: [
            {
              kind: 'wrongProfileName',
              context: {
                path: ['MapHeader'],
                expected: 'test-profile',
                actual: 'different-test-profile',
              },
            },
          ],
          warnings: [],
        })
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        2,
        mockReportFn({
          kind: 'compatibility',
          profile: profile.withVersion('1.0.0'),
          path: `${profile.id}.starwars.test@1.0.0`,
          errors: [],
          warnings: [],
        })
      );
    });

    it('returns correct counts, corrupted profile', async () => {
      const mockSyntaxErr: SyntaxError = {
        source: new Source('test'),
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

      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lint(mockSuperJson, mockProfiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([[1, 0]]);

      expect(writeElementSpy).toHaveBeenCalledTimes(1);

      expect(writeElementSpy).toHaveBeenCalledWith(
        mockReportFn({
          kind: 'file',
          path: mockProfilePath,
          errors: [mockSyntaxErr],
          warnings: [],
        })
      );
    });
    it('returns correct counts, corrupted map', async () => {
      const mockSyntaxErr: SyntaxError = {
        source: new Source('test'),
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
      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lint(mockSuperJson, mockProfiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([[1, 0]]);

      expect(writeElementSpy).toHaveBeenCalledTimes(2);

      expect(writeElementSpy).toHaveBeenNthCalledWith(
        1,
        mockReportFn({
          kind: 'file',
          path: mockProfilePath,
          errors: [],
          warnings: [],
        })
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        2,
        mockReportFn({
          kind: 'file',
          path: mockMapPath,
          errors: [mockSyntaxErr],
          warnings: [],
        })
      );
    });
  });

  describe('when formating for human', () => {
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
        warnings: ['ouch!'],
      };

      const formated = formatHuman(mockFileReport, false);
      expect(formated).toMatch(`❌ Parsing map file: ${mockPath}`);
      expect(formated).toMatch('SyntaxError: Expected  but found <NONE>');
      expect(formated).toMatch(`--> some/path.suma:0:0`);

      expect(formated).toMatch(`-1 | mock-content`);
      expect(formated).toMatch('ouch!');
    });

    it('formats file with errors and warnings correctly - short output', async () => {
      const mockPath = 'some/path.supr';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: ['ouch!'],
      };

      const formated = formatHuman(mockFileReport, false, true);
      expect(formated).toMatch(`❌ Parsing profile file: ${mockPath}`);
      expect(formated).toMatch('0:0 message');
      expect(formated).toMatch('ouch!');
    });

    it('formats file with errors and warnings correctly - quiet', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: ['ouch!'],
      };

      const formated = formatHuman(mockFileReport, true);
      expect(formated).toMatch(`❌ Parsing map file: some/path.suma`);
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
      const formated = formatHuman(mockFileReport, false);
      expect(formated).toMatch(`❌ Parsing profile file: ${mockPath}`);
      expect(formated).toMatch('detail');
    });

    it('formats file with warnings correctly', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: ['ouch!'],
      };

      const formated = formatHuman(mockFileReport, false);
      expect(formated).toMatch(`⚠️ Parsing map file: ${mockPath}`);
      expect(formated).toMatch('ouch!');
    });

    it('formats ok file correctly', async () => {
      const mockPath = 'some/path.suma';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: [],
      };

      const formated = formatHuman(mockFileReport, false);
      expect(formated).toMatch(`🆗 Parsing map file: ${mockPath}`);
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
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };

      const formated = formatHuman(mockFileReport, false);
      expect(formated).toMatch(
        `❌ Validating profile: test-profile to map: ${mockPath}`
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
        '{"path":"some/path","kind":"file","errors":[{"location":{"start":{"line":0,"column":0,"charIndex":0},"end":{"line":0,"column":0,"charIndex":0}},"category":"Parser","detail":"","message":"message"}],"warnings":[]}'
      );
    });
  });
});
