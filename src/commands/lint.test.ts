import * as nodePath from 'path';
import { stderr, stdout } from 'stdout-stderr';

import Lint from './lint';

describe('lint CLI command', () => {
  const fixture = {
    strictProfile: nodePath.join('fixtures', 'strict.supr'),
    strictMap: nodePath.join('fixtures', 'strict.suma'),
    invalidMap: nodePath.join('fixtures', 'invalid.suma'),
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
      path: fixture.strictMap,
      errors: [],
      warnings: [],
    });
    expect(result.reports).toContainEqual({
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
});
