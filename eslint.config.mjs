import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: ['·', ':', '▲', '▼', '⇅', '(', ')', '/', '-', '—'] },
      ],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'site/**', '_site/**', 'next-env.d.ts'],
  },
];

export default config;
