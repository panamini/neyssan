import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";
import {
  buildLocalMcpComponentDataPolicySafeRefusal,
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyInputV1,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "../mcpComponentDataPolicy";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpComponentDataPolicy.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpComponentDataPolicy.test.ts");

function policyInput(
  surface: LocalMcpComponentDataSurfaceV1,
  payload: unknown,
): LocalMcpComponentDataPolicyInputV1 {
  return {
    kind: "local_mcp_component_data_policy_input",
    surface,
    payload,
    version: 1,
  };
}

function expectAllowed(result: LocalMcpComponentDataPolicyResultV1): void {
  expect(result.allowed).toBe(true);
  if (!result.allowed)
    throw new TypeError("expected component data policy to allow payload");
  expect(result.capabilities).toEqual({
    componentData: "policy_checked",
    componentRendering: "blocked",
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataWrites: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    version: 1,
  });
  assertPolicyResultSafe(result);
}

function expectBlocked(input: unknown): LocalMcpComponentDataPolicyResultV1 {
  const result = validateLocalMcpComponentDataPolicy(input);
  expect(result.allowed).toBe(false);
  if (result.allowed)
    throw new TypeError("expected component data policy to block payload");
  expect(result.safeRefusal).toEqual(
    buildLocalMcpComponentDataPolicySafeRefusal(),
  );
  expect(result).not.toHaveProperty("safePayload");
  assertPolicyResultSafe(result);
  return result;
}

function assertPolicyResultSafe(result: unknown): void {
  assertLocalMcpPrivacySafeOutput(result);
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
    "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
    "RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE",
    "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
    "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
    "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
    "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
    "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
    "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
    "real-user@example.test",
    "clerk_DO_NOT_EXPOSE",
    "stytch_subject_DO_NOT_EXPOSE",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/u);
}

function summaryCapabilities(dataReads: string) {
  return {
    adapter: "pr59_read_only_adapter_verified",
    dataReads,
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
  };
}

function applicationPackageSummary() {
  return {
    kind: "mcp_real_application_package_summary_result",
    allowed: true,
    status: "available",
    packageRef: {
      id: "mcp-safe-ref:application-package:latest",
      label: "Application pkg availability",
      status: "available",
      category: "application_package",
      count: 2,
      updatedAt: "2026-06-15T11:30:00.000Z",
      version: 1,
    },
    availability: {
      src: "convex_application_package_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: {
      packages: 1,
      artifacts: 2,
      provenanceLinks: 7,
      reviewItems: 1,
      warnings: 0,
      blockers: 0,
      version: 1,
    },
    safeCategories: {
      packageStatus: "ready_for_review",
      resumeVariantArtifactStatus: "ready_for_generation",
      coverLetterArtifactStatus: "ready_for_review",
      version: 1,
    },
    capabilities: summaryCapabilities("convex_application_package_summary"),
    modelVisible: true,
    version: 1,
  } as const;
}

function evidenceGraphSummary() {
  return {
    kind: "mcp_real_evidence_graph_summary_result",
    allowed: true,
    status: "available",
    evidenceGraphRef: {
      id: "mcp-safe-ref:evidence-graph:profile",
      label: "Candidate evidence availability",
      status: "available",
      category: "evidence_graph",
      count: 3,
      version: 1,
    },
    availability: {
      src: "convex_evidence_graph_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: {
      sourceDocuments: 1,
      candidateFacts: 2,
      approvedFacts: 1,
      pendingFacts: 1,
      rejectedFacts: 0,
      restrictedEvidence: 0,
      archivedEvidence: 0,
      provenanceLinks: 4,
      evidenceMatches: 1,
      allowedClaims: 1,
      missingEvidence: 0,
      riskFlags: 0,
      staleSources: 0,
      warnings: 1,
      blockers: 0,
      version: 1,
    },
    safeCategories: {
      evidenceCoverage: "complete",
      provenanceCoverage: "complete",
      qualityStatus: "needs_review",
      blockerCategory: "none",
      nextReviewHint: "ready_for_review",
      version: 1,
    },
    capabilities: summaryCapabilities("convex_evidence_graph_summary"),
    modelVisible: true,
    version: 1,
  } as const;
}

