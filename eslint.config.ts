// NOTE: ESLint v9+ is required for TypeScript flat config support.
// If you encounter config loading errors, upgrade ESLint to ^9.0.0 or later.

import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from 'eslint-plugin-react';

import type { FlatConfigItem } from 'eslint';

const config: FlatConfigItem[] = [
  {
    // root: true, // removed for flat config compatibility
    // Ignores from .eslintignore and build folders:
    ignores: [
      'node_modules',
      '.next',
      './.next',
      '**/.next/**',
      'out',
      './out',
      '**/out/**',
      'build',
      './build',
      '**/build/**',
      'coverage',
      './coverage',
      '**/coverage/**',
      'public',
      './public',
      '**/public/**',
      'functions/lib',
      './functions/lib',
      '**/functions/lib/**',
      'functions/node_modules',
      './functions/node_modules',
      '**/functions/node_modules/**',
      'docs_html',
      './docs_html',
      '**/docs_html/**',
      'firebase-emulator-data',
      './firebase-emulator-data',
      '**/firebase-emulator-data/**',
      'next-env.d.ts',
      './next-env.d.ts',
      'src/components/ui/',
      './src/components/ui/',
      '**/src/components/ui/**',
      // Add other specific files or build artifacts if needed
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      react: reactPlugin,
      'jsx-a11y': jsxA11yPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json', './functions/tsconfig.json'],
        },
        node: true,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
            { pattern: '@/**', group: 'internal' },
            {
              pattern: '@functions/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'no-console': ['warn', { allow: ['info', 'warn', 'error', 'debug'] }],
    },
  },
  {
    files: ['*.ts', '*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './functions/tsconfig.json'],
      },
    },
  },
  {
    files: ['*.js', '*.jsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['jest.config.ts', 'next.config.mjs', 'tailwind.config.ts', 'postcss.config.js'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];

export default config;
