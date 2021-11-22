const common = {
  initSuperface: (): string =>
    `Initializing superface directory with empty 'super.json'`,
  superfaceAlreadyInitialized: (): string =>
    'Superface has been already initialized',
  superJsonNotFound: (): string => 'File super.json has not been found.',
  mkdir: (path: string): string => `Created directory ${path}`,
  initSuperJson: (path: string): string =>
    `Initialized super.json at path ${path}`,
  updateSuperJson: (path: string): string =>
    `Updated super.json at path ${path}`,
  writeProfile: (path: string): string => `Profile saved to ${path}`,
  unableToWriteProfile: (profile: string, err: unknown): string =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not write profile ${profile} source: ${err}`,
  invalidProfileId: (id: string): string => `Invalid profile id ${id}`,
  invalidProfileName: (name: string): string => `Invalid profile name ${name}`,
  invalidProfileVersion: (version: string): string =>
    `Invalid profile version ${version}`,
  invalidProviderName: (): string => 'Invalid provider name',
  assertProfile: (): string => 'Asserting profile document',
  assertMap: (): string => 'Asserting map document',
  errorMessage: (error: string): string => error,
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  unknownError: (error: unknown): string => `${error}`,
  superfaceServerError: (name: string, message: string): string =>
    `Superface server responded with error: ${name}: ${message}`,
};

const load = {
  localProfileFound: (profileId: string, path: string): string =>
    `Profile ${profileId} found on local file system at path: ${path}`,
  localMapFound: (profile: string, provider: string, path: string): string =>
    `Map for profile: ${profile} and provider ${provider} found on local filesystem at path: ${path}`,
  localProviderFound: (provider: string, path: string): string =>
    `Provider ${provider} found on local file system at path: ${path}`,
};

const publish = {
  publishMap: (profile: string, provider: string): string =>
    `Publishing map for profile ${profile} and provider ${provider}`,
  publisProfile: (profile: string): string => `Publishing profile ${profile}`,
  publisProvider: (provider: string): string =>
    `Publishing provider ${provider}`,
  localAndRemoteProvider: (provider: string): string =>
    `Provider: ${provider} found localy linked in super.json and also in Superface server. Consider using provider from Superface store.`,
  publishEndedWithErrors: (): string =>
    'Publishing command ended up with errors:\n',
  publishSuccessfull: (documentType: string): string =>
    `${documentType} has been published successfully.`,
};

const login = {
  openUrl: (url: string): string =>
    `Please open url: ${url} in your browser to continue with login.`,
  usinfSfRefreshToken: (): string =>
    `Using value from SUPERFACE_REFRESH_TOKEN environment variable`,
  alreadyLoggedIn: (): string => 'Already logged in, logging out',
  loggedInSuccessfully: (): string => 'Logged in',
};

const loggout = {
  loggoutSuccessfull: (): string => `You have been logged out`,
};

const lint = {
  warningsWereFound: (): string => 'Warnings were found',
  unexpectedLintError: (mapPath: string, profilePath: string): string =>
    `Unexpected error during validation of map: ${mapPath} to profile: ${profilePath}.\nThis error is probably not a problem in linted files but in parser itself.\nTry updating CLI and its dependencies or report an issue.\n\n\n`,
};

const fetch = {
  fetchProfileInfo: (profile: string) =>
    `Fetching profile info of profile ${profile} from Superface store`,
  fetchProfileSource: (profile: string) =>
    `Fetching profile source for ${profile} from Superface store`,
  fetchProfileAst: (profile: string) =>
    `Fetching compiled profile for ${profile} from Superface store`,
  fetchProfileAstFailed: (profile: string) =>
    `Fetching compiled profile for ${profile} failed, trying to parse source file`,

  fetchProfile: (profile: string, version?: string) => {
    if (version) {
      return `Fetching profile: ${profile} in version: ${version} from Superface store`;
    }

    return `Fetching profile: ${profile} from Superface store`;
  },
  fetchMap: (
    profile: string,
    provider: string,
    astVersion?: string
  ): string => {
    if (astVersion) {
      return `Loading map for profile: ${profile} and provider: ${provider} in version: ${astVersion} from Superface store`;
    }

    return `Loading map for profile: ${profile} and provider: ${provider} from Superface store`;
  },
  fetchProvider: (provider: string): string =>
    `Fetching provider ${provider} from the Store`,

  couldNotFetch: (entitiy: string, error: unknown): string =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not fetch ${entitiy}: ${error}`,
};

