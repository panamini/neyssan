import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  buildMcpProductionReadonlySummaryOutputSchemaV2,
  MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
  type McpProductionReadonlySummaryJsonSchemaV2,
  type McpProductionReadonlySummaryResultV2,
} from "./mcpProductionReadonlySummaryProjectorV2";
import { buildMcpProductionToolsListResult } from "./mcpProductionToolsListProjection";

export const MCP_SAFE_SUMMARY_PROOF_TOOLS = Object.freeze([
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
] as const);

export type McpSafeSummaryProofToolName =
  (typeof MCP_SAFE_SUMMARY_PROOF_TOOLS)[number];
export type McpSafeSummaryProofIdentityRole = "A" | "B";

type IdentityRelation = "INITIAL" | "DISTINCT_FROM_INITIAL_A" | "SAME_AS_INITIAL_A";
type AcceptedStatus = McpProductionReadonlySummaryResultV2["status"];

export type McpSafeSummaryIdentityAttestation = Readonly<{
  role: McpSafeSummaryProofIdentityRole;
  verified: boolean;
  relationToInitialA: IdentityRelation;
  version: 1;
}>;

export type McpSafeSummaryProofAdapter = Readonly<{
  prepare: () => Promise<Readonly<{ status: "ready"; runtimeStarted: boolean; version: 1 }>>;
  listTools: () => Promise<unknown>;
  enterIdentity: (
    role: McpSafeSummaryProofIdentityRole,
  ) => Promise<McpSafeSummaryIdentityAttestation>;
  seedA: () => Promise<unknown>;
  /**
   * Must return JSON-compatible data only; exotic runtime values are rejected
   * as RESULT_ENVELOPE_MISMATCH so scanning stays deterministic and fail-closed.
   */
  callTool: (
    role: McpSafeSummaryProofIdentityRole,
    toolName: McpSafeSummaryProofToolName,
  ) => Promise<unknown>;
  cleanupA: () => Promise<unknown>;
  recover: () => Promise<Readonly<{ status: "recovered"; version: 1 }>>;
}>;

export type McpSafeSummaryProofEffectSnapshot = Readonly<{
  retryCount: number;
  repairCount: number;
  fallbackCount: number;
  providerCallCount: number;
  modelCallCount: number;
  version: 1;
}>;

export type McpSafeSummaryProofEffectObserver = Readonly<{
  independence: "separate_monotonic_ledger";
  snapshot: () => Promise<McpSafeSummaryProofEffectSnapshot>;
}>;

export type McpSafeSummaryProofCallLedgerEntry = Readonly<{
  ordinal: number;
  role: McpSafeSummaryProofIdentityRole;
  toolName: McpSafeSummaryProofToolName;
  status: AcceptedStatus;
  dataBearing: boolean;
}>;

export type McpSafeSummaryProofStopCode =
  | "PREPARE_FAILED"
  | "TOOLS_LIST_FAILED"
  | "TOOLS_LIST_NOT_V2"
  | "IDENTITY_A_NOT_VERIFIED"
  | "IDENTITY_B_NOT_DISTINCT"
  | "IDENTITY_A_RETURN_MISMATCH"
  | "SEED_FAILED"
  | "SEED_COUNT_MISMATCH"
  | "PROTECTED_CALL_FAILED"
  | "RESULT_LIMIT_EXCEEDED"
  | "RESULT_FORBIDDEN_CONTENT"
  | "RESULT_ENVELOPE_MISMATCH"
  | "RESULT_STATUS_REJECTED"
  | "A_DATA_PROOF_MISSING"
  | "EFFECT_OBSERVER_FAILED"
  | "EFFECT_BUDGET_EXCEEDED"
  | "CLEANUP_FAILED"
  | "CLEANUP_COUNT_MISMATCH"
  | "RECOVERY_FAILED";

