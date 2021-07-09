import { join, relative } from 'path';

import { execShell, exists } from './io';
import { LogCallback } from './log';

export class PackageManager {
  private static usedPackageManager: 'npm' | 'yarn' | undefined = undefined;
  private static path: string | undefined = undefined;

  private static async getPath(options?: {
    warnCb?: LogCallback;
  }): Promise<string | undefined> {
    if (PackageManager.path) {
      return PackageManager.path;
    }
    const npmPrefix = await execShell(`npm prefix`);

    if (npmPrefix.stderr !== '') {
      options?.warnCb?.(
        `Shell command "npm prefix" responded with: "${npmPrefix.stderr}"`
      );

      return;
    }
    if (process.cwd() === npmPrefix.stdout.trim()) {
      PackageManager.path = './';
    } else {
      PackageManager.path = relative(process.cwd(), npmPrefix.stdout.trim());
    }

    return PackageManager.path;
  }

  public static async packageJsonExists(options?: {
    warnCb?: LogCallback;
  }): Promise<boolean> {
    const path = await PackageManager.getPath(options);
    if (path && (await exists(join(path, 'package.json')))) {
      return true;
    }

    return false;
  }

  public static async getUsedPm(options?: {
    warnCb?: LogCallback;
  }): Promise<'npm' | 'yarn' | undefined> {
    if (PackageManager.usedPackageManager) {
      return PackageManager.usedPackageManager;
    }
    const path = await PackageManager.getPath(options);
    if (!path) {
      return;
    }

    //Try to find yarn.lock
    if (await exists(join(path, 'yarn.lock'))) {
      PackageManager.usedPackageManager = 'yarn';

      return 'yarn';
    }

    //Try to find package-lock.json
    if (await exists(join(path, 'package-lock.json'))) {
      PackageManager.usedPackageManager = 'npm';

      return 'npm';
    }

    return;
  }

  public static async init(
    initPm: 'yarn' | 'npm',
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<boolean> {
    const pm = await PackageManager.getUsedPm({ warnCb: options?.warnCb });
    if (pm && pm === initPm) {
      options?.warnCb?.(`${pm} already initialized.`);

      return false;
    }
    const command = initPm === 'yarn' ? `yarn init -y` : `npm init -y`;

    const result = await execShell(command);
    if (result.stderr !== '') {
      options?.warnCb?.(
        `Shell command "${command}" responded with: "${result.stderr.trimEnd()}"`
      );
    }

    if (result.stdout !== '') {
      options?.logCb?.(result.stdout.trimEnd());
    }

    //Set used PM after init
    PackageManager.usedPackageManager = initPm;

    return true;
  }

  public static async installPackage(
    packageName: string,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<boolean> {
    if (
      !(await PackageManager.packageJsonExists({ warnCb: options?.warnCb }))
    ) {
      options?.warnCb?.(
        `Unable to install package ${packageName} without initialized package.json`
      );

      return false;
    }
    const pm = await PackageManager.getUsedPm({ warnCb: options?.warnCb });

    const command =
      pm === 'yarn' ? `yarn add ${packageName}` : `npm install ${packageName}`;

    const result = await execShell(command);
    if (result.stderr !== '') {
      options?.warnCb?.(
        `Shell command "${command}" responded with: "${result.stderr.trimEnd()}"`
      );
    }

    if (result.stdout !== '') {
      options?.logCb?.(result.stdout.trimEnd());
    }

    return true;
  }
}
