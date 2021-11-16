import { DocumentType } from '@superfaceai/ast';
import { parseProfileId } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import {
  composeUsecaseName,
  composeVersion,
  constructProfileProviderSettings,
  constructProfileSettings,
  constructProviderSettings,
  inferDocumentTypeWithFlag,
  trimExtension,
} from './document';

//Mock parser
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseProfileId: jest.fn(),
}));

describe('Document functions', () => {
  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when infering document type with flag', () => {
    it('infers document type correctly', async () => {
      expect(inferDocumentTypeWithFlag('map')).toEqual(DocumentType.MAP);
      expect(inferDocumentTypeWithFlag('profile')).toEqual(
        DocumentType.PROFILE
      );
      expect(inferDocumentTypeWithFlag('auto')).toEqual(DocumentType.UNKNOWN);
      expect(inferDocumentTypeWithFlag('auto', 'TesT.suma.ast.json ')).toEqual(
        DocumentType.MAP_AST
      );
      expect(inferDocumentTypeWithFlag('auto', 'TesT.supr.ast.json ')).toEqual(
        DocumentType.PROFILE_AST
      );
    });
  });

  describe('when composing version', () => {
    it('composes version correctly', async () => {
      expect(
        composeVersion({ major: 1, minor: 1, patch: 1, label: 'fix' })
      ).toEqual('1.1.1-fix');
      expect(
        composeVersion({ major: 1, minor: 1, patch: 1, label: 'fix' }, true)
      ).toEqual('1.1-fix');
    });
  });

  describe('when composing usecase name', () => {
    it('composes usecase name correctly', async () => {
      expect(composeUsecaseName('test-name')).toEqual('TestName');
      expect(composeUsecaseName('test_name')).toEqual('TestName');
    });
  });

  describe('when triming extension', () => {
    it('trims extension correctly', async () => {
      expect(trimExtension('test.suma')).toEqual('test');
      expect(trimExtension('test.supr')).toEqual('test');
      expect(trimExtension('test.suma.ast.json')).toEqual('test');
      expect(trimExtension('test.supr.ast.json')).toEqual('test');
      expect(() => trimExtension('test.json')).toThrow(
        'Could not infer document type'
      );
    });
  });

  describe('when constructing profile settings', () => {
    it('constructs profile settings correctly', async () => {
      mocked(parseProfileId)
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'first',
            version: { major: 1 },
          },
        })
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'second',
            version: { major: 2 },
          },
        });
      expect(constructProfileSettings(['first', 'second'])).toEqual({
        first: {
          version: '1.0.0',
          file: 'grid/first.supr',
        },
        second: {
          version: '2.0.0',
          file: 'grid/second.supr',
        },
      });
    });

    it('throws error for error kind', async () => {
      mocked(parseProfileId).mockReturnValueOnce({
        kind: 'error',
        message: 'test err',
      });
      expect(() => constructProfileSettings(['first'])).toThrow(
        'Wrong profile Id'
      );
    });
  });

  describe('when constructing profile provider settings', () => {
    it('constructs profile provider settings correctly', async () => {
      expect(constructProfileProviderSettings(['first', 'second'])).toEqual({
        first: {},
        second: {},
      });
    });
  });

  describe('when constructing provider settings', () => {
    it('constructs provider settings correctly', async () => {
      expect(constructProviderSettings(['first', 'second'])).toEqual({
        first: {},
        second: {},
      });
    });
  });
});