const configure = {
  configureProviderToSuperJson: (path: string): string =>
    `Configuring provider to 'super.json' on path ${path}`,
  configuringProviders: (): string => `Configuring providers`,
  configureMultipleProviderSecurity: (): string =>
    `Configuring providers security`,
  configureProviderSecurity: (provider: string): string =>
    `Configuring ${provider} security`,
  noAuthProvider: (provider: string): string =>
    `Provider ${provider} can be used without authentication`,
  configuringSecuritySchemes: (current: number, total: number): string =>
    `Configuring ${current}/${total} security schemes`,
  providerAlreadyExists: (provider: string): string =>
    `Provider ${provider} already exists (Use flag \`--force/-f\` for overwriting profiles)`,
  unexpectedSecurityValue: (
    envVariableName: string,
    provider: string,
    authType: string
  ): string =>
    `Value of ${envVariableName} in ${provider} ${authType} security schema does not start with $ character.`,
  unknownSecurityType: (provider: string): string =>
    `Unable to resolve security type for ${provider}`,
  unknownSecurityScheme: (provider: string): string =>
    `Provider: "${provider}" contains unknown security scheme`,

  noSecurityConfigured: (): string =>
    `No security schemes have been configured.`,
  allSecurityConfigured: (): string =>
    `All security schemes have been configured successfully.`,

  xOutOfYConfigured: (x: number, y: number): string =>
    `Some security schemes have been configured. Configured ${x} out of ${y}.`,
  noSecurityFound: (): string => `No security schemes found to configure.`,
  providerHasParameters: (provider: string, superJsonPath: string): string =>
    `Provider ${provider} has integration parameters that must be configured. You can configure them in super.json on path: ${superJsonPath} or set the environment variables as defined below.`,
  parameterNotConfigured: (
    name: string,
    description: string,
    superJsonPath: string
  ): string =>
    `Parameter ${name}${description} has not been configured.\nPlease, configure this parameter manualy in super.json on path: ${superJsonPath}`,
  parameterConfigured: (
    name: string,
    description: string,
    value: string
  ): string =>
    `Parameter ${name}${description} has been configured to use value of environment value "${value}".\nPlease, configure this environment value.`,
  parameterHasDefault: (defaultValue: string): string =>
    `If you do not set the variable, the default value "${defaultValue}" will be used.`,
};

const install = {
  installMultipleProviders: (): string => `Installing providers`,
  installProvider: (provider: string): string =>
    `Installing provider ${provider}`,
  installProfilesToSuperJson: (path: string): string =>
    `Installing profiles according to 'super.json' on path ${path}`,
  installProfile: (profile: string): string => `Installing profile ${profile}`,
  xOutOfYInsatlled: (x: string, y: string): string =>
    `Installed ${x} out of ${y} profiles`,
  allProfilesInstalled: (count: string): string =>
    `All profiles (${count}) have been installed successfully.`,
  noProfilesInstalled: (): string => `No profiles have been installed`,
  noProfilesFound: (): string => `No profiles found to install`,
  noVersionForProfile: (profileId: string): string =>
    `No version for profile ${profileId} was found, returning default version 1.0.0`,
  couldNotReadProfile: (path: string, err: unknown): string =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not read profile file ${path}: ${err}`,
  profileInstalledFromSamePath: (profile: string, path: string): string =>
    `Profile ${profile} already installed from the same path ${path}. Skipping.`,
  profileInstalledFromPath: (profile: string, path: string): string =>
    `Profile ${profile} already installed from a different path ${path}. Pass \`--force\` to override.`,
  profileInstalledWithVersion: (profile: string, version: string): string =>
    `Profile ${profile} already installed with version ${version}. Pass \`--force\` to override.`,
  fileAlreadyExists: (path: string): string =>
    `Target file already exists ${path}. Pass \`--force\` to override.`,
  unableToInstallWithoutProfile: (): string =>
    'Unable to install providers without a profile. Please, specify a profile id.',
  missingInteractiveFlag: (): string =>
    `Profile ID argument must be used with interactive flag`,
};

