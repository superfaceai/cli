import { join, normalize, relative } from 'path';

import { Logger } from '.';
import { execShell, exists } from './io';

export class PackageManager {
  private static usedPackageManager: 'npm' | 'yarn' | undefined = undefined;
  private static path: string | undefined = undefined;

  private static async getPath(): Promise<string | undefined> {
    if (PackageManager.path) {
      return PackageManager.path;
    }
    const npmPrefix = await execShell(`npm prefix`);

    if (npmPrefix.stderr !== '') {
      Logger.error(
        `Shell command npm prefix responded with: ${npmPrefix.stderr}`
      );

      return;
    }
    PackageManager.path =
      relative(process.cwd(), npmPrefix.stdout.trim()) || normalize('./');

    return PackageManager.path;
  }

  public static async packageJsonExists(): Promise<boolean> {
    const path = await PackageManager.getPath();
    if (path && (await exists(join(path, 'package.json')))) {
      return true;
    }

    return false;
  }

  public static async getUsedPm(): Promise<'npm' | 'yarn' | undefined> {
    if (PackageManager.usedPackageManager) {
      return PackageManager.usedPackageManager;
    }
    const path = await PackageManager.getPath();
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

  public static async init(initPm: 'yarn' | 'npm'): Promise<boolean> {
    const pm = await PackageManager.getUsedPm();
    if (pm && pm === initPm) {
      Logger.error(`${pm} already initialized.`);

      return false;
    }
    const command = initPm === 'yarn' ? `yarn init -y` : `npm init -y`;

    Logger.info(`Initializing ${initPm} on path: ${process.cwd()}`);
    const result = await execShell(command);
    if (result.stderr !== '') {
      Logger.error(
        `Shell command ${command} responded with: ${result.stderr.trimEnd()}`
      );
    }

    if (result.stdout !== '') {
      Logger.info(result.stdout.trimEnd());
    }

    //Set used PM after init
    PackageManager.usedPackageManager = initPm;

    return true;
  }

  public static async installPackage(packageName: string): Promise<boolean> {
    if (!(await PackageManager.packageJsonExists())) {
      Logger.error(
        `Unable to install package ${packageName} without initialized package.json`
      );

      return false;
    }
    const pm = await PackageManager.getUsedPm();

    const command =
      pm === 'yarn' ? `yarn add ${packageName}` : `npm install ${packageName}`;

    const path = (await PackageManager.getPath()) || process.cwd();
    //Install package to package.json on discovered path or on cwd
    Logger.info(
      `Installing package ${packageName} on path: ${path} with: ${command}`
    );
    const result = await execShell(command, { cwd: path });
    if (result.stderr !== '') {
      Logger.error(
        `Shell command ${command} responded with: ${result.stderr.trimEnd()}`
      );
    }

    if (result.stdout !== '') {
      Logger.info(result.stdout.trimEnd());
    }

    return true;
  }
}
