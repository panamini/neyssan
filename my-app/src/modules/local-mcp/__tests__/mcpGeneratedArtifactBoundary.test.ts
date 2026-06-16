import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactBoundary,
  buildMcpGeneratedArtifactBoundarySafeRefusal,
  type McpGeneratedArtifactBoundaryResultV1,
  type McpGeneratedArtifactKindV1,
  type McpGeneratedArtifactRestrictedArtifactV1,
  type McpGeneratedArtifactStatusV1,
  type McpGeneratedArtifactVisibilityCategoryV1,
} from "../mcpGeneratedArtifactBoundary";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpGeneratedArtifactBoundary.ts",
);
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpGeneratedArtifactBoundary.test.ts",
);

const FULL_CONTENT_BY_KIND: Record<McpGeneratedArtifactKindV1, string> = {
  resume_variant:
    "Restricted resume variant draft body held only in the artifact object.",
  cover_letter:
    "Restricted cover letter draft body held only in the artifact object.",
  application_package:
    "Restricted application package draft body held only in the artifact object.",
  review_notes:
    "Restricted review notes draft body held only in the artifact object.",
};

const SAFE_SUMMARY_VISIBILITY: McpGeneratedArtifactVisibilityCategoryV1 =
  "safe_summary_only";

const SAFE_REF_SUFFIX_BY_KIND: Record<McpGeneratedArtifactKindV1, string> = {
  resume_variant: "resume-variant:latest",
  cover_letter: "cover-letter:latest",
  application_package: "application-package:latest",
  review_notes: "review-notes:latest",
};

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

const CANONICAL_LABEL_BY_KIND: Record<McpGeneratedArtifactKindV1, string> = {
  resume_variant: "Resume variant artifact",
  cover_letter: "Cover letter artifact",
  application_package: "Application package artifact",
  review_notes: "Review notes artifact",
};

const RAW_SCOPE_PATTERNS = [
  /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
  new RegExp(
    [
      "pkg\\.json",
      "package\\.json",
      ["package", "lock"].join("-"),
      ["pnpm", "lock"].join("-"),
      "schema\\.ts",
    ].join("|"),
    "iu",
  ),
] as const;

const STRIPPED_SCOPE_PATTERNS = [
  /\b(window|document|localStorage|sessionStorage)\b/u,
] as const;

function artifactRef(
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `mcp-safe-ref:${SAFE_REF_SUFFIX_BY_KIND[artifactKind]}`,
    label: "Generated artifact availability",
    status: artifactStatus,
    category: artifactKind,
    count: 1,
    updatedAt: "2026-06-16T18:55:00.000Z",
    version: 1,
    ...overrides,
  };
}

function reviewFlags(
  artifactStatus: McpGeneratedArtifactStatusV1,
  overrides: Record<string, unknown> = {},
) {
  return {
    humanReviewRequired:
      artifactStatus !== "approved_for_preview" &&
      artifactStatus !== "redacted",
    approvedForPreview: artifactStatus === "approved_for_preview",
    blockers: artifactStatus === "blocked" ? 1 : 0,
    warnings: artifactStatus === "preview_required" ? 1 : 0,
    version: 1,
    ...overrides,
  };
}

function restrictedArtifact(
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1 = "human_review_required",
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_restricted_artifact",
    artifactKind,
    artifactStatus,
    artifactRef: artifactRef(artifactKind, artifactStatus),
    visibilityCategory: "restricted_full_content",
    retentionCategory: "retention_pending",
    fullContent: FULL_CONTENT_BY_KIND[artifactKind],
    review: reviewFlags(artifactStatus),
    version: 1,
    ...overrides,
  };
}

function boundaryInput(
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1 = "human_review_required",
  artifactOverrides: Record<string, unknown> = {},
  inputOverrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_generated_artifact_boundary_input",
    artifact: restrictedArtifact(
      artifactKind,
      artifactStatus,
      artifactOverrides,
    ),
    version: 1,
    ...inputOverrides,
  };
}

