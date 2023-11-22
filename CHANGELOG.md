# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.1.3] - 2023-11-22

## [4.1.2] - 2023-10-05
### Added
- `verbose`flag for `prepare` to prinout out prepared docs
- flag to configure polling timeout
- added poll URL retries

### Fixed
- Printing error message twice

## [4.1.1] - 2023-09-19
### Changed
- Updated OneSDK imports in Application code templates

## [4.1.0] - 2023-09-05
### Added
- added one sdk debug flag to .env template

### Changed
- formatted boilerplate code

### Removed
- Unused commands and dependencies

## [4.0.2] - 2023-08-21
### Changed
- `ValidationError` added to generated application code

## [4.0.1] - 2023-08-01
### Added
- Custom `profileId` argument to `new` command

### Fixed
- File path escaping for Windows
- Arguments checking

## [4.0.0] - 2023-07-17
### Fixed
- Updated @superfaceai/service-client to v5.2.1 with fixed getProvidersList, getProvider and getUserInfo methods

## [3.0.2] - 2023-03-14
### Added
- `switch` and `noSwitch` flag to `publish` command

### Fixed
- Undefined type bug in `create:map` command

## [3.0.1] - 2023-02-09
### Fixed
- Fixed create provider security schema resolution
- Remove misleading messages

## [3.0.0] - 2023-02-08
### Added
- New `create:map` command
- New `create:mock-map` command
- New `create:profile` command
- New `create:test` command
- New `create:mock-map-test` command
- New `create:provider` command

## [2.0.0] - 2022-08-15
### Changed
- Lint command prints summary of problems and number of checked files

## [1.1.1] - 2022-05-17
### Added
- New `--mapVariant` flag for configure command

## [1.1.0] - 2022-02-25
### Added
- Prepare files for digest authentication

### Changed
- Lint command prints more clear result

### Fixed
- Remove unnecessary warning when using install and configure commands

## [1.0.1] - 2021-11-04
### Changed
- Compile command now clears cache before compilation
- Check command checks for not matching provider name in provider.json and super.json

## [1.0.0] - 2021-11-04
### Added
- prepare integration parameters during configure command
- install command fallbacks to parse profile source on profile AST validation fail
- added `warn if update available` package
- integration parameters setup check in `check` command and before publishing

### Changed
- Use provider.json from ast instead of sdk
- Compile command now compiles every locally linked file in super.json

## [0.0.26] - 2021-10-13
### Added
- Check command loading files from server if not found localy

### Fixed
- Compile command provider name check

## [0.0.25] - 2021-09-29
### Added
- Lint command loading files from server if not found localy
- Exported function for security values preparation

### Changed
- Use super.json schema validation from ast-js

## [0.0.24] - 2021-09-23
### Added
- Create command file names flags

### Fixed
- Do not touch .env by default
- Hide interactive install command

## [0.0.23] - 2021-09-07
### Added
- Generate command
- Whoami command
- Logout command
- Login command
- Compile command compiles to cache
- Compile command scoped for single file
- Lint command loading file paths from super.json

### Removed
- Document type inference was moved to ast-js

### Fixed
- Improve passing of interactive install tests

## [0.0.22] - 2021-08-04
### Added
- Create command interactive mode
- Create command new flags
- Create command ability to create only provider or only map
- Visible init command
- Configure command prepares env variables in .env file

## [0.0.20] - 2021-07-20
### Added
- Multiple usecases in interactive install command
- Repeated use of interactive install command
- Set provider failover in interactive install command
- Set provider retry policies in interactive install command
- Providers priority array

### Fixed
- Package manager path resolution

## [0.0.19] - 2021-07-08
### Fixed
- Last provider selection in interactive install command

## [0.0.18] - 2021-06-15
### Added
- Multiple capabilities in interactive install command
- Providers priority array
- Package manager abstraction

## [0.0.17] - 2021-06-08
### Changed
- Generated Input and Result types are specific to both profile and usecase

## [0.0.16] - 2021-06-07

## [0.0.15] - 2021-06-03
### Added
- Interactive install command

## [0.0.14] - 2021-05-12
### Changed
- Provider name in environment variables
- Provider name delimiters
- Codegen generates .js and .d.ts now

## [0.0.13] - 2021-05-05
### Changed
- Validate identifiers

