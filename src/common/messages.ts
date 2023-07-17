import { SyntaxError } from '@superfaceai/parser';

const execute = {
  executingCommand: (file: string) => `Executing: "${file}"`,
  childProcessOutput: (output: string) => `${output}`,
  childProcessExited: (code: number | null) =>
    code === null
      ? `Child process exited without code`
      : `Child process exited with code ${code}`,
};
const applicationCode = {
  requiredSecurityValue: (value: string): string =>
    `Security ${value} is required for integration, please provide it in .env file`,
  requiredParameterValue: (value: string): string =>
    `Parameter ${value} is required for integration, please provide it in .env file`,
  projectDefinitionFileCreated: (path: string, name: string): string =>
    `${name} file created at ${path}`,
  projectDefinitionFileExists: (path: string, name: string): string =>
    `${name} file already exists at ${path}`,
};

const newCommand = {
  startProfileGeneration: (providerName: string) =>
    `Starting profile generation for provider: "${providerName}"`,
  saveProfile: (path: string) => `Saving to: "${path}"`,
};
const prepare = {
  preparationStarted: () => 'Starting preparation process',
  sfDirectory: () => 'Creating "superface" directory',
};

const common = {
  initSuperface: () =>
    'Initializing superface directory with empty "super.json"',
  superfaceAlreadyInitialized: () => 'Superface has been already initialized',
  superJsonNotFound: () => 'File "super.json" has not been found',
  mkdir: (path: string) => `Created directory "${path}"`,
  initSuperJson: (path: string) => `Initialized "super.json" at path "${path}"`,
  updateSuperJson: (path: string) => `Updated "super.json" at path "${path}"`,
  writeProfile: (path: string) => `Profile saved to: "${path}"`,
  unableToWriteProfile: (profile: string, err: unknown) =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not write profile: "${profile}" source: "${err}"`,
  invalidProfileId: (id: string) => `Invalid profile id: "${id}"`,
  invalidProfileName: (name: string) => `Invalid profile name: "${name}"`,
  invalidProfileVersion: (version: string) =>
    `Invalid profile version: "${version}"`,
  invalidProviderName: (name: string) => `Invalid provider name: ${name}`,
  assertProfile: () => 'Asserting profile document',
  assertMap: () => 'Asserting map document',
  errorMessage: (error: string) => error,
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  unknownError: (error: unknown) => `${error}`,
  superfaceServerError: (name: string, message: string) =>
    `Superface server responded with error: "${name}": "${message}"`,
};

const compatibility = {
  compatibleProviderNotFound: (
    provider: string,
    profile: string,
    compatibleProviders: string[]
  ) =>
    `Provider: "${provider}" is not compatible with profile: "${profile}". Compatible providers are: ${compatibleProviders.join(
      ', '
    )}`,
};

const load = {
  localProfileFound: (profileId: string, path: string) =>
    `Profile "${profileId}" found on local file system at path: "${path}"`,
  localMapFound: (profile: string, provider: string, path: string) =>
    `Map for profile: "${profile}" and provider: "${provider}" found on local file system at path: "${path}"`,
  localProviderFound: (provider: string, path: string) =>
    `Provider: "${provider}" found on local file system at path: "${path}"`,
};

const publish = {
  publishMap: (profile: string, provider: string) =>
    `Publishing map for profile: "${profile}" and provider: "${provider}"`,
  publishProfile: (profile: string) => `Publishing profile: "${profile}"`,
  publishProvider: (provider: string) => `Publishing provider: "${provider}"`,
  localAndRemoteProvider: (provider: string) =>
    `Provider: "${provider}" found localy linked in "super.json" and also in Superface registry; consider using provider from Superface registry`,
  publishEndedWithErrors: () => 'Publishing command ended up with errors:\n',
  publishSuccessful: (documentType: string) =>
    `${documentType} has been published successfully`,
};

const login = {
  openUrl: (url: string) =>
    `Please open following url in your browser to continue with login\n${url}`,
  usinfSfRefreshToken: () =>
    'Using value from "SUPERFACE_REFRESH_TOKEN" environment variable',
  alreadyLoggedIn: () => 'Already logged in, logging out',
  loggedInSuccessfully: () => 'Logged in',
};

const loggout = {
  loggoutSuccessful: () => 'You have been logged out',
};

const lint = {
  warningsWereFound: () => 'Warnings were found',
  unexpectedLintError: (mapPath: string, profilePath: string) =>
    `Unexpected error during validation of map: "${mapPath}" to profile: "${profilePath}"\nThis error is probably not a problem in linted files but in parser itself\nTry updating CLI and its dependencies or report an issue`,
};

const fetch = {
  fetchProfileInfo: (profile: string) =>
    `Fetching profile info of profile: "${profile}" from Superface registry`,
  fetchProfileAst: (profile: string) =>
    `Fetching compiled profile for: "${profile}" from Superface registry`,
  fetchProfileAstFailed: (profile: string, error: unknown) =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Fetching compiled profile for: "${profile}" failed: "${error}"`,
  fetchProfileInfoFailed: (profile: string, error: unknown) =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Fetching profile info of profile: "${profile}" failed: "${error}"`,
  fetchProfile: (profile: string, version?: string) => {
    if (version !== undefined) {
      return `Fetching profile: "${profile}" with version: "${version}" from Superface registry`;
    }

    return `Fetching profile: "${profile}" from Superface registry`;
  },
  fetchMap: (profile: string, provider: string, astVersion?: string) => {
    if (astVersion !== undefined) {
      return `Fetching map for profile: "${profile}" and provider: "${provider}" with version: "${astVersion}" from Superface registry`;
    }

    return `Fetching map for profile: "${profile}" and provider: "${provider}" from Superface registry`;
  },
  fetchProvider: (provider: string) =>
    `Fetching provider: "${provider}" from Superface registry`,
  couldNotFetch: (entitiy: string, error: unknown) =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not fetch "${entitiy}": "${error}"`,
  pollingEvent: (type: string, description: string) =>
    `Polling: ${type} - ${description}`,
};

