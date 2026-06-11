import { describe, expect, it } from "vitest";
import {
  approvalDecisionToLocalMcpApproval,
  buildLocalMcpApprovalDecision,
  buildLocalMcpApprovalRequest,
  buildLocalMcpAuditEvent,
} from "../mcpApprovalAuditBoundary";
import type {
  LocalMcpApprovalDecisionV1,
  LocalMcpAuditEventV1,
} from "../mcpApprovalAuditBoundary";
import {
  localToolIdToProjectedToolName,
  validateLocalMcpCallEnvelope,
} from "../mcpCallEnvelope";
import type { LocalMcpCallEnvelopeV1 } from "../mcpCallEnvelope";
import {
  buildLocalMcpHandlerBoundary,
} from "../mcpHandlerBoundary";
import type { LocalMcpHandlerBoundaryV1 } from "../mcpHandlerBoundary";
import {
  buildDisabledLocalMcpRemoteTransportConfig,
  buildNonProductionLocalMcpRemoteTransportSpikeConfig,
  validateLocalMcpRemoteTransportPreflight,
} from "../mcpRemoteTransportSpike";
import type { LocalMcpRemoteTransportPreflightResultV1 } from "../mcpRemoteTransportSpike";
import {
  LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1,
  getLocalMcpApprovalUxCopy,
} from "../mcpApprovalUxCopyFixtures";
import {
  LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1,
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpSafeTextFixtureOutput,
  buildLocalMcpUnsafeFixtureOutput,
  collectLocalMcpPrivacyLeakFindings,
} from "../privacyRedactionFixtures";
import type {
  LocalMcpPrivacyFixtureCategoryV1,
  LocalMcpPrivacyRedactionCheckResultV1,
} from "../privacyRedactionFixtures";
import type { LocalMcpToolVisibilityDecisionV1 } from "../mcpToolVisibilityPolicy";
import type { LocalMcpToolIdV1 } from "../schema";
import privacyReviewGateSource from "../mcpPrivacyReviewGate.ts?raw";
import {
  assertLocalMcpPrivacyReviewGateResult,
  buildDefaultLocalMcpPrivacyReviewGateInput,
  evaluateLocalMcpPrivacyReviewGate,
  isLocalMcpPrivacyReviewGatePassedForInternalReview,
  listLocalMcpPrivacyReviewGateResults,
  sortLocalMcpPrivacyReviewGateReasons,
} from "../mcpPrivacyReviewGate";
import type {
  LocalMcpApprovalUxCopyCatalogV1,
  LocalMcpPrivacyReviewGateInputV1,
  LocalMcpPrivacyReviewGateResultV1,
} from "../mcpPrivacyReviewGate";

const EXPECTED_LOCAL_TOOL_IDS: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const REF_FIELDS: Readonly<Record<LocalMcpToolIdV1, string>> = {
  "local_mcp.application_package.summarize": "applicationPackageRef",
  "local_mcp.evidence_graph.summarize": "evidenceGraphRef",
  "local_mcp.resume_variant_plan.summarize": "resumeVariantPlanRef",
  "local_mcp.review_cockpit.summarize": "reviewCockpitRef",
} as const;

function safePrivacyCheck(): LocalMcpPrivacyRedactionCheckResultV1 {
  return collectLocalMcpPrivacyLeakFindings(
    buildLocalMcpSafeTextFixtureOutput({ summary: "Safe summary only." }),
  );
}

function unsafePrivacyCheck(
  category: LocalMcpPrivacyFixtureCategoryV1 = "private_fact",
): LocalMcpPrivacyRedactionCheckResultV1 {
  return collectLocalMcpPrivacyLeakFindings(buildLocalMcpUnsafeFixtureOutput(category));
}

function copyCatalog(): LocalMcpApprovalUxCopyCatalogV1 {
  return LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1.map(getLocalMcpApprovalUxCopy);
}

function envelopeForTool(
  localToolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
  overrides: Partial<LocalMcpCallEnvelopeV1> = {},
): LocalMcpCallEnvelopeV1 {
  return {
    kind: "local_mcp_call_envelope",
    toolName: localToolIdToProjectedToolName(localToolId),
    arguments: { [REF_FIELDS[localToolId]]: { id: "ref_1" } },
    user: {
      userId: "user_1",
      sessionId: "session_1",
    },
    approval: {
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T12:01:00.000Z",
      reason: "local approval",
      version: 1,
    },
    requestId: "request_1",
    version: 1,
    ...overrides,
  };
}

