import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpRealEvidenceGraphSummarySafeRefusal,
  projectMcpRealEvidenceGraphSummary,
} from "../mcpRealEvidenceGraphSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpRealEvidenceGraphSummary.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpRealEvidenceGraphSummary.test.ts");

function evidenceGraphRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:evidence-graph:profile",
    label: "Candidate evidence availability",
    status: "available",
    category: "evidence_graph",
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
      evidenceGraphRef: evidenceGraphRef(),
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

function evidenceGraphSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_evidence_graph_summary_result",
    allowed: true,
    status: "available",
    evidenceGraphRef: evidenceGraphRef(),
    availability: {
      source: "convex_evidence_graph_summary",
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
    updatedAt: "2026-06-15T11:59:59.750Z",
    capabilities: {
      ownerResolution: "server_only",
      dataReads: "convex_evidence_graph_summary",
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
    kind: "mcp_real_evidence_graph_summary_input",
    adapterResult: adapterResult(),
    evidenceGraphSummary: evidenceGraphSummary(),
    version: 1,
    ...overrides,
  };
}

function expectBlocked(value: unknown, reason: string): void {
  expect(() => projectMcpRealEvidenceGraphSummary(value)).not.toThrow();
  expect(projectMcpRealEvidenceGraphSummary(value)).toEqual({
    kind: "mcp_real_evidence_graph_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealEvidenceGraphSummarySafeRefusal(),
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
    "real-user@example.test",
    "stytch_subject_DO_NOT_ECHO",
    "rawClaims",
    "accessToken",
    "refreshToken",
    "Bearer ",
    "RAW_CV_TEXT",
    "RAW_JOB_TEXT",
    "proposal content",
    "coverLetter",
    "generated artifact content",
    "sourceText",
    "source quote",
    "privateFactNames",
    "never_use",
    "debugPayload",
    "structuredShadow",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function sourceFiles(): readonly string[] {
  return [SUMMARY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) => readFileSync(file, "utf8"));
}

function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
    (match) => match[1],
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\//gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR61 real evidence graph summary boundary", () => {
  it("fails closed when the PR59 adapter result is missing", () => {
    expectBlocked({ kind: "mcp_real_evidence_graph_summary_input", version: 1 }, "invalid_input");
  });

  it("fails closed when the PR59 adapter result is blocked", () => {
    expectBlocked(
      summaryInput({ adapterResult: blockedAdapterResult(), evidenceGraphSummary: undefined }),
      "adapter_required",
    );
  });

  it("returns safe no-data when evidenceGraphRef is missing", () => {
    const result = projectMcpRealEvidenceGraphSummary(
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
        evidenceGraphSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "evidence_graph_ref_missing",
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        status: "no_data_available",
        category: "evidence_graph",
        count: 0,
      },
      safeCounts: {
        sourceDocuments: 0,
        candidateFacts: 0,
        provenanceLinks: 0,
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

  it("returns safe onboarding state when evidenceGraphRef is onboarding", () => {
    const result = projectMcpRealEvidenceGraphSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {
            evidenceGraphRef: evidenceGraphRef({
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
        evidenceGraphSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        status: "onboarding_required",
        category: "evidence_graph",
        count: 0,
      },
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe evidence graph summary only for a valid evidenceGraphRef", () => {
    const result = projectMcpRealEvidenceGraphSummary(summaryInput());

    expect(result).toEqual({
      kind: "mcp_real_evidence_graph_summary_result",
      allowed: true,
      status: "available",
      evidenceGraphRef: evidenceGraphRef(),
      availability: {
        source: "convex_evidence_graph_summary",
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
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        adapter: "pr59_read_only_adapter_verified",
        dataReads: "convex_evidence_graph_summary",
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

  it("canonicalizes evidenceGraphRef labels before model-visible output", () => {
    const result = projectMcpRealEvidenceGraphSummary(
      summaryInput({
        adapterResult: adapterResult({
          refs: {
            evidenceGraphRef: evidenceGraphRef({ label: "Injected safe label" }),
          },
        }),
        evidenceGraphSummary: evidenceGraphSummary({
          evidenceGraphRef: evidenceGraphRef({ label: "Another safe label" }),
        }),
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        label: "Candidate evidence availability",
      },
    });
    expect(JSON.stringify(result)).not.toContain("Injected safe label");
    expect(JSON.stringify(result)).not.toContain("Another safe label");
    assertNoSensitiveOutput(result);
  });

  it("fails closed when summary status and evidenceGraphRef status conflict", () => {
    expectBlocked(
      summaryInput({
        evidenceGraphSummary: evidenceGraphSummary({
          status: "available",
          evidenceGraphRef: evidenceGraphRef({ status: "no_data_available", count: 0 }),
        }),
      }),
      "summary_required",
    );
  });

  it("rejects raw evidence, generated content, private, never-use, debug, and shadow fields", () => {
    for (const unsafeSummary of [
      { rawCvText: "RAW_CV_TEXT" },
      { rawJobText: "RAW_JOB_TEXT" },
      { proposalContent: "proposal content" },
      { coverLetter: "coverLetter" },
      { generatedArtifactContent: "generated artifact content" },
      { sourceText: "sourceText" },
      { sourceQuote: "source quote" },
      { privateFactNames: ["privateFactNames"] },
      { never_use: true },
      { debugPayload: { ok: false } },
      { structuredShadow: { hidden: true } },
    ] as const) {
      expectBlocked(
        summaryInput({
          evidenceGraphSummary: evidenceGraphSummary(unsafeSummary),
        }),
        "unsafe_summary_blocked",
      );
    }
  });

  it("does not return identity, token, raw-claim, or Convex document identifiers", () => {
    for (const unsafeSummary of [
      { clerkId: "clerk_DO_NOT_ECHO" },
      { userId: "user_DO_NOT_ECHO" },
      { email: "real-user@example.test" },
      { stytchSubject: "stytch_subject_DO_NOT_ECHO" },
      { accessToken: "accessToken" },
      { rawClaims: { sub: "stytch_subject_DO_NOT_ECHO" } },
      { convexDocumentId: "j97convexdocumentid" },
    ] as const) {
      const result = projectMcpRealEvidenceGraphSummary(
        summaryInput({ evidenceGraphSummary: evidenceGraphSummary(unsafeSummary) }),
      );

      expect(result).toMatchObject({ allowed: false, reason: "unsafe_summary_blocked" });
      assertNoSensitiveOutput(result);
    }
  });

  it("fails closed for malformed top-level input", () => {
    for (const value of [undefined, null, [], {}, { kind: "wrong", version: 1 }] as const) {
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

    for (const propertyName of ["kind", "adapterResult", "evidenceGraphSummary"] as const) {
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

  it("keeps source disconnected from forbidden imports, calls, and unsafe top-level reads", () => {
    const allowedImports = new Set([
      "../mcpRealEvidenceGraphSummary",
      "node:fs",
      "node:path",
      "node:url",
      "vitest",
    ]);
    const forbiddenImportSpecifier =
      /activeCvSnapshots|profilesPublic|jobsPublic|proposalsPublic|(?:^|\/)(?:_generated|handlers?|tools\/list|tools\/call)(?:\/|$)|node:https?$|https?$|@openai|openai|langchain|axios|undici|oauth|token/iu;
    const forbiddenCallPatterns = [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bcreateServer\s*\(/u,
      /\.listen\s*\(/u,
      /\bnew\s+WebSocket\b/u,
      /\bEventSource\s*\(/u,
      /\bctx\.(?:db|runQuery|runMutation|scheduler|auth)\b/u,
      /\b(?:query|mutation|internalQuery|internalMutation|internalAction|action)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:openai|langchain|tokenEndpoint|refreshToken|revocationEndpoint|oauth\/callback)\b/iu,
    ] as const;

    for (const source of sourceFiles()) {
      for (const specifier of importSpecifiers(source)) {
        expect(allowedImports.has(specifier) || !forbiddenImportSpecifier.test(specifier)).toBe(true);
      }
      const executableSource = stripStringAndPatternLiterals(source);
      for (const pattern of forbiddenCallPatterns) {
        expect(executableSource).not.toMatch(pattern);
      }
    }

    const implementation = readFileSync(SUMMARY_SOURCE_FILE, "utf8");
    const executableImplementation = stripStringAndPatternLiterals(implementation);
    const functionStart = executableImplementation.indexOf(
      "export function projectMcpRealEvidenceGraphSummary",
    );
    const parseCall = executableImplementation.indexOf("parseSummaryInput(input)", functionStart);
    const preParseSource = executableImplementation.slice(functionStart, parseCall);

    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(parseCall).toBeGreaterThan(functionStart);
    expect(executableImplementation).toContain("function parseSummaryInput(value: unknown)");
    expect(executableImplementation).toContain("Object.getOwnPropertyDescriptors");
    expect(executableImplementation).toContain("Reflect.ownKeys");
    expect(preParseSource).not.toMatch(
      /\binput\.(?:kind|adapterResult|evidenceGraphSummary|version)\b/u,
    );
  });
});
