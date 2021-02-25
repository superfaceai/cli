export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export function gitignore(): string {
  return `build
  node_modules
  package-lock.json
  `;
}

export function readme(name: string): string {
  return `# ${name}

Welcome to your new Superface project.

## Installation

Use the package manager [npm](https://www.npmjs.com/get-npm) to install necessary tools.

### Go to \`/superface\` directory:
\`\`\`bash
cd ${name}/superface
\`\`\`

### Install packages:
\`\`\`bash
npm install
\`\`\`

## Usage
TODO - initialize play scripts and other tools to use

## Test
TODO - initialize basic tests and enable way to test

## License
TODO
`;
}
