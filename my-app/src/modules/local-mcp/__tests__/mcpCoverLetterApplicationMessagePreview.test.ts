import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpCoverLetterApplicationMessagePreview,
  buildMcpCoverLetterApplicationMessagePreviewSafeRefusal,
  type McpCoverLetterApplicationMessagePreviewResultV1,
} from "../mcpCoverLetterApplicationMessagePreview";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PREVIEW_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpCoverLetterApplicationMessagePreview.ts",
);
const RESUME_VARIANT_PREVIEW_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpResumeVariantGenerationPreview.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpCoverLetterApplicationMessagePreview.test.ts",
);
const RESUME_VARIANT_PREVIEW_TEST_FILE = resolve(
  TEST_DIR,
  "mcpResumeVariantGenerationPreview.test.ts",
);

const COVER_LETTER_DRAFT_BODY =
  "Cover letter preview draft. Human review required before any use. Export, download, send, submit, and apply remain blocked.";
const APPLICATION_MESSAGE_DRAFT_BODY =
  "Application message preview draft. Human review required before any use. Export, download, send, submit, and apply remain blocked.";

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
  /\b(download|send|submit|apply|export|approve)\s*\(/u,
  /\b(approvalWorkflow|approvalState|approvalTransition|revisionLoop|generateResume|resumeVariantPreview|reviewNotesPreview|promptTemplate)\b/u,
  /\b(stateMachine|approvePreview|rejectPreview|editPreview|diffReview|auditEvent)\b/u,
] as const;

const SENDABLE_MESSAGE_FIELD_KEYS = new Set([
  "body",
  "channel",
  "deliverymetadata",
  "emailbody",
  "messageid",
  "providermessageid",
  "recipient",
  "sendtarget",
  "subject",
  "threadid",
  "to",
]);

const PR70_SOURCE_TOKENS = [
  "application_message_preview",
  "application_message_preview_created",
  "mcp_cover_letter_application_message_preview",
  "mcp-safe-ref:application-package:message-preview",
] as const;

type PreviewIntent = "cover_letter_preview" | "application_message_preview";

const INTENT_CONFIG = {
  cover_letter_preview: {
    artifactKind: "cover_letter",
    previewStatus: "cover_letter_preview_created",
    refId: "mcp-safe-ref:cover-letter:preview",
    title: "Cover letter preview",
    draftBody: COVER_LETTER_DRAFT_BODY,
  },
  application_message_preview: {
    artifactKind: "application_package",
    previewStatus: "application_message_preview_created",
    refId: "mcp-safe-ref:application-package:message-preview",
    title: "Application message preview",
    draftBody: APPLICATION_MESSAGE_DRAFT_BODY,
  },
} as const;

function generationRequest(
  intent: PreviewIntent,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_cover_letter_application_message_preview_request",
    mode: "deterministic_local_preview",
    intent,
    version: 1,
    ...overrides,
  };
}

function sourceRefs(overrides: Record<string, unknown> = {}) {
  return {
    applicationPackageRef: "mcp-safe-ref:application-package:latest",
    evidenceGraphRef: "mcp-safe-ref:evidence-graph:profile",
    reviewCockpitRef: "mcp-safe-ref:review-cockpit:latest",
    version: 1,
    ...overrides,
  };
}

function safePlan(
  intent: PreviewIntent,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_cover_letter_application_message_preview_safe_plan",
    planStatus: "ready_for_review",
    targetArtifactKind: INTENT_CONFIG[intent].artifactKind,
    tailoringCompleteness: "complete",
    allowedClaims: 2,
    sourceFacts: 2,
    evidenceMatches: 2,
    blockers: 0,
    warnings: 1,
    version: 1,
    ...overrides,
  };
}

