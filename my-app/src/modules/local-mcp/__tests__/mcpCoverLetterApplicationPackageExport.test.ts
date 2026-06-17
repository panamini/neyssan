import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpCoverLetterApplicationPackageExport,
  buildMcpCoverLetterApplicationPackageExportSafeRefusal,
  type McpCoverLetterApplicationPackageExportResultV1,
} from "../mcpCoverLetterApplicationPackageExport";
import {
  buildMcpGeneratedArtifactExportDownloadPolicy,
  type McpGeneratedArtifactExportDownloadPolicyResultV1,
} from "../mcpGeneratedArtifactExportDownloadPolicy";
import { buildMcpGeneratedArtifactHumanApprovalWorkflow } from "../mcpGeneratedArtifactHumanApprovalWorkflow";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

type SupportedArtifactKind =
  | "resume_variant"
  | "cover_letter"
  | "application_package";
type ExportableArtifactKind = Extract<
  SupportedArtifactKind,
  "cover_letter" | "application_package"
>;

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const EXPORT_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpCoverLetterApplicationPackageExport.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpCoverLetterApplicationPackageExport.test.ts",
);

const ARTIFACT_UPDATED_AT = "2026-06-17T05:00:00.000Z";
const DECISION_OCCURRED_AT = "2026-06-17T05:10:00.000Z";
const POLICY_REQUESTED_AT = "2026-06-17T17:10:00.000Z";
const EXPORT_REQUESTED_AT = "2026-06-17T17:30:00.000Z";

const APPROVED_COVER_LETTER_BODY = [
  "# Cover Letter",
  "",
  "Dear Hiring Manager,",
  "",
  "I am applying for the role with a focus on careful product engineering.",
  "My recent work centered on approval-gated workflows and privacy review.",
  "",
  "Regards,",
  "Candidate",
].join("\n");
const APPROVED_APPLICATION_PACKAGE_BODY = [
  "# Application Package",
  "",
  "Materials",
  "- Cover letter draft approved for preview",
  "- Resume variant approved for preview",
  "",
  "Review note",
  "The package is ready for human review before any external action.",
].join("\n");
const NORMALIZED_APPROVED_COVER_LETTER_BODY = `${APPROVED_COVER_LETTER_BODY}\n`;
const NORMALIZED_APPROVED_APPLICATION_PACKAGE_BODY = `${APPROVED_APPLICATION_PACKAGE_BODY}\n`;

const ARTIFACT_CONFIG = {
  resume_variant: {
    refId: "mcp-safe-ref:resume-variant:preview",
    label: "Resume variant artifact",
    previewStatus: "resume_variant_preview_created",
    confirmation: "confirm_resume_export",
    fileName: "resume-export.md",
    exportStatus: "resume_export_created",
    normalizedBody: "# Resume\n\nApproved body.\n",
  },
  cover_letter: {
    refId: "mcp-safe-ref:cover-letter:preview",
    label: "Cover letter artifact",
    previewStatus: "cover_letter_preview_created",
    confirmation: "confirm_cover_letter_export",
    fileName: "cover-letter-export.md",
    exportStatus: "cover_letter_export_created",
    normalizedBody: NORMALIZED_APPROVED_COVER_LETTER_BODY,
  },
  application_package: {
    refId: "mcp-safe-ref:application-package:message-preview",
    label: "Application pkg artifact",
    previewStatus: "application_message_preview_created",
    confirmation: "confirm_application_package_export",
    fileName: "application-package-export.md",
    exportStatus: "application_package_export_created",
    normalizedBody: NORMALIZED_APPROVED_APPLICATION_PACKAGE_BODY,
  },
} as const;

const FORBIDDEN_SAFE_SURFACE_FRAGMENTS = [
  NORMALIZED_APPROVED_COVER_LETTER_BODY,
  NORMALIZED_APPROVED_APPLICATION_PACKAGE_BODY,
  "Dear Hiring Manager",
  "Materials",
  "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
  "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
  "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
  "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
  "real-user@example.test",
  "j97convexdocumentid",
] as const;

