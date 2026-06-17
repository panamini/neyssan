import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactHumanApprovalWorkflow,
  buildMcpGeneratedArtifactHumanApprovalWorkflowSafeRefusal,
  type McpGeneratedArtifactHumanApprovalWorkflowResultV1,
} from "../mcpGeneratedArtifactHumanApprovalWorkflow";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

type SupportedArtifactKind = "resume_variant" | "cover_letter" | "application_package";
type DecisionKind = "approve_preview" | "reject_preview" | "request_edit";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpGeneratedArtifactHumanApprovalWorkflow.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpGeneratedArtifactHumanApprovalWorkflow.test.ts",
);

const ARTIFACT_UPDATED_AT = "2026-06-17T05:00:00.000Z";
const DECISION_OCCURRED_AT = "2026-06-17T05:10:00.000Z";
const GENERATED_FULL_TEXT =
  "Generated full artifact body that must never be returned by PR71.";

const ARTIFACT_CONFIG = {
  resume_variant: {
    refId: "mcp-safe-ref:resume-variant:preview",
    label: "Resume variant artifact",
    previewStatus: "resume_variant_preview_created",
  },
  cover_letter: {
    refId: "mcp-safe-ref:cover-letter:preview",
    label: "Cover letter artifact",
    previewStatus: "cover_letter_preview_created",
  },
  application_package: {
    refId: "mcp-safe-ref:application-package:message-preview",
    label: "Application pkg artifact",
    previewStatus: "application_message_preview_created",
  },
} as const;

const FORBIDDEN_FRAGMENTS = [
  "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_PROPOSAL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
  "RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE",
  "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
  "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
  "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
  "real-user@example.test",
  "clerk_DO_NOT_EXPOSE",
  "user_DO_NOT_EXPOSE",
  "stytch_subject_DO_NOT_EXPOSE",
  "provider_subject_DO_NOT_EXPOSE",
  "rawClaims",
  "accessToken",
  "refreshToken",
  "Bearer ",
  "j97convexdocumentid",
] as const;

const RAW_SOURCE_GUARDS = [
  /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
  /from\s+["'][^"']*(?:package\.json|package-lock|pnpm-lock|schema\.ts)["']/iu,
] as const;

const STRIPPED_SOURCE_GUARDS = [
  /window\.openai|postMessage|React|\.tsx|\.jsx|iframe|registerTool|registerResource/u,
  /tools\/list|tools\/call/u,
  /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
  /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
  /\b(download|send|submit|apply|export)\s*\(/u,
  /\b(revisionLoop|regenerate|generateResume|generateCoverLetter|generateApplication|promptTemplate)\b/u,
] as const;

function artifactContext(
  artifactKind: SupportedArtifactKind,
  overrides: Record<string, unknown> = {},
) {
  const config = ARTIFACT_CONFIG[artifactKind];
  return {
    kind: "mcp_generated_artifact_human_approval_artifact_context",
    artifactKind,
    artifactStatus: "human_review_required",
    previewStatus: config.previewStatus,
    artifactRef: {
      id: config.refId,
      label: config.label,
      status: "human_review_required",
      category: artifactKind,
      count: 1,
      updatedAt: ARTIFACT_UPDATED_AT,
      version: 1,
    },
    safeCounts: {
      artifacts: 1,
      blockers: 0,
      warnings: 1,
      version: 1,
    },
    version: 1,
    ...overrides,
  };
}

function currentState(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_human_approval_state",
    workflowStatus: "human_review_required",
    approvedForPreview: false,
    approvedForExport: false,
    approvedForDownload: false,
    approvedForSend: false,
    approvedForSubmit: false,
    approvedForApply: false,
    version: 1,
    ...overrides,
  };
}

function decision(
  decisionKind: DecisionKind,
  overrides: Record<string, unknown> = {},
) {
  const editIntent =
    decisionKind === "request_edit" ? { editIntent: "shorter" } : {};
  return {
    kind: "mcp_generated_artifact_human_approval_decision",
    actor: "human_user",
    decision: decisionKind,
    approvalTarget: "preview_only",
    reviewedArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
    ...editIntent,
    version: 1,
    ...overrides,
  };
}

function reviewSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_human_approval_review_summary_input",
    changedSections: 2,
    redactedChangedSections: 2,
    blockers: 0,
    warnings: 1,
    version: 1,
    ...overrides,
  };
}

