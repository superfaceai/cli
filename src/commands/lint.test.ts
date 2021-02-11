import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import Lint from './lint';

describe('lint CLI command', () => {
  const fixture = {
    strictProfile: joinPath('fixtures', 'strict.supr'),
    strictMap: joinPath('fixtures', 'strict.suma'),
    invalidParsedMap: joinPath('fixtures', 'invalid.suma'),
    validMap: joinPath('fixtures', 'valid-map.provider.suma'),
    invalidMap: joinPath('fixtures', 'invalid-map.twillio.suma'),
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
      Lint.run([fixture.strictMap, fixture.invalidParsedMap])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain(`🆗 ${fixture.strictMap}\n` + '\n');
    expect(stdout.output).toContain(
      `❌ ${fixture.invalidParsedMap}\n` +
        'SyntaxError: Expected `provider` but found `map`\n' +
        ` --> ${fixture.invalidParsedMap}:3:1\n` +
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
        fixture.invalidParsedMap,
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain(`🆗 ${fixture.strictMap}\n` + '\n');
    expect(stdout.output).toContain(
      `❌ ${fixture.invalidParsedMap}\n` +
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
        fixture.invalidParsedMap,
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
      path: fixture.invalidParsedMap,
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

    expect(stdout.output).toContain('❌ fixtures/invalid-map.twillio.suma');
    expect(stdout.output).toContain('⚠️ fixtures/valid-map.provider.suma');
    expect(stdout.output).toContain(
      '5:13 PrimitiveLiteral - Wrong Structure: expected number, but got "true"'
    );
    expect(stdout.output).toContain(
      '11:15 ObjectLiteral - Wrong Structure: expected 404 or 400, but got "ObjectLiteral"'
    );
    expect(stdout.output).toContain('Detected 9 problems');
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
    expect(stdout.output).toContain('⚠️ fixtures/valid-map.provider.suma');
    expect(stdout.output).toContain('Detected 6 problems');
  });

  it('lints multiple maps with unknown and invalid files to profile', async () => {
    await expect(
      Lint.run([
        '-v',
        fixture.strictProfile,
        fixture.invalidMap,
        fixture.validMap,
        './fixtures/strict.unknown',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('❌ fixtures/invalid-map.twillio.suma');
    expect(stdout.output).toContain('⚠️ fixtures/valid-map.provider.suma');
    expect(stdout.output).toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('Detected 10 problems');
  });

  it('lints only maps that meets conditions', async () => {
    await expect(
      Lint.run([
        '-v',
        fixture.lint.profile.foo,
        fixture.lint.profile.bar,
        fixture.lint.map.foo,
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain(
      `⚠️ map ${fixture.lint.map.foo} assumed to belong to profile ${fixture.lint.profile.foo} based on file name`
    );
    expect(stdout.output).toContain(`➡️ Profile:\t${fixture.lint.profile.foo}`);
    expect(stdout.output).not.toContain(
      `➡️ Profile:\t${fixture.lint.profile.bar}`
    );
    expect(stdout.output).toContain('Detected 1 problem');
  });

  it('does not show warnings when linting with flag --quiet', async () => {
    await expect(
      Lint.run([
        '-v',
        '-q',
        fixture.strictProfile,
        fixture.validMap,
        './fixtures/strict.unknown',
        './fixtures/some.unknown',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 2);

    expect(stdout.output).toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('⚠️ ./fixtures/some.unknown');
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

    expect(stdout.output).toContain('⚠️ ./fixtures/strict.unknown');
    expect(stdout.output).toContain('⚠️ fixtures/valid-map.provider.suma');
    expect(stdout.output).toContain('❌ fixtures/invalid-map.twillio.suma');
    expect(stdout.output).toContain('Detected 5 problems');
  });
});
