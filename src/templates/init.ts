import {
  ProfileSettings,
  ProviderSettings,
  SuperJsonStructure,
} from '../common/super.interfaces';

export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export function gitignore(): string {
  return `build
  node_modules
  package-lock.json
  `;
}

export function composeSuperStructure(
  profiles: ProfileSettings,
  providers: ProviderSettings
): SuperJsonStructure {
  return {
    profiles,
    providers,
  };
}

export function superJson(
  profiles: ProfileSettings,
  providers: ProviderSettings
): string {
  return JSON.stringify(composeSuperStructure(profiles, providers), null, 2);
}
