import { SuperJson } from '@superfaceai/one-sdk';
import { grey } from 'chalk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { check } from '../logic/check';
import { detectSuperJson } from '../logic/install';

export default class Check extends Command {
  static strict = false;

  static description =
    'Checks if all local profiles have maps with corresponding version, scope, name, use case definitions and providers';

  static args = [];

  static flags = {
    ...Command.flags,
  };

  static examples = ['$ station check', '$ station check -q'];

  private logCallback?= (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { flags } = this.parse(Check);

    if (flags.quiet) {
      this.logCallback = undefined;
    }

    const superPath = await detectSuperJson(process.cwd());
    if (!superPath) {
      throw userError('Unable to compile, super.json not found', 1);
    }
    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err}`, 1);
      }
    );

    await check(superJson, { logCb: this.logCallback });
  }
}