export type McpSafeSummaryProofLedger = Readonly<{
  outcome: "PASS" | "STOPPED";
  stopCode?: McpSafeSummaryProofStopCode;
  seedCount: number;
  cleanupCount: number;
  protectedCallCount: number;
  retryCount: number;
  repairCount: number;
  fallbackCount: number;
  providerCallCount: number;
  modelCallCount: number;
  authTransitionCount: number;
  toolsListCount: number;
  recovery: "NOT_REQUIRED" | "RECOVERED" | "FAILED";
  calls: readonly McpSafeSummaryProofCallLedgerEntry[];
  version: 1;
}>;

type MutableLedger = {
  outcome: "PASS" | "STOPPED";
  stopCode?: McpSafeSummaryProofStopCode;
  seedCount: number;
  cleanupCount: number;
  protectedCallCount: number;
  retryCount: number;
  repairCount: number;
  fallbackCount: number;
  providerCallCount: number;
  modelCallCount: number;
  authTransitionCount: number;
  toolsListCount: number;
  recovery: "NOT_REQUIRED" | "RECOVERED" | "FAILED";
  calls: McpSafeSummaryProofCallLedgerEntry[];
};

type SanitizedResult = Readonly<{
  status: AcceptedStatus;
  dataBearing: boolean;
}>;

type Stop = Readonly<{
  stopCode: McpSafeSummaryProofStopCode;
}>;

const MAX_RESULT_DEPTH = 8;
const MAX_RESULT_NODES = 256;
const MAX_OBJECT_KEYS = 32;
const MAX_ARRAY_LENGTH = 64;
const MAX_STRING_LENGTH = 512;
const FORBIDDEN_KEY = /(?:authorization|bearer|clientsecret|clerk|email|owner|password|subject|token)/i;
const ACCEPTED_A_STATUSES = new Set<AcceptedStatus>([
  "OK",
  "NO_DATA",
  "ONBOARDING_REQUIRED",
]);
const ACCEPTED_B_STATUSES = new Set<AcceptedStatus>([
  "NO_DATA",
  "ONBOARDING_REQUIRED",
]);

