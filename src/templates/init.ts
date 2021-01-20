export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export function gitignore(): string {
  return `build
  node_modules
  package-lock.json
  `;
}

export function superJson(): string {
  return 'TODO';
}
