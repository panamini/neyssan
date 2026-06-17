import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactExportDownloadPolicy,
  type McpGeneratedArtifactExportDownloadPolicyResultV1,
} from "../mcpGeneratedArtifactExportDownloadPolicy";
import { buildMcpGeneratedArtifactHumanApprovalWorkflow } from "../mcpGeneratedArtifactHumanApprovalWorkflow";
import {
  buildMcpResumeExport,
  buildMcpResumeExportSafeRefusal,
  type McpResumeExportResultV1,
} from "../mcpResumeExport";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

type SupportedArtifactKind =
  | "resume_variant"
  | "cover_letter"
  | "application_package";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const RESUME_EXPORT_SOURCE_FILE = resolve(TEST_DIR, "../mcpResumeExport.ts");
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpResumeExport.test.ts");

const ARTIFACT_UPDATED_AT = "2026-06-17T05:00:00.000Z";
const DECISION_OCCURRED_AT = "2026-06-17T05:10:00.000Z";
const POLICY_REQUESTED_AT = "2026-06-17T17:10:00.000Z";
const EXPORT_REQUESTED_AT = "2026-06-17T17:30:00.000Z";
const APPROVED_RESUME_BODY = [
  "# Resume",
  "",
  "Professional Summary",
  "Boundary-focused product engineer for approval-gated workflows.",
  "",
  "Work Experience",
  "- Led local MCP review flows for export-safe artifacts.",
  "",
  "Skills",
  "- TypeScript",
  "- Privacy review",
].join("\n");
const NORMALIZED_APPROVED_RESUME_BODY = `${APPROVED_RESUME_BODY}\n`;

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

const FORBIDDEN_SAFE_SURFACE_FRAGMENTS = [
  NORMALIZED_APPROVED_RESUME_BODY,
  "Work Experience",
  "Skills",
  "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
  "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
  "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
  "real-user@example.test",
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
  /\b(download|send|submit|apply|upload|writeFile|createWriteStream)\s*\(/u,
  /\b(fs\.|Blob|File\s*\(|URL\.createObjectURL|signedUrl|downloadUrl)\b/u,
  /\b(generateResume|generateCoverLetter|generateApplication|promptTemplate)\b/u,
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

function decision(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_human_approval_decision",
    actor: "human_user",
    decision: "approve_preview",
    approvalTarget: "preview_only",
    reviewedArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
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

function approvalState(artifactKind: SupportedArtifactKind = "resume_variant") {
  const result = buildMcpGeneratedArtifactHumanApprovalWorkflow({
    kind: "mcp_generated_artifact_human_approval_workflow_input",
    artifact: artifactContext(artifactKind),
    currentState: currentState(),
    decision: decision(),
    reviewSummary: reviewSummary(),
    occurredAt: DECISION_OCCURRED_AT,
    version: 1,
  });
  if (!result.allowed) {
    throw new TypeError("expected approval workflow to allow fixture input");
  }
  return result.summary;
}

function exportDownloadRequest(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_export_download_policy_request",
    mode: "policy_metadata_only",
    actor: "human",
    confirmation: "confirm_export_download_policy",
    requestedAt: POLICY_REQUESTED_AT,
    version: 1,
    ...overrides,
  };
}

function exportDownloadFreshnessState(
  approval: ReturnType<typeof approvalState>,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_export_download_freshness_state",
    artifactRef: approval.artifactRef,
    approvedArtifactUpdatedAt: approval.artifactRef.updatedAt,
    currentArtifactUpdatedAt: approval.artifactRef.updatedAt,
    revisionLineage: [approval.artifactRef.id],
    version: 1,
    ...overrides,
  };
}

function retentionDeleteRollbackState(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_export_download_retention_delete_rollback_state",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    version: 1,
    ...overrides,
  };
}

function exportDownloadPolicyInput(
  artifactKind: SupportedArtifactKind = "resume_variant",
  overrides: Record<string, unknown> = {},
) {
  const approval = approvalState(artifactKind);
  return {
    kind: "mcp_generated_artifact_export_download_policy_input",
    approvalState: approval,
    exportDownloadRequest: exportDownloadRequest(),
    freshnessState: exportDownloadFreshnessState(approval),
    retentionDeleteRollbackState: retentionDeleteRollbackState(),
    version: 1,
    ...overrides,
  };
}

function allowedPolicyResult(
  artifactKind: SupportedArtifactKind = "resume_variant",
): Extract<McpGeneratedArtifactExportDownloadPolicyResultV1, { allowed: true }> {
  const result = buildMcpGeneratedArtifactExportDownloadPolicy(
    exportDownloadPolicyInput(artifactKind),
  );
  if (!result.allowed) {
    throw new TypeError("expected export/download policy fixture to allow");
  }
  return result;
}

function approvedResumeArtifact(
  policyResult: Extract<
    McpGeneratedArtifactExportDownloadPolicyResultV1,
    { allowed: true }
  >,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_resume_export_approved_resume_artifact",
    artifactKind: "resume_variant",
    artifactStatus: "approved_for_preview",
    artifactRef: policyResult.summary.artifactRef,
    visibilityCategory: "restricted_full_content",
    retentionCategory: "restricted_full_content",
    fullContent: APPROVED_RESUME_BODY,
    version: 1,
    ...overrides,
  };
}

