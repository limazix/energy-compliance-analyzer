
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Remove explicit transform to ts-jest, next/jest handles transformation with SWC
  // transform: {
  //   '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  // },
  transformIgnorePatterns: [
    // Default Next.js pattern ignores node_modules, but we need to transform next-mdx-remote
    // This pattern tells Jest to transform files in node_modules/next-mdx-remote/
    // All other node_modules will still be ignored.
    '/node_modules/(?!next-mdx-remote)/',
    // You might also need to keep the default pattern for CSS modules if you use them extensively
    // and they were being ignored by a broader /node_modules/ pattern.
    // However, next/jest often handles CSS module mocking or transformation.
    // '^.+\\.module\\.(css|sass|scss)$', 
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
