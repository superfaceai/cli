import { join, relative } from 'path';

import { execShell, exists } from './io';
import { LogCallback } from './log';

export class PackageManager {
  private static usedPackageManager: 'npm' | 'yarn' | undefined = undefined;

  private static async getUsedPm(options?: {
    warnCb?: LogCallback;
  }): Promise<'npm' | 'yarn' | undefined> {
    if (PackageManager.usedPackageManager) {
      return PackageManager.usedPackageManager;
    }
    const npmPrefix = await execShell(`npm prefix`);

    if (npmPrefix.stderr !== '') {
      options?.warnCb?.(
        `Shell command "npm prefix" responded with: "${npmPrefix.stderr}"`
      );

      return;
    }
    const path = relative(process.cwd(), npmPrefix.stdout.trim());

    if (await exists(join(path, 'yarn.lock'))) {
      PackageManager.usedPackageManager = 'yarn';

      return 'yarn';
    }

    if (await exists(join(path, 'package-lock.json'))) {
      PackageManager.usedPackageManager = 'npm';

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
  ): Promise<boolean> {
    const pm = await PackageManager.getUsedPm({ warnCb: options?.warnCb });

    const command =
      pm === 'yarn' ? `yarn add ${packageName}` : `npm install ${packageName}`;

    const result = await execShell(command);
    if (result.stderr !== '') {
      options?.warnCb?.(
        `Shell command "${command}" responded with: "${result.stderr}"`
      );

      return false;
    }
    if (result.stdout !== '') {
      options?.logCb?.(result.stdout);
    }

    return true;
  }
}
