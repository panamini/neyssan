import { describe, expect, it } from "vitest";
import approvalAuditSource from "../mcpApprovalAuditBoundary.ts?raw";
import {
  approvalDecisionToLocalMcpApproval,
  assertLocalMcpApprovalDecision,
  assertLocalMcpApprovalRequest,
  assertLocalMcpAuditEvent,
  buildLocalMcpApprovalDecision,
  buildLocalMcpApprovalRequest,
  buildLocalMcpAuditEvent,
  buildLocalMcpSafeArgumentSummary,
} from "../mcpApprovalAuditBoundary";
import { parseLocalMcpCallEnvelope, validateLocalMcpCallEnvelope } from "../mcpCallEnvelope";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallValidationResultV1,
} from "../mcpCallEnvelope";
import { buildLocalMcpToolRegistry } from "../toolRegistry";

function envelope(
  overrides: Partial<LocalMcpCallEnvelopeV1> = {},
): LocalMcpCallEnvelopeV1 {
  return {
    kind: "local_mcp_call_envelope",
    toolName: "twoweeks.application_package.summarize",
    arguments: { applicationPackageRef: { id: "application-package:abc" } },
    user: {
      userId: "user_1",
      sessionId: "session_1",
    },
    approval: {
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T00:00:00.000Z",
      reason: "local approval",
      version: 1,
    },
    requestId: "request_1",
    version: 1,
    ...overrides,
  };
}

function validEnvelopeAndValidation(): Readonly<{
  envelope: LocalMcpCallEnvelopeV1;
  validation: LocalMcpCallValidationResultV1;
}> {
  const current = envelope();
  const validation = validateLocalMcpCallEnvelope(current);
  expect(validation.valid).toBe(true);
  return { envelope: current, validation };
}

describe("local MCP safe argument summary", () => {
  it("includes only expected top-level ref fields in deterministic order", () => {
    const summary = buildLocalMcpSafeArgumentSummary({
      reviewCockpitRef: { id: "review-cockpit:1" },
      rawText: "raw cv text",
      applicationPackageRef: { id: "application-package:1" },
      evidenceGraphRef: { id: "evidence-graph:1" },
      sourceDocument: { id: "source-document:secret" },
    });

    expect(summary).toEqual({
      kind: "local_mcp_safe_argument_summary",
      fields: ["applicationPackageRef", "evidenceGraphRef", "reviewCockpitRef"],
      refIds: ["application-package:1", "evidence-graph:1", "review-cockpit:1"],
      omittedRawValueCount: 2,
      version: 1,
    });
  });

  it("excludes sensitive unknown field names and only counts omitted values", () => {
    const summary = buildLocalMcpSafeArgumentSummary({
      rawText: "raw",
      sourceText: "source",
      sourceDocument: "document",
      cvText: "cv",
      coverLetterText: "cover",
      privateFacts: ["private"],
      neverUse: ["never"],
      never_use: ["never"],
      generatedText: "generated",
      fullText: "full",
      unknownSafeLookingName: { id: "not-expected" },
    });

    expect(summary.fields).toEqual([]);
    expect(summary.refIds).toEqual([]);
    expect(summary.omittedRawValueCount).toBe(11);
    expect(JSON.stringify(summary)).not.toMatch(
      /rawText|sourceText|sourceDocument|cvText|coverLetterText|privateFacts|neverUse|never_use|generatedText|fullText|unknownSafeLookingName|not-expected/u,
    );
  });

  it("extracts ref ids only from expected ref objects", () => {
    const summary = buildLocalMcpSafeArgumentSummary({
      applicationPackageRef: { id: "application-package:abc" },
      evidenceGraphRef: { id: "" },
      resumeVariantPlanRef: { id: "resume-variant-plan:def", rawText: "nested raw" },
      privateFacts: { id: "private-fact:secret" },
      generatedText: { nested: { id: "generated:secret" } },
    });

    expect(summary.fields).toEqual([
      "applicationPackageRef",
      "evidenceGraphRef",
      "resumeVariantPlanRef",
    ]);
    expect(summary.refIds).toEqual(["application-package:abc", "resume-variant-plan:def"]);
    expect(summary.omittedRawValueCount).toBe(4);
  });

  it("is deterministic and does not mutate arguments", () => {
    const args = {
      resumeVariantPlanRef: { id: "resume-variant-plan:1" },
      applicationPackageRef: { id: "application-package:1" },
      rawText: "raw",
    };
    const before = JSON.stringify(args);

    expect(buildLocalMcpSafeArgumentSummary(args)).toEqual(
      buildLocalMcpSafeArgumentSummary({
        rawText: "raw",
        applicationPackageRef: { id: "application-package:1" },
        resumeVariantPlanRef: { id: "resume-variant-plan:1" },
      }),
    );
    expect(JSON.stringify(args)).toBe(before);
  });
});

