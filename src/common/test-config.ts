import { userError } from './error';
import {
  isFileQuiet,
  isFileQuietSync,
  readFileQuiet,
  readFileQuietSync,
} from './io';

export interface TestingCase {
  usecase: string;
  input: unknown;
  result: unknown;
  isError: boolean;
}

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
  mockedRequests?: MockedHttpRequests[];
  // mockedResponses?: MockedHttpResponse[];
}

export type TestConfiguration = TestingInput[];

export class TestConfig {
  public configuration: TestConfiguration;
  public readonly path: string;

  constructor(configuration: TestConfiguration, path?: string) {
    this.configuration = configuration;
    this.path = path ?? '';
  }

  static loadSync(path: string, testName?: string): TestConfig {
    if (!isFileQuietSync(path)) {
      throw userError('configuration is not a file', 2);
    }

    const data = readFileQuietSync(path);

    if (data === undefined) {
      throw userError('reading file failed', 2);
    }

    const config = JSON.parse(data) as TestConfiguration;

    return new TestConfig(
      testName ? config.filter(input => input.provider === testName) : config,
      path
    );
  }

  static async load(path: string): Promise<TestConfig> {
    if (!(await isFileQuiet(path))) {
      throw userError('configuration is not a file', 2);
    }

    const data = await readFileQuiet(path);

    if (data === undefined) {
      throw userError('reading file failed', 2);
    }

    return new TestConfig(
      JSON.parse(data) as TestConfiguration,
      path
    );
  }
}
