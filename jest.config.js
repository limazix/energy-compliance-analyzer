// jest.config.js
import nextJest from 'next/jest.js';

const createNextJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Common config to be shared across projects
const commonConfig = {
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/global-lifecycle.setup.ts'],
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@functions/(.*)$': '<rootDir>/functions/src/$1',
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    // Mappers for compiled shared code when functions' source imports from their own /lib/shared
    '^../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^../../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^../../../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\](?!(next-mdx-remote|react-tweet|styled-jsx|next|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
};

// Configuration for the frontend (Next.js app)
const frontendConfig = {
  ...commonConfig,
  displayName: 'frontend',
  testEnvironment: 'jest-environment-jsdom',
  bail: true,
  coverageProvider: 'v8',
  testMatch: [
    '<rootDir>/tests/unit/frontend/**/*.[jt]s?(x)', // Updated to centralized test location
  ],
};

// Configuration for the backend (Firebase Functions)
const backendConfig = {
  ...commonConfig,
  displayName: 'backend',
  testEnvironment: 'node',
  bail: true,
  coverageProvider: 'v8',
  testMatch: [
    '<rootDir>/tests/unit/backend/**/*.[jt]s?(x)', // Updated to centralized test location
  ],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/functions/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

// createNextJestConfig is an async function that needs to be called with the frontend-specific config.
// The result is the Jest config for the Next.js part.
// We then export a configuration object that Jest will use, containing the projects array.
export default async () => {
  const nextJestConfigCreated = await createNextJestConfig(frontendConfig)();
  return {
    projects: [
      nextJestConfigCreated, // Config for Next.js app (frontend)
      backendConfig, // Config for Firebase Functions (backend)
    ],
  };
};