describe("local MCP approval request boundary", () => {
  it("builds an approval request from a PR19 envelope and validation", () => {
    const { envelope: current, validation } = validEnvelopeAndValidation();
    const request = buildLocalMcpApprovalRequest(current, validation, {
      requestedAt: "2026-06-11T12:00:00.000Z",
    });

    expect(request).toEqual({
      kind: "local_mcp_approval_request",
      requestId: "request_1",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      userId: "user_1",
      sessionId: "session_1",
      reason: "Approval required for local_mcp.application_package.summarize.",
      requestedAt: "2026-06-11T12:00:00.000Z",
      riskLevel: "medium",
      argumentSummary: {
        kind: "local_mcp_safe_argument_summary",
        fields: ["applicationPackageRef"],
        refIds: ["application-package:abc"],
        omittedRawValueCount: 0,
        version: 1,
      },
      version: 1,
    });
    expect(JSON.stringify(request)).not.toContain("arguments");
    expect(JSON.stringify(request)).not.toContain("raw cv text");
    expect(() => assertLocalMcpApprovalRequest(request)).not.toThrow();
  });

  it("rejects missing PR19 requestId instead of generating one", () => {
    const { validation } = validEnvelopeAndValidation();

    expect(() =>
      buildLocalMcpApprovalRequest(envelope({ requestId: undefined }), validation, {
        requestedAt: "2026-06-11T12:00:00.000Z",
      }),
    ).toThrow(/requestId/u);
  });

  it("rejects missing requestedAt instead of reading the current time", () => {
    const { envelope: current, validation } = validEnvelopeAndValidation();

    expect(() => buildLocalMcpApprovalRequest(current, validation)).toThrow(/requestedAt/u);
  });

  it("rejects validation results that do not carry a local tool id", () => {
    const invalidValidation: LocalMcpCallValidationResultV1 = {
      valid: false,
      error: {
        code: "unknown_tool",
        message: "The requested tool is not available.",
        retryable: false,
        safeForModel: true,
        version: 1,
      },
      version: 1,
    };

    expect(() =>
      buildLocalMcpApprovalRequest(envelope(), invalidValidation, {
        requestedAt: "2026-06-11T12:00:00.000Z",
      }),
    ).toThrow(/valid localToolId/u);
  });

  it("can build after parsing a PR19 call envelope", () => {
    const parsed = parseLocalMcpCallEnvelope(envelope());
    expect(parsed).toBeDefined();
    if (!parsed) return;

    const validation = validateLocalMcpCallEnvelope(parsed);
    const request = buildLocalMcpApprovalRequest(parsed, validation, {
      requestedAt: "2026-06-11T12:00:00.000Z",
    });

    expect(request.requestId).toBe("request_1");
    expect(request.localToolId).toBe("local_mcp.application_package.summarize");
  });

  it("uses the same injected registry as envelope validation", () => {
    const registry = buildLocalMcpToolRegistry();
    const customRegistry = {
      ...registry,
      tools: registry.tools.map((tool) =>
        tool.id === "local_mcp.application_package.summarize"
          ? { ...tool, riskLevel: "low" as const, requiresApproval: false }
          : tool,
      ),
      version: 1 as const,
    };
    const current = envelope({ approval: undefined });
    const validation = validateLocalMcpCallEnvelope(current, customRegistry);
    expect(validation.valid).toBe(true);

    const request = buildLocalMcpApprovalRequest(current, validation, {
      requestedAt: "2026-06-11T12:00:00.000Z",
      registry: customRegistry,
    });

    expect(request.riskLevel).toBe("low");
  });
});

