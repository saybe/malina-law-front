import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'public/**', '.check-out/**', '.smoke-out/**', 'node_modules/**'],
  },

  js.configs.recommended,

  // scripts/*.mjs — обычный Node. TypeScript к ним не применяется: fetch.mjs
  // обязан оставаться скриптом на голой стандартной библиотеке.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  ...tseslint.configs.recommended,

  // Правила React Hooks и type-aware правила — только для src/.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/error-boundaries': 'error',
      'react-hooks/config': 'error',
      'react-hooks/gating': 'error',

      // Загрузка данных — это setState внутри useEffect. Так устроен любой
      // асинхронный старт приложения, запрещать его нельзя, но помечать
      // полезно: правило остаётся предупреждением, а не ошибкой сборки.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
)
