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
* [`superface check`](#superface-check)
* [`superface compile`](#superface-compile)
* [`superface configure PROVIDERNAME`](#superface-configure-providername)
* [`superface create`](#superface-create)
* [`superface init [NAME]`](#superface-init-name)
* [`superface install [PROFILEID]`](#superface-install-profileid)
* [`superface lint`](#superface-lint)
* [`superface login`](#superface-login)
* [`superface logout`](#superface-logout)
* [`superface prepare:map PROFILEID PROVIDERNAME`](#superface-preparemap-profileid-providername)
* [`superface prepare:mock-map PROFILEID`](#superface-preparemock-map-profileid)
* [`superface prepare:mock-map-test PROFILEID`](#superface-preparemock-map-test-profileid)
* [`superface prepare:profile PROFILEID`](#superface-prepareprofile-profileid)
* [`superface prepare:test PROFILEID PROVIDERNAME`](#superface-preparetest-profileid-providername)
* [`superface publish DOCUMENTTYPE`](#superface-publish-documenttype)
* [`superface whoami`](#superface-whoami)

## `superface check`

Checks all maps, profiles and providers locally linked in super.json. Also can be used to check specific profile and its maps, in that case remote files can be used.

```
USAGE
  $ superface check [-q] [--noColor] [--noEmoji] [-h] [--profileId <value>] [--providerName <value>] [-s
    <value>] [-j] [-f]

FLAGS
  -f, --failOnWarning     When true command will fail on warning
  -h, --help              show CLI help
  -j, --json              Formats result to JSON
  -q, --quiet             When set to true, disables the shell echo output of action.
  -s, --scan=<value>      When number provided, scan for super.json outside cwd within range represented by this number.
  --noColor               When set to true, disables all colored output.
  --noEmoji               When set to true, disables displaying emoji in output.
  --profileId=<value>     Profile Id in format [scope/](optional)[name]
  --providerName=<value>  Name of provider.

DESCRIPTION
  Checks all maps, profiles and providers locally linked in super.json. Also can be used to check specific profile and
  its maps, in that case remote files can be used.
  Command ends with non zero exit code if errors are found.

EXAMPLES
  $ superface check

  $ superface check -f

  $ superface check --profileId starwars/character-information

  $ superface check --profileId starwars/character-information --providerName swapi

  $ superface check --profileId starwars/character-information --providerName swapi -j

  $ superface check --profileId starwars/character-information --providerName swapi -s 3

  $ superface check --profileId starwars/character-information --providerName swapi -q
```

_See code: [src/commands/check.ts](https://github.com/superfaceai/cli/tree/main/src/commands/check.ts)_

## `superface compile`

Compiles locally linked maps and profiles in `super.json`. When running without `--profileId` flag, all locally linked files are compiled. When running with `--profileId`, a single local profile source file, and all its local maps are compiled. When running with `--profileId` and `--providerName`, a single local profile and a single local map are compiled.

```
USAGE
  $ superface compile [-q] [--noColor] [--noEmoji] [-h] [--profileId <value>] [--providerName <value>] [-s
    <value>] [--onlyProfile | --onlyMap]

FLAGS
  -h, --help              show CLI help
  -q, --quiet             When set to true, disables the shell echo output of action.
  -s, --scan=<value>      When number provided, scan for super.json outside cwd within range represented by this number.
  --noColor               When set to true, disables all colored output.
  --noEmoji               When set to true, disables displaying emoji in output.
  --onlyMap               Compile only a map/maps
  --onlyProfile           Compile only a profile/profiles
  --profileId=<value>     Profile Id in format [scope/](optional)[name]
  --providerName=<value>  Name of provider. This argument is used to compile map

DESCRIPTION
  Compiles locally linked maps and profiles in `super.json`. When running without `--profileId` flag, all locally linked
  files are compiled. When running with `--profileId`, a single local profile source file, and all its local maps are
  compiled. When running with `--profileId` and `--providerName`, a single local profile and a single local map are
  compiled.

EXAMPLES
  $ superface compile

  $ superface compile --profileId starwars/character-information --profile

  $ superface compile --profileId starwars/character-information --profile -q

  $ superface compile --profileId starwars/character-information --providerName swapi --onlyMap

  $ superface compile --profileId starwars/character-information --providerName swapi --onlyProfile
```

_See code: [src/commands/compile.ts](https://github.com/superfaceai/cli/tree/main/src/commands/compile.ts)_

## `superface configure PROVIDERNAME`

Configures new provider and map for already installed profile. Provider configuration is dowloaded from a Superface registry or from local file.

```
USAGE
  $ superface configure [PROVIDERNAME] -p <value> [-q] [--noColor] [--noEmoji] [-h] [--write-env] [-f]
    [--localProvider <value>] [--localMap <value>] [--mapVariant <value>]

ARGUMENTS
  PROVIDERNAME  Provider name.

FLAGS
  -f, --force              When set to true and when provider exists in super.json, overwrites them.
  -h, --help               show CLI help
  -p, --profile=<value>    (required) Specifies profile to associate with provider
  -q, --quiet              When set to true, disables the shell echo output of action.
  --localMap=<value>       Optional filepath to .suma map file
  --localProvider=<value>  Optional filepath to provider.json file
  --mapVariant=<value>     Optional map variant
  --noColor                When set to true, disables all colored output.
  --noEmoji                When set to true, disables displaying emoji in output.
  --write-env              When set to true command writes security variables to .env file

DESCRIPTION
  Configures new provider and map for already installed profile. Provider configuration is dowloaded from a Superface
  registry or from local file.

EXAMPLES
  $ superface configure twilio -p send-sms

  $ superface configure twilio -p send-sms -q

  $ superface configure twilio -p send-sms -f

  $ superface configure twilio -p send-sms --localProvider providers/twilio.provider.json

  $ superface configure twilio -p send-sms --localMap maps/send-sms.twilio.suma

  $ superface configure twilio -p send-sms --mapVariant generated
```

_See code: [src/commands/configure.ts](https://github.com/superfaceai/cli/tree/main/src/commands/configure.ts)_

## `superface create`

Creates empty map, profile or/and provider on a local filesystem.

```
USAGE
  $ superface create [--noColor] [--noEmoji] [-h] [--profileId <value>] [--providerName <value>] [-u
    <value>] [-t <value>] [-v <value>] [--init | --no-init] [--no-super-json] [-i | -q | --profile | --map | --provider]
    [-p <value>] [--mapFileName <value>] [--profileFileName <value>] [--providerFileName <value>] [-s <value>]

FLAGS
  -h, --help                  show CLI help
  -i, --interactive           When set to true, command is used in interactive mode.
  -p, --path=<value>          Base path where files will be created
  -q, --quiet                 When set to true, disables the shell echo output of action.
  -s, --scan=<value>          When number provided, scan for super.json outside cwd within range represented by this
                              number.
  -t, --variant=<value>       Variant of a map
  -u, --usecase=<value>...    Usecases that profile or map contains
  -v, --version=<value>       [default: 1.0.0] Version of a profile
  --init                      When set to true, command will initialize Superface
  --map                       Create a map
  --mapFileName=<value>       Name of map file
  --no-init                   When set to true, command won't initialize Superface
  --no-super-json             When set to true, command won't change SuperJson file
  --noColor                   When set to true, disables all colored output.
  --noEmoji                   When set to true, disables displaying emoji in output.
  --profile                   Create a profile
  --profileFileName=<value>   Name of profile file
  --profileId=<value>         Profile Id in format [scope](optional)/[name]
  --provider                  Create a provider
  --providerFileName=<value>  Name of provider file
  --providerName=<value>...   Names of providers. This argument is used to create maps and/or providers

DESCRIPTION
  Creates empty map, profile or/and provider on a local filesystem.

EXAMPLES
  $ superface create --profileId sms/service --profile

  $ superface create --profileId sms/service --profile -v 1.1-rev133 -u SendSMS ReceiveSMS

  $ superface create --profileId sms/service --providerName twilio --map

  $ superface create --profileId sms/service --providerName twilio --map -t bugfix

  $ superface create --providerName twilio tyntec --provider

  $ superface create --providerName twilio --provider --providerFileName my-provider -p my/path

  $ superface create --profileId sms/service --providerName twilio --provider --map --profile -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS

  $ superface create -i
```

_See code: [src/commands/compile.ts](https://github.com/superfaceai/cli/tree/main/src/commands/compile.ts)_




## `superface init [NAME]`

Initializes superface local folder structure.

```
USAGE
  $ superface init [NAME] [-q] [--noColor] [--noEmoji] [-h] [--profiles <value>] [--providers <value>] [-p]

ARGUMENTS
  NAME  Name of parent directory.

FLAGS
  -h, --help              show CLI help
  -p, --prompt            When set to true, prompt will be executed.
  -q, --quiet             When set to true, disables the shell echo output of action.
  --noColor               When set to true, disables all colored output.
  --noEmoji               When set to true, disables displaying emoji in output.
  --profiles=<value>...   Profile identifiers.
  --providers=<value>...  Provider names.

DESCRIPTION
  Initializes superface local folder structure.

EXAMPLES
  $ superface init

  $ superface init foo

  $ superface init foo --providers bar twilio

  $ superface init foo --profiles my-profile@1.1.0 another-profile@2.0 --providers osm gmaps
```

_See code: [src/commands/init.ts](https://github.com/superfaceai/cli/tree/main/src/commands/init.ts)_

## `superface install [PROFILEID]`

Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores profiles and compiled files to a local system. Install without any arguments tries to install profiles and providers listed in super.json

```
USAGE
  $ superface install [PROFILEID] [-q] [--noColor] [--noEmoji] [-h] [-p <value>] [-f] [-l] [-s <value>]

ARGUMENTS
  PROFILEID  Profile identifier consisting of scope (optional), profile name and its version.

FLAGS
  -f, --force                 When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help                  show CLI help
  -l, --local                 When set to true, profile id argument is used as a filepath to profile.supr file.
  -p, --providers=<value>...  Provider name.
  -q, --quiet                 When set to true, disables the shell echo output of action.
  -s, --scan=<value>          When number provided, scan for super.json outside cwd within range represented by this
                              number.
  --noColor                   When set to true, disables all colored output.
  --noEmoji                   When set to true, disables displaying emoji in output.

DESCRIPTION
  Automatically initializes superface directory in current working directory if needed, communicates with Superface
  Store API, stores profiles and compiled files to a local system. Install without any arguments tries to install
  profiles and providers listed in super.json

EXAMPLES
  $ superface install

  $ superface install sms/service@1.0

  $ superface install sms/service@1.0 --providers twilio tyntec

  $ superface install sms/service@1.0 -p twilio

  $ superface install --local sms/service.supr
```

_See code: [src/commands/install.ts](https://github.com/superfaceai/cli/tree/main/src/commands/install.ts)_

## `superface lint`

Lints all maps and profiles locally linked in super.json. Also can be used to lint specific profile and its maps, in that case remote files can be used.Outputs the linter issues to STDOUT by default.

```
USAGE
  $ superface lint [-q] [--noColor] [--noEmoji] [-h] [--providerName <value>] [--profileId <value>] [-o
    <value>] [--append] [-f long|short|json] [-s <value>]

FLAGS
  -f, --outputFormat=<option>  [default: short] Output format to use to display errors and warnings.
                               <options: long|short|json>
  -h, --help                   show CLI help
  -o, --output=<value>         [default: -] Filename where the output will be written. `-` is stdout, `-2` is stderr.
  -q, --quiet                  When set to true, disables the shell echo output of action.
  -s, --scan=<value>           When number provided, scan for super.json outside cwd within range represented by this
                               number.
  --append                     Open output file in append mode instead of truncating it if it exists. Has no effect with
                               stdout and stderr streams.
  --noColor                    When set to true, disables all colored output.
  --noEmoji                    When set to true, disables displaying emoji in output.
  --profileId=<value>          Profile Id in format [scope/](optional)[name]
  --providerName=<value>       Provider name

DESCRIPTION
  Lints all maps and profiles locally linked in super.json. Also can be used to lint specific profile and its maps, in
  that case remote files can be used.Outputs the linter issues to STDOUT by default.
  Linter ends with non zero exit code if errors are found.

EXAMPLES
  $ superface lint

  $ superface lint -f long

  $ superface lint --profileId starwars/character-information

  $ superface lint --profileId starwars/character-information --providerName swapi

  $ superface lint -o -2

  $ superface lint -f json

  $ superface lint -s 3
```

_See code: [src/commands/lint.ts](https://github.com/superfaceai/cli/tree/main/src/commands/lint.ts)_

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

_See code: [dist/commands/logout.ts](https://github.com/superfaceai/cli/tree/main/src/commands//logout.ts)_

## `superface prepare:map PROFILEID PROVIDERNAME`

Prepares map, based on profile and provider on a local filesystem. Created file contains prepared structure with information from profile and provider files. Before running this command you should have prepared profile (run sf prepare:profile) and provider (run sf prepare:provider)

```
USAGE
  $ superface prepare:map [PROFILEID] [PROVIDERNAME] [-q] [--noColor] [--noEmoji] [-h] [-s <value>] [-v <value>]
    [-f] [--station]

ARGUMENTS
  PROFILEID     Profile Id in format [scope](optional)/[name]
  PROVIDERNAME  Name of provider

FLAGS
  -f, --force            When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help             show CLI help
  -q, --quiet            When set to true, disables the shell echo output of action.
  -s, --scan=<value>     When number provided, scan for super.json outside cwd within range represented by this number.
  -v, --variant=<value>  Variant of a map
  --noColor              When set to true, disables all colored output.
  --noEmoji              When set to true, disables displaying emoji in output.
  --station              When set to true, command will create map in folder structure of Superface station

DESCRIPTION
  Prepares map, based on profile and provider on a local filesystem. Created file contains prepared structure with
  information from profile and provider files. Before running this command you should have prepared profile (run sf
  prepare:profile) and provider (run sf prepare:provider)

EXAMPLES
  $ superface prepare:map starwars/character-information swapi --force

  $ superface prepare:map starwars/character-information swapi -s 3

  $ superface prepare:map starwars/character-information swapi --station
```

_See code: [dist/commands/prepare/map.ts](https://github.com/superfaceai/cli/tree/main/src/commands/prepare/map.ts)_

## `superface prepare:mock-map PROFILEID`

Prepares map for mock provider on a local filesystem. Created map always returns success result example from profile file. Before running this command you should have prepared profile file (run sf prepare:profile).

```
USAGE
  $ superface prepare:mock-map [PROFILEID] [-q] [--noColor] [--noEmoji] [-h] [-s <value>] [-f] [--station]

ARGUMENTS
  PROFILEID  Profile Id in format [scope](optional)/[name]

FLAGS
  -f, --force         When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help          show CLI help
  -q, --quiet         When set to true, disables the shell echo output of action.
  -s, --scan=<value>  When number provided, scan for super.json outside cwd within range represented by this number.
  --noColor           When set to true, disables all colored output.
  --noEmoji           When set to true, disables displaying emoji in output.
  --station           When set to true, command will create map in folder structure of Superface station

DESCRIPTION
  Prepares map for mock provider on a local filesystem. Created map always returns success result example from profile
  file. Before running this command you should have prepared profile file (run sf prepare:profile).

EXAMPLES
  $ superface prepare:mock-map starwars/character-information --force

  $ superface prepare:mock-map starwars/character-information -s 3

  $ superface prepare:mock-map starwars/character-information --station
```

_See code: [dist/commands/prepare/mock-map.ts](https://github.com/superfaceai/cli/tree/main/src/commands/prepare/mock-map.ts)_

## `superface prepare:mock-map-test PROFILEID`

Prepares test for mock provider map on a local filesystem. Created test expects success result example from profile file. Before running this command you should have prepared mock provider map (run sf prepare:mock-map).

```
USAGE
  $ superface prepare:mock-map-test [PROFILEID] [-q] [--noColor] [--noEmoji] [-h] [-s <value>] [-f] [--station]

ARGUMENTS
  PROFILEID  Profile Id in format [scope](optional)/[name]

FLAGS
  -f, --force         When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help          show CLI help
  -q, --quiet         When set to true, disables the shell echo output of action.
  -s, --scan=<value>  When number provided, scan for super.json outside cwd within range represented by this number.
  --noColor           When set to true, disables all colored output.
  --noEmoji           When set to true, disables displaying emoji in output.
  --station           When set to true, command will create map in folder structure of Superface station

DESCRIPTION
  Prepares test for mock provider map on a local filesystem. Created test expects success result example from profile
  file. Before running this command you should have prepared mock provider map (run sf prepare:mock-map).

EXAMPLES
  $ superface prepare:mock-map-test starwars/character-information --force

  $ superface prepare:mock-map-test starwars/character-information -s 3

  $ superface prepare:mock-map-test starwars/character-information --station
```

_See code: [dist/commands/prepare/mock-map-test.ts](https://github.com/superfaceai/cli/tree/main/src/commands/prepare/mock-map-test.ts)_

## `superface prepare:profile PROFILEID`

Prepares profile file on local filesystem and links it to super.json.

```
USAGE
  $ superface prepare:profile [PROFILEID] [-q] [--noColor] [--noEmoji] [-h] [-v <value>] [-u <value>] [-s <value>]
    [-f] [--station]

ARGUMENTS
  PROFILEID  Profile Id in format [scope](optional)/[name]

FLAGS
  -f, --force               When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help                show CLI help
  -q, --quiet               When set to true, disables the shell echo output of action.
  -s, --scan=<value>        When number provided, scan for super.json outside cwd within range represented by this
                            number.
  -u, --usecase=<value>...  Usecases that profile contains
  -v, --version=<value>     [default: 1.0.0] Version of a profile
  --noColor                 When set to true, disables all colored output.
  --noEmoji                 When set to true, disables displaying emoji in output.
  --station                 When set to true, command will create profile in folder structure of Superface station

DESCRIPTION
  Prepares profile file on local filesystem and links it to super.json.

EXAMPLES
  $ superface prepare:profile starwars/character-information --force

  $ superface prepare:profile starwars/character-information -s 3

  $ superface prepare:profile starwars/character-information --station
```

_See code: [dist/commands/prepare/profile.js](https://github.com/superfaceai/cli/tree/main/src/commands/prepare/profile.ts)_

## `superface prepare:test PROFILEID PROVIDERNAME`

Prepares test file for specified profile and provider. Examples in profile are used as an input and @superfaceai/testing library is used to orchestrate tests.

```
USAGE
  $ superface prepare:test [PROFILEID] [PROVIDERNAME] [-q] [--noColor] [--noEmoji] [-h] [-s <value>] [-f]
    [--station]

ARGUMENTS
  PROFILEID     Profile Id in format [scope](optional)/[name]
  PROVIDERNAME  Name of provider

FLAGS
  -f, --force         When set to true and when profile exists in local filesystem, overwrites them.
  -h, --help          show CLI help
  -q, --quiet         When set to true, disables the shell echo output of action.
  -s, --scan=<value>  When number provided, scan for super.json outside cwd within range represented by this number.
  --noColor           When set to true, disables all colored output.
  --noEmoji           When set to true, disables displaying emoji in output.
  --station           When set to true, command will create map in folder structure of Superface station

DESCRIPTION
  Prepares test file for specified profile and provider. Examples in profile are used as an input and
  @superfaceai/testing library is used to orchestrate tests.

EXAMPLES
  $ superface prepare:test starwars/character-information swapi

  $ superface prepare:test starwars/character-information swapi --station

  $ superface prepare:test starwars/character-information swapi --force

  $ superface prepare:test starwars/character-information swapi -q
```

_See code: [dist/commands/prepare/test.ts](https://github.com/superfaceai/cli/tree/main/src/commands/prepare/test.ts)_

## `superface publish DOCUMENTTYPE`

Uploads map/profile/provider to Store. Published file must be locally linked in super.json. This command runs Check and Lint internaly to ensure quality

```
USAGE
  $ superface publish [DOCUMENTTYPE] --profileId <value> --providerName <value> [-q] [--noColor] [--noEmoji]
    [-h] [--dryRun] [-f] [-s <value>] [-j]

ARGUMENTS
  DOCUMENTTYPE  (map|profile|provider) Document type of published file

FLAGS
  -f, --force             Publishes without asking for any confirmation.
  -h, --help              show CLI help
  -j, --json              Formats result to JSON
  -q, --quiet             When set to true, disables the shell echo output of action.
  -s, --scan=<value>      When a number is provided, scan for super.json outside cwd within the range represented by
                          this number.
  --dryRun                Runs without sending the actual request.
  --noColor               When set to true, disables all colored output.
  --noEmoji               When set to true, disables displaying emoji in output.
  --profileId=<value>     (required) Profile Id in format [scope/](optional)[name]
  --providerName=<value>  (required) Name of the provider. This argument is used to publish a map or a provider.

DESCRIPTION
  Uploads map/profile/provider to Store. Published file must be locally linked in super.json. This command runs Check
  and Lint internaly to ensure quality

EXAMPLES
  $ superface publish map --profileId starwars/character-information --providerName swapi -s 4

  $ superface publish profile --profileId starwars/character-information --providerName swapi -f

  $ superface publish provider --profileId starwars/character-information --providerName swapi -q

  $ superface publish profile --profileId starwars/character-information --providerName swapi --dryRun
```

_See code: [src/commands/publish.ts](https://github.com/superfaceai/cli/tree/main/src/commands/publish.ts)_

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
