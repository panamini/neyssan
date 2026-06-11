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
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallValidationResultV1,
} from "../mcpCallEnvelope";
import {
  buildLocalMcpHandlerBoundary,
} from "../mcpHandlerBoundary";
import type { LocalMcpHandlerBoundaryV1 } from "../mcpHandlerBoundary";
import {
  projectLocalMcpRegistryToMcpToolsList,
} from "../mcpSchemaProjection";
import {
  buildDisabledLocalMcpRemoteTransportConfig,
  buildNonProductionLocalMcpRemoteTransportSpikeConfig,
  validateLocalMcpRemoteTransportPreflight,
} from "../mcpRemoteTransportSpike";
import type {
  LocalMcpRemoteTransportConfigV1,
  LocalMcpRemoteTransportPreflightResultV1,
} from "../mcpRemoteTransportSpike";
import {
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpSafeTextFixtureOutput,
  buildLocalMcpUnsafeFixtureOutput,
  collectLocalMcpPrivacyLeakFindings,
} from "../privacyRedactionFixtures";
import type {
  LocalMcpPrivacyRedactionCheckResultV1,
} from "../privacyRedactionFixtures";
import type { LocalMcpToolIdV1 } from "../schema";
import { buildLocalMcpToolRegistry } from "../toolRegistry";
import visibilitySource from "../mcpToolVisibilityPolicy.ts?raw";
import {
  assertLocalMcpToolVisibilityDecision,
  buildDefaultLocalMcpToolVisibilityPolicyContext,
  evaluateLocalMcpToolVisibility,
  isLocalMcpToolVisibleToExternalSurface,
  listLocalMcpToolVisibilityDecisions,
  sortLocalMcpToolVisibilityReasons,
} from "../mcpToolVisibilityPolicy";
import type {
  LocalMcpToolVisibilityDecisionV1,
  LocalMcpToolVisibilityPolicyContextV1,
} from "../mcpToolVisibilityPolicy";

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

