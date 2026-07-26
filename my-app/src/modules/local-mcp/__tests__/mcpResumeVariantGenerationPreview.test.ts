import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpResumeVariantGenerationPreview,
  buildMcpResumeVariantGenerationPreviewSafeRefusal,
  type McpResumeVariantGenerationPreviewResultV1,
} from "../mcpResumeVariantGenerationPreview";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PREVIEW_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpResumeVariantGenerationPreview.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpResumeVariantGenerationPreview.test.ts",
);

const GENERATED_DRAFT_BODY =
  "Resume variant preview draft. Human review required before any use. Export, send, submit, and apply remain blocked.";

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
  /\b(generateCoverLetter|generateApplication|coverLetterPreview|applicationMessagePreview|promptTemplate)\b/u,
] as const;

function generationRequest(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_variant_generation_preview_request",
    mode: "deterministic_local_preview",
    intent: "resume_variant_preview",
    version: 1,
    ...overrides,
  };
}

function sourceRefs(overrides: Record<string, unknown> = {}) {
  return {
    applicationPackageRef: "mcp-safe-ref:application-package:latest",
    evidenceGraphRef: "mcp-safe-ref:evidence-graph:profile",
    resumeVariantPlanRef: "mcp-safe-ref:resume-variant-plan:latest",
    reviewCockpitRef: "mcp-safe-ref:review-cockpit:latest",
    version: 1,
    ...overrides,
  };
}

