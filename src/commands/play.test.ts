import * as nodePath from 'path';
import { stdout } from 'stdout-stderr';

import Play from '../commands/play';
import { access, mkdir, OutputStream, rimraf } from '../common/io';

describe('Play CLI command', () => {
  const baseFixture = nodePath.join('fixtures', 'playgrounds');
  const testPlaygroundName = 'test';
  const testPlaygroundPath = nodePath.join(baseFixture, testPlaygroundName);

  afterEach(async () => {
    await rimraf(testPlaygroundPath);

    const testFiles = [
      'package-lock.json',
      'node_modules',
      nodePath.join('build', 'valid.supr.ast.json'),
      nodePath.join('build', 'valid.noop.suma.ast.json'),
      nodePath.join('build', 'valid.noop.js'),
    ];
    await Promise.all(
      testFiles.map(file => rimraf(nodePath.join(baseFixture, 'valid', file)))
    );
  });

  it('detects a valid playground', async () => {
    await expect(
      Play.run(['clean', nodePath.join(baseFixture, 'valid')])
    ).resolves.toBeUndefined();
  });

  it('rejects an an invalid playground', async () => {
    await expect(
      Play.run(['clean', nodePath.join(baseFixture, 'invalid')])
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
      'test.supr',
      'test.foo.suma',
      'test.bar.suma',
      'test.foo.ts',
      'test.bar.ts',
      '.gitignore',
    ];
    for (const file of expectedFiles) {
      await expect(
        access(nodePath.join(testPlaygroundPath, file))
      ).resolves.toBeUndefined();
    }

    expect(stdout.output).toBe(
      `$ mkdir fixtures/playgrounds/test
$ echo '<package template>' > fixtures/playgrounds/test/package.json
$ echo '<glue template>' > fixtures/playgrounds/test/test.foo.ts
$ echo '<glue template>' > fixtures/playgrounds/test/test.bar.ts
$ echo '<profile template>' > fixtures/playgrounds/test/test.supr
$ echo '<map template>' > fixtures/playgrounds/test/test.foo.suma
$ echo '<map template>' > fixtures/playgrounds/test/test.bar.suma
$ echo '<npmrc template>' > fixtures/playgrounds/test/.npmrc
$ echo '<gitignore template>' > fixtures/playgrounds/test/.gitignore
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
      nodePath.join(baseFixture, 'valid'),
      '--providers',
      'noop',
    ]);
    stdout.stop();

    expect(stdout.output).toMatch(/pubs\/Noop result: Ok { value: \[\] }\s*$/);

    const expectedFiles = [
      'package-lock.json',
      'node_modules',
      nodePath.join('build', 'valid.supr.ast.json'),
      nodePath.join('build', 'valid.noop.suma.ast.json'),
      nodePath.join('build', 'valid.noop.js'),
    ];
    await expect(
      Promise.all(
        expectedFiles.map(file =>
          access(nodePath.join(baseFixture, 'valid', file))
        )
      )
    ).resolves.toBeDefined();
  }, 30000);

  it('cleans compilation artifacts', async () => {
    const deletedFiles = [
      'package-lock.json',
      'node_modules',
      nodePath.join('build', 'test.supr.ast.json'),
      nodePath.join('build', 'test.foo.suma.ast.json'),
      nodePath.join('build', 'test.bar.suma.ast.json'),
      nodePath.join('build', 'test.foo.js'),
      nodePath.join('build', 'test.bar.js'),
    ];
    const expectedFiles = [
      'package.json',
      'test.supr',
      'test.foo.suma',
      'test.bar.suma',
      'test.foo.ts',
      'test.bar.ts',
      'test.baz.ts',
    ];

    await mkdir(nodePath.join(testPlaygroundPath, 'build'), {
      recursive: true,
    });

    await Promise.all(
      [...deletedFiles, ...expectedFiles].map(file =>
        OutputStream.writeOnce(nodePath.join(testPlaygroundPath, file), '')
      )
    );

    stdout.start();
    await expect(
      Play.run(['clean', testPlaygroundPath])
    ).resolves.toBeUndefined();
    stdout.stop();

    await Promise.all(
      deletedFiles.map(file =>
        expect(
          access(nodePath.join(testPlaygroundPath, file))
        ).rejects.toThrowError('ENOENT')
      )
    );

    await expect(
      Promise.all(
        expectedFiles.map(file =>
          access(nodePath.join(testPlaygroundPath, file))
        )
      )
    ).resolves.toBeDefined();

    expect(stdout.output).toMatch(/^\$ rimraf /);
    expect(stdout.output).toMatch(/build\/test\.supr\.ast\.json'/);
    expect(stdout.output).toMatch(/node_modules'/);
    expect(stdout.output).toMatch(/package-lock\.json'/);
    expect(stdout.output).toMatch(/build\/test\.bar\.suma\.ast\.json'/);
    expect(stdout.output).toMatch(/build\/test\.bar\.js'/);
    expect(stdout.output).toMatch(/build\/test\.foo\.suma\.ast\.json'/);
    expect(stdout.output).toMatch(/build\/test\.foo\.js'/);
  });
});
