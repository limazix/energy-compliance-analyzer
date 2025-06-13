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
    // Force 'jose' to resolve to its CommonJS variant for Node.js environment in tests.
    // This path assumes 'jose' is installed within 'functions/node_modules'.
    // Adjust if 'jose' is hoisted to the root 'node_modules' or has a different CJS path structure.
    '^jose$': '<rootDir>/functions/node_modules/jose/dist/node/cjs/index.js',
    // The entry for 'lucide-react' is handled by its mock in jest/mocks/ui-components.setup.ts
  },
  transformIgnorePatterns: [
    // This pattern tells Jest to NOT ignore (i.e., to transform) the listed packages if they are in node_modules.
    // 'jose' is removed from this list because it's being handled by moduleNameMapper.
    // This regex should match 'node_modules/' or 'functions/node_modules/' followed by packages NOT in the list.
    // "/node_modules/(?!(" + packagesToTransform.join("|") + ")/)"
    '[/\\\\]node_modules[/\\\\](?!(next-mdx-remote|react-tweet|styled-jsx|next|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$', // Keep this for CSS modules
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  bail: true, // Stop running tests after the first failure
};

module.exports = createJestConfig(customJestConfig);
