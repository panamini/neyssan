import {
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  buildMcpProductionToolsListResult,
} from "./mcpProductionToolsListProjection";
import {
  handleMcpOAuthProductionRouteRequest,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
  type McpOAuthProductionAuthenticatedOwnerIdentityReaderV1,
  type McpOAuthProductionRouteAdapterConfigV1,
  type McpOAuthProductionRouteAdapterDependenciesV1,
  type McpOAuthProductionRouteAdapterResponseV1,
} from "./mcpOAuthProductionRouteAdapter";
import {
  validateMcpSafeSummaryBaselineV8,
  validateMcpSafeSummaryPostSeedDeltasV8,
  type McpSafeSummaryDeltaProofResultV8,
  type McpSafeSummaryPostSeedDeltaDiagnosticV8,
  type McpSafeSummarySnapshotV8,
} from "./mcpSafeSummaryDeltaProof";
import {
  MCP_SAFE_SUMMARY_PROOF_TOOLS,
  type McpSafeSummaryProofToolName,
  type McpSafeSummaryProofIdentityRole,
  type McpSafeSummaryProofEffectSnapshot,
} from "./mcpSafeSummaryProjectionProofHarness";
import type { McpSafeSummaryServerIdentityV1 } from "./mcpSafeSummaryServerSession";

export const MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID =
  "CC-20260724-mcp-safe-summary-live-adapter" as const;
export const MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION = 8 as const;

export type McpSafeSummaryLiveAdapterActivationV8 = Readonly<{
  environment: "development";
  enabled: true;
  contractId: typeof MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID;
  contractVersion: typeof MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION;
}>;

export type McpSafeSummaryLiveAdapterHandlerInputV8 = Readonly<{
  role: McpSafeSummaryProofIdentityRole;
  bearerCredential: string;
  toolName: McpSafeSummaryProofToolName;
  reference: Readonly<{ id: string }>;
}>;

export type McpSafeSummaryLiveAdapterHandlerV8 = (
  input: McpSafeSummaryLiveAdapterHandlerInputV8,
) => Promise<unknown>;

export type McpSafeSummaryLiveAdapterBaselineReaderV8 = (
  role: McpSafeSummaryProofIdentityRole,
  toolName: McpSafeSummaryProofToolName,
) => Promise<unknown>;

export type McpSafeSummaryLiveAdapterOperatorCredentialV8 = Readonly<{
  A: string;
  B: string;
}>;

export type McpSafeSummaryLiveAdapterEffectObservationV8 = Readonly<{
  retry: "NOT_OBSERVED";
  repair: "NOT_OBSERVED";
  fallback: "NOT_OBSERVED";
  provider: "NOT_OBSERVED";
  model: "NOT_OBSERVED";
  version: 1;
}>;

export type McpSafeSummaryFirstToolsCallDiagnosticV8 = Readonly<{
  kind: "mcp_safe_summary_first_tools_call_diagnostic";
  step: "FIRST_TOOLS_CALL";
  failureKind: "ROUTE_REJECTED" | "JSON_RPC_ERROR" | "RESULT_MALFORMED";
  httpStatus: number;
  publicReason?:
    | "dependency_unavailable"
    | "invalid_configuration"
    | "invalid_host"
    | "invalid_authorization_header"
    | "bearer_verification_caller_untrusted"
    | "bearer_verification_quota_denied"
    | "bearer_verification_failed"
    | "private_beta_gate_denied"
    | "launch_readiness_blocked";
  jsonRpcCode?: number;
  safeForLogging: true;
  version: 1;
}>;

export type McpSafeSummaryLiveAdapterResultV8 = Readonly<{
  contractId: typeof MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID;
  contractVersion: typeof MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION;
  completed: false;
  sequenceCompleted: boolean;
  liveCalls: boolean;
  proof: Readonly<{
    sequence: Readonly<{
      outcome: "PASS" | "STOPPED";
      stopCode?: McpSafeSummaryLiveAdapterStopCodeV8;
      protectedCallCount: number;
      seedCount: number;
      cleanupCount: number;
      recovery: "NOT_REQUIRED" | "RECOVERED" | "FAILED";
      baseline: "ACCEPTED" | "REJECTED";
      postSeedDelta: "ACCEPTED" | "REJECTED";
      postSeedDiagnostic?: McpSafeSummaryPostSeedDeltaDiagnosticV8;
      firstToolsCallDiagnostic?: McpSafeSummaryFirstToolsCallDiagnosticV8;
      version: 1;
    }>;
    effectObservation: McpSafeSummaryLiveAdapterEffectObservationV8;
    staticProof: Readonly<{
      kind: "STATIC_ONLY";
      exactQueryKindCount: 4;
      runtimeObservation: "NOT_OBSERVED";
      version: 1;
    }>;
    version: 8;
  }>;
  version: 1;
}>;

