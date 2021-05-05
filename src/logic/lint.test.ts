import { CLIError } from '@oclif/errors';
import {
  MapDocumentNode,
  MapHeaderNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import {
  MapDocumentId,
  MatchAttempts,
  parseMap,
  parseMapId,
  parseProfile,
  ProfileHeaderStructure,
  Source,
  SyntaxError,
  ValidationResult,
} from '@superfaceai/parser';
import { SyntaxErrorCategory } from '@superfaceai/parser/dist/language/error';
import { mocked } from 'ts-jest/utils';

import { readFile } from '../common/io';
import { ListWriter } from '../common/list-writer';
import { OutputStream } from '../common/output-stream';
import { ReportFormat } from '../common/report.interfaces';
import {
  createFileReport,
  createProfileMapReport,
  formatHuman,
  formatJson,
  getMapDocument,
  getProfileDocument,
  isValidHeader,
  isValidMapId,
  lintFile,
  lintFiles,
  lintMapsToProfile,
} from './lint';
//Mock io
jest.mock('../common/io', () => ({
  readFile: jest.fn(),
}));

// //Mock parser
jest.mock('@superfaceai/parser', () => ({
  parseProfileId: jest.fn(),
}));

//Mock output stream
jest.mock('../common/output-stream');
//Mock ast

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseMap: jest.fn(),
  parseMapId: jest.fn(),
  parseProfile: jest.fn(),
}));

