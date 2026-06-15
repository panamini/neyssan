import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpRealResumeVariantPlanSummarySafeRefusal,
  projectMcpRealResumeVariantPlanSummary,
} from "../mcpRealResumeVariantPlanSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpRealResumeVariantPlanSummary.ts",
);
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpRealResumeVariantPlanSummary.test.ts",
);

function resumeVariantPlanRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:resume-variant-plan:latest",
    label: "Resume variant plan availability",
    status: "available",
    category: "resume_variant_plan",
    count: 1,
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
      resumeVariantPlanRef: resumeVariantPlanRef(),
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
      message: "Refused. Read-only Twoweeks data adapter blocked.",
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

function resumeVariantPlanSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_variant_plan_summary_result",
    allowed: true,
    status: "available",
    resumeVariantPlanRef: resumeVariantPlanRef(),
    availability: {
      source: "convex_resume_variant_plan_summary",
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
    updatedAt: "2026-06-15T11:59:59.750Z",
    capabilities: {
      ownerResolution: "server_only",
      dataReads: "convex_resume_variant_plan_summary",
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
    kind: "mcp_real_resume_variant_plan_summary_input",
    adapterResult: adapterResult(),
    resumeVariantPlanSummary: resumeVariantPlanSummary(),
    version: 1,
    ...overrides,
  };
}

