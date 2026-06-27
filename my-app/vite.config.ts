/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
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
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./src/modules/local-mcp/mcpAuthPolicyBoundary";
import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
} from "./src/modules/local-mcp/mcpOAuthProductionActivationBoundary";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  handleMcpOAuthProductionRouteRequest,
  isMcpOAuthProductionRouteHandledPath,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  type McpOAuthProductionRouteAdapterConfigV1,
  type McpOAuthProductionRouteAdapterDependenciesV1,
} from "./src/modules/local-mcp/mcpOAuthProductionRouteAdapter";
import { MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG } from "./src/modules/local-mcp/mcpOAuthProductionRoutePreflightBoundary";

const LOCAL_CLERK_SYNC_PORT = 5173;
const LOCAL_MCP_DEV_ENDPOINT_FLAG = "LOCAL_MCP_DEV_ENDPOINT";
const LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG = "LOCAL_MCP_DEV_FIXTURE_DEMO";
const LOCAL_MCP_DEV_AUTH_POLICY_FLAG = "LOCAL_MCP_DEV_AUTH_POLICY";
const LOCAL_MCP_DEV_AUTH_RESOURCE_VAR = "LOCAL_MCP_DEV_AUTH_RESOURCE";
const LOCAL_MCP_DEV_AUTH_ISSUER_VAR = "LOCAL_MCP_DEV_AUTH_ISSUER";
const LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR = "LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT";
const LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR = "LOCAL_MCP_DEV_AUTH_CLIENT_ID";
const MCP_OAUTH_PRODUCTION_RESOURCE_VAR = "MCP_OAUTH_PRODUCTION_RESOURCE";
const MCP_OAUTH_PRODUCTION_ISSUER_VAR = "MCP_OAUTH_PRODUCTION_ISSUER";
const MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT_VAR = "MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT";
const MCP_OAUTH_PRODUCTION_CLIENT_IDS_VAR = "MCP_OAUTH_PRODUCTION_CLIENT_IDS";
const MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN_VAR = "MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN";
const MCP_OAUTH_PRODUCTION_REDIRECT_URIS_VAR = "MCP_OAUTH_PRODUCTION_REDIRECT_URIS";
const CONVEX_KEY_VAR = "CONVEX_KEY";
const CONVEX_AUTH_TOKEN_VAR = "CONVEX_AUTH_TOKEN";
const CONVEX_URL_VAR = "CONVEX_URL";
const VITE_CONVEX_URL_VAR = "VITE_CONVEX_URL";
const NEXT_PUBLIC_CONVEX_URL_VAR = "NEXT_PUBLIC_CONVEX_URL";
const PRE_AUTH_QUOTA_WINDOW_MS = 60_000;
const PRE_AUTH_QUOTA_LIMIT = 60;
const DEFAULT_VITE_ALLOWED_HOSTS = Object.freeze(["host.docker.internal"]);
const CREATE_MCP_OAUTH_PRE_AUTH_INTENT_MUTATION = makeFunctionReference(
  "mcpOAuthPreAuthIntents:internalCreateMcpOAuthPreAuthIntent",
);
const productionPreAuthQuotaBuckets = new Map<string, { count: number; windowStartedAt: number }>();

export type LocalMcpDevEndpointPluginOptions = Readonly<{
  env?: Readonly<Record<string, string | undefined>>;
  endpointDependencies?: LocalMcpDevEndpointDependenciesV1;
  oauthAuthorizationConfig?: McpOAuthLocalDevRouteAdapterConfigV1;
  oauthAuthorizationDependencies?: McpOAuthLocalDevRouteAdapterDependenciesV1;
  productionOAuthAuthorizationConfig?: McpOAuthProductionRouteAdapterConfigV1;
  productionOAuthAuthorizationDependencies?: McpOAuthProductionRouteAdapterDependenciesV1;
}>;