const configure = {
  configureProviderToSuperJson: (path: string) =>
    `Configuring provider to "super.json" on path: "${path}"`,
  configuringProviders: () => 'Configuring providers',
  configureMultipleProviderSecurity: () => "Configuring provider's security",
  configureProviderSecurity: (provider: string) =>
    `Configuring: "${provider}" security`,
  noAuthProvider: (provider: string) =>
    `Provider: "${provider}" can be used without authentication`,
  configuringSecuritySchemes: (current: number, total: number) =>
    `Configuring ${current}/${total} security schemes`,
  unexpectedSecurityValue: (
    envVariableName: string,
    provider: string,
    authType: string
  ) =>
    `Value of: "${envVariableName}" in: "${provider}" ${authType} security scheme does not start with $ character`,
  unknownSecurityType: (provider: string) =>
    `Unable to resolve security type for: "${provider}"`,
  unknownSecurityScheme: (provider: string) =>
    `Provider "${provider}" contains unknown security scheme`,
  profileProviderConfigured: (provider: string, profile: string) =>
    `Provider "${provider}" configured for profile: "${profile}"`,
  noSecurityConfigured: () => 'No new security schemes have been configured',
  allSecurityConfigured: () =>
    'All security schemes have been configured successfully',

  xOutOfYConfigured: (x: number, y: number) =>
    `Some security schemes have been configured. Configured ${x} out of ${y}`,
  noSecurityFoundOrAlreadyConfigured: () =>
    'No security schemes found to configure or already configured',
  providerHasParameters: (provider: string, superJsonPath: string) =>
    `Provider: "${provider}" has integration parameters that must be configured. You can configure them in "super.json" in: "${superJsonPath}" or set the environment variables as defined below`,
  parameterNotConfigured: (
    name: string,
    superJsonPath: string,
    description?: string
  ) =>
    `Parameter: "${name}"${
      description !== undefined ? ` with description: "${description}"` : ''
    } has not been configured\nPlease, configure this parameter manually in "super.json" in: "${superJsonPath}"`,
  parameterConfigured: (name: string, value: string, description?: string) =>
    `Parameter: "${name}"${
      description !== undefined && description !== ''
        ? ` with description: "${description}"`
        : ''
    } has been configured to use value of environment value "${value}".\nPlease configure this environment value`,
  parameterHasDefault: (defaultValue: string) =>
    `If you do not set the variable, the default value: "${defaultValue}" will be used`,
};

