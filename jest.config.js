const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  coverageProvider: 'v8',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  // Point Jest to the new root directory for tests
  roots: ['<rootDir>/tests'],
  // Test match patterns can be more specific if needed, but `roots` often suffices.
  // Example if you want to be very explicit:
  // testMatch: [
  //   '<rootDir>/tests/unit/frontend/**/*.test.[jt]s?(x)',
  //   '<rootDir>/tests/unit/backend/**/*.test.[jt]s?(x)',
  //   '<rootDir>/tests/integration/**/*.test.[jt]s?(x)',
  // ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Force 'jose' to resolve to its CommonJS variant for Node.js environment in tests.
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js', // Adjusted path assumption
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\](?!(next-mdx-remote|react-tweet|styled-jsx|next|jwks-rsa|firebase-admin|firebase-functions|@genkit-ai|zod)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  clearMocks: true,
  bail: true,
};

module.exports = createJestConfig(customJestConfig);
