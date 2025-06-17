// jest.config.js
import nextJest from 'next/jest.js';

const createNextJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Common config to be shared across projects
const commonConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/global-lifecycle.setup.ts'],
  clearMocks: true,
  bail: true,
  coverageProvider: 'v8',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@functions/(.*)$': '<rootDir>/functions/src/$1',
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    // Mappers for compiled shared code when functions' source imports from their own /lib/shared
    '^../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts', // e.g. functions/src/some/file.ts imports '../lib/shared/foo.js'
    '^../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts', // e.g. functions/src/file.ts imports '../lib/shared/foo.js'
    '^../../../lib/shared/(.*)\\.js$': '<rootDir>/src/$1.ts', // For deeper nesting in functions
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
  // testMatch specifies patterns relative to the project's rootDir,
  // or Jest's rootDir if not overridden per project.
  // Since createNextJestConfig is for the Next.js app at root, these paths are from project root.
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // moduleNameMapper can be extended here if frontend has specific needs
  // Transform is handled by createNextJestConfig
};

// Configuration for the backend (Firebase Functions)
const backendConfig = {
  ...commonConfig,
  displayName: 'backend',
  testEnvironment: 'node',
  // testMatch specifies patterns relative to the project's rootDir
  testMatch: [
    '<rootDir>/functions/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/functions/src/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/functions/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // moduleNameMapper can be extended here if backend has specific needs
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