export async function runMcpSafeSummaryProjectionProof(input: Readonly<{
  adapter: McpSafeSummaryProofAdapter;
  effectObserver?: McpSafeSummaryProofEffectObserver;
  forbiddenSubstrings?: readonly string[];
}>): Promise<McpSafeSummaryProofLedger> {
  const ledger: MutableLedger = {
    outcome: "PASS",
    seedCount: 0,
    cleanupCount: 0,
    protectedCallCount: 0,
    retryCount: 0,
    repairCount: 0,
    fallbackCount: 0,
    providerCallCount: 0,
    modelCallCount: 0,
    authTransitionCount: 0,
    toolsListCount: 0,
    recovery: "NOT_REQUIRED",
    calls: [],
  };
  let runtimeStarted = false;
  let cleanupRequired = false;
  let primaryStop: Stop | undefined;
  let effectBaseline: McpSafeSummaryProofEffectSnapshot;

  if (input.effectObserver) {
    if (input.effectObserver.independence !== "separate_monotonic_ledger") {
      ledger.outcome = "STOPPED";
      ledger.stopCode = "EFFECT_OBSERVER_FAILED";
      return freezeLedger(ledger);
    }
    try {
      const observedBaseline = await input.effectObserver.snapshot();
      if (!isEffectSnapshot(observedBaseline)) {
        ledger.outcome = "STOPPED";
        ledger.stopCode = "EFFECT_OBSERVER_FAILED";
        return freezeLedger(ledger);
      }
      effectBaseline = copyEffectSnapshot(observedBaseline);
    } catch {
      ledger.outcome = "STOPPED";
      ledger.stopCode = "EFFECT_OBSERVER_FAILED";
      return freezeLedger(ledger);
    }
  }

  try {
    runtimeStarted = true;
    let prepared: Awaited<ReturnType<McpSafeSummaryProofAdapter["prepare"]>>;
    try {
      prepared = await input.adapter.prepare();
    } catch {
      primaryStop = stop("PREPARE_FAILED");
      return await finish();
    }
    if (!hasExactKeys(prepared, ["runtimeStarted", "status", "version"]) ||
        prepared.status !== "ready" ||
        prepared.version !== 1 ||
        typeof prepared.runtimeStarted !== "boolean") {
      primaryStop = stop("PREPARE_FAILED");
      return await finish();
    }
    runtimeStarted = prepared.runtimeStarted;

    ledger.toolsListCount += 1;
    let toolsList: unknown;
    try {
      toolsList = await input.adapter.listTools();
    } catch {
      primaryStop = stop("TOOLS_LIST_FAILED");
      return await finish();
    }
    if (!isExpectedV2ToolsList(toolsList)) {
      primaryStop = stop("TOOLS_LIST_NOT_V2");
      return await finish();
    }

    if (!await attest("A", "INITIAL", "IDENTITY_A_NOT_VERIFIED")) {
      return await finish();
    }

    cleanupRequired = true;
    let seedResult: unknown;
    try {
      seedResult = await input.adapter.seedA();
    } catch {
      primaryStop = stop("SEED_FAILED");
      return await finish();
    }
    if (!isExpectedSeedResult(seedResult)) {
      primaryStop = stop("SEED_COUNT_MISMATCH");
      return await finish();
    }
    ledger.seedCount = 3;

    for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
      if (!await protectedCall("A", toolName)) return await finish();
    }
    if (!ledger.calls.some((entry) => entry.role === "A" &&
        entry.status === "OK" &&
        entry.dataBearing)) {
      primaryStop = stop("A_DATA_PROOF_MISSING");
      return await finish();
    }

    if (!await attest("B", "DISTINCT_FROM_INITIAL_A", "IDENTITY_B_NOT_DISTINCT")) {
      return await finish();
    }
    for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
      if (!await protectedCall("B", toolName)) return await finish();
    }

    if (!await attest("A", "SAME_AS_INITIAL_A", "IDENTITY_A_RETURN_MISMATCH")) {
      return await finish();
    }
    return await finish();
  } catch {
    primaryStop ??= stop("PREPARE_FAILED");
    return await finish();
  }

  async function attest(
    role: McpSafeSummaryProofIdentityRole,
    relationToInitialA: IdentityRelation,
    stopCode: McpSafeSummaryProofStopCode,
  ): Promise<boolean> {
    let attestation: McpSafeSummaryIdentityAttestation;
    try {
      attestation = await input.adapter.enterIdentity(role);
    } catch {
      primaryStop = stop(stopCode);
      return false;
    }
    if (!hasExactKeys(attestation, ["relationToInitialA", "role", "verified", "version"]) ||
        attestation.role !== role ||
        attestation.verified !== true ||
        attestation.relationToInitialA !== relationToInitialA ||
        attestation.version !== 1) {
      primaryStop = stop(stopCode);
      return false;
    }
    ledger.authTransitionCount += 1;
    return true;
  }

  async function protectedCall(
    role: McpSafeSummaryProofIdentityRole,
    toolName: McpSafeSummaryProofToolName,
  ): Promise<boolean> {
    if (ledger.protectedCallCount >= 8) {
      primaryStop = stop("PROTECTED_CALL_FAILED");
      return false;
    }
    ledger.protectedCallCount += 1;
    let rawResult: unknown;
    try {
      rawResult = await input.adapter.callTool(role, toolName);
    } catch {
      primaryStop = stop("PROTECTED_CALL_FAILED");
      return false;
    }
    let sanitized: SanitizedResult | Stop;
    try {
      sanitized = sanitizeResult(
        rawResult,
        role,
        toolName,
        input.forbiddenSubstrings ?? [],
      );
    } catch {
      sanitized = stop("RESULT_ENVELOPE_MISMATCH");
    }
    rawResult = undefined;
    if ("stopCode" in sanitized) {
      primaryStop = sanitized;
      return false;
    }
    ledger.calls.push(Object.freeze({
      ordinal: ledger.protectedCallCount,
      role,
      toolName,
      status: sanitized.status,
      dataBearing: sanitized.dataBearing,
    }));
    return true;
  }

  async function finish(): Promise<McpSafeSummaryProofLedger> {
    if (cleanupRequired) {
      try {
        const cleanupResult = await input.adapter.cleanupA();
        if (isExpectedCleanupResult(cleanupResult)) {
          ledger.cleanupCount = 3;
        } else {
          primaryStop ??= stop("CLEANUP_COUNT_MISMATCH");
        }
      } catch {
        primaryStop ??= stop("CLEANUP_FAILED");
      }
      cleanupRequired = false;
    }
    if (runtimeStarted) {
      try {
        const recovery = await input.adapter.recover();
        if (hasExactKeys(recovery, ["status", "version"]) &&
            recovery.status === "recovered" &&
            recovery.version === 1) {
          ledger.recovery = "RECOVERED";
        } else {
          ledger.recovery = "FAILED";
          primaryStop ??= stop("RECOVERY_FAILED");
        }
      } catch {
        ledger.recovery = "FAILED";
        primaryStop ??= stop("RECOVERY_FAILED");
      }
      runtimeStarted = false;
    }
    if (input.effectObserver) {
      try {
        const observedFinal = await input.effectObserver.snapshot();
        if (!isEffectSnapshot(observedFinal) ||
            !applyEffectDelta(
              ledger,
              effectBaseline,
              copyEffectSnapshot(observedFinal),
            )) {
          primaryStop ??= stop("EFFECT_OBSERVER_FAILED");
        } else if (ledger.retryCount !== 0 ||
            ledger.repairCount !== 0 ||
            ledger.fallbackCount !== 0 ||
            ledger.providerCallCount !== 0 ||
            ledger.modelCallCount !== 0) {
          primaryStop ??= stop("EFFECT_BUDGET_EXCEEDED");
        }
      } catch {
        primaryStop ??= stop("EFFECT_OBSERVER_FAILED");
      }
    }
    ledger.outcome = primaryStop ? "STOPPED" : "PASS";
    ledger.stopCode = primaryStop?.stopCode;
    return freezeLedger(ledger);
  }
}

