import { join, normalize, relative } from 'path';

import { execShell, exists } from './io';
import { ILogger } from './log';

export interface IPackageManager {
  packageJsonExists(): Promise<boolean>;
  getUsedPm(): Promise<'npm' | 'yarn' | undefined>;
  init(initPm: 'npm' | 'yarn'): Promise<boolean>;
  installPackage(packageName: string): Promise<boolean>;
}

export class PackageManager implements IPackageManager {
  private usedPackageManager: 'npm' | 'yarn' | undefined = undefined;
  private path: string | undefined = undefined;

  constructor(private readonly logger: ILogger) {}

  public async packageJsonExists(): Promise<boolean> {
    const path = await this.getPath();
    if (path && (await exists(join(path, 'package.json')))) {
      return true;
    }

    return false;
  }

  public async getUsedPm(): Promise<'npm' | 'yarn' | undefined> {
    if (this.usedPackageManager) {
      return this.usedPackageManager;
    }
    const path = await this.getPath();
    if (!path) {
      return;
    }

    // Try to find yarn.lock
    if (await exists(join(path, 'yarn.lock'))) {
      this.usedPackageManager = 'yarn';

      return 'yarn';
    }

    // Try to find package-lock.json
    if (await exists(join(path, 'package-lock.json'))) {
      this.usedPackageManager = 'npm';

      return 'npm';
    }

    return;
  }

  public async init(initPm: 'yarn' | 'npm'): Promise<boolean> {
    const pm = await this.getUsedPm();
    if (pm && pm === initPm) {
      this.logger.error('pmAlreadyInitialized', pm);

      return false;
    }
    const command = initPm === 'yarn' ? 'yarn init -y' : 'npm init -y';

    this.logger.info('initPmOnPath', initPm, process.cwd());
    const result = await execShell(command);
    if (result.stderr !== '') {
      this.logger.error('shellCommandError', command, result.stderr.trimEnd());
    }

    if (result.stdout !== '') {
      this.logger.info('stdout', result.stdout.trimEnd());
    }

    // Set used PM after init
    this.usedPackageManager = initPm;

    return true;
  }

  public async installPackage(packageName: string): Promise<boolean> {
    if (!(await this.packageJsonExists())) {
      this.logger.error('pmNotInitialized', packageName);

      return false;
    }
    const pm = await this.getUsedPm();

    const command =
      pm === 'yarn' ? `yarn add ${packageName}` : `npm install ${packageName}`;

    const path = (await this.getPath()) || process.cwd();
    // Install package to package.json on discovered path or on cwd
    this.logger.info('installPackageOnPath', packageName, path, command);
    const result = await execShell(command, { cwd: path });
    if (result.stderr !== '') {
      this.logger.error('shellCommandError', command, result.stderr.trimEnd());
    }

    if (result.stdout !== '') {
      this.logger.info('stdout', result.stdout.trimEnd());
    }

    return true;
  }

  private async getPath(): Promise<string | undefined> {
    if (this.path) {
      return this.path;
    }

    const npmPrefix = await execShell('npm prefix');

    if (npmPrefix.stderr !== '') {
      this.logger.error('shellCommandError', 'npm prefix', npmPrefix.stderr);

      return;
    }
    this.path =
      relative(process.cwd(), npmPrefix.stdout.trim()) || normalize('./');

    return this.path;
  }
}