function resumeExportRequest(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_export_request",
    mode: "controlled_local_file_export",
    actor: "human",
    confirmation: "confirm_resume_export",
    requestedAt: EXPORT_REQUESTED_AT,
    version: 1,
    ...overrides,
  };
}

function resumeExportFreshnessState(
  policyResult: Extract<
    McpGeneratedArtifactExportDownloadPolicyResultV1,
    { allowed: true }
  >,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_resume_export_freshness_state",
    artifactRef: policyResult.summary.artifactRef,
    policyAuthorizedAt: policyResult.summary.auditEvent.occurredAt,
    approvedArtifactUpdatedAt: policyResult.summary.artifactRef.updatedAt,
    currentArtifactUpdatedAt: policyResult.summary.artifactRef.updatedAt,
    revisionLineage: [policyResult.summary.artifactRef.id],
    version: 1,
    ...overrides,
  };
}

function resumeExportInput(overrides: Record<string, unknown> = {}) {
  const policyResult = allowedPolicyResult();
  return {
    kind: "mcp_resume_export_input",
    policyResult,
    approvedResumeArtifact: approvedResumeArtifact(policyResult),
    resumeExportRequest: resumeExportRequest(),
    freshnessState: resumeExportFreshnessState(policyResult),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpResumeExportResultV1,
): Extract<McpResumeExportResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError(`expected resume export to allow, got ${result.reason}`);
  }
  expect(result.reason).toBe("resume_export_authorized");
  expect(result.modelVisible).toBe(false);
  expect(result.componentVisible).toBe(false);
  assertSafeSurfaces(result);
  return result;
}

function expectBlocked(
  input: unknown,
): Extract<McpResumeExportResultV1, { allowed: false }> {
  const result = buildMcpResumeExport(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected resume export to block input");
  }
  expect(result.safeRefusal).toEqual(buildMcpResumeExportSafeRefusal());
  expect(result.modelVisible).toBe(true);
  expect(result.componentVisible).toBe(false);
  assertLocalMcpPrivacySafeOutput(result);
  return result;
}

