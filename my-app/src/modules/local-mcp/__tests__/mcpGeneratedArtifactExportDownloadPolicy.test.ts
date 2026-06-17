import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactExportDownloadPolicy,
  buildMcpGeneratedArtifactExportDownloadPolicySafeRefusal,
  type McpGeneratedArtifactExportDownloadPolicyResultV1,
} from "../mcpGeneratedArtifactExportDownloadPolicy";
import {
  buildMcpGeneratedArtifactHumanApprovalWorkflow,
  type McpGeneratedArtifactHumanApprovalWorkflowResultV1,
} from "../mcpGeneratedArtifactHumanApprovalWorkflow";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

type SupportedArtifactKind =
  | "resume_variant"
  | "cover_letter"
  | "application_package";
type DecisionKind = "approve_preview" | "reject_preview" | "request_edit";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const EXPORT_POLICY_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpGeneratedArtifactExportDownloadPolicy.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpGeneratedArtifactExportDownloadPolicy.test.ts",
);

const ARTIFACT_UPDATED_AT = "2026-06-17T05:00:00.000Z";
const DECISION_OCCURRED_AT = "2026-06-17T05:10:00.000Z";
const POLICY_REQUESTED_AT = "2026-06-17T17:10:00.000Z";
const GENERATED_FULL_TEXT =
  "Generated full artifact body that must never be returned by PR73.";

