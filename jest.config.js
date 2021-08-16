module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src/',
  coveragePathIgnorePatterns: [
    "/dist/",
  ],
  testRegex: "(.*\\.(test|spec))\\.ts$",
  testTimeout: 10000
};
