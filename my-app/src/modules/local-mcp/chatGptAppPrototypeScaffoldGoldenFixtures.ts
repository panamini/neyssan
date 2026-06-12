import {
  LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1,
  assertLocalOnlyChatGptAppPrototypeScaffold,
  buildLocalOnlyChatGptAppPrototypeScaffold,
} from "./chatGptAppPrototypeScaffold";
import type {
  LocalOnlyChatGptAppPrototypeExposureStateV1,
  LocalOnlyChatGptAppPrototypeGateStatusV1,
  LocalOnlyChatGptAppPrototypeScaffoldV1,
} from "./chatGptAppPrototypeScaffold";
import {
  assertLocalMcpPrivacyReviewGateResult,
} from "./mcpPrivacyReviewGate";
import type {
  LocalMcpPrivacyReviewGateReasonV1,
  LocalMcpPrivacyReviewGateResultV1,
  LocalMcpPrivacyReviewGateStatusV1,
} from "./mcpPrivacyReviewGate";
import { assertLocalMcpPrivacySafeOutput } from "./privacyRedactionFixtures";
import type { LocalMcpToolIdV1 } from "./schema";

export const LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1 = [
  "default_hidden",
  "all_blocked",
  "all_review_required",
  "all_ready_for_internal_review",
  "mixed_gate_states",
] as const;

export type LocalOnlyChatGptAppPrototypeGoldenScenarioV1 =
  (typeof LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1)[number];

export type LocalOnlyChatGptAppPrototypeGoldenToolStateV1 = Readonly<{
  localToolId: LocalMcpToolIdV1;
  exposureState: LocalOnlyChatGptAppPrototypeExposureStateV1;
  gateStatus: LocalOnlyChatGptAppPrototypeGateStatusV1;
  gatePassedForInternalReview: boolean;
  userFacingCopy: string;
  safeSummary: string;
  fixtureStatus: string;
  fixtureSummary: string;
  refId: string;
  callable: false;
  runnable: false;
  reviewOnly: true;
  version: 1;
}>;

export type LocalOnlyChatGptAppPrototypeGoldenFixtureV1 = Readonly<{
  kind: "local_only_chatgpt_app_prototype_golden_fixture";
  scenario: LocalOnlyChatGptAppPrototypeGoldenScenarioV1;
  scaffold: LocalOnlyChatGptAppPrototypeScaffoldV1;
  expectedToolStates: readonly LocalOnlyChatGptAppPrototypeGoldenToolStateV1[];
  version: 1;
}>;

export function isLocalOnlyChatGptAppPrototypeGoldenScenario(
  value: unknown,
): value is LocalOnlyChatGptAppPrototypeGoldenScenarioV1 {
  return (
    typeof value === "string" &&
    (LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1 as readonly string[]).includes(value)
  );
}

export function buildLocalOnlyChatGptAppPrototypeGoldenFixture(
  scenario: LocalOnlyChatGptAppPrototypeGoldenScenarioV1,
): LocalOnlyChatGptAppPrototypeGoldenFixtureV1 {
  if (!isLocalOnlyChatGptAppPrototypeGoldenScenario(scenario)) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture scenario is invalid");
  }

  const scaffold = buildLocalOnlyChatGptAppPrototypeScaffold(buildGateResultsForScenario(scenario));
  const fixture: LocalOnlyChatGptAppPrototypeGoldenFixtureV1 = {
    kind: "local_only_chatgpt_app_prototype_golden_fixture",
    scenario,
    scaffold,
    expectedToolStates: buildExpectedToolStatesForScenario(scenario),
    version: 1,
  };

  assertLocalOnlyChatGptAppPrototypeGoldenFixture(fixture);
  return cloneGoldenFixture(fixture);
}

export function listLocalOnlyChatGptAppPrototypeGoldenFixtures():
  readonly LocalOnlyChatGptAppPrototypeGoldenFixtureV1[] {
  return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1.map((scenario) =>
    buildLocalOnlyChatGptAppPrototypeGoldenFixture(scenario),
  );
}

