import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpReadOnlyReviewComponent,
  buildMcpReadOnlyReviewComponentSafeRefusal,
  type McpReadOnlyReviewComponentActionLabelV1,
  type McpReadOnlyReviewComponentResultV1,
  type McpReadOnlyReviewComponentUnavailableReasonV1,
} from "../mcpReadOnlyReviewComponent";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const COMPONENT_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpReadOnlyReviewComponent.ts",
);
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpReadOnlyReviewComponent.test.ts",
);

const FORBIDDEN_FRAGMENTS = [
  "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_PROPOSAL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
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

function reviewCockpitRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:review-cockpit:latest",
    label: "Review cockpit availability",
    status: "available",
    category: "review_cockpit",
    count: 3,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function reviewSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status: "available",
    reviewCockpitRef: reviewCockpitRef(),
    availability: {
      source: "convex_review_cockpit_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: {
      reviewContexts: 1,
      reviewRuns: 2,
      reviewArtifacts: 2,
      applicationPackages: 1,
      pendingReviews: 2,
      approvedReviews: 1,
      blockedReviews: 1,
      failedRuns: 0,
      blockedRuns: 1,
      blockedArtifacts: 0,
      blockedPackages: 0,
      missingReviewItems: 2,
      approvalNeeded: 4,
      staleInputs: 1,
      overLimitCollections: 0,
      version: 1,
    },
    safeCategories: {
      reviewReadiness: "blocked",
      reviewGateStatus: "blocked",
      blockerCategory: "blocked_run",
      missingReviewCategory: "pending_review_items",
      nextReviewHint: "review_blockers",
      nextUserAction: "review_blockers",
      version: 1,
    },
    safeFlags: {
      approvalNeeded: true,
      staleData: true,
      overLimit: false,
      version: 1,
    },
    updatedAt: "2026-06-15T11:59:59.750Z",
    capabilities: {
      adapter: "pr59_read_only_adapter_verified",
      dataReads: "convex_review_cockpit_summary",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      exportActions: "blocked",
      rawDataProjection: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    },
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function componentInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_read_only_review_component_input",
    reviewSummary: reviewSummary(),
    version: 1,
    ...overrides,
  };
}

