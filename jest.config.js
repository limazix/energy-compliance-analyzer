const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  coverageProvider: 'v8',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Changed to .ts
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The entry for 'lucide-react' is handled by its mock in jest/mocks/ui-components.setup.ts
  },
  transformIgnorePatterns: [
    // For root node_modules: ignore all except these specific packages.
    // (styled-jsx and react-tweet are often included by next/jest's default, added others that might be ESM)
    '/node_modules/(?!(next-mdx-remote|react-tweet|styled-jsx|next|@genkit-ai)/)',

    // For functions/node_modules: ignore all except these specific packages.
    // This is critical for 'jose', 'firebase-admin', etc., if they are ESM.
    '/functions/node_modules/(?!(jose|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',

    // Standard ignore for CSS modules
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  bail: true, // Stop running tests after the first failure
};

module.exports = createJestConfig(customJestConfig);
