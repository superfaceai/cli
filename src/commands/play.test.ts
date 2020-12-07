import * as nodePath from 'path';
import { stdout } from 'stdout-stderr';

import Play from '../commands/play';
import {
  accessPromise,
  mkdirPromise,
  OutputStream,
  rimrafPromise,
} from '../common/io';

describe('Play CLI command', () => {
  const baseFixture = nodePath.join('fixtures', 'playgrounds');
  const testPlaygroundName = 'test';
  const testPlaygroundPath = nodePath.join(baseFixture, testPlaygroundName);

  afterEach(async () => {
    await rimrafPromise(testPlaygroundPath);

    const testFiles = [
      'package-lock.json',
      'node_modules',
      'valid.supr.ast.json',
      'valid.noop.suma.ast.json',
      'valid.noop.js',
    ];
    await Promise.all(
      testFiles.map(file =>
        rimrafPromise(nodePath.join(baseFixture, 'valid', file))
      )
    );
  });

  it('a valid playground is detected', async () => {
    expect(
      await Play.run(['clean', nodePath.join(baseFixture, 'valid')])
    ).toBeUndefined();
  });

  it('an invalid playground is rejected', async () => {
    await expect(
      Play.run(['clean', nodePath.join(baseFixture, 'invalid')])
    ).rejects.toThrow('The directory at playground path is not a playground');
  });

  it('initialize creates a valid playground', async () => {
    await Play.run([
      'initialize',
      testPlaygroundPath,
      '--providers',
      'foo',
      'bar',
    ]);

    await accessPromise(testPlaygroundPath);

    const expectedFiles = [
      'package.json',
      'test.supr',
      'test.foo.suma',
      'test.bar.suma',
      'test.foo.ts',
      'test.bar.ts',
    ];
    for (const file of expectedFiles) {
      await accessPromise(nodePath.join(testPlaygroundPath, file));
    }

    // No exceptions thrown
    expect(undefined).toBeUndefined();
  });

  // TODO: Currently skipping this in CI because of access permission issues
  it.skip('execute compiles playground and executes it', async () => {
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
        accessPromise(nodePath.join(baseFixture, 'valid', file))
      )
    );
  }, 30000);

  it('clean cleans compilation artifacts', async () => {
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

    await mkdirPromise(testPlaygroundPath);

    await Promise.all(
      [...deletedFiles, ...expectedFiles].map(file =>
        OutputStream.writeOnce(nodePath.join(testPlaygroundPath, file), '')
      )
    );

    await Play.run(['clean', testPlaygroundPath]);

    await Promise.all(
      deletedFiles.map(file =>
        expect(
          accessPromise(nodePath.join(testPlaygroundPath, file))
        ).rejects.toThrowError('ENOENT')
      )
    );

    await Promise.all(
      expectedFiles.map(file =>
        accessPromise(nodePath.join(testPlaygroundPath, file))
      )
    );
  });
});
