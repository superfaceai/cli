import { Hook } from '@oclif/config';
import { VERSION as SDK_VERSION } from '@superfaceai/sdk';

export const hook: Hook<'init'> = async function (_options) {
  // TODO: Fix this in sdk
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  this.config.userAgent += ` (with @superfaceai/sdk/${SDK_VERSION})`;
};