export type McpSafeSummaryLiveAdapterStopCodeV8 =
  | "INVALID_ACTIVATION"
  | "MISSING_OPERATOR_CREDENTIAL"
  | "DUPLICATE_OPERATOR_CREDENTIAL"
  | "OPERATOR_AUTH_FAILED"
  | "OPERATOR_IDENTITY_MISMATCH"
  | "TOOLS_LIST_FAILED"
  | "BASELINE_UNAVAILABLE"
  | "BASELINE_SATURATED"
  | "BASELINE_DRIFT"
  | "SEED_FAILED"
  | "SEED_COUNT_MISMATCH"
  | "PROTECTED_CALL_FAILED"
  | "PROTECTED_CALL_COUNT_MISMATCH"
  | "CLEANUP_FAILED"
  | "CLEANUP_COUNT_MISMATCH"
  | "RECOVERY_FAILED"
  | "SINGLE_FLIGHT"
  | "EFFECT_OBSERVER_FAILED";

export type McpSafeSummaryLiveAdapterInputV8 = Readonly<{
  activation: McpSafeSummaryLiveAdapterActivationV8;
  operatorCredentials: McpSafeSummaryLiveAdapterOperatorCredentialV8;
  configuredIdentities: Readonly<Record<
    McpSafeSummaryProofIdentityRole,
    McpSafeSummaryServerIdentityV1
  >>;
  verifyOperatorCredential: (
    role: McpSafeSummaryProofIdentityRole,
    bearerCredential: string,
  ) => Promise<McpSafeSummaryServerIdentityV1 | undefined>;
  listTools: () => Promise<unknown>;
  readBaseline: McpSafeSummaryLiveAdapterBaselineReaderV8;
  readPostSeed: McpSafeSummaryLiveAdapterBaselineReaderV8;
  resolveReference: (
    role: McpSafeSummaryProofIdentityRole,
    toolName: McpSafeSummaryProofToolName,
  ) => Promise<Readonly<{ id: string }> | undefined>;
  callToolsCall: McpSafeSummaryLiveAdapterHandlerV8;
  seedA: () => Promise<unknown>;
  cleanupA: () => Promise<unknown>;
  recover: () => Promise<boolean>;
  effectObservation?: () => Promise<McpSafeSummaryProofEffectSnapshot>;
}>;

let inFlight: Promise<McpSafeSummaryLiveAdapterResultV8> | undefined;

export function buildMcpSafeSummaryLiveAdapterV8(
  input: McpSafeSummaryLiveAdapterInputV8,
): Readonly<{ run: () => Promise<McpSafeSummaryLiveAdapterResultV8> }> {
  return Object.freeze({
    run: async () => {
      if (inFlight) return stopped("SINGLE_FLIGHT", 0, 0, 0, "NOT_REQUIRED");
      const run = runMcpSafeSummaryLiveAdapterV8(input);
      inFlight = run;
      try {
        return await run;
      } finally {
        if (inFlight === run) inFlight = undefined;
      }
    },
  });
}

export function buildMcpSafeSummaryLiveAdapterActivationV8(
  env: Readonly<Record<string, string | undefined>>,
): McpSafeSummaryLiveAdapterActivationV8 | undefined {
  if (env.NODE_ENV !== "development" || env.MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8 !== "1") {
    return undefined;
  }
  return Object.freeze({
    environment: "development" as const,
    enabled: true as const,
    contractId: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID,
    contractVersion: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION,
  });
}

