import {
  buildMapPath,
  buildProfilePath,
  buildProjectDefinitionFilePath,
  buildProviderPath,
  buildRunFilePath,
  buildSuperfaceDirPath,
} from './file-structure';

describe('fileStructure', () => {
  describe('buildSuperfaceDirPath', () => {
    it('builds superface dir path', () => {
      expect(buildSuperfaceDirPath()).toEqual(
        expect.stringContaining(`/superface`)
      );
    });
  });

  describe('buildProfilePath', () => {
    it('builds profile path', () => {
      expect(buildProfilePath('scope', 'name')).toEqual(
        expect.stringContaining(`/superface/scope.name.profile`)
      );

      expect(buildProfilePath(undefined, 'name')).toEqual(
        expect.stringContaining(`/superface/name.profile`)
      );
    });
  });

  describe('buildProviderPath', () => {
    it('builds provider path', () => {
      expect(buildProviderPath('provider')).toEqual(
        expect.stringContaining(`/superface/provider.provider.json`)
      );
    });

    it('builds provider path with scope', () => {
      expect(buildProviderPath('scope.provider')).toEqual(
        expect.stringContaining(`/superface/scope.provider.provider.json`)
      );
    });
  });

  describe('buildMapPath', () => {
    it('builds map path', () => {
      expect(
        buildMapPath({ profileName: 'profile', providerName: 'provider' })
      ).toEqual(expect.stringContaining(`/superface/profile.provider.map.js`));
    });

    it('builds map path with scope', () => {
      expect(
        buildMapPath({
          profileScope: 'scope',
          profileName: 'profile',
          providerName: 'provider',
        })
      ).toEqual(
        expect.stringContaining(`/superface/scope.profile.provider.map.js`)
      );
    });
  });

  describe('buildRunFilePath', () => {
    it('builds runfile path', () => {
      expect(
        buildRunFilePath({
          profileName: 'profile',
          providerName: 'provider',
          language: 'JS',
        })
      ).toEqual(expect.stringContaining(`/superface/profile.provider.mjs`));
    });

    it('builds runfile path with scope', () => {
      expect(
        buildRunFilePath({
          profileScope: 'scope',
          profileName: 'profile',
          providerName: 'provider',
          language: 'JS',
        })
      ).toEqual(
        expect.stringContaining(`/superface/scope.profile.provider.mjs`)
      );
    });
  });

  describe('buildProjectDefinitionFilePath', () => {
    it('builds project definition file path', () => {
      expect(buildProjectDefinitionFilePath()).toEqual(
        expect.stringContaining(`/superface/package.json`)
      );
    });
  });
});
