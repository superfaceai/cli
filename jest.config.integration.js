module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src/',
  coveragePathIgnorePatterns: [
    "/dist/",
  ],
  testTimeout: 10000,
  testMatch: ['**/*.integration.test.ts'],
};
