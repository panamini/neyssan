/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const LOCAL_CLERK_SYNC_PORT = 5173;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: LOCAL_CLERK_SYNC_PORT,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: LOCAL_CLERK_SYNC_PORT,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/setupTests.ts"],
  },
});