export function assertLocalOnlyChatGptAppPrototypeGoldenFixture(
  fixture: LocalOnlyChatGptAppPrototypeGoldenFixtureV1,
): void {
  const record = asPlainRecord(
    fixture,
    "Local-only ChatGPT App prototype golden fixture must be an object",
  );
  if (record.kind !== "local_only_chatgpt_app_prototype_golden_fixture") {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture kind is invalid");
  }
  if (!isLocalOnlyChatGptAppPrototypeGoldenScenario(record.scenario)) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture scenario is invalid");
  }
  if (record.version !== 1) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture version must be 1");
  }

  assertLocalOnlyChatGptAppPrototypeScaffold(record.scaffold as LocalOnlyChatGptAppPrototypeScaffoldV1);
  assertLocalMcpPrivacySafeOutput(fixture);
  assertExpectedToolStates(
    record.scaffold as LocalOnlyChatGptAppPrototypeScaffoldV1,
    record.expectedToolStates,
  );
}

function buildGateResultsForScenario(
  scenario: LocalOnlyChatGptAppPrototypeGoldenScenarioV1,
): readonly LocalMcpPrivacyReviewGateResultV1[] {
  switch (scenario) {
    case "default_hidden":
      return [];
    case "all_blocked":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildSyntheticGateResult(localToolId, "blocked"),
      );
    case "all_review_required":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildSyntheticGateResult(localToolId, "review_required"),
      );
    case "all_ready_for_internal_review":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildSyntheticGateResult(localToolId, "ready_for_internal_review"),
      );
    case "mixed_gate_states":
      return [
        buildSyntheticGateResult(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[1], "blocked"),
        buildSyntheticGateResult(
          LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[2],
          "review_required",
        ),
        buildSyntheticGateResult(
          LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[3],
          "ready_for_internal_review",
        ),
      ];
    default:
      return assertNever(scenario);
  }
}

function buildExpectedToolStatesForScenario(
  scenario: LocalOnlyChatGptAppPrototypeGoldenScenarioV1,
): readonly LocalOnlyChatGptAppPrototypeGoldenToolStateV1[] {
  switch (scenario) {
    case "default_hidden":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildExpectedToolState(localToolId, {
          exposureState: "hidden",
          gateStatus: "missing",
          gatePassedForInternalReview: false,
          userFacingCopy: "Tool disabled.",
          safeSummary: "Hidden by default.",
        }),
      );
    case "all_blocked":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildExpectedToolState(localToolId, {
          exposureState: "blocked",
          gateStatus: "blocked",
          gatePassedForInternalReview: false,
          userFacingCopy: "Blocked. Review privacy.",
          safeSummary: "Blocked. Review privacy.",
        }),
      );
    case "all_review_required":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildExpectedToolState(localToolId, {
          exposureState: "review_required",
          gateStatus: "review_required",
          gatePassedForInternalReview: false,
          userFacingCopy: "Approval required.",
          safeSummary: "Approval required.",
        }),
      );
    case "all_ready_for_internal_review":
      return LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.map((localToolId) =>
        buildExpectedToolState(localToolId, {
          exposureState: "ready_for_internal_review",
          gateStatus: "ready_for_internal_review",
          gatePassedForInternalReview: true,
          userFacingCopy: "Review first. Nothing runs.",
          safeSummary: "Ready for internal review. No handler executed.",
        }),
      );
    case "mixed_gate_states":
      return [
        buildExpectedToolState(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[0], {
          exposureState: "hidden",
          gateStatus: "missing",
          gatePassedForInternalReview: false,
          userFacingCopy: "Tool disabled.",
          safeSummary: "Hidden by default.",
        }),
        buildExpectedToolState(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[1], {
          exposureState: "blocked",
          gateStatus: "blocked",
          gatePassedForInternalReview: false,
          userFacingCopy: "Blocked. Review privacy.",
          safeSummary: "Blocked. Review privacy.",
        }),
        buildExpectedToolState(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[2], {
          exposureState: "review_required",
          gateStatus: "review_required",
          gatePassedForInternalReview: false,
          userFacingCopy: "Approval required.",
          safeSummary: "Approval required.",
        }),
        buildExpectedToolState(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[3], {
          exposureState: "ready_for_internal_review",
          gateStatus: "ready_for_internal_review",
          gatePassedForInternalReview: true,
          userFacingCopy: "Review first. Nothing runs.",
          safeSummary: "Ready for internal review. No handler executed.",
        }),
      ];
    default:
      return assertNever(scenario);
  }
}

