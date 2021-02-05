import { SuperJsonStructure } from '../common/super.interfaces';

export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export function gitignore(): string {
  return `build
  node_modules
  package-lock.json
  `;
}

export function superJson(structure: SuperJsonStructure): string {
  return JSON.stringify(structure, null, 2);
}
