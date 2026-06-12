/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from "node:http";
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
        handleLocalMcpDevMiddlewareRequest(req, res, next, config);
      });
    },
  };
}

function handleLocalMcpDevMiddlewareRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ReturnType<typeof buildLocalMcpDevEndpointConfig>,
): void {
  const pathName = (req.url ?? "").split("?")[0];
  if (pathName !== config.endpointPath) {
    next();
    return;
  }
  readLocalMcpDevBody(req, res, config.maxRequestBytes, (bodyText) => {
    respondToLocalMcpDevRequest(req, res, next, config, pathName, bodyText);
  });
}

function respondToLocalMcpDevRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ReturnType<typeof buildLocalMcpDevEndpointConfig>,
  pathName: string,
  bodyText: string,
): void {
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
  sendLocalMcpJson(res, response.status, response.json, response.headers);
}

function readLocalMcpDevBody(
  req: IncomingMessage,
  res: ServerResponse,
  maxRequestBytes: number,
  onBody: (bodyText: string) => void,
): void {
  let bodyText = "";
  let rejectedForSize = false;
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    if (rejectedForSize) return;
    bodyText += chunk;
    rejectedForSize = rejectIfLocalMcpDevBodyTooLarge(req, res, bodyText, maxRequestBytes);
  });
  req.on("end", () => {
    if (!rejectedForSize && !res.writableEnded) onBody(bodyText);
  });
  req.on("error", () => {
    sendInvalidLocalMcpDevRequest(res);
  });
}

function rejectIfLocalMcpDevBodyTooLarge(
  req: IncomingMessage,
  res: ServerResponse,
  bodyText: string,
  maxRequestBytes: number,
): boolean {
  if (Buffer.byteLength(bodyText, "utf8") <= maxRequestBytes) return false;
  sendLocalMcpJson(res, 413, {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32013,
      message: "Local dev MCP endpoint request is too large.",
      safeForModel: true,
      fixtureOnly: true,
      localDevOnly: true,
    },
  });
  req.destroy();
  return true;
}

function sendInvalidLocalMcpDevRequest(res: ServerResponse): void {
  if (res.writableEnded) return;
  sendLocalMcpJson(res, 400, {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Invalid local dev MCP request." },
  });
}

function sendLocalMcpJson(
  res: ServerResponse,
  status: number,
  json: unknown,
  headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(json));
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