export function buildMcpSafeSummaryLiveAdapterHandlerV8(input: Readonly<{
  config: McpOAuthProductionRouteAdapterConfigV1;
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1;
  host: string;
  remoteAddress: string;
}>): McpSafeSummaryLiveAdapterHandlerV8 {
  return async ({ bearerCredential, toolName, reference }) => {
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        method: "POST",
        path: MCP_OAUTH_PRODUCTION_MCP_PATH,
        url: MCP_OAUTH_PRODUCTION_MCP_PATH,
        remoteAddress: input.remoteAddress,
        headers: {
          authorization: `Bearer ${bearerCredential}`,
          host: input.host,
          origin: `https://${input.host}`,
          "mcp-protocol-version": "2025-11-25",
        },
        bodyText: JSON.stringify({
          jsonrpc: "2.0",
          id: `${toolName}:v8`,
          method: "tools/call",
          params: {
            name: toolName,
            arguments: argumentFor(toolName, reference.id),
          },
        }),
      },
      input.config,
      input.dependencies,
    );
    const diagnostic = classifyMcpSafeSummaryToolsCallResponseV8(response);
    if (diagnostic) {
      return Object.freeze({
        kind: "mcp_safe_summary_live_adapter_call_failure",
        diagnostic,
        version: 1 as const,
      });
    }
    return response.json;
  };
}

export function classifyMcpSafeSummaryToolsCallResponseV8(
  response: McpOAuthProductionRouteAdapterResponseV1,
): McpSafeSummaryFirstToolsCallDiagnosticV8 | undefined {
  return classifyToolsCallPayload(response.json, safeHttpStatus(response.status));
}

export function resolveMcpSafeSummaryLiveAdapterHostV8(
  canonicalResource: string | undefined,
): string | undefined {
  if (!canonicalResource) return undefined;
  try {
    const resource = new URL(canonicalResource);
    if (
      resource.protocol !== "https:" ||
      resource.username.length > 0 ||
      resource.password.length > 0
    ) {
      return undefined;
    }
    return resource.host;
  } catch {
    return undefined;
  }
}

export function buildMcpSafeSummaryLiveAdapterOAuthCredentialVerifierV8(input: Readonly<{
  readAuthenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityReaderV1;
  resolveOwnerProfileId: (twoweeksClerkId: string) => Promise<string | undefined>;
}>): McpSafeSummaryLiveAdapterInputV8["verifyOperatorCredential"] {
  return async (_role, bearerCredential) => {
    const authenticated = await input.readAuthenticatedOwnerIdentity({
      method: "POST",
      path: MCP_OAUTH_PRODUCTION_MCP_PATH,
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      headers: { authorization: `Bearer ${bearerCredential}` },
    });
    if (!authenticated) return undefined;
    const ownerProfileId = await input.resolveOwnerProfileId(authenticated.subject);
    if (!ownerProfileId) return undefined;
    return Object.freeze({
      subject: authenticated.subject,
      issuer: authenticated.issuer,
      ownerProfileId,
      version: 1 as const,
    });
  };
}

