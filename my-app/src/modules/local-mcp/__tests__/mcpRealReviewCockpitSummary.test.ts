import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpRealReviewCockpitSummarySafeRefusal,
  projectMcpRealReviewCockpitSummary,
} from "../mcpRealReviewCockpitSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpRealReviewCockpitSummary.ts",
);
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpRealReviewCockpitSummary.test.ts",
);

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

function adapterResult(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: true,
    reason: "read_only_refs_projected",
    refs: {
      reviewCockpitRef: reviewCockpitRef(),
    },
    blockedRefClasses: [],
    availabilitySummary: {
      available: 1,
      noData: 0,
      onboarding: 0,
      blocked: 0,
      version: 1,
    },
    audit: {
      checked: true,
      persisted: false,
      rawPayloadLogged: false,
      eventId: "redacted-audit:mcp-read-only-data-refs",
      redactionCount: 0,
      version: 1,
    },
    capabilities: {
      auth: "production_stytch_verified",
      accountLink: "server_only_owner_resolved",
      consent: "future_real_data_read",
      audit: "redacted_boundary_checked",
      retention: "boundary_checked",
      dataReads: "convex_read_only_refs",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
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

function blockedAdapterResult() {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: false,
    reason: "auth_required",
    safeRefusal: {
      code: "read_only_twoweeks_data_adapter_blocked",
      msg: "Refused. Read-only Twoweeks data adapter blocked.",
      safeForModel: true,
      rawDataExposed: false,
      credentialsExposed: false,
      ownerIdentityExposed: false,
      writeActionExecuted: false,
      version: 1,
    },
    capabilities: {
      auth: "blocked",
      accountLink: "blocked",
      consent: "blocked",
      audit: "not_evaluated",
      retention: "blocked",
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    },
    modelVisible: true,
    version: 1,
  };
}

function reviewCockpitSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_review_cockpit_summary_result",
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
      ownerResolution: "server_only",
      dataReads: "convex_review_cockpit_summary",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      version: 1,
    },
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function summaryInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_real_review_cockpit_summary_input",
    adapterResult: adapterResult(),
    reviewCockpitSummary: reviewCockpitSummary(),
    version: 1,
    ...overrides,
  };
}

function expectBlocked(value: unknown, reason: string): void {
  expect(() => projectMcpRealReviewCockpitSummary(value)).not.toThrow();
  expect(projectMcpRealReviewCockpitSummary(value)).toEqual({
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealReviewCockpitSummarySafeRefusal(),
    capabilities: expect.objectContaining({
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
    }),
    modelVisible: true,
    version: 1,
  });
}

