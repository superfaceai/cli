import { DocumentType, inferDocumentType } from '@superfaceai/ast';

// import { inferDocumentTypeWithFlag } from './document';

describe('inferDocumentType()', () => {
  it('infers map type', () => {
    expect(inferDocumentType('test.suma')).toEqual(DocumentType.MAP);
  });

  it('infers profile type', () => {
    expect(inferDocumentType('test.supr')).toEqual(DocumentType.PROFILE);
  });

  it('returns unknown for unknown types', () => {
    expect(inferDocumentType('test.supr.face')).toEqual(DocumentType.UNKNOWN);
    expect(inferDocumentType('test.slang')).toEqual(DocumentType.UNKNOWN);
    expect(inferDocumentType('test')).toEqual(DocumentType.UNKNOWN);
  });
});