async function runMcpSafeSummaryLiveAdapterV8(
  input: McpSafeSummaryLiveAdapterInputV8,
): Promise<McpSafeSummaryLiveAdapterResultV8> {
  if (!isExactActivation(input.activation)) {
    return stopped("INVALID_ACTIVATION", 0, 0, 0, "NOT_REQUIRED");
  }

  let seedCount = 0;
  let cleanupCount = 0;
  let protectedCallCount = 0;
  let recovery: "NOT_REQUIRED" | "RECOVERED" | "FAILED" = "NOT_REQUIRED";
  let baseline: McpSafeSummarySnapshotV8 | undefined;
  let postSeed: McpSafeSummarySnapshotV8 | undefined;
  let stopCode: McpSafeSummaryLiveAdapterStopCodeV8 | undefined;
  let cleanupRequired = false;
  let baselineAccepted = false;
  let effectBaseline: McpSafeSummaryProofEffectSnapshot | undefined;
  let firstToolsCallDiagnostic: McpSafeSummaryFirstToolsCallDiagnosticV8 | undefined;
  let postSeedResult: McpSafeSummaryDeltaProofResultV8 | undefined;

  try {
    if (input.effectObservation) {
      try {
        effectBaseline = await input.effectObservation();
        if (!isZeroEffectSnapshot(effectBaseline)) stopCode = "EFFECT_OBSERVER_FAILED";
      } catch {
        stopCode = "EFFECT_OBSERVER_FAILED";
      }
    }
    if (stopCode) return finish();
    if (!hasCredential(input.operatorCredentials.A) || !hasCredential(input.operatorCredentials.B)) {
      stopCode = "MISSING_OPERATOR_CREDENTIAL";
      return finish();
    }
    if (input.operatorCredentials.A === input.operatorCredentials.B) {
      stopCode = "DUPLICATE_OPERATOR_CREDENTIAL";
      return finish();
    }
    if (sameIdentity(input.configuredIdentities.A, input.configuredIdentities.B)) {
      stopCode = "OPERATOR_IDENTITY_MISMATCH";
      return finish();
    }
    if (!await isConfiguredOperator(input, "A") || !await isConfiguredOperator(input, "B")) {
      stopCode = "OPERATOR_AUTH_FAILED";
      return finish();
    }

    try {
      if (!isToolsList(input, await input.listTools())) stopCode = "TOOLS_LIST_FAILED";
    } catch {
      stopCode = "TOOLS_LIST_FAILED";
    }
    if (stopCode) return finish();

    let baselineB: McpSafeSummarySnapshotV8["B"];
    let baselineA: McpSafeSummarySnapshotV8["A"];
    try {
      baselineA = await readSnapshot(input, "A");
      baselineB = await readSnapshot(input, "B");
    } catch {
      stopCode = "BASELINE_UNAVAILABLE";
      return finish();
    }
    baseline = mergeSnapshots(baselineA, baselineB);
    const baselineResult = validateMcpSafeSummaryBaselineV8(baseline);
    if (!baselineResult.accepted) {
      stopCode = baselineResult.reason;
      return finish();
    }
    baselineAccepted = true;

    cleanupRequired = true;
    let seedResult: unknown;
    try {
      seedResult = await input.seedA();
    } catch {
      stopCode = "SEED_FAILED";
      return finish();
    }
    if (!isExpectedSeed(seedResult)) {
      stopCode = "SEED_COUNT_MISMATCH";
      return finish();
    }
    seedCount = 3;

    const postA = await callAllTools(input, "A", input.operatorCredentials.A, () => {
      protectedCallCount += 1;
    });
    if (!postA) {
      stopCode = "PROTECTED_CALL_FAILED";
      return finish();
    }
    const postB = await callAllTools(input, "B", input.operatorCredentials.B, () => {
      protectedCallCount += 1;
    });
    if (!postB) {
      stopCode = "PROTECTED_CALL_FAILED";
      return finish();
    }
    postSeed = mergeSnapshots(postA, postB);
    if (protectedCallCount !== 8) {
      stopCode = "PROTECTED_CALL_COUNT_MISMATCH";
      return finish();
    }
    if (!await isConfiguredOperator(input, "A")) {
      stopCode = "OPERATOR_IDENTITY_MISMATCH";
      return finish();
    }

    postSeedResult = validateMcpSafeSummaryPostSeedDeltasV8(baseline, postSeed);
    if (!postSeedResult.accepted) {
      stopCode = postSeedResult.reason;
      return finish();
    }
  } catch (error) {
    if (protectedCallCount === 1) {
      firstToolsCallDiagnostic = readToolsCallFailureDiagnostic(error);
    }
    stopCode ??= "PROTECTED_CALL_FAILED";
  }
  return finish();

  async function finish(): Promise<McpSafeSummaryLiveAdapterResultV8> {
    if (cleanupRequired) {
      try {
        const result = await input.cleanupA();
        if (!isExpectedCleanup(result)) stopCode ??= "CLEANUP_COUNT_MISMATCH";
        else cleanupCount = 3;
      } catch {
        stopCode ??= "CLEANUP_FAILED";
      }
      cleanupRequired = false;
    }
    try {
      recovery = (await input.recover()) ? "RECOVERED" : "FAILED";
      if (recovery === "FAILED") stopCode ??= "RECOVERY_FAILED";
    } catch {
      recovery = "FAILED";
      stopCode ??= "RECOVERY_FAILED";
    }
    if (!await hasNoObservedEffects(input, effectBaseline)) {
      stopCode ??= "EFFECT_OBSERVER_FAILED";
    }
    const sequenceCompleted = stopCode === undefined &&
      protectedCallCount === 8 && seedCount === 3 && cleanupCount === 3 && recovery === "RECOVERED";
    const effectObservation = emptyEffectObservation();
    return Object.freeze({
      contractId: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID,
      contractVersion: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION,
      completed: false as const,
      sequenceCompleted,
      liveCalls: protectedCallCount === 8,
      proof: Object.freeze({
        sequence: Object.freeze({
          outcome: sequenceCompleted ? "PASS" as const : "STOPPED" as const,
          ...(stopCode ? { stopCode } : {}),
          protectedCallCount,
          seedCount,
          cleanupCount,
          recovery,
          baseline: baselineAccepted ? "ACCEPTED" as const : "REJECTED" as const,
          postSeedDelta: postSeedResult?.accepted ? "ACCEPTED" as const : "REJECTED" as const,
          ...(postSeedResult && !postSeedResult.accepted && postSeedResult.diagnostic
            ? { postSeedDiagnostic: postSeedResult.diagnostic }
            : {}),
          ...(firstToolsCallDiagnostic ? { firstToolsCallDiagnostic } : {}),
          version: 1 as const,
        }),
        effectObservation,
        staticProof: Object.freeze({
          kind: "STATIC_ONLY" as const,
          exactQueryKindCount: 4,
          runtimeObservation: "NOT_OBSERVED" as const,
          version: 1 as const,
        }),
        version: 8 as const,
      }),
      version: 1 as const,
    });
  }
}