function unsafePrivacyCheck(): LocalMcpPrivacyRedactionCheckResultV1 {
  return collectLocalMcpPrivacyLeakFindings(buildLocalMcpUnsafeFixtureOutput("private_fact"));
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

function validValidation(
  localToolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
): Extract<LocalMcpCallValidationResultV1, { valid: true }> {
  return {
    valid: true,
    toolName: localToolIdToProjectedToolName(localToolId),
    localToolId,
    version: 1,
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

async function auditEvents(): Promise<readonly LocalMcpAuditEventV1[]> {
  return [
    await buildLocalMcpAuditEvent({
      eventType: "approval_requested",
      requestId: "request_1",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      userId: "user_1",
      sessionId: "session_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "allowed",
      safeSummary: "Approval required.",
    }),
  ];
}

function remoteAllowed(): Readonly<{
  config: LocalMcpRemoteTransportConfigV1;
  preflight: LocalMcpRemoteTransportPreflightResultV1;
}> {
  const config = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
    allowedOrigins: ["http://localhost:3000"],
    allowedHosts: ["localhost:3000"],
  });
  return {
    config,
    preflight: validateLocalMcpRemoteTransportPreflight({
      kind: "local_mcp_remote_transport_preflight_input",
      config,
      origin: "http://localhost:3000",
      host: "localhost:3000",
      userId: "user_1",
      sessionId: "session_1",
      requestSizeBytes: 10,
      expectedResponseSizeBytes: 10,
      version: 1,
    }),
  };
}

function remoteBlocked(): Readonly<{
  config: LocalMcpRemoteTransportConfigV1;
  preflight: LocalMcpRemoteTransportPreflightResultV1;
}> {
  const config = buildDisabledLocalMcpRemoteTransportConfig();
  return {
    config,
    preflight: validateLocalMcpRemoteTransportPreflight({
      kind: "local_mcp_remote_transport_preflight_input",
      config,
      origin: "http://localhost:3000",
      host: "localhost:3000",
      userId: "user_1",
      sessionId: "session_1",
      requestSizeBytes: 10,
      version: 1,
    }),
  };
}

async function handlerBoundary(): Promise<LocalMcpHandlerBoundaryV1> {
  const currentEnvelope = envelopeForTool();
  const approvalDecision = approvedDecision();
  const envelopeWithApproval: LocalMcpCallEnvelopeV1 = {
    ...currentEnvelope,
    approval: approvalDecisionToLocalMcpApproval(approvalDecision),
  };
  const validation = validateLocalMcpCallEnvelope(envelopeWithApproval);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("expected valid validation");
  const approvalRequest = buildLocalMcpApprovalRequest(envelopeWithApproval, validation, {
    requestedAt: "2026-06-11T12:00:00.000Z",
  });
  return buildLocalMcpHandlerBoundary({
    envelope: envelopeWithApproval,
    validation,
    approvalRequest,
    approvalDecision,
    rollbackPlanRef: "rollback:delete-policy-only",
  });
}

async function richContext(
  overrides: Partial<LocalMcpToolVisibilityPolicyContextV1> = {},
): Promise<LocalMcpToolVisibilityPolicyContextV1> {
  return buildDefaultLocalMcpToolVisibilityPolicyContext({
    privacyReviewComplete: true,
    privacyCheck: safePrivacyCheck(),
    callEnvelope: envelopeForTool(),
    callValidation: validValidation(),
    approvalDecision: approvedDecision(),
    auditEvents: await auditEvents(),
    handlerBoundary: await handlerBoundary(),
    allowDisabledListing: true,
    ...overrides,
  });
}

function evaluate(
  localToolId: LocalMcpToolIdV1,
  context: LocalMcpToolVisibilityPolicyContextV1,
): LocalMcpToolVisibilityDecisionV1 {
  return evaluateLocalMcpToolVisibility({
    kind: "local_mcp_tool_visibility_policy_input",
    localToolId,
    context,
    version: 1,
  });
}

function expectSafeDecision(decision: LocalMcpToolVisibilityDecisionV1): void {
  expect(() => assertLocalMcpToolVisibilityDecision(decision)).not.toThrow();
  expect(() => assertLocalMcpPrivacySafeOutput(decision)).not.toThrow();
  expect(JSON.stringify(decision)).not.toMatch(
    /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE|NEVER_USE_SENTINEL_DO_NOT_EXPOSE|RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE|RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE|SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE|RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE|SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE|SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE|STACK_TRACE_SENTINEL_DO_NOT_EXPOSE|GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  );
}

describe("local MCP tool visibility defaults", () => {
  it("lists exactly four hidden decisions by default", () => {
    const list = listLocalMcpToolVisibilityDecisions();

    expect(list.kind).toBe("local_mcp_tool_visibility_list");
    expect(list.version).toBe(1);
    expect(list.decisions).toHaveLength(4);
    expect(list.decisions.map((decision) => decision.localToolId)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    for (const decision of list.decisions) {
      expect(decision.state).toBe("hidden");
      expect(decision.reasons).toEqual(expect.arrayContaining([
        "default_hidden",
        "transport_disabled",
        "handler_unavailable",
        "privacy_review_missing",
      ]));
      expectSafeDecision(decision);
    }
  });

  it("uses deterministic ordering and stable safe summaries", () => {
    const first = listLocalMcpToolVisibilityDecisions();
    const second = listLocalMcpToolVisibilityDecisions();

    expect(first).toEqual(second);
    expect(first.decisions.map((decision) => decision.safeSummary)).toEqual([
      "Hidden by default.",
      "Hidden by default.",
      "Hidden by default.",
      "Hidden by default.",
    ]);
  });

  it("does not mutate default registry/context", () => {
    const registry = buildLocalMcpToolRegistry();
    const before = JSON.stringify(registry);
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({ registry });

    listLocalMcpToolVisibilityDecisions(context);

    expect(JSON.stringify(registry)).toBe(before);
  });
});

describe("local MCP tool visibility admin disabled", () => {
  it("admin disabled overrides otherwise safe context", async () => {
    const context = await richContext({
      adminDisabledToolIds: ["local_mcp.application_package.summarize"],
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("disabled_by_admin");
    expect(decision.reasons).toContain("admin_disabled");
    expect(isLocalMcpToolVisibleToExternalSurface(decision)).toBe(false);
    expectSafeDecision(decision);
  });

  it("admin disabled can affect one tool without affecting others", async () => {
    const context = await richContext({
      allowDryRunListing: true,
      adminDisabledToolIds: ["local_mcp.evidence_graph.summarize"],
    });
    const list = listLocalMcpToolVisibilityDecisions(context);

    expect(Object.fromEntries(list.decisions.map((decision) => [decision.localToolId, decision.state])))
      .toEqual({
        "local_mcp.application_package.summarize": "listed_ready_for_review",
        "local_mcp.evidence_graph.summarize": "disabled_by_admin",
        "local_mcp.resume_variant_plan.summarize": "listed_dry_run",
        "local_mcp.review_cockpit.summarize": "listed_dry_run",
      });
  });
});

describe("local MCP tool visibility privacy gates", () => {
  it("blocks external visibility when privacy review is missing", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      allowRemoteListing: true,
      allowDisabledListing: true,
      privacyCheck: safePrivacyCheck(),
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("blocked_by_privacy");
    expect(decision.reasons).toContain("privacy_review_missing");
    expect(decision.safeSummary).toBe("Blocked. Review privacy.");
    expectSafeDecision(decision);
  });

  it("blocks when PR24 privacy check fails", async () => {
    const context = await richContext({ privacyCheck: unsafePrivacyCheck() });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("blocked_by_privacy");
    expect(decision.reasons).toEqual(expect.arrayContaining([
      "privacy_check_failed",
      "privacy_fixture_failed",
    ]));
    expectSafeDecision(decision);
  });

  it("does not list when privacy review is complete but PR24 check is missing", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      allowDryRunListing: true,
      privacyReviewComplete: true,
      privacyCheck: undefined,
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("blocked_by_privacy");
    expect(decision.reasons).toContain("privacy_review_missing");
    expect(decision.reasons).not.toContain("dry_run_only");
  });

  it("privacy block overrides dry-run listing", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      allowDryRunListing: true,
      privacyReviewComplete: true,
      privacyCheck: unsafePrivacyCheck(),
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("blocked_by_privacy");
    expect(decision.reasons).not.toContain("dry_run_only");
  });

  it("privacy block does not override admin disabled", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      privacyReviewComplete: true,
      privacyCheck: unsafePrivacyCheck(),
      adminDisabledToolIds: ["local_mcp.application_package.summarize"],
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("disabled_by_admin");
    expect(decision.reasons).toEqual(expect.arrayContaining(["admin_disabled", "privacy_check_failed"]));
  });
});

