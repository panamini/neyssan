/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference, type FunctionReference, type UserIdentityAttributes } from "convex/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
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
import {
  buildProtectedResourceMetadata,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
} from "./src/modules/local-mcp/mcpAuthPolicyBoundary";
import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
} from "./src/modules/local-mcp/mcpOAuthProductionActivationBoundary";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  handleMcpOAuthProductionRouteRequest,
  isMcpOAuthProductionRouteAllowedByPreflightPath,
  isMcpOAuthProductionRouteHandledPath,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
  MCP_OAUTH_PRODUCTION_TOKEN_PATH,
  type McpOAuthProductionClientSecretPostPolicyV1,
  type McpOAuthProductionAuthenticatedOwnerIdentityV1,
  type McpOAuthProductionRouteAdapterConfigV1,
  type McpOAuthProductionRouteAdapterDependenciesV1,
  type McpOAuthProductionRouteAdapterResponseV1,
} from "./src/modules/local-mcp/mcpOAuthProductionRouteAdapter";
import {
  buildMcpProductionReadonlySummaryExecutor,
  type McpProductionReadonlySummaryQueryKeyV1,
} from "./src/modules/local-mcp/mcpProductionReadonlySummaryExecutor";
import { MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG } from "./src/modules/local-mcp/mcpOAuthProductionRoutePreflightBoundary";
import {
  MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS_VAR,
  MCP_PRODUCTION_PRIVATE_BETA_ENABLED_FLAG,
  MCP_PRODUCTION_PRIVATE_BETA_RESOURCES_VAR,
  MCP_PRODUCTION_PRIVATE_BETA_SUBJECTS_VAR,
} from "./src/modules/local-mcp/mcpProductionPrivateBetaGate";
import {
  MCP_PRODUCTION_LAUNCH_READINESS_AUTHENTICATED_PROTOCOL_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_POLICY_KERNEL_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PRIVATE_BETA_GATE_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PROVIDER_WRITE_EXPANSION_BLOCKED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_LAUNCH_REQUESTED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_EXECUTION_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_STATUS_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_SCHEMA_MATCHER_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_READ_ONLY_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_LIST_METADATA_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_UNRESOLVED_BLOCKING_FINDINGS_FLAG,
} from "./src/modules/local-mcp/mcpProductionLaunchReadiness";
import { MCP_OAUTH_CONTINUATION_PATH } from "./src/pages/sign-in-return";

