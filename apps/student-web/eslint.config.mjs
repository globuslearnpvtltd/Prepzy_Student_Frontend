import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', '.next-e2e/**', '.next-agents/**', 'visual-output/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Exams are described once in src/shared/config/exams.ts; never compare slugs inline.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'BinaryExpression[operator=/^[!=]==$/] > Literal[value=/^(cbse|jac|neet|neet-ug)$/i]',
          message: 'Do not compare exam slugs inline. Use the exam registry (src/shared/config/exams.ts).',
        },
        {
          selector: 'Literal[value=/(bg|text|border)-\\[#/]',
          message: 'Use design tokens from design.config.ts instead of arbitrary hex colours.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use apiClient from @/shared/lib/api-client (native fetch).' }],
          patterns: [
            {
              group: ['@/features/*/*', '!@/features/*/ui'],
              message: "Import a feature through '@/features/<name>' (logic) or '@/features/<name>/ui' (screens).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/lib/api-client.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default config;
