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
    // This pattern aims to ignore node_modules unless they are specific packages we need to transform (ESM).
    // It now checks for node_modules at the root OR within functions/node_modules.
    '/node_modules/(?!(next-mdx-remote|react-tweet|styled-jsx|next|jose|jwks-rsa|firebase-admin|firebase-functions)/)',
    // A more specific pattern for functions/node_modules to ensure those packages are transformed.
    // This might be redundant if the above pattern works correctly, but can provide extra certainty.
    // However, to avoid conflicting patterns, we'll rely on the first one being general enough.
    // The main idea is: if a path is in ANY node_modules, ignore it UNLESS it's one of the listed exceptions.
    // The previous pattern `/node_modules/` might have been too restrictive if paths were like `functions/node_modules/...`
    // Let's try a pattern that matches "node_modules" anywhere in the path for the general ignore,
    // and then use the negative lookahead for our specific packages.
    // A more robust pattern: ignore paths containing 'node_modules/' UNLESS they are one of the specified packages.
    // This should cover both root node_modules and functions/node_modules.
    // Match 'node_modules' or 'functions/node_modules' then apply the negative lookahead
    '(node_modules|functions/node_modules)/(?!(next-mdx-remote|react-tweet|styled-jsx|next|jose|jwks-rsa|firebase-admin|firebase-functions)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  bail: true, // Stop running tests after the first failure
};

module.exports = createJestConfig(customJestConfig);
