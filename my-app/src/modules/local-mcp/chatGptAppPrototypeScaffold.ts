import { localToolIdToProjectedToolName } from "./mcpCallEnvelope";
import {
  assertLocalMcpPrivacyReviewGateResult,
  isLocalMcpPrivacyReviewGatePassedForInternalReview,
} from "./mcpPrivacyReviewGate";
import type {
  LocalMcpPrivacyReviewGateResultV1,
  LocalMcpPrivacyReviewGateStatusV1,
} from "./mcpPrivacyReviewGate";
import {
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpSafeTextFixtureOutput,
} from "./privacyRedactionFixtures";
import type { LocalMcpSafeTextFixtureOutputV1 } from "./privacyRedactionFixtures";
import type { LocalMcpToolIdV1 } from "./schema";

export type LocalOnlyChatGptAppPrototypeScaffoldModeV1 = "non_production_fixture_only";

export type LocalOnlyChatGptAppPrototypeExposureStateV1 =
  | "hidden"
  | "blocked"
  | "review_required"
  | "ready_for_internal_review";

export type LocalOnlyChatGptAppPrototypeGateStatusV1 =
  | LocalMcpPrivacyReviewGateStatusV1
  | "missing";

export type LocalOnlyChatGptAppPrototypeConstraintsV1 = Readonly<{
  noRealUserData: true;
  noRawSourceText: true;
  noGeneratedFullText: true;
  noRealHandler: true;
  noHandlerExecution: true;
  noTransportRuntime: true;
  noOAuth: true;
  noPersistence: true;
  noNetwork: true;
  noUiComponent: true;
  noExportDownloadSendSubmitApply: true;
  reviewOnly: true;
  version: 1;
}>;

export type LocalOnlyChatGptAppPrototypeToolCardV1 = Readonly<{
  kind: "local_only_chatgpt_app_prototype_tool_card";
  localToolId: LocalMcpToolIdV1;
  projectedToolName: string;
  exposureState: LocalOnlyChatGptAppPrototypeExposureStateV1;
  gateStatus: LocalOnlyChatGptAppPrototypeGateStatusV1;
  gatePassedForInternalReview: boolean;
  userFacingCopy: string;
  safeSummary: string;
  fixtureOutput: LocalMcpSafeTextFixtureOutputV1;
  constraints: LocalOnlyChatGptAppPrototypeConstraintsV1;
  callable: false;
  runnable: false;
  reviewOnly: true;
  version: 1;
}>;

export type LocalOnlyChatGptAppPrototypeScaffoldV1 = Readonly<{
  kind: "local_only_chatgpt_app_prototype_scaffold";
  mode: LocalOnlyChatGptAppPrototypeScaffoldModeV1;
  appLabel: "Twoweeks Local Review";
  tools: readonly LocalOnlyChatGptAppPrototypeToolCardV1[];
  constraints: LocalOnlyChatGptAppPrototypeConstraintsV1;
  version: 1;
}>;

export const LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const PROTOTYPE_CONSTRAINTS: LocalOnlyChatGptAppPrototypeConstraintsV1 = {
  noRealUserData: true,
  noRawSourceText: true,
  noGeneratedFullText: true,
  noRealHandler: true,
  noHandlerExecution: true,
  noTransportRuntime: true,
  noOAuth: true,
  noPersistence: true,
  noNetwork: true,
  noUiComponent: true,
  noExportDownloadSendSubmitApply: true,
  reviewOnly: true,
  version: 1,
} as const;

const MISSING_GATE_COPY = "Tool disabled.";
const MISSING_GATE_SUMMARY = "Hidden by default.";

const FORBIDDEN_RUNTIME_PHRASES = [
  "ready_for_production",
  "ready_to_execute",
  "ready_for_chatgpt",
  "approved_for_remote",
  "safe_to_run",
  "production ready",
  "runtime approved",
  "handler approved",
  "transport approved",
  "chatgpt ready",
] as const;

