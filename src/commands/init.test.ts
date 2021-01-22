import { join as joinPath } from 'path';
import { stdout } from 'stdout-stderr';

import { access, rimraf } from '../common/io';
import Init from './init';

describe('Init CLI command', () => {
  const baseFixture = joinPath('fixtures', 'playgrounds');
  const testInitFolder = 'test';
  const testInitFolderPath = joinPath(baseFixture, testInitFolder);

  afterEach(async () => {
    await rimraf(testInitFolderPath);
  });

  it('initialize base folder', async () => {
    stdout.start();
    await expect(Init.run([testInitFolderPath])).resolves.toBeUndefined();
    stdout.stop();

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
      `$ mkdir '${testInitFolderPath}'
$ echo '<.npmrc template>' > '${testInitFolderPath}/.npmrc'
$ mkdir '${testInitFolderPath}/superface'
$ echo '<super.json template>' > '${testInitFolderPath}/superface/super.json'
$ echo '<gitignore template>' > '${testInitFolderPath}/superface/.gitignore'
$ mkdir '${testInitFolderPath}/superface/grid'
$ mkdir '${testInitFolderPath}/superface/types'
$ mkdir '${testInitFolderPath}/superface/build'
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
  });

  it('initialize base folder with quiet mode', async () => {
    stdout.start();
    await expect(Init.run([testInitFolderPath, '-q'])).resolves.toBeUndefined();
    stdout.stop();

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
  });
});
