# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Compile command compiles to cache
- Compile command scoped for single file
- Lint command loading file paths from super.json 

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

[Unreleased]: https://github.com/superfaceai/cli/compare/v0.0.22...HEAD
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
