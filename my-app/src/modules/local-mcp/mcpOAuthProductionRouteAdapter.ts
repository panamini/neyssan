import {
  buildMcpOAuthProductionRoutePreflight,
  type McpOAuthProductionRoutePreflightDecisionV1,
  type McpOAuthProductionRoutePreflightInputV1,
  type McpOAuthProductionRoutePreflightResultV1,
} from "./mcpOAuthProductionRoutePreflightBoundary";

export const MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH = "/oauth/authorize";
export const MCP_OAUTH_PRODUCTION_CALLBACK_PATH = "/oauth/callback";
export const MCP_OAUTH_PRODUCTION_MCP_PATH = "/mcp";

export type McpOAuthProductionRoutePathV1 =
  | typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH
  | typeof MCP_OAUTH_PRODUCTION_CALLBACK_PATH
  | typeof MCP_OAUTH_PRODUCTION_MCP_PATH;

type McpOAuthProductionRouteNameV1 =
  | "oauth_authorize"
  | "oauth_callback"
  | "mcp";

export type McpOAuthProductionRouteAdapterConfigV1 = Readonly<{
  kind: "mcp_oauth_production_route_adapter_config";
  preflight: McpOAuthProductionRoutePreflightResultV1;
  handledPaths: readonly McpOAuthProductionRoutePathV1[];
  failClosedUnlessPreflightReady: true;
  inertGuardedHandlersOnly: true;
  safeForModel: true;
  version: 1;
}>;

export type McpOAuthProductionRouteAdapterRequestV1 = Readonly<{
  method: string;
  path: string;
  url: string;
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
}>;

export type McpOAuthProductionRouteAdapterResponseV1 = Readonly<{
  handled: boolean;
  status: number;
  headers: Readonly<Record<string, string>>;
  json?: unknown;
  bodyText?: string;
}>;

type McpOAuthProductionRouteFailureReasonV1 =
  | McpOAuthProductionRoutePreflightDecisionV1
  | "unsupported_method";

const HANDLED_PATHS = Object.freeze([
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
] as const);

export function buildMcpOAuthProductionRouteAdapterConfig(
  input: McpOAuthProductionRoutePreflightInputV1 = {},
): McpOAuthProductionRouteAdapterConfigV1 {
  return Object.freeze({
    kind: "mcp_oauth_production_route_adapter_config",
    preflight: buildMcpOAuthProductionRoutePreflight(input),
    handledPaths: HANDLED_PATHS,
    failClosedUnlessPreflightReady: true,
    inertGuardedHandlersOnly: true,
    safeForModel: true,
    version: 1,
  });
}

export function isMcpOAuthProductionRouteHandledPath(path: string): boolean {
  return routeNameForPath(path) !== undefined;
}

export async function handleMcpOAuthProductionRouteRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1 = buildMcpOAuthProductionRouteAdapterConfig(),
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const route = routeNameForPath(request.path);
  if (!route) return notHandled();
  if (!config.preflight.allowedToWire) {
    return failClosedResponse(route, config.preflight, config.preflight.decision, 404);
  }
  if (!isAllowedMethod(route, request.method)) {
    return failClosedResponse(route, config.preflight, "unsupported_method", 405, {
      allow: allowedMethodForRoute(route),
    });
  }
  return inertGuardedResponse(route, config.preflight);
}

function routeNameForPath(path: string): McpOAuthProductionRouteNameV1 | undefined {
  if (path === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH) return "oauth_authorize";
  if (path === MCP_OAUTH_PRODUCTION_CALLBACK_PATH) return "oauth_callback";
  if (path === MCP_OAUTH_PRODUCTION_MCP_PATH) return "mcp";
  return undefined;
}

function isAllowedMethod(route: McpOAuthProductionRouteNameV1, method: string): boolean {
  return method.toUpperCase() === allowedMethodForRoute(route);
}

function allowedMethodForRoute(route: McpOAuthProductionRouteNameV1): "GET" | "POST" {
  if (route === "mcp") return "POST";
  return "GET";
}

function failClosedResponse(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
  reason: McpOAuthProductionRouteFailureReasonV1,
  status: number,
  headers: Readonly<Record<string, string>> = {},
): McpOAuthProductionRouteAdapterResponseV1 {
  return jsonResponse(status, {
    kind: "mcp_oauth_production_route_response",
    status: "blocked",
    reason,
    route,
    message: "Production MCP OAuth route unavailable.",
    safeForModel: true,
    allowedByPreflight: preflight.allowedToWire,
    preflightDecision: preflight.decision,
    guardedInertHandlerReached: false,
    authorizationRequestAccepted: false,
    authorizationCodeAccepted: false,
    authorizationCodeIssued: false,
    redirectSecretAccepted: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    accountLinkCreated: false,
    tokenPersisted: false,
    refreshTokenPersisted: false,
    providerSecretsExposed: false,
    rawProviderConfigExposed: false,
    ownerIdentifiersExposed: false,
    authorizationCodesExposed: false,
    redirectSecretsExposed: false,
    hostedMcpStarted: false,
    version: 1,
  }, headers);
}

function inertGuardedResponse(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
): McpOAuthProductionRouteAdapterResponseV1 {
  return jsonResponse(501, {
    kind: "mcp_oauth_production_route_response",
    status: "guarded_inert",
    reason: "inert_handler_only",
    route,
    message: "Production MCP OAuth route is guarded and inert.",
    safeForModel: true,
    allowedByPreflight: preflight.allowedToWire,
    preflightDecision: preflight.decision,
    guardedInertHandlerReached: true,
    oauthExecutionStarted: false,
    authorizationRequestAccepted: false,
    authorizationCodeAccepted: false,
    authorizationCodeIssued: false,
    redirectSecretAccepted: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    accountLinkCreated: false,
    tokenPersisted: false,
    refreshTokenPersisted: false,
    providerSecretsExposed: false,
    rawProviderConfigExposed: false,
    ownerIdentifiersExposed: false,
    authorizationCodesExposed: false,
    redirectSecretsExposed: false,
    hostedMcpStarted: false,
    handlerMode: "inert_guarded_only",
    version: 1,
  });
}

function notHandled(): McpOAuthProductionRouteAdapterResponseV1 {
  return Object.freeze({
    handled: false,
    status: 404,
    headers: noStoreHeaders(),
    bodyText: "",
  });
}

function jsonResponse(
  status: number,
  json: unknown,
  headers: Readonly<Record<string, string>> = {},
): McpOAuthProductionRouteAdapterResponseV1 {
  return Object.freeze({
    handled: true,
    status,
    headers: {
      ...noStoreHeaders(),
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
    json,
  });
}

function noStoreHeaders(): Readonly<Record<string, string>> {
  return Object.freeze({
    "cache-control": "no-store",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  });
}