function approvedDecision(): LocalMcpApprovalDecisionV1 {
  return buildLocalMcpApprovalDecision({
    requestId: "request_1",
    decision: "approved",
    decidedBy: "reviewer_1",
    decidedAt: "2026-06-11T12:02:00.000Z",
    reason: "approved for local review",
  });
}

function deniedDecision(): LocalMcpApprovalDecisionV1 {
  return buildLocalMcpApprovalDecision({
    requestId: "request_1",
    decision: "denied",
    decidedBy: "reviewer_1",
    decidedAt: "2026-06-11T12:02:00.000Z",
  });
}

async function auditEvents(
  localToolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
): Promise<readonly LocalMcpAuditEventV1[]> {
  return [
    await buildLocalMcpAuditEvent({
      eventType: "approval_requested",
      requestId: "request_1",
      toolName: localToolIdToProjectedToolName(localToolId),
      localToolId,
      userId: "user_1",
      sessionId: "session_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "allowed",
      safeSummary: "Approval required.",
    }),
  ];
}

async function handlerBoundaryReady(
  localToolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
): Promise<LocalMcpHandlerBoundaryV1> {
  const decision = approvedDecision();
  const envelope = envelopeForTool(localToolId, {
    approval: approvalDecisionToLocalMcpApproval(decision),
  });
  const validation = validateLocalMcpCallEnvelope(envelope);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("expected valid Local MCP call validation");
  const approvalRequest = buildLocalMcpApprovalRequest(envelope, validation, {
    requestedAt: "2026-06-11T12:00:00.000Z",
  });

  return buildLocalMcpHandlerBoundary({
    envelope,
    validation,
    approvalRequest,
    approvalDecision: decision,
    rollbackPlanRef: "rollback:delete-pr27-only",
  });
}

async function handlerBoundaryBlocked(): Promise<LocalMcpHandlerBoundaryV1> {
  return {
    ...(await handlerBoundaryReady()),
    mode: "future_handler_runtime" as LocalMcpHandlerBoundaryV1["mode"],
  };
}

function remotePreflightAllowed(): LocalMcpRemoteTransportPreflightResultV1 {
  const config = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
    allowedOrigins: ["http://localhost:3000"],
    allowedHosts: ["localhost:3000"],
  });
  return validateLocalMcpRemoteTransportPreflight({
    kind: "local_mcp_remote_transport_preflight_input",
    config,
    origin: "http://localhost:3000",
    host: "localhost:3000",
    userId: "user_1",
    sessionId: "session_1",
    requestSizeBytes: 10,
    expectedResponseSizeBytes: 10,
    version: 1,
  });
}

function remotePreflightBlocked(): LocalMcpRemoteTransportPreflightResultV1 {
  const config = buildDisabledLocalMcpRemoteTransportConfig();
  return validateLocalMcpRemoteTransportPreflight({
    kind: "local_mcp_remote_transport_preflight_input",
    config,
    origin: "http://localhost:3000",
    host: "localhost:3000",
    userId: "user_1",
    sessionId: "session_1",
    requestSizeBytes: 10,
    version: 1,
  });
}

function visibilityDecision(
  state: LocalMcpToolVisibilityDecisionV1["state"],
  localToolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
): LocalMcpToolVisibilityDecisionV1 {
  const byState: Record<
    LocalMcpToolVisibilityDecisionV1["state"],
    Pick<LocalMcpToolVisibilityDecisionV1, "reasons" | "safeSummary">
  > = {
    hidden: {
      reasons: ["default_hidden"],
      safeSummary: "Hidden by default.",
    },
    listed_disabled: {
      reasons: ["default_hidden"],
      safeSummary: "Tool disabled.",
    },
    listed_dry_run: {
      reasons: ["dry_run_only", "safe_summary_only"],
      safeSummary: "Dry run only.",
    },
    listed_requires_approval: {
      reasons: ["approval_required", "approval_missing"],
      safeSummary: "Approval required.",
    },
    listed_ready_for_review: {
      reasons: ["safe_for_internal_review", "safe_summary_only"],
      safeSummary: "Ready for review. No handler executed.",
    },
    blocked_by_privacy: {
      reasons: ["privacy_check_failed"],
      safeSummary: "Blocked. Review privacy.",
    },
    disabled_by_admin: {
      reasons: ["admin_disabled"],
      safeSummary: "Tool disabled.",
    },
  };

  return {
    kind: "local_mcp_tool_visibility_decision",
    localToolId,
    projectedToolName: localToolIdToProjectedToolName(localToolId),
    state,
    ...byState[state],
    version: 1,
  };
}

