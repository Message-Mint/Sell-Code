// eslint.config.js
const { defineConfig } = require('eslint-define-config');

module.exports = defineConfig([
    {
        files: ['*.ts', '*.tsx'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
            // Disallow unused variables
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            // Disallow empty functions
            '@typescript-eslint/no-empty-function': 'error',
            // Require explicit return types on functions
            '@typescript-eslint/explicit-function-return-type': ['warn', {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            }],
            // Disallow the use of 'any' type
            '@typescript-eslint/no-explicit-any': 'warn',
            // Disallow unnecessary semicolons
            'no-extra-semi': 'error',
            // Enforce consistent spacing inside braces
            'object-curly-spacing': ['error', 'always'],
            // Enforce consistent line breaks after function definition
            'lines-between-class-members': ['error', 'always'],
            // Enforce consistent spacing around operators
            'space-infix-ops': 'error',
            // Require trailing commas where valid in ES5 (objects, arrays, etc.)
            'comma-dangle': ['error', 'always-multiline'],
        },
    },
]);
