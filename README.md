
# CLI

![superface logo](https://github.com/superfaceai/cli/blob/main/docs/LogoGreen.svg)

Superface CLI provides access to superface tooling from the CLI.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Security](#security)
- [Support](#support)
- [Development](#development)
- [Publishing](#publishing)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background
Superface (super-interface) is a higher-order API, an abstraction on top of the modern APIs like GraphQL and REST. Superface is one interface to discover, connect, and query any capabilities available via conventional APIs. 

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy. 

Superface allows for switching capability providers without development at a runtime in milliseconds. Furthermore, Superface decentralizes the composition and aggregation, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://developer.superface.dev.

## Install

To install this package, first add the github superface repository to your npm config. Use your github name as your login and generate a personal access token with at least the `repo` and `read:packages` permissions in Github to use as password:

```
npm login --scope=@superfaceai --registry=https://npm.pkg.github.com
```

Then install the cli globally using one of the following commands:

```shell
# if using yarn
yarn global add @superfaceai/cli
# otherwise
npm install --global @superfaceai/cli
```

## Usage

  <!-- commands -->
* [`superface compile FILE`](#superface-compile-file)
* [`superface configure PROVIDERNAME`](#superface-configure-providername)
* [`superface create DOCUMENTINFO`](#superface-create-documentinfo)
* [`superface install [PROFILEID]`](#superface-install-profileid)
* [`superface lint FILE`](#superface-lint-file)

## `superface compile FILE`

Compiles the given profile or map.

```
USAGE
  $ superface compile FILE

OPTIONS
  -c, --compact                        Use compact JSON representation of the compiled file.
  -h, --help                           show CLI help

  -o, --output=output                  Specifies directory or filename where the compiled file should be written. `-` is
                                       stdout, `-2` is stderr. By default, the output is written alongside the input
                                       file with `.ast.json` suffix added.

  -q, --quiet                          When set to true, disables the shell echo output of init actions.

  -t, --documentType=auto|map|profile  [default: auto] Document type to parse. `auto` attempts to infer from file
                                       extension.

  --append                             Open output file in append mode instead of truncating it if it exists. Has no
                                       effect with stdout and stderr streams.
```

_See code: [src/commands/compile.ts](https://github.com/superfaceai/cli/tree/main/src/commands/compile.ts)_

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

EXAMPLES
  $ superface configure twilio -p send-sms
  $ superface configure twilio -q
  $ superface configure twilio -f
  $ superface configure twilio -l
```

_See code: [src/commands/configure.ts](https://github.com/superfaceai/cli/tree/main/src/commands/configure.ts)_

## `superface create DOCUMENTINFO`

Creates empty map and profile on a local filesystem.

```
USAGE
  $ superface create DOCUMENTINFO

ARGUMENTS
  DOCUMENTINFO  Two arguments containing informations about the document.
                1. Document Type (optional) - type of document that will be created (profile or map), if not specified,
                utility will create both
                2. Document Name - name of a file that will be created

OPTIONS
  -h, --help               show CLI help
  -p, --provider=provider  Name of a Provider
  -q, --quiet              When set to true, disables the shell echo output of init actions.

  -s, --scan=scan          When number provided, scan for super.json outside cwd within range represented by this
                           number.

  -t, --variant=variant    Variant of a map

  -u, --usecase=usecase    Usecases that profile or map contains

  -v, --version=version    [default: 1.0.0] Version of a profile

  --template=empty|pubs    [default: empty] Template to initialize the usecases and maps with

EXAMPLES
  $ superface create profile sms/service
  $ superface create profile sms/service -u SendSMS ReceiveSMS
  $ superface create map sms/service -p twilio
  $ superface create map sms/service -p twilio -u SendSMS ReceiveSMS
  $ superface create sms/service -p twilio -u SendSMS ReceiveSMS
  $ superface create sms/service -p twilio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS
```

_See code: [src/commands/create.ts](https://github.com/superfaceai/cli/tree/main/src/commands/create.ts)_

## `superface install [PROFILEID]`

Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores profiles and compiled files to a local system

```
USAGE
  $ superface install [PROFILEID]

ARGUMENTS
  PROFILEID  Profile identifier consisting of scope (optional), profile name and its version.

OPTIONS
  -f, --force                When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help                 show CLI help
  -l, --local                When set to true, profile id argument is used as a filepath to profile.supr file
  -p, --providers=providers  Provider name.
  -q, --quiet                When set to true, disables the shell echo output of init actions.

  -s, --scan=scan            When number provided, scan for super.json outside cwd within range represented by this
                             number.

EXAMPLES
  $ superface install
  $ superface install --provider twilio
  $ superface install sms/service@1.0
  $ superface install sms/service@1.0 -p twilio
  $ superface install --local sms/service.supr
```

_See code: [src/commands/install.ts](https://github.com/superfaceai/cli/tree/main/src/commands/install.ts)_

## `superface lint FILE`

Lints a map or profile file. Outputs the linter issues to STDOUT by default.

```
USAGE
  $ superface lint FILE

OPTIONS
  -f, --outputFormat=long|short|json   [default: long] Output format to use to display errors and warnings.
  -h, --help                           show CLI help

  -o, --output=output                  [default: -] Filename where the output will be written. `-` is stdout, `-2` is
                                       stderr.

  -q, --quiet                          When set to true, disables output of warnings.

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

## Security

Superface is not man-in-the-middle so it does not require any access to secrets that are needed to communicate with provider API. Superface CLI only prepares super.json file with authorization fields in form of environment variable. You just set correct variables and communicate directly with provider API.

You can find more information in [SDK repository](https://github.com/superfaceai/sdk-js/blob/master/SECURITY.md).

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [documentation page](https://developer.superface.dev). 

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

## Publishing

Package publishing is done through GitHub release functionality.

[Draft a new release](https://github.com/superfaceai/cli/releases/new) to publish a new version of the package.

Use semver for the version tag. It must be in format of `v<major>.<minor>.<patch>`.

Github Actions workflow will pick up the release and publish it as one of the [packages](https://github.com/superfaceai/cli/packages).

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
- UNLICENSED

Note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

The Superface is licensed under the [MIT](LICENSE).
© 2021 Superface
