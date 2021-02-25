import { Hook } from '@oclif/config';
import { VERSION as SDK_VERSION } from '@superfaceai/sdk';


export const hook: Hook<'init'> = async function (_options) {
	this.config.userAgent += ` (with @superfaceai/sdk/${SDK_VERSION})`;
}