describe("local MCP approval decision boundary", () => {
  it("builds approved and denied decisions", () => {
    const approved = buildLocalMcpApprovalDecision({
      requestId: "request_1",
      decision: "approved",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:01:00.000Z",
      reason: "ok",
    });
    const denied = buildLocalMcpApprovalDecision({
      requestId: "request_2",
      decision: "denied",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:02:00.000Z",
    });

    expect(approved).toEqual({
      kind: "local_mcp_approval_decision",
      requestId: "request_1",
      decision: "approved",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:01:00.000Z",
      reason: "ok",
      version: 1,
    });
    expect(denied.decision).toBe("denied");
    expect(() => assertLocalMcpApprovalDecision(approved)).not.toThrow();
  });

  it("maps decisions into the PR19 approval shape", () => {
    const approved = buildLocalMcpApprovalDecision({
      requestId: "request_1",
      decision: "approved",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:01:00.000Z",
      reason: "ok",
    });
    const denied = buildLocalMcpApprovalDecision({
      requestId: "request_2",
      decision: "denied",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:02:00.000Z",
    });

    expect(approvalDecisionToLocalMcpApproval(approved)).toEqual({
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T12:01:00.000Z",
      reason: "ok",
      version: 1,
    });
    expect(approvalDecisionToLocalMcpApproval(denied)).toEqual({
      approved: false,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T12:02:00.000Z",
      version: 1,
    });
  });

  it("rejects invalid decisions and missing required fields", () => {
    expect(() =>
      buildLocalMcpApprovalDecision({
        requestId: "",
        decision: "approved",
        decidedBy: "reviewer_1",
        decidedAt: "2026-06-11T12:01:00.000Z",
      }),
    ).toThrow(/requestId/u);
    expect(() =>
      buildLocalMcpApprovalDecision({
        requestId: "request_1",
        decision: "approved",
        decidedBy: "",
        decidedAt: "2026-06-11T12:01:00.000Z",
      }),
    ).toThrow(/decidedBy/u);
    expect(() =>
      buildLocalMcpApprovalDecision({
        requestId: "request_1",
        decision: "denied",
        decidedBy: "reviewer_1",
        decidedAt: "",
      }),
    ).toThrow(/decidedAt/u);
    expect(() =>
      buildLocalMcpApprovalDecision({
        requestId: "request_1",
        decision: "maybe" as "approved",
        decidedBy: "reviewer_1",
        decidedAt: "2026-06-11T12:01:00.000Z",
      }),
    ).toThrow(/decision/u);
  });
});

