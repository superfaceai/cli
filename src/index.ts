// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-var-requires
const packageJson = require('../package.json');

export * from './logic';
export * from './common';
export { run } from '@oclif/command';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
export const VERSION: string = packageJson.version;

//Re-xport parser and AST
export * from '@superfaceai/ast';