function resumeVariantPlanSummary() {
  return {
    kind: "mcp_real_resume_variant_plan_summary_result",
    allowed: true,
    status: "available",
    resumeVariantPlanRef: {
      id: "mcp-safe-ref:resume-variant-plan:latest",
      label: "Resume variant plan availability",
      status: "available",
      category: "resume_variant_plan",
      count: 1,
      version: 1,
    },
    availability: {
      src: "convex_resume_variant_plan_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: {
      plans: 1,
      planItems: 4,
      claimBackedItems: 2,
      missingInputItems: 1,
      reviewNeededItems: 2,
      acceptedItems: 1,
      rejectedItems: 0,
      blockedItems: 1,
      warnings: 2,
      blockers: 1,
      restrictedFactBlockers: 1,
      excludedFactBlockers: 0,
      artifactTextBlockers: 0,
      allowedClaims: 2,
      sourceFacts: 2,
      evidenceMatches: 2,
      demands: 3,
      riskFlags: 1,
      version: 1,
    },
    safeCategories: {
      planStatus: "blocked",
      targetDocumentKind: "resume",
      tailoringCompleteness: "partial",
      blockerCategory: "private_fact",
      missingInputCategory: "missing_evidence",
      reviewNeededCategory: "blocked",
      nextReviewHint: "review_blockers",
      version: 1,
    },
    capabilities: summaryCapabilities("convex_resume_variant_plan_summary"),
    modelVisible: true,
    version: 1,
  } as const;
}