export function buildLocalOnlyChatGptAppPrototypeScaffold(
  gateResults: readonly LocalMcpPrivacyReviewGateResultV1[] = [],
): LocalOnlyChatGptAppPrototypeScaffoldV1 {
  const gatesByTool = indexGateResults(gateResults);
  const scaffold: LocalOnlyChatGptAppPrototypeScaffoldV1 = {
    kind: "local_only_chatgpt_app_prototype_scaffold",
    mode: "non_production_fixture_only",
    appLabel: "Twoweeks Local Review",
    tools: LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
      buildPrototypeToolCard(localToolId, gatesByTool.get(localToolId)),
    ),
    constraints: cloneConstraints(PROTOTYPE_CONSTRAINTS),
    version: 1,
  };

  assertLocalOnlyChatGptAppPrototypeScaffold(scaffold);
  return cloneScaffold(scaffold);
}

export function assertLocalOnlyChatGptAppPrototypeScaffold(
  scaffold: LocalOnlyChatGptAppPrototypeScaffoldV1,
): void {
  const record = asPlainRecord(scaffold, "Local-only ChatGPT App prototype scaffold must be an object");
  if (record.kind !== "local_only_chatgpt_app_prototype_scaffold") {
    throw new TypeError("Local-only ChatGPT App prototype scaffold kind is invalid");
  }
  if (record.mode !== "non_production_fixture_only") {
    throw new TypeError("Local-only ChatGPT App prototype scaffold mode is invalid");
  }
  if (record.appLabel !== "Twoweeks Local Review") {
    throw new TypeError("Local-only ChatGPT App prototype scaffold label is invalid");
  }
  assertPrototypeConstraints(record.constraints);
  if (!Array.isArray(record.tools)) {
    throw new TypeError("Local-only ChatGPT App prototype scaffold tools must be an array");
  }
  if (record.tools.length !== LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.length) {
    throw new TypeError("Local-only ChatGPT App prototype scaffold must cover every local tool");
  }
  record.tools.forEach((tool, index) => {
    assertPrototypeToolCard(tool);
    if (tool.localToolId !== LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[index]) {
      throw new TypeError("Local-only ChatGPT App prototype scaffold tool order is invalid");
    }
  });
  if (record.version !== 1) {
    throw new TypeError("Local-only ChatGPT App prototype scaffold version must be 1");
  }
  assertNoRuntimePhrases(scaffold);
  assertLocalMcpPrivacySafeOutput(scaffold);
}

function buildPrototypeToolCard(
  localToolId: LocalMcpToolIdV1,
  gateResult?: LocalMcpPrivacyReviewGateResultV1,
): LocalOnlyChatGptAppPrototypeToolCardV1 {
  if (gateResult) assertLocalMcpPrivacyReviewGateResult(gateResult);

  const exposureState = gateResult ? exposureStateForGate(gateResult.status) : "hidden";
  const gatePassedForInternalReview = gateResult
    ? isLocalMcpPrivacyReviewGatePassedForInternalReview(gateResult)
    : false;
  const safeSummary = gateResult?.safeSummary ?? MISSING_GATE_SUMMARY;
  const userFacingCopy = gateResult?.userFacingCopy ?? MISSING_GATE_COPY;
  const fixtureOutput = buildLocalMcpSafeTextFixtureOutput({
    status: exposureState,
    summary: safeSummary,
    refIds: [`fixture:${localToolId}`],
  });

  const card: LocalOnlyChatGptAppPrototypeToolCardV1 = {
    kind: "local_only_chatgpt_app_prototype_tool_card",
    localToolId,
    projectedToolName: localToolIdToProjectedToolName(localToolId),
    exposureState,
    gateStatus: gateResult?.status ?? "missing",
    gatePassedForInternalReview,
    userFacingCopy,
    safeSummary,
    fixtureOutput,
    constraints: cloneConstraints(PROTOTYPE_CONSTRAINTS),
    callable: false,
    runnable: false,
    reviewOnly: true,
    version: 1,
  };

  assertPrototypeToolCard(card);
  return cloneToolCard(card);
}