export function createLocalMcpDevEndpointPlugin(
  options: LocalMcpDevEndpointPluginOptions = {},
): Plugin | undefined {
  const env = options.env ?? process.env;
  const endpointEnabled = isStrictEnabledFlag(env, LOCAL_MCP_DEV_ENDPOINT_FLAG);
  const oauthAuthorizationEnabled = isStrictEnabledFlag(env, LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG);
  const productionOAuthAuthorizationEnabled =
    isStrictEnabledFlag(env, MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG) ||
    options.productionOAuthAuthorizationConfig !== undefined;
  if (!endpointEnabled && !oauthAuthorizationEnabled && !productionOAuthAuthorizationEnabled) return undefined;
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
  const productionOAuthAuthorizationConfig =
    options.productionOAuthAuthorizationConfig ??
    buildMcpOAuthProductionRouteAdapterConfig(readProductionMcpOAuthConfigInput(env));
  const productionOAuthAuthorizationDependencies =
    options.productionOAuthAuthorizationDependencies ??
    buildProductionMcpOAuthRouteDependencies(env);

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    handleLocalMcpDevMiddlewareRequest(
      req,
      res,
      next,
      config,
      endpointDependencies,
      oauthAuthorizationConfig,
      oauthAuthorizationDependencies,
      productionOAuthAuthorizationEnabled,
      productionOAuthAuthorizationConfig,
      productionOAuthAuthorizationDependencies,
    );
  };

  return {
    name: "twoweeks-local-mcp-dev-endpoint",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
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
  productionOAuthAuthorizationEnabled: boolean,
  productionOAuthAuthorizationConfig: McpOAuthProductionRouteAdapterConfigV1,
  productionOAuthAuthorizationDependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): void {
  const pathName = (req.url ?? "").split("?")[0];
  if (productionOAuthAuthorizationEnabled && pathName === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH) {
    void respondToMcpOAuthProductionRouteRequest(
      req,
      res,
      next,
      productionOAuthAuthorizationConfig,
      productionOAuthAuthorizationDependencies,
      pathName,
    ).catch(() => {
      sendInvalidLocalMcpDevRequest(res);
    });
    return;
  }
  if (oauthAuthorizationConfig.enabled && isMcpOAuthLocalDevRouteHandledPath(pathName)) {
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
  if (config.enabled && isLocalMcpDevEndpointHandledPath(pathName)) {
    readLocalMcpDevBody(req, res, config.maxRequestBytes, (bodyText) => {
      void respondToLocalMcpDevRequest(req, res, next, config, dependencies, pathName, bodyText).catch(() => {
        sendInvalidLocalMcpDevRequest(res);
      });
    });
    return;
  }
  if (productionOAuthAuthorizationEnabled && isMcpOAuthProductionRouteHandledPath(pathName)) {
    void respondToMcpOAuthProductionRouteRequest(
      req,
      res,
      next,
      productionOAuthAuthorizationConfig,
      productionOAuthAuthorizationDependencies,
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
  next();
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

async function respondToMcpOAuthProductionRouteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  pathName: string,
): Promise<void> {
  const response = await handleMcpOAuthProductionRouteRequest(
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

function readProductionMcpOAuthConfigInput(env: Readonly<Record<string, string | undefined>>): Parameters<typeof buildMcpOAuthProductionRouteAdapterConfig>[0] {
  return {
    flags: {
      runtime: env[MCP_OAUTH_PRODUCTION_RUNTIME_FLAG],
      approved: env[MCP_OAUTH_PRODUCTION_APPROVED_FLAG],
      routeWiring: env[MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG],
    },
    providerConfig: {
      provider: "stytch",
      issuer: env[MCP_OAUTH_PRODUCTION_ISSUER_VAR],
      resource: env[MCP_OAUTH_PRODUCTION_RESOURCE_VAR],
      providerEnvironment: env[MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT_VAR],
      allowedClientIds: readCommaSeparatedEnv(env[MCP_OAUTH_PRODUCTION_CLIENT_IDS_VAR]),
      requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      version: 1,
    },
  };
}

function buildProductionMcpOAuthRouteDependencies(
  env: Readonly<Record<string, string | undefined>>,
): McpOAuthProductionRouteAdapterDependenciesV1 {
  return Object.freeze({
    authorizationRequestConfig: readProductionMcpOAuthAuthorizationRequestConfig(env),
    checkPreAuthQuota: checkProductionPreAuthQuota,
    createPreAuthIntent: buildProductionPreAuthIntentCreatePort(env),
  });
}

function readProductionMcpOAuthAuthorizationRequestConfig(
  env: Readonly<Record<string, string | undefined>>,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["authorizationRequestConfig"]> {
  const allowedClientIds = readCommaSeparatedEnv(env[MCP_OAUTH_PRODUCTION_CLIENT_IDS_VAR]);
  return Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_config",
    authorizationPageOrigin: env[MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN_VAR]?.trim() ?? "",
    authorizationPagePath: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
    canonicalResource: env[MCP_OAUTH_PRODUCTION_RESOURCE_VAR]?.trim() ?? "",
    allowedRedirectUris: readCommaSeparatedEnv(env[MCP_OAUTH_PRODUCTION_REDIRECT_URIS_VAR]),
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: ["openid", "email", "profile"],
    allowedOptionalParameters: ["nonce", "prompt"],
    maxUrlLength: 4_096,
    maxParameterLength: 512,
    maxStateLength: 512,
    maxIdTokenHintLength: 1_024,
    clientIdPolicy: Object.freeze({
      mode: "predefined_allowlist",
      allowedClientIds,
      version: 1,
    }),
    localDevelopmentOnly: true,
    allowHttpLocalhostAuthorizationOrigin: false,
    version: 1,
  });
}

const checkProductionPreAuthQuota: NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["checkPreAuthQuota"]> = async (input) => {
  const key = `${input.authorizationPageOrigin}\n${input.clientId}\n${input.resource}`;
  const existing = productionPreAuthQuotaBuckets.get(key);
  const bucket =
    existing && input.now - existing.windowStartedAt < PRE_AUTH_QUOTA_WINDOW_MS
      ? existing
      : { count: 0, windowStartedAt: input.now };
  bucket.count += 1;
  productionPreAuthQuotaBuckets.set(key, bucket);
  if (bucket.count > PRE_AUTH_QUOTA_LIMIT) {
    return Object.freeze({
      kind: "mcp_oauth_pre_auth_quota_result",
      ok: false,
      reason: "rate_limited",
      safeFailure: { code: "pre_auth_quota_denied" },
      safeForLogging: true,
      version: 1,
    });
  }
  return Object.freeze({
    kind: "mcp_oauth_pre_auth_quota_result",
    ok: true,
    reason: "accepted",
    safeForLogging: true,
    version: 1,
  });
};

function buildProductionPreAuthIntentCreatePort(
  env: Readonly<Record<string, string | undefined>>,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]> {
  const convexClient = readConvexHttpClient(env);
  return async (input) => {
    if (!convexClient) return preAuthCreateUnavailableResult();
    return convexClient.mutation(
      CREATE_MCP_OAUTH_PRE_AUTH_INTENT_MUTATION,
      input,
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>>>>;
  };
}

function readConvexHttpClient(env: Readonly<Record<string, string | undefined>>): ConvexHttpClient | undefined {
  const url = readFirstEnvValue(env, [CONVEX_URL_VAR, VITE_CONVEX_URL_VAR, NEXT_PUBLIC_CONVEX_URL_VAR]);
  const auth = readFirstEnvValue(env, [CONVEX_KEY_VAR, CONVEX_AUTH_TOKEN_VAR]);
  if (!url || !auth || !isAbsoluteUrl(url)) return undefined;
  try {
    const client = new ConvexHttpClient(url);
    client.setAdminAuth(auth);
    return client;
  } catch {
    return undefined;
  }
}

function preAuthCreateUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_pre_auth_intent_create_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_pre_auth_intent_denied",
      message: "Pre-auth intent denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function readFirstEnvValue(env: Readonly<Record<string, string | undefined>>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function buildMcpOAuthProductionViteAllowedHosts(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const allowedHosts = [...DEFAULT_VITE_ALLOWED_HOSTS];
  const productionAuthorizationHost = readProductionAuthorizationAllowedHost(env);
  if (productionAuthorizationHost && !allowedHosts.includes(productionAuthorizationHost)) {
    allowedHosts.push(productionAuthorizationHost);
  }
  return allowedHosts;
}

function readProductionAuthorizationAllowedHost(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const value = env[MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN_VAR]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.origin === "null" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
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
export default defineConfig(() => {
  const allowedHosts = buildMcpOAuthProductionViteAllowedHosts(process.env);
  return {
    plugins: [react(), createLocalMcpDevEndpointPlugin()].filter((plugin): plugin is Plugin => plugin !== undefined),
    server: {
      host: "localhost",
      port: LOCAL_CLERK_SYNC_PORT,
      strictPort: true,
      allowedHosts: [...allowedHosts],
    },
    preview: {
      host: "localhost",
      port: LOCAL_CLERK_SYNC_PORT,
      strictPort: true,
      allowedHosts: [...allowedHosts],
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
  };
});