describe("local MCP audit event boundary", () => {
  it("builds approval and call audit event shells", async () => {
    const approvalRequested = await buildLocalMcpAuditEvent({
      eventType: "approval_requested",
      requestId: "request_1",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      userId: "user_1",
      sessionId: "session_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "refused",
      reasonCode: "approval_required",
      safeSummary: "approval requested for local_mcp.application_package.summarize",
    });
    const approvalApproved = await buildLocalMcpAuditEvent({
      eventType: "approval_approved",
      requestId: "request_1",
      userId: "user_1",
      occurredAt: "2026-06-11T12:01:00.000Z",
      outcome: "approved",
    });
    const approvalDenied = await buildLocalMcpAuditEvent({
      eventType: "approval_denied",
      requestId: "request_2",
      userId: "user_1",
      occurredAt: "2026-06-11T12:02:00.000Z",
      outcome: "denied",
    });
    const callRefused = await buildLocalMcpAuditEvent({
      eventType: "call_refused",
      requestId: "request_3",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      occurredAt: "2026-06-11T12:03:00.000Z",
      outcome: "refused",
      reasonCode: "missing_user",
    });

    for (const event of [approvalRequested, approvalApproved, approvalDenied, callRefused]) {
      expect(event.kind).toBe("local_mcp_audit_event");
      expect(event.eventId).toMatch(/^local-mcp-audit-event:[a-f0-9]{64}$/u);
      expect(event.version).toBe(1);
      expect(() => assertLocalMcpAuditEvent(event)).not.toThrow();
      expect(JSON.stringify(event)).not.toMatch(/raw cv|stack|privateFacts|never_use/u);
    }
    expect(approvalRequested.reasonCode).toBe("approval_required");
    expect(callRefused.reasonCode).toBe("missing_user");
  });

  it("builds deterministic event ids for stable input", async () => {
    const input = {
      eventType: "call_validated" as const,
      requestId: "request_1",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize" as const,
      userId: "user_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "allowed" as const,
    };

    await expect(buildLocalMcpAuditEvent(input)).resolves.toEqual(
      await buildLocalMcpAuditEvent({ ...input }),
    );
  });

  it("changes event id when outcome or reasonCode changes", async () => {
    const base = {
      eventType: "call_refused" as const,
      requestId: "request_1",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize" as const,
      userId: "user_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "refused" as const,
      reasonCode: "approval_required" as const,
    };
    const first = await buildLocalMcpAuditEvent(base);
    const changedOutcome = await buildLocalMcpAuditEvent({ ...base, outcome: "error" });
    const changedReason = await buildLocalMcpAuditEvent({ ...base, reasonCode: "missing_user" });

    expect(changedOutcome.eventId).not.toBe(first.eventId);
    expect(changedReason.eventId).not.toBe(first.eventId);
  });

  it("omits unsafe safeSummary values", async () => {
    const event = await buildLocalMcpAuditEvent({
      eventType: "call_error_result_built",
      requestId: "request_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "error",
      reasonCode: "internal_error",
      safeSummary: "raw CV text with stack trace and privateFacts",
    });

    expect(event.safeSummary).toBeUndefined();
  });

  it("keeps specific safeSummary diagnostics without raw payload markers", async () => {
    const event = await buildLocalMcpAuditEvent({
      eventType: "call_validated",
      requestId: "request_1",
      occurredAt: "2026-06-11T12:00:00.000Z",
      outcome: "allowed",
      safeSummary: "approval trace id abc with 2 arguments approved",
    });
    const unsafe = await buildLocalMcpAuditEvent({
      eventType: "call_error_result_built",
      requestId: "request_2",
      occurredAt: "2026-06-11T12:01:00.000Z",
      outcome: "error",
      safeSummary: "raw arguments included in stack trace",
    });

    expect(event.safeSummary).toBe("approval trace id abc with 2 arguments approved");
    expect(unsafe.safeSummary).toBeUndefined();
  });

  it("requires explicit occurredAt", async () => {
    await expect(
      buildLocalMcpAuditEvent({
        eventType: "call_error_result_built",
        requestId: "request_1",
        occurredAt: "",
        outcome: "error",
        reasonCode: "internal_error",
      }),
    ).rejects.toThrow(/occurredAt/u);
  });
});

describe("local MCP approval audit boundary scope guards", () => {
  it("does not generate request ids, timestamps, randomness, transport, or persistence", () => {
    expect(approvalAuditSource).not.toMatch(/randomUUID|Math\.random|Date\.now|new Date/u);
    expect(approvalAuditSource).not.toMatch(/from\s+["'][^"']*convex[^"']*["']/iu);
    expect(approvalAuditSource).not.toMatch(/from\s+["'][^"']*(?:app|pages|components)\//iu);
    expect(approvalAuditSource).not.toMatch(/controlled-ats-scout/iu);
    expect(approvalAuditSource).not.toMatch(/\b(fetch|axios|undici|http|websocket|sse|oauth)\b/iu);
    expect(approvalAuditSource).not.toMatch(
      /\b(function|const)\s+(save|persist|write|executeApprovedCall|handler|server|transport|router)\b/iu,
    );
    expect(approvalAuditSource).not.toMatch(/createApprovalInConvex|writeAuditEvent/iu);
  });
});
