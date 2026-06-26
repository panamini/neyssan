/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import {
  buildLocalMcpDevAuthRuntimeCompositionDependencies,
  LOCAL_MCP_DEV_STYTCH_COMPOSITION_FLAG,
  LOCAL_MCP_DEV_STYTCH_JWKS_JSON_VAR,
} from "./src/modules/local-mcp/localMcpDevAuthRuntimeComposition";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequestAsync,
  isLocalMcpDevEndpointHandledPath,
  type LocalMcpDevEndpointDependenciesV1,
} from "./src/modules/local-mcp/localMcpDevEndpoint";
import {
  buildMcpOAuthLocalDevRouteAdapterConfig,
  handleMcpOAuthLocalDevRouteRequest,
  isMcpOAuthLocalDevRouteHandledPath,
  LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG,
  LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR,
  type McpOAuthLocalDevRouteAdapterConfigV1,
  type McpOAuthLocalDevRouteAdapterDependenciesV1,
} from "./src/modules/local-mcp/mcpOAuthLocalDevRouteAdapter";

const LOCAL_CLERK_SYNC_PORT = 5173;
const LOCAL_MCP_DEV_ENDPOINT_FLAG = "LOCAL_MCP_DEV_ENDPOINT";
const LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG = "LOCAL_MCP_DEV_FIXTURE_DEMO";
const LOCAL_MCP_DEV_AUTH_POLICY_FLAG = "LOCAL_MCP_DEV_AUTH_POLICY";
const LOCAL_MCP_DEV_AUTH_RESOURCE_VAR = "LOCAL_MCP_DEV_AUTH_RESOURCE";
const LOCAL_MCP_DEV_AUTH_ISSUER_VAR = "LOCAL_MCP_DEV_AUTH_ISSUER";
const LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR = "LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT";
const LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR = "LOCAL_MCP_DEV_AUTH_CLIENT_ID";

export type LocalMcpDevEndpointPluginOptions = Readonly<{
  env?: Readonly<Record<string, string | undefined>>;
  endpointDependencies?: LocalMcpDevEndpointDependenciesV1;
  oauthAuthorizationConfig?: McpOAuthLocalDevRouteAdapterConfigV1;
  oauthAuthorizationDependencies?: McpOAuthLocalDevRouteAdapterDependenciesV1;
}>;

export function createLocalMcpDevEndpointPlugin(
  options: LocalMcpDevEndpointPluginOptions = {},
): Plugin | undefined {
  const env = options.env ?? process.env;
  const endpointEnabled = isStrictEnabledFlag(env, LOCAL_MCP_DEV_ENDPOINT_FLAG);
  const oauthAuthorizationEnabled = isStrictEnabledFlag(env, LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG);
  if (!endpointEnabled && !oauthAuthorizationEnabled) return undefined;
  const fixtureDemoEnabled = endpointEnabled && isStrictEnabledFlag(env, LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG);
  const authPolicyEnabled = endpointEnabled && fixtureDemoEnabled && isStrictEnabledFlag(env, LOCAL_MCP_DEV_AUTH_POLICY_FLAG);
  const authConfigInput = authPolicyEnabled ? readLocalMcpDevAuthConfigInput(env) : undefined;
  const config = buildLocalMcpDevEndpointConfig({
    enabled: endpointEnabled,
    fixtureDemoEnabled,
    authPolicyEnabled,
    auth: authConfigInput,
  });
  const composition = buildLocalMcpDevAuthRuntimeCompositionDependencies({
    endpointEnabled: true,
    fixtureDemoEnabled,
    authPolicyEnabled,
    compositionEnabled: isStrictEnabledFlag(env, LOCAL_MCP_DEV_STYTCH_COMPOSITION_FLAG),
    authConfigInput,
    jwksJson: env[LOCAL_MCP_DEV_STYTCH_JWKS_JSON_VAR],
  });
  if (composition.reason !== "disabled" && !composition.enabled) {
    throw new TypeError(
      `Local MCP dev Stytch composition configuration is invalid (${composition.reason}).`,
    );
  }
  const endpointDependencies = Object.freeze({
    ...(composition.enabled ? composition.dependencies : {}),
    ...(options.endpointDependencies ?? {}),
  });
  const oauthAuthorizationConfig = options.oauthAuthorizationConfig ?? buildMcpOAuthLocalDevRouteAdapterConfig({
    enabled: oauthAuthorizationEnabled,
    ...readLocalMcpDevOAuthConfigInput(env),
  });
  const oauthAuthorizationDependencies = options.oauthAuthorizationDependencies ?? {};

  return {
    name: "twoweeks-local-mcp-dev-endpoint",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleLocalMcpDevMiddlewareRequest(
          req,
          res,
          next,
          config,
          endpointDependencies,
          oauthAuthorizationConfig,
          oauthAuthorizationDependencies,
        );
      });
    },
  };
}

function handleLocalMcpDevMiddlewareRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ReturnType<typeof buildLocalMcpDevEndpointConfig>,
  dependencies: LocalMcpDevEndpointDependenciesV1,
  oauthAuthorizationConfig: McpOAuthLocalDevRouteAdapterConfigV1,
  oauthAuthorizationDependencies: McpOAuthLocalDevRouteAdapterDependenciesV1,
): void {
  const pathName = (req.url ?? "").split("?")[0];
  if (isMcpOAuthLocalDevRouteHandledPath(pathName)) {
    void respondToMcpOAuthLocalDevRouteRequest(
      req,
      res,
      next,
      oauthAuthorizationConfig,
      oauthAuthorizationDependencies,
      pathName,
    ).catch(() => {
      sendInvalidLocalMcpDevRequest(res);
    });
    return;
  }
  if (!isLocalMcpDevEndpointHandledPath(pathName)) {
    next();
    return;
  }
  readLocalMcpDevBody(req, res, config.maxRequestBytes, (bodyText) => {
    void respondToLocalMcpDevRequest(req, res, next, config, dependencies, pathName, bodyText).catch(() => {
      sendInvalidLocalMcpDevRequest(res);
    });
  });
}

async function respondToMcpOAuthLocalDevRouteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
  dependencies: McpOAuthLocalDevRouteAdapterDependenciesV1,
  pathName: string,
): Promise<void> {
  const response = await handleMcpOAuthLocalDevRouteRequest(
    {
      method: req.method ?? "GET",
      path: pathName,
      url: req.url ?? pathName,
      headers: {
        host: headerValue(req.headers.host),
      },
    },
    config,
    dependencies,
  );
  if (!response.handled) {
    next();
    return;
  }
  sendLocalMcpRouteResponse(res, response.status, response.headers, response.json, response.bodyText);
}

async function respondToLocalMcpDevRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ReturnType<typeof buildLocalMcpDevEndpointConfig>,
  dependencies: LocalMcpDevEndpointDependenciesV1,
  pathName: string,
  bodyText: string,
): Promise<void> {
  const response = await handleLocalMcpDevEndpointRequestAsync(
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
    dependencies,
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

function sendLocalMcpRouteResponse(
  res: ServerResponse,
  status: number,
  headers: Readonly<Record<string, string>>,
  json: unknown,
  bodyText: string | undefined,
): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  if (json !== undefined) {
    res.end(JSON.stringify(json));
    return;
  }
  res.end(bodyText ?? "");
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readLocalMcpDevAuthConfigInput(env: Readonly<Record<string, string | undefined>>): Readonly<{
  resourceUrl?: string;
  authorizationServerIssuerUrl?: string;
  providerEnvironment?: string;
  allowedClientIds?: readonly string[];
}> {
  const clientId = env[LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR]?.trim();
  return {
    resourceUrl: env[LOCAL_MCP_DEV_AUTH_RESOURCE_VAR],
    authorizationServerIssuerUrl: env[LOCAL_MCP_DEV_AUTH_ISSUER_VAR],
    providerEnvironment: env[LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR],
    allowedClientIds: clientId ? [clientId] : [],
  };
}

function readLocalMcpDevOAuthConfigInput(env: Readonly<Record<string, string | undefined>>): Readonly<{
  applicationOrigin?: string;
  canonicalResource?: string;
  allowedRedirectUris?: readonly string[];
  allowedClientIds?: readonly string[];
}> {
  const clientId = env[LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR]?.trim();
  return {
    applicationOrigin: env[LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR],
    canonicalResource: env[LOCAL_MCP_DEV_AUTH_RESOURCE_VAR],
    allowedRedirectUris: readCommaSeparatedEnv(env[LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]),
    allowedClientIds: clientId ? [clientId] : [],
  };
}

function readCommaSeparatedEnv(value: string | undefined): readonly string[] {
  return Object.freeze(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function isStrictEnabledFlag(env: Readonly<Record<string, string | undefined>>, name: string): boolean {
  return env[name] === "1";
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react(), createLocalMcpDevEndpointPlugin()].filter((plugin): plugin is Plugin => plugin !== undefined),
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
}));
