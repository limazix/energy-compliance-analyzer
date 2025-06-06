
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // Changed to .js
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // A entrada para 'lucide-react' foi removida daqui, pois o mock está em jest.setup.js
  },
  transformIgnorePatterns: [
    // Whitelist specific ESM modules for transformation.
    // Add other ESM modules from node_modules as needed.
    '/node_modules/(?!(next-mdx-remote|react-tweet|styled-jsx|next)/)',
    // Standard pattern for CSS modules
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
};

module.exports = createJestConfig(customJestConfig);
