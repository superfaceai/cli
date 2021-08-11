import { flags as oclifFlags } from '@oclif/command';
import { grey, red } from 'chalk';

import { Command } from '../common/command.abstract';
import { detectTestConfig } from '../common/io';
import { runTest } from '../logic/test';

export default class Test extends Command {
  static strict = false;

  static description =
    "Executes testing enviroment for capabilities based on local testing config file './sf-test-config.json'";

  static args = [
    {
      name: 'testName',
      required: false,
      description: 'Name of provider by which to filter test cases',
    },
  ];

  static flags = {
    ...Command.flags,
    updateSnapshots: oclifFlags.boolean({
      default: false,
      description: 'Updates currently present snapshots in your project',
    }),
    updateRecordings: oclifFlags.boolean({
      default: false,
      description: 'Updates currently recorded http traffic in your test cases',
    }),
  };

  static examples = [
    '$ superface test',
    '$ superface test -q',
    '$ superface test sendgrid',
    '$ superface test --updateSnapshots --updateRecordings',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private errorCallback? = (message: string) => this.error(red(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Test);

    if (flags.quiet) {
      this.logCallback = undefined;
    }

    const testConfigPath = await detectTestConfig(process.cwd(), undefined, {
      logCb: this.logCallback,
    });

    if (!testConfigPath) {
      this.error(
        'Testing configuration file has not been found. Create a new one based on steps at https://docs.superface.ai/test-config'
      );
    }

    if (args.testName !== undefined && typeof args.testName !== 'string') {
      this.error('Argument must be valid provider id.')
    }

    // // dryRun?
    await runTest(
      {
        path: testConfigPath,
        updateSnapshots: flags.updateSnapshots,
        updateRecordings: flags.updateRecordings,
        testName: args.testName,
      },
      {
        logCb: this.logCallback,
        errorCb: this.errorCallback,
      }
    );
  }
}