const LOCAL_CLERK_SYNC_PORT = 5173;
const LOCAL_MCP_DEV_ENDPOINT_FLAG = "LOCAL_MCP_DEV_ENDPOINT";
const LOCAL_MCP_DEV_FIXTURE_DEMO_FLAG = "LOCAL_MCP_DEV_FIXTURE_DEMO";
const LOCAL_MCP_DEV_AUTH_POLICY_FLAG = "LOCAL_MCP_DEV_AUTH_POLICY";
const LOCAL_MCP_DEV_AUTH_RESOURCE_VAR = "LOCAL_MCP_DEV_AUTH_RESOURCE";
const LOCAL_MCP_DEV_AUTH_ISSUER_VAR = "LOCAL_MCP_DEV_AUTH_ISSUER";
const LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT_VAR = "LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT";
const LOCAL_MCP_DEV_AUTH_CLIENT_ID_VAR = "LOCAL_MCP_DEV_AUTH_CLIENT_ID";
const WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER_PATH = "/.well-known/oauth-authorization-server";
const WELL_KNOWN_OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
const WELL_KNOWN_OPENID_CONFIGURATION_PATH = "/.well-known/openid-configuration";
const MCP_OAUTH_PRODUCTION_RESOURCE_VAR = "MCP_OAUTH_PRODUCTION_RESOURCE";
const MCP_OAUTH_PRODUCTION_ISSUER_VAR = "MCP_OAUTH_PRODUCTION_ISSUER";
const MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT_VAR = "MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT";
const MCP_OAUTH_PRODUCTION_CLIENT_IDS_VAR = "MCP_OAUTH_PRODUCTION_CLIENT_IDS";
const MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN_VAR = "MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN";
const MCP_OAUTH_PRODUCTION_REDIRECT_URIS_VAR = "MCP_OAUTH_PRODUCTION_REDIRECT_URIS";
const MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256_VAR = "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256";
const CONVEX_KEY_VAR = "CONVEX_KEY";
const CONVEX_AUTH_TOKEN_VAR = "CONVEX_AUTH_TOKEN";
const CONVEX_URL_VAR = "CONVEX_URL";
const VITE_CONVEX_URL_VAR = "VITE_CONVEX_URL";
const NEXT_PUBLIC_CONVEX_URL_VAR = "NEXT_PUBLIC_CONVEX_URL";
const CLERK_JWT_ISSUER_DOMAIN_VAR = "CLERK_JWT_ISSUER_DOMAIN";
const CLERK_CONVEX_AUDIENCE = "convex";
const PRE_AUTH_QUOTA_WINDOW_MS = 60_000;
const PRE_AUTH_QUOTA_LIMIT = 60;
const PRODUCTION_OAUTH_TOKEN_MAX_REQUEST_BYTES = 4_096;
const CLIENT_SECRET_SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const INVALID_CLIENT_SECRET_POST_POLICY = Object.freeze({
  allowedClientId: "",
  clientSecretSha256: "0".repeat(64),
  invalidConfiguration: true,
  version: 1,
} satisfies McpOAuthProductionClientSecretPostPolicyV1);
const DEFAULT_VITE_ALLOWED_HOSTS = Object.freeze(["host.docker.internal"]);
const CREATE_MCP_OAUTH_PRE_AUTH_INTENT_MUTATION = makeFunctionReference(
  "mcpOAuthPreAuthIntents:internalCreateMcpOAuthPreAuthIntent",
) as FunctionReference<"mutation">;
const BIND_MCP_OAUTH_PRE_AUTH_INTENT_TO_OWNER_MUTATION = makeFunctionReference(
  "mcpOAuthPreAuthOwnerBinding:internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner",
) as FunctionReference<"mutation">;
const CONSUME_MCP_OAUTH_AUTHORIZATION_INTENT_MUTATION = makeFunctionReference(
  "mcpOAuthAuthorizationIntents:internalConsumeMcpOAuthAuthorizationIntent",
) as FunctionReference<"mutation">;
const CREATE_MCP_OAUTH_AUTHORIZATION_CODE_MUTATION = makeFunctionReference(
  "mcpOAuthAuthorizationCodes:internalCreateMcpOAuthAuthorizationCode",
) as FunctionReference<"mutation">;
const VALIDATE_MCP_OAUTH_AUTHORIZATION_CODE_QUERY = makeFunctionReference(
  "mcpOAuthAuthorizationCodes:internalValidateMcpOAuthAuthorizationCodeForTokenBoundary",
) as FunctionReference<"query">;
const ISSUE_MCP_OAUTH_ACCESS_TOKEN_MUTATION = makeFunctionReference(
  "mcpOAuthAuthorizationCodes:internalIssueMcpOAuthAccessTokenFromAuthorizationCode",
) as FunctionReference<"mutation">;
const VERIFY_MCP_OAUTH_ACCESS_TOKEN_QUERY = makeFunctionReference(
  "mcpOAuthAuthorizationCodes:internalVerifyMcpOAuthAccessTokenForMcpBoundary",
) as FunctionReference<"query">;
const PRODUCTION_MCP_READONLY_SUMMARY_QUERY_REFERENCES = Object.freeze({
  applicationPackageSummary: makeFunctionReference(
    "mcpApplicationPackageSummary:internalSummarizeMcpApplicationPackage",
  ) as FunctionReference<"query">,
  evidenceGraphSummary: makeFunctionReference(
    "mcpEvidenceGraphSummary:internalSummarizeMcpEvidenceGraph",
  ) as FunctionReference<"query">,
  resumeVariantPlanSummary: makeFunctionReference(
    "mcpResumeVariantPlanSummary:internalSummarizeMcpResumeVariantPlan",
  ) as FunctionReference<"query">,
  reviewCockpitSummary: makeFunctionReference(
    "mcpReviewCockpitSummary:internalSummarizeMcpReviewCockpit",
  ) as FunctionReference<"query">,
} satisfies Record<McpProductionReadonlySummaryQueryKeyV1, FunctionReference<"query">>);
const productionPreAuthQuotaBuckets = new Map<string, { count: number; windowStartedAt: number }>();
const productionClerkJwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type ConvexHttpClientWithAdminAuthV1 = ConvexHttpClient & Readonly<{
  setAdminAuth: (token: string, identity?: UserIdentityAttributes) => void;
}>;

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
  if (
    handleProductionOAuthMetadataRequest(
      req,
      res,
      pathName,
      productionOAuthAuthorizationEnabled,
      productionOAuthAuthorizationConfig,
      productionOAuthAuthorizationDependencies,
    )
  ) {
    return;
  }
  if (
    productionOAuthAuthorizationEnabled &&
    (
      pathName === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH ||
      pathName === MCP_OAUTH_CONTINUATION_PATH ||
      pathName === MCP_OAUTH_PRODUCTION_TOKEN_PATH ||
      pathName === MCP_OAUTH_PRODUCTION_MCP_PATH
    ) &&
    productionOAuthRequestHostMatchesRoute(req, pathName, productionOAuthAuthorizationDependencies)
  ) {
    if (isProductionOAuthBrowserContinuationDocumentRequest(req, pathName) && !hasCookieNamed(req.headers.cookie, "__session")) {
      next();
      return;
    }
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

function handleProductionOAuthMetadataRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathName: string | undefined,
  enabled: boolean,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): boolean {
  if (!enabled) return false;
  if (!isMcpOAuthProductionRouteAllowedByPreflightPath(MCP_OAUTH_PRODUCTION_TOKEN_PATH, config.preflight)) {
    return false;
  }
  if (productionOAuthProtectedResourceMetadataRequestMatches(req, pathName, dependencies)) {
    sendProductionOAuthProtectedResourceMetadata(res, dependencies, isHeadRequest(req));
    return true;
  }
  if (productionOAuthAuthorizationServerMetadataRequestMatches(req, pathName, dependencies)) {
    sendProductionOAuthAuthorizationServerMetadata(res, dependencies, isHeadRequest(req));
    return true;
  }
  if (productionOAuthUnsupportedOpenIdConfigurationRequestMatches(req, pathName, dependencies)) {
    sendProductionOAuthUnsupportedOpenIdConfiguration(res, isHeadRequest(req));
    return true;
  }
  return false;
}

async function respondToMcpOAuthProductionRouteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  pathName: string,
): Promise<void> {
  if (
    (pathName === MCP_OAUTH_PRODUCTION_TOKEN_PATH || pathName === MCP_OAUTH_PRODUCTION_MCP_PATH) &&
    (req.method ?? "GET").toUpperCase() === "POST" &&
    isMcpOAuthProductionRouteAllowedByPreflightPath(pathName, config.preflight)
  ) {
    readProductionMcpOAuthTokenBody(req, res, pathName, PRODUCTION_OAUTH_TOKEN_MAX_REQUEST_BYTES, (bodyText) => {
      void respondToMcpOAuthProductionRouteRequestWithBody(
        req,
        res,
        next,
        config,
        dependencies,
        pathName,
        bodyText,
      ).catch(() => {
        sendInvalidLocalMcpDevRequest(res);
      });
    });
    return;
  }
  await respondToMcpOAuthProductionRouteRequestWithBody(
    req,
    res,
    next,
    config,
    dependencies,
    pathName,
  );
}

async function respondToMcpOAuthProductionRouteRequestWithBody(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  pathName: string,
  bodyText?: string,
): Promise<void> {
  const response = await handleMcpOAuthProductionRouteRequest(
    {
      method: req.method ?? "GET",
      path: pathName,
      url: req.url ?? pathName,
      headers: {
        host: headerValue(req.headers.host),
        authorization: req.headers.authorization,
        cookie: headerValue(req.headers.cookie),
        "x-forwarded-for": headerValue(req.headers["x-forwarded-for"]),
        "x-real-ip": headerValue(req.headers["x-real-ip"]),
        "cf-connecting-ip": headerValue(req.headers["cf-connecting-ip"]),
        "content-type": headerValue(req.headers["content-type"]),
        origin: headerValue(req.headers.origin),
        "mcp-protocol-version": headerValue(req.headers["mcp-protocol-version"]),
      },
      remoteAddress: req.socket.remoteAddress,
      ...(bodyText !== undefined ? { bodyText } : {}),
    },
    config,
    dependencies,
  );
  if (!response.handled) {
    next();
    return;
  }
  if (isProductionOAuthBrowserContinuationFetch(req, pathName) && isHttpRedirectResponse(response)) {
    sendLocalMcpRouteResponse(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        pragma: "no-cache",
      },
      {
        kind: "mcp_oauth_browser_continuation_redirect",
        status: "ready",
        redirectTo: response.headers.location,
        safeForLogging: false,
        version: 1,
      },
      undefined,
    );
    return;
  }
  if (
    isProductionOAuthBrowserContinuationDocumentRequest(req, pathName) &&
    isProductionOAuthOwnerBindingFailureResponse(response)
  ) {
    next();
    return;
  }
  sendLocalMcpRouteResponse(res, response.status, response.headers, response.json, response.bodyText);
}

function isProductionOAuthBrowserContinuationDocumentRequest(
  req: IncomingMessage,
  pathName: string,
): boolean {
  if (pathName !== MCP_OAUTH_CONTINUATION_PATH || (req.method ?? "GET").toUpperCase() !== "GET") {
    return false;
  }
  if (headerValue(req.headers.authorization)) {
    return false;
  }
  const accept = headerValue(req.headers.accept) ?? "";
  return accept.includes("text/html");
}

