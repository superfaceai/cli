export const messages = {
  common: {
    initSuperface: (): string =>
      `Initializing superface directory with empty 'super.json'`,
    mkdir: (path: string): string => `Created directory ${path}`,
    initSuperJson: (path: string): string =>
      `Initialized super.json at path ${path}`,
    updateSuperJson: (path: string): string =>
      `Updated super.json at path ${path}`,
    writeProfile: (path: string): string => `Profile saved to ${path}`,
    unableToWriteProfile: (profile: string, err: unknown): string =>
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not write profile ${profile} source: ${err}`,
  },
  fetch: {
    provider: (provider: string): string =>
      `Fetching provider ${provider} from the Store`,
  },
  install: {
    provider: (provider: string): string => `Installing provider ${provider}`,
  },
  createProfile: (profile: string, path: string): string =>
    `Created profile ${profile} at path ${path}`,
  createMap: (profile: string, provider: string, path: string): string =>
    `Created map for profile ${profile} an provider = ${provider} at path ${path}`,
  createProvider: (provider: string, path: string): string =>
    `Created provider ${provider} at path ${path}`,

  compileProfile: (profile: string): string => `Compiling profile ${profile}`,
  compileMap: (profile: string, provider: string): string =>
    `Compiling map for profile ${profile} and provider ${provider}`,
};
