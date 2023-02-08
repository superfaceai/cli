import type { Hook } from '@oclif/config';
import { VERSION as SDK_VERSION } from '@superfaceai/one-sdk';
import { VERSION as PARSER_VERSION } from '@superfaceai/parser';

export const hook: Hook<'init'> = async function (_options) {
  this.config.userAgent += ` (with @superfaceai/one-sdk@${SDK_VERSION}, @superfaceai/parser@${PARSER_VERSION})`;
};
