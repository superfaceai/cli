import { detectFormat, SuperfaceFormat } from "./detectFormat";

describe('#detectFormat()', () => {
  it('detects Superface Map', () => {
    expect(detectFormat('./some/path/api.suma')).toEqual(SuperfaceFormat.Map);
    expect(detectFormat('./some/path/api.SUMA')).toEqual(SuperfaceFormat.Map);
  });

  it('detects Superface Profile', () => {
    expect(detectFormat('./some/path/api.supr')).toEqual(SuperfaceFormat.Profile);
    expect(detectFormat('./some/path/api.SUPR')).toEqual(SuperfaceFormat.Profile);
  });

  it('returns UNKNOWN for unknown extensions', () => {
    expect(detectFormat('./some/path/api.s')).toEqual(SuperfaceFormat.UNKNOWN);
    expect(detectFormat('./some/path/api')).toEqual(SuperfaceFormat.UNKNOWN);
  });
});
