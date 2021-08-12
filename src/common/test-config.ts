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

// TODO: Extend TestConfig for maintainability of snapshots and recordings
export class TestConfig {
  constructor(
    readonly path: string,
    public readonly configuration: TestConfiguration,
    public readonly updateSnapshots: boolean,
    public readonly updateRecordings: boolean,
    public readonly testName?: string
  ) {}

  static async load(config: {
    path: string;
    updateSnapshots: boolean;
    updateRecordings: boolean;
    testName?: string;
  }): Promise<TestConfig> {
    const { path, updateSnapshots, updateRecordings, testName } = config;
    const filePath = joinPath(path, TEST_CONFIG);

    if (!(await isFileQuiet(filePath))) {
      throw userError('configuration is not a file', 2);
    }

    const data = await readFileQuiet(filePath);
    
    if (data === undefined) {
      throw userError('reading file failed', 2);
    }

    // TODO: implement validation
    let testConfiguration = JSON.parse(data) as TestConfiguration;

    if (testName) {
      testConfiguration = testConfiguration.filter(
        input => input.provider === testName
      );
    }

    return new TestConfig(
      path,
      testConfiguration,
      updateSnapshots,
      updateRecordings,
      testName
    );
  }
}
