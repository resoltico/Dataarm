import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const strictRuntimeRules = {
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-debugger': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
};

const typeCheckedConfigs = tseslint.configs.strictTypeChecked.map((config) => ({
  ...config,
  files: ['**/*.{ts,tsx,mts,cts}'],
}));

export default tseslint.config(
  {
    ignores: ['.DS_Store', '*.tsbuildinfo', 'coverage/**', 'node_modules/**', 'vendor/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...strictRuntimeRules,
      'no-console': 'off',
    },
  },
  ...typeCheckedConfigs,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        project: [
          './tsconfig.app.json',
          './tsconfig.node.json',
          './tsconfig.tests.json',
          './tsconfig.eslint.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...strictRuntimeRules,
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'error',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
