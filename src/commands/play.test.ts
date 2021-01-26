import { realpathSync } from 'fs';
import { join as joinPath } from 'path';
import { stdout } from 'stdout-stderr';

import Play from '../commands/play';
import { access, mkdir, OutputStream, rimraf } from '../common/io';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toIncludeStrings(...strings: string[]): R;
    }
  }
}
expect.extend({
  toIncludeStrings(base: string, ...strings: string[]) {
    let pass = true;
    let message = 'Expected to contain all given strings';

    for (const string of strings) {
      if (!base.includes(string)) {
        pass = false;
        message =
          this.utils.matcherHint('toIncludeStrings', undefined, undefined, {
            isNot: this.isNot,
            promise: this.promise,
          }) +
          '\n' +
          `Expected: ${this.utils.printExpected(string)}\n` +
          `Received: ${this.utils.printReceived(base)}\n`;

        break;
      }
    }

    return {
      pass,
      message: () => message,
    };
  },
});

describe('Play CLI command', () => {
  const baseFixtures = realpathSync(joinPath('fixtures', 'playgrounds'));

  const invalidPlayground = {
    name: 'invalid',
    path: joinPath(baseFixtures, 'invalid'),
  };
  const createdPlayground = {
    name: 'create_test',
    usecaseName: 'CreateTest',
    path: joinPath(baseFixtures, 'create_test'),
  };
  const fixedPlayground = {
    name: 'pub-hours',
    path: joinPath(baseFixtures, 'pub-hours'),
  };

  afterEach(async () => {
    // delete the create-test playground
    await rimraf(createdPlayground.path);

    // delete the build artifacts in fixture playground
    const testFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', 'pub-hours.supr.ast.json'),
      joinPath('build', 'pub-hours.noop.suma.ast.json'),
      joinPath('build', 'pub-hours.play.js'),
    ].map(f => joinPath(fixedPlayground.path, 'superface', f));
    await Promise.all(testFiles.map(f => rimraf(f)));
  });

  it('detects a valid playground', async () => {
    await expect(
      Play.run(['clean', fixedPlayground.path])
    ).resolves.toBeUndefined();
  });

  it('rejects an an invalid playground', async () => {
    await expect(Play.run(['clean', invalidPlayground.path])).rejects.toThrow(
      'The directory at playground path is not a playground'
    );
  });

  it.skip('creates a valid playground', async () => {
    stdout.start();
    await expect(
      Play.run([
        'initialize',
        createdPlayground.path,
        '--providers',
        'foo',
        'bar',
      ])
    ).resolves.toBeUndefined();
    stdout.stop();

    await expect(access(createdPlayground.path)).resolves.toBeUndefined();
    const expectedFiles = [
      `${createdPlayground.name}.supr`,
      `${createdPlayground.name}.foo.suma`,
      `${createdPlayground.name}.bar.suma`,
      joinPath('superface', 'super.json'),
      joinPath('superface', '.gitignore'),
      joinPath('superface', 'package.json'),
      joinPath('superface', 'play', `${createdPlayground.name}.play.ts`),
    ].map(f => joinPath(createdPlayground.path, f));
    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();

    expect(stdout.output).toIncludeStrings(
      `$ mkdir '${createdPlayground.path}'`,
      `$ echo '<.npmrc template>' > '${createdPlayground.path}/.npmrc'`,
      `$ echo '<super.json template>' > '${expectedFiles[3]}'`,
      `$ echo '<.gitignore template>' > '${expectedFiles[4]}'`,
      `$ echo '<package.json template>' > '${expectedFiles[5]}'`,
      `$ echo '<play.ts template>' > '${expectedFiles[6]}'`,
      `-> Created ${expectedFiles[0]} (name = "create_test", version = "1.0.0")`,
      `-> Created ${expectedFiles[1]} (profile = "create_test@1.0", provider = "foo")`,
      `-> Created ${expectedFiles[2]} (profile = "create_test@1.0", provider = "bar")`
    );
  });

  it('does not log to stdout with --quiet', async () => {
    stdout.start();
    await Play.run([
      'initialize',
      createdPlayground.path,
      '--providers',
      'foo',
      'bar',
      '--quiet',
    ]);
    stdout.stop();

    expect(stdout.output).toBe('');
  });

  // TODO: Currently skipping this in CI because of access permission issues
  it.skip('compiles playground and executes it', async () => {
    stdout.start();
    await Play.run(['execute', fixedPlayground.path, '--providers', 'noop']);
    stdout.stop();

    expect(stdout.output).toMatch(
      /PubOpeningHours\/noop result: Ok { value: \[\] }\s*$/
    );

    // check build artifacts
    const expectedFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', 'pub-hours.supr.ast.json'),
      joinPath('build', 'pub-hours.noop.suma.ast.json'),
      joinPath('build', 'pub-hours.play.js'),
    ].map(f => joinPath(fixedPlayground.path, 'superface', f));
    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();
  }, 30000);

  it.skip('creates, compiles and executes a playground on a real api', async () => {
    stdout.start();
    await expect(
      Play.run(['initialize', createdPlayground.path, '--providers', 'foo'])
    ).resolves.toBeUndefined();
    await Play.run(['execute', createdPlayground.path, '--providers', 'foo']);
    stdout.stop();

    expect(stdout.output).toIncludeStrings(
      `${createdPlayground.usecaseName}/foo result: Ok {`,
      `{ name: 'Pivni bar Diego', openingHours: 'Mo-Su,PH 16:30 - 23:45' }`
    );
  }, 30000);

  it('cleans compilation artifacts', async () => {
    const deletedFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', `${createdPlayground.name}.supr.ast.json`),
      joinPath('build', `${createdPlayground.name}.foo.suma.ast.json`),
      joinPath('build', `${createdPlayground.name}.bar.suma.ast.json`),
      joinPath('build', `${createdPlayground.name}.play.js`),
    ].map(f => joinPath(createdPlayground.path, 'superface', f));

    const expectedFiles = [
      `${createdPlayground.name}.supr`,
      `${createdPlayground.name}.foo.suma`,
      `${createdPlayground.name}.bar.suma`,
      joinPath('superface', 'package.json'),
      joinPath('superface', '.gitignore'),
      joinPath('superface', 'play', `${createdPlayground.name}.play.ts`),
    ].map(f => joinPath(createdPlayground.path, f));

    await mkdir(joinPath(createdPlayground.path, 'superface', 'build'), {
      recursive: true,
    });
    await mkdir(joinPath(createdPlayground.path, 'superface', 'play'), {
      recursive: true,
    });
    await Promise.all(
      [...deletedFiles, ...expectedFiles].map(file =>
        OutputStream.writeOnce(file, '')
      )
    );

    stdout.start();
    await expect(
      Play.run(['clean', createdPlayground.path])
    ).resolves.toBeUndefined();
    stdout.stop();

    await Promise.all(
      deletedFiles.map(f => expect(access(f)).rejects.toThrowError('ENOENT'))
    );

    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();
    expect(stdout.output).toIncludeStrings('$ rimraf', ...deletedFiles);
  });
});