async function completeSafeInput(
  overrides: Partial<LocalMcpPrivacyReviewGateInputV1> = {},
): Promise<LocalMcpPrivacyReviewGateInputV1> {
  const localToolId = overrides.localToolId ?? "local_mcp.application_package.summarize";
  return buildDefaultLocalMcpPrivacyReviewGateInput(localToolId, {
    visibilityDecision: visibilityDecision("listed_ready_for_review", localToolId),
    privacyReviewComplete: true,
    privacyCheck: safePrivacyCheck(),
    approvalDecision: approvedDecision(),
    auditEvents: await auditEvents(localToolId),
    handlerBoundary: await handlerBoundaryReady(localToolId),
    copyCatalog: copyCatalog(),
    ...overrides,
  });
}

function expectSafeGateResult(result: LocalMcpPrivacyReviewGateResultV1): void {
  expect(() => assertLocalMcpPrivacyReviewGateResult(result)).not.toThrow();
  expect(() => assertLocalMcpPrivacySafeOutput(result)).not.toThrow();
  expect(JSON.stringify(result)).not.toMatch(
    /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE|NEVER_USE_SENTINEL_DO_NOT_EXPOSE|RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE|RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE|SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE|RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE|SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE|SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE|STACK_TRACE_SENTINEL_DO_NOT_EXPOSE|GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  );
}

describe("local MCP privacy review gate defaults", () => {
  it("blocks by default for each Local MCP tool", () => {
    for (const localToolId of EXPECTED_LOCAL_TOOL_IDS) {
      const result = evaluateLocalMcpPrivacyReviewGate(
        buildDefaultLocalMcpPrivacyReviewGateInput(localToolId),
      );
      expect(result.status).toBe("blocked");
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          "default_blocked",
          "privacy_review_missing",
          "privacy_check_missing",
          "tool_not_visible",
        ]),
      );
      expect(result.copyKey).toBe("blocked_privacy");
      expect(result.userFacingCopy).toBe(getLocalMcpApprovalUxCopy("blocked_privacy").text);
      expectSafeGateResult(result);
    }
  });

  it("returns deterministic safe summaries", () => {
    const first = EXPECTED_LOCAL_TOOL_IDS.map((localToolId) =>
      evaluateLocalMcpPrivacyReviewGate(buildDefaultLocalMcpPrivacyReviewGateInput(localToolId)),
    );
    const second = EXPECTED_LOCAL_TOOL_IDS.map((localToolId) =>
      evaluateLocalMcpPrivacyReviewGate(buildDefaultLocalMcpPrivacyReviewGateInput(localToolId)),
    );
    expect(first).toEqual(second);
    expect(first.map((result) => result.safeSummary)).toEqual([
      "Blocked. Review privacy.",
      "Blocked. Review privacy.",
      "Blocked. Review privacy.",
      "Blocked. Review privacy.",
    ]);
  });

  it("does not mutate input", async () => {
    const input = await completeSafeInput();
    const before = JSON.stringify(input);
    evaluateLocalMcpPrivacyReviewGate(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("local MCP privacy review gate visibility", () => {
  it("blocks hidden tools", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ visibilityDecision: visibilityDecision("hidden") }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("tool_not_visible");
    expectSafeGateResult(result);
  });

  it("blocks disabled tools", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ visibilityDecision: visibilityDecision("listed_disabled") }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("tool_visibility_blocked");
  });

  it("blocks privacy-blocked tools", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ visibilityDecision: visibilityDecision("blocked_by_privacy") }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("tool_visibility_blocked");
  });

  it("continues for dry-run tools but does not mark them executable", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ visibilityDecision: visibilityDecision("listed_dry_run") }),
    );
    expect(result.status).toBe("ready_for_internal_review");
    expect(result.reasons).toEqual(expect.arrayContaining(["safe_summary_only"]));
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(
      /ready_for_production|ready_to_execute|safe_to_run|executable|chatgpt/u,
    );
  });
});

describe("local MCP privacy review gate privacy checks", () => {
  it("blocks missing privacy checks", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ privacyCheck: undefined }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("privacy_check_missing");
    expect(result.safeSummary).toBe("Blocked. Review privacy.");
  });

  it("blocks unsafe PR24 privacy findings without leaking sentinel values", async () => {
    for (const category of LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1) {
      const result = evaluateLocalMcpPrivacyReviewGate(
        await completeSafeInput({ privacyCheck: unsafePrivacyCheck(category) }),
      );
      expect(result.status).toBe("blocked");
      expect(result.reasons).toContain("privacy_check_failed");
      expectSafeGateResult(result);
    }
  });

  it("passes safe PR24 privacy check when other gates are present", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    expect(result.status).toBe("ready_for_internal_review");
    expect(result.reasons).toContain("all_design_gates_present");
  });
});