## [0.0.12] - 2021-04-30
### Changed
- Allow every type for Result in generated SDK

## [0.0.11] - 2021-04-28
### Changed
- Export SuperfaceClient type from generated SDK
- Allow every type for Result in generated SDK

## [0.0.10] - 2021-04-26
### Added
- Generate command
- Support for installing local files with `install` command

### Changed
- Refactored install logic

## [0.0.5] - 2021-03-15
### Changed
- Updated sdk version to v0.0.11
- Update playground and fixtures to support sdk v0.0.11

### Fixed
- `install` no longer stores local file path in `super.json` and instead stores the version

## [0.0.4] - 2021-02-25
### Added
- New flags for create command: `--template`, `--version` (`-v`),  `--variant` (`-t`)
- Generation of scope directory
- Generation of `provider.json` file
- Workaround for document type flag
- `isFileQuiet` function
- Validation of maps to profiles within `lint` command (flag `-v`)
- Init command
- Install command
- `--template` flag to play initialize

### Changed
- Updated parser dependency to v0.0.14
- Updated generation of header fields (`name`, `version`, `variant`)
- Updated validation of specified values in create command with new parsing functions
- Updated compile and lint tests to use `path.join` instead of string paths
- Play command outputs build files to `<playground>/build` directory
- Playground no longer needs to have the same name as the profile within it
- Playground now works with playscripts in `superface/play` folder
- Playground can now work with scoped profiles and maps

### Removed
- Document type flag: `--documentType` (`-t`)
- Unnecessary fixture playground

### Fixed
- Correct `--typeRoots` passed to play execute tsc invocation
- Scoped profiles and maps detection and execution

## [0.0.2] - 2020-12-18
### Added
- Create command
- Play command

### Changed
- Name of the binary to `superface`
- package.json private field to false

## 0.0.1 - 2020-11-25
### Added
- Document type inferrance
- Lint command
- Transpile command
- CI github flow

[Unreleased]: https://github.com/superfaceai/cli/compare/v4.1.3...HEAD
[4.1.3]: https://github.com/superfaceai/cli/compare/v4.1.2...v4.1.3
[4.1.2]: https://github.com/superfaceai/cli/compare/v4.1.1...v4.1.2
[4.1.1]: https://github.com/superfaceai/cli/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/superfaceai/cli/compare/v4.0.2...v4.1.0
[4.0.2]: https://github.com/superfaceai/cli/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/superfaceai/cli/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/superfaceai/cli/compare/v3.0.2...v4.0.0
[3.0.2]: https://github.com/superfaceai/cli/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/superfaceai/cli/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/superfaceai/cli/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/superfaceai/cli/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/superfaceai/cli/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/superfaceai/cli/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/superfaceai/cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/superfaceai/cli/compare/v0.0.26...v1.0.0
[0.0.26]: https://github.com/superfaceai/cli/compare/v0.0.25...v0.0.26
[0.0.25]: https://github.com/superfaceai/cli/compare/v0.0.24...v0.0.25
[0.0.24]: https://github.com/superfaceai/cli/compare/v0.0.23...v0.0.24
[0.0.23]: https://github.com/superfaceai/cli/compare/v0.0.22...v0.0.23
[0.0.22]: https://github.com/superfaceai/cli/compare/v0.0.20...v0.0.22
[0.0.20]: https://github.com/superfaceai/cli/compare/v0.0.19...v0.0.20
[0.0.19]: https://github.com/superfaceai/cli/compare/v0.0.18...v0.0.19
[0.0.18]: https://github.com/superfaceai/cli/compare/v0.0.17...v0.0.18
[0.0.17]: https://github.com/superfaceai/cli/compare/v0.0.16...v0.0.17
[0.0.16]: https://github.com/superfaceai/cli/compare/v0.0.15...v0.0.16
[0.0.15]: https://github.com/superfaceai/cli/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/superfaceai/cli/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/superfaceai/cli/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/superfaceai/cli/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/superfaceai/cli/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/superfaceai/cli/compare/v0.0.5...v0.0.10
[0.0.5]: https://github.com/superfaceai/cli/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/superfaceai/cli/compare/v0.0.2...v0.0.4
[0.0.2]: https://github.com/superfaceai/cli/compare/v0.0.1...v0.0.2
