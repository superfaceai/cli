const { join } = require('path');
const { developerError } = require('../common/error');

const { detectTestConfig } = require('../common/io');

function getConfigPath() {
  const configPath = detectTestConfig(process.cwd(), 3);

  if (!configPath) {
    throw developerError('Configuration file have not been found', 2);
  }

  return configPath;
}

/**
 *
 * @param testPath Path of the test file being tested
 * @param snapshotExtension The extension for snapshots (.snap usually)
 */
const resolveSnapshotPath = (testPath, snapshotExtension) => {
  return testPath.replace('__tests__', '__snapshots__') + snapshotExtension;
};

/**
 *
 * @param snapshotFilePath The filename of the snapshot (i.e. some.test.js.snap)
 * @param snapshotExtension The extension for snapshots (.snap)
 */
const resolveTestPath = (snapshotFilePath, snapshotExtension) => {
  return snapshotFilePath
    .replace(snapshotExtension, '')
    .replace('__snapshots__', '__tests__');
};

/* Used to validate resolveTestPath(resolveSnapshotPath( {this} )) */
const testPathForConsistencyCheck = join(
  getConfigPath(),
  '__tests__',
  'example.test.js'
);

module.exports = {
  resolveSnapshotPath,
  resolveTestPath,
  testPathForConsistencyCheck,
};
