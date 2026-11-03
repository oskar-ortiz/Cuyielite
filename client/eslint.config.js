import ionic from '@ionic/eslint-config/recommended.js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'android/**',
      'ios/**',
      'electron/node_modules/**',
      'electron/build/**',
      'electron/dist/**',
      'electron/app/**',
      'electron/generated/**',
      'electron/vendor/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
    ],
  },
  ionic,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Electron main process and build config run in Node, not in the browser.
    files: ['electron/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
