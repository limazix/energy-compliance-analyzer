import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  coverageProvider: 'v8',
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/global-lifecycle.setup.ts'], // Keep setup files here
  testEnvironment: 'jest-environment-jsdom',
  // Removed 'roots' - Jest will find __tests__ and *.test.js/ts/tsx files by default.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    // Mappings for when functions/src/* files require from functions/lib/shared/* during tests
    '^../../lib/shared/config/appConfig\\.js$': '<rootDir>/src/config/appConfig.ts',
    '^../../lib/shared/types/(.*)\\.js$': '<rootDir>/src/types/$1.ts',
    '^../../lib/shared/ai/prompt-configs/(.*)\\.js$': '<rootDir>/src/ai/prompt-configs/$1.ts',
    '^../../lib/shared/lib/(.*)\\.js$': '<rootDir>/src/lib/$1.ts',
    // Mapping for functions/src/utils/storage.js if it's directly imported by other function source files
    '^../utils/storage\\.js$': '<rootDir>/functions/src/utils/storage.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\](?!(next-mdx-remote|react-tweet|styled-jsx|next|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  clearMocks: true,
  bail: true,
};

export default createJestConfig(customJestConfig);
