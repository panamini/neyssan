import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
  buildMcpOAuthProductionActivationConfig,
  type McpOAuthProductionProviderConfigV1,
} from "./mcpOAuthProductionActivationBoundary";
import {
  buildMcpOperationalProductionOAuthActivationStatus,
  type McpOperationalStatusV1,
} from "./mcpOperationalStatus";

export const MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG =
  "MCP_OAUTH_PRODUCTION_ROUTE_WIRING";

export type McpOAuthProductionRoutePreflightDecisionV1 =
  | "disabled"
  | "blocked_missing_runtime_flag"
  | "blocked_missing_approval_flag"
  | "blocked_misconfigured_provider"
  | "blocked_endpoint_exposure_not_enabled"
  | "ready_to_wire";

export type McpOAuthProductionRoutePreflightFlagsV1 = Readonly<{
  runtime?: string;
  approved?: string;
  routeWiring?: string;
}>;

export type McpOAuthProductionRoutePreflightInputV1 = Readonly<{
  flags?: McpOAuthProductionRoutePreflightFlagsV1;
  providerConfig?: Partial<McpOAuthProductionProviderConfigV1>;
}>;

export type McpOAuthProductionRoutePreflightResultV1 = Readonly<{
  kind: "mcp_oauth_production_route_preflight";
  decision: McpOAuthProductionRoutePreflightDecisionV1;
  allowedToWire: boolean;
  safeForModel: true;
  requiredFlags: Readonly<{
    runtimeFlagName: typeof MCP_OAUTH_PRODUCTION_RUNTIME_FLAG;
    approvedFlagName: typeof MCP_OAUTH_PRODUCTION_APPROVED_FLAG;
    routeWiringFlagName: typeof MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG;
    runtimeEnabled: boolean;
    approved: boolean;
    routeWiringEnabled: boolean;
    allRequired: true;
    version: 1;
  }>;
  provider: Readonly<{
    provider: "stytch" | "unavailable";
    configShape: "valid" | "invalid_or_missing";
    valuesExposed: false;
    version: 1;
  }>;
  operationalStatus: Readonly<{
    capability: "production_oauth_activation";
    agreesWithActivationConfig: boolean;
    enabled: boolean;
    configValid: boolean;
    featureState: McpOperationalStatusV1["featureState"];
    category?: McpOperationalStatusV1["category"];
    valuesExposed: false;
    version: 1;
  }>;
  capabilities: Readonly<{
    publicEndpointExposure: "not_exposed";
    routeRegistration: "not_registered";
    viteProductionRouteWiring: "blocked";
    hostedMcp: "blocked";
    providerCalls: "blocked";
    tokenExchange: "blocked";
    accountLinkCreation: "blocked";
    tokenStorage: "none";
    refreshTokenStorage: "none";
    ownerIdentifiers: "not_accepted";
    authorizationCodes: "not_accepted";
    providerSecrets: "not_accepted";
    version: 1;
  }>;
  version: 1;
}>;

export function buildMcpOAuthProductionRoutePreflight(
  input: McpOAuthProductionRoutePreflightInputV1 = {},
): McpOAuthProductionRoutePreflightResultV1 {
  const activationConfig = buildMcpOAuthProductionActivationConfig({
    flags: {
      runtime: input.flags?.runtime,
      approved: input.flags?.approved,
    },
    providerConfig: input.providerConfig,
  });
  const operationalStatus =
    buildMcpOperationalProductionOAuthActivationStatus(activationConfig);
  const runtimeEnabled = activationConfig.requiredFlags.runtimeValue === "1";
  const approved = activationConfig.requiredFlags.approvedValue === "1";
  const routeWiringEnabled = input.flags?.routeWiring === "1";
  const providerConfigValid = activationConfig.providerConfig !== undefined;
  const operationalStatusAgrees =
    providerConfigValid &&
    doesOperationalStatusAgreeWithActivationConfig(operationalStatus);
  const decision = decideRoutePreflight({
    runtimeEnabled,
    approved,
    routeWiringEnabled,
    providerConfigValid,
    operationalStatusAgrees,
  });

  return Object.freeze({
    kind: "mcp_oauth_production_route_preflight",
    decision,
    allowedToWire: decision === "ready_to_wire",
    safeForModel: true,
    requiredFlags: Object.freeze({
      runtimeFlagName: MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
      approvedFlagName: MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
      routeWiringFlagName: MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG,
      runtimeEnabled,
      approved,
      routeWiringEnabled,
      allRequired: true,
      version: 1,
    }),
    provider: Object.freeze({
      provider: providerConfigValid ? "stytch" : "unavailable",
      configShape: providerConfigValid ? "valid" : "invalid_or_missing",
      valuesExposed: false,
      version: 1,
    }),
    operationalStatus: Object.freeze({
      capability: "production_oauth_activation",
      agreesWithActivationConfig: operationalStatusAgrees,
      enabled: operationalStatus.enabled,
      configValid: operationalStatus.configValid,
      featureState: operationalStatus.featureState,
      ...(operationalStatus.category ? { category: operationalStatus.category } : {}),
      valuesExposed: false,
      version: 1,
    }),
    capabilities: Object.freeze({
      publicEndpointExposure: "not_exposed",
      routeRegistration: "not_registered",
      viteProductionRouteWiring: "blocked",
      hostedMcp: "blocked",
      providerCalls: "blocked",
      tokenExchange: "blocked",
      accountLinkCreation: "blocked",
      tokenStorage: "none",
      refreshTokenStorage: "none",
      ownerIdentifiers: "not_accepted",
      authorizationCodes: "not_accepted",
      providerSecrets: "not_accepted",
      version: 1,
    }),
    version: 1,
  });
}

function decideRoutePreflight(input: {
  runtimeEnabled: boolean;
  approved: boolean;
  routeWiringEnabled: boolean;
  providerConfigValid: boolean;
  operationalStatusAgrees: boolean;
}): McpOAuthProductionRoutePreflightDecisionV1 {
  if (!input.runtimeEnabled && !input.approved && !input.routeWiringEnabled) {
    return "disabled";
  }
  if (!input.runtimeEnabled) return "blocked_missing_runtime_flag";
  if (!input.approved) return "blocked_missing_approval_flag";
  if (!input.routeWiringEnabled) return "blocked_endpoint_exposure_not_enabled";
  if (!input.providerConfigValid || !input.operationalStatusAgrees) {
    return "blocked_misconfigured_provider";
  }
  return "ready_to_wire";
}

function doesOperationalStatusAgreeWithActivationConfig(
  status: McpOperationalStatusV1,
): boolean {
  return (
    status.kind === "mcp_operational_status" &&
    status.capability === "production_oauth_activation" &&
    status.enabled === true &&
    status.configValid === true &&
    status.featureState === "blocked" &&
    status.category === "auth_invalid" &&
    status.valuesExposed === false &&
    status.version === 1
  );
}