async function isConfiguredOperator(
  input: McpSafeSummaryLiveAdapterInputV8,
  role: McpSafeSummaryProofIdentityRole,
): Promise<boolean> {
  const credential = input.operatorCredentials[role];
  if (!hasCredential(credential)) return false;
  try {
    const authenticated = await input.verifyOperatorCredential(role, credential);
    const configured = input.configuredIdentities[role];
    return authenticated !== undefined && sameIdentity(authenticated, configured);
  } catch {
    return false;
  }
}

async function readSnapshot(
  input: McpSafeSummaryLiveAdapterInputV8,
  role: McpSafeSummaryProofIdentityRole,
): Promise<McpSafeSummarySnapshotV8[typeof role]> {
  const result: Partial<Record<
    McpSafeSummaryProofToolName,
    Readonly<Record<string, unknown>>
  >> = {};
  for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
    result[toolName] = asBaselineSummary(await input.readBaseline(role, toolName));
  }
  return Object.freeze(result) as McpSafeSummarySnapshotV8[typeof role];
}

async function callAllTools(
  input: McpSafeSummaryLiveAdapterInputV8,
  role: McpSafeSummaryProofIdentityRole,
  bearerCredential: string,
  onCall: () => void,
): Promise<McpSafeSummarySnapshotV8[typeof role] | undefined> {
  const result: Partial<Record<
    McpSafeSummaryProofToolName,
    Readonly<Record<string, unknown>>
  >> = {};
  for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
    const reference = await input.resolveReference(role, toolName);
    if (!reference) return undefined;
    onCall();
    const response = await input.callToolsCall({ role, bearerCredential, toolName, reference });
    asToolsCallSummary(response);
    result[toolName] = asBaselineSummary(await input.readPostSeed(role, toolName));
  }
  return Object.freeze(result) as McpSafeSummarySnapshotV8[typeof role];
}

function asBaselineSummary(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new Error("summary_missing");
  const structured = isRecord(value.structuredContent)
    ? value.structuredContent
    : isRecord(value.result) && isRecord(value.result.structuredContent)
      ? value.result.structuredContent
      : value;
  if (!isRecord(structured)) throw new Error("summary_malformed");
  return structured;
}

function asToolsCallSummary(value: unknown): Readonly<Record<string, unknown>> {
  const failureDiagnostic = readToolsCallFailureEnvelopeDiagnostic(value);
  if (failureDiagnostic) throw new McpSafeSummaryToolsCallFailure(failureDiagnostic);
  const diagnostic = classifyToolsCallPayload(value, 200);
  if (diagnostic) throw new McpSafeSummaryToolsCallFailure(diagnostic);
  if (!isRecord(value) || !isRecord(value.result) || !isRecord(value.result.structuredContent)) {
    throw new Error("tools_call_result_malformed");
  }
  return value.result.structuredContent;
}

class McpSafeSummaryToolsCallFailure extends Error {
  readonly diagnostic: McpSafeSummaryFirstToolsCallDiagnosticV8;

  constructor(diagnostic: McpSafeSummaryFirstToolsCallDiagnosticV8) {
    super("mcp_safe_summary_tools_call_failed");
    this.name = "McpSafeSummaryToolsCallFailure";
    this.diagnostic = diagnostic;
  }
}

function readToolsCallFailureDiagnostic(
  error: unknown,
): McpSafeSummaryFirstToolsCallDiagnosticV8 | undefined {
  return error instanceof McpSafeSummaryToolsCallFailure
    ? error.diagnostic
    : undefined;
}