function expectAllowed(
  result: McpGeneratedArtifactBoundaryResultV1,
): Extract<McpGeneratedArtifactBoundaryResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new TypeError("expected generated artifact boundary to be allowed");
  }
  expect(result.capabilities).toEqual({
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
): Extract<McpGeneratedArtifactBoundaryResultV1, { allowed: false }> {
  const result = buildMcpGeneratedArtifactBoundary(input);
  expect(result.allowed).toBe(false);
  if (result.allowed) {
    throw new TypeError("expected generated artifact boundary to be blocked");
  }
  expect(result.safeRefusal).toEqual(
    buildMcpGeneratedArtifactBoundarySafeRefusal(),
  );
  expect(result).not.toHaveProperty("summary");
  expect(result).not.toHaveProperty("component");
  expect(
    validateSurface("component_visible_error", result.safeRefusal),
  ).toMatchObject({
    allowed: true,
  });
  assertSafeOutput(result);
  return result;
}

function assertSafeOutput(value: unknown): void {
  assertLocalMcpPrivacySafeOutput(value);
  const serialized = JSON.stringify(value);
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
  for (const content of Object.values(FULL_CONTENT_BY_KIND)) {
    expect(serialized).not.toContain(content);
  }
  expect(serialized).not.toContain('"fullContent":');
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
  return [BOUNDARY_SOURCE_FILE, POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map(
    (file) => readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return readFileSync(BOUNDARY_SOURCE_FILE, "utf8");
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR68 generated artifact boundary", () => {
  it.each([
    ["resume variant", "resume_variant"],
    ["cover letter", "cover_letter"],
    ["application package", "application_package"],
    ["review notes", "review_notes"],
  ] as const)(
    "allows a restricted %s artifact boundary object",
    (_label, artifactKind) => {
      const result = expectAllowed(
        buildMcpGeneratedArtifactBoundary(boundaryInput(artifactKind)),
      );
      const acceptedArtifact = restrictedArtifact(
        artifactKind,
      ) as McpGeneratedArtifactRestrictedArtifactV1;
      expect(acceptedArtifact.visibilityCategory).toBe(
        "restricted_full_content",
      );
      expect(result.summary).toMatchObject({
        kind: "mcp_generated_artifact_boundary_summary",
        artifactKind,
        artifactStatus: "human_review_required",
        visibilityCategory: SAFE_SUMMARY_VISIBILITY,
        retentionCategory: "retention_pending",
        modelVisible: true,
        componentVisible: true,
      });
      expect(result.summary.artifactRef.id).toBe(
        `mcp-safe-ref:${SAFE_REF_SUFFIX_BY_KIND[artifactKind]}`,
      );
      expect(result.summary.artifactRef.label).toBe(
        CANONICAL_LABEL_BY_KIND[artifactKind],
      );
      expect(result.summary.safeFlags).toMatchObject({
        humanReviewRequired: true,
        approvedForPreview: false,
        fullContentRestricted: true,
        retentionPending: true,
        rawDataExposed: false,
      });
    },
  );

  it.each([
    "draft_created",
    "preview_required",
    "human_review_required",
    "approved_for_preview",
    "blocked",
    "retention_pending",
    "redacted",
  ] as const)("allows exact safe artifact status %s", (artifactStatus) => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactBoundary(
        boundaryInput("resume_variant", artifactStatus),
      ),
    );
    expect(result.summary.artifactStatus).toBe(artifactStatus);
    expect(result.summary.status).toBe(artifactStatus);
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
    "projects safe summary only to %s",
    (_label, surface, payloadKey) => {
      const result = expectAllowed(
        buildMcpGeneratedArtifactBoundary(boundaryInput("cover_letter")),
      );
      expect(
        validateSurface(surface, result.component[payloadKey]),
      ).toMatchObject({
        allowed: true,
      });
      expect(JSON.stringify(result.component[payloadKey])).not.toContain(
        FULL_CONTENT_BY_KIND.cover_letter,
      );
    },
  );

  it("does not expose caller-provided artifact ref labels", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactBoundary(
        boundaryInput("resume_variant", "human_review_required", {
          artifactRef: artifactRef(
            "resume_variant",
            "human_review_required",
            {
              label: "SecretStealthCorp private role context",
            },
          ),
        }),
      ),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SecretStealthCorp");
    expect(serialized).not.toContain("private role context");
    expect(result.summary.artifactRef.label).toBe("Resume variant artifact");
    expect(result.component.meta.artifactRef).toMatchObject({
      label: "Resume variant artifact",
    });
  });

  it("validates _meta as component-visible and safe-summary-only", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactBoundary(boundaryInput("application_package")),
    );
    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      visibilityCategory: "safe_summary_only",
      retentionCategory: "retention_pending",
    });
    expect(
      validateSurface("component_visible_meta", result.component.meta),
    ).toMatchObject({
      allowed: true,
    });
    expect(
      validateSurface("component_visible_meta", {
        ...result.component.meta,
        rawMeta: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
      }),
    ).toMatchObject({ allowed: false });
  });

  it("keeps full generated content out of every returned visible surface", () => {
    const result = expectAllowed(
      buildMcpGeneratedArtifactBoundary(boundaryInput("review_notes")),
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
      expect(serialized).not.toContain(FULL_CONTENT_BY_KIND.review_notes);
      expect(serialized).not.toContain('"fullContent":');
    }
  });

  it.each([
    [
      "raw full generated artifact",
      "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
    ],
    ["raw resume", "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE"],
    ["raw CV", "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE"],
    ["raw job", "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE"],
    ["raw app", "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE"],
    ["raw cover letter", "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE"],
    ["raw proposal", "RAW_PROPOSAL_TEXT_SENTINEL_DO_NOT_EXPOSE"],
    ["private fact", "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE"],
    ["never_use fact", "NEVER_USE_SENTINEL_DO_NOT_EXPOSE"],
    ["source quote", "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE"],
    ["token", "Bearer [REDACTED:Bearer token]"],
    ["email", "real-user@example.test"],
    ["Clerk id", "clerk_DO_NOT_EXPOSE"],
    ["Stytch subject", "stytch_subject_DO_NOT_EXPOSE"],
    ["provider subject", "provider_subject_DO_NOT_EXPOSE"],
    ["Convex doc id", "j97convexdocumentid"],
  ] as const)(
    "blocks unsafe full content sentinel: %s",
    (_label, fullContent) => {
      expect(
        expectBlocked(
          boundaryInput("resume_variant", "human_review_required", {
            fullContent,
          }),
        ).reason,
      ).toBe("invalid_input");
    },
  );

  it.each([
    ["unknown artifact kind", { artifactKind: "portfolio" }],
    ["unknown artifact status", { artifactStatus: "submitted" }],
    [
      "unknown visibility category",
      { visibilityCategory: "component_visible" },
    ],
    ["unknown retention category", { retentionCategory: "persist_forever" }],
    [
      "unsafe ref",
      {
        artifactRef: artifactRef("resume_variant", "human_review_required", {
          id: "resume-real-id",
        }),
      },
    ],
    [
      "raw ref tail",
      {
        artifactRef: artifactRef("resume_variant", "human_review_required", {
          id: "mcp-safe-ref:resume-variant:raw-cv",
        }),
      },
    ],
    ["raw text under misleading key", { safeSummary: "Safe-looking text" }],
    [
      "safe summary visibility plus full text",
      { visibilityCategory: "safe_summary_only" },
    ],
  ] as const)("fails closed for %s", (_label, artifactOverrides) => {
    expect(
      expectBlocked(
        boundaryInput(
          "resume_variant",
          "human_review_required",
          artifactOverrides,
        ),
      ).reason,
    ).toBe("invalid_input");
  });

  it("blocks contradictory review state", () => {
    const result = expectBlocked(
      boundaryInput("cover_letter", "approved_for_preview", {
        review: {
          humanReviewRequired: true,
          approvedForPreview: false,
          blockers: 0,
          warnings: 0,
          version: 1,
        },
      }),
    );
    expect(result.reason).toBe("invalid_input");
  });

  it.each([
    ["null", null],
    ["wrong input kind", { kind: "wrong", artifact: {}, version: 1 }],
    [
      "missing nested artifact fields",
      {
        kind: "mcp_generated_artifact_boundary_input",
        artifact: {
          kind: "mcp_generated_artifact_restricted_artifact",
          artifactKind: "resume_variant",
          version: 1,
        },
        version: 1,
      },
    ],
    [
      "valid envelope with missing nested review fields",
      boundaryInput("resume_variant", "human_review_required", {
        review: { version: 1 },
      }),
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    expect(expectBlocked(input).reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, getters, revoked proxies, and hostile proxies without throwing", () => {
    const symbolInput = boundaryInput(
      "resume_variant",
      "human_review_required",
      {
        [Symbol("hidden")]: "unsafe",
      },
    );
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = boundaryInput("resume_variant");
    Object.defineProperty(accessorInput.artifact, "fullContent", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() =>
      buildMcpGeneratedArtifactBoundary(accessorInput),
    ).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(boundaryInput("resume_variant"), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() => buildMcpGeneratedArtifactBoundary(getTrapProxy)).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(boundaryInput("resume_variant"), {
      getPrototypeOf() {
        throw new TypeError("revoked");
      },
    });
    revoke();
    expect(() => buildMcpGeneratedArtifactBoundary(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("keeps PR68 sources out of runtime, network, model, write, export, and PR69 generation behavior", () => {
    const impl = stripStringAndPatternLiterals(implementationSource());
    expect(impl).not.toMatch(
      /window\.openai|postMessage|React|\.tsx|\.jsx|iframe|registerTool|registerResource/u,
    );
    expect(impl).not.toMatch(/tools\/list|tools\/call/u);
    expect(impl).not.toMatch(
      /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
    );
    expect(impl).not.toMatch(
      /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
    );
    expect(impl).not.toMatch(/\b(download|send|submit|apply|export)\s*\(/u);
    expect(impl).not.toMatch(
      /\b(generateResume|generateCoverLetter|generateApplication|promptTemplate)\b/u,
    );
  });

  it("keeps changed source files out of package, lockfile, schema, and UI/runtime imports", () => {
    for (const source of sourceFiles()) {
      for (const pattern of RAW_SCOPE_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }

    for (const source of sourceFiles().map(stripStringAndPatternLiterals)) {
      for (const pattern of STRIPPED_SCOPE_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
