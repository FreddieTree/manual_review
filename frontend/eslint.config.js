import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unicorn from 'eslint-plugin-unicorn';
import importPlugin from 'eslint-plugin-import';
import sortExports from 'eslint-plugin-sort-exports';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'build', '*.generated.*']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        React: 'readonly', // if used implicitly, but react-in-jsx-scope is off
      },
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: ['./tsconfig.json'], // if using TS; safe if missing
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      unicorn,
      import: importPlugin,
      'sort-exports': sortExports,
    },
    extends: [
      js.configs.recommended,
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:jsx-a11y/recommended',
      'plugin:unicorn/recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
    ],
    rules: {
      /***** Core adjustments *****/
      'react/react-in-jsx-scope': 'off', // new JSX transform
      'react/prop-types': 'off', // using TS or internal prop validation
      'consistent-return': 'error',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-implicit-coercion': ['warn', { boolean: false }],

      /***** Naming & style *****/
      'unicorn/prevent-abbreviations': 'off', // allow developer-friendly abbreviations
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'sort-exports/sort-exports': ['warn', { sortDir: 'asc', sortExportKind: true }],
      'import/order': [
        'error',
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
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': ['error', { ignore: ['\\$'] }], // adjust if aliases exist
      'import/no-duplicates': 'error',
      'import/newline-after-import': ['error', { count: 1 }],

      /***** React-specific *****/
      'react/self-closing-comp': 'warn',
      'react/jsx-props-no-spreading': 'off', // permissive but can narrow later
      'react/jsx-key': 'error',
      'react/function-component-definition': [
        'warn',
        {
          namedComponents: ['arrow-function', 'function-declaration'],
          unnamedComponents: ['arrow-function'],
        },
      ],

      /***** Hooks *****/
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useMyCustomHook)' }],

      /***** Accessibility *****/
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': [
        'warn',
        {
          required: {
            some: ['nesting', 'id'],
          },
        },
      ],

      /***** Import safety and clarity *****/
      'import/no-named-as-default': 'warn',
      'import/no-cycle': ['warn', { maxDepth: 4 }],

      /***** Unicorn improvements for consistency *****/
      'unicorn/consistent-function-scoping': 'off', // can conflict with custom hooks
      'unicorn/no-null': 'off', // nullable sometimes needed
      'unicorn/prefer-module': 'off', // using ESM already
      'unicorn/explicit-length-check': 'warn',

      /***** Variables / unused *****/
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]', // e.g., React components or constants
          args: 'after-used',
          ignoreRestSiblings: true,
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        // if using path aliases, add e.g. 'alias': { map: [['@', './src']], extensions: [...] }
      },
    },
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
          // allow explicit any sparingly but warn
          '@typescript-eslint/no-explicit-any': ['warn'],
        },
      },
      {
        files: ['*.config.js', '*.config.cjs'],
        rules: {
          'unicorn/no-process-exit': 'off', // config scripts may use process.exit
        },
      },
    ],
  },
]);