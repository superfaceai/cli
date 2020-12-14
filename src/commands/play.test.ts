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
      'valid.supr.ast.json',
      'valid.noop.suma.ast.json',
      'valid.noop.js',
    ];
    await Promise.all(
      testFiles.map(file => rimraf(nodePath.join(baseFixture, 'valid', file)))
    );
  });

  it('detects a valid playground', async () => {
    expect(
      await Play.run(['clean', nodePath.join(baseFixture, 'valid')])
    ).toBeUndefined();
  });

  it('rejects an an invalid playground', async () => {
    await expect(
      Play.run(['clean', nodePath.join(baseFixture, 'invalid')])
    ).rejects.toThrow('The directory at playground path is not a playground');
  });

  it('creates a valid playground', async () => {
    stdout.start();
    await Play.run([
      'initialize',
      testPlaygroundPath,
      '--providers',
      'foo',
      'bar',
    ]);
    stdout.stop();

    await access(testPlaygroundPath);
    const expectedFiles = [
      'package.json',
      'test.supr',
      'test.foo.suma',
      'test.bar.suma',
      'test.foo.ts',
      'test.bar.ts',
    ];
    for (const file of expectedFiles) {
      await access(nodePath.join(testPlaygroundPath, file));
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
      'valid.supr.ast.json',
      'valid.noop.suma.ast.json',
      'valid.noop.js',
    ];
    await Promise.all(
      expectedFiles.map(file =>
        access(nodePath.join(baseFixture, 'valid', file))
      )
    );
  }, 30000);

  it('cleans compilation artifacts', async () => {
    const deletedFiles = [
      'package-lock.json',
      'node_modules',
      'test.supr.ast.json',
      'test.foo.suma.ast.json',
      'test.bar.suma.ast.json',
      'test.foo.js',
      'test.bar.js',
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

    await mkdir(testPlaygroundPath);

    await Promise.all(
      [...deletedFiles, ...expectedFiles].map(file =>
        OutputStream.writeOnce(nodePath.join(testPlaygroundPath, file), '')
      )
    );

    stdout.start();
    await Play.run(['clean', testPlaygroundPath]);
    stdout.stop();

    await Promise.all(
      deletedFiles.map(file =>
        expect(
          access(nodePath.join(testPlaygroundPath, file))
        ).rejects.toThrowError('ENOENT')
      )
    );

    await Promise.all(
      expectedFiles.map(file => access(nodePath.join(testPlaygroundPath, file)))
    );

    expect(stdout.output).toBe(
      `$ rimraf 'test.supr.ast.json' 'node_modules' 'package-lock.json' 'test.bar.suma.ast.json' 'test.bar.js' 'test.foo.suma.ast.json' 'test.foo.js'
`
    );
  });
});