function isExpectedV2ToolsList(value: unknown): boolean {
  try {
    ListToolsResultSchema.parse(value);
  } catch {
    return false;
  }
  return structurallyEqual(value, buildMcpProductionToolsListResult());
}

function sanitizeResult(
  value: unknown,
  role: McpSafeSummaryProofIdentityRole,
  toolName: McpSafeSummaryProofToolName,
  forbiddenSubstrings: readonly string[],
): SanitizedResult | Stop {
  const scan = scanResult(value, forbiddenSubstrings);
  if ("stopCode" in scan) return scan;
  if (scan.candidates.length !== 1) return stop("RESULT_ENVELOPE_MISMATCH");
  const candidate = scan.candidates[0];
  if (candidate.toolName !== toolName || candidate.version !== 2) {
    return stop("RESULT_ENVELOPE_MISMATCH");
  }
  if (!matchesSchema(
    candidate,
    buildMcpProductionReadonlySummaryOutputSchemaV2(toolName),
  )) {
    return stop("RESULT_ENVELOPE_MISMATCH");
  }
  const status = candidate.status;
  if (!isAcceptedStatus(status)) return stop("RESULT_ENVELOPE_MISMATCH");
  const accepted = role === "A" ? ACCEPTED_A_STATUSES : ACCEPTED_B_STATUSES;
  if (!accepted.has(status)) return stop("RESULT_STATUS_REJECTED");
  const dataBearing = status === "OK";
  const expectedKeys = dataBearing
    ? ["data", "freshness", "kind", "nextActionCode", "status", "toolName", "version"]
    : ["kind", "nextActionCode", "status", "toolName", "version"];
  if (!hasExactKeys(candidate, expectedKeys) ||
      typeof candidate.nextActionCode !== "string" ||
      (dataBearing && (candidate.freshness !== "FRESH" || !isRecord(candidate.data)))) {
    return stop("RESULT_ENVELOPE_MISMATCH");
  }
  if (!isCanonicalCallToolEnvelope(value, candidate, status)) {
    return stop("RESULT_ENVELOPE_MISMATCH");
  }
  return Object.freeze({ status, dataBearing });
}

