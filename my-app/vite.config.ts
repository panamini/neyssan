/// <reference types="vitest" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
} from "./src/modules/local-mcp/localMcpDevEndpoint";

const LOCAL_CLERK_SYNC_PORT = 5173;
const LOCAL_MCP_DEV_ENDPOINT_FLAG = "LOCAL_MCP_DEV_ENDPOINT";

function localMcpDevEndpointPlugin(): Plugin | undefined {
  if (process.env[LOCAL_MCP_DEV_ENDPOINT_FLAG] !== "1") return undefined;
  const config = buildLocalMcpDevEndpointConfig({ enabled: true });

  return {
    name: "twoweeks-local-mcp-dev-endpoint",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathName = (req.url ?? "").split("?")[0];
        if (pathName !== config.endpointPath) {
          next();
          return;
        }

        let bodyText = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          bodyText += chunk;
        });
        req.on("end", () => {
          const response = handleLocalMcpDevEndpointRequest(
            {
              method: req.method ?? "GET",
              path: pathName,
              headers: {
                host: headerValue(req.headers.host),
                "content-type": headerValue(req.headers["content-type"]),
              },
              remoteAddress: req.socket.remoteAddress,
              bodyText,
            },
            config,
          );

          if (!response.handled) {
            next();
            return;
          }

          res.statusCode = response.status;
          for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
          }
          res.end(JSON.stringify(response.json));
        });
        req.on("error", () => {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid local dev MCP request." } }));
        });
      });
    },
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localMcpDevEndpointPlugin()].filter((plugin): plugin is Plugin => plugin !== undefined),
  server: {
    host: "localhost",
    port: LOCAL_CLERK_SYNC_PORT,
    strictPort: true,
    allowedHosts: ["host.docker.internal"],
  },
  preview: {
    host: "localhost",
    port: LOCAL_CLERK_SYNC_PORT,
    strictPort: true,
    allowedHosts: ["host.docker.internal"],
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
