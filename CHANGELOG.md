## [Unreleased]

### Added
* New flags for create command: `--template`, `--version` (`-v`),  `--variant` (`-t`)
* Generation of scope directory
* Generation of x.provider.json file
* Workaround for document type flag
* `isFileQuiet` function

### Changed
* Updated parser dependency to v0.0.12
* Updated generation of header fields ( `name`, `version`, `variant` )
* Updated validation of specified values in create command with new parsing functions
* Updated compile and lint tests to use `path.join` instead of string paths
* Play command outputs build files to `<playground>/build` directory
* Playground no longer needs to have the same name as the profile within it
* Playground now works with playscripts in `superface/play` folder
* Playground can now work with scoped profiles and maps

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

[Unreleased]: https://github.com/superfaceai/cli/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/superfaceai/cli/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/superfaceai/cli/releases/tag/v0.0.1