const UNSAFE_DELIVERY_KEYS = [
  ["rec", "ipient"].join(""),
  ["delivery", "Channel"].join(""),
  ["provider", "Message", "Id"].join(""),
  ["thread", "Id"].join(""),
  ["send", "Target"].join(""),
  ["submit", "Target"].join(""),
  ["apply", "Target"].join(""),
  ["email", "Subject"].join(""),
  ["email", "Body"].join(""),
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

function approvalState(
  artifactKind: SupportedArtifactKind = "cover_letter",
  decisionOverrides: Record<string, unknown> = {},
) {
  const result = buildMcpGeneratedArtifactHumanApprovalWorkflow({
    kind: "mcp_generated_artifact_human_approval_workflow_input",
    artifact: artifactContext(artifactKind),
    currentState: currentState(),
    decision: decision(decisionOverrides),
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
  artifactKind: SupportedArtifactKind = "cover_letter",
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
  artifactKind: SupportedArtifactKind = "cover_letter",
): Extract<McpGeneratedArtifactExportDownloadPolicyResultV1, { allowed: true }> {
  const result = buildMcpGeneratedArtifactExportDownloadPolicy(
    exportDownloadPolicyInput(artifactKind),
  );
  if (!result.allowed) {
    throw new TypeError("expected export/download policy fixture to allow");
  }
  return result;
}

function approvedExportArtifact(
  policyResult: Extract<
    McpGeneratedArtifactExportDownloadPolicyResultV1,
    { allowed: true }
  >,
  overrides: Record<string, unknown> = {},
) {
  const artifactKind = policyResult.summary.artifactKind as ExportableArtifactKind;
  return {
    kind: "mcp_cover_letter_application_package_export_approved_artifact",
    artifactKind,
    artifactStatus: "approved_for_preview",
    artifactRef: policyResult.summary.artifactRef,
    visibilityCategory: "restricted_full_content",
    retentionCategory: "restricted_full_content",
    fullContent: ARTIFACT_CONFIG[artifactKind].normalizedBody,
    version: 1,
    ...overrides,
  };
}

function exportRequest(
  artifactKind: ExportableArtifactKind = "cover_letter",
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_cover_letter_application_package_export_request",
    mode: "controlled_local_file_export",
    actor: "human",
    confirmation: ARTIFACT_CONFIG[artifactKind].confirmation,
    requestedAt: EXPORT_REQUESTED_AT,
    version: 1,
    ...overrides,
  };
}

function exportFreshnessState(
  policyResult: Extract<
    McpGeneratedArtifactExportDownloadPolicyResultV1,
    { allowed: true }
  >,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_cover_letter_application_package_export_freshness_state",
    artifactRef: policyResult.summary.artifactRef,
    policyAuthorizedAt: policyResult.summary.auditEvent.occurredAt,
    approvedArtifactUpdatedAt: policyResult.summary.artifactRef.updatedAt,
    currentArtifactUpdatedAt: policyResult.summary.artifactRef.updatedAt,
    revisionLineage: [policyResult.summary.artifactRef.id],
    version: 1,
    ...overrides,
  };
}

function pr75ExportInput(
  artifactKind: ExportableArtifactKind = "cover_letter",
  overrides: Record<string, unknown> = {},
) {
  const policyResult = allowedPolicyResult(artifactKind);
  return {
    kind: "mcp_cover_letter_application_package_export_input",
    policyResult,
    approvedExportArtifact: approvedExportArtifact(policyResult),
    exportRequest: exportRequest(artifactKind),
    freshnessState: exportFreshnessState(policyResult),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpCoverLetterApplicationPackageExportResultV1,
): Extract<McpCoverLetterApplicationPackageExportResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError(`expected PR75 export to allow, got ${result.reason}`);
  }
  expect(result.reason).toBe(
    "cover_letter_application_package_export_authorized",
  );
  expect(result.modelVisible).toBe(false);
  expect(result.componentVisible).toBe(false);
  assertSafeSurfaces(result);
  return result;
}

function expectBlocked(
  input: unknown,
): Extract<McpCoverLetterApplicationPackageExportResultV1, { allowed: false }> {
  const result = buildMcpCoverLetterApplicationPackageExport(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected PR75 export to block input");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpCoverLetterApplicationPackageExportSafeRefusal(),
  );
  expect(result.modelVisible).toBe(true);
  expect(result.componentVisible).toBe(false);
  assertLocalMcpPrivacySafeOutput(result);
  return result;
}

