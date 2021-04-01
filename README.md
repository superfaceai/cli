# Superface CLI

Superface CLI provides access to superface tooling from the CLI.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Development](#development)
- [Publishing](#publishing)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

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

Compiles the given profile or map to AST.

```
USAGE
  $ superface compile FILE

OPTIONS
  -c, --compact                        Use compact JSON representation of the AST.
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

_See code: [dist/commands/compile.ts](https://github.com/superfaceai/cli/blob/v0.0.5/dist/commands/compile.ts)_

## `superface configure PROVIDERNAME`

Initializes superface directory if needed, communicates with Superface Store API, stores provider configuration in super.json

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
  $ superface configure twillio -p send-sms
  $ superface configure twillio -q
  $ superface configure twillio -f
  $ superface configure twillio -l
```

_See code: [dist/commands/configure.ts](https://github.com/superfaceai/cli/blob/v0.0.5/dist/commands/configure.ts)_

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
  $ superface create map sms/service -p twillio
  $ superface create map sms/service -p twillio -u SendSMS ReceiveSMS
  $ superface create sms/service -p twillio -u SendSMS ReceiveSMS
  $ superface create sms/service -p twillio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS
```

_See code: [dist/commands/create.ts](https://github.com/superfaceai/cli/blob/v0.0.5/dist/commands/create.ts)_

## `superface install [PROFILEID]`

Initializes superface directory if needed, communicates with Superface Store API, stores profiles and ASTs to a local system

```
USAGE
  $ superface install [PROFILEID]

ARGUMENTS
  PROFILEID  Profile identifier consisting of scope (optional), profile name and its version.

OPTIONS
  -f, --force                When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help                 show CLI help
  -p, --providers=providers  Provider name.
  -q, --quiet                When set to true, disables the shell echo output of init actions.

  -s, --scan=scan            When number provided, scan for super.json outside cwd within range represented by this
                             number.

EXAMPLES
  $ superface install
  $ superface install --provider twillio
  $ superface install sms/service@1.0
  $ superface install sms/service@1.0 -p twillio
```

_See code: [dist/commands/install.ts](https://github.com/superfaceai/cli/blob/v0.0.5/dist/commands/install.ts)_

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

_See code: [dist/commands/lint.ts](https://github.com/superfaceai/cli/blob/v0.0.5/dist/commands/lint.ts)_
<!-- commandsstop -->

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

PRs accepted.

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

`<TBD>` © 2020 Superface