function classifyToolsCallPayload(
  value: unknown,
  httpStatus: number,
): McpSafeSummaryFirstToolsCallDiagnosticV8 | undefined {
  if (isRecord(value)) {
    const publicReason = readPublicRouteReason(value.reason);
    if (publicReason) {
      return firstToolsCallDiagnostic("ROUTE_REJECTED", httpStatus, {
        publicReason,
      });
    }
    if (value.jsonrpc === "2.0" && isRecord(value.error)) {
      const jsonRpcCode = readSafeJsonRpcCode(value.error.code);
      return firstToolsCallDiagnostic("JSON_RPC_ERROR", httpStatus, {
        ...(jsonRpcCode !== undefined ? { jsonRpcCode } : {}),
      });
    }
    if (
      value.jsonrpc === "2.0" &&
      isRecord(value.result) &&
      isRecord(value.result.structuredContent)
    ) {
      return undefined;
    }
  }
  return firstToolsCallDiagnostic("RESULT_MALFORMED", httpStatus);
}

function firstToolsCallDiagnostic(
  failureKind: McpSafeSummaryFirstToolsCallDiagnosticV8["failureKind"],
  httpStatus: number,
  details: Readonly<{
    publicReason?: McpSafeSummaryFirstToolsCallDiagnosticV8["publicReason"];
    jsonRpcCode?: number;
  }> = {},
): McpSafeSummaryFirstToolsCallDiagnosticV8 {
  return Object.freeze({
    kind: "mcp_safe_summary_first_tools_call_diagnostic" as const,
    step: "FIRST_TOOLS_CALL" as const,
    failureKind,
    httpStatus,
    ...details,
    safeForLogging: true as const,
    version: 1 as const,
  });
}

function readToolsCallFailureEnvelopeDiagnostic(
  value: unknown,
): McpSafeSummaryFirstToolsCallDiagnosticV8 | undefined {
  if (
    !isRecord(value) ||
    value.kind !== "mcp_safe_summary_live_adapter_call_failure" ||
    !isRecord(value.diagnostic) ||
    value.version !== 1
  ) {
    return undefined;
  }
  const diagnostic = value.diagnostic;
  const failureKind = diagnostic.failureKind === "ROUTE_REJECTED" ||
    diagnostic.failureKind === "JSON_RPC_ERROR" ||
    diagnostic.failureKind === "RESULT_MALFORMED"
    ? diagnostic.failureKind
    : undefined;
  if (
    diagnostic.kind !== "mcp_safe_summary_first_tools_call_diagnostic" ||
    diagnostic.step !== "FIRST_TOOLS_CALL" ||
    !failureKind ||
    typeof diagnostic.httpStatus !== "number" ||
    diagnostic.safeForLogging !== true ||
    diagnostic.version !== 1
  ) {
    return undefined;
  }
  const publicReason = readPublicRouteReason(diagnostic.publicReason);
  const jsonRpcCode = readSafeJsonRpcCode(diagnostic.jsonRpcCode);
  return firstToolsCallDiagnostic(failureKind, safeHttpStatus(diagnostic.httpStatus), {
    ...(publicReason ? { publicReason } : {}),
    ...(jsonRpcCode !== undefined ? { jsonRpcCode } : {}),
  });
}

function safeHttpStatus(value: number): number {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : 0;
}

function readSafeJsonRpcCode(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= -32_768 &&
    value <= -32_000
    ? value
    : undefined;
}

function readPublicRouteReason(
  value: unknown,
): McpSafeSummaryFirstToolsCallDiagnosticV8["publicReason"] | undefined {
  switch (value) {
    case "dependency_unavailable":
    case "invalid_configuration":
    case "invalid_host":
    case "invalid_authorization_header":
    case "bearer_verification_caller_untrusted":
    case "bearer_verification_quota_denied":
    case "bearer_verification_failed":
    case "private_beta_gate_denied":
    case "launch_readiness_blocked":
      return value;
    default:
      return undefined;
  }
}

function mergeSnapshots(
  left: McpSafeSummarySnapshotV8["A"],
  right: McpSafeSummarySnapshotV8["A"],
): McpSafeSummarySnapshotV8 {
  return Object.freeze({ A: left, B: right });
}

