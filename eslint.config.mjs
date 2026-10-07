import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.cjs', 'server.js'],
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
      'no-restricted-syntax': [
        'error',
        ...['Literal', 'JSXExpressionContainer > Literal', 'JSXExpressionContainer > TemplateLiteral'].map((node) => ({
          selector: `JSXAttribute[name.name=/^(aria-label|aria-description|placeholder|alt|title)$/] > ${node}`,
          message: 'Texto visible o accesible escrito en el código: va en messages/es.json, pt.json y en.json.',
        })),
      ],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'site/**', '_site/**', 'next-env.d.ts'],
  },
];

export default config;
