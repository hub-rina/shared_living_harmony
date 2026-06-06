/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testRegex: '.*\\.test\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/policy/**/*.ts',
    'src/membership.ts',
    'src/scope.ts',
  ],
  coverageThreshold: {
    './src/policy/': { lines: 100, functions: 100, branches: 100, statements: 100 },
  },
  coverageDirectory: 'coverage',
};
