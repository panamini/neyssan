import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/Users/pana/Documents/GitHub/neyssan/my-app/src",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    threads: false,
    isolate: true,
    hookTimeout: 8000,
    testTimeout: 10000,
    setupFiles: ["./src/setupTests.ts", "./src/test/setup.ts"],
    env: {
      VITE_PDF_INGEST_URL: "http://localhost:8000",
      VITE_V1_SECTIONS: "1",
      TEST_DEBOUNCE_MS: "0",
    },
  },
});
