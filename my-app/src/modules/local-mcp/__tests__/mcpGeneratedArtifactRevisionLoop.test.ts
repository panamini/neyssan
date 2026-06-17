import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactHumanApprovalWorkflow,
  type McpGeneratedArtifactHumanApprovalWorkflowResultV1,
} from "../mcpGeneratedArtifactHumanApprovalWorkflow";
import {
  buildMcpGeneratedArtifactRevisionLoop,
  buildMcpGeneratedArtifactRevisionLoopSafeRefusal,
  type McpGeneratedArtifactRevisionLoopResultV1,
} from "../mcpGeneratedArtifactRevisionLoop";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

type SupportedArtifactKind =
  | "resume_variant"
  | "cover_letter"
  | "application_package";
type RevisionIntent =
  | "shorter"
  | "more_formal"
  | "focus_on_requirements"
  | "preserve_never_use";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REVISION_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpGeneratedArtifactRevisionLoop.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpGeneratedArtifactRevisionLoop.test.ts",
);

const ARTIFACT_UPDATED_AT = "2026-06-17T15:50:00.000Z";
const DECISION_OCCURRED_AT = "2026-06-17T15:51:00.000Z";
const REVISION_OCCURRED_AT = "2026-06-17T15:52:00.000Z";
const PREVIOUS_GENERATED_FULL_TEXT =
  "Previous full generated artifact body that must never be returned.";
const REVISED_GENERATED_FULL_TEXT =
  "Revised full generated artifact body that must never be returned.";

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
  /\b(regenerateWithModel|generateWithModel|promptTemplate)\b/u,
] as const;

function approvalArtifactContext(
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

function approvalCurrentState(overrides: Record<string, unknown> = {}) {
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

function approvalDecision(
  decision: "approve_preview" | "reject_preview" | "request_edit",
  editIntent: RevisionIntent = "shorter",
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_human_approval_decision",
    actor: "human_user",
    decision,
    approvalTarget: "preview_only",
    reviewedArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
    ...(decision === "request_edit" ? { editIntent } : {}),
    version: 1,
    ...overrides,
  };
}

function approvalReviewSummary(overrides: Record<string, unknown> = {}) {
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

function approvalWorkflowInput(
  artifactKind: SupportedArtifactKind,
  decision: "approve_preview" | "reject_preview" | "request_edit",
  editIntent: RevisionIntent = "shorter",
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_human_approval_workflow_input",
    artifact: approvalArtifactContext(artifactKind),
    currentState: approvalCurrentState(),
    decision: approvalDecision(decision, editIntent),
    reviewSummary: approvalReviewSummary(),
    occurredAt: DECISION_OCCURRED_AT,
    version: 1,
    ...overrides,
  };
}

function editRequestState(
  artifactKind: SupportedArtifactKind = "resume_variant",
  editIntent: RevisionIntent = "shorter",
) {
  const result = buildMcpGeneratedArtifactHumanApprovalWorkflow(
    approvalWorkflowInput(artifactKind, "request_edit", editIntent),
  );
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected approval workflow edit request to be allowed");
  }
  return result.summary;
}

function revisionRequest(
  revisionIntent: RevisionIntent,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_revision_request",
    mode: "deterministic_local_revision",
    revisionIntent,
    revisionTarget: "preview_only",
    reviewedArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
    occurredAt: REVISION_OCCURRED_AT,
    version: 1,
    ...overrides,
  };
}

function revisionState(
  editState: ReturnType<typeof editRequestState>,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_revision_state",
    previousArtifactRef: editState.artifactRef,
    previousRevisionCount: 0,
    expectedNextRevisionIndex: 1,
    revisionLineage: [editState.artifactRef.id],
    version: 1,
    ...overrides,
  };
}

