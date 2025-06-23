// jest.config.ts
import nextJest from 'next/jest.js';

import type { Config } from 'jest';

const createNextJestConfig = nextJest({
  dir: './',
});

// Base options common to both frontend and backend projects
// Excludes options that cause "Unknown option" warnings at the top level with `projects`
const commonProjectOptionsBase: Partial<Omit<Config, 'projects'>> = {
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@functions/(.*)$': '<rootDir>/functions/src/$1',
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    // Mapping for shared library access from functions tests
    '^../lib/shared/(.*).js$': '<rootDir>/src/$1.ts',
    '^../lib/shared/(.*)$': '<rootDir>/src/$1',
    '^../../lib/shared/(.*).js$': '<rootDir>/src/$1.ts',
    '^../../lib/shared/(.*)$': '<rootDir>/src/$1',
    '^../../../lib/shared/(.*).js$': '<rootDir>/src/$1.ts',
    '^../../../lib/shared/(.*)$': '<rootDir>/src/$1',
    '^../../../../lib/shared/(.*).js$': '<rootDir>/src/$1.ts',
    '^../../../../lib/shared/(.*)$': '<rootDir>/src/$1',
  },
};

// Configuration specific to the frontend (Next.js app)
const frontendConfigBase: Config = {
  ...commonProjectOptionsBase,
  displayName: 'frontend',
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['<rootDir>/tests/unit/frontend/**/*.[jt]s?(x)'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts', // Common setup first
    '<rootDir>/tests/mocks/frontend-specific.setup.ts', // Then frontend-specific
  ],
  transformIgnorePatterns: [
    // Overriding common for frontend specifics
    'node_modules/(?!(next-mdx-remote|@next/mdx|unfetch|p-debounce|p-throttle|yocto-queue)/)',
  ],
};

// Configuration specific to the backend (Firebase Functions)
const backendConfig: Config = {
  ...commonProjectOptionsBase,
  displayName: 'backend',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/backend/**/*.[jt]s?(x)'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts', // Common setup
    '<rootDir>/tests/mocks/backend-specific.setup.ts', // Backend-specific
  ],
  transform: {
    '^.+.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/functions/tsconfig.json' }],
  },
  transformIgnorePatterns: [
    // Overriding common for backend specifics
    '[/]node_modules[/](?!(firebase-admin|firebase-functions-test|@google-cloud/storage|uuid))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

// Export an async function as NextJest's createJestConfig is async
const jestConfig = async (): Promise<Config> => {
  // Create the Next.js-specific Jest configuration for the frontend
  const nextJestConfigCreated = await createNextJestConfig(frontendConfigBase)();

  // Ensure the specific options are correctly applied/merged into the frontend config.
  const finalFrontendConfig: Config = {
    ...nextJestConfigCreated,
    // Ensure moduleNameMapper is merged, not just overwritten by nextJest
    moduleNameMapper: {
      ...nextJestConfigCreated.moduleNameMapper, // From nextJest
      ...frontendConfigBase.moduleNameMapper, // From our base
    },
    // Ensure transformIgnorePatterns are merged/re-applied if nextJest modified them
    transformIgnorePatterns:
      nextJestConfigCreated.transformIgnorePatterns &&
      nextJestConfigCreated.transformIgnorePatterns.length > 0
        ? nextJestConfigCreated.transformIgnorePatterns
        : frontendConfigBase.transformIgnorePatterns,
  };

  // Configuration specific to integration tests
  const integrationConfig: Config = {
    ...commonProjectOptionsBase,
    displayName: 'integration',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/integration/**/*.[jt]s?(x)'],
    setupFilesAfterEnv: [
      '<rootDir>/jest.setup.ts', // Common setup
      '<rootDir>/tests/mocks/backend-specific.setup.ts', // Backend-specific setup for integration tests
    ],
    // Add any other integration-specific options here
    transform: {
      '^.+.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
      '^<rootDir>/jest.setup.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    },
  };

  return {
    // The top-level configuration object for Jest when using projects.
    // It should ONLY contain the 'projects' array for options like bail, coverageProvider, etc. to be project-scoped.
    projects: [finalFrontendConfig, backendConfig, integrationConfig],
    bail: true, // Project-specific
    coverageProvider: 'v8', // Project-specific
    coverageReporters: ['text', 'lcov'], // Project-specific
  };
};

export default jestConfig;
