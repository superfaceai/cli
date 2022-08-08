import { join as joinPath, resolve } from 'path';

import { mkdir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { LintResult } from '../logic/lint';
import { MockStd, mockStd } from '../test/mock-std';
import { execCLI, setUpTempDir } from '../test/utils';

describe('lint CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');

  const profileId = 'starwars/character-information';
  const provider = 'swapi';
  const secondProvider = 'starwars';
  const fixture = {
    strictProfile: joinPath('fixtures', 'strict.supr'),
    strictMap: joinPath('fixtures', 'strict.suma'),
    invalidParsedMap: joinPath('fixtures', 'invalid.suma'),
    validMap: joinPath('fixtures', 'valid-map.provider.suma'),
    invalidMap: joinPath('fixtures', 'invalid-map.twilio.suma'),
    lint: {
      profile: {
        foo: joinPath('fixtures', 'lint', 'foo.supr'),
        bar: joinPath('fixtures', 'lint', 'bar.supr'),
      },
      map: {
        foo: joinPath('fixtures', 'lint', 'foo.provider.suma'),
        bar: joinPath('fixtures', 'lint', 'bar.provider.suma'),
      },
    },
  };

  const mockSuperJson = {
    profiles: {
      [profileId]: {
        file: `../../../../${fixture.strictProfile}`,
        providers: {
          [provider]: {
            file: `../../../../${fixture.validMap}`,
          },
          [secondProvider]: {
            file: `../../../../${fixture.invalidParsedMap}`,
          },
        },
      },
    },
  };
  let tempDir: string;

  let stderr: MockStd;
  let stdout: MockStd;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
  });

  beforeEach(async () => {
    stdout = mockStd();
    stderr = mockStd();

    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await rimraf(tempDir);
  });

  it('lints one profile and one map file', async () => {
    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    const result = await execCLI(
      tempDir,
      ['lint', '--profileId', profileId, '--providerName', provider],
      ''
    );

    expect(result.stdout).toContain(
      `🆗 Parsing profile file: ${resolve(fixture.strictProfile)}`
    );
    expect(result.stdout).toContain(
      `🆗 Parsing map file: ${resolve(fixture.validMap)}`
    );

    expect(result.stdout).toContain('Detected 0 problems');
  });

  it('lints a valid and an invalid map', async () => {
    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );
    await expect(
      execCLI(
        tempDir,
        ['lint', '--profileId', profileId],
        '',
        //Expose child process stdout to mocked stdout
        { debug: true }
      )
    ).rejects.toContain('Errors were found');

    expect(stdout.output).toContain(
      `🆗 Parsing profile file: ${resolve(fixture.strictProfile)}`
    );
    expect(stdout.output).toContain(
      `🆗 Parsing map file: ${resolve(fixture.validMap)}`
    );

    expect(stdout.output).toContain(
      `Parsing map file: ${resolve(fixture.invalidParsedMap)}\n` +
        'SyntaxError: Expected `provider` but found `map`\n' +
        ` --> ${resolve(fixture.invalidParsedMap)}:3:1\n` +
        '2 | \n' +
        '3 | map Foo {\n' +
        '  | ^^^      \n' +
        '4 | 	\n'
    );
    expect(stdout.output).toContain('Detected 1 problem\n');
  });

  it('lints a valid and an invalid map - short format', async () => {
    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    await expect(
      execCLI(
        tempDir,
        ['lint', '--profileId', profileId, '--outputFormat', 'short'],
        '',
        //Expose child process stdout to mocked stdout
        { debug: true }
      )
    ).rejects.toContain('Errors were found');

    expect(stdout.output).toContain(
      `🆗 Parsing profile file: ${resolve(fixture.strictProfile)}`
    );
    expect(stdout.output).toContain(
      `🆗 Parsing map file: ${resolve(fixture.validMap)}`
    );

    expect(stdout.output).toContain(
      `Parsing map file: ${resolve(fixture.invalidParsedMap)}\n` +
        '\t3:1 Expected `provider` but found `map`\n'
    );
    expect(stdout.output).toContain('Detected 1 problem\n');
  });

  it('lints a valid and an invalid map - json format', async () => {
    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    await expect(
      execCLI(
        tempDir,
        ['lint', '--profileId', profileId, '--outputFormat', 'json', '--quiet'],
        '',
        // Expose child process stdout to mocked stdout
        { debug: true }
      )
    ).rejects.toContain('Errors were found');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: LintResult = JSON.parse(stdout.output);
    expect(result).toMatchObject({
      total: {
        errors: 1,
        warnings: 0,
      },
    });
    expect(result.reports).toBeDefined();

    expect(result.reports).toContainEqual({
      kind: 'file',
      path: `${resolve(fixture.strictProfile)}`,
      errors: [],
      warnings: [],
    });
    expect(result.reports).toContainEqual({
      kind: 'file',
      path: `${resolve(fixture.invalidParsedMap)}`,
      errors: [
        {
          category: 'Parser',
          detail: 'Expected `provider` but found `map`',
          hints: [],
          location: {
            end: {
              charIndex: 34,
              line: 3,
              column: 4,
            },
            start: {
              line: 3,
              column: 1,
              charIndex: 31,
            },
          },
        },
      ],
      warnings: [],
    });
  });

  it('lints a valid file and outputs it to stderr', async () => {
    const mockSuperJson = {
      profiles: {
        [profileId]: {
          file: `../../../../${fixture.strictProfile}`,
          providers: {
            [provider]: {
              file: `../../../../${fixture.validMap}`,
            },
          },
        },
      },
    };

    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    await expect(
      execCLI(
        tempDir,
        ['lint', '--profileId', profileId, '--output', '-2'],
        '',
        //Expose child process stdout to mocked stdout
        { debug: true }
      )
    ).rejects.toContain(
      `🆗 Parsing profile file: ${resolve(fixture.strictProfile)}`
    );
  });

  it('does not show warnings when linting with flag --quiet', async () => {
    await mkdir(joinPath(tempDir, 'superface'));
    await OutputStream.writeOnce(
      joinPath(tempDir, 'superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    const result = await execCLI(
      tempDir,
      ['lint', '--profileId', profileId, '--providerName', provider],
      ''
    );

    expect(result.stdout).toContain(
      `🆗 Parsing profile file: ${resolve(fixture.strictProfile)}`
    );
    expect(result.stdout).toContain(
      `🆗 Parsing map file: ${resolve(fixture.validMap)}`
    );

    expect(result.stdout).toContain('Detected 0 problems\n');
  });
});
