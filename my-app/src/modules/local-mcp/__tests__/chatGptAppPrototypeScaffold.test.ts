import { describe, expect, it } from "vitest";
import {
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpUnsafeFixtureOutput,
} from "../privacyRedactionFixtures";
import type { LocalMcpPrivacyReviewGateResultV1 } from "../mcpPrivacyReviewGate";
import type { LocalMcpToolIdV1 } from "../schema";
import source from "../chatGptAppPrototypeScaffold.ts?raw";
import {
  LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1,
  assertLocalOnlyChatGptAppPrototypeScaffold,
  buildLocalOnlyChatGptAppPrototypeScaffold,
} from "../chatGptAppPrototypeScaffold";

const EXPECTED_LOCAL_TOOL_IDS: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

describe("chatGptAppPrototypeScaffold", () => {
  it("builds a fixture-only scaffold with every tool hidden by default", () => {
    const scaffold = buildLocalOnlyChatGptAppPrototypeScaffold();

    expect(scaffold).toMatchObject({
      kind: "local_only_chatgpt_app_prototype_scaffold",
      mode: "non_production_fixture_only",
      appLabel: "Twoweeks Local Review",
      version: 1,
    });
    expect(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_TOOL_IDS_V1).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    expect(scaffold.tools.map((tool) => tool.localToolId)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    expect(scaffold.tools.every((tool) => tool.exposureState === "hidden")).toBe(true);
    expect(scaffold.tools.every((tool) => tool.gateStatus === "missing")).toBe(true);
    expect(scaffold.tools.every((tool) => tool.callable === false)).toBe(true);
    expect(scaffold.tools.every((tool) => tool.runnable === false)).toBe(true);
    expect(scaffold.tools.every((tool) => tool.reviewOnly === true)).toBe(true);
    expect(scaffold.constraints).toMatchObject({
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
    });
    assertLocalMcpPrivacySafeOutput(scaffold);
  });

  it("maps a PR27.1 ready gate to review-only internal review state", () => {
    const scaffold = buildLocalOnlyChatGptAppPrototypeScaffold([
      readyGate("local_mcp.application_package.summarize"),
    ]);
    const tool = scaffold.tools[0];

    expect(tool).toMatchObject({
      localToolId: "local_mcp.application_package.summarize",
      projectedToolName: "twoweeks.application_package.summarize",
      exposureState: "ready_for_internal_review",
      gateStatus: "ready_for_internal_review",
      gatePassedForInternalReview: true,
      userFacingCopy: "Review first. Nothing runs.",
      safeSummary: "Ready for internal review. No handler executed.",
      callable: false,
      runnable: false,
      reviewOnly: true,
    });
    expect(tool.fixtureOutput).toMatchObject({
      kind: "local_mcp_safe_text_fixture_output",
      status: "ready_for_internal_review",
      summary: "Ready for internal review. No handler executed.",
      refIds: ["fixture:local_mcp.application_package.summarize"],
      version: 1,
    });
    assertLocalMcpPrivacySafeOutput(tool);
  });

  it("maps blocked gates without exposing raw gate payload", () => {
    const scaffold = buildLocalOnlyChatGptAppPrototypeScaffold([
      blockedGate("local_mcp.evidence_graph.summarize"),
    ]);
    const tool = scaffold.tools[1];

    expect(tool).toMatchObject({
      localToolId: "local_mcp.evidence_graph.summarize",
      exposureState: "blocked",
      gateStatus: "blocked",
      gatePassedForInternalReview: false,
      userFacingCopy: "Blocked. Review privacy.",
      safeSummary: "Blocked. Review privacy.",
      callable: false,
      runnable: false,
      reviewOnly: true,
    });
    expect(JSON.stringify(tool)).not.toContain("privacy_check_failed");
    assertLocalMcpPrivacySafeOutput(tool);
  });

  it("rejects duplicated gate results", () => {
    const gate = readyGate("local_mcp.review_cockpit.summarize");

    expect(() => buildLocalOnlyChatGptAppPrototypeScaffold([gate, gate])).toThrow(
      /duplicated/u,
    );
  });

  it("rejects unsafe scaffold output", () => {
    const scaffold = buildLocalOnlyChatGptAppPrototypeScaffold();
    const unsafe = {
      ...scaffold,
      tools: [
        {
          ...scaffold.tools[0],
          safeSummary: buildLocalMcpUnsafeFixtureOutput("private_fact"),
        },
      ],
    };

    expect(() => assertLocalOnlyChatGptAppPrototypeScaffold(unsafe as never)).toThrow(
      /privacy fixture/u,
    );
  });

  it("keeps source free from runtime, network, SDK, UI, and persistence imports", () => {
    expect(source).not.toMatch(/from\s+["'](?:@modelcontextprotocol|@openai|openai|next\/server|convex|react)["']/u);
    expect(source).not.toMatch(/registerTool|registerResource|server\.connect|fetch\(|WebSocket|EventSource/u);
    expect(source).not.toMatch(/OAuth|oauth|exportFile|download|sendEmail|submitApplication|applyToJob/u);
  });
});

function readyGate(localToolId: LocalMcpToolIdV1): LocalMcpPrivacyReviewGateResultV1 {
  return {
    kind: "local_mcp_privacy_review_gate_result",
    localToolId,
    status: "ready_for_internal_review",
    reasons: ["safe_summary_only", "all_design_gates_present"],
    copyKey: "review_first",
    userFacingCopy: "Review first. Nothing runs.",
    safeSummary: "Ready for internal review. No handler executed.",
    version: 1,
  };
}

function blockedGate(localToolId: LocalMcpToolIdV1): LocalMcpPrivacyReviewGateResultV1 {
  return {
    kind: "local_mcp_privacy_review_gate_result",
    localToolId,
    status: "blocked",
    reasons: ["privacy_check_failed", "safe_summary_only"],
    copyKey: "blocked_privacy",
    userFacingCopy: "Blocked. Review privacy.",
    safeSummary: "Blocked. Review privacy.",
    version: 1,
  };
}