function assertNoSensitiveOutput(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "profile_storage_id_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "user_DO_NOT_ECHO",
    "session_DO_NOT_ECHO",
    "real-user@example.test",
    "stytch_subject_DO_NOT_ECHO",
    "rawClaims",
    "accessToken",
    "refreshToken",
    "Bearer ",
    "RAW_CV_TEXT",
    "RAW_RESUME_TEXT",
    "RAW_JOB_DESCRIPTION",
    "proposal content",
    "coverLetter",
    "generated resume variant content",
    "generated artifact content",
    "sourceText",
    "source quote",
    "private fact detail",
    "never_use fact detail",
    "debugPayload",
    "structuredShadow",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function sourceFiles(): readonly string[] {
  return [SUMMARY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function importSpecifiers(source: string): readonly string[] {
  return [
    ...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu),
  ].map((match) => match[1]);
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\//gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR63 real review cockpit summary boundary", () => {
  it("fails closed when the PR59 adapter result is missing", () => {
    expectBlocked(
      { kind: "mcp_real_review_cockpit_summary_input", version: 1 },
      "invalid_input",
    );
  });

  it("fails closed when the PR59 adapter result is blocked", () => {
    expectBlocked(
      summaryInput({
        adapterResult: blockedAdapterResult(),
        reviewCockpitSummary: undefined,
      }),
      "adapter_required",
    );
  });

  it("returns safe no-data when reviewCockpitRef is missing", () => {
    const result = projectMcpRealReviewCockpitSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {},
          availabilitySummary: {
            available: 0,
            noData: 1,
            onboarding: 0,
            blocked: 0,
            version: 1,
          },
        }),
        reviewCockpitSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "review_cockpit_ref_missing",
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
        status: "no_data_available",
        category: "review_cockpit",
        count: 0,
      },
      safeCounts: {
        reviewContexts: 0,
        reviewRuns: 0,
        reviewArtifacts: 0,
        applicationPackages: 0,
      },
      safeFlags: {
        approvalNeeded: false,
        staleData: false,
        overLimit: false,
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe onboarding state when reviewCockpitRef is onboarding", () => {
    const result = projectMcpRealReviewCockpitSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {
            reviewCockpitRef: reviewCockpitRef({
              status: "onboarding_required",
              count: 7,
              updatedAt: undefined,
            }),
          },
          availabilitySummary: {
            available: 0,
            noData: 0,
            onboarding: 1,
            blocked: 0,
            version: 1,
          },
        }),
        reviewCockpitSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
        status: "onboarding_required",
        category: "review_cockpit",
        count: 0,
      },
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe review readiness, blocker, approval, stale-data, and next-action metadata", () => {
    const result = projectMcpRealReviewCockpitSummary(summaryInput());

    expect(result).toEqual({
      kind: "mcp_real_review_cockpit_summary_result",
      allowed: true,
      status: "available",
      reviewCockpitRef: reviewCockpitRef(),
      availability: {
        source: "convex_review_cockpit_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: reviewCockpitSummary().safeCounts,
      safeCategories: reviewCockpitSummary().safeCategories,
      safeFlags: reviewCockpitSummary().safeFlags,
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
    });
    assertNoSensitiveOutput(result);
  });

  it("canonicalizes reviewCockpitRef labels before model-visible output", () => {
    const result = projectMcpRealReviewCockpitSummary(
      summaryInput({
        adapterResult: adapterResult({
          refs: {
            reviewCockpitRef: reviewCockpitRef({
              label: "Injected safe label",
            }),
          },
        }),
        reviewCockpitSummary: reviewCockpitSummary({
          reviewCockpitRef: reviewCockpitRef({ label: "Another safe label" }),
        }),
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
        label: "Review cockpit availability",
      },
    });
    expect(JSON.stringify(result)).not.toContain("Injected safe label");
    expect(JSON.stringify(result)).not.toContain("Another safe label");
    assertNoSensitiveOutput(result);
  });

  it("fails closed when summary status and reviewCockpitRef status conflict", () => {
    expectBlocked(
      summaryInput({
        reviewCockpitSummary: reviewCockpitSummary({
          status: "available",
          reviewCockpitRef: reviewCockpitRef({
            status: "no_data_available",
            count: 0,
          }),
        }),
      }),
      "summary_required",
    );
  });

  it("rejects malformed, unknown, and descriptor-hazard payloads", () => {
    expectBlocked(null, "invalid_input");
    expectBlocked(
      {
        kind: "mcp_real_review_cockpit_summary_input",
        adapterResult: adapterResult(),
        reviewCockpitSummary: reviewCockpitSummary(),
        handler: () => undefined,
        version: 1,
      },
      "invalid_input",
    );
    expectBlocked(
      summaryInput({
        adapterResult: adapterResult({
          refs: {
            unknownToolRef: reviewCockpitRef(),
          },
        }),
      }),
      "invalid_input",
    );
  });

  it("rejects raw resume, generated artifact, raw job, proposal, source, private, and shadow fields", () => {
    for (const unsafeSummary of [
      { rawCvText: "RAW_CV_TEXT" },
      { resumeText: "RAW_RESUME_TEXT" },
      { jobDescription: "RAW_JOB_DESCRIPTION" },
      { proposalText: "proposal content" },
      { coverLetter: "coverLetter" },
      { generatedArtifactContent: "generated artifact content" },
      { sourceText: "sourceText" },
      { sourceQuote: "source quote" },
      { privateFact: "private fact detail" },
      { neverUseFact: "never_use fact detail" },
      { debugPayload: { ok: false } },
      { structuredShadow: { hidden: true } },
      { reviewNotes: "source quote" },
    ] as const) {
      expectBlocked(
        summaryInput({
          reviewCockpitSummary: reviewCockpitSummary(unsafeSummary),
        }),
        "unsafe_summary_blocked",
      );
    }
  });

  it("does not return identity, token, raw-claim, or Convex document identifiers", () => {
    for (const unsafeSummary of [
      { clerkId: "clerk_DO_NOT_ECHO" },
      { userId: "user_DO_NOT_ECHO" },
      { sessionId: "session_DO_NOT_ECHO" },
      { email: "real-user@example.test" },
      { providerSubject: "stytch_subject_DO_NOT_ECHO" },
      { accessToken: "accessToken" },
      { rawClaims: { sub: "stytch_subject_DO_NOT_ECHO" } },
      { _id: "j97convexdocumentid" },
    ] as const) {
      const result = projectMcpRealReviewCockpitSummary(
        summaryInput({
          reviewCockpitSummary: reviewCockpitSummary(unsafeSummary),
        }),
      );

      expect(result).toMatchObject({
        allowed: false,
        reason: "unsafe_summary_blocked",
      });
      assertNoSensitiveOutput(result);
    }
  });

  it("fails closed on invalid categories, counts, flags, timestamps, and ids", () => {
    for (const unsafeSummary of [
      reviewCockpitSummary({
        safeCounts: { ...reviewCockpitSummary().safeCounts, blockedRuns: 101 },
      }),
      reviewCockpitSummary({
        safeFlags: { ...reviewCockpitSummary().safeFlags, staleData: "yes" },
      }),
      reviewCockpitSummary({
        safeCategories: {
          ...reviewCockpitSummary().safeCategories,
          nextUserAction: "submit_application",
        },
      }),
      reviewCockpitSummary({
        updatedAt: "not-a-date",
      }),
    ] as const) {
      expectBlocked(
        summaryInput({
          reviewCockpitSummary: unsafeSummary,
        }),
        "summary_required",
      );
    }
    expectBlocked(
      summaryInput({
        reviewCockpitSummary: reviewCockpitSummary({
          reviewCockpitRef: reviewCockpitRef({
            id: "j97convexdocumentid",
          }),
        }),
      }),
      "unsafe_summary_blocked",
    );
  });

  it("does not import runtime wiring, handlers, network, model calls, or PR64 behavior", () => {
    const sources = sourceFiles();
    const sourceWithoutLiterals = sources
      .map(stripStringAndPatternLiterals)
      .join("\n");
    const implementationWithoutLiterals = stripStringAndPatternLiterals(
      sources[0] ?? "",
    );
    const imports = sources.flatMap(importSpecifiers);

    expect(imports).toEqual(
      expect.arrayContaining(["node:fs", "node:path", "node:url", "vitest"]),
    );
    expect(imports).not.toContain("../mcpReviewCockpitSummary");
    expect(sourceWithoutLiterals).not.toMatch(
      /tools\/list|tools\/call|localMcpDevEndpoint|localMcpTransport|mcpHandlerBoundary/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|axios|OpenAI|chat\.completions|responses\.create|LLM/u,
    );
    expect(implementationWithoutLiterals).not.toMatch(
      /\b(?:OAuth|oauth|revocation|callback|Stytch|providerSubject|JWKS|issuer|audience)\b/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:exportArtifact|download|sendApplication|submitApplication|applyToJob)\b/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /real read-only E2E|developer mode|ChatGPT test/u,
    );
  });
});
