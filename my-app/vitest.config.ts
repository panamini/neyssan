import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
