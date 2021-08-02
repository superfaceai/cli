import { grey } from 'chalk';
import { run as runJest } from 'jest';

import { Command } from '../common/command.abstract';
import { detectTestConfig } from '../common/io';

export default class Test extends Command {
  static strict = false;

  static description =
    "Executes testing enviroment for capabilities based on local testing config file './sf-test-config.json'";

  static args = [
    {
      name: 'testName',
      required: false,
      description: 'Name of the test to execute',
    },
  ];

  static flags = {
    ...Command.flags,
  };

  static examples = [
    '$ superface test',
    '$ superface test -q',
    '$ superface test sendgrid',
  ];

  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { flags } = this.parse(Test);

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

    // TODO: implement filtering tests based on argument

    await runJest(['templated-test.test']);
  }
}