function indexGateResults(
  gateResults: readonly LocalMcpPrivacyReviewGateResultV1[],
): ReadonlyMap<LocalMcpToolIdV1, LocalMcpPrivacyReviewGateResultV1> {
  const byTool = new Map<LocalMcpToolIdV1, LocalMcpPrivacyReviewGateResultV1>();
  for (const gateResult of gateResults) {
    assertLocalMcpPrivacyReviewGateResult(gateResult);
    if (!isKnownPrototypeToolId(gateResult.localToolId)) {
      throw new TypeError("Local-only ChatGPT App prototype gate result tool is unknown");
    }
    if (byTool.has(gateResult.localToolId)) {
      throw new TypeError("Local-only ChatGPT App prototype gate result is duplicated");
    }
    byTool.set(gateResult.localToolId, gateResult);
  }
  return byTool;
}

function exposureStateForGate(
  status: LocalMcpPrivacyReviewGateStatusV1,
): LocalOnlyChatGptAppPrototypeExposureStateV1 {
  switch (status) {
    case "blocked":
      return "blocked";
    case "review_required":
      return "review_required";
    case "ready_for_internal_review":
      return "ready_for_internal_review";
  }
}

function assertPrototypeToolCard(tool: LocalOnlyChatGptAppPrototypeToolCardV1): void {
  const record = asPlainRecord(tool, "Local-only ChatGPT App prototype tool card must be an object");
  if (record.kind !== "local_only_chatgpt_app_prototype_tool_card") {
    throw new TypeError("Local-only ChatGPT App prototype tool card kind is invalid");
  }
  if (!isKnownPrototypeToolId(record.localToolId)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card localToolId is invalid");
  }
  const localToolId = record.localToolId;
  if (record.projectedToolName !== localToolIdToProjectedToolName(localToolId)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card projectedToolName is invalid");
  }
  if (!isExposureState(record.exposureState)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card exposureState is invalid");
  }
  if (!isGateStatus(record.gateStatus)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card gateStatus is invalid");
  }
  if (typeof record.gatePassedForInternalReview !== "boolean") {
    throw new TypeError("Local-only ChatGPT App prototype tool card gate pass flag is invalid");
  }
  if (record.gatePassedForInternalReview !== (record.gateStatus === "ready_for_internal_review")) {
    throw new TypeError("Local-only ChatGPT App prototype tool card gate pass flag is inconsistent");
  }
  if (!isNonEmptyString(record.userFacingCopy) || !isNonEmptyString(record.safeSummary)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card copy is invalid");
  }
  if (!isPlainRecord(record.fixtureOutput)) {
    throw new TypeError("Local-only ChatGPT App prototype tool card fixture output is invalid");
  }
  assertPrototypeConstraints(record.constraints);
  if (record.callable !== false || record.runnable !== false || record.reviewOnly !== true) {
    throw new TypeError("Local-only ChatGPT App prototype tool card must stay non-runnable");
  }
  if (record.version !== 1) {
    throw new TypeError("Local-only ChatGPT App prototype tool card version must be 1");
  }
  assertNoRuntimePhrases(tool);
  assertLocalMcpPrivacySafeOutput(tool);
}