function argumentFor(toolName: McpSafeSummaryProofToolName, id: string): Readonly<Record<string, unknown>> {
  const key = toolName === "twoweeks.application_package.summarize"
    ? "applicationPackageRef"
    : toolName === "twoweeks.evidence_graph.summarize"
      ? "evidenceGraphRef"
      : toolName === "twoweeks.resume_variant_plan.summarize"
        ? "resumeVariantPlanRef"
        : "reviewCockpitRef";
  return Object.freeze({ [key]: Object.freeze({ id }) });
}

function isToolsList(input: McpSafeSummaryLiveAdapterInputV8, value: unknown): boolean {
  if (value === undefined || input.listTools === undefined) return false;
  try {
    ListToolsResultSchema.parse(value);
  } catch {
    return false;
  }
  return structurallyEqual(value, buildMcpProductionToolsListResult());
}

function isExpectedSeed(value: unknown): boolean {
  return isRecord(value) && value.status === "ready" && value.createdCount === 3 &&
    value.reusedCount === 0 && value.expectedCount === 3 && value.ownerBound === true && value.version === 1;
}

function isExpectedCleanup(value: unknown): boolean {
  return isRecord(value) && value.status === "clean" && value.deletedCount === 3 &&
    value.residualCount === 0 && value.expectedCount === 3 && value.ownerBound === true && value.version === 1;
}

function sameIdentity(
  left: McpSafeSummaryServerIdentityV1,
  right: McpSafeSummaryServerIdentityV1,
): boolean {
  return left.subject === right.subject && left.issuer === right.issuer &&
    left.ownerProfileId === right.ownerProfileId && left.version === 1 && right.version === 1;
}

function hasCredential(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("\n");
}

async function hasNoObservedEffects(
  input: McpSafeSummaryLiveAdapterInputV8,
  baseline: McpSafeSummaryProofEffectSnapshot | undefined,
): Promise<boolean> {
  if (!input.effectObservation) return true;
  if (!baseline || !isZeroEffectSnapshot(baseline)) return false;
  try {
    return isZeroEffectSnapshot(await input.effectObservation());
  } catch {
    return false;
  }
}

function emptyEffectObservation(): McpSafeSummaryLiveAdapterEffectObservationV8 {
  return Object.freeze({
    retry: "NOT_OBSERVED" as const,
    repair: "NOT_OBSERVED" as const,
    fallback: "NOT_OBSERVED" as const,
    provider: "NOT_OBSERVED" as const,
    model: "NOT_OBSERVED" as const,
    version: 1 as const,
  });
}

function isZeroEffectSnapshot(value: McpSafeSummaryProofEffectSnapshot): boolean {
  return value.version === 1 &&
    value.retryCount === 0 &&
    value.repairCount === 0 &&
    value.fallbackCount === 0 &&
    value.providerCallCount === 0 &&
    value.modelCallCount === 0;
}

function stopped(
  stopCode: McpSafeSummaryLiveAdapterStopCodeV8,
  protectedCallCount: number,
  seedCount: number,
  cleanupCount: number,
  recovery: "NOT_REQUIRED" | "RECOVERED" | "FAILED",
): McpSafeSummaryLiveAdapterResultV8 {
  return Object.freeze({
    contractId: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID,
    contractVersion: MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION,
    completed: false as const,
    sequenceCompleted: false,
    liveCalls: protectedCallCount === 8,
    proof: Object.freeze({
      sequence: Object.freeze({ outcome: "STOPPED" as const, stopCode, protectedCallCount, seedCount, cleanupCount, recovery, baseline: "REJECTED" as const, postSeedDelta: "REJECTED" as const, version: 1 as const }),
      effectObservation: Object.freeze({ retry: "NOT_OBSERVED" as const, repair: "NOT_OBSERVED" as const, fallback: "NOT_OBSERVED" as const, provider: "NOT_OBSERVED" as const, model: "NOT_OBSERVED" as const, version: 1 as const }),
      staticProof: Object.freeze({ kind: "STATIC_ONLY" as const, exactQueryKindCount: 4, runtimeObservation: "NOT_OBSERVED" as const, version: 1 as const }),
      version: 8 as const,
    }),
    version: 1 as const,
  });
}

function isExactActivation(value: McpSafeSummaryLiveAdapterActivationV8): boolean {
  return value.environment === "development" && value.enabled === true &&
    value.contractId === MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_ID &&
    value.contractVersion === MCP_SAFE_SUMMARY_LIVE_ADAPTER_CONTRACT_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && structurallyEqual(left[key], right[key])
  );
}