const check = {
  checkProfileAndMap: (profile: string, provider: string): string =>
    `Checking profile ${profile} and map for provider ${provider}`,

  checkProvider: (provider: string): string => `Checking provider ${provider}`,
  checkIntegrationParameters: (provider: string): string =>
    `Checking integration parameters of provider ${provider}`,
  checkVersions: (profile: string, provider: string): string =>
    `Checking versions of profile ${profile} and map for provider ${provider}`,
  checkUsecases: (profile: string, provider: string): string =>
    `Checking usecase definitions in profile ${profile} and map for provider ${provider}`,
};

const packageManager = {
  packageJsonNotFound: (): string =>
    `Package.json not found in current directory ${process.cwd()}`,
  initPm: (pm: string): string => `Initializing package manager ${pm}`,
  initPmOnPath: (pm: string, path: string): string =>
    `Initializing ${pm} on path: ${path}`,

  pmAlreadyInitialized: (pm: string): string => `${pm} already initialized.`,
  pmNotInitialized: (packageName: string): string =>
    `Unable to install package ${packageName} without initialized package.json`,
  installPackage: (packageName: string): string =>
    `Installing package  ${packageName}`,
  installPackageOnPath: (
    packageName: string,
    path: string,
    command: string
  ): string =>
    `Installing package ${packageName} on path: ${path} with: ${command}`,

  configurePackage: (packageName: string): string =>
    `Configuring package  ${packageName}`,
  shellCommandError: (command: string, error: string): string =>
    `Shell command ${command} responded with: ${error}`,
  stdout: (stdout: string): string => stdout,
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

const create = {
  createProfile: (profile: string, path: string): string =>
    `Created profile ${profile} at path ${path}`,
  createMap: (profile: string, provider: string, path: string): string =>
    `Created map for profile ${profile} and provider ${provider} at path ${path}`,
  createProvider: (provider: string, path: string): string =>
    `Created provider ${provider} at path ${path}`,
  unverfiedPrefix: (provider: string, prefix: string): string =>
    `Published provider name must have prefix "${prefix}".\nIf you are planning to publish this map or provider consider renaming it to eg: "${prefix}${provider}"`,
};

const compile = {
  compileProfile: (profile: string): string => `Compiling profile ${profile}`,
  compileMap: (profile: string, provider: string): string =>
    `Compiling map for profile ${profile} and provider ${provider}`,
  compiledSuccessfully: (): string => `compiled successfully`,
};

const generate = {
  generatedSuccessfully: (): string => `types generated successfully.`,
};

const whoami = {
  loggedInAs: (name: string, email: string): string =>
    `You are logged in as ${name} (${email})`,
  notLoggedIn: (): string =>
    `You are not logged in. Please try running sf login`,
};

const quickstart = {
  configuredWithSdkToken: (envName: string): string =>
    `Your SDK token was saved to ${envName} variable in .env file. You can use it for authentization during SDK usage by loading it to your enviroment.`,
  configuredWithoutSdkToken: (): string => 'Continuing without SDK token',
  superfaceConfigureSuccess: (): string =>
    'Superface have been configured successfully',
  capabilityDocsUrl: (url: string): string =>
    `Now you can follow our documentation to use installed capability: ${url}`,
};

export const messages = {
  ...common,
  ...fetch,
  ...install,
  ...init,
  ...configure,
  ...packageManager,
  ...create,
  ...compile,
  ...quickstart,
  ...load,
  ...publish,
  ...login,
  ...lint,
  ...check,
  ...whoami,
  ...loggout,
  ...generate,
};
