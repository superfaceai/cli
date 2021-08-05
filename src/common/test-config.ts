import { join as joinPath } from 'path';

import { TEST_CONFIG } from './document';
import { userError } from './error';
import { isFileQuiet, readFileQuiet } from './io';

export interface TestingCase {
  useCase: string;
  input: unknown;
  result?: unknown;
  isError: boolean;
}

// TODO: refactor to match recorded requests?
export interface MockedHttpRequests {
  method: 'GET' | 'POST';
  url: string;
  status: number;
  body: Record<string, unknown>;
}

export interface TestingInput {
  profileId: string;
  provider: string;
  data: TestingCase[];
  // mockedRequests?: MockedHttpRequests[];
  // mockedResponses?: MockedHttpResponse[];
}

export type TestConfiguration = TestingInput[];

export class TestConfig {
  constructor(public configuration: TestConfiguration, readonly path: string) {}

  static async load(path: string, testName?: string): Promise<TestConfig> {
    const filePath = joinPath(path, TEST_CONFIG);

    if (!(await isFileQuiet(filePath))) {
      throw userError('configuration is not a file', 2);
    }

    const data = await readFileQuiet(filePath);

    if (data === undefined) {
      throw userError('reading file failed', 2);
    }

    const config = JSON.parse(data) as TestConfiguration;

    return new TestConfig(
      testName ? config.filter(input => input.provider === testName) : config,
      path
    );
  }
}
