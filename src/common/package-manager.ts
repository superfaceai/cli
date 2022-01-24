import * as lockfile from '@yarnpkg/lockfile';
import { join, normalize, relative } from 'path';

import { execShell, exists, readFileQuiet } from './io';
import { ILogger } from './log';

export interface IPackageManager {
  packageJsonExists(): Promise<boolean>;
  getUsedPm(): Promise<'npm' | 'yarn' | undefined>;
  init(initPm: 'npm' | 'yarn'): Promise<boolean>;
  installPackage(packageName: string): Promise<boolean>;
}

const SUPERFACE_SDK = '@superfaceai/one-sdk';
const SUPERFACE_AST = '@superfaceai/ast';
const SUPERFACE_PARSER = '@superfaceai/parser';

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

  public async getSfVersions(
    _packageName: string
  ): Promise<{ sdk?: string; ast?: string; parser?: string }> {
    //Try to use pm to get packages versions
    if (!(await this.packageJsonExists())) {
      this.logger.error('packageJsonNotFound');

      return {};
    }

    const pm = await this.getUsedPm();
    //TODO: select one approach:

    //First approach - try to use yarn list/npm ls
    const command =
      pm === 'yarn'
        ? 'yarn list --pattern @superfaceai'
        : 'npm ls --json --all';

    const path = (await this.getPath()) || process.cwd();

    const result = await execShell(command, { cwd: path });
    if (result.stderr !== '') {
      this.logger.error('shellCommandError', command, result.stderr.trimEnd());
    }
    //Extract versions - different structure for yarn and npm
    // console.log('res', result.stdout);

    //Second approach parse lock file - probably quite accurate
    const lockFileName = pm === 'yarn' ? 'yarn.lock' : 'package-lock.json';
    const lockFilePath = join(path, lockFileName);

    if (await exists(lockFilePath)) {
      const lockFileContent = await readFileQuiet(lockFilePath);
      if (lockFileContent) {
        if (pm === 'yarn') {
          return this.extractYarnLock(lockFileContent);
        } else {
          return this.extractPackageLock(lockFileContent);
        }
      }
    }

    //Naive but probalby more stable approach - via node_modules
    // let sdk,
    //   parser,
    //   ast = undefined;
    // const sdkPackagePath = join(
    //   path,
    //   'node_modules',
    //   SUPERFACE_SDK,
    //   'package.json'
    // );
    // if (await exists(sdkPackagePath)) {
    //   const sdkPackageJson = await readFileQuiet(sdkPackagePath);
    //   if (sdkPackageJson) {
    //     const content: Record<string, unknown> = JSON.parse(sdkPackageJson);

    //     if (content.version && typeof content.version === 'string') {
    //       sdk = content.version;
    //     }

    //     if (content.dependencies && typeof content.dependencies === 'object') {
    //       const deps = content.dependencies as Record<string, string>;
    //       if (deps[SUPERFACE_AST]) {
    //         ast = deps[SUPERFACE_AST];
    //       }
    //       if (deps[SUPERFACE_PARSER]) {
    //         parser = deps[SUPERFACE_PARSER];
    //       }
    //     }
    //   }
    // }

    return {};
  }

  private extractYarnLock(
    yarnLock: string
  ): { sdk?: string; ast?: string; parser?: string } {
    let sdk,
      parser,
      ast = undefined;

    const json = lockfile.parse(yarnLock).object as Record<string, unknown>;

    const sdkKey = Object.keys(json).find(key => key.startsWith(SUPERFACE_SDK));
    if (sdkKey) {
      if (json[sdkKey] && typeof json[sdkKey] === 'object') {
        const content = json[sdkKey] as Record<string, unknown>;

        if (content.version && typeof content.version === 'string') {
          sdk = content.version;
        }
        if (content.dependencies && typeof content.dependencies === 'object') {
          const sdkDeps = content.dependencies as Record<string, unknown>;

          if (
            sdkDeps[SUPERFACE_AST] &&
            typeof sdkDeps[SUPERFACE_PARSER] === 'string'
          ) {
            ast = sdkDeps[SUPERFACE_PARSER] as string;
          }

          if (
            sdkDeps[SUPERFACE_PARSER] &&
            typeof sdkDeps[SUPERFACE_PARSER] === 'string'
          ) {
            parser = sdkDeps[SUPERFACE_PARSER] as string;
          }
        }
      }
    }

    return { sdk, parser, ast };
  }

  private extractPackageLock(
    packageLock: string
  ): { sdk?: string; ast?: string; parser?: string } {
    let sdk,
      parser,
      ast = undefined;

    const json = JSON.parse(packageLock) as Record<string, unknown>;
    if (json.dependencies && typeof json.dependencies === 'object') {
      const deps = json.dependencies as Record<string, unknown>;

      if (deps[SUPERFACE_SDK] && typeof deps[SUPERFACE_SDK] === 'object') {
        const content = deps[SUPERFACE_SDK] as Record<string, unknown>;

        if (content.version && typeof content.version === 'string') {
          sdk = content.version;
        }

        if (content.requires && typeof content.requires === 'object') {
          const sdkDeps = content.requires as Record<string, unknown>;
          if (
            sdkDeps[SUPERFACE_AST] &&
            typeof sdkDeps[SUPERFACE_AST] === 'string'
          ) {
            ast = sdkDeps[SUPERFACE_AST] as string;
          }
          if (
            sdkDeps[SUPERFACE_PARSER] &&
            typeof sdkDeps[SUPERFACE_PARSER] === 'string'
          ) {
            parser = sdkDeps[SUPERFACE_PARSER] as string;
          }
        }
      }
    }

    return { sdk, parser, ast };
  }
}