function expectBlocked(value: unknown, reason: string): void {
  expect(() => projectMcpRealResumeVariantPlanSummary(value)).not.toThrow();
  expect(projectMcpRealResumeVariantPlanSummary(value)).toEqual({
    kind: "mcp_real_resume_variant_plan_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealResumeVariantPlanSummarySafeRefusal(),
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

describe("PR62 real resume variant plan summary boundary", () => {
  it("fails closed when the PR59 adapter result is missing", () => {
    expectBlocked(
      { kind: "mcp_real_resume_variant_plan_summary_input", version: 1 },
      "invalid_input",
    );
  });

  it("fails closed when the PR59 adapter result is blocked", () => {
    expectBlocked(
      summaryInput({
        adapterResult: blockedAdapterResult(),
        resumeVariantPlanSummary: undefined,
      }),
      "adapter_required",
    );
  });

  it("returns safe no-data when resumeVariantPlanRef is missing", () => {
    const result = projectMcpRealResumeVariantPlanSummary(
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
        resumeVariantPlanSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "resume_variant_plan_ref_missing",
      resumeVariantPlanRef: {
        id: "mcp-safe-ref:resume-variant-plan:latest",
        status: "no_data_available",
        category: "resume_variant_plan",
        count: 0,
      },
      safeCounts: {
        plans: 0,
        planItems: 0,
        warnings: 0,
        blockers: 0,
      },
      capabilities: {
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe onboarding state when resumeVariantPlanRef is onboarding", () => {
    const result = projectMcpRealResumeVariantPlanSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {
            resumeVariantPlanRef: resumeVariantPlanRef({
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
        resumeVariantPlanSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      resumeVariantPlanRef: {
        id: "mcp-safe-ref:resume-variant-plan:latest",
        status: "onboarding_required",
        category: "resume_variant_plan",
        count: 0,
      },
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe resume variant plan summary only for a valid resumeVariantPlanRef", () => {
    const result = projectMcpRealResumeVariantPlanSummary(summaryInput());

    expect(result).toEqual({
      kind: "mcp_real_resume_variant_plan_summary_result",
      allowed: true,
      status: "available",
      resumeVariantPlanRef: resumeVariantPlanRef(),
      availability: {
        source: "convex_resume_variant_plan_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: resumeVariantPlanSummary().safeCounts,
      safeCategories: resumeVariantPlanSummary().safeCategories,
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        adapter: "pr59_read_only_adapter_verified",
        dataReads: "convex_resume_variant_plan_summary",
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

  it("canonicalizes resumeVariantPlanRef labels before model-visible output", () => {
    const result = projectMcpRealResumeVariantPlanSummary(
      summaryInput({
        adapterResult: adapterResult({
          refs: {
            resumeVariantPlanRef: resumeVariantPlanRef({
              label: "Injected safe label",
            }),
          },
        }),
        resumeVariantPlanSummary: resumeVariantPlanSummary({
          resumeVariantPlanRef: resumeVariantPlanRef({
            label: "Another safe label",
          }),
        }),
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      resumeVariantPlanRef: {
        id: "mcp-safe-ref:resume-variant-plan:latest",
        label: "Resume variant plan availability",
      },
    });
    expect(JSON.stringify(result)).not.toContain("Injected safe label");
    expect(JSON.stringify(result)).not.toContain("Another safe label");
    assertNoSensitiveOutput(result);
  });

  it("fails closed when summary status and resumeVariantPlanRef status conflict", () => {
    expectBlocked(
      summaryInput({
        resumeVariantPlanSummary: resumeVariantPlanSummary({
          status: "available",
          resumeVariantPlanRef: resumeVariantPlanRef({
            status: "no_data_available",
            count: 0,
          }),
        }),
      }),
      "summary_required",
    );
  });

  it("rejects raw resume, generated content, raw job, proposal, debug, and shadow fields", () => {
    for (const unsafeSummary of [
      { rawCvText: "RAW_CV_TEXT" },
      { resumeText: "RAW_RESUME_TEXT" },
      { jobDescription: "RAW_JOB_DESCRIPTION" },
      { proposalText: "proposal content" },
      { coverLetter: "coverLetter" },
      { generatedResumeVariantContent: "generated resume variant content" },
      { sourceText: "sourceText" },
      { sourceQuote: "source quote" },
      { debugPayload: { ok: false } },
      { structuredShadow: { hidden: true } },
    ] as const) {
      expectBlocked(
        summaryInput({
          resumeVariantPlanSummary: resumeVariantPlanSummary(unsafeSummary),
        }),
        "unsafe_summary_blocked",
      );
    }
  });

  it("allows safe private and never_use blocker categories without exposing facts", () => {
    for (const blockerCategory of [
      "private_fact",
      "never_use_fact",
      "generated_text_as_fact",
    ] as const) {
      const result = projectMcpRealResumeVariantPlanSummary(
        summaryInput({
          resumeVariantPlanSummary: resumeVariantPlanSummary({
            safeCategories: {
              ...resumeVariantPlanSummary().safeCategories,
              blockerCategory,
            },
          }),
        }),
      );

      expect(result).toMatchObject({
        allowed: true,
        safeCategories: { blockerCategory },
      });
      assertNoSensitiveOutput(result);
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
      const result = projectMcpRealResumeVariantPlanSummary(
        summaryInput({
          resumeVariantPlanSummary: resumeVariantPlanSummary(unsafeSummary),
        }),
      );

      expect(result).toMatchObject({
        allowed: false,
        reason: "unsafe_summary_blocked",
      });
      assertNoSensitiveOutput(result);
    }
  });

  it("fails closed for malformed top-level input", () => {
    for (const value of [
      undefined,
      null,
      [],
      {},
      { kind: "wrong", version: 1 },
    ] as const) {
      expectBlocked(value, "invalid_input");
    }
  });

  it("fails closed for top-level descriptor hazards without invoking getters", () => {
    for (const buildHazard of [
      () => Object.create(summaryInput()),
      () => {
        const input = summaryInput() as Record<PropertyKey, unknown>;
        input[Symbol("unexpected")] = "blocked";
        return input;
      },
      () => {
        const input = summaryInput() as Record<PropertyKey, unknown>;
        Object.defineProperty(input, "hidden", {
          enumerable: false,
          value: "blocked",
        });
        return input;
      },
    ] as const) {
      expectBlocked(buildHazard(), "invalid_input");
    }

    for (const propertyName of [
      "kind",
      "adapterResult",
      "resumeVariantPlanSummary",
    ] as const) {
      let getterInvoked = false;
      const input = summaryInput() as Record<PropertyKey, unknown>;
      Object.defineProperty(input, propertyName, {
        enumerable: true,
        get() {
          getterInvoked = true;
          throw new Error(`${propertyName} getter must not be invoked`);
        },
      });

      expectBlocked(input, "invalid_input");
      expect(getterInvoked).toBe(false);
    }
  });

  it("rejects unknown descriptor and tool names", () => {
    expectBlocked(
      {
        ...summaryInput(),
        kind: "twoweeks.resume_variant_plan.generate",
      },
      "invalid_input",
    );
    expectBlocked(
      {
        ...summaryInput(),
        toolName: "twoweeks.review_cockpit.summarize",
      },
      "invalid_input",
    );
  });

  it("does not import runtime, Convex, network, model, OAuth, write, or PR63 surfaces", () => {
    const imports = sourceFiles().flatMap(importSpecifiers);
    expect(imports).not.toEqual(
      expect.arrayContaining([
        "convex/values",
        "./_generated/server",
        "../localMcpDevEndpoint",
        "../localMcpToolsCallSimulation",
        "../mcpReviewCockpitSummary",
      ]),
    );

    const sourceWithoutLiterals = stripStringAndPatternLiterals(
      readFileSync(SUMMARY_SOURCE_FILE, "utf8"),
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:query|mutation|internalQuery|internalMutation|internalAction|action)\s*\(/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|axios|OpenAI|chat\.completions|responses\.create|LLM/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:OAuth|oauth|token|bearer|refresh|revocation|callback|Stytch|providerSubject|claims|JWKS|issuer|audience)\b/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:exportArtifact|download|sendApplication|submitApplication|applyToJob)\b/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(/review_cockpit|reviewCockpit/u);
  });
});