function buildExpectedToolState(
  localToolId: LocalMcpToolIdV1,
  expected: Pick<
    LocalOnlyChatGptAppPrototypeGoldenToolStateV1,
    | "exposureState"
    | "gateStatus"
    | "gatePassedForInternalReview"
    | "userFacingCopy"
    | "safeSummary"
  >,
): LocalOnlyChatGptAppPrototypeGoldenToolStateV1 {
  return {
    localToolId,
    exposureState: expected.exposureState,
    gateStatus: expected.gateStatus,
    gatePassedForInternalReview: expected.gatePassedForInternalReview,
    userFacingCopy: expected.userFacingCopy,
    safeSummary: expected.safeSummary,
    fixtureStatus: expected.exposureState,
    fixtureSummary: expected.safeSummary,
    refId: `fixture:${localToolId}`,
    callable: false,
    runnable: false,
    reviewOnly: true,
    version: 1,
  };
}

function buildSyntheticGateResult(
  localToolId: LocalMcpToolIdV1,
  status: LocalMcpPrivacyReviewGateStatusV1,
): LocalMcpPrivacyReviewGateResultV1 {
  const gateByStatus: Readonly<
    Record<
      LocalMcpPrivacyReviewGateStatusV1,
      Pick<
        LocalMcpPrivacyReviewGateResultV1,
        "copyKey" | "userFacingCopy" | "safeSummary"
      > & { reasons: readonly LocalMcpPrivacyReviewGateReasonV1[] }
    >
  > = {
    blocked: {
      reasons: ["privacy_check_failed", "safe_summary_only"],
      copyKey: "blocked_privacy",
      userFacingCopy: "Blocked. Review privacy.",
      safeSummary: "Blocked. Review privacy.",
    },
    review_required: {
      reasons: ["approval_missing", "safe_summary_only"],
      copyKey: "approval_required",
      userFacingCopy: "Approval required.",
      safeSummary: "Approval required.",
    },
    ready_for_internal_review: {
      reasons: ["safe_summary_only", "all_design_gates_present"],
      copyKey: "review_first",
      userFacingCopy: "Review first. Nothing runs.",
      safeSummary: "Ready for internal review. No handler executed.",
    },
  };
  const gate = gateByStatus[status];
  const result: LocalMcpPrivacyReviewGateResultV1 = {
    kind: "local_mcp_privacy_review_gate_result",
    localToolId,
    status,
    reasons: [...gate.reasons],
    copyKey: gate.copyKey,
    userFacingCopy: gate.userFacingCopy,
    safeSummary: gate.safeSummary,
    version: 1,
  };
  assertLocalMcpPrivacyReviewGateResult(result);
  return cloneGateResult(result);
}

function assertExpectedToolStates(
  scaffold: LocalOnlyChatGptAppPrototypeScaffoldV1,
  expectedToolStates: unknown,
): void {
  if (!Array.isArray(expectedToolStates)) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture tool states must be an array");
  }
  if (expectedToolStates.length !== LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1.length) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture must cover every tool");
  }

  expectedToolStates.forEach((expectedState, index) => {
    const expected = asPlainRecord(
      expectedState,
      "Local-only ChatGPT App prototype golden fixture tool state must be an object",
    );
    const tool = scaffold.tools[index];
    const canonicalToolId = LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1[index];
    if (expected.localToolId !== canonicalToolId || tool.localToolId !== canonicalToolId) {
      throw new TypeError("Local-only ChatGPT App prototype golden fixture tool order is invalid");
    }
    assertToolStateMatchesCard(expected, tool);
  });
}

