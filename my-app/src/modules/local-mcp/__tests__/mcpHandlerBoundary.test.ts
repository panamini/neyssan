import { describe, expect, it } from "vitest";
import {
  buildLocalMcpApprovalDecision,
  buildLocalMcpApprovalRequest,
} from "../mcpApprovalAuditBoundary";
import { validateLocalMcpCallEnvelope } from "../mcpCallEnvelope";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallValidationResultV1,
} from "../mcpCallEnvelope";
import handlerBoundarySource from "../mcpHandlerBoundary.ts?raw";
import {
  LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1,
  LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1,
  LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1,
  LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1,
  assertLocalMcpHandlerBoundary,
  buildLocalMcpHandlerBoundary,
  validateLocalMcpHandlerBoundary,
} from "../mcpHandlerBoundary";
import type { LocalMcpHandlerBoundaryV1 } from "../mcpHandlerBoundary";

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

function validValidation(current: LocalMcpCallEnvelopeV1): Extract<
  LocalMcpCallValidationResultV1,
  { valid: true }
> {
  const validation = validateLocalMcpCallEnvelope(current);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("expected valid Local MCP envelope");
  return validation;
}

function validBoundary(
  overrides: Partial<LocalMcpHandlerBoundaryV1> = {},
): LocalMcpHandlerBoundaryV1 {
  const current = envelope();
  const validation = validValidation(current);
  const approvalRequest = buildLocalMcpApprovalRequest(current, validation, {
    requestedAt: "2026-06-11T12:00:00.000Z",
  });
  const approvalDecision = buildLocalMcpApprovalDecision({
    requestId: "request_1",
    decision: "approved",
    decidedBy: "reviewer_1",
    decidedAt: "2026-06-11T12:01:00.000Z",
    reason: "approved for future boundary design",
  });

  return {
    ...buildLocalMcpHandlerBoundary({
      envelope: current,
      validation,
      approvalRequest,
      approvalDecision,
      rollbackPlanRef: "rollback-plan:request_1",
    }),
    ...overrides,
  };
}

function errorCodes(value: unknown): readonly string[] {
  const result = validateLocalMcpHandlerBoundary(value);
  return result.valid ? [] : result.errors.map((error) => error.code);
}

