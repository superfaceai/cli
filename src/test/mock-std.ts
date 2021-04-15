import stripAnsi from 'strip-ansi';

export type MockStd = {
  implementation(input: string | Uint8Array): boolean;
  readonly output: string;
};

export const mockStd: () => MockStd = () => {
  const writes: string[] = [];

  return {
    implementation(input: string | Uint8Array): boolean {
      if (Array.isArray(input)) {
        writes.push(String.fromCharCode.apply(null, input));
      } else if (typeof input === 'string') {
        writes.push(input);
      }

      return true;
    },
    get output(): string {
      return writes.map(stripAnsi).join('');
    },
  };
};