function expectAllowed(
  result: McpReadOnlyReviewComponentResultV1,
): Extract<McpReadOnlyReviewComponentResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed)
    throw new TypeError("expected read-only review component to be allowed");
  expect(result.capabilities).toEqual({
    componentData: "policy_checked",
    componentRendering: "view_model_only",
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
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
): Extract<McpReadOnlyReviewComponentResultV1, { allowed: false }> {
  const result = buildMcpReadOnlyReviewComponent(input);
  expect(result.allowed).toBe(false);
  if (result.allowed)
    throw new TypeError("expected read-only review component to be blocked");
  expect(result.safeRefusal).toEqual(
    buildMcpReadOnlyReviewComponentSafeRefusal(),
  );
  expect(result).not.toHaveProperty("component");
  assertSafeOutput(result);
  return result;
}

function assertSafeOutput(value: unknown): void {
  assertLocalMcpPrivacySafeOutput(value);
  const serialized = JSON.stringify(value);
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
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
  return [COMPONENT_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR66 read-only review component boundary", () => {
  it("projects safe review cockpit state into PR65-approved component surfaces", () => {
    const result = expectAllowed(
      buildMcpReadOnlyReviewComponent(componentInput()),
    );

    expect(result.component.structuredContent).toEqual(reviewSummary());
    expect(result.component.content).toEqual([
      { type: "text", text: "Review gate is blocked." },
      { type: "text", text: "Next action: review blockers." },
    ]);
    expect(result.component.props).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Review cockpit",
      status: "available",
      nextUserAction: "review_blockers",
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
      },
      safeCounts: {
        pendingReviews: 2,
        blockedReviews: 1,
        approvalNeeded: 4,
      },
      safeCategories: {
        reviewReadiness: "blocked",
        reviewGateStatus: "blocked",
        blockerCategory: "blocked_run",
        missingReviewCategory: "pending_review_items",
      },
      safeFlags: {
        approvalNeeded: true,
        staleData: true,
      },
    });
    expect(result.component.meta).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_meta",
      status: "available",
    });
    expect(result.component.stateSnapshot).toMatchObject({
      kind: "local_mcp_component_data_policy_safe_state_snapshot",
      safeRefs: ["mcp-safe-ref:review-cockpit:latest"],
    });
    expect(result.component.actionLabel).toBe("review_blockers");
    expect(result.policy).toEqual(
      expect.objectContaining({
        model_visible_structured_content: "allowed",
        component_visible_structured_content: "allowed",
        component_visible_content: "allowed",
        component_visible_meta: "allowed",
        component_visible_props: "allowed",
        component_visible_state_snapshot: "allowed",
        component_visible_action_label: "allowed",
      }),
    );
  });

  it.each([
    ["structuredContent", "component_visible_structured_content"],
    ["content", "component_visible_content"],
    ["meta", "component_visible_meta"],
    ["props", "component_visible_props"],
    ["stateSnapshot", "component_visible_state_snapshot"],
  ] as const)("keeps %s passing PR65 policy", (payloadKey, surface) => {
    const result = expectAllowed(
      buildMcpReadOnlyReviewComponent(componentInput()),
    );
    const policyResult = validateSurface(surface, result.component[payloadKey]);

    expect(policyResult.allowed).toBe(true);
  });

  it("keeps redacted refs safe and never exposes Convex document IDs as component IDs", () => {
    const result = expectAllowed(
      buildMcpReadOnlyReviewComponent(componentInput()),
    );
    const serialized = JSON.stringify(result.component);

    expect(serialized).toContain("mcp-safe-ref:review-cockpit:latest");
    expect(serialized).not.toContain("j97convexdocumentid");
    expect(serialized).not.toContain("_id");
  });

  it("keeps next recommended actions as review-only labels", () => {
    const result = expectAllowed(
      buildMcpReadOnlyReviewComponent(componentInput()),
    );
    const allowedActions: readonly McpReadOnlyReviewComponentActionLabelV1[] = [
      "add_application_context",
      "approve_review_gate",
      "ready_for_review",
      "refresh_inputs",
      "refresh_stale_inputs",
      "review_blockers",
      "review_missing_inputs",
      "review_pending_items",
    ];

    expect(allowedActions).toContain(result.component.actionLabel);
    expect(result.component.actionLabel).toMatch(
      /^(add_application_context|approve_review_gate|ready_for_review|refresh_inputs|refresh_stale_inputs|review_)/u,
    );
    expect(result.component.actionLabel).not.toMatch(
      /^(write|export|download|send|submit|apply)$/u,
    );
  });

  it.each([
    ["missing auth", "missing_auth"],
    ["missing account link", "missing_account_link"],
    ["missing consent", "missing_consent"],
    ["no review data", "no_review_data"],
  ] as const)(
    "returns a minimal safe unavailable state for %s",
    (_label, unavailableReason) => {
      const result = expectAllowed(
        buildMcpReadOnlyReviewComponent({
          kind: "mcp_read_only_review_component_input",
          unavailableReason:
            unavailableReason as McpReadOnlyReviewComponentUnavailableReasonV1,
          version: 1,
        }),
      );

      expect(result.component.structuredContent).toEqual(
        expect.objectContaining({
          kind: "mcp_real_review_cockpit_summary_result",
          allowed: true,
          status:
            unavailableReason === "no_review_data"
              ? "no_data_available"
              : "onboarding_required",
          modelVisible: true,
        }),
      );
      expect(result.component.content[0]?.text).toMatch(
        /Review data|No review data/u,
      );
      expect(
        validateSurface("component_visible_meta", result.component.meta),
      ).toMatchObject({ allowed: true });
      assertSafeOutput(result);
    },
  );

  it("fails closed for envelope-valid summaries missing required nested fields", () => {
    const result = expectBlocked(
      componentInput({
        reviewSummary: {
          kind: "mcp_real_review_cockpit_summary_result",
          allowed: true,
          status: "available",
          modelVisible: true,
          version: 1,
        },
      }),
    );

    expect(result.reason).toBe("invalid_input");
  });

  it("fails closed when PR65 rejects unsafe review data", () => {
    const result = expectBlocked(
      componentInput({
        reviewSummary: reviewSummary({
          rawResumeText: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      }),
    );

    expect(result.reason).toBe("invalid_input");
    assertSafeOutput(result);
  });

  it("fails closed for revoked proxy inputs", () => {
    const { proxy, revoke } = Proxy.revocable(
      {},
      {
        getPrototypeOf() {
          throw new TypeError("revoked");
        },
      },
    );
    revoke();

    const result = expectBlocked(
      componentInput({
        reviewSummary: proxy,
      }),
    );

    expect(result.reason).toBe("invalid_input");
  });

  it("treats _meta as component-visible and blocks unsafe metadata", () => {
    const result = expectAllowed(
      buildMcpReadOnlyReviewComponent(componentInput()),
    );
    const unsafeMeta = {
      ...result.component.meta,
      rawMeta: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
    };

    expect(validateSurface("component_visible_meta", unsafeMeta)).toMatchObject(
      {
        allowed: false,
      },
    );
  });

  it.each([
    [
      "raw CV text",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "generated artifact content",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "raw job content",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "raw proposal content",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "RAW_PROPOSAL_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "raw application content",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "raw cover letter content",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "source quote",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "private fact",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "never use fact",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    [
      "token",
      {
        reviewCockpitRef: reviewCockpitRef({
          label: "Bearer SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
        }),
      },
    ],
    ["claims", { rawClaims: { sub: "stytch_subject_DO_NOT_EXPOSE" } }],
    ["identity", { clerkId: "clerk_DO_NOT_EXPOSE" }],
    ["Convex id", { id: "j97convexdocumentid" }],
    ["write action", { nextUserAction: "apply" }],
  ] as const)(
    "blocks forbidden component-visible material: %s",
    (_label, payload) => {
      expectBlocked(
        componentInput({
          reviewSummary: reviewSummary(payload),
        }),
      );
    },
  );

  it("does not add runtime wiring, handler exposure, or PR67 UX behavior", () => {
    const implementation = stripStringAndPatternLiterals(
      readFileSync(COMPONENT_SOURCE_FILE, "utf8"),
    );
    expect(implementation).not.toMatch(
      /window\.openai|postMessage|React|tsx|jsx|iframe|registerTool|registerResource/u,
    );
    expect(implementation).not.toMatch(
      /tools\/list|tools\/call|ui\/message|ui\/update-model-context/u,
    );
    expect(implementation).not.toMatch(
      /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
    );
    expect(implementation).not.toMatch(
      /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
    );
    expect(implementation).not.toMatch(
      /spinner|skeleton|toast|budget\s+exceeded|professional\s+error|retry/iu,
    );
  });

  it("keeps PR66 changed sources out of package, schema, runtime, and PR67 scope", () => {
    for (const source of sourceFiles().map(stripStringAndPatternLiterals)) {
      expect(source).not.toMatch(
        /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
      );
      expect(source).not.toMatch(
        /package\.json|package-lock|pnpm-lock|schema\.ts/iu,
      );
      expect(source).not.toMatch(/\b(download|send|submit|apply|export)\s*\(/u);
      expect(source).not.toMatch(/expired\s+auth|refusal\s+UX/iu);
    }
  });
});
