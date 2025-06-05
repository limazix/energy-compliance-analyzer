
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
  transformIgnorePatterns: [
    // Este padrão agora inclui next-mdx-remote e muitas de suas dependências ESM comuns,
    // além dos padrões que o Next.js normalmente transforma.
    '/node_modules/(?!(next-mdx-remote|@mdx-js/.+|unified|remark-.+|rehype-.+|unist-util-.+|vfile.*|micromark.*|mdast-util-.+|estree-util-.+|character-entities|bail|trough|ccount|react-tweet|styled-jsx|next)/)',
    // Mantém o padrão para módulos CSS
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
