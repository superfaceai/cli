import { join, relative } from 'path';

import { execShell, exists } from './io';
import { LogCallback } from './log';

export class PackageManager {
  public static async getUsedPm(options?: {
    warnCb?: LogCallback;
  }): Promise<'npm' | 'yarn' | undefined> {
    const npmPrefix = await execShell(`npm prefix`);

    if (npmPrefix.stderr !== '') {
      options?.warnCb?.(
        `Shell command "npm prefix" responded with: "${npmPrefix.stderr}"`
      );

      return;
    }
    const path = relative(process.cwd(), npmPrefix.stdout.trim());

    if (await exists(join(path, 'yarn.lock'))) {
      return 'yarn';
    }

    if (await exists(join(path, 'package-lock.json'))) {
      return 'npm';
    }
    options?.warnCb?.('Unable to locate package.json');

    return;
  }

  public static async installPackage(
    packageName: string,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<void> {
    const pm = await PackageManager.getUsedPm({ warnCb: options?.warnCb });

    const command =
      pm === 'yarn' ? `yarn add ${packageName}` : `npm install ${packageName}`;

    const result = await execShell(command);
    if (result.stderr !== '') {
      options?.warnCb?.(
        `Shell command "${command}" responded with: "${result.stderr}"`
      );
    }
    if (result.stdout !== '') {
      options?.logCb?.(result.stdout);
    }
  }
}
