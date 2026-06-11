import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Determinism guard: no Math.random in any physics-affecting code (PRD §6).
    files: ['src/engine/**', 'src/parts/**', 'src/levels/**', 'src/util/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is forbidden in simulation code. Use util/prng (seeded).',
        },
      ],
    },
  },
);