function isCanonicalCallToolEnvelope(
  value: unknown,
  candidate: Record<string, unknown>,
  status: AcceptedStatus,
): boolean {
  if (!hasExactKeys(value, ["content", "structuredContent"]) ||
      !structurallyEqual(value.structuredContent, candidate) ||
      !Array.isArray(value.content) ||
      value.content.length !== 1) {
    return false;
  }
  const content = value.content[0];
  return hasExactKeys(content, ["text", "type"]) &&
    content.type === "text" &&
    content.text === `Read-only summary status: ${status}.`;
}

function scanResult(
  root: unknown,
  forbiddenSubstrings: readonly string[],
): Readonly<{ candidates: Record<string, unknown>[] }> | Stop {
  const normalizedForbidden = forbiddenSubstrings
    .filter((value) => value.length > 0)
    .map((value) => value.toLowerCase());
  const candidates: Record<string, unknown>[] = [];
  const stack: Array<Readonly<{ value: unknown; depth: number }>> = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_RESULT_NODES || current.depth > MAX_RESULT_DEPTH) {
      return stop("RESULT_LIMIT_EXCEEDED");
    }
    if (typeof current.value === "string") {
      const lower = current.value.toLowerCase();
      if (current.value.length > MAX_STRING_LENGTH ||
          normalizedForbidden.some((needle) => lower.includes(needle))) {
        return stop("RESULT_FORBIDDEN_CONTENT");
      }
      continue;
    }
    if (current.value === null ||
        typeof current.value === "boolean" ||
        typeof current.value === "number" ||
        current.value === undefined) {
      continue;
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_ARRAY_LENGTH) return stop("RESULT_LIMIT_EXCEEDED");
      for (const child of current.value) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
      continue;
    }
    if (!isRecord(current.value)) return stop("RESULT_ENVELOPE_MISMATCH");
    const entries = Object.entries(current.value);
    if (entries.length > MAX_OBJECT_KEYS) return stop("RESULT_LIMIT_EXCEEDED");
    if (current.value.kind === MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2) {
      candidates.push(current.value);
    }
    for (const [key, child] of entries) {
      if (FORBIDDEN_KEY.test(key)) return stop("RESULT_FORBIDDEN_CONTENT");
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }
  return Object.freeze({ candidates });
}

function isExpectedSeedResult(value: unknown): boolean {
  return hasExactKeys(value, [
    "createdCount",
    "expectedCount",
    "ownerBound",
    "reusedCount",
    "status",
    "version",
  ]) &&
    value.status === "ready" &&
    value.createdCount === 3 &&
    value.reusedCount === 0 &&
    value.expectedCount === 3 &&
    value.ownerBound === true &&
    value.version === 1;
}

function isExpectedCleanupResult(value: unknown): boolean {
  return hasExactKeys(value, [
    "deletedCount",
    "expectedCount",
    "ownerBound",
    "residualCount",
    "status",
    "version",
  ]) &&
    value.status === "clean" &&
    value.deletedCount === 3 &&
    value.residualCount === 0 &&
    value.expectedCount === 3 &&
    value.ownerBound === true &&
    value.version === 1;
}

function isAcceptedStatus(value: unknown): value is AcceptedStatus {
  return typeof value === "string" &&
    ["OK", "STALE", "NO_DATA", "ONBOARDING_REQUIRED", "TIMEOUT",
      "DEPENDENCY_MISSING", "MALFORMED"].includes(value);
}