function assertPrototypeConstraints(
  constraints: unknown,
): asserts constraints is LocalOnlyChatGptAppPrototypeConstraintsV1 {
  const record = asPlainRecord(
    constraints,
    "Local-only ChatGPT App prototype constraints must be an object",
  );
  const requiredTrueKeys: readonly string[] = [
    "noRealUserData",
    "noRawSourceText",
    "noGeneratedFullText",
    "noRealHandler",
    "noHandlerExecution",
    "noTransportRuntime",
    "noOAuth",
    "noPersistence",
    "noNetwork",
    "noUiComponent",
    "noExportDownloadSendSubmitApply",
    "reviewOnly",
  ];
  for (const key of requiredTrueKeys) {
    if (record[key] !== true) {
      throw new TypeError("Local-only ChatGPT App prototype constraint is missing");
    }
  }
  if (record.version !== 1) {
    throw new TypeError("Local-only ChatGPT App prototype constraints version must be 1");
  }
}

function assertNoRuntimePhrases(value: unknown): void {
  const serialized = JSON.stringify(value).normalize("NFKC").toLowerCase();
  for (const phrase of FORBIDDEN_RUNTIME_PHRASES) {
    if (serialized.includes(phrase)) {
      throw new TypeError("Local-only ChatGPT App prototype scaffold contains runtime readiness text");
    }
  }
}

function cloneScaffold(
  scaffold: LocalOnlyChatGptAppPrototypeScaffoldV1,
): LocalOnlyChatGptAppPrototypeScaffoldV1 {
  return {
    kind: scaffold.kind,
    mode: scaffold.mode,
    appLabel: scaffold.appLabel,
    tools: scaffold.tools.map(cloneToolCard),
    constraints: cloneConstraints(scaffold.constraints),
    version: 1,
  };
}

function cloneToolCard(
  tool: LocalOnlyChatGptAppPrototypeToolCardV1,
): LocalOnlyChatGptAppPrototypeToolCardV1 {
  return {
    kind: tool.kind,
    localToolId: tool.localToolId,
    projectedToolName: tool.projectedToolName,
    exposureState: tool.exposureState,
    gateStatus: tool.gateStatus,
    gatePassedForInternalReview: tool.gatePassedForInternalReview,
    userFacingCopy: tool.userFacingCopy,
    safeSummary: tool.safeSummary,
    fixtureOutput: {
      kind: tool.fixtureOutput.kind,
      status: tool.fixtureOutput.status,
      summary: tool.fixtureOutput.summary,
      refIds: [...tool.fixtureOutput.refIds],
      version: 1,
    },
    constraints: cloneConstraints(tool.constraints),
    callable: false,
    runnable: false,
    reviewOnly: true,
    version: 1,
  };
}

function cloneConstraints(
  constraints: LocalOnlyChatGptAppPrototypeConstraintsV1,
): LocalOnlyChatGptAppPrototypeConstraintsV1 {
  return {
    noRealUserData: constraints.noRealUserData,
    noRawSourceText: constraints.noRawSourceText,
    noGeneratedFullText: constraints.noGeneratedFullText,
    noRealHandler: constraints.noRealHandler,
    noHandlerExecution: constraints.noHandlerExecution,
    noTransportRuntime: constraints.noTransportRuntime,
    noOAuth: constraints.noOAuth,
    noPersistence: constraints.noPersistence,
    noNetwork: constraints.noNetwork,
    noUiComponent: constraints.noUiComponent,
    noExportDownloadSendSubmitApply: constraints.noExportDownloadSendSubmitApply,
    reviewOnly: constraints.reviewOnly,
    version: 1,
  };
}

function isKnownPrototypeToolId(value: unknown): value is LocalMcpToolIdV1 {
  return (
    typeof value === "string" &&
    (LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1 as readonly string[]).includes(value)
  );
}

function isExposureState(value: unknown): value is LocalOnlyChatGptAppPrototypeExposureStateV1 {
  return (
    value === "hidden" ||
    value === "blocked" ||
    value === "review_required" ||
    value === "ready_for_internal_review"
  );
}

function isGateStatus(value: unknown): value is LocalOnlyChatGptAppPrototypeGateStatusV1 {
  return (
    value === "missing" ||
    value === "blocked" ||
    value === "review_required" ||
    value === "ready_for_internal_review"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new TypeError(message);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
