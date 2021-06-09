import { realpathSync } from 'fs';
import { join as joinPath } from 'path';

import { access, mkdir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { MockStd, mockStd } from '../test/mock-std';
import Play from './play';

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

  beforeAll(async () => {
    // ensure the create-test playground is deleted completely
    await rimraf(createdPlayground.path);
  });

  let stdout: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(async () => {
    jest.resetAllMocks();

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

  it('creates a valid playground', async () => {
    await expect(
      Play.run([
        'initialize',
        createdPlayground.path,
        '--providers',
        'foo',
        'bar',
      ])
    ).resolves.toBeUndefined();

    await expect(access(createdPlayground.path)).resolves.toBeUndefined();
    const expectedFiles = [
      `${createdPlayground.name}.supr`,
      `${createdPlayground.name}.foo.suma`,
      `${createdPlayground.name}.bar.suma`,
      joinPath('superface', 'super.json'),
      joinPath('superface', 'package.json'),
      joinPath('superface', 'play', `${createdPlayground.name}.play.ts`),
    ].map(f => joinPath(createdPlayground.path, f));
    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();

    expect(stdout.output).toContain(
      `$ echo '<initial super.json>' > '${expectedFiles[3]}'`
    );
    expect(stdout.output).toContain(
      `$ echo '<package.json template>' > '${expectedFiles[4]}'`
    );
    expect(stdout.output).toContain(
      `$ echo '<play.ts template>' > '${expectedFiles[5]}'`
    );
    expect(stdout.output).toContain(
      `-> Created ${expectedFiles[0]} (name = "create_test", version = "1.0.0")`
    );
    expect(stdout.output).toContain(
      `-> Created ${expectedFiles[1]} (profile = "create_test@1.0", provider = "foo")`
    );
    expect(stdout.output).toContain(
      `-> Created ${expectedFiles[2]} (profile = "create_test@1.0", provider = "bar")`
    );
  });

  it('does not log to stdout with --quiet', async () => {
    await Play.run([
      'initialize',
      createdPlayground.path,
      '--providers',
      'foo',
      'bar',
      '--quiet',
    ]);

    expect(stdout.output).toBe(
      'You are using a hidden command. This command is not intended for public consumption yet. It might be broken, hard to use or simply redundant. Tread with care.\n'
    );
  });

  it('compiles playground and executes it', async () => {
    await Play.run(['execute', fixedPlayground.path, '--providers', 'noop']);

    expect(stdout.output).toMatch(
      /PubOpeningHours\/noop result: Ok { value: \[\] }\s*$/
    );

    // check build artifacts
    const expectedFiles = [
      'pub-hours.supr.ast.json',
      'pub-hours.noop.suma.ast.json',
      joinPath('superface', 'package-lock.json'),
      joinPath('superface', 'node_modules'),
      joinPath('superface', 'build', 'pub-hours.play.js'),
    ].map(f => joinPath(fixedPlayground.path, f));
    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();
  }, 30000);

  it('creates, compiles and executes a playground on a real api', async () => {
    await expect(
      Play.run(['initialize', createdPlayground.path, '--providers', 'foo'])
    ).resolves.toBeUndefined();
    await Play.run(['execute', createdPlayground.path, '--providers', 'foo']);

    expect(stdout.output).toContain(
      `{ name: 'Pivni bar Diego', openingHours: 'Mo-Su,PH 16:30 - 23:45' }`
    );
  }, 30000);

  it('cleans compilation artifacts', async () => {
    const deletedFiles = [
      `${createdPlayground.name}.supr.ast.json`,
      `${createdPlayground.name}.foo.suma.ast.json`,
      `${createdPlayground.name}.bar.suma.ast.json`,
      joinPath('superface', 'package-lock.json'),
      joinPath('superface', 'node_modules'),
      joinPath('superface', 'build', `${createdPlayground.name}.play.js`),
    ].map(f => joinPath(createdPlayground.path, f));

    const expectedFiles = [
      `${createdPlayground.name}.supr`,
      `${createdPlayground.name}.foo.suma`,
      `${createdPlayground.name}.bar.suma`,
      joinPath('superface', 'super.json'),
      joinPath('superface', 'package.json'),
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
        OutputStream.writeOnce(
          file,
          JSON.stringify(
            {
              profiles: {
                [createdPlayground.name]: {
                  file: expectedFiles[0],
                  providers: {
                    foo: {
                      file: expectedFiles[1],
                    },
                    bar: {
                      file: expectedFiles[2],
                    },
                  },
                },
              },
            },
            undefined,
            2
          )
        )
      )
    );

    await expect(
      Play.run(['clean', createdPlayground.path])
    ).resolves.toBeUndefined();

    await Promise.all(
      deletedFiles.map(f => expect(access(f)).rejects.toThrowError('ENOENT'))
    );

    await expect(
      Promise.all(expectedFiles.map(f => access(f)))
    ).resolves.toBeDefined();

    expect(stdout.output).toContain('$ rimraf');
    deletedFiles.forEach(del => expect(stdout.output).toContain(del));
  });
});
