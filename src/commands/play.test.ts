import { join as joinPath } from 'path';
import { stdout } from 'stdout-stderr';

import Play from '../commands/play';
import { access, mkdir, OutputStream, rimraf } from '../common/io';

describe('Play CLI command', () => {
  const baseFixture = joinPath('fixtures', 'playgrounds');
  const testPlaygroundName = 'create_test';
  const testPlaygroundPath = joinPath(baseFixture, testPlaygroundName);

  afterEach(async () => {
    await rimraf(testPlaygroundPath);

    const testFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', 'pub-hours.supr.ast.json'),
      joinPath('build', 'pub-hours.noop.suma.ast.json'),
      joinPath('build', 'pub-hours.play.js'),
    ];
    await Promise.all(
      testFiles.map(file => rimraf(joinPath(baseFixture, 'pub-hours', file)))
    );
  });

  it('detects a valid playground', async () => {
    await expect(
      Play.run(['clean', joinPath(baseFixture, 'pub-hours')])
    ).resolves.toBeUndefined();
  });

  it('rejects an an invalid playground', async () => {
    await expect(
      Play.run(['clean', joinPath(baseFixture, 'invalid')])
    ).rejects.toThrow('The directory at playground path is not a playground');
  });

  it('creates a valid playground', async () => {
    stdout.start();
    await expect(
      Play.run(['initialize', testPlaygroundPath, '--providers', 'foo', 'bar'])
    ).resolves.toBeUndefined();
    stdout.stop();

    await expect(access(testPlaygroundPath)).resolves.toBeUndefined();
    const expectedFiles = [
      'package.json',
      `${testPlaygroundName}.supr`,
      `${testPlaygroundName}.foo.suma`,
      `${testPlaygroundName}.bar.suma`,
      `${testPlaygroundName}.play.ts`,
      '.gitignore',
    ];
    for (const file of expectedFiles) {
      await expect(
        access(joinPath(testPlaygroundPath, file))
      ).resolves.toBeUndefined();
    }

    expect(stdout.output).toBe(
      `$ mkdir fixtures/playgrounds/${testPlaygroundName}
$ echo '<package template>' > fixtures/playgrounds/${testPlaygroundName}/package.json
$ echo '<script template>' > fixtures/playgrounds/${testPlaygroundName}/${testPlaygroundName}.play.ts
$ echo '<profile template>' > fixtures/playgrounds/${testPlaygroundName}/${testPlaygroundName}.supr
$ echo '<map template>' > fixtures/playgrounds/${testPlaygroundName}/${testPlaygroundName}.foo.suma
$ echo '<map template>' > fixtures/playgrounds/${testPlaygroundName}/${testPlaygroundName}.bar.suma
$ echo '<npmrc template>' > fixtures/playgrounds/${testPlaygroundName}/.npmrc
$ echo '<gitignore template>' > fixtures/playgrounds/${testPlaygroundName}/.gitignore
`
    );
  });

  it('does not log to stdout with --quiet', async () => {
    stdout.start();
    await Play.run([
      'initialize',
      testPlaygroundPath,
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
    await Play.run([
      'execute',
      joinPath(baseFixture, 'pub-hours'),
      '--providers',
      'noop',
    ]);
    stdout.stop();

    expect(stdout.output).toMatch(
      /PubOpeningHours\/noop result: Ok { value: \[\] }\s*$/
    );

    const expectedFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', 'pub-hours.supr.ast.json'),
      joinPath('build', 'pub-hours.noop.suma.ast.json'),
      joinPath('build', 'pub-hours.play.js'),
    ];
    await expect(
      Promise.all(
        expectedFiles.map(file =>
          access(joinPath(baseFixture, 'pub-hours', file))
        )
      )
    ).resolves.toBeDefined();
  }, 30000);

  it('cleans compilation artifacts', async () => {
    const deletedFiles = [
      'package-lock.json',
      'node_modules',
      joinPath('build', `${testPlaygroundName}.supr.ast.json`),
      joinPath('build', `${testPlaygroundName}.foo.suma.ast.json`),
      joinPath('build', `${testPlaygroundName}.bar.suma.ast.json`),
      joinPath('build', `${testPlaygroundName}.play.js`),
    ];
    const expectedFiles = [
      'package.json',
      `${testPlaygroundName}.supr`,
      `${testPlaygroundName}.foo.suma`,
      `${testPlaygroundName}.bar.suma`,
      `${testPlaygroundName}.play.ts`,
      '.gitignore',
    ];

    await mkdir(joinPath(testPlaygroundPath, 'build'), {
      recursive: true,
    });

    await Promise.all(
      [...deletedFiles, ...expectedFiles].map(file =>
        OutputStream.writeOnce(joinPath(testPlaygroundPath, file), '')
      )
    );

    stdout.start();
    await expect(
      Play.run(['clean', testPlaygroundPath])
    ).resolves.toBeUndefined();
    stdout.stop();

    await Promise.all(
      deletedFiles.map(file =>
        expect(access(joinPath(testPlaygroundPath, file))).rejects.toThrowError(
          'ENOENT'
        )
      )
    );

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testPlaygroundPath, file)))
      )
    ).resolves.toBeDefined();

    expect(stdout.output).toMatch(/^\$ rimraf /);
    expect(stdout.output).toMatch(/node_modules'/);
    expect(stdout.output).toMatch(/package-lock\.json'/);
    expect(stdout.output).toMatch(/build\/create_test\.supr\.ast\.json'/);
    expect(stdout.output).toMatch(/build\/create_test\.bar\.suma\.ast\.json'/);
    expect(stdout.output).toMatch(/build\/create_test\.play\.js'/);
    expect(stdout.output).toMatch(/build\/create_test\.foo\.suma\.ast\.json'/);
  });
});
