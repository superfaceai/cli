import { join as joinPath } from 'path';
import { stdout } from 'stdout-stderr';

import { access, rimraf } from '../common/io';
import Init from './init';

describe('Init CLI command', () => {
  const baseFixture = joinPath('fixtures', 'playgrounds');
  const testInitFolder = 'test';
  const testInitFolderPath = joinPath(baseFixture, testInitFolder);

  beforeEach(() => {
    stdout.start();
  });

  afterEach(async () => {
    stdout.stop();
    await rimraf(testInitFolderPath);
  });

  it('initialize base folder', async () => {
    await expect(Init.run([testInitFolderPath])).resolves.toBeUndefined();

    const expectedFiles = [
      '.npmrc',
      joinPath('superface', '.gitignore'),
      joinPath('superface', 'super.json'),
    ];

    const expectedDirectories = [
      'superface',
      joinPath('superface', 'build'),
      joinPath('superface', 'types'),
      joinPath('superface', 'grid'),
    ];

    expect(stdout.output).toBe(
      `$ mkdir 'fixtures/playgrounds/test'
$ echo '<.npmrc template>' > 'fixtures/playgrounds/test/.npmrc'
$ mkdir 'fixtures/playgrounds/test/superface'
$ echo '<super.json template>' > 'fixtures/playgrounds/test/superface/super.json'
$ echo '<gitignore template>' > 'fixtures/playgrounds/test/superface/.gitignore'
$ mkdir 'fixtures/playgrounds/test/superface/grid'
$ mkdir 'fixtures/playgrounds/test/superface/types'
$ mkdir 'fixtures/playgrounds/test/superface/build'
`
    );

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testInitFolderPath, file)))
      )
    ).resolves.toBeDefined();

    await expect(
      Promise.all(
        expectedDirectories.map(dir =>
          access(joinPath(testInitFolderPath, dir))
        )
      )
    ).resolves.toBeDefined();
  }, 20000);

  it('initialize base folder with quiet mode', async () => {
    await expect(Init.run([testInitFolderPath, '-q'])).resolves.toBeUndefined();

    const expectedFiles = [
      '.npmrc',
      joinPath('superface', '.gitignore'),
      joinPath('superface', 'super.json'),
    ];

    const expectedDirectories = [
      'superface',
      joinPath('superface', 'build'),
      joinPath('superface', 'types'),
      joinPath('superface', 'grid'),
    ];

    expect(stdout.output).toBe('');

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testInitFolderPath, file)))
      )
    ).resolves.toBeDefined();

    await expect(
      Promise.all(
        expectedDirectories.map(dir =>
          access(joinPath(testInitFolderPath, dir))
        )
      )
    ).resolves.toBeDefined();
  }, 20000);
});
