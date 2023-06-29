# CLI

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/superfaceai/cli/main.yml)](https://github.com/superfaceai/cli/actions/workflows/main.yml)
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

Superface (super-interface) is a higher-order API, an abstraction on top of modern APIs like GraphQL and REST. Superface gives you the one interface to discover, connect, and query any capabilities available via conventional APIs.

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such, it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy.

Superface allows for switching providers at runtime in milliseconds with no development cost. Furthermore, Superface decentralizes the composition and aggregation of integrations, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://superface.ai/docs.

## Install

To install this package, just install the cli globally using one of the following commands:

```shell
# if using yarn
yarn global add @superfaceai/cli
# otherwise
npm install --global @superfaceai/cli
```

Or you can use NPX directly with Superface CLI commands:

```shell
npx @superfaceai/cli [command]
# eg.
npx @superfaceai/cli install [profileId eg. communication/send-email]
```

## Usage

  <!-- commands -->
* [`superface login`](#superface-login)
* [`superface logout`](#superface-logout)
* [`superface prepare URLORPATH [NAME]`](#superface-prepare-urlorpath-name)
* [`superface whoami`](#superface-whoami)

## `superface login`

Login to superface server

```
USAGE
  $ superface login [-q] [--noColor] [--noEmoji] [-h] [-f]

FLAGS
  -f, --force  When set to true user won't be asked to confirm browser opening
  -h, --help   show CLI help
  -q, --quiet  When set to true, disables the shell echo output of action.
  --noColor    When set to true, disables all colored output.
  --noEmoji    When set to true, disables displaying emoji in output.

DESCRIPTION
  Login to superface server

EXAMPLES
  $ superface login

  $ superface login -f
```

_See code: [src/commands/login.ts](https://github.com/superfaceai/cli/tree/main/src/commands/login.ts)_

## `superface logout`

Logs out logged in user

```
USAGE
  $ superface logout [-q] [--noColor] [--noEmoji] [-h]

FLAGS
  -h, --help   show CLI help
  -q, --quiet  When set to true, disables the shell echo output of action.
  --noColor    When set to true, disables all colored output.
  --noEmoji    When set to true, disables displaying emoji in output.

DESCRIPTION
  Logs out logged in user

EXAMPLES
  $ superface logout
```

_See code: [dist/commands/logout.ts](https://github.com/superfaceai/cli/tree/main/src/commands/logout.ts)_

## `superface prepare URLORPATH [NAME]`

Prepares API documentation for integration generation from provider URL or local file with OpenAPI specification in yaml or json format. Or from the URL to the readme.io dev portal.  This command prepares a provider definition that can be used to generate integration code.

```
USAGE
  $ superface prepare URLORPATH [NAME] [-q] [--noColor] [--noEmoji] [-h]

ARGUMENTS
  URLORPATH  URL or path to the API documentation.
  NAME       API name. If not provided, it will be inferred from URL or file name.

FLAGS
  -h, --help   show CLI help
  -q, --quiet  When set to true, disables the shell echo output of action.
  --noColor    When set to true, disables all colored output.
  --noEmoji    When set to true, disables displaying emoji in output.

DESCRIPTION
  Prepares API documentation for integration generation from provider URL or local file with OpenAPI specification in
  yaml or json format. Or from the URL to the readme.io dev portal.  This command prepares a provider definition that
  can be used to generate integration code.

EXAMPLES
  $ superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml

  $ superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml openai

  $ superface prepare prepare path/to/openapi.json

  $ superface prepare prepare https://workable.readme.io/reference/stages
```

_See code: [dist/commands/prepare.ts](https://github.com/superfaceai/cli/tree/main/src/commands/prepare.ts)_

## `superface whoami`

Prints info about logged in user

```
USAGE
  $ superface whoami [-q] [--noColor] [--noEmoji] [-h]

FLAGS
  -h, --help   show CLI help
  -q, --quiet  When set to true, disables the shell echo output of action.
  --noColor    When set to true, disables all colored output.
  --noEmoji    When set to true, disables displaying emoji in output.

DESCRIPTION
  Prints info about logged in user

EXAMPLES
  $ superface whoami

  $ sf whoami
```

_See code: [src/commands/whoami.ts](https://github.com/superfaceai/cli/tree/main/src/commands/whoami.ts)_

<!-- commandsstop -->

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