function assertSafeSurfaces(
  result: Extract<
    McpCoverLetterApplicationPackageExportResultV1,
    { allowed: true }
  >,
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
  expect(serialized).not.toContain(
    "mcp_cover_letter_application_package_export_payload",
  );
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
  return readFileSync(EXPORT_SOURCE_FILE, "utf8");
}

function sourceFiles(): readonly string[] {
  return [EXPORT_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/`(?:\\.|[^`\\])*`/gmu, '""')
    .replace(/"(?:\\.|[^"\\])*"/gmu, '""')
    .replace(/'(?:\\.|[^'\\])*'/gmu, '""')
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u");
}

describe("PR75 cover letter/application package export boundary", () => {
  it.each([
    ["cover_letter", "cover-letter-export.md", NORMALIZED_APPROVED_COVER_LETTER_BODY],
    [
      "application_package",
      "application-package-export.md",
      NORMALIZED_APPROVED_APPLICATION_PACKAGE_BODY,
    ],
  ] as const)(
    "creates a deterministic controlled local markdown representation for %s",
    (artifactKind, fileName, normalizedBody) => {
      const result = expectAllowed(
        buildMcpCoverLetterApplicationPackageExport(
          pr75ExportInput(artifactKind),
        ),
      );

      expect(result.summary).toMatchObject({
        kind: "mcp_cover_letter_application_package_export_summary",
        artifactKind,
        artifactStatus: "approved_for_preview",
        exportStatus: ARTIFACT_CONFIG[artifactKind].exportStatus,
        policyStatus: "export_download_policy_allowed",
        confirmationStatus: "confirmation_confirmed",
        freshnessStatus: "fresh_artifact_confirmed",
        retentionPolicyStatus: "retention_policy_satisfied",
        deletePolicyStatus: "delete_policy_satisfied",
        rollbackStatus: "rollback_available",
        visibilityCategory: "safe_summary_only",
        fileName,
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
        kind: "mcp_cover_letter_application_package_export_payload",
        artifactKind,
        fileName,
        fileExtension: ".md",
        mimeType: "text/markdown",
        content: normalizedBody,
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
    },
  );

  it("keeps full export content only in the controlled export payload", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationPackageExport(pr75ExportInput()),
    );
    const safeSurfaces = JSON.stringify({
      summary: result.summary,
      component: result.component,
      policy: result.policy,
    });

    expect(result.exportPayload.content).toBe(
      NORMALIZED_APPROVED_COVER_LETTER_BODY,
    );
    expect(safeSurfaces).not.toContain(NORMALIZED_APPROVED_COVER_LETTER_BODY);
    expect(safeSurfaces).not.toContain("Dear Hiring Manager");
    expect(safeSurfaces).not.toContain("privacy review");
    expect(JSON.stringify(result.summary.auditEvent)).not.toContain(
      NORMALIZED_APPROVED_COVER_LETTER_BODY,
    );
  });

  it("validates every returned model and component surface through the shared policy", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationPackageExport(
        pr75ExportInput("application_package"),
      ),
    );

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
    const input = pr75ExportInput("application_package");
    const first = expectAllowed(buildMcpCoverLetterApplicationPackageExport(input));
    const second = expectAllowed(
      buildMcpCoverLetterApplicationPackageExport(input),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.exportPayload).toEqual(first.exportPayload);
    expect(second.component).toEqual(first.component);
  });

  it("blocks resume variant policy results", () => {
    const policyResult = allowedPolicyResult("resume_variant");
    expect(
      expectBlocked({
        ...pr75ExportInput(),
        policyResult,
        approvedExportArtifact: {
          ...approvedExportArtifact(allowedPolicyResult("cover_letter")),
          artifactKind: "resume_variant",
          artifactRef: policyResult.summary.artifactRef,
        },
        freshnessState: exportFreshnessState(policyResult),
      }).reason,
    ).toBe("policy_blocked");
  });

  it.each([
    ["missing confirmation", {}],
    [
      "wrong confirmation",
      exportRequest("cover_letter", {
        confirmation: "confirm_application_package_export",
      }),
    ],
    ["model actor", exportRequest("cover_letter", { actor: "model" })],
    [
      "free-form confirmation note",
      exportRequest("cover_letter", { confirmationNote: "Please export." }),
    ],
    [
      "delivery mode",
      exportRequest("cover_letter", { mode: ["send"].join("") }),
    ],
  ] as const)(
    "blocks unsafe cover letter/application package export confirmation: %s",
    (_label, request) => {
      expect(
        expectBlocked(
          pr75ExportInput("cover_letter", {
            exportRequest: request,
          }),
        ).reason,
      ).toMatch(/confirmation_required|invalid_input/u);
    },
  );

  it("requires an allowed PR73 export/download policy result", () => {
    const blockedPolicyResult = buildMcpGeneratedArtifactExportDownloadPolicy(
      exportDownloadPolicyInput("cover_letter", {
        exportDownloadRequest: exportDownloadRequest({
          confirmation: "looks_good",
        }),
      }),
    );

    expect(
      expectBlocked(
        pr75ExportInput("cover_letter", {
          policyResult: blockedPolicyResult,
        }),
      ).reason,
    ).toBe("policy_blocked");
  });

  it("blocks stale artifact state and stale revision lineage", () => {
    const policyResult = allowedPolicyResult("application_package");
    expect(
      expectBlocked(
        pr75ExportInput("application_package", {
          freshnessState: exportFreshnessState(policyResult, {
            currentArtifactUpdatedAt: "2026-06-17T17:29:00.000Z",
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");

    expect(
      expectBlocked(
        pr75ExportInput("application_package", {
          freshnessState: exportFreshnessState(policyResult, {
            revisionLineage: [
              policyResult.summary.artifactRef.id,
              "mcp-safe-ref:application-package:message-preview:revision-1",
            ],
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");

    expect(
      expectBlocked(
        pr75ExportInput("application_package", {
          exportRequest: exportRequest("application_package", {
            requestedAt: "2026-06-17T17:09:59.000Z",
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");
  });

  it("blocks artifact mismatch and unsafe export content", () => {
    const policyResult = allowedPolicyResult("cover_letter");
    expect(
      expectBlocked(
        pr75ExportInput("cover_letter", {
          approvedExportArtifact: approvedExportArtifact(policyResult, {
            artifactRef: {
              ...policyResult.summary.artifactRef,
              id: "mcp-safe-ref:cover-letter:other-preview",
            },
          }),
        }),
      ).reason,
    ).toBe("artifact_mismatch");

    for (const fullContent of [
      "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
      "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
      "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
      "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
      "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
      "Bearer abc123",
      "j97convexdocumentid",
      `${UNSAFE_DELIVERY_KEYS[0]}: hiring@example.test`,
      `${UNSAFE_DELIVERY_KEYS[7]}: Role`,
      "To: hiring@example.test",
      "Cc: reviewer@example.test",
      "Bcc: hidden@example.test",
      "Subject: Application for role",
      "Email subject: Application",
      "Email body: Please find my application",
      "Recipient: hiring@example.test",
      "Delivery channel: email",
      "Thread ID: abc",
      "Provider message ID: abc",
      "Send target: hiring@example.test",
      "Submit target: platform",
      "Apply target: job",
    ] as const) {
      expect(
        expectBlocked(
          pr75ExportInput("cover_letter", {
            approvedExportArtifact: approvedExportArtifact(policyResult, {
              fullContent,
            }),
          }),
        ).reason,
      ).toBe("unsafe_export_content");
    }
  });

  it("fails closed for delivery metadata fields, malformed descriptors, and proxies", () => {
    const policyResult = allowedPolicyResult("cover_letter");
    for (const unsafeKey of UNSAFE_DELIVERY_KEYS) {
      expect(
        expectBlocked(
          pr75ExportInput("cover_letter", {
            approvedExportArtifact: {
              ...approvedExportArtifact(policyResult),
              [unsafeKey]: "blocked",
            },
          }),
        ).reason,
      ).toBe("invalid_input");
    }

    const getterInput = pr75ExportInput("cover_letter");
    Object.defineProperty(getterInput, "policyResult", {
      enumerable: true,
      get() {
        return policyResult;
      },
    });
    expect(expectBlocked(getterInput).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(
      {},
      {
        getPrototypeOf() {
          throw new TypeError("revoked");
        },
      },
    );
    revoke();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("does not expose URL, object, binary, or filesystem-backed file material", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationPackageExport(
        pr75ExportInput("application_package"),
      ),
    );
    const serialized = JSON.stringify(result);

    expect(result.exportPayload.fileName).toBe("application-package-export.md");
    expect(result.exportPayload.fileName).not.toMatch(/[\/\\:@]/u);
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
