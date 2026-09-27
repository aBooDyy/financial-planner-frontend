//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

const stylistic = tanstackConfig.find((c) => c.plugins?.['@stylistic'])
  ?.plugins['@stylistic']

export default [
  ...tanstackConfig,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      // `/*! … */` is the legal-comment marker minifiers keep; the vendored Phosphor
      // licence banner depends on surviving verbatim.
      '@stylistic/spaced-comment': ['error', 'always', { markers: ['!'] }],
    },
  },
  {
    // The built-in catalog is the seed and the fallback, not a source of truth. Every other
    // surface reads the resolved catalog, or it can disagree with the picker next to it.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '#/features/categories/data/defaults',
                '**/features/categories/data/defaults',
                '../data/defaults',
                './data/defaults',
              ],
              message:
                'Read the resolved catalog instead: useCategoryCatalog() in a component, or a CategoryCatalog param in a pure function. Only features/categories may import defaults.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/categories/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js', '.wrangler/**'],
  },
]
