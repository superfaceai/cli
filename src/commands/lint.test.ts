import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import Lint from './lint';

describe('lint CLI command', () => {
  const fixture = {
    strictProfile: joinPath('fixtures', 'strict.supr'),
    strictMap: joinPath('fixtures', 'strict.suma'),
    invalidMap: joinPath('fixtures', 'invalid.suma'),
    validMap: joinPath('fixtures', 'valid.suma')
  };

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();
  });

  it('lints one profile and one map file with autodetect', async () => {
    await Lint.run([fixture.strictMap, fixture.strictProfile]);

    expect(stdout.output).toContain(`🆗 ${fixture.strictMap}\n` + '\n');
    expect(stdout.output).toContain(`🆗 ${fixture.strictProfile}\n` + '\n');
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('lints a valid and an invalid map', async () => {
    await expect(
      Lint.run([fixture.strictMap, fixture.invalidMap])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain(`🆗 ${fixture.strictMap}\n` + '\n');
    expect(stdout.output).toContain(
      `❌ ${fixture.invalidMap}\n` +
        'SyntaxError: Expected `provider` but found `map`\n' +
        ` --> ${fixture.invalidMap}:3:1\n` +
        '2 | \n' +
        '3 | map Foo {\n' +
        '  | ^^^      \n' +
        '4 | 	\n'
    );
    expect(stdout.output).toContain('Detected 1 problem\n');
  });

  it('lints a valid and an invalid map - short format', async () => {
    await expect(
      Lint.run([
        '--outputFormat',
        'short',
        fixture.strictMap,
        fixture.invalidMap,
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain(`🆗 ${fixture.strictMap}\n` + '\n');
    expect(stdout.output).toContain(
      `❌ ${fixture.invalidMap}\n` +
        '\t3:1 Expected `provider` but found `map`\n'
    );
    expect(stdout.output).toContain('Detected 1 problem\n');
  });

  it('lints a valid and an invalid map - json format', async () => {
    await expect(
      Lint.run([
        '--outputFormat',
        'json',
        fixture.strictMap,
        fixture.invalidMap,
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: Record<string, unknown> = JSON.parse(stdout.output);
    expect(result).toMatchObject({
      total: {
        errors: 1,
        warnings: 0,
      },
    });
    expect(result.reports).toBeDefined();

    expect(result.reports).toContainEqual({
      kind: 'file',
      path: fixture.strictMap,
      errors: [],
      warnings: [],
    });
    expect(result.reports).toContainEqual({
      kind: 'file',
      path: fixture.invalidMap,
      errors: [
        {
          category: 1,
          detail: 'Expected `provider` but found `map`',
          location: {
            line: 3,
            column: 1,
          },
          span: {
            start: 31,
            end: 34,
          },
        },
      ],
      warnings: [],
    });
  });

  it('lints a valid file and outputs it to stderr', async () => {
    await Lint.run(['--output', '-2', fixture.strictProfile]);

    expect(stderr.output).toContain(`🆗 ${fixture.strictProfile}\n` + '\n');
    expect(stderr.output).toContain('Detected 0 problems\n');
  });

  it('lints multiple maps to specific profile', async () => {
    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.validMap,
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('❌ ./fixtures/testMap.suma');
    expect(stdout.output).toContain('🆗 ./fixtures/testMapValid.suma');
    expect(stdout.output).toContain(
      '8:1 ProfileId - Wrong Profile ID: expected https://example.com/profile/myProfile, but got http://example.com/profile'
    );
    expect(stdout.output).toContain(
      '20:19 InlineCall - Operation not found: Op'
    );
    expect(stdout.output).toContain(
      '90:14 ObjectLiteral - Wrong Structure: expected 404 or 400, but got "ObjectLiteral"'
    );
    expect(stdout.output).toContain('Detected 12 problems');
  });

  it('fails when linting multiple maps to multiple profiles', async () => {
    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.strictProfile,
      ])
    ).rejects.toThrowError('Cannot validate with multiple profiles');

    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.strictProfile,
        './fixtures/strict.unknown',
      ])
    ).rejects.toThrowError('Cannot validate with multiple profiles');
  });

  it('lints multiple maps with unknown files to profile', async () => {
    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.validMap,
        './fixtures/strict.unknown',
        './fixtures/some.unknown',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 2);

    expect(stdout.output).toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('⚠️ ./fixtures/some.unknown');
    expect(stdout.output).toContain('🆗 ./fixtures/testMapValid.suma');
    expect(stdout.output).toContain('Detected 2 problems');

    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.validMap,
        './fixtures/strict.unknown',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('❌ ./fixtures/testMap.suma');
    expect(stdout.output).toContain('🆗 ./fixtures/testMapValid.suma');
    expect(stdout.output).toContain('Detected 13 problems');
  });

  it('does not show warnings when linting with flag --quiet', async () => {
    await Lint.run([
      '-v',
      '-q',
      fixture.strictProfile,
      fixture.validMap,
      './fixtures/strict.unknown',
      './fixtures/some.unknown',
    ]);

    expect(stdout.output).not.toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).not.toContain('⚠️ ./fixtures/some.unknown');
    expect(stdout.output).toContain('🆗 ./fixtures/testMapValid.suma');
    expect(stdout.output).toContain('Detected 0 problems');

    await expect(
      Lint.run([
        '-v',
        '-q',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.validMap,
        './fixtures/strict.unknown',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).not.toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('❌ ./fixtures/testMap.suma');
    expect(stdout.output).toContain('🆗 ./fixtures/testMapValid.suma');
    expect(stdout.output).toContain('Detected 8 problems');
  });
});