function previewInput(
  intent: PreviewIntent,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_cover_letter_application_message_preview_input",
    generationRequest: generationRequest(intent),
    sourceRefs: sourceRefs(),
    safePlan: safePlan(intent),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpCoverLetterApplicationMessagePreviewResultV1,
): Extract<McpCoverLetterApplicationMessagePreviewResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected cover letter/application message preview");
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
): Extract<McpCoverLetterApplicationMessagePreviewResultV1, { allowed: false }> {
  const result = buildMcpCoverLetterApplicationMessagePreview(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected preview to be blocked");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpCoverLetterApplicationMessagePreviewSafeRefusal(),
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
  expect(serialized).not.toContain(COVER_LETTER_DRAFT_BODY);
  expect(serialized).not.toContain(APPLICATION_MESSAGE_DRAFT_BODY);
  expect(serialized).not.toContain('"fullContent":');
  expect(serialized).not.toContain("restricted_full_content");
  expect(serialized).not.toContain("restricted_artifact");
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
  return [PREVIEW_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map(
    (file) => readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return readFileSync(PREVIEW_SOURCE_FILE, "utf8");
}

function resumeVariantPreviewSources(): readonly string[] {
  return [
    RESUME_VARIANT_PREVIEW_SOURCE_FILE,
    RESUME_VARIANT_PREVIEW_TEST_FILE,
  ].map((file) => readFileSync(file, "utf8"));
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

function collectObjectKeys(value: unknown): readonly string[] {
  const keys: string[] = [];
  const seen = new WeakSet<object>();

  function visit(item: unknown): void {
    if (!item || typeof item !== "object") return;
    if (seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    for (const [key, val] of Object.entries(item)) {
      keys.push(key);
      visit(val);
    }
  }

  visit(value);
  return keys;
}

function normalizeFieldKey(key: string): string {
  return key.normalize("NFKC").replace(/[\s_/-]/gu, "").toLowerCase();
}

describe("PR70 cover letter/application message preview", () => {
  it("creates a deterministic cover letter preview from safe versioned input", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("cover_letter_preview"),
      ),
    );

    expect(result.reason).toBe("cover_letter_preview_created");
    expect(result.summary).toMatchObject({
      kind: "mcp_cover_letter_application_message_preview_summary",
      artifactKind: "cover_letter",
      artifactStatus: "human_review_required",
      previewStatus: "cover_letter_preview_created",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
      nextUserAction: "review_pending_items",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.artifactRef).toMatchObject({
      id: "mcp-safe-ref:cover-letter:preview",
      label: "Cover letter artifact",
      status: "human_review_required",
      category: "cover_letter",
      count: 1,
      version: 1,
    });
    expect(result.summary.safeCounts).toMatchObject({
      artifacts: 1,
      blockers: 0,
      warnings: 1,
      allowedClaims: 2,
      sourceFacts: 2,
      evidenceMatches: 2,
      version: 1,
    });
  });

  it("creates a deterministic application message preview from safe versioned input", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("application_message_preview"),
      ),
    );

    expect(result.reason).toBe("application_message_preview_created");
    expect(result.summary).toMatchObject({
      kind: "mcp_cover_letter_application_message_preview_summary",
      artifactKind: "application_package",
      artifactStatus: "human_review_required",
      previewStatus: "application_message_preview_created",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
      nextUserAction: "review_pending_items",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.artifactRef).toMatchObject({
      id: "mcp-safe-ref:application-package:message-preview",
      label: "Application package artifact",
      status: "human_review_required",
      category: "application_package",
      count: 1,
      version: 1,
    });
  });

  it("represents application message preview as application package, not a new artifact kind", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("application_message_preview"),
      ),
    );
    const serialized = JSON.stringify(result);

    expect(result.summary.artifactKind).toBe("application_package");
    expect(result.summary.artifactRef.category).toBe("application_package");
    expect(result.summary.category).toBe("application_package");
    expect(serialized).not.toContain('"artifactKind":"application_message"');
    expect(serialized).not.toContain('"category":"application_message"');
  });

  it("proves application message preview is not sendable", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("application_message_preview"),
      ),
    );

    for (const key of collectObjectKeys(result)) {
      expect(SENDABLE_MESSAGE_FIELD_KEYS.has(normalizeFieldKey(key))).toBe(
        false,
      );
    }
    expect(result.summary.safeFlags).toMatchObject({
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
    });
  });

  it.each([
    ["cover letter", "cover_letter_preview"],
    ["application message", "application_message_preview"],
  ] as const)(
    "marks every %s preview as human review required and blocks unsafe approvals",
    (_label, intent) => {
      const result = expectAllowed(
        buildMcpCoverLetterApplicationMessagePreview(previewInput(intent)),
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
        dataWrites: "blocked",
        writeActions: "blocked",
        exportActions: "blocked",
        modelCalls: "blocked",
        networkAccess: "blocked",
      });
    },
  );

  it.each([
    ["cover letter", "cover_letter_preview"],
    ["application message", "application_message_preview"],
  ] as const)(
    "constructs a PR68-compatible restricted %s artifact internally",
    (_label, intent) => {
      const result = expectAllowed(
        buildMcpCoverLetterApplicationMessagePreview(previewInput(intent)),
      );
      const config = INTENT_CONFIG[intent];

      expect(result.summary.safeCategories).toEqual({
        artifactKind: config.artifactKind,
        artifactStatus: "human_review_required",
        previewStatus: config.previewStatus,
        visibilityCategory: "safe_summary_only",
        retentionCategory: "retention_pending",
        nextUserAction: "review_pending_items",
        version: 1,
      });
      expect(result.capabilities.generatedArtifactBoundary).toBe(
        "pr68_generated_artifact_boundary_checked",
      );
    },
  );

  it.each([
    ["model structured", "model_visible_structured_content", "structuredContent"],
    ["model content", "model_visible_content", "content"],
    [
      "component structured",
      "component_visible_structured_content",
      "structuredContent",
    ],
    ["component content", "component_visible_content", "content"],
    ["meta", "component_visible_meta", "meta"],
    ["props", "component_visible_props", "props"],
    ["bridge payload", "component_visible_bridge_payload", "bridgePayload"],
    ["state snapshot", "component_visible_state_snapshot", "stateSnapshot"],
    [
      "model-context update",
      "component_visible_model_context_update",
      "modelContextUpdate",
    ],
  ] as const)(
    "projects only safe PR68-derived summary to %s",
    (_label, surface, payloadKey) => {
      const result = expectAllowed(
        buildMcpCoverLetterApplicationMessagePreview(
          previewInput("cover_letter_preview"),
        ),
      );
      expect(validateSurface(surface, result.component[payloadKey])).toEqual(
        expect.objectContaining({ allowed: true }),
      );
      expect(JSON.stringify(result.component[payloadKey])).not.toContain(
        COVER_LETTER_DRAFT_BODY,
      );
      expect(JSON.stringify(result.component[payloadKey])).not.toContain(
        APPLICATION_MESSAGE_DRAFT_BODY,
      );
    },
  );

  it("validates _meta as component-visible and safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("application_message_preview"),
      ),
    );

    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      visibilityCategory: "safe_summary_only",
      previewStatus: "application_message_preview_created",
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

  it.each([
    ["cover letter", "cover_letter_preview"],
    ["application message", "application_message_preview"],
  ] as const)("keeps generated full %s text out of every returned surface", (_label, intent) => {
    const result = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(previewInput(intent)),
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
    ] as const;

    for (const surface of visibleSurfaces) {
      const serialized = JSON.stringify(surface);
      expect(serialized).not.toContain(COVER_LETTER_DRAFT_BODY);
      expect(serialized).not.toContain(APPLICATION_MESSAGE_DRAFT_BODY);
      expect(serialized).not.toContain('"fullContent":');
      expect(serialized).not.toContain("restricted_artifact");
    }
  });

  it.each([
    [
      "raw resume",
      sourceRefs({ evidenceGraphRef: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE" }),
    ],
    [
      "raw CV",
      sourceRefs({ evidenceGraphRef: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE" }),
    ],
    [
      "raw job",
      sourceRefs({
        applicationPackageRef: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
      }),
    ],
    [
      "raw application",
      sourceRefs({
        applicationPackageRef: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
      }),
    ],
    [
      "raw cover letter",
      sourceRefs({
        applicationPackageRef: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
      }),
    ],
    [
      "source quote",
      sourceRefs({ evidenceGraphRef: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE" }),
    ],
    [
      "private fact",
      sourceRefs({ evidenceGraphRef: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE" }),
    ],
    [
      "never_use fact",
      sourceRefs({ evidenceGraphRef: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE" }),
    ],
    [
      "token",
      sourceRefs({ reviewCockpitRef: "Bearer [REDACTED:Bearer token]" }),
    ],
    [
      "email",
      sourceRefs({ applicationPackageRef: "real-user@example.test" }),
    ],
    ["Clerk id", sourceRefs({ reviewCockpitRef: "clerk_DO_NOT_EXPOSE" })],
    [
      "Stytch subject",
      sourceRefs({ reviewCockpitRef: "stytch_subject_DO_NOT_EXPOSE" }),
    ],
    [
      "provider subject",
      sourceRefs({ reviewCockpitRef: "provider_subject_DO_NOT_EXPOSE" }),
    ],
    [
      "Convex doc id",
      sourceRefs({ applicationPackageRef: "j97convexdocumentid" }),
    ],
  ] as const)("blocks forbidden input sentinel: %s", (_label, refs) => {
    expect(
      expectBlocked(
        previewInput("cover_letter_preview", { sourceRefs: refs }),
      ).reason,
    ).toBe("invalid_input");
  });

  it.each([
    ["unknown input kind", { kind: "wrong" }],
    [
      "unknown generation mode",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          mode: "model_preview",
        }),
      },
    ],
    [
      "unknown generation intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "review_notes_preview",
        }),
      },
    ],
    [
      "resume-variant generation attempt",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "resume_variant_preview",
        }),
      },
    ],
    [
      "review-notes generation attempt",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "review_notes_preview",
        }),
      },
    ],
    [
      "export intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "cover_letter_export",
        }),
      },
    ],
    [
      "download intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "cover_letter_download",
        }),
      },
    ],
    [
      "send intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "application_message_send",
        }),
      },
    ],
    [
      "submit intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "application_message_submit",
        }),
      },
    ],
    [
      "apply intent",
      {
        generationRequest: generationRequest("cover_letter_preview", {
          intent: "application_apply",
        }),
      },
    ],
    [
      "unknown plan status",
      { safePlan: safePlan("cover_letter_preview", { planStatus: "submitted" }) },
    ],
    [
      "unknown target artifact kind",
      {
        safePlan: safePlan("cover_letter_preview", {
          targetArtifactKind: "review_notes",
        }),
      },
    ],
    [
      "contradictory target artifact kind",
      {
        safePlan: safePlan("cover_letter_preview", {
          targetArtifactKind: "application_package",
        }),
      },
    ],
    [
      "unsafe ref",
      { sourceRefs: sourceRefs({ applicationPackageRef: "application-real-id" }) },
    ],
    [
      "raw ref tail",
      {
        sourceRefs: sourceRefs({
          applicationPackageRef: "mcp-safe-ref:application-package:raw-job",
        }),
      },
    ],
    [
      "raw cover letter text under misleading key",
      { safePlan: safePlan("cover_letter_preview", { coverLetterText: "x" }) },
    ],
    [
      "raw application text under misleading key",
      { safePlan: safePlan("cover_letter_preview", { applicationText: "x" }) },
    ],
  ] as const)("fails closed for %s", (_label, overrides) => {
    expect(expectBlocked(previewInput("cover_letter_preview", overrides)).reason).toBe(
      "invalid_input",
    );
  });

  it("blocks safe but not generation-ready state without exposing source details", () => {
    const result = expectBlocked(
      previewInput("application_message_preview", {
        safePlan: safePlan("application_message_preview", {
          planStatus: "needs_review",
          allowedClaims: 0,
          evidenceMatches: 0,
        }),
      }),
    );
    expect(result.reason).toBe("generation_blocked");
  });

  it.each([
    ["null", null],
    [
      "missing nested fields",
      {
        kind: "mcp_cover_letter_application_message_preview_input",
        generationRequest: generationRequest("cover_letter_preview"),
        sourceRefs: sourceRefs(),
        version: 1,
      },
    ],
    [
      "valid envelope with missing nested fields",
      previewInput("cover_letter_preview", { safePlan: { version: 1 } }),
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    expect(expectBlocked(input).reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = previewInput("cover_letter_preview", {
      safePlan: safePlan("cover_letter_preview", {
        [Symbol("hidden")]: "unsafe",
      }),
    });
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = previewInput("cover_letter_preview");
    Object.defineProperty(accessorInput.safePlan, "warnings", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() =>
      buildMcpCoverLetterApplicationMessagePreview(accessorInput),
    ).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(previewInput("cover_letter_preview"), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() =>
      buildMcpCoverLetterApplicationMessagePreview(getTrapProxy),
    ).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(
      previewInput("cover_letter_preview"),
      {
        getPrototypeOf() {
          throw new TypeError("revoked");
        },
      },
    );
    revoke();
    expect(() => buildMcpCoverLetterApplicationMessagePreview(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("is deterministic for the same safe input", () => {
    const first = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("cover_letter_preview"),
      ),
    );
    const second = expectAllowed(
      buildMcpCoverLetterApplicationMessagePreview(
        previewInput("cover_letter_preview"),
      ),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.component).toEqual(first.component);
  });

  it("keeps PR70 sources out of runtime, network, model, write, export, approval, revision, and adjacent generation behavior", () => {
    const impl = stripStringAndPatternLiterals(implementationSource());
    for (const pattern of STRIPPED_SOURCE_GUARDS) {
      expect(impl).not.toMatch(pattern);
    }
  });

  it("keeps PR69 resume variant preview files free of PR70 behavior", () => {
    for (const source of resumeVariantPreviewSources()) {
      for (const token of PR70_SOURCE_TOKENS) {
        expect(source).not.toContain(token);
      }
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