function assertToolStateMatchesCard(
  expected: Record<string, unknown>,
  tool: LocalOnlyChatGptAppPrototypeScaffoldV1["tools"][number],
): void {
  assertEqual(expected.exposureState, tool.exposureState, "exposureState");
  assertEqual(expected.gateStatus, tool.gateStatus, "gateStatus");
  assertEqual(
    expected.gatePassedForInternalReview,
    tool.gatePassedForInternalReview,
    "gate pass flag",
  );
  assertEqual(expected.userFacingCopy, tool.userFacingCopy, "copy");
  assertEqual(expected.safeSummary, tool.safeSummary, "safe summary");
  assertEqual(expected.fixtureStatus, tool.fixtureOutput.status, "output status");
  assertEqual(expected.fixtureSummary, tool.fixtureOutput.summary, "output summary");
  if (expected.refId !== `fixture:${tool.localToolId}`) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture output refId drifted");
  }
  assertRefIdsEqual(tool.fixtureOutput.refIds, expected.refId);
  assertEqual(expected.callable, tool.callable, "callable");
  assertEqual(expected.runnable, tool.runnable, "runnable");
  assertEqual(expected.reviewOnly, tool.reviewOnly, "reviewOnly");
  if (tool.callable !== false || tool.runnable !== false || tool.reviewOnly !== true) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture must stay non-runnable");
  }
  if (expected.version !== 1) {
    throw new TypeError("Local-only ChatGPT App prototype golden fixture tool state version must be 1");
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new TypeError(`Local-only ChatGPT App prototype golden fixture ${label} drifted`);
  }
}

function assertRefIdsEqual(refIds: readonly string[], refId: unknown): void {
  if (refIds.length === 1 && refIds[0] === refId) return;
  throw new TypeError("Local-only ChatGPT App prototype golden fixture output refId drifted");
}

function cloneGoldenFixture(
  fixture: LocalOnlyChatGptAppPrototypeGoldenFixtureV1,
): LocalOnlyChatGptAppPrototypeGoldenFixtureV1 {
  return {
    kind: fixture.kind,
    scenario: fixture.scenario,
    scaffold: cloneScaffold(fixture.scaffold),
    expectedToolStates: fixture.expectedToolStates.map(cloneExpectedToolState),
    version: 1,
  };
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
  tool: LocalOnlyChatGptAppPrototypeScaffoldV1["tools"][number],
): LocalOnlyChatGptAppPrototypeScaffoldV1["tools"][number] {
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
  constraints: LocalOnlyChatGptAppPrototypeScaffoldV1["constraints"],
): LocalOnlyChatGptAppPrototypeScaffoldV1["constraints"] {
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

function cloneExpectedToolState(
  expected: LocalOnlyChatGptAppPrototypeGoldenToolStateV1,
): LocalOnlyChatGptAppPrototypeGoldenToolStateV1 {
  return {
    localToolId: expected.localToolId,
    exposureState: expected.exposureState,
    gateStatus: expected.gateStatus,
    gatePassedForInternalReview: expected.gatePassedForInternalReview,
    userFacingCopy: expected.userFacingCopy,
    safeSummary: expected.safeSummary,
    fixtureStatus: expected.fixtureStatus,
    fixtureSummary: expected.fixtureSummary,
    refId: expected.refId,
    callable: false,
    runnable: false,
    reviewOnly: true,
    version: 1,
  };
}

function cloneGateResult(result: LocalMcpPrivacyReviewGateResultV1): LocalMcpPrivacyReviewGateResultV1 {
  return {
    kind: result.kind,
    localToolId: result.localToolId,
    status: result.status,
    reasons: [...result.reasons],
    copyKey: result.copyKey,
    userFacingCopy: result.userFacingCopy,
    safeSummary: result.safeSummary,
    version: 1,
  };
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  const candidate = value as Record<string, unknown> | null;
  const isObjectRecord =
    candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);
  const prototype = isObjectRecord ? Object.getPrototypeOf(candidate) : undefined;
  if (!isObjectRecord || (prototype !== Object.prototype && prototype !== null)) {
    throw new TypeError(message);
  }
  return candidate;
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown local-only ChatGPT App prototype golden fixture scenario: ${String(value)}`);
}