function assertSafeSurfaces(
  result: Extract<McpResumeExportResultV1, { allowed: true }>,
): void {
  const safeProjection = {
    summary: result.summary,
    component: result.component,
    policy: result.policy,
    capabilities: result.capabilities,
  };
  assertLocalMcpPrivacySafeOutput(safeProjection);
  const serialized = JSON.stringify(safeProjection);
  for (const fragment of FORBIDDEN_SAFE_SURFACE_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
  expect(serialized).not.toContain('"exportPayload":');
  expect(serialized).not.toContain("mcp_resume_export_payload");
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

function moduleSource(): string {
  return readFileSync(RESUME_EXPORT_SOURCE_FILE, "utf8");
}

function sourceFiles(): readonly string[] {
  return [RESUME_EXPORT_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map(
    (file) => readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/`(?:\\.|[^`\\])*`/gmu, '""')
    .replace(/"(?:\\.|[^"\\])*"/gmu, '""')
    .replace(/'(?:\\.|[^'\\])*'/gmu, '""')
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u");
}

describe("PR74 resume export boundary", () => {
  it("creates a deterministic controlled local markdown representation for resume variants only", () => {
    const result = expectAllowed(buildMcpResumeExport(resumeExportInput()));

    expect(result.summary).toMatchObject({
      kind: "mcp_resume_export_summary",
      artifactKind: "resume_variant",
      artifactStatus: "approved_for_preview",
      exportStatus: "resume_export_created",
      policyStatus: "export_download_policy_allowed",
      confirmationStatus: "confirmation_confirmed",
      freshnessStatus: "fresh_artifact_confirmed",
      retentionPolicyStatus: "retention_policy_satisfied",
      deletePolicyStatus: "delete_policy_satisfied",
      rollbackStatus: "rollback_available",
      visibilityCategory: "safe_summary_only",
      fileName: "resume-export.md",
      fileExtension: ".md",
      mimeType: "text/markdown",
      nextUserAction: "ready_for_review",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.safeFlags).toMatchObject({
      approvedForPreview: true,
      approvedForExport: true,
      approvedForDownload: true,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      rawDataExposed: false,
      persisted: false,
      urlCreated: false,
      writeActionExecuted: false,
    });
    expect(result.exportPayload).toMatchObject({
      kind: "mcp_resume_export_payload",
      fileName: "resume-export.md",
      fileExtension: ".md",
      mimeType: "text/markdown",
      content: NORMALIZED_APPROVED_RESUME_BODY,
      visibilityCategory: "restricted_full_content",
      persisted: false,
      urlCreated: false,
      writeActionExecuted: false,
      modelVisible: false,
      componentVisible: false,
    });
    expect(result.summary.characterCount).toBe(
      result.exportPayload.characterCount,
    );
    expect(result.summary.byteCount).toBe(result.exportPayload.byteCount);
    expect(result.summary.checksum).toBe(result.exportPayload.checksum);
    expect(result.summary.checksum).toMatch(/^fnv1a32:[a-f0-9]{8}$/u);
    expect(result.summary.refIds).toEqual([
      result.summary.artifactRef.id,
      result.summary.exportRef.id,
    ]);
    expect(result.capabilities).toMatchObject({
      controlledLocalFileRepresentation: "created",
      dataWrites: "blocked",
      writeActions: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
    });
  });

  it("keeps the full resume body only in the controlled export payload", () => {
    const result = expectAllowed(buildMcpResumeExport(resumeExportInput()));
    const safeSurfaces = JSON.stringify({
      summary: result.summary,
      component: result.component,
      policy: result.policy,
    });

    expect(result.exportPayload.content).toBe(NORMALIZED_APPROVED_RESUME_BODY);
    expect(safeSurfaces).not.toContain(NORMALIZED_APPROVED_RESUME_BODY);
    expect(safeSurfaces).not.toContain("Work Experience");
    expect(safeSurfaces).not.toContain("Skills");
    expect(JSON.stringify(result.summary.auditEvent)).not.toContain(
      NORMALIZED_APPROVED_RESUME_BODY,
    );
  });

  it("validates every returned model and component surface through the shared policy", () => {
    const result = expectAllowed(buildMcpResumeExport(resumeExportInput()));

    expect(
      validateSurface(
        "model_visible_structured_content",
        result.component.structuredContent,
      ).allowed,
    ).toBe(true);
    expect(
      validateSurface("model_visible_content", result.component.content).allowed,
    ).toBe(true);
    expect(
      validateSurface(
        "component_visible_structured_content",
        result.component.structuredContent,
      ).allowed,
    ).toBe(true);
    expect(
      validateSurface("component_visible_content", result.component.content)
        .allowed,
    ).toBe(true);
    expect(validateSurface("component_visible_meta", result.component.meta).allowed).toBe(
      true,
    );
    expect(validateSurface("component_visible_props", result.component.props).allowed).toBe(
      true,
    );
    expect(
      validateSurface(
        "component_visible_bridge_payload",
        result.component.bridgePayload,
      ).allowed,
    ).toBe(true);
    expect(
      validateSurface(
        "component_visible_state_snapshot",
        result.component.stateSnapshot,
      ).allowed,
    ).toBe(true);
    expect(
      validateSurface(
        "component_visible_model_context_update",
        result.component.modelContextUpdate,
      ).allowed,
    ).toBe(true);
    expect(
      validateSurface(
        "component_visible_action_label",
        result.component.actionLabel,
      ).allowed,
    ).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const input = resumeExportInput();
    const first = expectAllowed(buildMcpResumeExport(input));
    const second = expectAllowed(buildMcpResumeExport(input));

    expect(second.summary).toEqual(first.summary);
    expect(second.exportPayload).toEqual(first.exportPayload);
    expect(second.component).toEqual(first.component);
  });

  it.each([
    ["cover letter", "cover_letter"],
    ["application package", "application_package"],
  ] as const)("blocks non-resume policy result: %s", (_label, artifactKind) => {
    const policyResult = allowedPolicyResult(artifactKind);
    expect(
      expectBlocked(
        resumeExportInput({
          policyResult,
          approvedResumeArtifact: approvedResumeArtifact(policyResult),
          freshnessState: resumeExportFreshnessState(policyResult),
        }),
      ).reason,
    ).toBe("policy_blocked");
  });

  it.each([
    ["missing confirmation", {}],
    [
      "wrong confirmation",
      resumeExportRequest({ confirmation: "confirm_export_download_policy" }),
    ],
    ["model actor", resumeExportRequest({ actor: "model" })],
    [
      "free-form confirmation note",
      resumeExportRequest({ confirmationNote: "Please export this resume." }),
    ],
  ] as const)("blocks unsafe resume export confirmation: %s", (_label, request) => {
    expect(
      expectBlocked(
        resumeExportInput({
          resumeExportRequest: request,
        }),
      ).reason,
    ).toMatch(/confirmation_required|invalid_input/u);
  });

  it("requires an allowed PR73 export/download policy result", () => {
    const blockedPolicyResult = buildMcpGeneratedArtifactExportDownloadPolicy(
      exportDownloadPolicyInput("resume_variant", {
        exportDownloadRequest: exportDownloadRequest({
          confirmation: "looks_good",
        }),
      }),
    );

    expect(
      expectBlocked(
        resumeExportInput({
          policyResult: blockedPolicyResult,
        }),
      ).reason,
    ).toBe("policy_blocked");
  });

  it("blocks stale artifact state and stale revision lineage", () => {
    const policyResult = allowedPolicyResult();
    expect(
      expectBlocked(
        resumeExportInput({
          freshnessState: resumeExportFreshnessState(policyResult, {
            currentArtifactUpdatedAt: "2026-06-17T17:29:00.000Z",
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");

    expect(
      expectBlocked(
        resumeExportInput({
          freshnessState: resumeExportFreshnessState(policyResult, {
            revisionLineage: [
              policyResult.summary.artifactRef.id,
              "mcp-safe-ref:resume-variant:preview:revision-1",
            ],
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");
  });

  it("blocks artifact mismatch and unsafe resume payload content", () => {
    const policyResult = allowedPolicyResult();
    expect(
      expectBlocked(
        resumeExportInput({
          approvedResumeArtifact: approvedResumeArtifact(policyResult, {
            artifactRef: {
              ...policyResult.summary.artifactRef,
              id: "mcp-safe-ref:resume-variant:other-preview",
            },
          }),
        }),
      ).reason,
    ).toBe("artifact_mismatch");

    expect(
      expectBlocked(
        resumeExportInput({
          approvedResumeArtifact: approvedResumeArtifact(policyResult, {
            fullContent:
              "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE\nSECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
          }),
        }),
      ).reason,
    ).toBe("unsafe_resume_content");
  });

  it("does not expose URL, object, binary, or filesystem-backed file material", () => {
    const result = expectAllowed(buildMcpResumeExport(resumeExportInput()));
    const serialized = JSON.stringify(result);

    expect(result.exportPayload.fileName).toBe("resume-export.md");
    expect(result.exportPayload.fileName).not.toMatch(/[\\/\\\\:@]/u);
    expect(result.exportPayload.mimeType).toBe("text/markdown");
    expect(serialized).not.toMatch(
      /(?:https?:\/\/|data:|blob:|application\/pdf|application\/vnd|base64)/u,
    );
    expect(serialized).not.toMatch(
      /(?:downloadUrl|signedUrl|objectUrl|filesystemPath|writeFile)/u,
    );
  });

  it("keeps implementation source inside the local MCP boundary", () => {
    const source = moduleSource();
    const strippedSource = stripStringAndPatternLiterals(source);

    for (const guard of RAW_SOURCE_GUARDS) {
      expect(source).not.toMatch(guard);
    }
    for (const guard of STRIPPED_SOURCE_GUARDS) {
      expect(strippedSource).not.toMatch(guard);
    }
    expect(source).not.toMatch(/\bfrom\s+["']node:/u);
    expect(source).not.toMatch(/\bprocess\./u);
    expect(source).not.toMatch(/\bBuffer\b/u);
  });

  it("keeps tests and policy guards free of forbidden runtime surfaces", () => {
    for (const source of sourceFiles()) {
      const strippedSource = stripStringAndPatternLiterals(source);
      for (const guard of RAW_SOURCE_GUARDS) {
        expect(source).not.toMatch(guard);
      }
      for (const guard of STRIPPED_SOURCE_GUARDS) {
        expect(strippedSource).not.toMatch(guard);
      }
    }
  });
});
