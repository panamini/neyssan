// vite.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';


export default defineConfig({
plugins: [react()],
resolve: {
alias: {
'@': path.resolve(__dirname, './src'),
},
},
test: {
globals: true,
environment: 'jsdom',
setupFiles: './src/setupTests.ts',
env: {
  VITE_PDF_INGEST_URL: 'http://localhost:8000',
  VITE_V1_SECTIONS: '1',
  // Ensure debounced saves or editor timers do not keep the event loop alive in tests
  TEST_DEBOUNCE_MS: '0',
},
testTimeout: 15000,
hookTimeout: 15000,
// Helpful during debugging; uncomment to surface unhandled requests
// server: { deps: { inline: ['msw'] } },
},
});