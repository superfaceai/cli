export const messages = {
  common: {
    mkdir: (path: string): string => `Created directory ${path}`,
    ['init-super-json']: (path: string): string =>
      `Initialized super.json at path ${path}`,
    ['update-super-json']: (path: string): string =>
      `Updated super.json at path ${path}`,
    ['write-profile']: (path: string): string => `Profile saved to ${path}`,
    ['unable-to-write-profile']: (profile: string, err: unknown): string =>
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not write profile ${profile} source: ${err}`,
  },
  ['compile-profile']: (profile: string): string =>
    `Compiling profile ${profile}`,
  ['compile-map']: (profile: string, provider: string): string =>
    `Compiling map for profile ${profile} and provider ${provider}`,
};
