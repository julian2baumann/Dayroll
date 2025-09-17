import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jestDom from 'eslint-plugin-jest-dom'
import testingLibrary from 'eslint-plugin-testing-library'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url))

export default tseslint.config([
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'node_modules'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'testing-library': testingLibrary,
      'jest-dom': jestDom,
    },
    rules: {
      'jest-dom/prefer-checked': 'warn',
      'jest-dom/prefer-enabled-disabled': 'warn',
      'testing-library/no-await-sync-events': 'error',
      'testing-library/prefer-screen-queries': 'error',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    rules: {
      'testing-library/render-result-naming-convention': 'off',
    },
  },
  {
    files: ['**/*.config.{js,ts}', '**/*.config.{cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'testing-library/no-await-sync-events': 'off',
      'testing-library/prefer-screen-queries': 'off',
      'jest-dom/prefer-checked': 'off',
      'jest-dom/prefer-enabled-disabled': 'off',
    },
  },
])
