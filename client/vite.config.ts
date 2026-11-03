import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // The legacy build injects inline scripts and a `data:` URL feature test,
  // which the Electron platform's strict CSP blocks. Electron ships a modern
  // Chromium, so the legacy polyfills are only needed for the web/Android build.
  plugins: mode === 'electron' ? [react()] : [react(), legacy()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Playwright e2e specs live in e2e/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
