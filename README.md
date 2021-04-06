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

```
superface play
```

### CLI

You can obtain the full CLI help by running `superface --help`.

 Command | Description
---------|-------------
`compile`| Compiles given profiles and/or maps into ASTs locally.
 `create`| Creates a new profile and/or map locally.
 `lint`  | Lints given profiles and/or maps locally.
 `play`  | Manages and executes interactive playgrounds.
 `init`  | Initializes local folder structure.
 `install`| Installs capabilities and their AST to a local project.
 `configure`| Configures capability provider.

#### Compile

<!---TODO-->

#### Create

<!---TODO-->

#### Lint

<!---TODO-->

#### Play

<!---TODO-->

#### Init

<!---TODO-->

#### Install

Install command initializes superface directory if needed and installs profile and ASTs locally. It takes ony one argument - profile identifier - consisting of scope (optional), profile name and its version. You can look up profiles in capability store <!--- FIX: add url -->. Examples of use:

Installs profile with specific version:

`superface install send-sms@1.0`

Install profile with specific version and scope:

`superface install sms/send-sms@1.0`

Installs profile and configures multiple providers in one command:

`superface install sms/service@1.0 -p twillio tyntec`

When working in non-standard directory structure you can use scan (`-s`) flag. When number provided, install command scans for super.json outside cwd within range represented by this number.

There are also quiet (`-q`) and force (`-f`) flags.

#### Configure

This command configures capability provider. It takes provider name (you can look that up in capability store <!--- FIX: add url -->) as a first argument and profile name as a second. Profile name specifies profile to associate with provider. Recommended use:

Install profile:

`superface install send-sms@1.0`

Configure provider:

`superface configure twillio -p send-sms`

You can use your local provider.json by setting `-l` flag:

`superface configure path/to/twillio -p send-sms -l`

There are also quiet (`-q`) and force (`-f`) flags.

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
