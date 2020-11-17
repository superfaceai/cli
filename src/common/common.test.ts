import {
  DocumentType,
  inferDocumentType,
  inferDocumentTypeWithFlag,
} from './document';

describe('inferDocumentType()', () => {
  it('infers map type', () => {
    expect(inferDocumentType('test.suma')).toEqual(DocumentType.MAP);
    expect(inferDocumentType('test.map.slang')).toEqual(DocumentType.MAP);
  });

  it('infers profile type', () => {
    expect(inferDocumentType('test.supr')).toEqual(DocumentType.PROFILE);
    expect(inferDocumentType('test.profile.slang')).toEqual(
      DocumentType.PROFILE
    );
  });

  it('returns unknown for unknown types', () => {
    expect(inferDocumentType('test.supr.face')).toEqual(DocumentType.UNKNOWN);
    expect(inferDocumentType('test.profile.slang.json')).toEqual(
      DocumentType.UNKNOWN
    );
    expect(inferDocumentType('test.slang')).toEqual(DocumentType.UNKNOWN);
    expect(inferDocumentType('test')).toEqual(DocumentType.UNKNOWN);
  });
});

describe('inferDocumentTypeWithFlag()', () => {
  it('infers map type when flag is map', () => {
    expect(inferDocumentTypeWithFlag('map')).toEqual(DocumentType.MAP);
    expect(inferDocumentTypeWithFlag('map', 'test.suma')).toEqual(
      DocumentType.MAP
    );
    expect(inferDocumentTypeWithFlag('map', 'test.supr')).toEqual(
      DocumentType.MAP
    );
  });

  it('infers profile type when flag is profile', () => {
    expect(inferDocumentTypeWithFlag('profile')).toEqual(DocumentType.PROFILE);
    expect(inferDocumentTypeWithFlag('profile', 'test.suma')).toEqual(
      DocumentType.PROFILE
    );
    expect(inferDocumentTypeWithFlag('profile', 'test.supr')).toEqual(
      DocumentType.PROFILE
    );
  });

  it('infers unknown when flag is auto and path is not passed', () => {
    expect(inferDocumentTypeWithFlag('auto')).toEqual(DocumentType.UNKNOWN);
  });

  it('infers from path when flag is auto', () => {
    expect(inferDocumentTypeWithFlag('auto', 'test.suma')).toEqual(
      DocumentType.MAP
    );
    expect(inferDocumentTypeWithFlag('auto', 'test.map.slang')).toEqual(
      DocumentType.MAP
    );
    expect(inferDocumentTypeWithFlag('auto', 'test.supr')).toEqual(
      DocumentType.PROFILE
    );
    expect(inferDocumentTypeWithFlag('auto', 'test.profile.slang')).toEqual(
      DocumentType.PROFILE
    );

    expect(inferDocumentTypeWithFlag('auto', 'test')).toEqual(
      DocumentType.UNKNOWN
    );
  });
});
