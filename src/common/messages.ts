const common = {
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
  invalidProfileId: (): string => '⬅ Invalid profile id',

  invalidProviderName: (): string => '⬅ Invalid provider name',
};

const fetch = {
  fetchProvider: (provider: string): string =>
    `Fetching provider ${provider} from the Store`,
};

const install = {
  installProvider: (provider: string): string =>
    `Installing provider ${provider}`,
};

const init = {
  initPrompt: (
    flags: string,
    help: string,
    quiet: string,
    quietMode: string
  ): string => `This command will walk you through initializing superface folder structure ( mainly super.json structure ).
  If no value is specified, the default will be taken in place ( empty super.json ).
  
  ${flags} ${help}
  ${quietMode}
  ${quiet}`,
};

export const messages = {
  ...common,
  ...fetch,
  ...install,
  ...init,

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
