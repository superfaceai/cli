// import { SyntaxError } from '@superfaceai/parser';

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
  errorMessage: (error: string) => error,
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  unknownError: (error: unknown) => `${error}`,
  superfaceServerError: (name: string, message: string) =>
    `Superface server responded with error: "${name}": "${message}"`,
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

const whoami = {
  loggedInAs: (name: string, email: string) =>
    `You are logged in as: "${name} (${email})"`,
  notLoggedIn: () =>
    "You are not logged in. Please try running 'superface login'",
};


export const messages = {
  ...common,
  ...fetch,
  // ...install,
  // ...init,
  // ...configure,
  ...packageManager,
  // ...create,
  // ...compile,
  // ...quickstart,
  // ...load,
  // ...publish,
  ...login,
  // ...lint,
  // ...check,
  ...whoami,
  ...loggout,
  // ...generate,
  // ...compatibility,
  ...newCommand,
  ...prepare,
  ...execute,
  ...applicationCode,
};

export type MessageKeys = keyof typeof messages;
export type MessageArgs<K extends MessageKeys> = Parameters<typeof messages[K]>;