describe("local MCP tool visibility dry-run listing", () => {
  it("lists dry-run tools when explicitly allowed and privacy is safe", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      allowDryRunListing: true,
      privacyReviewComplete: true,
      privacyCheck: safePrivacyCheck(),
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("listed_dry_run");
    expect(decision.reasons).toEqual(expect.arrayContaining(["dry_run_only", "safe_summary_only"]));
    expect(decision.safeSummary).toBe("Dry run only.");
    expectSafeDecision(decision);
  });

  it("does not imply executable or production-ready", () => {
    const decision = evaluate(
      "local_mcp.application_package.summarize",
      buildDefaultLocalMcpToolVisibilityPolicyContext({
        allowDryRunListing: true,
        privacyReviewComplete: true,
        privacyCheck: safePrivacyCheck(),
      }),
    );

    expect(JSON.stringify(decision)).not.toMatch(/ready_to_execute|production_ready|executable/u);
    expect(decision.state).not.toBe("listed_ready_for_review");
  });
});

describe("local MCP tool visibility approval states", () => {
  it("lists requires approval when approval is missing", async () => {
    const context = await richContext({
      approvalDecision: undefined,
      callValidation: validValidation(),
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("listed_requires_approval");
    expect(decision.reasons).toEqual(expect.arrayContaining(["approval_required", "approval_missing"]));
    expect(decision.safeSummary).toBe("Approval required.");
    expectSafeDecision(decision);
  });

  it("does not list requires approval when privacy review is missing", async () => {
    const context = await richContext({
      approvalDecision: undefined,
      privacyReviewComplete: false,
      privacyCheck: undefined,
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("blocked_by_privacy");
  });

  it("lists disabled when approval is denied", async () => {
    const context = await richContext({ approvalDecision: deniedDecision() });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("listed_disabled");
    expect(decision.reasons).toEqual(expect.arrayContaining(["approval_required", "approval_denied"]));
    expectSafeDecision(decision);
  });

  it("can progress past approval when approval is approved", async () => {
    const context = await richContext({ approvalDecision: approvedDecision() });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("listed_ready_for_review");
    expect(decision.reasons).toContain("safe_for_internal_review");
  });
});

describe("local MCP tool visibility transport states", () => {
  it("keeps remote tools hidden when remote listing is not allowed", () => {
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      privacyReviewComplete: true,
      privacyCheck: safePrivacyCheck(),
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("hidden");
    expect(decision.reasons).toEqual(expect.arrayContaining([
      "remote_transport_not_allowed",
      "transport_disabled",
    ]));
  });

  it("lists disabled when remote listing is requested but transport preflight is blocked and disabled listing is allowed", async () => {
    const remote = remoteBlocked();
    const context = await richContext({
      allowRemoteListing: true,
      allowDisabledListing: true,
      remoteTransportConfig: remote.config,
      remoteTransportPreflight: remote.preflight,
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(decision.state).toBe("listed_disabled");
    expect(decision.reasons).toEqual(expect.arrayContaining(["transport_blocked", "transport_disabled"]));
  });

  it("does not expose remote-ready state from disabled transport", async () => {
    const remote = remoteBlocked();
    const decision = evaluate(
      "local_mcp.application_package.summarize",
      await richContext({
        allowRemoteListing: true,
        remoteTransportConfig: remote.config,
        remoteTransportPreflight: remote.preflight,
      }),
    );

    expect(decision.state).not.toBe("listed_ready_for_review");
  });
});

describe("local MCP tool visibility ready-for-review", () => {
  it("returns listed_ready_for_review only when every design gate is present", async () => {
    const remote = remoteAllowed();
    const context = await richContext({
      allowRemoteListing: true,
      remoteTransportConfig: remote.config,
      remoteTransportPreflight: remote.preflight,
    });
    const decision = evaluate("local_mcp.application_package.summarize", context);

    expect(remote.preflight.status).toBe("allowed_for_non_production_spike");
    expect(decision.state).toBe("listed_ready_for_review");
    expect(decision.reasons).toContain("safe_for_internal_review");
    expectSafeDecision(decision);
  });

  it("does not leak ready-for-review across tools from a shared call validation", async () => {
    const context = await richContext();
    const list = listLocalMcpToolVisibilityDecisions(context);

    expect(Object.fromEntries(list.decisions.map((decision) => [decision.localToolId, decision.state])))
      .toEqual({
        "local_mcp.application_package.summarize": "listed_ready_for_review",
        "local_mcp.evidence_graph.summarize": "hidden",
        "local_mcp.resume_variant_plan.summarize": "hidden",
        "local_mcp.review_cockpit.summarize": "hidden",
      });
  });

  it("safe summary says no handler executed", async () => {
    const decision = evaluate("local_mcp.application_package.summarize", await richContext());

    expect(decision.state).toBe("listed_ready_for_review");
    expect(decision.safeSummary).toBe("Ready for review. No handler executed.");
  });
});

describe("local MCP tool visibility assertions", () => {
  it("accepts valid decisions", () => {
    const decision = listLocalMcpToolVisibilityDecisions().decisions[0];

    expect(() => assertLocalMcpToolVisibilityDecision(decision)).not.toThrow();
  });

  it("rejects malformed state", () => {
    const decision = listLocalMcpToolVisibilityDecisions().decisions[0];

    expect(() =>
      assertLocalMcpToolVisibilityDecision({
        ...decision,
        state: "ready_to_execute" as LocalMcpToolVisibilityDecisionV1["state"],
      }),
    ).toThrow(TypeError);
  });

  it("rejects malformed reasons", () => {
    const decision = listLocalMcpToolVisibilityDecisions().decisions[0];

    expect(() =>
      assertLocalMcpToolVisibilityDecision({
        ...decision,
        reasons: ["raw_arguments_exposed" as LocalMcpToolVisibilityDecisionV1["reasons"][number]],
      }),
    ).toThrow(TypeError);
  });

  it("rejects unsafe summaries", () => {
    const decision = listLocalMcpToolVisibilityDecisions().decisions[0];

    expect(() =>
      assertLocalMcpToolVisibilityDecision({
        ...decision,
        safeSummary: "Raw arguments include a session token.",
      }),
    ).toThrow(TypeError);
  });

  it("rejects bad version", () => {
    const decision = listLocalMcpToolVisibilityDecisions().decisions[0];

    expect(() =>
      assertLocalMcpToolVisibilityDecision({
        ...decision,
        version: 2 as 1,
      }),
    ).toThrow(TypeError);
  });
});

describe("local MCP tool visibility privacy fixture integration", () => {
  it("every returned decision is PR24 privacy safe", async () => {
    const scenarios = [
      listLocalMcpToolVisibilityDecisions(),
      listLocalMcpToolVisibilityDecisions(await richContext()),
      listLocalMcpToolVisibilityDecisions({
        allowDryRunListing: true,
        privacyReviewComplete: true,
        privacyCheck: safePrivacyCheck(),
      }),
      listLocalMcpToolVisibilityDecisions({
        privacyReviewComplete: true,
        privacyCheck: unsafePrivacyCheck(),
      }),
    ];

    for (const list of scenarios) {
      for (const decision of list.decisions) {
        expect(() => assertLocalMcpPrivacySafeOutput(decision)).not.toThrow();
      }
    }
  });

  it("unsafe privacy fixture cannot appear in decision JSON", () => {
    const decision = evaluate(
      "local_mcp.application_package.summarize",
      buildDefaultLocalMcpToolVisibilityPolicyContext({
        privacyReviewComplete: true,
        privacyCheck: unsafePrivacyCheck(),
      }),
    );

    expect(decision.state).toBe("blocked_by_privacy");
    expect(JSON.stringify(decision)).not.toContain("PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE");
  });
});

describe("local MCP tool visibility scope guard", () => {
  it("does not import product runtimes, UI, transport runtimes, network, persistence, or SDKs", () => {
    expect(visibilitySource).not.toMatch(
      /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout)[^"']*["']/iu,
    );
    expect(visibilitySource).not.toMatch(/\b(fetch|axios|undici|WebSocket|EventSource)\b/u);
    expect(visibilitySource).not.toMatch(/from\s+["'][^"']*(openai|oauth|@modelcontextprotocol)[^"']*["']/iu);
    expect(visibilitySource).not.toMatch(/\bfunction\s+(execute|run|invoke|route|serve|start|dispatch|callRealHandler|persist|write|save)\b/u);
    expect(visibilitySource).not.toMatch(/\b(send|submit|apply|export|download)\s*\(/u);
  });

  it("sorts reasons deterministically", () => {
    expect(sortLocalMcpToolVisibilityReasons([
      "safe_summary_only",
      "admin_disabled",
      "default_hidden",
      "admin_disabled",
    ])).toEqual(["admin_disabled", "safe_summary_only", "default_hidden"]);
  });

  it("can evaluate with projected descriptors from PR18", () => {
    const registry = buildLocalMcpToolRegistry();
    const context = buildDefaultLocalMcpToolVisibilityPolicyContext({
      registry,
      descriptors: projectLocalMcpRegistryToMcpToolsList(registry).tools,
    });

    expect(listLocalMcpToolVisibilityDecisions(context).decisions).toHaveLength(4);
  });
});
