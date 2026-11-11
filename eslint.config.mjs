import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', '.wrangler/**', 'worker-configuration.d.ts', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // The two rules that need types: a promise nobody awaits. In the Worker a
  // forgotten `await` is a write that may never land (the isolate can stop
  // once the response is out), and no untyped rule sees it. Both tsconfigs:
  // the app's leaves out src/ and tests/worker, the Worker's has them. A
  // deliberate fire-and-forget is marked `void`, not disabled. JSX handlers
  // (`onClick={async …}`) are exempt: React ignores what they return.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.worker.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
]

export default config
