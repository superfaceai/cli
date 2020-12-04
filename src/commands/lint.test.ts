import { stderr, stdout } from 'stdout-stderr';

import Lint from './lint';

describe('lint CLI command', () => {
  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();
  });

  it('lints one profile and one map file with autodetect', async () => {
    await Lint.run(['./fixtures/strict.suma', './fixtures/strict.supr']);

    expect(stdout.output).toContain('🆗 ./fixtures/strict.suma\n' + '\n');
    expect(stdout.output).toContain('🆗 ./fixtures/strict.supr\n' + '\n');
    expect(stdout.output).toContain('Detected 0 problems\n');
  });

  it('lints a valid and an invalid map', async () => {
    await expect(
      Lint.run(['./fixtures/strict.suma', './fixtures/invalid.suma'])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('🆗 ./fixtures/strict.suma\n' + '\n');
    expect(stdout.output).toContain(
      '❌ ./fixtures/invalid.suma\n' +
        'SyntaxError: Expected `provider` but found `map`\n' +
        ' --> ./fixtures/invalid.suma:3:1\n' +
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
        './fixtures/strict.suma',
        './fixtures/invalid.suma',
      ])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('🆗 ./fixtures/strict.suma\n' + '\n');
    expect(stdout.output).toContain(
      '❌ ./fixtures/invalid.suma\n' +
        '\t3:1 Expected `provider` but found `map`\n'
    );
    expect(stdout.output).toContain('Detected 1 problem\n');
  });

  it('lints a valid and an invalid map - json format', async () => {
    await expect(
      Lint.run([
        '--outputFormat',
        'json',
        './fixtures/strict.suma',
        './fixtures/invalid.suma',
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
      path: './fixtures/strict.suma',
      kind: 'file',
      errors: [],
      warnings: [],
    });
    expect(result.reports).toContainEqual({
      path: './fixtures/invalid.suma',
      kind: 'file',
      errors: [
        {
          category: 1,
          detail: 'Expected `provider` but found `map`',
          location: {
            line: 3,
            column: 1,
          },
          span: {
            start: 40,
            end: 43,
          },
        },
      ],
      warnings: [],
    });
  });

  it('lints a valid file and outputs it to stderr', async () => {
    await Lint.run(['--output', '-2', './fixtures/strict.supr']);

    expect(stderr.output).toContain('🆗 ./fixtures/strict.supr\n' + '\n');
    expect(stderr.output).toContain('Detected 0 problems\n');
  });

  it('lints multiple maps to specific profile', async () => {
    await expect(
      Lint.run(['-v', './fixtures/testProfile.supr', './fixtures/testMap.suma'])
    ).rejects.toHaveProperty(['oclif', 'exit'], 1);

    expect(stdout.output).toContain('❌ ./fixtures/testMap.suma');
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
});
