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
    // Whitelist specific ESM modules for transformation.
    // Add other ESM modules from node_modules as needed.
    '/node_modules/(?!(next-mdx-remote|react-tweet|styled-jsx|next|jose)/)',
    // Standard pattern for CSS modules
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  bail: true, // Stop running tests after the first failure
};

module.exports = createJestConfig(customJestConfig);