const ARTIFACT_CONFIG = {
  resume_variant: {
    refId: "mcp-safe-ref:resume-variant:preview",
    label: "Resume variant artifact",
    previewStatus: "resume_variant_preview_created",
    suggestedFilename: "resume-variant-export-policy",
  },
  cover_letter: {
    refId: "mcp-safe-ref:cover-letter:preview",
    label: "Cover letter artifact",
    previewStatus: "cover_letter_preview_created",
    suggestedFilename: "cover-letter-export-policy",
  },
  application_package: {
    refId: "mcp-safe-ref:application-package:message-preview",
    label: "Application pkg artifact",
    previewStatus: "application_message_preview_created",
    suggestedFilename: "application-package-export-policy",
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
  "https://",
  "data:",
  "blob:",
  "application/pdf",
  "base64",
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
  /\b(download|send|submit|apply|export|upload|writeFile|createWriteStream)\s*\(/u,
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

function approvalState(
  artifactKind: SupportedArtifactKind = "resume_variant",
  decisionKind: DecisionKind = "approve_preview",
) {
  const result = buildMcpGeneratedArtifactHumanApprovalWorkflow(
    workflowInput(artifactKind, decisionKind),
  );
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

function freshnessState(
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

function policyInput(
  artifactKind: SupportedArtifactKind = "resume_variant",
  overrides: Record<string, unknown> = {},
) {
  const approval = approvalState(artifactKind);
  return {
    kind: "mcp_generated_artifact_export_download_policy_input",
    approvalState: approval,
    exportDownloadRequest: exportDownloadRequest(),
    freshnessState: freshnessState(approval),
    retentionDeleteRollbackState: retentionDeleteRollbackState(),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpGeneratedArtifactExportDownloadPolicyResultV1,
): Extract<
  McpGeneratedArtifactExportDownloadPolicyResultV1,
  { allowed: true }
> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError(`expected allowed result, got ${result.reason}`);
  }
  expect(result.reason).toBe("export_download_policy_authorized");
  expect(result.capabilities).toMatchObject({
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
  expect(result.modelVisible).toBe(true);
  expect(result.componentVisible).toBe(true);
  assertSafeOutput(result);
  return result;
}

function expectBlocked(
  input: unknown,
): Extract<
  McpGeneratedArtifactExportDownloadPolicyResultV1,
  { allowed: false }
> {
  const result = buildMcpGeneratedArtifactExportDownloadPolicy(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected export/download policy to block input");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpGeneratedArtifactExportDownloadPolicySafeRefusal(),
  );
  expect(result.modelVisible).toBe(true);
  expect(result.componentVisible).toBe(false);
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
  expect(serialized).not.toContain("restricted_artifact");
  expect(serialized).not.toContain("free-form");
  expect(serialized).not.toContain("attachment");
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
  return [EXPORT_POLICY_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map(
    (file) => readFileSync(file, "utf8"),
  );
}

function implementationAndPolicySources(): readonly string[] {
  return [EXPORT_POLICY_SOURCE_FILE, POLICY_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return readFileSync(EXPORT_POLICY_SOURCE_FILE, "utf8");
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR73 generated artifact export/download policy", () => {
  it.each([
    ["resume variant", "resume_variant"],
    ["cover letter", "cover_letter"],
    ["application package", "application_package"],
  ] as const)(
    "allows export/download policy decision for approved %s only as metadata",
    (_label, artifactKind) => {
      const result = expectAllowed(
        buildMcpGeneratedArtifactExportDownloadPolicy(policyInput(artifactKind)),
      );

      expect(result.summary).toMatchObject({
        kind: "mcp_generated_artifact_export_download_policy_summary",
        artifactKind,
        artifactStatus: "approved_for_preview",
        policyStatus: "export_download_policy_allowed",
        confirmationStatus: "confirmation_confirmed",
        freshnessStatus: "fresh_artifact_confirmed",
        retentionPolicyStatus: "retention_policy_satisfied",
        deletePolicyStatus: "delete_policy_satisfied",
        rollbackStatus: "rollback_available",
        visibilityCategory: "safe_summary_only",
        suggestedFilename: ARTIFACT_CONFIG[artifactKind].suggestedFilename,
        nextUserAction: "ready_for_review",
        modelVisible: true,
        componentVisible: true,
      });
      expect(result.summary.safeFlags).toMatchObject({
        humanReviewRequired: false,
        approvedForPreview: true,
        approvedForExport: true,
        approvedForDownload: true,
        approvedForSend: false,
        approvedForSubmit: false,
        approvedForApply: false,
        eligibleForLaterExport: true,
        eligibleForLaterDownload: true,
        persisted: false,
        bytesCreated: false,
        filePayloadCreated: false,
        urlCreated: false,
        writeActionExecuted: false,
      });
      expect(result.summary.capabilities).toMatchObject({
        dataWrites: "blocked",
        writeActions: "blocked",
        exportActions: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
      });
      expect(result.summary.suggestedFilename).not.toMatch(/[./\\:@]/u);
    },
  );

  it("returns safe suggested filename metadata only", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(
        policyInput("application_package"),
      ),
    );

    expect(result.summary.suggestedFilename).toBe(
      "application-package-export-policy",
    );
    expect(result.summary.suggestedFilename).not.toMatch(
      /(?:\.pdf|\.docx|\/|\\|:|@)/u,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /(?:https?:\/\/|data:|blob:|application\/pdf|base64)/u,
    );
  });

  it.each([
    ["missing confirmation", {}],
    [
      "free-form confirmation text",
      exportDownloadRequest({ confirmationNote: "Please download this file." }),
    ],
    ["model-inferred confirmation", exportDownloadRequest({ actor: "model" })],
    [
      "wrong confirmation enum",
      exportDownloadRequest({ confirmation: "looks_good" }),
    ],
  ] as const)("blocks unsafe confirmation: %s", (_label, request) => {
    expect(
      expectBlocked(
        policyInput("resume_variant", {
          exportDownloadRequest: request,
        }),
      ).reason,
    ).toMatch(/confirmation_required|invalid_input/u);
  });

  it.each([
    ["human_review_required", approvalState("resume_variant", "request_edit")],
    ["edit_requested", approvalState("cover_letter", "request_edit")],
    ["rejected", approvalState("application_package", "reject_preview")],
    [
      "approvedForPreview false",
      {
        ...approvalState("resume_variant"),
        safeFlags: {
          ...approvalState("resume_variant").safeFlags,
          approvedForPreview: false,
        },
      },
    ],
    [
      "input approvedForExport true",
      {
        ...approvalState("resume_variant"),
        safeFlags: {
          ...approvalState("resume_variant").safeFlags,
          approvedForExport: true,
        },
      },
    ],
    [
      "input approvedForDownload true",
      {
        ...approvalState("resume_variant"),
        safeFlags: {
          ...approvalState("resume_variant").safeFlags,
          approvedForDownload: true,
        },
      },
    ],
  ] as const)("blocks non-PR71-approved state: %s", (_label, approval) => {
    expect(expectBlocked(policyInput("resume_variant", { approvalState: approval })).reason).toBe(
      "invalid_input",
    );
  });

  it("blocks stale artifact state and stale revision lineage", () => {
    const approval = approvalState("cover_letter");
    expect(
      expectBlocked(
        policyInput("cover_letter", {
          freshnessState: freshnessState(approval, {
            currentArtifactUpdatedAt: "2026-06-17T17:09:00.000Z",
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");

    expect(
      expectBlocked(
        policyInput("cover_letter", {
          freshnessState: freshnessState(approval, {
            revisionLineage: [
              approval.artifactRef.id,
              "mcp-safe-ref:cover-letter:preview:revision-1",
            ],
          }),
        }),
      ).reason,
    ).toBe("stale_artifact_blocked");
  });

  it.each([
    [
      "retention failure",
      retentionDeleteRollbackState({
        retentionPolicyStatus: "retention_policy_blocked",
      }),
    ],
    [
      "delete failure",
      retentionDeleteRollbackState({
        deletePolicyStatus: "delete_policy_blocked",
      }),
    ],
    [
      "rollback metadata mismatch",
      retentionDeleteRollbackState({
        rollbackStatus: "rollback_policy_blocked",
      }),
    ],
    ["missing nested fields", { kind: "mcp_generated_artifact_export_download_retention_delete_rollback_state" }],
  ] as const)("blocks retention/delete/rollback policy failure: %s", (_label, state) => {
    expect(
      expectBlocked(
        policyInput("resume_variant", {
          retentionDeleteRollbackState: state,
        }),
      ).reason,
    ).toBe("retention_policy_blocked");
  });

  it.each([
    ["raw user name", "pana-resume-export-policy"],
    ["company name", "acme-cover-letter-export-policy"],
    ["email", "real-user@example.test"],
    ["job title", "senior-engineer-export-policy"],
    ["path separator", "resume/variant-export-policy"],
    ["filesystem path", "/tmp/resume-variant-export-policy"],
    ["download URL", "https://example.test/file"],
    ["extension", "resume-variant-export-policy.pdf"],
    ["base64", "cmVzdW1lLXZhcmlhbnQ="],
  ] as const)("rejects unsafe suggested filename: %s", (_label, suggestedFilename) => {
    expect(
      validateSurface("component_visible_structured_content", {
        ...expectAllowed(
          buildMcpGeneratedArtifactExportDownloadPolicy(policyInput()),
        ).summary,
        suggestedFilename,
      }).allowed,
    ).toBe(false);
  });

  it.each([
    ["MIME payload", { mimeType: "application/pdf" }],
    ["blob payload", { blob: "blob:https://example.test/file" }],
    ["base64 payload", { base64: "cmVzdW1l" }],
    ["attachment object", { attachment: { name: "resume.pdf" } }],
    ["file bytes", { bytes: [1, 2, 3] }],
    ["download URL", { downloadUrl: "https://example.test/file" }],
    ["signed URL", { signedUrl: "https://example.test/signed" }],
  ] as const)("component policy rejects file payload material: %s", (_label, payload) => {
    expect(
      validateSurface("component_visible_structured_content", {
        ...expectAllowed(
          buildMcpGeneratedArtifactExportDownloadPolicy(policyInput()),
        ).summary,
        ...payload,
      }).allowed,
    ).toBe(false);
  });

  it("creates redacted audit event metadata without persistence", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(policyInput("cover_letter")),
    );

    expect(result.summary.auditEvent).toMatchObject({
      kind: "mcp_generated_artifact_export_download_policy_audit_event",
      eventKind: "export_download_policy_authorized",
      artifactKind: "cover_letter",
      policyStatus: "export_download_policy_allowed",
      redactedFlags: {
        rawDataExposed: false,
        fullContentRestricted: true,
        tokenOrIdentityExposed: false,
        persisted: false,
        version: 1,
      },
      persisted: false,
      version: 1,
    });
  });

  it("validates every returned component-visible surface as safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(
        policyInput("application_package"),
      ),
    );

    expect(validateSurface("model_visible_structured_content", result.summary).allowed).toBe(
      true,
    );
    expect(validateSurface("model_visible_content", result.component.content).allowed).toBe(
      true,
    );
    expect(
      validateSurface("component_visible_structured_content", result.summary)
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
      validateSurface("component_visible_action_label", result.component.actionLabel)
        .allowed,
    ).toBe(true);
  });

  it("keeps full generated artifact text out of every returned surface", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(policyInput()),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(GENERATED_FULL_TEXT);
    expect(serialized).not.toContain("full generated artifact body");
    expect(serialized).not.toContain('"fullContent":');
  });

  it.each([
    ["raw resume", { safeSummary: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE" }],
    ["raw CV", { safeSummary: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE" }],
    ["raw job", { safeSummary: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE" }],
    ["raw application", { safeSummary: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE" }],
    ["cover letter", { safeSummary: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE" }],
    ["source quote", { safeSummary: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE" }],
    ["private fact", { safeSummary: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE" }],
    ["never use", { safeSummary: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE" }],
    ["token", { safeSummary: "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE" }],
    ["session", { safeSummary: "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE" }],
    [
      "Convex document id",
      {
        artifactRef: {
          ...approvalState().artifactRef,
          id: "mcp-safe-ref:resume-variant:j97convexdocumentid",
        },
      },
    ],
  ] as const)("blocks raw/private/identity sentinel in approval state: %s", (_label, override) => {
    const approval = approvalState();
    expect(
      expectBlocked(
        policyInput("resume_variant", {
          approvalState: {
            ...approval,
            ...override,
          },
        }),
      ).reason,
    ).toBe("invalid_input");
  });

  it("fails closed for malformed input without throwing", () => {
    for (const badInput of [
      null,
      undefined,
      "safe",
      [],
      { kind: "mcp_generated_artifact_export_download_policy_input" },
      policyInput("resume_variant", {
        freshnessState: {
          kind: "mcp_generated_artifact_export_download_freshness_state",
        },
      }),
    ]) {
      expect(() =>
        buildMcpGeneratedArtifactExportDownloadPolicy(badInput),
      ).not.toThrow();
      expect(expectBlocked(badInput).reason).toMatch(
        /invalid_input|stale_artifact_blocked/u,
      );
    }
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = policyInput("resume_variant", {
      [Symbol("raw")]: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
    } as Record<string, unknown>);
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = policyInput("resume_variant");
    Object.defineProperty(accessorInput, "approvalState", {
      enumerable: true,
      get() {
        throw new Error("getter should not escape");
      },
    });
    expect(() =>
      buildMcpGeneratedArtifactExportDownloadPolicy(accessorInput),
    ).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(policyInput("resume_variant"), {
      get() {
        throw new Error("proxy trap should not escape");
      },
    });
    expect(() =>
      buildMcpGeneratedArtifactExportDownloadPolicy(getTrapProxy),
    ).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(policyInput("resume_variant"), {
      get(target, key, receiver) {
        return Reflect.get(target, key, receiver);
      },
    });
    revoke();
    expect(() =>
      buildMcpGeneratedArtifactExportDownloadPolicy(proxy),
    ).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("is deterministic for the same safe input", () => {
    const input = policyInput("cover_letter");
    const first = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(input),
    );
    const second = expectAllowed(
      buildMcpGeneratedArtifactExportDownloadPolicy(input),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.component).toEqual(first.component);
    expect(second.policy).toEqual(first.policy);
  });

  it("keeps PR73 sources out of runtime, network, model, writes, and real file export behavior", () => {
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

    for (const source of implementationAndPolicySources().map(
      stripStringAndPatternLiterals,
    )) {
      for (const pattern of STRIPPED_SOURCE_GUARDS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
