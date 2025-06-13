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
    // This single pattern attempts to whitelist specific packages from ANY node_modules directory for transformation.
    // The negative lookahead (?!) ensures that if a path contains /node_modules/ AND is one of these packages,
    // it will NOT match this ignore pattern, and thus WILL be transformed.
    '/node_modules/(?!(next-mdx-remote|react-tweet|styled-jsx|next|jose|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$', // Keep this for CSS modules
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  bail: true, // Stop running tests after the first failure
};

module.exports = createJestConfig(customJestConfig);