function workflowInput(
  artifactKind: SupportedArtifactKind = "resume_variant",
  decisionKind: DecisionKind = "approve_preview",
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_human_approval_workflow_input",
    artifact: artifactContext(artifactKind),
    currentState: currentState(),
    decision: decision(decisionKind),
    reviewSummary: reviewSummary(),
    occurredAt: DECISION_OCCURRED_AT,
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpGeneratedArtifactHumanApprovalWorkflowResultV1,
): Extract<McpGeneratedArtifactHumanApprovalWorkflowResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected human approval workflow to be allowed");
  }
  expect(result.capabilities).toEqual({
    generatedArtifactBoundary: "pr68_generated_artifact_boundary_checked",
    componentData: "policy_checked",
    componentRendering: "view_model_only",
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    writeActions: "blocked",
    exportActions: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  });
  assertSafeOutput(result);
  return result;
}

function expectBlocked(
  input: unknown,
): Extract<McpGeneratedArtifactHumanApprovalWorkflowResultV1, { allowed: false }> {
  const result = buildMcpGeneratedArtifactHumanApprovalWorkflow(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected human approval workflow to be blocked");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpGeneratedArtifactHumanApprovalWorkflowSafeRefusal(),
  );
  expect(result).not.toHaveProperty("summary");
  expect(result).not.toHaveProperty("component");
  expect(validateSurface("component_visible_error", result.safeRefusal)).toEqual(
    expect.objectContaining({ allowed: true }),
  );
  assertSafeOutput(result);
  return result;
}

function assertSafeOutput(value: unknown): void {
  assertLocalMcpPrivacySafeOutput(value);
  const serialized = JSON.stringify(value);
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
  expect(serialized).not.toContain(GENERATED_FULL_TEXT);
  expect(serialized).not.toContain('"fullContent":');
  expect(serialized).not.toContain("restricted_full_content");
  expect(serialized).not.toContain("restricted_artifact");
  expect(serialized).not.toContain("free-form");
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/u);
}

function validateSurface(surface: string, payload: unknown) {
  return validateLocalMcpComponentDataPolicy({
    kind: "local_mcp_component_data_policy_input",
    surface,
    payload,
    version: 1,
  });
}