function revisionInput(
  artifactKind: SupportedArtifactKind = "resume_variant",
  revisionIntent: RevisionIntent = "shorter",
  overrides: Record<string, unknown> = {},
) {
  const editState = editRequestState(artifactKind, revisionIntent);
  return {
    kind: "mcp_generated_artifact_revision_loop_input",
    editRequestState: editState,
    revisionRequest: revisionRequest(revisionIntent),
    revisionState: revisionState(editState),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpGeneratedArtifactRevisionLoopResultV1,
): Extract<McpGeneratedArtifactRevisionLoopResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected artifact revision loop to be allowed");
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
): Extract<McpGeneratedArtifactRevisionLoopResultV1, { allowed: false }> {
  const result = buildMcpGeneratedArtifactRevisionLoop(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected artifact revision loop to be blocked");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpGeneratedArtifactRevisionLoopSafeRefusal(),
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
  expect(serialized).not.toContain(PREVIOUS_GENERATED_FULL_TEXT);
  expect(serialized).not.toContain(REVISED_GENERATED_FULL_TEXT);
  expect(serialized).not.toContain('"fullContent":');
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
  return [REVISION_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map(
    (file) => readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return readFileSync(REVISION_SOURCE_FILE, "utf8");
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR72 generated artifact revision loop", () => {
  it.each([
    ["resume variant", "resume_variant"],
    ["cover letter", "cover_letter"],
    ["application package/message", "application_package"],
  ] as const)("creates deterministic revision for %s edit-request state", (_label, artifactKind) => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(revisionInput(artifactKind)),
    );

    expect(result.reason).toBe("artifact_revision_created");
    expect(result.summary).toMatchObject({
      kind: "mcp_generated_artifact_revision_loop_summary",
      artifactKind,
      artifactStatus: "human_review_required",
      revisionStatus: "revision_created",
      revisionIntent: "shorter",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
      nextUserAction: "review_pending_items",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.previousArtifactRef).toMatchObject({
      id: ARTIFACT_CONFIG[artifactKind].refId,
      status: "edit_requested",
      category: artifactKind,
    });
    expect(result.summary.newArtifactRevisionRef).toMatchObject({
      id: `${ARTIFACT_CONFIG[artifactKind].refId}:revision-1`,
      label:
        artifactKind === "application_package"
          ? "Application package artifact"
          : ARTIFACT_CONFIG[artifactKind].label,
      status: "human_review_required",
      category: artifactKind,
      count: 1,
      updatedAt: REVISION_OCCURRED_AT,
      version: 1,
    });
  });

  it.each([
    "shorter",
    "more_formal",
    "focus_on_requirements",
    "preserve_never_use",
  ] as const)("supports safe enum revision intent %s", (revisionIntent) => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(
        revisionInput("cover_letter", revisionIntent),
      ),
    );

    expect(result.summary.revisionIntent).toBe(revisionIntent);
    expect(result.summary.safeCategories.revisionIntent).toBe(revisionIntent);
    expect(result.summary.revisionAuditEvent.revisionIntent).toBe(revisionIntent);
  });

  it("increments safe revision count and creates distinct safe revision ref", () => {
    const editState = editRequestState("resume_variant", "more_formal");
    const input = {
      kind: "mcp_generated_artifact_revision_loop_input",
      editRequestState: editState,
      revisionRequest: revisionRequest("more_formal"),
      revisionState: revisionState(editState, {
        previousRevisionCount: 1,
        expectedNextRevisionIndex: 2,
        revisionLineage: [
          "mcp-safe-ref:resume-variant:preview:revision-1",
          editState.artifactRef.id,
        ],
      }),
      version: 1,
    };

    const result = expectAllowed(buildMcpGeneratedArtifactRevisionLoop(input));

    expect(result.summary.newArtifactRevisionRef.id).toBe(
      "mcp-safe-ref:resume-variant:preview:revision-2",
    );
    expect(result.summary.newArtifactRevisionRef.id).not.toBe(
      result.summary.previousArtifactRef.id,
    );
    expect(result.summary.safeCounts).toMatchObject({
      revisionIndex: 2,
      revisionCount: 2,
    });
    expect(result.summary.refIds).toEqual([
      "mcp-safe-ref:resume-variant:preview:revision-1",
      "mcp-safe-ref:resume-variant:preview",
      "mcp-safe-ref:resume-variant:preview:revision-2",
    ]);
  });

  it("marks revised preview as human-review-required and blocks all real action approvals", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(revisionInput("application_package")),
    );

    expect(result.summary.safeFlags).toEqual({
      humanReviewRequired: true,
      approvedForPreview: false,
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      fullContentRestricted: true,
      retentionPending: true,
      rawDataExposed: false,
      version: 1,
    });
    expect(result.summary.capabilities).toMatchObject({
      dataReads: "blocked",
      dataWrites: "blocked",
      writeActions: "blocked",
      exportActions: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
    });
  });

  it("constructs a PR68-compatible restricted revision internally and returns only safe summary", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(revisionInput("cover_letter")),
    );

    expect(result.capabilities.generatedArtifactBoundary).toBe(
      "pr68_generated_artifact_boundary_checked",
    );
    expect(result.summary.newArtifactRevisionRef.status).toBe(
      "human_review_required",
    );
    expect(JSON.stringify(result)).not.toContain(REVISED_GENERATED_FULL_TEXT);
    expect(JSON.stringify(result)).not.toContain("Artifact revision draft.");
    expect(JSON.stringify(result)).not.toContain('"fullContent":');
  });

  it("creates redacted revision audit metadata without persistence", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(
        revisionInput("cover_letter", "focus_on_requirements"),
      ),
    );

    expect(result.summary.revisionAuditEvent).toMatchObject({
      kind: "mcp_generated_artifact_revision_audit_event",
      eventKind: "artifact_revision_created",
      artifactKind: "cover_letter",
      revisionIntent: "focus_on_requirements",
      revisionStatus: "revision_created",
      occurredAt: REVISION_OCCURRED_AT,
      persisted: false,
      version: 1,
    });
    expect(result.summary.revisionAuditEvent.redactedFlags).toEqual({
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    });
    expect(JSON.stringify(result.summary.revisionAuditEvent)).not.toContain(
      "session",
    );
    expect(JSON.stringify(result.summary.revisionAuditEvent)).not.toContain(
      "user_DO_NOT_EXPOSE",
    );
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
      buildMcpGeneratedArtifactRevisionLoop(revisionInput("application_package")),
    );

    expect(validateSurface(surface, result.component[payloadKey])).toEqual(
      expect.objectContaining({ allowed: true }),
    );
    expect(JSON.stringify(result.component[payloadKey])).not.toContain(
      REVISED_GENERATED_FULL_TEXT,
    );
  });

  it("validates _meta as component-visible safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(revisionInput("resume_variant")),
    );

    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      visibilityCategory: "safe_summary_only",
      revisionStatus: "revision_created",
      revisionIntent: "shorter",
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

  it("keeps generated text out of every returned surface", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactRevisionLoop(revisionInput("resume_variant")),
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
      result.summary.revisionAuditEvent,
    ] as const;

    for (const surface of visibleSurfaces) {
      const serialized = JSON.stringify(surface);
      expect(serialized).not.toContain(PREVIOUS_GENERATED_FULL_TEXT);
      expect(serialized).not.toContain(REVISED_GENERATED_FULL_TEXT);
      expect(serialized).not.toContain('"fullContent":');
      expect(serialized).not.toContain("restricted_artifact");
    }
  });

  it.each([
    [
      "free-form edit instructions",
      {
        revisionRequest: {
          ...revisionRequest("shorter"),
          editInstructions: "Make it warmer.",
        },
      },
    ],
    [
      "unknown revision intent",
      {
        revisionRequest: {
          ...revisionRequest("shorter"),
          revisionIntent: "rewrite_from_scratch",
        },
      },
    ],
    [
      "approve intent",
      {
        revisionRequest: {
          ...revisionRequest("shorter"),
          revisionIntent: "approve_preview",
        },
      },
    ],
    [
      "export target",
      { revisionRequest: { ...revisionRequest("shorter"), revisionTarget: "export" } },
    ],
    [
      "download target",
      { revisionRequest: { ...revisionRequest("shorter"), revisionTarget: "download" } },
    ],
    [
      "send target",
      { revisionRequest: { ...revisionRequest("shorter"), revisionTarget: "send" } },
    ],
    [
      "submit target",
      { revisionRequest: { ...revisionRequest("shorter"), revisionTarget: "submit" } },
    ],
    [
      "apply target",
      { revisionRequest: { ...revisionRequest("shorter"), revisionTarget: "apply" } },
    ],
  ] as const)("rejects unsafe revision input: %s", (_label, overrides) => {
    expect(expectBlocked({ ...revisionInput("resume_variant"), ...overrides }).reason).toBe(
      "invalid_input",
    );
  });

  it.each([
    [
      "not PR71 edit-request state",
      {
        editRequestState: (
          buildMcpGeneratedArtifactHumanApprovalWorkflow(
            approvalWorkflowInput("resume_variant", "approve_preview"),
          ) as Extract<
            McpGeneratedArtifactHumanApprovalWorkflowResultV1,
            { allowed: true }
          >
        ).summary,
      },
    ],
    [
      "rejected state",
      {
        editRequestState: (
          buildMcpGeneratedArtifactHumanApprovalWorkflow(
            approvalWorkflowInput("resume_variant", "reject_preview"),
          ) as Extract<
            McpGeneratedArtifactHumanApprovalWorkflowResultV1,
            { allowed: true }
          >
        ).summary,
      },
    ],
    [
      "stale reviewed artifact timestamp",
      {
        revisionRequest: {
          ...revisionRequest("shorter"),
          reviewedArtifactUpdatedAt: "2026-06-17T15:49:00.000Z",
        },
      },
    ],
    [
      "stale revision event timestamp",
      {
        revisionRequest: {
          ...revisionRequest("shorter"),
          occurredAt: "2026-06-17T15:49:00.000Z",
        },
      },
    ],
  ] as const)("rejects stale or invalid state: %s", (_label, overrides) => {
    expect(expectBlocked({ ...revisionInput("resume_variant"), ...overrides }).reason).toBe(
      "invalid_input",
    );
  });

  it.each([
    [
      "expected next index mismatch",
      (editState: ReturnType<typeof editRequestState>) => ({
        revisionState: revisionState(editState, { expectedNextRevisionIndex: 3 }),
      }),
    ],
    [
      "lineage count mismatch",
      (editState: ReturnType<typeof editRequestState>) => ({
        revisionState: revisionState(editState, {
          previousRevisionCount: 2,
          expectedNextRevisionIndex: 3,
          revisionLineage: [editState.artifactRef.id],
        }),
      }),
    ],
    [
      "lineage does not end at previous ref",
      (editState: ReturnType<typeof editRequestState>) => ({
        revisionState: revisionState(editState, {
          revisionLineage: ["mcp-safe-ref:resume-variant:preview:revision-1"],
        }),
      }),
    ],
    [
      "previous artifact ref mismatch",
      (editState: ReturnType<typeof editRequestState>) => ({
        revisionState: revisionState(editState, {
          previousArtifactRef: {
            ...editState.artifactRef,
            id: "mcp-safe-ref:resume-variant:other-preview",
          },
        }),
      }),
    ],
  ] as const)("rejects contradictory revision state: %s", (_label, buildOverrides) => {
    const editState = editRequestState("resume_variant");
    expect(
      expectBlocked({
        kind: "mcp_generated_artifact_revision_loop_input",
        editRequestState: editState,
        revisionRequest: revisionRequest("shorter"),
        ...buildOverrides(editState),
        version: 1,
      }).reason,
    ).toBe("invalid_input");
  });

  it.each([
    [
      "raw resume",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "raw CV",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "raw job",
      {
        editRequestState: {
          ...editRequestState("cover_letter"),
          safeSummary: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "raw application",
      {
        editRequestState: {
          ...editRequestState("application_package"),
          safeSummary: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "raw cover letter",
      {
        editRequestState: {
          ...editRequestState("cover_letter"),
          safeSummary: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "source quote",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "private fact",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "never_use fact",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
        },
      },
    ],
    [
      "token",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "Bearer [REDACTED:Bearer token]",
        },
      },
    ],
    [
      "email",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "real-user@example.test",
        },
      },
    ],
    [
      "Convex doc id",
      {
        editRequestState: {
          ...editRequestState("resume_variant"),
          safeSummary: "j97convexdocumentid",
        },
      },
    ],
  ] as const)("blocks forbidden input sentinel: %s", (_label, overrides) => {
    expect(expectBlocked({ ...revisionInput("resume_variant"), ...overrides }).reason).toBe(
      "invalid_input",
    );
  });

  it.each([
    ["null", null],
    [
      "missing nested fields",
      {
        kind: "mcp_generated_artifact_revision_loop_input",
        editRequestState: editRequestState("resume_variant"),
        version: 1,
      },
    ],
    [
      "valid envelope with missing nested fields",
      {
        ...revisionInput("resume_variant"),
        revisionRequest: { version: 1 },
      },
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    expect(expectBlocked(input).reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = revisionInput("resume_variant", "shorter", {
      revisionRequest: {
        ...revisionRequest("shorter"),
        [Symbol("hidden")]: "unsafe",
      },
    });
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = revisionInput("resume_variant");
    Object.defineProperty(accessorInput.revisionRequest, "revisionIntent", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() => buildMcpGeneratedArtifactRevisionLoop(accessorInput)).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(revisionInput("resume_variant"), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() => buildMcpGeneratedArtifactRevisionLoop(getTrapProxy)).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(revisionInput("resume_variant"), {
      getPrototypeOf() {
        throw new TypeError("revoked");
      },
    });
    revoke();
    expect(() => buildMcpGeneratedArtifactRevisionLoop(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("is deterministic for the same safe input", () => {
    const input = revisionInput("cover_letter", "preserve_never_use");
    const first = expectAllowed(buildMcpGeneratedArtifactRevisionLoop(input));
    const second = expectAllowed(buildMcpGeneratedArtifactRevisionLoop(input));

    expect(second.summary).toEqual(first.summary);
    expect(second.component).toEqual(first.component);
  });

  it("keeps PR72 sources out of runtime, network, model, write, export/download, send/apply, and PR73 behavior", () => {
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