describe("local MCP privacy review gate approval", () => {
  it("requires approval when configured", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({
        visibilityDecision: visibilityDecision("listed_requires_approval"),
        approvalDecision: undefined,
      }),
    );
    expect(result.status).toBe("review_required");
    expect(result.reasons).toContain("approval_missing");
    expect(result.copyKey).toBe("approval_required");
  });

  it("blocks denied approval", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ approvalDecision: deniedDecision() }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("approval_denied");
    expect(result.copyKey).toBe("denied");
    expect(result.userFacingCopy).toBe("Denied. Nothing ran.");
  });

  it("continues with approved approval", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ approvalDecision: approvedDecision() }),
    );
    expect(result.status).toBe("ready_for_internal_review");
  });
});

describe("local MCP privacy review gate audit", () => {
  it("blocks missing audit events", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput({ auditEvents: [] }));
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("audit_missing");
    expect(result.safeSummary).toBe("Audit unavailable. Tool blocked.");
  });

  it("continues when audit events exist", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    expect(result.reasons).not.toContain("audit_missing");
    expect(result.status).toBe("ready_for_internal_review");
  });
});

describe("local MCP privacy review gate handler boundary", () => {
  it("blocks missing handler boundary", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ handlerBoundary: undefined }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual(
      expect.arrayContaining(["handler_boundary_missing", "handler_unavailable"]),
    );
    expect(result.safeSummary).toBe("No handler yet.");
  });

  it("blocks unavailable handler boundary", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ handlerBoundary: await handlerBoundaryBlocked() }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("handler_boundary_not_ready");
  });

  it("continues when future handler boundary is ready for review", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ handlerBoundary: await handlerBoundaryReady() }),
    );
    expect(result.status).toBe("ready_for_internal_review");
    expect(JSON.stringify(result)).not.toMatch(/callRealHandler|handlerRegistry|ready_to_execute/u);
  });
});

describe("local MCP privacy review gate remote transport", () => {
  it("does not require transport for local-only review by default", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ remoteTransportPreflight: undefined }),
    );
    expect(result.status).toBe("ready_for_internal_review");
    expect(result.reasons).not.toContain("transport_missing");
  });

  it("blocks missing transport when remote is required", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ requireRemoteReady: true, remoteTransportPreflight: undefined }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("transport_missing");
  });

  it("blocks disabled transport when remote is required", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({
        requireRemoteReady: true,
        remoteTransportPreflight: remotePreflightBlocked(),
      }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("transport_disabled");
    expect(result.safeSummary).toBe("Remote tools disabled.");
  });

  it("continues with non-production allowed preflight when remote is required", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({
        requireRemoteReady: true,
        remoteTransportPreflight: remotePreflightAllowed(),
      }),
    );
    expect(result.status).toBe("ready_for_internal_review");
    expect(result.reasons).toContain("all_design_gates_present");
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/production_ready|prod ready/u);
  });
});

describe("local MCP privacy review gate copy integration", () => {
  it("uses PR26 copy for privacy block", () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
    );
    expect(result.copyKey).toBe("blocked_privacy");
    expect(result.userFacingCopy).toBe(getLocalMcpApprovalUxCopy("blocked_privacy").text);
  });

  it("uses PR26 copy for approval required", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ approvalDecision: undefined }),
    );
    expect(result.copyKey).toBe("approval_required");
    expect(result.userFacingCopy).toBe(getLocalMcpApprovalUxCopy("approval_required").text);
  });

  it("uses PR26 copy for audit unavailable", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput({ auditEvents: [] }));
    expect(result.copyKey).toBe("audit_boundary_required");
    expect(result.userFacingCopy).toBe(getLocalMcpApprovalUxCopy("audit_boundary_required").text);
  });

  it("uses PR26 copy for handler unavailable", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ handlerBoundary: undefined }),
    );
    expect(result.copyKey).toBe("handler_unavailable");
    expect(result.userFacingCopy).toBe(getLocalMcpApprovalUxCopy("handler_unavailable").text);
  });

  it("all gate outputs pass PR24 privacy checks", async () => {
    const outputs = [
      evaluateLocalMcpPrivacyReviewGate(
        buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
      ),
      evaluateLocalMcpPrivacyReviewGate(await completeSafeInput()),
      evaluateLocalMcpPrivacyReviewGate(await completeSafeInput({ privacyCheck: unsafePrivacyCheck() })),
    ];
    for (const output of outputs) expectSafeGateResult(output);
  });
});

