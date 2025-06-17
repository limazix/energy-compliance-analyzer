import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  coverageProvider: 'v8',
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/global-lifecycle.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@functions/(.*)$': '<rootDir>/functions/src/$1', // New alias for functions
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    // Mappings for when functions/src/*.(ts|js) files import from their *compiled* ../lib/shared/... path during runtime.
    // Jest needs to resolve these to the original TypeScript source files in <rootDir>/src/...
    '^../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^../../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts', // For deeper nesting in functions/src
    '^../../../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts', // For even deeper nesting
    // Specific case for appConfig if the general pattern isn't caught or is overridden.
    '^../lib/shared/config/appConfig\\.js$': '<rootDir>/src/config/appConfig.ts',
    '^../../lib/shared/config/appConfig\\.js$': '<rootDir>/src/config/appConfig.ts',
    '^../../../lib/shared/config/appConfig\\.js$': '<rootDir>/src/config/appConfig.ts',
    '^../../../../lib/shared/config/appConfig\\.js$': '<rootDir>/src/config/appConfig.ts',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\](?!(next-mdx-remote|react-tweet|styled-jsx|next|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  clearMocks: true,
  bail: true,
  // No 'roots' needed if test scripts in package.json target specific test directories.
};

export default createJestConfig(customJestConfig);
