## [Unreleased]

### Changed
* Provider name in environment variables
* Provider name delimiters
* Codegen generates .js and .d.ts now

## [0.0.13] - 2021-05-05

### Changed
* Validate identifiers

## [0.0.12] - 2021-04-30

### Changed
* Allow every type for Result in generated SDK

## [0.0.11] - 2021-04-28

### Changed
* Export SuperfaceClient type from generated SDK
* Allow every type for Result in generated SDK

## [0.0.10] - 2021-04-26

### Added
* Generate command

### Added
* Support for installing local files with `install` command

### Changed
* Refactored install logic

## [0.0.5] - 2021-03-15

### Changed
* Updated sdk version to v0.0.11
* Update playground and fixtures to support sdk v0.0.11

### Fixed
* `install` no longer stores local file path in `super.json` and instead stores the version

## [0.0.4] - 2021-02-25

### Added
* New flags for create command: `--template`, `--version` (`-v`),  `--variant` (`-t`)
* Generation of scope directory
* Generation of `provider.json` file
* Workaround for document type flag
* `isFileQuiet` function
* Validation of maps to profiles within `lint` command (flag `-v`)
* Init command
* Install command
* `--template` flag to play initialize

### Changed
* Updated parser dependency to v0.0.14
* Updated generation of header fields (`name`, `version`, `variant`)
* Updated validation of specified values in create command with new parsing functions
* Updated compile and lint tests to use `path.join` instead of string paths
* Play command outputs build files to `<playground>/build` directory
* Playground no longer needs to have the same name as the profile within it
* Playground now works with playscripts in `superface/play` folder
* Playground can now work with scoped profiles and maps

### Fixed
* Correct `--typeRoots` passed to play execute tsc invocation
* Scoped profiles and maps detection and execution

### Removed
* Document type flag: `--documentType` (`-t`)
* Unnecessary fixture playground

## [0.0.2]

### Added
* Create command
* Play command

### Changed
* Name of the binary to `superface`
* package.json private field to false

## [0.0.1] - 2020-11-25

### Added
* Document type inferrance
* Lint command
* Transpile command
* CI github flow

[Unreleased]: https://github.com/superfaceai/cli/compare/v0.0.10...HEAD
[0.0.10]: https://github.com/superfaceai/cli/compare/v0.0.5...v0.0.10
[0.0.5]: https://github.com/superfaceai/cli/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/superfaceai/cli/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/superfaceai/cli/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/superfaceai/cli/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/superfaceai/cli/releases/tag/v0.0.1
