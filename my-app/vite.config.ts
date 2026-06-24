/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
  isLocalMcpDevEndpointHandledPath,
} from "./src/modules/local-mcp/localMcpDevEndpoint";

const LOCAL_CLERK_SYNC_PORT = 5173;
const LOCAL_MCP_DEV_ENDPOINT_FLAG = "LOCAL_MCP_DEV_ENDPOINT";
const LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG = "LOCAL_MCP_DEV_FIXTURE_DEMO";
const LOCAL_MCP_DEV_AUTH_POLICY_FLAG = "LOCAL_MCP_DEV_AUTH_POLICY";
const LOCAL_MCP_DEV_AUTH_RESOURCE_VAR = "LOCAL_MCP_DEV_AUTH_RESOURCE";
const LOCAL_MCP_DEV_AUTH_ISSUER_VAR = "LOCAL_MCP_DEV_AUTH_ISSUER";
const LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR = "LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT";
const LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR = "LOCAL_MCP_DEV_AUTH_CLIENT_ID";

function localMcpDevEndpointPlugin(): Plugin | undefined {
  if (!isStrictEnabledFlag(LOCAL_MCP_DEV_ENDPOINT_FLAG)) return undefined;
  const fixtureDemoEnabled = isStrictEnabledFlag(LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG);
  const authPolicyEnabled = fixtureDemoEnabled && isStrictEnabledFlag(LOCAL_MCP_DEV_AUTH_POLICY_FLAG);
  const config = buildLocalMcpDevEndpointConfig({
    enabled: true,
    fixtureDemoEnabled,
    authPolicyEnabled,
    auth: authPolicyEnabled ? readLocalMcpDevAuthConfigInput() : undefined,
  });

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
  if (!isLocalMcpDevEndpointHandledPath(pathName)) {
    next();
    return;
  }
  readLocalMcpDevBody(req, res, config.maxRequestBytes, (bodyText) => {
    void respondToLocalMcpDevRequest(req, res, next, config, pathName, bodyText).catch(() => {
      sendInvalidLocalMcpDevRequest(res);
    });
  });
}

async function respondToLocalMcpDevRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ReturnType<typeof buildLocalMcpDevEndpointConfig>,
  pathName: string,
  bodyText: string,
): Promise<void> {
  const response = await handleLocalMcpDevEndpointRequest(
    {
      method: req.method ?? "GET",
      path: pathName,
      headers: {
        host: headerValue(req.headers.host),
        "content-type": headerValue(req.headers["content-type"]),
        authorization: req.headers.authorization,
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
    error: {
      code: -32700,
      message: "Invalid local dev MCP request.",
      safeForModel: true,
      fixtureOnly: true,
      localDevOnly: true,
    },
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
  if (status === 202 && json === null) {
    res.end();
    return;
  }
  res.end(JSON.stringify(json));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readLocalMcpDevAuthConfigInput(): Readonly<{
  resourceUrl?: string;
  authorizationServerIssuerUrl?: string;
  providerEnvironment?: string;
  allowedClientIds?: readonly string[];
}> {
  const clientId = process.env[LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR]?.trim();
  return {
    resourceUrl: process.env[LOCAL_MCP_DEV_AUTH_RESOURCE_VAR],
    authorizationServerIssuerUrl: process.env[LOCAL_MCP_DEV_AUTH_ISSUER_VAR],
    providerEnvironment: process.env[LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR],
    allowedClientIds: clientId ? [clientId] : [],
  };
}

function isStrictEnabledFlag(name: string): boolean {
  return process.env[name] === "1";
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