function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function matchesSchema(
  value: unknown,
  schema: McpProductionReadonlySummaryJsonSchemaV2,
): boolean {
  if (schema.oneOf) {
    return schema.oneOf.filter((candidate) => matchesSchema(value, candidate)).length === 1;
  }
  if (schema.const !== undefined && value !== schema.const) return false;
  if (schema.enum && (
    typeof value !== "string" ||
    !schema.enum.includes(value)
  )) {
    return false;
  }
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "number" && (
    typeof value !== "number" ||
    !Number.isFinite(value)
  )) {
    return false;
  }
  if (schema.type === "integer" && (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  )) {
    return false;
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return false;
    if (schema.maximum !== undefined && value > schema.maximum) return false;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    return schema.items === undefined ||
      value.every((item) => matchesSchema(item, schema.items!));
  }
  if (schema.type === "object") {
    if (!isRecord(value)) return false;
    const properties = schema.properties ?? {};
    if (schema.required?.some((key) => !(key in value))) return false;
    if (schema.additionalProperties === false &&
        Object.keys(value).some((key) => !(key in properties))) {
      return false;
    }
    return Object.entries(properties).every(([key, childSchema]) =>
      !(key in value) || matchesSchema(value[key], childSchema)
    );
  }
  return true;
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] &&
      structurallyEqual(left[key], right[key])
    );
}

function isEffectSnapshot(value: unknown): value is McpSafeSummaryProofEffectSnapshot {
  if (!hasExactKeys(value, [
    "fallbackCount",
    "modelCallCount",
    "providerCallCount",
    "repairCount",
    "retryCount",
    "version",
  ]) || value.version !== 1) {
    return false;
  }
  return ["fallbackCount", "modelCallCount", "providerCallCount", "repairCount", "retryCount"]
    .every((key) => typeof value[key] === "number" &&
      Number.isSafeInteger(value[key]) &&
      value[key] >= 0);
}

function applyEffectDelta(
  ledger: MutableLedger,
  baseline: McpSafeSummaryProofEffectSnapshot,
  final: McpSafeSummaryProofEffectSnapshot,
): boolean {
  const entries = [
    ["retryCount", baseline.retryCount, final.retryCount],
    ["repairCount", baseline.repairCount, final.repairCount],
    ["fallbackCount", baseline.fallbackCount, final.fallbackCount],
    ["providerCallCount", baseline.providerCallCount, final.providerCallCount],
    ["modelCallCount", baseline.modelCallCount, final.modelCallCount],
  ] as const;
  if (entries.some(([, before, after]) => after < before)) return false;
  for (const [key, before, after] of entries) ledger[key] = after - before;
  return true;
}

function copyEffectSnapshot(
  snapshot: McpSafeSummaryProofEffectSnapshot,
): McpSafeSummaryProofEffectSnapshot {
  return Object.freeze({
    retryCount: snapshot.retryCount,
    repairCount: snapshot.repairCount,
    fallbackCount: snapshot.fallbackCount,
    providerCallCount: snapshot.providerCallCount,
    modelCallCount: snapshot.modelCallCount,
    version: 1,
  });
}

function stop(stopCode: McpSafeSummaryProofStopCode): Stop {
  return Object.freeze({ stopCode });
}

function freezeLedger(ledger: MutableLedger): McpSafeSummaryProofLedger {
  const base = {
    outcome: ledger.outcome,
    seedCount: ledger.seedCount,
    cleanupCount: ledger.cleanupCount,
    protectedCallCount: ledger.protectedCallCount,
    retryCount: ledger.retryCount,
    repairCount: ledger.repairCount,
    fallbackCount: ledger.fallbackCount,
    providerCallCount: ledger.providerCallCount,
    modelCallCount: ledger.modelCallCount,
    authTransitionCount: ledger.authTransitionCount,
    toolsListCount: ledger.toolsListCount,
    recovery: ledger.recovery,
    calls: Object.freeze([...ledger.calls]),
    version: 1 as const,
  };
  return Object.freeze(
    ledger.stopCode === undefined
      ? base
      : { ...base, stopCode: ledger.stopCode },
  );
}
