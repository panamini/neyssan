import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
  buildMcpOAuthProductionActivationConfig,
  type McpOAuthProductionActivationDependenciesV1,
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
  | "blocked_missing_activation_dependency"
  | "ready_to_wire";

export type McpOAuthProductionRoutePreflightFlagsV1 = Readonly<{
  runtime?: string;
  approved?: string;
  routeWiring?: string;
}>;

export type McpOAuthProductionRoutePreflightInputV1 = Readonly<{
  flags?: McpOAuthProductionRoutePreflightFlagsV1;
  providerConfig?: Partial<McpOAuthProductionProviderConfigV1>;
  activationDependencies?: Partial<McpOAuthProductionActivationDependenciesV1>;
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
  activationDependencies: Readonly<{
    providerAdapterAvailable: boolean;
    accountLinkLifecycleAvailable: boolean;
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
  const activationDependencies = readActivationDependencyReadiness(input.activationDependencies);
  const decision = decideRoutePreflight({
    runtimeEnabled,
    approved,
    routeWiringEnabled,
    providerConfigValid,
    operationalStatusAgrees,
    activationDependenciesReady: activationDependencies.ready,
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
    activationDependencies: Object.freeze({
      providerAdapterAvailable: activationDependencies.providerAdapterAvailable,
      accountLinkLifecycleAvailable: activationDependencies.accountLinkLifecycleAvailable,
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
  activationDependenciesReady: boolean;
}): McpOAuthProductionRoutePreflightDecisionV1 {
  const blockedDecision = (
    [
      [isFullyDisabled(input), "disabled"],
      [!input.runtimeEnabled, "blocked_missing_runtime_flag"],
      [!input.approved, "blocked_missing_approval_flag"],
      [!input.routeWiringEnabled, "blocked_endpoint_exposure_not_enabled"],
      [isProviderOrStatusMisconfigured(input), "blocked_misconfigured_provider"],
      [!input.activationDependenciesReady, "blocked_missing_activation_dependency"],
    ] as const
  ).find(([blocked]) => blocked)?.[1];
  return blockedDecision ?? "ready_to_wire";
}

function isFullyDisabled(input: {
  runtimeEnabled: boolean;
  approved: boolean;
  routeWiringEnabled: boolean;
}): boolean {
  return !input.runtimeEnabled && !input.approved && !input.routeWiringEnabled;
}

function isProviderOrStatusMisconfigured(input: {
  providerConfigValid: boolean;
  operationalStatusAgrees: boolean;
}): boolean {
  return !input.providerConfigValid || !input.operationalStatusAgrees;
}

function readActivationDependencyReadiness(
  dependencies: Partial<McpOAuthProductionActivationDependenciesV1> | undefined,
): {
  ready: boolean;
  providerAdapterAvailable: boolean;
  accountLinkLifecycleAvailable: boolean;
} {
  const providerAdapter = dependencies?.providerAdapter;
  const providerAdapterAvailable =
    providerAdapter?.provider === "stytch" &&
    providerAdapter.version === 1 &&
    typeof providerAdapter.exchangeAuthorizationCode === "function";
  const accountLinkLifecycleAvailable =
    typeof dependencies?.executeAccountLinkLifecycle === "function";
  return {
    ready: providerAdapterAvailable && accountLinkLifecycleAvailable,
    providerAdapterAvailable,
    accountLinkLifecycleAvailable,
  };
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
