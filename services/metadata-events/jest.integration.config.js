/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = require('./jest.config');

// Override the settings for integration tests
module.exports = {
  ...config,
  testMatch: ['**/__integration__/**/*.ts', '**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/integration-setup.ts'],
  testTimeout: 30000, // Increase timeout for integration tests
  globalSetup: '<rootDir>/src/test/integration-global-setup.ts',
  globalTeardown: '<rootDir>/src/test/integration-global-teardown.ts',
};