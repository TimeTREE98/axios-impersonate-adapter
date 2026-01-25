const { defineConfig } = require('eslint/config');
const tsParser = require('@typescript-eslint/parser');
const eslintConfigPrettier = require('eslint-config-prettier/flat');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const sortImportsRequires = require('eslint-plugin-sort-imports-requires');

module.exports = defineConfig([
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-console': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'script',
    },
    plugins: {
      'sort-imports-requires': sortImportsRequires,
    },
    rules: {
      'sort-imports-requires/sort-requires': ['error', { unsafeAutofix: true }],
    },
  },
  eslintConfigPrettier,
]);
