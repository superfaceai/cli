# Superface CLI

Superface CLI provides access to superface tooling from the CLI.

## Install

To install the package, first create `.npmrc` file in your project root and put the following line into it.

```
@superfaceai:registry=https://npm.pkg.github.com
```

Then authenticate to github npm package registry. Use your github name as your login. Use your github token with `repo` and `read:packages` as your password.

```
npm login --registry=https://npm.pkg.github.com
```

After doing this, you shuold be able to install the package by calling:

```
yarn add @superfaceai/cli
```

## Publishing a new version

Package publishing is done through GitHub release functionality.

[Draft a new release](https://github.com/superfaceai/language/releases/new) to publish a new version of the package.

Use semver for the version tag. It must be in format of `v<major>.<minor>.<patch>`.

Github Actions workflow will pick up the release and publish it as one of the [packages](https://github.com/superfaceai/language/packages).

## Licensing

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