function hasCookieNamed(cookieHeader: string | readonly string[] | undefined, name: string): boolean {
  const cookie = headerValue(cookieHeader);
  if (!cookie) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|;)\\s*${escapedName}=`, "u").test(cookie);
}

function isProductionOAuthBrowserContinuationFetch(
  req: IncomingMessage,
  pathName: string,
): boolean {
  if (pathName !== MCP_OAUTH_CONTINUATION_PATH || (req.method ?? "GET").toUpperCase() !== "GET") {
    return false;
  }
  if (headerValue(req.headers["x-mcp-oauth-browser-continuation"]) === "1") {
    return true;
  }
  const accept = headerValue(req.headers.accept) ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function isHttpRedirectResponse(
  response: McpOAuthProductionRouteAdapterResponseV1,
): response is McpOAuthProductionRouteAdapterResponseV1 & {
  headers: Readonly<Record<string, string> & { location: string }>;
} {
  return (
    response.status >= 300 &&
    response.status < 400 &&
    typeof response.headers.location === "string" &&
    response.headers.location.length > 0
  );
}

function isProductionOAuthOwnerBindingFailureResponse(response: McpOAuthProductionRouteAdapterResponseV1): boolean {
  if (response.status !== 401 || !response.json || typeof response.json !== "object") return false;
  const failure = response.json as { route?: unknown; reason?: unknown };
  return failure.route === "oauth_login_return" && failure.reason === "owner_binding_failed";
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

function readProductionMcpOAuthTokenBody(
  req: IncomingMessage,
  res: ServerResponse,
  pathName: string,
  maxRequestBytes: number,
  onBody: (bodyText: string) => void,
): void {
  let bodyText = "";
  let rejectedForSize = false;
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    if (rejectedForSize) return;
    bodyText += chunk;
    rejectedForSize = rejectIfProductionMcpOAuthBodyTooLarge(req, res, pathName, bodyText, maxRequestBytes);
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

function rejectIfProductionMcpOAuthBodyTooLarge(
  req: IncomingMessage,
  res: ServerResponse,
  pathName: string,
  bodyText: string,
  maxRequestBytes: number,
): boolean {
  if (Buffer.byteLength(bodyText, "utf8") <= maxRequestBytes) return false;
  if (pathName === MCP_OAUTH_PRODUCTION_MCP_PATH) {
    sendLocalMcpJson(res, 413, {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32013,
        message: "Production MCP request is too large.",
        safeForModel: true,
      },
    });
    req.destroy();
    return true;
  }
  sendLocalMcpJson(res, 413, {
    kind: "mcp_oauth_production_route_response",
    status: "blocked",
    reason: "token_request_body_too_large",
    route: "oauth_token",
    message: "Production OAuth token request is too large.",
    safeForModel: true,
    authorizationCodeAccepted: false,
    authorizationCodeConsumed: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    accountLinkCreated: false,
    tokenPersisted: false,
    refreshTokenPersisted: false,
    hostedMcpStarted: false,
    version: 1,
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
  if (status === 202 && json === null) {
    res.end();
    return;
  }
  if (json !== undefined) {
    res.end(JSON.stringify(json));
    return;
  }
  res.end(bodyText ?? "");
}

function headerValue(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return value?.[0];
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
  const privateBetaSubjectIds = readCommaSeparatedEnv(env[MCP_PRODUCTION_PRIVATE_BETA_SUBJECTS_VAR]);
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
    activationDependencies: buildProductionMcpOAuthActivationDependencyStubs(),
    privateBeta: {
      enabled: isStrictEnabledFlag(env, MCP_PRODUCTION_PRIVATE_BETA_ENABLED_FLAG),
      allowedClientIds: readCommaSeparatedEnv(env[MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS_VAR]),
      allowedResources: readCommaSeparatedEnv(env[MCP_PRODUCTION_PRIVATE_BETA_RESOURCES_VAR]),
      ...(privateBetaSubjectIds.length > 0 ? { allowedSubjectIds: privateBetaSubjectIds } : {}),
      version: 1,
    },
    launchReadiness: {
      publicLaunchRequested: isStrictEnabledFlag(
        env,
        MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_LAUNCH_REQUESTED_FLAG,
      ),
      evidence: {
        privateBetaGateReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_PRIVATE_BETA_GATE_REVIEWED_FLAG,
        ),
        authenticatedMcpProtocolReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_AUTHENTICATED_PROTOCOL_REVIEWED_FLAG,
        ),
        policyKernelReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_POLICY_KERNEL_REVIEWED_FLAG,
        ),
        toolsListMetadataReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_LIST_METADATA_REVIEWED_FLAG,
        ),
        toolsCallReadOnlyReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_READ_ONLY_REVIEWED_FLAG,
        ),
        toolsCallSyntheticMetadataCleanupReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG,
        ),
        schemaMatcherReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_SCHEMA_MATCHER_REVIEWED_FLAG,
        ),
        readonlySummaryExecutionReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_EXECUTION_REVIEWED_FLAG,
        ),
        readonlySummaryStatusReviewed: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_STATUS_REVIEWED_FLAG,
        ),
        providerWriteExpansionBlocked: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_PROVIDER_WRITE_EXPANSION_BLOCKED_FLAG,
        ),
        unresolvedBlockingFindings: isStrictEnabledFlag(
          env,
          MCP_PRODUCTION_LAUNCH_READINESS_UNRESOLVED_BLOCKING_FINDINGS_FLAG,
        ),
        version: 1,
      },
      version: 1,
    },
  };
}

function buildProductionMcpOAuthActivationDependencyStubs(): NonNullable<
  NonNullable<Parameters<typeof buildMcpOAuthProductionRouteAdapterConfig>[0]>["activationDependencies"]
> {
  const safeFailure = Object.freeze({
    code: "mcp_oauth_production_activation_blocked",
    message: "Production OAuth activation blocked.",
    safeForModel: true,
    tokenEchoed: false,
    authorizationCodeEchoed: false,
    providerSubjectExposed: false,
    ownerExposed: false,
    publicEndpointExposed: false,
    frontendWired: false,
    version: 1,
  });
  return Object.freeze({
    providerAdapter: Object.freeze({
      provider: "stytch",
      exchangeAuthorizationCode: async () => Object.freeze({
        kind: "mcp_oauth_production_token_exchange_result",
        ok: false,
        reason: "provider_adapter_unavailable",
        safeFailure,
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      }),
      version: 1,
    }),
    executeAccountLinkLifecycle: async () => Object.freeze({
      kind: "mcp_account_link_lifecycle_result",
      operation: "link",
      ok: false,
      reason: "account_link_lifecycle_unavailable",
      safeFailure,
      modelVisible: false,
      version: 1,
    }),
  });
}

function buildProductionMcpOAuthRouteDependencies(
  env: Readonly<Record<string, string | undefined>>,
): McpOAuthProductionRouteAdapterDependenciesV1 {
  const convexConnection = readConvexConnection(env);
  const convexClient = readConvexHttpClient(convexConnection);
  return Object.freeze({
    authorizationRequestConfig: readProductionMcpOAuthAuthorizationRequestConfig(env),
    clientSecretPost: readProductionMcpOAuthClientSecretPostPolicy(env),
    checkPreAuthQuota: checkProductionPreAuthQuota,
    createPreAuthIntent: buildProductionPreAuthIntentCreatePort(convexClient),
    bindPreAuthIntentToAuthenticatedOwner: buildProductionPreAuthOwnerBindingPort(convexConnection),
    consumeAuthorizationIntent: buildProductionAuthorizationIntentConsumePort(convexClient),
    createAuthorizationCode: buildProductionAuthorizationCodeCreatePort(convexClient),
    validateAuthorizationCode: buildProductionAuthorizationCodeValidatePort(convexClient),
    issueAccessToken: buildProductionAccessTokenIssuePort(convexClient),
    verifyAccessToken: buildProductionAccessTokenVerifyPort(convexClient),
    executeReadonlySummaryTool: buildProductionReadonlySummaryExecutor(convexClient),
    readAuthenticatedOwnerIdentity: buildProductionAuthenticatedOwnerIdentityReader(env),
  });
}

function readProductionMcpOAuthClientSecretPostPolicy(
  env: Readonly<Record<string, string | undefined>>,
): McpOAuthProductionClientSecretPostPolicyV1 | undefined {
  const configuredDigest = env[MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256_VAR];
  if (configuredDigest === undefined) return undefined;
  const digest = configuredDigest.trim().toLowerCase();
  const allowedClientIds = readCommaSeparatedEnv(env[MCP_OAUTH_PRODUCTION_CLIENT_IDS_VAR]);
  const privateBetaClientIds = readCommaSeparatedEnv(env[MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS_VAR]);
  if (
    !digest ||
    !CLIENT_SECRET_SHA256_PATTERN.test(digest) ||
    allowedClientIds.length !== 1 ||
    !isStrictEnabledFlag(env, MCP_PRODUCTION_PRIVATE_BETA_ENABLED_FLAG) ||
    !privateBetaClientIds.includes(allowedClientIds[0])
  ) {
    return INVALID_CLIENT_SECRET_POST_POLICY;
  }
  return Object.freeze({
    allowedClientId: allowedClientIds[0],
    clientSecretSha256: digest,
    version: 1,
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
    allowedRedirectUris: normalizeMcpOAuthProductionRedirectUris(env[MCP_OAUTH_PRODUCTION_REDIRECT_URIS_VAR]),
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: ["openid", "email", "profile"] as const,
    allowedOptionalParameters: ["nonce", "prompt", "ui_locales"] as const,
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
  const key = `${input.authorizationPageOrigin}\n${input.clientId}\n${input.resource}\n${input.callerKey}`;
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
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]> {
  return async (input) => {
    if (!convexClient) return preAuthCreateUnavailableResult();
    return convexClient.mutation(
      CREATE_MCP_OAUTH_PRE_AUTH_INTENT_MUTATION,
      input,
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>>>>;
  };
}

function buildProductionPreAuthOwnerBindingPort(
  convexConnection: ConvexConnectionV1 | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]> {
  return async (input) => {
    const convexClient = readConvexHttpClient(convexConnection, {
      subject: input.authenticatedOwnerIdentity.subject,
      issuer: input.authenticatedOwnerIdentity.issuer,
    });
    if (!convexClient) return preAuthOwnerBindingUnavailableResult();
    return convexClient.mutation(
      BIND_MCP_OAUTH_PRE_AUTH_INTENT_TO_OWNER_MUTATION,
      {
        preAuthHandleHash: input.preAuthHandleHash,
        now: input.now,
        version: input.version,
      },
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>>>>;
  };
}

function buildProductionAuthorizationIntentConsumePort(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["consumeAuthorizationIntent"]> {
  return async (input) => {
    if (!convexClient) return authorizationIntentConsumeUnavailableResult();
    return convexClient.mutation(
      CONSUME_MCP_OAUTH_AUTHORIZATION_INTENT_MUTATION,
      input,
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["consumeAuthorizationIntent"]>>>>;
  };
}

function buildProductionAuthorizationCodeCreatePort(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createAuthorizationCode"]> {
  return async (input) => {
    if (!convexClient) return authorizationCodeCreateUnavailableResult();
    return convexClient.mutation(
      CREATE_MCP_OAUTH_AUTHORIZATION_CODE_MUTATION,
      input,
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createAuthorizationCode"]>>>>;
  };
}

function buildProductionAuthorizationCodeValidatePort(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["validateAuthorizationCode"]> {
  return async (input) => {
    if (!convexClient) return authorizationCodeValidateUnavailableResult();
    return convexClient.query(
      VALIDATE_MCP_OAUTH_AUTHORIZATION_CODE_QUERY,
      input,
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["validateAuthorizationCode"]>>>>;
  };
}

function buildProductionAccessTokenIssuePort(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]> {
  return async (input) => {
    if (!convexClient) return accessTokenIssueUnavailableResult();
    return convexClient.mutation(
      ISSUE_MCP_OAUTH_ACCESS_TOKEN_MUTATION,
      input,
      { skipQueue: true },
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]>>>>;
  };
}

function buildProductionAccessTokenVerifyPort(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["verifyAccessToken"]> {
  return async (input) => {
    if (!convexClient) return accessTokenVerifyUnavailableResult();
    return convexClient.query(
      VERIFY_MCP_OAUTH_ACCESS_TOKEN_QUERY,
      input,
    ) as Promise<Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["verifyAccessToken"]>>>>;
  };
}

function buildProductionReadonlySummaryExecutor(
  convexClient: ConvexHttpClient | undefined,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["executeReadonlySummaryTool"]> {
  return buildMcpProductionReadonlySummaryExecutor(async (input) => {
    if (!convexClient) {
      throw new TypeError("Production MCP read-only summary storage unavailable.");
    }
    return convexClient.query(
      PRODUCTION_MCP_READONLY_SUMMARY_QUERY_REFERENCES[input.query],
      input.args,
    ) as Promise<unknown>;
  });
}

type ConvexConnectionV1 = Readonly<{
  url: string;
  adminAuth: string;
}>;

function readConvexConnection(env: Readonly<Record<string, string | undefined>>): ConvexConnectionV1 | undefined {
  const url = readFirstEnvValue(env, [CONVEX_URL_VAR, VITE_CONVEX_URL_VAR, NEXT_PUBLIC_CONVEX_URL_VAR]);
  const auth = readFirstEnvValue(env, [CONVEX_KEY_VAR, CONVEX_AUTH_TOKEN_VAR]);
  if (!url || !auth || !isAbsoluteUrl(url)) return undefined;
  return Object.freeze({ url, adminAuth: auth });
}

function readConvexHttpClient(
  connection: ConvexConnectionV1 | undefined,
  actingAsIdentity?: UserIdentityAttributes,
): ConvexHttpClient | undefined {
  if (!connection) return undefined;
  try {
    const client = new ConvexHttpClient(connection.url) as ConvexHttpClientWithAdminAuthV1;
    client.setAdminAuth(connection.adminAuth, actingAsIdentity);
    return client;
  } catch {
    return undefined;
  }
}

function buildProductionAuthenticatedOwnerIdentityReader(
  env: Readonly<Record<string, string | undefined>>,
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["readAuthenticatedOwnerIdentity"]> {
  const issuer = readProductionClerkIssuer(env);
  return async (request) => {
    if (!issuer) return undefined;
    const bearerToken = readRequestBearerToken(request.headers?.authorization);
    if (bearerToken) return verifyProductionClerkOwnerIdentity(bearerToken, issuer, { requireAudience: true });
    const sessionToken = readClerkSessionCookie(request.headers?.cookie);
    if (!sessionToken) return undefined;
    return verifyProductionClerkOwnerIdentity(sessionToken, issuer, { requireAudience: false });
  };
}

async function verifyProductionClerkOwnerIdentity(
  token: string,
  issuer: string,
  options: Readonly<{ requireAudience: boolean }>,
): Promise<McpOAuthProductionAuthenticatedOwnerIdentityV1 | undefined> {
  try {
    const verifyOptions = options.requireAudience
      ? { issuer, audience: CLERK_CONVEX_AUDIENCE }
      : { issuer };
    const { payload } = await jwtVerify(token, readProductionClerkJwks(issuer), verifyOptions);
    const identity = readVerifiedOwnerIdentity(payload, issuer);
    return identity ? Object.freeze({ ...identity, version: 1 }) : undefined;
  } catch {
    return undefined;
  }
}

function readProductionClerkJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = productionClerkJwksByIssuer.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", issuer));
  productionClerkJwksByIssuer.set(issuer, jwks);
  return jwks;
}

function readVerifiedOwnerIdentity(
  payload: JWTPayload,
  issuer: string,
): Omit<McpOAuthProductionAuthenticatedOwnerIdentityV1, "version"> | undefined {
  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const verifiedIssuer = typeof payload.iss === "string" ? payload.iss.trim() : "";
  if (
    verifiedIssuer !== issuer ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(subject)
  ) {
    return undefined;
  }
  return { subject, issuer: verifiedIssuer };
}

function readProductionClerkIssuer(env: Readonly<Record<string, string | undefined>>): string | undefined {
  const issuer = env[CLERK_JWT_ISSUER_DOMAIN_VAR]?.trim();
  if (!issuer || !isHttpsOrigin(issuer)) return undefined;
  return new URL(issuer).origin;
}

function readRequestBearerToken(value: string | readonly string[] | undefined): string | undefined {
  const authorization = headerValue(value);
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/u.exec(authorization ?? "");
  return match?.[1];
}

function readClerkSessionCookie(value: string | readonly string[] | undefined): string | undefined {
  const cookie = headerValue(value);
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === "__session") {
      const token = rawValue.join("=").trim();
      return /^[A-Za-z0-9._-]+$/u.test(token) ? token : undefined;
    }
  }
  return undefined;
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

function preAuthOwnerBindingUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_pre_auth_owner_binding_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_pre_auth_owner_binding_denied",
      message: "Pre-auth owner binding denied.",
      safeForModel: true,
      handleEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function authorizationIntentConsumeUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["consumeAuthorizationIntent"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: false,
    reason: "not_found_or_forbidden",
    safeFailure: {
      code: "mcp_oauth_authorization_intent_denied",
      message: "Authorization intent denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function authorizationCodeCreateUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createAuthorizationCode"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_authorization_code_create_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_authorization_code_denied",
      message: "Authorization code denied.",
      safeForModel: true,
      rawCodeEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    } as const,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function authorizationCodeValidateUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["validateAuthorizationCode"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_authorization_code_validate_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_authorization_code_denied",
      message: "Authorization code denied.",
      safeForModel: true,
      rawCodeEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    } as const,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function accessTokenIssueUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_access_token_issue_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_authorization_code_denied",
      message: "Authorization code denied.",
      safeForModel: true,
      rawCodeEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    } as const,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function accessTokenVerifyUnavailableResult(): Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["verifyAccessToken"]>>> {
  return Object.freeze({
    kind: "mcp_oauth_access_token_verify_result",
    ok: false,
    reason: "storage_unavailable",
    safeFailure: {
      code: "mcp_oauth_access_token_denied",
      message: "Access token denied.",
      safeForModel: true,
      rawTokenEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    } as const,
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

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin !== "null" &&
      !url.username &&
      !url.password &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function productionOAuthRequestHostMatchesRoute(
  req: IncomingMessage,
  pathName: string | undefined,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): boolean {
  const config = dependencies.authorizationRequestConfig;
  if (!config) return false;
  if (pathName === MCP_OAUTH_PRODUCTION_MCP_PATH) {
    return productionOAuthRequestHostMatchesUrlOrigin(req, config.canonicalResource);
  }
  return productionOAuthRequestHostMatchesUrlOrigin(req, config.authorizationPageOrigin);
}

function productionOAuthProtectedResourceMetadataRequestMatches(
  req: IncomingMessage,
  pathName: string | undefined,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): boolean {
  if (!isMetadataRequestMethod(req)) return false;
  const rootMetadataUrl = productionOAuthProtectedResourceRootMetadataUrl(
    dependencies.authorizationRequestConfig?.canonicalResource,
  );
  const metadataUrl = productionOAuthProtectedResourceMetadataUrl(
    dependencies.authorizationRequestConfig?.canonicalResource,
  );
  if (!rootMetadataUrl || !metadataUrl) return false;
  try {
    const parsedRootMetadataUrl = new URL(rootMetadataUrl);
    const parsedMetadataUrl = new URL(metadataUrl);
    return (
      (pathName === parsedRootMetadataUrl.pathname || pathName === parsedMetadataUrl.pathname) &&
      productionOAuthRequestHostMatchesUrlOrigin(req, parsedMetadataUrl.toString())
    );
  } catch {
    return false;
  }
}

function sendProductionOAuthProtectedResourceMetadata(
  res: ServerResponse,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  omitBody: boolean,
): void {
  const config = dependencies.authorizationRequestConfig;
  const protectedResourceMetadataUrl = productionOAuthProtectedResourceMetadataUrl(config?.canonicalResource);
  if (!config || !protectedResourceMetadataUrl) {
    sendInvalidLocalMcpDevRequest(res);
    return;
  }
  try {
    const metadata = buildProtectedResourceMetadata({
      resourceUrl: config.canonicalResource,
      protectedResourceMetadataUrl,
      authorizationServerIssuerUrl: config.authorizationPageOrigin,
      supportedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });
    sendLocalMcpRouteResponse(
      res,
      200,
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      omitBody ? undefined : metadata,
      undefined,
    );
  } catch {
    sendInvalidLocalMcpDevRequest(res);
  }
}

function productionOAuthAuthorizationServerMetadataRequestMatches(
  req: IncomingMessage,
  pathName: string | undefined,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): boolean {
  if (!isMetadataRequestMethod(req)) return false;
  if (pathName !== WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER_PATH) return false;
  return productionOAuthRequestHostMatchesUrlOrigin(
    req,
    dependencies.authorizationRequestConfig?.authorizationPageOrigin,
  );
}

function productionOAuthUnsupportedOpenIdConfigurationRequestMatches(
  req: IncomingMessage,
  pathName: string | undefined,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): boolean {
  if (!isMetadataRequestMethod(req)) return false;
  if (pathName !== WELL_KNOWN_OPENID_CONFIGURATION_PATH) return false;
  return productionOAuthRequestHostMatchesUrlOrigin(
    req,
    dependencies.authorizationRequestConfig?.authorizationPageOrigin,
  );
}

function sendProductionOAuthUnsupportedOpenIdConfiguration(res: ServerResponse, omitBody: boolean): void {
  sendLocalMcpRouteResponse(
    res,
    404,
    { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    omitBody
      ? undefined
      : {
          error: "not_found",
          error_description: "OpenID Connect discovery is not available for this OAuth server.",
        },
    undefined,
  );
}

function sendProductionOAuthAuthorizationServerMetadata(
  res: ServerResponse,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  omitBody: boolean,
): void {
  const metadata = productionOAuthAuthorizationServerMetadata(
    dependencies.authorizationRequestConfig?.authorizationPageOrigin,
    dependencies.clientSecretPost ? ["client_secret_post", "client_secret_basic"] : ["none"],
  );
  if (!metadata) {
    sendInvalidLocalMcpDevRequest(res);
    return;
  }
  sendLocalMcpRouteResponse(
    res,
      200,
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      omitBody ? undefined : metadata,
      undefined,
    );
}

function isMetadataRequestMethod(req: IncomingMessage): boolean {
  const method = (req.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

function isHeadRequest(req: IncomingMessage): boolean {
  return (req.method ?? "GET").toUpperCase() === "HEAD";
}

function productionOAuthAuthorizationServerMetadata(
  authorizationPageOrigin: string | undefined,
  tokenEndpointAuthMethodsSupported: readonly ["none"] | readonly ["client_secret_post", "client_secret_basic"],
): unknown | undefined {
  const parsed = parseProductionOAuthHttpsOrigin(authorizationPageOrigin);
  if (!parsed) return undefined;
  return Object.freeze({
    issuer: parsed.toString(),
    authorization_endpoint: `${parsed.origin}${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}`,
    token_endpoint: `${parsed.origin}${MCP_OAUTH_PRODUCTION_TOKEN_PATH}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    token_endpoint_auth_methods_supported: [...tokenEndpointAuthMethodsSupported],
    scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
  });
}

