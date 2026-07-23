import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'dev-dist', 'release', 'node_modules', 'android/**', 'public/workbox-*.js', 'workbox-*.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-throw-literal': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-return': 'error',
      'prefer-template': 'error',
      'object-shorthand': ['error', 'properties'],
      'no-restricted-syntax': ['warn', {
        selector: "CallExpression[callee.object.name='frontendEventBus'][callee.property.name='publish'][arguments.0.value='message_show']",
        message: 'Use `message.*` from `@/utils/messageHelper` instead of `frontendEventBus.publish("message_show", ...)`.',
      }, {
        selector: "CallExpression[callee.object.name='frontendEventBus'][callee.property.name='publish'][arguments.0.value='message_hide']",
        message: 'Use `message.dismiss(id)` from `@/utils/messageHelper` instead of `frontendEventBus.publish("message_hide", ...)`.',
      }],
    },
  },
  {
    files: ['test-*.ts', 'vite.config.ts', 'src/utils/serviceWorker.ts', 'src/utils/performance.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // R28: messageHelper 与 MessageBar 是 toast 系统底层，允许直接 publish
    files: [
      'src/utils/messageHelper.ts',
      'src/components/common/MessageBar.tsx',
      'src/components/common/__tests__/MessageBar.test.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // E2E tests use Playwright fixtures whose `use` callback collides with
    // React 19's `use` hook in eslint-plugin-react-hooks. Playwright tests
    // don't use React hooks at all, so disable the plugin here.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-empty-pattern': 'off',
    },
  },
  {
    // R31: Test files use `as any` casts for mock factories and partial
    // test fixtures. Exempt them from the strict `no-explicit-any` rule
    // (now `error`) so CI does not block test authoring.
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
