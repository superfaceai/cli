import { Hook } from '@oclif/config';
import { VERSION as SDK_VERSION } from '@superfaceai/sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';

export const hook: Hook<'init'> = async function (_options) {
  this.config.userAgent += ` (with @superfaceai/sdk/${SDK_VERSION}, @superfaceai/parser/${PARSER_VERSION})`;
};
