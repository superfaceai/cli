import { MapId } from './map';

describe('MapId helper', () => {
  describe('when creating MapId from name', () => {
    it('creates correct object', () => {
      expect(
        MapId.fromName({
          profile: {
            name: 'test',
          },
          provider: 'provider',
        }).toString()
      ).toEqual('test.provider');

      expect(
        MapId.fromName({
          profile: {
            name: 'test',
            scope: 'scope',
          },
          provider: 'provider',
          variant: 'bugfix',
        }).toString()
      ).toEqual('scope/test.provider.bugfix');
    });
  });

  describe('when MapId id with version', () => {
    it('returns correct id', () => {
      expect(
        MapId.fromName({
          profile: {
            name: 'test',
            scope: 'scope',
          },
          provider: 'provider',
          variant: 'bugfix',
        }).withVersion('1.0.0')
      ).toEqual('scope/test.provider.bugfix@1.0.0');

      expect(
        MapId.fromName({
          profile: {
            name: 'test',
            scope: 'scope',
          },
          provider: 'provider',
          variant: 'bugfix',
        }).withVersion()
      ).toEqual('scope/test.provider.bugfix');
    });
  });
});
