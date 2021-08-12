# CLI

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/superfaceai/cli/CI)
![NPM](https://img.shields.io/npm/v/@superfaceai/cli)
[![NPM](https://img.shields.io/npm/l/@superfaceai/cli)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

<img src="https://github.com/superfaceai/cli/blob/main/docs/LogoGreen.png" alt="superface logo" width="150" height="150">

Superface CLI provides access to superface tooling from the CLI.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Security](#security)
- [Support](#support)
- [Development](#development)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

Superface (super-interface) is a higher-order API, an abstraction on top of the modern APIs like GraphQL and REST. Superface is one interface to discover, connect, and query any capabilities available via conventional APIs. 

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy. 

Superface allows for switching capability providers without development at a runtime in milliseconds. Furthermore, Superface decentralizes the composition and aggregation, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://docs.superface.ai/.

## Install

To install this package just install the cli globally using one of the following commands:

```shell
# if using yarn
yarn global add @superfaceai/cli
# otherwise
npm install --global @superfaceai/cli
```

Or you can use NPX directly with Superface CLI commands:

```shell
npx @superfaceai/cli [command]
# eg. you can quickly start with Superface CLI and our curated capabilities 
npx @superfaceai/cli install [profileId eg. communication/send-email] -i
```

## Usage

  <!-- commands -->
* [`superface configure PROVIDERNAME`](#superface-configure-providername)
* [`superface create`](#superface-create)
* [`superface init [NAME]`](#superface-init-name)
* [`superface install [PROFILEID]`](#superface-install-profileid)
* [`superface lint [FILE]`](#superface-lint-file)

## `superface configure PROVIDERNAME`

Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores provider configuration in super.json

```
USAGE
  $ superface configure PROVIDERNAME

ARGUMENTS
  PROVIDERNAME  Provider name.

OPTIONS
  -f, --force            When set to true and when provider exists in super.json, overwrites them.
  -h, --help             show CLI help
  -l, --local            When set to true, provider name argument is used as a filepath to provider.json file
  -p, --profile=profile  (required) Specifies profile to associate with provider
  -q, --quiet            When set to true, disables the shell echo output of init actions.
  --no-env               When set to true command does not prepare security varibles in .env file

EXAMPLES
  $ superface configure twilio -p send-sms
  $ superface configure twilio -p send-sms -q
  $ superface configure twilio -p send-sms -f
  $ superface configure providers/twilio.provider.json -p send-sms -l
```

_See code: [src/commands/configure.ts](https://github.com/superfaceai/cli/tree/main/src/commands/configure.ts)_

## `superface create`

Creates empty map, profile or/and provider on a local filesystem.

```
USAGE
  $ superface create

OPTIONS
  -h, --help                   show CLI help
  -i, --interactive            When set to true, command is used in interactive mode.
  -p, --path=path              Base path where files will be created
  -q, --quiet                  When set to true, disables the shell echo output of init actions.

  -s, --scan=scan              When number provided, scan for super.json outside cwd within range represented by this
                               number.

  -t, --variant=variant        Variant of a map

  -u, --usecase=usecase        Usecases that profile or map contains

  -v, --version=version        [default: 1.0.0] Version of a profile

  --init                       When set to true, command will initialize Superface

  --map                        Create a map

  --no-init                    When set to true, command won't initialize Superface

  --no-super-json              When set to true, command won't change SuperJson file

  --profile                    Create a profile

  --profileId=profileId        Profile Id in format [scope](optional)/[name]

  --provider                   Create a provider

  --providerName=providerName  Names of providers. This argument is used to create maps and/or providers

EXAMPLES
  $ superface create --profileId sms/service --profile
  $ superface create --profileId sms/service --profile -v 1.1-rev133 -u SendSMS ReceiveSMS
  $ superface create --profileId sms/service --providerName twilio --map
  $ superface create --profileId sms/service --providerName twilio --map -t bugfix
  $ superface create --providerName twilio tyntec --provider
  $ superface create --profileId sms/service --providerName twilio --provider --map --profile -t bugfix -v 1.1-rev133 -u 
  SendSMS ReceiveSMS
  $ superface create -i
```

_See code: [src/commands/create/profile.ts](https://github.com/superfaceai/cli/tree/main/src/commands/create/profile.ts)_

## `superface init [NAME]`

Initializes superface local folder structure.

```
USAGE
  $ superface init [NAME]

ARGUMENTS
  NAME  Name of parent directory.

OPTIONS
  -h, --help             show CLI help
  -p, --prompt           When set to true, prompt will be executed.
  -q, --quiet            When set to true, disables the shell echo output of init actions.
  --profiles=profiles    Profile identifiers.
  --providers=providers  Provider names.

EXAMPLES
  superface init
  superface init foo
  superface init foo --providers bar twilio
  superface init foo --profiles my-profile@1.1.0 another-profile@2.0 --providers osm gmaps
```

_See code: [src/commands/create/provider.ts](https://github.com/superfaceai/cli/tree/main/src/commands/create/provider.ts)_

## `superface install [PROFILEID]`

Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores profiles and compiled files to a local system. Install without any arguments tries to install profiles and providers listed in super.json

```
USAGE
  $ superface install [PROFILEID]

ARGUMENTS
  PROFILEID  Profile identifier consisting of scope (optional), profile name and its version.

OPTIONS
  -f, --force                When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help                 show CLI help

  -i, --interactive          When set to true, command is used in interactive mode. It leads users through profile
                             installation, provider selection, provider security and retry policy setup. Result of this
                             command is ready to use superface configuration.

  -l, --local                When set to true, profile id argument is used as a filepath to profile.supr file.

  -p, --providers=providers  Provider name.

  -q, --quiet                When set to true, disables the shell echo output of init actions.

  -s, --scan=scan            When number provided, scan for super.json outside cwd within range represented by this
                             number.

EXAMPLES
  $ superface install
  $ superface install sms/service -i
  $ superface install sms/service@1.0 -i
  $ superface install sms/service@1.0
  $ superface install sms/service@1.0 --providers twilio tyntec
  $ superface install sms/service@1.0 -p twilio
  $ superface install --local sms/service.supr
```

_See code: [src/commands/install.ts](https://github.com/superfaceai/cli/tree/main/src/commands/install.ts)_

## `superface lint [FILE]`

Lints maps and profiles locally linked in super.json. Path to single file can be provided. Outputs the linter issues to STDOUT by default.

```
USAGE
  $ superface lint [FILE]

OPTIONS
  -f, --outputFormat=long|short|json   [default: long] Output format to use to display errors and warnings.
  -h, --help                           show CLI help

  -o, --output=output                  [default: -] Filename where the output will be written. `-` is stdout, `-2` is
                                       stderr.

  -q, --quiet                          When set to true, disables output of warnings.

  -s, --scan=scan                      When number provided, scan for super.json outside cwd within range represented by
                                       this number.

  -t, --documentType=auto|map|profile  [default: auto] Document type to parse. `auto` attempts to infer from file
                                       extension.

  -v, --validate                       Validate maps to specific profile.

  --append                             Open output file in append mode instead of truncating it if it exists. Has no
                                       effect with stdout and stderr streams.

DESCRIPTION
  Linter ends with non zero exit code if errors are found.
```

_See code: [src/commands/lint.ts](https://github.com/superfaceai/cli/tree/main/src/commands/lint.ts)_
<!-- commandsstop -->

## Interactive install

CLI install command can be used in interactive mode by using `-i` flag. It leads users through profile installation, provider selection, provider security and retry policy setup. Result of this command is ready to use superface configuration. Steps of command are:
      
1) Superface is initialized (if not already initialized)
      
2) Selected profile installation - if profile already exists users can choose if they want to override existing 
   installation
      
3) Select providers and install them. Users can choose to override or skip already existing providers
      
4) If profile contains more than one use case users can select use case to configure
      
5) If there is more than one provider configured users can choose to enable provider failover (in case of problems 
   with primary provider superface automatically switches to secondary provider)
      
6) For every selected provider users can choose retry policy he want provider to use. Currently there are two 
   supported retry policies:
      
    * None: superface won't retry any requests
      
    * CircuitBreaker: superface will try retry requests, each request has timeout and exponential backoff is used between 
      failed requests. Parameters of circuit breaker can be specifed or left default.
      
7) Installed providers are configured. Users can set enviroment variables needed for provider authorization. These 
   are saved locally in .env file.
      
8) Package @superfaceai/one-sdk is installed. This package is needed to use superface.
      
9) Optionally, package dotenv is installed to load .env file
      
10) Optionally, users can enter SDK token to connect superface installation with his dashboard and to enable e-mail 
    notifications
      
11) Superface is configured 🆗. Users can follow printed link to get actual code

## Security

Superface is not man-in-the-middle so it does not require any access to secrets that are needed to communicate with provider API. Superface CLI only prepares super.json file with authorization fields in form of environment variable. You just set correct variables and communicate directly with provider API.

You can find more information in [SDK repository](https://github.com/superfaceai/one-sdk-js/blob/main/SECURITY.md).

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [documentation page](https://docs.superface.ai). 

## Development

When developing, start with cloning the repository using `git clone https://github.com/superfaceai/cli.git` (or `git clone git@github.com:superfaceai/cli.git` if you have repository access).

After cloning, the dependencies must be downloaded using `yarn install` or `npm install`.

Now the repository is ready for code changes.

The `package.json` also contains scripts (runnable by calling `yarn <script-name>` or `npm run <script-name>`):
- `test` - run all tests
- `lint` - lint the code (use `lint --fix` to run autofix)
- `format` - check the code formatting (use `firmat:fix` to autoformat)
- `prepush` - run `test`, `lint` and `format` checks. This should run without errors before you push anything to git.

Lastly, to build a local artifact run `yarn build` or `npm run build`.

To install a local artifact globally, symlink the binary (`ln -s bin/superface <target>`) into one of the following folders:

- `~/.local/bin` - local binaries for your user only (may not be in `PATH` yet)
- `/usr/local/bin` - system-wide binaries installed by the system administrator
- output of `yarn global bin` - usually the same as `/use/local/bin`

**Note**: The project needs to be built (into the `dist` folder) to run cli commands.

**Note**: You can change url of API requests by setting `SUPERFACE_API_URL` environment variable to desired base url.

## Maintainers

- [@Lukáš Valenta](https://github.com/lukas-valenta)
- [@Edward](https://github.com/TheEdward162)
- [@Vratislav Kalenda](https://github.com/Vratislav)
- [@Z](https://github.com/zdne)

## Contributing

**Please open an issue first if you want to make larger changes**

Feel free to contribute! Please follow the [Contribution Guide](CONTRIBUTION_GUIDE.md).

Licenses of node_modules are checked during CI/CD for every commit. Only the following licenses are allowed:

- 0BDS
- MIT
- Apache-2.0
- ISC
- BSD-3-Clause
- BSD-2-Clause
- CC-BY-4.0
- CC-BY-3.0;BSD
- CC0-1.0
- Unlicense

Note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

The Superface is licensed under the [MIT](LICENSE).
© 2021 Superface