function sourceFiles(): readonly string[] {
  return [WORKFLOW_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return readFileSync(WORKFLOW_SOURCE_FILE, "utf8");
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR71 generated artifact human approval workflow", () => {
  it.each([
    ["resume variant", "resume_variant"],
    ["cover letter", "cover_letter"],
    ["application package/message", "application_package"],
  ] as const)("allows safe approve-preview decision for %s preview", (_label, artifactKind) => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput(artifactKind, "approve_preview"),
      ),
    );

    expect(result.reason).toBe("approval_workflow_projected");
    expect(result.summary).toMatchObject({
      kind: "mcp_generated_artifact_human_approval_workflow_summary",
      artifactKind,
      artifactStatus: "approved_for_preview",
      workflowStatus: "approved_for_preview",
      decision: "approve_preview",
      decisionStatus: "approved_for_preview",
      visibilityCategory: "safe_summary_only",
      nextUserAction: "ready_for_review",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.artifactRef).toMatchObject({
      id: ARTIFACT_CONFIG[artifactKind].refId,
      label: ARTIFACT_CONFIG[artifactKind].label,
      status: "approved_for_preview",
      category: artifactKind,
      count: 1,
      updatedAt: ARTIFACT_UPDATED_AT,
      version: 1,
    });
  });

  it("keeps approvedForPreview true only for safe preview approval state", () => {
    const approved = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("resume_variant", "approve_preview"),
      ),
    );
    const rejected = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("resume_variant", "reject_preview"),
      ),
    );
    const editRequested = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("resume_variant", "request_edit"),
      ),
    );

    expect(approved.summary.safeFlags).toMatchObject({
      humanReviewRequired: false,
      approvedForPreview: true,
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
    });
    expect(rejected.summary.safeFlags.approvedForPreview).toBe(false);
    expect(editRequested.summary.safeFlags.approvedForPreview).toBe(false);
  });

  it("keeps export, download, send, submit, and apply approvals false", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("cover_letter", "approve_preview"),
      ),
    );

    expect(result.summary.safeFlags).toMatchObject({
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      rawDataExposed: false,
      version: 1,
    });
    expect(result.summary.capabilities).toMatchObject({
      dataWrites: "blocked",
      writeActions: "blocked",
      exportActions: "blocked",
      modelCalls: "blocked",
      networkAccess: "blocked",
    });
  });

  it("allows safe reject decision as state-only workflow output", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("cover_letter", "reject_preview"),
      ),
    );

    expect(result.summary).toMatchObject({
      artifactKind: "cover_letter",
      artifactStatus: "rejected",
      workflowStatus: "rejected",
      decision: "reject_preview",
      decisionStatus: "rejected",
      nextUserAction: "review_blockers",
    });
    expect(result.summary.safeFlags).toMatchObject({
      humanReviewRequired: false,
      approvedForPreview: false,
    });
  });

  it("allows safe edit-request decision using enum-only edit intent", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("application_package", "request_edit", {
          decision: decision("request_edit", {
            editIntent: "focus_on_requirements",
          }),
        }),
      ),
    );

    expect(result.summary).toMatchObject({
      artifactKind: "application_package",
      artifactStatus: "edit_requested",
      workflowStatus: "edit_requested",
      decision: "request_edit",
      decisionStatus: "edit_requested",
      editIntent: "focus_on_requirements",
      nextUserAction: "review_pending_items",
    });
    expect(result.summary.safeFlags).toMatchObject({
      humanReviewRequired: true,
      approvedForPreview: false,
    });
  });

  it.each([
    ["free-form edit instruction", decision("request_edit", { editInstructions: "Make it warmer." })],
    ["free-form approval note", decision("approve_preview", { approvalNote: "Looks good." })],
    ["stale reviewed timestamp", decision("approve_preview", { reviewedArtifactUpdatedAt: "2026-06-17T04:59:59.000Z" })],
    ["model-only approval", decision("approve_preview", { actor: "model" })],
    ["unknown decision enum", decision("approve_preview", { decision: "approve_export" })],
    ["export target", decision("approve_preview", { approvalTarget: "export" })],
    ["download target", decision("approve_preview", { approvalTarget: "download" })],
    ["send target", decision("approve_preview", { approvalTarget: "send" })],
    ["submit target", decision("approve_preview", { approvalTarget: "submit" })],
    ["apply target", decision("approve_preview", { approvalTarget: "apply" })],
    ["unknown edit intent", decision("request_edit", { editIntent: "rewrite_from_scratch" })],
  ] as const)("blocks unsafe approval input: %s", (_label, unsafeDecision) => {
    expect(
      expectBlocked(
        workflowInput("resume_variant", "approve_preview", {
          decision: unsafeDecision,
        }),
      ).reason,
    ).toBe("invalid_input");
  });

  it("blocks contradictory approval state", () => {
    const result = expectBlocked(
      workflowInput("resume_variant", "approve_preview", {
        currentState: currentState({
          workflowStatus: "human_review_required",
          approvedForPreview: true,
        }),
      }),
    );

    expect(result.reason).toBe("invalid_input");
  });

  it("blocks approval when unsafe real-action flags are already true", () => {
    for (const flag of [
      "approvedForExport",
      "approvedForDownload",
      "approvedForSend",
      "approvedForSubmit",
      "approvedForApply",
    ] as const) {
      expect(
        expectBlocked(
          workflowInput("resume_variant", "approve_preview", {
            currentState: currentState({ [flag]: true }),
          }),
        ).reason,
      ).toBe("invalid_input");
    }
  });

  it("creates safe diff/review summary without full text", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("resume_variant", "approve_preview"),
      ),
    );

    expect(result.summary.diffReview).toEqual({
      kind: "mcp_generated_artifact_human_approval_diff_review",
      artifactKind: "resume_variant",
      artifactRef: result.summary.artifactRef,
      decisionStatus: "approved_for_preview",
      safeCounts: {
        artifacts: 1,
        blockers: 0,
        warnings: 1,
        changedSections: 2,
        redactedChangedSections: 2,
        version: 1,
      },
      safeCategories: {
        artifactKind: "resume_variant",
        workflowStatus: "approved_for_preview",
        decisionStatus: "approved_for_preview",
        visibilityCategory: "safe_summary_only",
        nextUserAction: "ready_for_review",
        version: 1,
      },
      nextUserAction: "ready_for_review",
      version: 1,
    });
    expect(JSON.stringify(result.summary.diffReview)).not.toContain(GENERATED_FULL_TEXT);
  });

  it("creates redacted audit event metadata without persistence", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("cover_letter", "reject_preview"),
      ),
    );

    expect(result.summary.auditEvent).toMatchObject({
      kind: "mcp_generated_artifact_human_approval_audit_event",
      eventKind: "human_approval_decision_recorded",
      artifactKind: "cover_letter",
      decision: "reject_preview",
      occurredAt: DECISION_OCCURRED_AT,
      persisted: false,
      version: 1,
    });
    expect(result.summary.auditEvent.redactedFlags).toEqual({
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    });
    expect(JSON.stringify(result.summary.auditEvent)).not.toContain("session");
    expect(JSON.stringify(result.summary.auditEvent)).not.toContain("user_DO_NOT_EXPOSE");
  });

  it.each([
    ["model structured", "model_visible_structured_content", "structuredContent"],
    ["model content", "model_visible_content", "content"],
    ["component structured", "component_visible_structured_content", "structuredContent"],
    ["component content", "component_visible_content", "content"],
    ["meta", "component_visible_meta", "meta"],
    ["props", "component_visible_props", "props"],
    ["bridge payload", "component_visible_bridge_payload", "bridgePayload"],
    ["state snapshot", "component_visible_state_snapshot", "stateSnapshot"],
    ["model-context update", "component_visible_model_context_update", "modelContextUpdate"],
  ] as const)("projects only safe summary to %s", (_label, surface, payloadKey) => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("application_package", "approve_preview"),
      ),
    );

    expect(validateSurface(surface, result.component[payloadKey])).toEqual(
      expect.objectContaining({ allowed: true }),
    );
    expect(JSON.stringify(result.component[payloadKey])).not.toContain(GENERATED_FULL_TEXT);
  });

  it("validates _meta as component-visible safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("application_package", "approve_preview"),
      ),
    );

    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      visibilityCategory: "safe_summary_only",
      workflowStatus: "approved_for_preview",
      decisionStatus: "approved_for_preview",
    });
    expect(validateSurface("component_visible_meta", result.component.meta)).toEqual(
      expect.objectContaining({ allowed: true }),
    );
    expect(
      validateSurface("component_visible_meta", {
        ...result.component.meta,
        rawMeta: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
      }),
    ).toEqual(expect.objectContaining({ allowed: false }));
  });

  it("keeps full generated artifact text out of every returned surface", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("resume_variant", "approve_preview"),
      ),
    );
    const visibleSurfaces = [
      result.summary,
      result.component.structuredContent,
      result.component.content,
      result.component.meta,
      result.component.props,
      result.component.bridgePayload,
      result.component.stateSnapshot,
      result.component.modelContextUpdate,
      result.summary.diffReview,
      result.summary.auditEvent,
    ] as const;

    for (const surface of visibleSurfaces) {
      const serialized = JSON.stringify(surface);
      expect(serialized).not.toContain(GENERATED_FULL_TEXT);
      expect(serialized).not.toContain('"fullContent":');
      expect(serialized).not.toContain("restricted_artifact");
    }
  });

  it.each([
    ["raw resume", { artifact: artifactContext("resume_variant", { previewStatus: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["raw CV", { artifact: artifactContext("resume_variant", { previewStatus: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["raw job", { artifact: artifactContext("cover_letter", { previewStatus: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["raw application", { artifact: artifactContext("application_package", { previewStatus: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["raw cover letter", { artifact: artifactContext("cover_letter", { previewStatus: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["source quote", { artifact: artifactContext("resume_variant", { previewStatus: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["private fact", { artifact: artifactContext("resume_variant", { previewStatus: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["never_use fact", { artifact: artifactContext("resume_variant", { previewStatus: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE" }) }],
    ["token", { artifact: artifactContext("resume_variant", { previewStatus: "Bearer [REDACTED:Bearer token]" }) }],
    ["email", { artifact: artifactContext("resume_variant", { previewStatus: "real-user@example.test" }) }],
    ["Clerk id", { artifact: artifactContext("resume_variant", { previewStatus: "clerk_DO_NOT_EXPOSE" }) }],
    ["Stytch subject", { artifact: artifactContext("resume_variant", { previewStatus: "stytch_subject_DO_NOT_EXPOSE" }) }],
    ["provider subject", { artifact: artifactContext("resume_variant", { previewStatus: "provider_subject_DO_NOT_EXPOSE" }) }],
    ["Convex doc id", { artifact: artifactContext("resume_variant", { previewStatus: "j97convexdocumentid" }) }],
    ["raw generated content", { artifact: artifactContext("resume_variant", { fullContent: "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE" }) }],
  ] as const)("blocks forbidden input sentinel: %s", (_label, overrides) => {
    expect(
      expectBlocked(workflowInput("resume_variant", "approve_preview", overrides)).reason,
    ).toBe("invalid_input");
  });

  it.each([
    ["unknown input kind", { kind: "wrong" }],
    ["unknown artifact kind", { artifact: artifactContext("resume_variant", { artifactKind: "review_notes" }) }],
    ["unknown artifact status", { artifact: artifactContext("resume_variant", { artifactStatus: "submitted" }) }],
    ["unknown preview status", { artifact: artifactContext("resume_variant", { previewStatus: "resume_export_created" }) }],
    ["unsafe ref", { artifact: artifactContext("resume_variant", { artifactRef: { ...artifactContext("resume_variant").artifactRef, id: "resume-real-id" } }) }],
    ["raw ref tail", { artifact: artifactContext("resume_variant", { artifactRef: { ...artifactContext("resume_variant").artifactRef, id: "mcp-safe-ref:resume-variant:raw-cv" } }) }],
    ["changed section mismatch", { reviewSummary: reviewSummary({ changedSections: 3, redactedChangedSections: 2 }) }],
    ["negative changed section count", { reviewSummary: reviewSummary({ changedSections: -1, redactedChangedSections: -1 }) }],
    ["approval from rejected state", { currentState: currentState({ workflowStatus: "rejected" }) }],
  ] as const)("fails closed for %s", (_label, overrides) => {
    expect(
      expectBlocked(workflowInput("resume_variant", "approve_preview", overrides)).reason,
    ).toBe("invalid_input");
  });

  it.each([
    ["null", null],
    [
      "missing nested fields",
      {
        kind: "mcp_generated_artifact_human_approval_workflow_input",
        artifact: artifactContext("resume_variant"),
        decision: decision("approve_preview"),
        version: 1,
      },
    ],
    [
      "valid envelope with missing nested fields",
      workflowInput("resume_variant", "approve_preview", {
        decision: { version: 1 },
      }),
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    expect(expectBlocked(input).reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = workflowInput("resume_variant", "approve_preview", {
      decision: decision("approve_preview", {
        [Symbol("hidden")]: "unsafe",
      }),
    });
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = workflowInput("resume_variant", "approve_preview");
    Object.defineProperty(accessorInput.decision, "decision", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() =>
      buildMcpGeneratedArtifactHumanApprovalWorkflow(accessorInput),
    ).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(workflowInput("resume_variant", "approve_preview"), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() =>
      buildMcpGeneratedArtifactHumanApprovalWorkflow(getTrapProxy),
    ).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(
      workflowInput("resume_variant", "approve_preview"),
      {
        getPrototypeOf() {
          throw new TypeError("revoked");
        },
      },
    );
    revoke();
    expect(() => buildMcpGeneratedArtifactHumanApprovalWorkflow(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("is deterministic for the same safe input", () => {
    const first = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("cover_letter", "approve_preview"),
      ),
    );
    const second = expectAllowed(
      buildMcpGeneratedArtifactHumanApprovalWorkflow(
        workflowInput("cover_letter", "approve_preview"),
      ),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.component).toEqual(first.component);
  });

  it("keeps PR71 sources out of runtime, network, model, writes, export/download, send/apply, and PR72 behavior", () => {
    const impl = stripStringAndPatternLiterals(implementationSource());
    for (const pattern of STRIPPED_SOURCE_GUARDS) {
      expect(impl).not.toMatch(pattern);
    }
  });

  it("keeps changed source files out of package, lockfile, schema, and UI/runtime imports", () => {
    for (const source of sourceFiles()) {
      for (const pattern of RAW_SOURCE_GUARDS) {
        expect(source).not.toMatch(pattern);
      }
    }

    for (const source of sourceFiles().map(stripStringAndPatternLiterals)) {
      for (const pattern of STRIPPED_SOURCE_GUARDS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