const install = {
  installMultipleProviders: () => 'Installing providers',
  installProvider: (provider: string) => `Installing provider: "${provider}"`,
  installProfilesToSuperJson: (path: string) =>
    `Installing profiles according to "super.json" at path: "${path}"`,
  installProfile: (profile: string) => `Installing profile: "${profile}"`,
  xOutOfYInstalled: (x: string, y: string) =>
    `Installed ${x} out of ${y} profiles`,
  allProfilesInstalled: (count: string) =>
    `All profiles (${count}) have been installed successfully`,
  noProfilesInstalled: () => 'No profiles have been installed',
  noProfilesFound: () => 'No profiles found to install',
  noVersionForProfile: (profileId: string) =>
    `No version for profile: "${profileId}" was found, returning default version "1.0.0"`,
  couldNotReadProfile: (path: string, err: unknown) =>
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Could not read profile file: "${path}": ${err}`,
  profileInstalledFromSamePath: (profile: string, path: string) =>
    `Profile: "${profile}" already installed from the same path: "${path}". Skipping`,
  profileInstalledFromPath: (profile: string, path: string) =>
    `Profile: "${profile}" already installed from a different path: "${path}". Pass '--force' to override`,
  profileInstalledWithVersion: (profile: string, version: string) =>
    `Profile: "${profile}" already installed with version: "${version}". Pass '--force' to override`,
  fileAlreadyExists: (path: string) =>
    `Target file already exists: "${path}". Pass '--force' to override`,
  unableToInstallWithoutProfile: () =>
    'Unable to install providers without a profile. Please specify a profile id',
  missingInteractiveFlag: () =>
    'Profile ID argument must be used with interactive flag',
};

const check = {
  checkProfileAndMap: (profile: string, provider: string) =>
    `Checking profile: "${profile}" and map for provider: "${provider}"`,
  checkProvider: (provider: string) => `Checking provider: "${provider}"`,
  checkIntegrationParameters: (provider: string) =>
    `Checking integration parameters of provider: "${provider}"`,
  checkVersions: (profile: string, provider: string) =>
    `Checking versions of profile: "${profile}" and map for provider: "${provider}"`,
  checkUsecases: (profile: string, provider: string) =>
    `Checking usecase definitions in profile: "${profile}" and map for provider: "${provider}"`,
};

const packageManager = {
  packageJsonNotFound: () =>
    `"package.json" not found in current directory: "${process.cwd()}"`,
  initPm: (pm: string) => `Initializing package manager: "${pm}"`,
  initPmOnPath: (pm: string, path: string) =>
    `Initializing: "${pm}" at: "${path}"`,

  pmAlreadyInitialized: (pm: string) => `"${pm}" already initialized.`,
  pmNotInitialized: (packageName: string) =>
    `Unable to install package: "${packageName}" without package.json`,
  installPackage: (packageName: string) =>
    `Installing package: "${packageName}"`,
  installPackageOnPath: (packageName: string, path: string, command: string) =>
    `Installing package: "${packageName}" at: "${path}" with: "${command}"`,

  configurePackage: (packageName: string) =>
    `Configuring package: "${packageName}"`,
  shellCommandError: (command: string, error: string) =>
    `Shell command: "${command}" responded with: ${error}`,
  stdout: (stdout: string) => stdout,
};

const init = {
  initPrompt: (
    flags: string,
    help: string,
    quiet: string,
    quietMode: string
  ) => `This command will walk you through initializing superface folder structure (mainly "super.json" structure).
  If no value is specified, the default will be taken in place (empty "super.json").
  
  ${flags} ${help}
  ${quietMode}
  ${quiet}`,
};

const create = {
  createFullProfile: (profile: string, path: string, station?: boolean) =>
    `Created profile at "${path}".\n\nnext command suggestions:\nsf create:provider <provider-name> ${
      station === true ? ' --station' : ''
    }\nsf create:map ${profile} <provider-name> ${
      station === true ? ' --station' : ''
    }`,
  createMap: (
    profile: string,
    provider: string,
    path: string,
    station?: boolean
  ) =>
    `Created map at path: "${path}"".\n\nnext command suggestions:\nsf create:test ${profile} ${provider} ${
      station === true ? ' --station' : ''
    }`,
  createTest: (
    profile: string,
    provider: string,
    path: string,
    station?: boolean
  ) => {
    const fileInfo = `Created test at path: "${path}"\n\n`;

    if (station === true) {
      const testPath = `grid/${profile}/maps/${provider}.test.ts`;

      return (
        fileInfo +
        `Run created test with live traffic:\nyarn test:record ${testPath}\nor with recorded traffic:\nyarn test ${testPath}`
      );
    }

    return (
      fileInfo +
      `Follow https://github.com/superfaceai/testing/blob/dev/README.md to run created test`
    );
  },
  createProvider: (provider: string, path: string, station?: boolean) =>
    `Created provider at path: "${path}".\n⚠️ Edit .env file for your credentials\n\nnext command suggestions:\nsf create:profile <profileId> ${
      station === true ? ' --station' : ''
    }\nsf create:map <profileId> ${provider} ${
      station === true ? ' --station' : ''
    }\nsf create:test <profileId> ${provider} ${
      station === true ? ' --station' : ''
    }`,
  createEmptyProfile: (profile: string, path: string) =>
    `Created profile: "${profile}" at path: "${path}"`,
  unverifiedPrefix: (provider: string, prefix: string) =>
    `Published provider name must have prefix: "${prefix}"\nIf you are planning to publish this map or provider consider renaming it, eg: "${prefix}${provider}"`,
  providerAlreadyExists: (provider: string) =>
    `Provider "${provider}" is already defined in super.json"`,
};