function reviewCockpitSummary() {
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status: "available",
    reviewCockpitRef: {
      id: "mcp-safe-ref:review-cockpit:latest",
      label: "Review cockpit availability",
      status: "available",
      category: "review_cockpit",
      count: 4,
      version: 1,
    },
    availability: {
      src: "convex_review_cockpit_summary",
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
    capabilities: summaryCapabilities("convex_review_cockpit_summary"),
    modelVisible: true,
    version: 1,
  } as const;
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/`(?:\\.|[^`\\])*`/gmu, '""')
    .replace(/"(?:\\.|[^"\\])*"/gmu, '""')
    .replace(/'(?:\\.|[^'\\])*'/gmu, '""')
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u");
}

function sourceFiles(): readonly string[] {
  return [POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function implementationSource(): string {
  return stripStringAndPatternLiterals(
    readFileSync(POLICY_SOURCE_FILE, "utf8"),
  );
}

function importSpecifiers(source: string): readonly string[] {
  return [
    ...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu),
  ].map((match) => match[1]);
}

describe("PR65 component UI data policy", () => {
  it("allows safe component data and safe content blocks", () => {
    expectAllowed(
      validateLocalMcpComponentDataPolicy(
        policyInput("component_visible_meta", {
          kind: "local_mcp_component_data_policy_safe_meta",
          status: "ready_for_review",
          availability: {
            source: "convex_review_cockpit_summary",
            ownerState: "resolved",
            version: 1,
          },
          refIds: ["mcp-safe-ref:review-cockpit:latest"],
          safeCounts: {
            pendingReviews: 2,
            blockers: 0,
            version: 1,
          },
          safeCategories: {
            reviewGateStatus: "ready",
            nextUserAction: "review_pending_items",
            version: 1,
          },
          version: 1,
        }),
      ),
    );

    expectAllowed(
      validateLocalMcpComponentDataPolicy(
        policyInput("component_visible_content", [
          { type: "text", text: "Review gate is ready." },
          { type: "text", text: "Next action: review pending items." },
        ]),
      ),
    );
  });

  it.each([
    ["application package", applicationPackageSummary()],
    ["evidence graph", evidenceGraphSummary()],
    ["resume variant plan", resumeVariantPlanSummary()],
    ["review cockpit", reviewCockpitSummary()],
  ] as const)(
    "allows safe PR60-PR64 %s summary-shaped payloads",
    (_label, payload) => {
      const result = validateLocalMcpComponentDataPolicy(
        policyInput("component_visible_structured_content", payload),
      );
      expectAllowed(result);
      if (!result.allowed)
        throw new TypeError("expected summary payload to be allowed");
      expect(result.safePayload).toEqual(payload);
    },
  );

  it.each([
    [
      "component structured text",
      "component_visible_structured_content",
      "short safe-looking text",
    ],
    ["model structured count", "model_visible_structured_content", 123],
    [
      "component structured boolean",
      "component_visible_structured_content",
      true,
    ],
    ["meta scalar", "component_visible_meta", "safe-looking metadata"],
    ["props scalar", "component_visible_props", 1],
    ["bridge payload scalar", "component_visible_bridge_payload", false],
    ["state snapshot scalar", "component_visible_state_snapshot", "state"],
    [
      "model-context update scalar",
      "component_visible_model_context_update",
      "update",
    ],
    ["error scalar", "component_visible_error", "blocked"],
  ] as const)(
    "rejects top-level scalar payloads for %s",
    (_label, surface, payload) => {
      expectBlocked(policyInput(surface, payload));
    },
  );

  it("treats _meta as component-visible and rejects raw or sensitive data there", () => {
    expectBlocked(
      policyInput("component_visible_meta", {
        kind: "local_mcp_component_data_policy_safe_meta",
        rawResumeText: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_meta", {
        kind: "local_mcp_component_data_policy_safe_meta",
        call_tool_result: {
          accessToken: "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
          bearer: "Bearer abc.def.ghi",
        },
        version: 1,
      }),
    );
  });

  it("rejects raw structuredContent and raw content text", () => {
    expectBlocked(
      policyInput("model_visible_structured_content", {
        kind: "mcp_real_review_cockpit_summary_result",
        rawCvText: "WORK EXPERIENCE:\nBuilt payment systems for ACME.",
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_content", [
        {
          type: "text",
          text: "WORK EXPERIENCE:\nSenior engineer at ACME from 2020 to 2024.",
        },
      ]),
    );
  });

  it("rejects raw component props, state snapshots, and model-context updates", () => {
    expectBlocked(
      policyInput("component_visible_props", {
        kind: "local_mcp_component_data_policy_safe_props",
        email: "real-user@example.test",
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_state_snapshot", {
        kind: "local_mcp_component_data_policy_safe_state_snapshot",
        resumeText: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_model_context_update", {
        kind: "local_mcp_component_data_policy_safe_model_context_update",
        sourceQuote: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
        version: 1,
      }),
    );
  });

  it("fails closed for unknown fields, nested unsafe fields, and descriptor hazards", () => {
    expectBlocked(
      policyInput("component_visible_structured_content", {
        kind: "local_mcp_component_data_policy_safe_props",
        safeSummary: "Safe summary only.",
        surprise: true,
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_bridge_payload", {
        kind: "local_mcp_component_data_policy_safe_bridge_payload",
        safeCategories: {
          reviewGateStatus: "ready",
          nested: {
            privateFact: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
          },
          version: 1,
        },
        version: 1,
      }),
    );

    expectBlocked(
      policyInput("component_visible_meta", {
        kind: "local_mcp_component_data_policy_safe_meta",
        securitySchemes: [{ type: "oauth2" }],
        outputTemplate: "component.html",
        version: 1,
      }),
    );
  });

  it("fails closed for revoked proxy payloads", () => {
    const { proxy, revoke } = Proxy.revocable(
      {},
      {
        getPrototypeOf() {
          throw new TypeError("revoked");
        },
      },
    );
    revoke();

    expectBlocked(policyInput("component_visible_structured_content", proxy));
  });

  it.each([
    ["raw CV text", { text: "CV text: RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE" }],
    ["raw resume sections", { resumeSections: ["Experience: built billing"] }],
    [
      "generated artifact content",
      { text: "generated resume variant content" },
    ],
    [
      "raw job content",
      { text: "raw job description text for a private role" },
    ],
    [
      "raw proposal content",
      { text: "raw proposal content for the application" },
    ],
    [
      "cover letter content",
      { text: "Dear Hiring Manager, I am excited to apply..." },
    ],
    [
      "source quote",
      { text: "source quote: SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE" },
    ],
    ["private fact", { text: "private fact detail" }],
    ["never use fact", { text: "never_use fact detail" }],
    ["token", { text: "Bearer abc.def.ghi" }],
    ["mixed-case sentinel", { text: "Do_NoT_ExPoSe" }],
    ["raw claims", { rawClaims: { sub: "stytch_subject_DO_NOT_EXPOSE" } }],
    ["identity field", { clerkId: "clerk_DO_NOT_EXPOSE" }],
    ["Convex document id", { id: "j97convexdocumentid" }],
  ] as const)(
    "rejects forbidden component-visible material: %s",
    (_label, payload) => {
      expectBlocked(
        policyInput("component_visible_error", {
          kind: "local_mcp_component_data_policy_safe_error",
          code: "component_data_policy_blocked",
          message: "Refused. Component data policy blocked.",
          ...payload,
          version: 1,
        }),
      );
    },
  );

  it("allows only exact PR67 UX state enums and safe refusal code", () => {
    const pr67StateValues = [
      "loading",
      "missing_consent",
      "missing_auth",
      "missing_account_link",
      "expired_auth",
      "privacy_blocked",
      "unavailable_review_data",
      "budget_exceeded",
      "unsafe_action_refused",
      "safe_unavailable",
      "safe_refusal",
      "unavailable",
      "error",
      "refusal",
      "pending",
      "refresh_inputs",
    ] as const;

    for (const value of pr67StateValues) {
      expectAllowed(
        validateLocalMcpComponentDataPolicy(
          policyInput("component_visible_structured_content", {
            kind: "mcp_component_error_loading_refusal_ux_state",
            allowed: true,
            status: "pending",
            reason: value,
            category: "loading",
            title: "Review state pending",
            message: "Review state is loading.",
            safeSummary: "Review state is pending.",
            nextUserAction: "refresh_inputs",
            refIds: ["mcp-safe-ref:review-cockpit:latest"],
            safeCounts: {
              blockers: 0,
              warnings: 0,
              version: 1,
            },
            safeFlags: {
              approvalNeeded: false,
              staleData: false,
              overLimit: false,
              version: 1,
            },
            modelVisible: true,
            componentVisible: true,
            version: 1,
          }),
        ),
      );
    }

    expectAllowed(
      validateLocalMcpComponentDataPolicy(
        policyInput("component_visible_error", {
          kind: "local_mcp_component_data_policy_safe_error",
          code: "component_error_loading_refusal_ux_blocked",
          message: "Refused. Component UX state blocked.",
          safeForModel: true,
          rawDataExposed: false,
          componentDataExposed: false,
          writeActionExecuted: false,
          version: 1,
        }),
      ),
    );

    expectBlocked(
      policyInput("component_visible_structured_content", {
        kind: "mcp_component_error_loading_refusal_ux_state",
        allowed: true,
        status: "retry_later",
        reason: "retry_later",
        category: "loading",
        title: "Review state pending",
        message: "Review state is loading.",
        safeSummary: "Review state is pending.",
        nextUserAction: "refresh_inputs",
        refIds: ["mcp-safe-ref:review-cockpit:latest"],
        safeCounts: {
          blockers: 0,
          warnings: 0,
          version: 1,
        },
        safeFlags: {
          approvalNeeded: false,
          staleData: false,
          overLimit: false,
          version: 1,
        },
        modelVisible: true,
        componentVisible: true,
        version: 1,
      }),
    );
  });

  it("allows safe next-action labels and rejects write/export/download/send/submit/apply labels", () => {
    expectAllowed(
      validateLocalMcpComponentDataPolicy(
        policyInput("component_visible_action_label", "review_blockers"),
      ),
    );

    for (const unsafeAction of [
      "write",
      "export",
      "download",
      "send",
      "submit",
      "apply",
    ] as const) {
      expectBlocked(
        policyInput("component_visible_action_label", unsafeAction),
      );
    }
  });

  it("does not expose PR66 UI behavior or runtime bridge wiring", () => {
    const implementation = implementationSource();
    expect(implementation).not.toMatch(
      /ReadOnlyReviewComponent|window\.openai|postMessage|React|tsx|jsx|iframe|render/u,
    );
    expect(implementation).not.toMatch(
      /@modelcontextprotocol|express|hono|fastify/u,
    );
    expect(implementation).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/u,
    );
    expect(implementation).not.toMatch(
      /\b(registerTool|registerResource|tools\/call|ui\/message)\b/u,
    );
    expect(implementation).not.toMatch(
      /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
    );

    const imports = importSpecifiers(readFileSync(POLICY_SOURCE_FILE, "utf8"));
    expect(imports).toEqual([]);
  });

  it("keeps test fixtures and implementation scoped to policy-only component data", () => {
    for (const source of sourceFiles().map(stripStringAndPatternLiterals)) {
      expect(source).not.toMatch(
        /from\s+["'].*(?:components|pages|routes|convex)/iu,
      );
      expect(source).not.toMatch(
        /\bwindow\.openai\b|\bReact\b|\biframe\b|\btsx\b|\bjsx\b/u,
      );
      expect(source).not.toMatch(
        /\b(fetch|axios|XMLHttpRequest|OpenAI|chat\.completions|responses\.create)\b/u,
      );
      expect(source).not.toMatch(/\b(download|send|submit|apply)\s*\(/u);
    }
  });
});