function safePlan(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_variant_generation_preview_safe_plan",
    planStatus: "ready_for_review",
    targetDocumentKind: "resume",
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

function previewInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_variant_generation_preview_input",
    generationRequest: generationRequest(),
    sourceRefs: sourceRefs(),
    safePlan: safePlan(),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpResumeVariantGenerationPreviewResultV1,
): Extract<McpResumeVariantGenerationPreviewResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected resume variant preview to be allowed");
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
): Extract<McpResumeVariantGenerationPreviewResultV1, { allowed: false }> {
  const result = buildMcpResumeVariantGenerationPreview(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected resume variant preview to be blocked");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpResumeVariantGenerationPreviewSafeRefusal(),
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
  expect(serialized).not.toContain(GENERATED_DRAFT_BODY);
  expect(serialized).not.toContain("\"fullContent\":");
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

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR69 resume variant generation preview", () => {
  it("creates a deterministic resume variant preview from safe versioned input", () => {
    const result = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );

    expect(result.summary).toMatchObject({
      kind: "mcp_resume_variant_generation_preview_summary",
      artifactKind: "resume_variant",
      artifactStatus: "human_review_required",
      previewStatus: "resume_variant_preview_created",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
      nextUserAction: "review_pending_items",
      modelVisible: true,
      componentVisible: true,
    });
    expect(result.summary.artifactRef).toMatchObject({
      id: "mcp-safe-ref:resume-variant:preview",
      label: "Resume variant artifact",
      status: "human_review_required",
      category: "resume_variant",
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

  it("marks every generated preview as human review required and not approved for unsafe actions", () => {
    const result = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );

    expect(result.summary.safeFlags).toEqual({
      humanReviewRequired: true,
      approvedForPreview: false,
      approvedForExport: false,
      approvedForSend: false,
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
  });

  it("constructs a PR68-compatible restricted resume variant artifact internally", () => {
    const result = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );

    expect(result.reason).toBe("resume_variant_preview_created");
    expect(result.summary.artifactStatus).toBe("human_review_required");
    expect(result.summary.safeCategories).toEqual({
      artifactKind: "resume_variant",
      artifactStatus: "human_review_required",
      previewStatus: "resume_variant_preview_created",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
      nextUserAction: "review_pending_items",
      version: 1,
    });
  });

  it.each([
    [
      "model structured",
      "model_visible_structured_content",
      "structuredContent",
    ],
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
        buildMcpResumeVariantGenerationPreview(previewInput()),
      );
      expect(validateSurface(surface, result.component[payloadKey])).toEqual(
        expect.objectContaining({ allowed: true }),
      );
      expect(JSON.stringify(result.component[payloadKey])).not.toContain(
        GENERATED_DRAFT_BODY,
      );
    },
  );

  it("validates _meta as component-visible and safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );

    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      visibilityCategory: "safe_summary_only",
      previewStatus: "resume_variant_preview_created",
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

  it("keeps generated full resume content out of every returned surface", () => {
    const result = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
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
      expect(serialized).not.toContain(GENERATED_DRAFT_BODY);
      expect(serialized).not.toContain("\"fullContent\":");
      expect(serialized).not.toContain("restricted_artifact");
    }
  });

  it.each([
    ["raw resume", sourceRefs({ resumeVariantPlanRef: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE" })],
    ["raw CV", sourceRefs({ evidenceGraphRef: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE" })],
    ["raw job", sourceRefs({ applicationPackageRef: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE" })],
    ["raw application", sourceRefs({ reviewCockpitRef: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE" })],
    ["raw cover letter", sourceRefs({ applicationPackageRef: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE" })],
    ["source quote", sourceRefs({ evidenceGraphRef: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE" })],
    ["private fact", sourceRefs({ resumeVariantPlanRef: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE" })],
    ["never_use fact", sourceRefs({ resumeVariantPlanRef: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE" })],
    ["token", sourceRefs({ reviewCockpitRef: "Bearer [REDACTED:Bearer token]" })],
    ["email", sourceRefs({ applicationPackageRef: "real-user@example.test" })],
    ["Clerk id", sourceRefs({ reviewCockpitRef: "clerk_DO_NOT_EXPOSE" })],
    ["Stytch subject", sourceRefs({ reviewCockpitRef: "stytch_subject_DO_NOT_EXPOSE" })],
    ["provider subject", sourceRefs({ reviewCockpitRef: "provider_subject_DO_NOT_EXPOSE" })],
    ["Convex doc id", sourceRefs({ resumeVariantPlanRef: "j97convexdocumentid" })],
  ] as const)("blocks forbidden input sentinel: %s", (_label, refs) => {
    expect(
      expectBlocked(previewInput({ sourceRefs: refs })).reason,
    ).toBe("invalid_input");
  });

  it.each([
    ["unknown input kind", { kind: "wrong" }],
    [
      "unknown generation mode",
      { generationRequest: generationRequest({ mode: "model_preview" }) },
    ],
    [
      "unknown generation intent",
      { generationRequest: generationRequest({ intent: "review_notes" }) },
    ],
    [
      "cover-letter generation attempt",
      { generationRequest: generationRequest({ intent: "cover_letter" }) },
    ],
    [
      "application-package generation attempt",
      { generationRequest: generationRequest({ intent: "application_package" }) },
    ],
    [
      "review-notes generation attempt",
      { generationRequest: generationRequest({ intent: "review_notes" }) },
    ],
    [
      "export intent",
      { generationRequest: generationRequest({ intent: "resume_export" }) },
    ],
    [
      "download intent",
      { generationRequest: generationRequest({ intent: "resume_download" }) },
    ],
    [
      "send intent",
      { generationRequest: generationRequest({ intent: "resume_send" }) },
    ],
    [
      "submit intent",
      { generationRequest: generationRequest({ intent: "resume_submit" }) },
    ],
    [
      "apply intent",
      { generationRequest: generationRequest({ intent: "resume_apply" }) },
    ],
    [
      "unknown plan status",
      { safePlan: safePlan({ planStatus: "submitted" }) },
    ],
    [
      "unknown target document kind",
      { safePlan: safePlan({ targetDocumentKind: "cover_letter" }) },
    ],
    ["unknown artifact status", { safePlan: safePlan({ artifactStatus: "submitted" }) }],
    [
      "unsafe ref",
      { sourceRefs: sourceRefs({ resumeVariantPlanRef: "resume-plan-real-id" }) },
    ],
    [
      "raw ref tail",
      {
        sourceRefs: sourceRefs({
          resumeVariantPlanRef: "mcp-safe-ref:resume-variant-plan:raw-cv",
        }),
      },
    ],
    [
      "raw text under misleading key",
      { safePlan: safePlan({ safeSummary: "Safe-looking text" }) },
    ],
  ] as const)("fails closed for %s", (_label, overrides) => {
    expect(expectBlocked(previewInput(overrides)).reason).toBe("invalid_input");
  });

  it("blocks safe but not generation-ready state without exposing source details", () => {
    const result = expectBlocked(
      previewInput({
        safePlan: safePlan({
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
        kind: "mcp_resume_variant_generation_preview_input",
        generationRequest: generationRequest(),
        sourceRefs: sourceRefs(),
        version: 1,
      },
    ],
    [
      "valid envelope with missing nested fields",
      previewInput({ safePlan: { version: 1 } }),
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    expect(expectBlocked(input).reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = previewInput({
      safePlan: safePlan({
        [Symbol("hidden")]: "unsafe",
      }),
    });
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = previewInput();
    Object.defineProperty(accessorInput.safePlan, "warnings", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() => buildMcpResumeVariantGenerationPreview(accessorInput)).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(previewInput(), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() => buildMcpResumeVariantGenerationPreview(getTrapProxy)).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(previewInput(), {
      getPrototypeOf() {
        throw new TypeError("revoked");
      },
    });
    revoke();
    expect(() => buildMcpResumeVariantGenerationPreview(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("is deterministic for the same safe input", () => {
    const first = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );
    const second = expectAllowed(
      buildMcpResumeVariantGenerationPreview(previewInput()),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.component).toEqual(first.component);
  });

  it("keeps PR69 sources out of runtime, network, model, write, export, and PR70 behavior", () => {
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
