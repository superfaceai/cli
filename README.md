[Website](https://superface.ai) | [Get Started](https://superface.ai/docs/introduction/getting-started) | [Documentation](https://superface.ai/docs) | [GitHub Discussions](https://sfc.is/discussions) | [Twitter](https://twitter.com/superfaceai) | [Support](https://superface.ai/support)

<img src="https://github.com/superfaceai/cli/blob/main/docs/LogoGreen.png" alt="Superface" width="100" height="100">

# Superface CLI [Deprecated]

**_This project has now been deprecated and support for it is no longer offered. Although some of the APIs that it uses may still work, the CLI project will no longer be developed._**

---

**Let AI connect the APIs for you.**

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/superfaceai/cli/main.yml)](https://github.com/superfaceai/cli/actions/workflows/main.yml)
[![Stable Release](https://img.shields.io/github/v/release/superfaceai/cli?label=homebrew)](#install)
[![NPM](https://img.shields.io/npm/l/@superfaceai/cli)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

Superface CLI abstracts APIs into the business cases you need. Point at API docs,
state your desired use case, let AI create an integration code, then use it
in your application. You remain in control of the code, and your app communicates
directly with your chosen APIs without any middlemen or proxy.

## Install

[Install Homebrew](https://brew.sh/), then install Superface CLI with:

```shell
brew install superfaceai/cli/superface
```

## Usage

  <!-- commands -->
* [`superface execute PROVIDERNAME PROFILEID`](#superface-execute-providername-profileid)
* [`superface login`](#superface-login)
* [`superface logout`](#superface-logout)
* [`superface map PROVIDERNAME [PROFILEID] [LANGUAGE]`](#superface-map-providername-profileid-language)
* [`superface new PROVIDERNAME PROMPT [PROFILEID]`](#superface-new-providername-prompt-profileid)
* [`superface prepare URLORPATH [NAME]`](#superface-prepare-urlorpath-name)
* [`superface whoami`](#superface-whoami)

## `superface execute PROVIDERNAME PROFILEID`

Run the created integration in superface directory. Commands `prepare`, `new` and `map` must be run before this command. You can switch runner language via `language` flag (`js` by default).

```
USAGE
  $ superface execute PROVIDERNAME PROFILEID [LANGUAGE] [-q] [--noColor] [--noEmoji] [-h]

ARGUMENTS
  PROVIDERNAME  Name of provider.
  PROFILEID     Id of profile, eg: starwars.character-information

FLAGS
  -h, --help   show CLI help
  -q, --quiet  When set to true, disables the shell echo output of action.
  --noColor    When set to true, disables all colored output.
  --noEmoji    When set to true, disables displaying emoji in output.

DESCRIPTION
  Run the created integration in superface directory. Commands `prepare`, `new` and `map` must be run before this
  command. You can switch runner language via `language` flag (`js` by default).

EXAMPLES
  $ superface execute resend communication/send-email
```

_See code: [dist/commands/execute.ts](https://github.com/superfaceai/cli/tree/main/src/commands/execute.ts)_

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

## `superface map PROVIDERNAME [PROFILEID] [LANGUAGE]`

Creates a new (or updates an existing) Comlink Map that maps the use case to the selected API provider. After Map is available, the integration is ready to be used by our WASM OneSDK. You should check security, integration parameters and input in the created files before execution. The created Comlinks can be tested by running `superface execute` command

```
USAGE
  $ superface map PROVIDERNAME [PROFILEID] [LANGUAGE] [-q] [--noColor] [--noEmoji] [-h] [-t <value>]

ARGUMENTS
  PROVIDERNAME  Name of provider.
  PROFILEID     Id of profile, eg: starwars/character-information
  LANGUAGE      (python|js) [default: js] Language of the generated application code. Default is `js`

FLAGS
  -h, --help             show CLI help
  -q, --quiet            When set to true, disables the shell echo output of action.
  -t, --timeout=<value>  [default: 300] Operation timeout in seconds. If not provided, it will be set to 300 seconds.
                         Useful for large API documentations.
  --noColor              When set to true, disables all colored output.
  --noEmoji              When set to true, disables displaying emoji in output.

DESCRIPTION
  Creates a new (or updates an existing) Comlink Map that maps the use case to the selected API provider. After Map is
  available, the integration is ready to be used by our WASM OneSDK. You should check security, integration parameters
  and input in the created files before execution. The created Comlinks can be tested by running `superface execute`
  command

EXAMPLES
  $ superface map resend communication/send-email
```

_See code: [dist/commands/map.ts](https://github.com/superfaceai/cli/tree/main/src/commands/map.ts)_

## `superface new PROVIDERNAME PROMPT [PROFILEID]`

Creates new Comlink Profile for your use case based on the selected API. Comlink Profile defines the interface of the API integration. Use name of API provider as the first argument followed by the description of your use case. You need to run `superface prepare` command before running this command.

```
USAGE
  $ superface new PROVIDERNAME PROMPT [PROFILEID] [-q] [--noColor] [--noEmoji] [-h] [-t <value>]

ARGUMENTS
  PROVIDERNAME  URL or path to the API documentation.
  PROMPT        Short description of your use case in natural language.
  PROFILEID     Optional ID of the new profile, e.g. starwars/character-information. If not provided, profile ID will be
                inferred from the prompt.

FLAGS
  -h, --help             show CLI help
  -q, --quiet            When set to true, disables the shell echo output of action.
  -t, --timeout=<value>  [default: 300] Operation timeout in seconds. If not provided, it will be set to 300 seconds.
                         Useful for large API documentations.
  --noColor              When set to true, disables all colored output.
  --noEmoji              When set to true, disables displaying emoji in output.

DESCRIPTION
  Creates new Comlink Profile for your use case based on the selected API. Comlink Profile defines the interface of the
  API integration. Use name of API provider as the first argument followed by the description of your use case. You need
  to run `superface prepare` command before running this command.

EXAMPLES
  $ superface new swapi "retrieve character's homeworld by their name"

  $ superface new swapi "retrieve character's homeworld by their name" swapi/character-information

  $ superface new resend "Send email to user"
```

_See code: [dist/commands/new.ts](https://github.com/superfaceai/cli/tree/main/src/commands/new.ts)_

## `superface prepare URLORPATH [NAME]`

Learns API from the documentation and prepares the API metadata.

```
USAGE
  $ superface prepare URLORPATH [NAME] [-q] [--noColor] [--noEmoji] [-h] [-v] [-t <value>]

ARGUMENTS
  URLORPATH  URL or path to the API documentation.
  NAME       API name. If not provided, it will be inferred from URL or file name.

FLAGS
  -h, --help             show CLI help
  -q, --quiet            When set to true, disables the shell echo output of action.
  -t, --timeout=<value>  [default: 300] Operation timeout in seconds. If not provided, it will be set to 300 seconds.
                         Useful for large API documentations.
  -v, --verbose          When set to true command will print the indexed documentation overview. This is useful for
                         debugging.
  --noColor              When set to true, disables all colored output.
  --noEmoji              When set to true, disables displaying emoji in output.

DESCRIPTION
  Learns API from the documentation and prepares the API metadata.

  The supported documentation formats are:
  - OpenAPI specification (via URL or local file)
  - documentation hosted on ReadMe.io (via URL)
  - plain text (see below)

  If you want to use plain text documentation you need to format the docs with **the separator**. The documentation
  conventionally consists of various topics, usually set apart by separate pages or big headings. They might be
  _authentication, rate limiting, general rules, API operations (sometimes grouped by resources)_.

  It's highly recommended each of these topics (or chunks) is set apart in the docs provided for Superface, too. For
  that, we use _the separator_.

  The separator is a long `===========` ended with a newline. Technically 5 _equal_ characters are enough to form a
  separator. The API docs ready for the ingest might look something like the following:

  `
  # Welcome to our docs
  (...)
  ================================
  # API Basics
  (...)
  ================================
  # Authorizing Requests
  (...)
  ================================
  # /todos/:id/items
  This endpoint lists all items (...)
  ================================
  (...)
  `
  This command prepares a Provider JSON metadata definition that can be used to generate the integration code. Superface
  tries to fill as much as possibe from the API documentation, but some parts are required to be filled manually. You
  can find the prepared provider definition in the `superface/` directory in the current working directory.

EXAMPLES
  $ superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml

  $ superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml openai

  $ superface prepare path/to/openapi.json

  $ superface prepare https://workable.readme.io/reference/stages workable

  $ superface prepare https://workable.readme.io/reference/stages workable --verbose
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

## Contributing

**Please open an issue first if you want to make larger changes**

Feel free to contribute! Please follow the [Contribution Guide](CONTRIBUTING.md).

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

The Superface CLI is licensed under the [MIT](LICENSE).

© 2023 Superface