function parseProductionOAuthHttpsOrigin(origin: string | undefined): URL | undefined {
  if (typeof origin !== "string") return undefined;
  try {
    const parsed = new URL(origin);
    if (!isProductionOAuthHttpsOrigin(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function isProductionOAuthHttpsOrigin(parsed: URL): boolean {
  const hasPath = parsed.pathname !== "" && parsed.pathname !== "/";
  return (
    parsed.protocol === "https:" &&
    parsed.origin !== "null" &&
    Boolean(parsed.hostname) &&
    !parsed.username &&
    !parsed.password &&
    !hasPath &&
    !parsed.search &&
    !parsed.hash
  );
}

function productionOAuthProtectedResourceMetadataUrl(resourceUrl: string | undefined): string | undefined {
  if (typeof resourceUrl !== "string") return undefined;
  try {
    const parsed = new URL(resourceUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin === "null" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }
    const normalizedPath = productionOAuthCanonicalResourcePath(parsed.pathname);
    return `${parsed.origin}${WELL_KNOWN_OAUTH_PROTECTED_RESOURCE_PATH}${normalizedPath === "/" ? "" : normalizedPath}`;
  } catch {
    return undefined;
  }
}

function productionOAuthProtectedResourceRootMetadataUrl(resourceUrl: string | undefined): string | undefined {
  if (typeof resourceUrl !== "string") return undefined;
  try {
    const parsed = new URL(resourceUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin === "null" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }
    return `${parsed.origin}${WELL_KNOWN_OAUTH_PROTECTED_RESOURCE_PATH}`;
  } catch {
    return undefined;
  }
}

function productionOAuthCanonicalResourcePath(pathName: string): string {
  let end = pathName.length;
  while (end > 1 && pathName.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  const normalized = pathName.slice(0, end);
  return normalized.length === 0 ? "/" : normalized;
}

function productionOAuthRequestHostMatchesUrlOrigin(
  req: IncomingMessage,
  url: string | undefined,
): boolean {
  if (typeof url !== "string") return false;
  try {
    const parsedOrigin = new URL(url);
    const host = headerValue(req.headers.host);
    if (!host || host.includes("/") || host.includes("@")) return false;
    const parsedHost = new URL(`${parsedOrigin.protocol}//${host}`);
    return (
      parsedHost.hostname.toLowerCase() === parsedOrigin.hostname.toLowerCase() &&
      (parsedHost.port || defaultPortForProtocol(parsedOrigin.protocol)) ===
        (parsedOrigin.port || defaultPortForProtocol(parsedOrigin.protocol))
    );
  } catch {
    return false;
  }
}

function defaultPortForProtocol(protocol: string): "80" | "443" | "" {
  if (protocol === "https:") return "443";
  if (protocol === "http:") return "80";
  return "";
}

export function buildMcpOAuthProductionViteAllowedHosts(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const allowedHosts = [...DEFAULT_VITE_ALLOWED_HOSTS];
  const productionAuthorizationHost = readProductionAuthorizationAllowedHost(env);
  if (productionAuthorizationHost && !allowedHosts.includes(productionAuthorizationHost)) {
    allowedHosts.push(productionAuthorizationHost);
  }
  const productionResourceHost = readProductionResourceAllowedHost(env);
  if (productionResourceHost && !allowedHosts.includes(productionResourceHost)) {
    allowedHosts.push(productionResourceHost);
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
      (url.protocol !== "https:" && url.protocol !== "http:") ||
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

function readProductionResourceAllowedHost(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const value = env[MCP_OAUTH_PRODUCTION_RESOURCE_VAR]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.origin === "null" ||
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
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

export function normalizeMcpOAuthProductionRedirectUris(value: string | undefined): readonly string[] {
  const rawValues = readCommaSeparatedEnv(value);
  const normalizedValues = rawValues.map(readCanonicalProductionRedirectUri);
  if (normalizedValues.some((item) => item === undefined)) return rawValues;
  return Object.freeze([...new Set(normalizedValues.filter((item): item is string => item !== undefined))]);
}

function readCanonicalProductionRedirectUri(value: string): string | undefined {
  if (containsControlCharacters(value) || hasMalformedPercentEncoding(value)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || parsed.hostname.includes("*")) {
    return undefined;
  }
  return parsed.toString();
}

function hasMalformedPercentEncoding(value: string): boolean {
  if (/%(?![0-9A-Fa-f]{2})/u.test(value)) return true;
  for (const component of value.split(/[&=]/u)) {
    try {
      decodeURIComponent(component.split("+").join(" "));
    } catch {
      return true;
    }
  }
  return false;
}

function containsControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
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