describe("local MCP real handler boundary design", () => {
  it("builds a design-only future handler boundary from PR19 and PR20 gates", () => {
    const boundary = validBoundary();

    expect(boundary).toMatchObject({
      kind: "local_mcp_handler_boundary",
      mode: "future_real_handler_design_only",
      version: 1,
      gates: {
        approval: {
          required: true,
          approvedDecisionRequired: true,
          version: 1,
        },
        audit: {
          required: true,
          persistence: "not_persisted_in_pr21",
          version: 1,
        },
        idempotency: {
          required: true,
          keySource: "request_id",
          replayPolicy: "return_same_result_without_repeating_effects",
          version: 1,
        },
        rollback: {
          required: true,
          planRef: "rollback-plan:request_1",
          irreversibleEffectsForbidden: true,
          version: 1,
        },
        privacy: {
          required: true,
          filterRequiredBeforePublicResult: true,
          version: 1,
        },
        version: 1,
      },
    });
    expect(boundary.effectPolicy.allowedEffects).toEqual(LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1);
    expect(boundary.effectPolicy.forbiddenEffects).toEqual(LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1);
    expect(boundary.gates.audit.requiredCheckpoints).toEqual(
      LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1,
    );
    expect(boundary.gates.privacy.publicOutputExcludes).toEqual(
      LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1,
    );
    expect(() => assertLocalMcpHandlerBoundary(boundary)).not.toThrow();
    expect(validateLocalMcpHandlerBoundary(boundary)).toMatchObject({
      valid: true,
      version: 1,
    });
  });

  it("rejects missing approval and denied approval decisions", () => {
    const boundary = validBoundary();
    const deniedDecision = buildLocalMcpApprovalDecision({
      requestId: "request_1",
      decision: "denied",
      decidedBy: "reviewer_1",
      decidedAt: "2026-06-11T12:01:00.000Z",
    });

    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          approval: undefined,
        },
      }),
    ).toContain("approval_gate_missing");
    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          approval: {
            ...boundary.gates.approval,
            approvalDecision: deniedDecision,
          },
        },
      }),
    ).toContain("approval_not_approved");
  });

  it("requires audit, idempotency, rollback, and privacy gates", () => {
    const boundary = validBoundary();

    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          audit: {
            ...boundary.gates.audit,
            requiredCheckpoints: ["approval_requested"],
          },
        },
      }),
    ).toContain("audit_gate_missing");
    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          idempotency: {
            ...boundary.gates.idempotency,
            keySource: "caller_supplied",
          },
        },
      }),
    ).toContain("idempotency_gate_missing");
    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          rollback: {
            ...boundary.gates.rollback,
            planRef: "",
          },
        },
      }),
    ).toContain("rollback_gate_missing");
    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          privacy: {
            ...boundary.gates.privacy,
            publicOutputExcludes: ["raw_source_text"],
          },
        },
      }),
    ).toContain("privacy_gate_missing");
  });

  it("rejects effect policies that permit forbidden future effects", () => {
    const boundary = validBoundary();

    expect(
      errorCodes({
        ...boundary,
        effectPolicy: {
          ...boundary.effectPolicy,
          allowedEffects: [...boundary.effectPolicy.allowedEffects, "network_call"],
        },
      }),
    ).toContain("effect_policy_invalid");
    expect(
      errorCodes({
        ...boundary,
        effectPolicy: {
          ...boundary.effectPolicy,
          forbiddenEffects: boundary.effectPolicy.forbiddenEffects.filter(
            (effect) => effect !== "apply_to_job",
          ),
        },
      }),
    ).toContain("effect_policy_invalid");
  });

  it("rejects mismatched tool identity across envelope validation and approval", () => {
    const boundary = validBoundary();

    expect(
      errorCodes({
        ...boundary,
        validation: {
          ...boundary.validation,
          localToolId: "local_mcp.evidence_graph.summarize",
        },
      }),
    ).toContain("tool_mismatch");
    expect(
      errorCodes({
        ...boundary,
        gates: {
          ...boundary.gates,
          approval: {
            ...boundary.gates.approval,
            approvalRequest: {
              ...boundary.gates.approval.approvalRequest,
              requestId: "request_2",
            },
          },
        },
      }),
    ).toContain("tool_mismatch");
  });

  it("rejects executable slots or registry-shaped additions", () => {
    const boundary = validBoundary();

    expect(errorCodes({ ...boundary, handler: () => undefined })).toContain("invalid_boundary");
    expect(errorCodes({ ...boundary, registry: [] })).toContain("invalid_boundary");
  });

  it("validates without mutating inputs and returns stable clones", () => {
    const boundary = validBoundary();
    const before = JSON.stringify(boundary);
    const first = validateLocalMcpHandlerBoundary(boundary);
    const second = validateLocalMcpHandlerBoundary(boundary);

    expect(JSON.stringify(boundary)).toBe(before);
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    if (!first.valid || !second.valid) return;

    expect(first.boundary).not.toBe(boundary);
    expect(first.boundary.envelope).not.toBe(boundary.envelope);
    expect(first.boundary.gates.approval.approvalRequest).not.toBe(
      boundary.gates.approval.approvalRequest,
    );

    (boundary.gates.rollback as { planRef: string }).planRef = "mutated";
    expect(first.boundary.gates.rollback.planRef).toBe("rollback-plan:request_1");
  });
});

describe("local MCP real handler boundary scope guards", () => {
  it("does not add runtime execution, persistence, transport, UI, or external SDKs", () => {
    expect(handlerBoundarySource).not.toMatch(
      /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout)[^"']*["']/iu,
    );
    expect(handlerBoundarySource).not.toMatch(/from\s+["'][^"']*(openai|oauth)[^"']*["']/iu);
    expect(handlerBoundarySource).not.toMatch(/\b(fetch|axios|undici|XMLHttpRequest)\b/u);
    expect(handlerBoundarySource).not.toMatch(/\b(Date\.now|new Date|randomUUID|Math\.random)\b/u);
    expect(handlerBoundarySource).not.toMatch(
      /\b(function|const)\s+(execute|serve|route|persist|write|save|send|submit|apply|createHandlerRegistry)\b/iu,
    );
  });
});