const compile = {
  compileProfile: (profile: string) => `Compiling profile: "${profile}"`,
  compileMap: (profile: string, provider: string) =>
    `Compiling map for profile: "${profile}" and provider: "${provider}"`,
  compiledSuccessfully: () => 'compiled successfully',
  profileCompilationFailed: (
    profileId: string,
    path: string,
    error: unknown
  ) => {
    const errorMessage =
      error instanceof SyntaxError ? error.format() : String(error);

    return `Compilatiom of profile: "${profileId}" at path: "${path}" failed with: ${errorMessage}`;
  },
  mapCompilationFailed: (
    profileId: string,
    provider: string,
    path: string,
    error: unknown
  ) => {
    const errorMessage =
      error instanceof SyntaxError ? error.format() : String(error);

    return `Compilatiom of map for profile: "${profileId}" and provider: "${provider}" at path: "${path}" failed with: ${errorMessage}`;
  },
};

const generate = {
  generatedSuccessfully: () => 'types generated successfully',
};

const whoami = {
  loggedInAs: (name: string, email: string) =>
    `You are logged in as: "${name} (${email})"`,
  notLoggedIn: () =>
    "You are not logged in. Please try running 'superface login'",
};

const quickstart = {
  configuredWithSdkToken: (envName: string) =>
    `Your SDK token was saved to: "${envName}" variable in .env file. You can use it for authentization during SDK usage by loading it to your enviroment`,
  configuredWithoutSdkToken: () => 'Continuing without SDK token',
  superfaceConfigureSuccess: () => 'Superface has been configured successfully',
  capabilityDocsUrl: (url: string) =>
    `Now you can follow our documentation to use installed capability\n ${url}`,
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
  ...compatibility,
  ...newCommand,
  ...prepare,
  ...execute,
  ...applicationCode,
};

export type MessageKeys = keyof typeof messages;
export type MessageArgs<K extends MessageKeys> = Parameters<typeof messages[K]>;