describe('Lint logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  const mockSyntaxErr = {
    source: new Source('test'),
    location: {
      line: 0,
      column: 0,
    },
    span: {
      start: 0,
      end: 0,
    },
    category: SyntaxErrorCategory.PARSER,
    detail: '',
    format: () => 'detail',
    message: 'message',
  };

  describe('when linting multiple files', () => {
    const mockContent = 'file-content';
    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'test-profile',
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
    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };
    const mockReportFn: (report: ReportFormat) => string = (
      report: ReportFormat
    ) => JSON.stringify(report);
    const mockListWriter = new ListWriter(new OutputStream('test'), '');

    it('lints map files', async () => {
      mocked(readFile).mockResolvedValue('file-content');
      const mockPath = 'test';
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValueOnce(mockMapDocument);
      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lintFiles([mockPath], mockListWriter, 'map', mockReportFn)
      ).resolves.toEqual([[0, 0]]);

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseProfile).not.toHaveBeenCalled();

      expect(parseMap).toHaveBeenCalledWith(new Source(mockContent, mockPath));

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);

      expect(writeElementSpy).toHaveBeenCalledTimes(1);
      expect(writeElementSpy).toHaveBeenCalledWith(
        mockReportFn({
          kind: 'file',
          path: mockPath,
          errors: [],
          warnings: [],
        })
      );
    });

    it('lints profile files', async () => {
      const mockPath = 'test';
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lintFiles([mockPath], mockListWriter, 'profile', mockReportFn)
      ).resolves.toEqual([[0, 0]]);

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseMap).not.toHaveBeenCalled();

      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockPath)
      );

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);

      expect(writeElementSpy).toHaveBeenCalledTimes(1);
      expect(writeElementSpy).toHaveBeenCalledWith(
        mockReportFn({
          kind: 'file',
          path: mockPath,
          errors: [],
          warnings: [],
        })
      );
    });
  });

  describe('when linting single file', () => {
    it('throw error on unkonown file type', async () => {
      mocked(readFile).mockResolvedValue('file-content');
      const mockPath = 'test';
      await expect(lintFile(mockPath, 'auto')).rejects.toEqual(
        new CLIError('Could not infer document type')
      );

      expect(readFile).not.toHaveBeenCalled();
    });

    it('lints map type file without errors', async () => {
      const mockContent = 'file-content';
      const mockDocument: MapDocumentNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'test-profile',
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
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValue(mockDocument);
      const mockPath = 'test';

      await expect(lintFile(mockPath, 'map')).resolves.toEqual({
        kind: 'file',
        path: mockPath,
        errors: [],
        warnings: [],
      });

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseProfile).not.toHaveBeenCalled();

      expect(parseMap).toHaveBeenCalledWith(new Source(mockContent, mockPath));

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });

    it('lints profile type file without errors', async () => {
      const mockContent = 'file-content';
      const mockDocument: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          name: 'test-profile',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        definitions: [],
      };
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockDocument);
      const mockPath = 'test';

      await expect(lintFile(mockPath, 'profile')).resolves.toEqual({
        kind: 'file',
        path: mockPath,
        errors: [],
        warnings: [],
      });

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseMap).not.toHaveBeenCalled();
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockPath)
      );

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });

    it('lints profile type file with errors', async () => {
      const mockContent = 'file-content';
      const mockPath = 'test';
      const mockErr = new Error('mockSyntaxError');

      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockImplementation(() => {
        throw mockErr;
      });

      await expect(lintFile(mockPath, 'profile')).resolves.toEqual({
        kind: 'file',
        path: mockPath,
        errors: [mockErr],
        warnings: [],
      });

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseMap).not.toHaveBeenCalled();
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockPath)
      );

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });

    it('lints map type file with errors', async () => {
      const mockContent = 'file-content';
      const mockPath = 'test';
      const mockErr = new Error('mockSyntaxError');

      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockImplementation(() => {
        throw mockErr;
      });

      await expect(lintFile(mockPath, 'map')).resolves.toEqual({
        kind: 'file',
        path: mockPath,
        errors: [mockErr],
        warnings: [],
      });

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseProfile).not.toHaveBeenCalled();
      expect(parseMap).toHaveBeenCalledWith(new Source(mockContent, mockPath));

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });
  });

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
      ).toThrowError(new CLIError('parse-error'));
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
    const mockFiles = [
      'profile.supr',
      'map.suma',
      'unknown.unknown',
      'second-map.suma',
    ];
    const mockListWriter = new ListWriter(new OutputStream('test'), '');
    const mockReportFn: (report: ReportFormat) => string = (
      report: ReportFormat
    ) => JSON.stringify(report);
    const mockContent = 'file-content';
    const mocProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
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
    it('throws error without profile', async () => {
      await expect(
        lintMapsToProfile(
          ['map.suma', 'unknown.unknown', 'second-map.suma'],
          mockListWriter,
          mockReportFn
        )
      ).rejects.toEqual(new CLIError('Cannot validate without profile'));
    });
    it('throws error without map', async () => {
      await expect(
        lintMapsToProfile(
          ['map.supr', 'unknown.unknown'],
          mockListWriter,
          mockReportFn
        )
      ).rejects.toEqual(new CLIError('Cannot validate without map'));
    });

    it('returns correct counts', async () => {
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mocProfileDocument);
      mocked(parseMap)
        .mockReturnValueOnce(mockMapDocumentMatching)
        .mockReturnValueOnce(mockMapDocument);
      mocked(parseMapId).mockReturnValue({
        kind: 'parsed',
        value: {
          name: 'test-profile',
          provider: 'test-profile',
          version: {
            major: 1,
            minor: 0,
          },
        },
      });

      const writeElementSpy = jest
        .spyOn(mockListWriter, 'writeElement')
        .mockResolvedValue(undefined);

      await expect(
        lintMapsToProfile(mockFiles, mockListWriter, mockReportFn)
      ).resolves.toEqual([
        [0, 1],
        [0, 0],
        [1, 0],
      ]);

      expect(writeElementSpy).toHaveBeenCalledTimes(4);
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        1,
        mockReportFn({
          kind: 'file',
          path: 'unknown.unknown',
          errors: [],
          warnings: ['Could not infer document type'],
        })
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        2,
        mockReportFn({
          kind: 'compatibility',
          profile: 'profile.supr',
          path: 'map.suma',
          errors: [],
          warnings: [],
        })
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        3,
        '⚠️ map second-map.suma assumed to belong to profile profile.supr based on file name'
      );
      expect(writeElementSpy).toHaveBeenNthCalledWith(
        4,
        mockReportFn({
          kind: 'compatibility',
          profile: 'profile.supr',
          path: 'second-map.suma',
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
    });
  });

  describe('when formating for human', () => {
    it('formats file with errors and warnings correctly', async () => {
      const mockPath = 'some/path';
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

      expect(formatHuman(mockFileReport, false)).toEqual(
        `❌ ${mockPath}\nSyntaxError: Expected  but found <NONE>\n --> some/path:0:0\n-1 | mock-content\n  |             \n\n\n\touch!\n`
      );
    });

    it('formats file with errors and warnings correctly - short output', async () => {
      const mockPath = 'some/path';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: ['ouch!'],
      };

      expect(formatHuman(mockFileReport, false, true)).toEqual(
        `❌ ${mockPath}\n\t0:0 message\n\n\touch!\n`
      );
    });

    it('formats file with errors and warnings correctly - quiet', async () => {
      const mockPath = 'some/path';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: ['ouch!'],
      };

      expect(formatHuman(mockFileReport, true)).toEqual(
        `❌ some/path\ndetail\n`
      );
    });

    it('formats file with errors correctly', async () => {
      const mockPath = 'some/path';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [mockSyntaxErr],
        warnings: [],
      };

      expect(formatHuman(mockFileReport, false)).toEqual(
        `❌ ${mockPath}\ndetail`
      );
    });

    it('formats file with warnings correctly', async () => {
      const mockPath = 'some/path';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: ['ouch!'],
      };

      expect(formatHuman(mockFileReport, false)).toEqual(
        `⚠️ ${mockPath}\n\touch!\n`
      );
    });

    it('formats ok file correctly', async () => {
      const mockPath = 'some/path';

      const mockFileReport: ReportFormat = {
        path: mockPath,
        kind: 'file',
        errors: [],
        warnings: [],
      };

      expect(formatHuman(mockFileReport, false)).toEqual(`🆗 ${mockPath}\n`);
    });

    it('formats compatibility correctly', async () => {
      const mockPath = 'some/path';

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

      expect(formatHuman(mockFileReport, false)).toEqual(
        `➡️ Profile:	test-profile\n❌ ${mockPath}\n - Wrong Scope: expected this, but got that\n - Wrong Scope: expected this, but got that\n`
      );
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
        '{"path":"some/path","kind":"file","errors":[{"location":{"line":0,"column":0},"span":{"start":0,"end":0},"category":"Parser","detail":"","message":"message"}],"warnings":[]}'
      );
    });
  });

  describe('when geting profile document', () => {
    const mockContent = 'file-content';
    const mocProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
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

    it('returns correct source', async () => {
      const mockPath = 'test';
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mocProfileDocument);

      await expect(getProfileDocument(mockPath)).resolves.toEqual(
        mocProfileDocument
      );

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockPath)
      );

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });
  });

  describe('when geting map document', () => {
    const mockContent = 'file-content';
    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
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

    it('returns correct source', async () => {
      const mockPath = 'test';
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValue(mockMapDocument);

      await expect(getMapDocument(mockPath)).resolves.toEqual(mockMapDocument);

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseMap).toHaveBeenCalledWith(new Source(mockContent, mockPath));

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith(mockPath);
    });
  });
});