describe("local MCP privacy review gate ready for internal review", () => {
  it("returns ready_for_internal_review only when all design gates are present", async () => {
    const ready = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    const missingHandler = evaluateLocalMcpPrivacyReviewGate(
      await completeSafeInput({ handlerBoundary: undefined }),
    );
    expect(ready.status).toBe("ready_for_internal_review");
    expect(ready.reasons).toEqual(
      expect.arrayContaining(["all_design_gates_present", "safe_summary_only"]),
    );
    expect(missingHandler.status).not.toBe("ready_for_internal_review");
  });

  it("safe summary says no handler executed", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    expect(result.safeSummary).toBe("Ready for internal review. No handler executed.");
  });

  it("does not imply ChatGPT App readiness or production readiness", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(
      /chatgpt|ready_for_production|approved_for_remote|safe_to_run|executable/u,
    );
  });
});

describe("local MCP privacy review gate assertions", () => {
  it("accepts valid gate results", async () => {
    const result = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    expect(() =>
      assertLocalMcpPrivacyReviewGateResult(result),
    ).not.toThrow();
  });

  it("rejects invalid status", () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
    );
    expect(() =>
      assertLocalMcpPrivacyReviewGateResult({
        ...result,
        status: "ready_to_execute" as LocalMcpPrivacyReviewGateResultV1["status"],
      }),
    ).toThrow(TypeError);
  });

  it("rejects unsafe copy", () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
    );
    expect(() =>
      assertLocalMcpPrivacyReviewGateResult({
        ...result,
        userFacingCopy: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
      }),
    ).toThrow(TypeError);
  });

  it("rejects malformed reasons", () => {
    const result = evaluateLocalMcpPrivacyReviewGate(
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
    );
    expect(() =>
      assertLocalMcpPrivacyReviewGateResult({
        ...result,
        reasons: ["raw_arguments_exposed" as LocalMcpPrivacyReviewGateResultV1["reasons"][number]],
      }),
    ).toThrow(TypeError);
  });
});

describe("local MCP privacy review gate list", () => {
  it("builds deterministic lists", async () => {
    const inputs = [
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
      await completeSafeInput({ localToolId: "local_mcp.evidence_graph.summarize" }),
    ];
    expect(listLocalMcpPrivacyReviewGateResults(inputs)).toEqual(
      listLocalMcpPrivacyReviewGateResults(inputs),
    );
  });

  it("keeps all results privacy-safe", async () => {
    const list = listLocalMcpPrivacyReviewGateResults([
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
      await completeSafeInput(),
    ]);
    for (const result of list.results) expectSafeGateResult(result);
  });
});

describe("local MCP privacy review gate scope guard", () => {
  it("does not import product runtimes, UI, transport runtime, network, persistence, or SDKs", () => {
    const src = privacyReviewGateSource;
    expect(src).not.toMatch(
      /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout)[^"']*["']/iu,
    );
    expect(src).not.toMatch(/\b(fetch|axios|undici|WebSocket|EventSource)\b/u);
    expect(src).not.toMatch(/from\s+["'][^"']*(openai|oauth|@modelcontextprotocol)[^"']*["']/iu);
    expect(src).not.toMatch(
      /\bfunction\s+(invoke|handle|dispatch|callRealHandler|persist|submit|export|download|listen)\b/u,
    );
    expect(src).not.toMatch(/\b(send|submit|apply|export|download)\s*\(/u);
  });

  it("sorts reasons deterministically", () => {
    expect(
      sortLocalMcpPrivacyReviewGateReasons([
        "safe_summary_only",
        "default_blocked",
        "approval_missing",
        "safe_summary_only",
      ]),
    ).toEqual(["default_blocked", "approval_missing", "safe_summary_only"]);
  });

  it("exposes a pass helper only for internal review", async () => {
    const ready = evaluateLocalMcpPrivacyReviewGate(await completeSafeInput());
    const blocked = evaluateLocalMcpPrivacyReviewGate(
      buildDefaultLocalMcpPrivacyReviewGateInput("local_mcp.application_package.summarize"),
    );
    expect(isLocalMcpPrivacyReviewGatePassedForInternalReview(ready)).toBe(true);
    expect(isLocalMcpPrivacyReviewGatePassedForInternalReview(blocked)).toBe(false);
  });
});
