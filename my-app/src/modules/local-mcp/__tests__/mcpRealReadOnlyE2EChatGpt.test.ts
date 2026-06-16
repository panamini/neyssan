import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpRealReadOnlyE2EChatGptSafeRefusal,
  runMcpRealReadOnlyE2EChatGptHarness,
  type McpRealReadOnlyE2EChatGptToolNameV1,
} from "../mcpRealReadOnlyE2EChatGptHarness";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const HARNESS_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpRealReadOnlyE2EChatGptHarness.ts",
);
const NOW = new Date("2026-06-15T12:00:00.000Z");

const ALL_SCOPES = [
  "twoweeks.mcp.read",
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const;

const AUTH_ALLOWED = {
  kind: "mcp_production_stytch_oauth_config_boundary_result",
  allowed: true,
  reason: "authorized_server_only",
  serverOnly: {
    provider: "stytch",
    authState: "verified_access_token",
    clientCategory: "approved_ai_client",
    resourceCategory: "twoweeks_mcp_resource",
    grantedReadScopes: ALL_SCOPES,
    requiredReadScopes: ["twoweeks.mcp.read"],
    subjectBinding: "verified_stytch_subject_server_only_not_returned",
    offlineAccessStoresRefreshTokens: false,
    version: 1,
  },
  capabilities: {
    authDecision: "server_only",
    provider: "stytch",
    tokenVerification: "local_jwt_only",
    signingAlgorithm: "RS256_only",
    jwks: "server_provided_only",
    remoteJwks: "blocked",
    tokenIntrospection: "blocked",
    tokenStorage: "none",
    refreshTokenStorage: "none",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    version: 1,
  },
  modelVisible: false,
  version: 1,
} as const;

const AUTH_DENIED = {
  ...AUTH_ALLOWED,
  allowed: false,
  reason: "missing_bearer_token",
  safeRefusal: {
    code: "production_stytch_oauth_boundary_blocked",
    message: "Authorization required.",
    safeForModel: true,
    tokenEchoed: false,
    rawClaimsExposed: false,
    stytchSubjectExposed: false,
    version: 1,
  },
  capabilities: {
    ...AUTH_ALLOWED.capabilities,
    authDecision: "blocked",
  },
  modelVisible: false,
  version: 1,
} as const;

const ACCOUNT_LINK_ALLOWED = {
  kind: "mcp_production_account_link_persistence_result",
  allowed: true,
  reason: "verified_server_only",
  serverOnly: {
    provider: "stytch",
    linkState: "active",
    ownerBinding: "twoweeks_owner_resolved_server_only_not_returned",
    clientCategory: "approved_ai_client",
    grantedReadScopes: ALL_SCOPES,
    requiredReadScopes: ["twoweeks.mcp.read"],
    grantState: "grant_and_consent_refs_present",
    auditReasonCode: "account_link_verified",
    version: 1,
  },
  capabilities: {
    accountLinkPersistence: "server_only",
    provider: "stytch",
    modelVisibility: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    writeActions: "blocked",
    version: 1,
  },
  modelVisible: false,
  version: 1,
} as const;

const ACCOUNT_LINK_RESOLUTION = {
  kind: "mcp_account_link_server_only_owner_resolution",
  provider: "stytch",
  twoweeksClerkId: "clerk_DO_NOT_ECHO",
  grantedReadScopes: ALL_SCOPES,
  grantRef: "grant-ref-1",
  consentRef: "consent-ref-1",
  auditReasonCode: "account_link_verified",
  version: 1,
} as const;

const CONSENT = {
  kind: "local_mcp_consent_grant",
  granted: true,
  purposes: ["future_real_data_read"],
  grantedBy: "boundary-operator",
  grantedAt: "2026-06-15T11:00:00.000Z",
  expiresAt: "2099-06-15T11:00:00.000Z",
  reason: "read-only MCP data refs",
  version: 1,
} as const;

const RETENTION_RECORD = {
  kind: "local_mcp_retention_deletion_record",
  recordRef: "fixture-retention:mcp-read-only-data-refs",
  recordType: "future_audit",
  policyState: "retain_until",
  createdAt: "2026-06-15T11:00:00.000Z",
  retainUntil: "2099-06-15T11:00:00.000Z",
  version: 1,
} as const;

const TOOL_CASES = [
  {
    toolName: "twoweeks.application_package.summarize",
    argumentName: "applicationPackageRef",
    argumentValue: "mcp-safe-ref:application-package:latest",
    expectedSummaryKind: "mcp_real_application_package_summary_result",
  },
  {
    toolName: "twoweeks.evidence_graph.summarize",
    argumentName: "evidenceGraphRef",
    argumentValue: "mcp-safe-ref:evidence-graph:profile",
    expectedSummaryKind: "mcp_real_evidence_graph_summary_result",
  },
  {
    toolName: "twoweeks.resume_variant_plan.summarize",
    argumentName: "resumeVariantPlanRef",
    argumentValue: "mcp-safe-ref:resume-variant-plan:latest",
    expectedSummaryKind: "mcp_real_resume_variant_plan_summary_result",
  },
  {
    toolName: "twoweeks.review_cockpit.summarize",
    argumentName: "reviewCockpitRef",
    argumentValue: "mcp-safe-ref:review-cockpit:latest",
    expectedSummaryKind: "mcp_real_review_cockpit_summary_result",
  },
] as const;

function dataRefs(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_read_only_twoweeks_data_refs_result",
    ownerState: "resolved",
    refs: [
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "applicationPackageRef",
        refId: "mcp-safe-ref:application-package:latest",
        label: "Application package availability",
        status: "available",
        category: "application_package",
        count: 2,
        updatedAt: "2026-06-15T11:30:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "evidenceGraphRef",
        refId: "mcp-safe-ref:evidence-graph:profile",
        label: "Candidate evidence availability",
        status: "available",
        category: "evidence_graph",
        count: 3,
        updatedAt: "2026-06-15T11:20:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "resumeVariantPlanRef",
        refId: "mcp-safe-ref:resume-variant-plan:latest",
        label: "Resume variant plan availability",
        status: "available",
        category: "resume_variant_plan",
        count: 1,
        updatedAt: "2026-06-15T11:10:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "reviewCockpitRef",
        refId: "mcp-safe-ref:review-cockpit:latest",
        label: "Review cockpit availability",
        status: "available",
        category: "review_cockpit",
        count: 4,
        updatedAt: "2026-06-15T11:40:00.000Z",
        version: 1,
      },
    ],
    blockedRefClasses: [],
    capabilities: {
      ownerResolvedServerOnly: true,
      dataReads: "convex_read_only_refs",
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

function applicationPackageSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_application_package_summary_result",
    allowed: true,
    status: "available",
    packageRef: {
      id: "mcp-safe-ref:application-package:latest",
      label: "Application package availability",
      status: "available",
      category: "application_package",
      count: 2,
      updatedAt: "2026-06-15T11:30:00.000Z",
      version: 1,
    },
    availability: {
      source: "convex_application_package_summary",
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
    updatedAt: "2026-06-15T11:59:59.750Z",
    capabilities: summaryCapabilities("convex_application_package_summary"),
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function evidenceGraphSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_evidence_graph_summary_result",
    allowed: true,
    status: "available",
    evidenceGraphRef: {
      id: "mcp-safe-ref:evidence-graph:profile",
      label: "Candidate evidence availability",
      status: "available",
      category: "evidence_graph",
      count: 3,
      updatedAt: "2026-06-15T11:20:00.000Z",
      version: 1,
    },
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
    capabilities: summaryCapabilities("convex_evidence_graph_summary"),
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function resumeVariantPlanSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_resume_variant_plan_summary_result",
    allowed: true,
    status: "available",
    resumeVariantPlanRef: {
      id: "mcp-safe-ref:resume-variant-plan:latest",
      label: "Resume variant plan availability",
      status: "available",
      category: "resume_variant_plan",
      count: 1,
      updatedAt: "2026-06-15T11:10:00.000Z",
      version: 1,
    },
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
    capabilities: summaryCapabilities("convex_resume_variant_plan_summary"),
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function reviewCockpitSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_review_cockpit_summary_result",
    allowed: true,
    status: "available",
    reviewCockpitRef: {
      id: "mcp-safe-ref:review-cockpit:latest",
      label: "Review cockpit availability",
      status: "available",
      category: "review_cockpit",
      count: 4,
      updatedAt: "2026-06-15T11:40:00.000Z",
      version: 1,
    },
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
    capabilities: summaryCapabilities("convex_review_cockpit_summary"),
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function summaryCapabilities(dataReads: string) {
  return {
    ownerResolution: "server_only",
    dataReads,
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    rawDataProjection: "blocked",
    version: 1,
  };
}

function summaries(overrides: Record<string, unknown> = {}) {
  return {
    applicationPackageSummary: applicationPackageSummary(),
    evidenceGraphSummary: evidenceGraphSummary(),
    resumeVariantPlanSummary: resumeVariantPlanSummary(),
    reviewCockpitSummary: reviewCockpitSummary(),
    ...overrides,
  };
}

function request(
  toolName: McpRealReadOnlyE2EChatGptToolNameV1,
  args: Readonly<Record<string, unknown>>,
) {
  return {
    kind: "mcp_real_read_only_e2e_chatgpt_request",
    toolName,
    arguments: args,
    version: 1,
  };
}

function harnessInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_real_read_only_e2e_chatgpt_harness_input",
    request: request("twoweeks.application_package.summarize", {
      applicationPackageRef: "mcp-safe-ref:application-package:latest",
    }),
    authBoundary: AUTH_ALLOWED,
    accountLinkBoundary: ACCOUNT_LINK_ALLOWED,
    accountLinkResolution: ACCOUNT_LINK_RESOLUTION,
    consent: CONSENT,
    retentionRecord: RETENTION_RECORD,
    readOnlyDataRefs: dataRefs(),
    summaries: summaries(),
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function assertSafeHarnessOutput(value: unknown): void {
  assertLocalMcpPrivacySafeOutput(value);
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("clerk_DO_NOT_ECHO");
  expect(serialized).not.toContain("RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE");
  expect(serialized).not.toContain("PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE");
  expect(serialized).not.toContain("SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE");
  expect(serialized).not.toContain("SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE");
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/u);
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/`(?:\\.|[^`\\])*`/gmu, '""')
    .replace(/"(?:\\.|[^"\\])*"/gmu, '""')
    .replace(/'(?:\\.|[^'\\])*'/gmu, '""')
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u");
}

describe("PR64 real read-only E2E ChatGPT harness", () => {
  it.each(TOOL_CASES)(
    "projects $toolName through auth, account-link, consent, read-only refs, safe summary, and audit",
    ({ toolName, argumentName, argumentValue, expectedSummaryKind }) => {
      const result = runMcpRealReadOnlyE2EChatGptHarness(
        harnessInput({
          request: request(toolName, { [argumentName]: argumentValue }),
        }),
      );

      expect(result.allowed).toBe(true);
      if (!result.allowed)
        throw new Error("expected allowed PR64 harness result");
      expect(result.reason).toBe("safe_summary_projected");
      expect(result.toolName).toBe(toolName);
      expect(result.summary).toEqual(
        expect.objectContaining({
          kind: expectedSummaryKind,
          allowed: true,
          modelVisible: true,
        }),
      );
      expect(result.adapterAudit).toEqual(
        expect.objectContaining({
          checked: true,
          persisted: false,
          rawPayloadLogged: false,
        }),
      );
      expect(result.auditLog).toHaveLength(1);
      expect(result.auditLog[0]).toEqual(
        expect.objectContaining({
          eventType: "consent_boundary_checked",
          outcome: "boundary_only",
          toolName,
          persisted: false,
          fixtureOnly: true,
        }),
      );
      expect(result.auditLog[0].capabilities).toEqual(
        expect.objectContaining({
          consent: "boundary_only",
          handlerExecution: "blocked",
          dataAccess: "blocked",
          writeAction: "blocked",
          persistence: "none",
          productionConnector: "blocked",
        }),
      );
      expect(result.capabilities).toEqual(
        expect.objectContaining({
          auth: "production_stytch_verified",
          accountLink: "server_only_owner_resolved",
          consent: "future_real_data_read",
          dataReads: "convex_read_only_refs_and_safe_summaries",
          dataWrites: "blocked",
          handlerExecution: "blocked",
          productionConnector: "blocked",
          networkAccess: "blocked",
          modelCalls: "blocked",
          writeActions: "blocked",
          rawDataProjection: "blocked",
          credentialStorage: "none",
          tokenStorage: "none",
        }),
      );
      expect(result.modelVisible).toBe(true);
      assertSafeHarnessOutput(result);
    },
  );

  it("blocks auth before returning a model-visible summary", () => {
    const result = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        authBoundary: AUTH_DENIED,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "auth_required",
        modelVisible: true,
      }),
    );
    if (result.allowed) throw new Error("expected blocked PR64 harness result");
    expect(result.summary).toBeUndefined();
    expect(result.safeRefusal).toEqual(
      buildMcpRealReadOnlyE2EChatGptSafeRefusal(),
    );
    expect(result.safeRefusal).toEqual(
      expect.objectContaining({
        code: "real_read_only_e2e_chatgpt_harness_blocked",
        rawDataExposed: false,
        credentialsExposed: false,
        writeActionExecuted: false,
      }),
    );
    expect(result.auditLog[0]).toEqual(
      expect.objectContaining({
        eventType: "auth_boundary_refused",
        outcome: "refused",
        persisted: false,
        fixtureOnly: true,
      }),
    );
    assertSafeHarnessOutput(result);
  });

  it.each([
    [
      "inactive account link",
      {
        accountLinkBoundary: {
          ...ACCOUNT_LINK_ALLOWED,
          allowed: false,
          reason: "missing_account_link",
        },
      },
    ],
    [
      "missing account-link owner resolution",
      {
        accountLinkResolution: {
          kind: "mcp_account_link_server_only_owner_resolution_malformed",
          version: 1,
        },
      },
    ],
  ])(
    "blocks %s before returning a model-visible summary",
    (_caseName, overrides) => {
      const result = runMcpRealReadOnlyE2EChatGptHarness(
        harnessInput(overrides),
      );

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
          reason: "account_link_required",
          modelVisible: true,
        }),
      );
      if (result.allowed)
        throw new Error("expected account-link failure to be blocked");
      expect(result.summary).toBeUndefined();
      assertSafeHarnessOutput(result);
    },
  );

  it.each([
    ["missing consent", { consent: undefined }],
    [
      "denied consent",
      {
        consent: {
          ...CONSENT,
          granted: false,
          reason: "denied by fixture",
        },
      },
    ],
    [
      "stale consent",
      {
        consent: {
          ...CONSENT,
          expiresAt: "2026-06-15T11:30:00.000Z",
        },
      },
    ],
  ])(
    "blocks %s before returning a model-visible summary",
    (_caseName, overrides) => {
      const result = runMcpRealReadOnlyE2EChatGptHarness(
        harnessInput(overrides),
      );

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
          reason: "consent_required",
          modelVisible: true,
        }),
      );
      if (result.allowed)
        throw new Error("expected consent failure to be blocked");
      expect(result.summary).toBeUndefined();
      assertSafeHarnessOutput(result);
    },
  );

  it("rejects unknown tools before adapter or summary projection", () => {
    const result = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        request: {
          kind: "mcp_real_read_only_e2e_chatgpt_request",
          toolName: "twoweeks.unknown.summarize",
          arguments: {
            unknownRef: "mcp-safe-ref:unknown",
          },
          version: 1,
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "invalid_input",
        modelVisible: true,
      }),
    );
    if (result.allowed) throw new Error("expected unknown tool to be blocked");
    expect(result.capabilities).toEqual(
      expect.objectContaining({
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
      }),
    );
    assertSafeHarnessOutput(result);
  });

  it("rejects non-finite Date inputs without throwing", () => {
    const result = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        now: new Date(Number.NaN),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "invalid_input",
        modelVisible: true,
      }),
    );
    if (result.allowed)
      throw new Error("expected malformed Date input to be blocked");
    expect(result.auditLog[0]).toEqual(
      expect.objectContaining({
        eventType: "tool_call_refused",
        outcome: "invalid",
        persisted: false,
      }),
    );
    assertSafeHarnessOutput(result);
  });

  it("returns safe refusals when audit raw payloads are not safely inspectable", () => {
    const hostileRawInput = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile raw input");
        },
      },
    );
    const rawInputResult = runMcpRealReadOnlyE2EChatGptHarness(hostileRawInput);

    expect(rawInputResult).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "invalid_input",
        modelVisible: true,
      }),
    );
    if (rawInputResult.allowed)
      throw new Error("expected hostile raw input to be blocked");
    expect(
      rawInputResult.auditLog[0].redactions.map(
        (redaction) => redaction.category,
      ),
    ).toContain("unknown_payload");
    assertSafeHarnessOutput(rawInputResult);

    const hostileSummary = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile summary");
        },
      },
    );
    const summaryResult = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        summaries: summaries({
          evidenceGraphSummary: hostileSummary,
        }),
        request: request("twoweeks.evidence_graph.summarize", {
          evidenceGraphRef: "mcp-safe-ref:evidence-graph:profile",
        }),
      }),
    );

    expect(summaryResult).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "summary_blocked",
        modelVisible: true,
      }),
    );
    if (summaryResult.allowed)
      throw new Error("expected hostile summary to be blocked");
    expect(
      summaryResult.auditLog[0].redactions.map(
        (redaction) => redaction.category,
      ),
    ).toContain("unknown_payload");
    assertSafeHarnessOutput(summaryResult);
  });

  it("blocks malformed ChatGPT-style arguments and keeps raw request material out of audit output", () => {
    const result = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        request: request("twoweeks.evidence_graph.summarize", {
          evidenceGraphRef: "mcp-safe-ref:evidence-graph:profile",
          rawArguments: "RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE",
          sourceText: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
          privateFact: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
          authorization: "Bearer SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
        }),
      }),
    );

    expect(result.allowed).toBe(false);
    if (result.allowed)
      throw new Error("expected unsafe request to be blocked");
    expect(result.reason).toBe("unsafe_request_arguments");
    expect(result.auditLog[0]).toEqual(
      expect.objectContaining({
        eventType: "tool_call_refused",
        outcome: "blocked",
        persisted: false,
      }),
    );
    expect(
      result.auditLog[0].redactions.map((redaction) => redaction.category),
    ).toEqual(
      expect.arrayContaining(["credential", "restricted_fact", "source_text"]),
    );
    assertSafeHarnessOutput(result);
  });

  it.each(["apply", "download", "export", "send", "submit", "write"] as const)(
    "refuses %s-like requests before adapter or summary projection",
    (writeAction) => {
      const result = runMcpRealReadOnlyE2EChatGptHarness(
        harnessInput({
          request: request("twoweeks.application_package.summarize", {
            applicationPackageRef: "mcp-safe-ref:application-package:latest",
            action: writeAction,
          }),
        }),
      );

      expect(result.allowed).toBe(false);
      if (result.allowed)
        throw new Error("expected write-like request to be blocked");
      expect(result.reason).toBe("write_action_refused");
      expect(result.capabilities).toEqual(
        expect.objectContaining({
          dataReads: "blocked",
          dataWrites: "blocked",
          writeActions: "blocked",
          handlerExecution: "blocked",
          productionConnector: "blocked",
        }),
      );
      expect(result.auditLog[0]).toEqual(
        expect.objectContaining({
          eventType: "write_action_refused",
          outcome: "refused",
        }),
      );
      assertSafeHarnessOutput(result);
    },
  );

  it("blocks unsafe real summary payloads instead of exposing raw source material", () => {
    const result = runMcpRealReadOnlyE2EChatGptHarness(
      harnessInput({
        summaries: summaries({
          evidenceGraphSummary: evidenceGraphSummary({
            sourceText: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
          }),
        }),
        request: request("twoweeks.evidence_graph.summarize", {
          evidenceGraphRef: "mcp-safe-ref:evidence-graph:profile",
        }),
      }),
    );

    expect(result.allowed).toBe(false);
    if (result.allowed)
      throw new Error("expected unsafe summary to be blocked");
    expect(result.reason).toBe("summary_blocked");
    expect(result.auditLog[0]).toEqual(
      expect.objectContaining({
        eventType: "tool_call_refused",
        outcome: "blocked",
        persisted: false,
      }),
    );
    expect(result.auditLog[0].capabilities).toEqual(
      expect.objectContaining({
        consent: "boundary_only",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        persistence: "none",
        productionConnector: "blocked",
      }),
    );
    expect(
      result.auditLog[0].redactions.map((redaction) => redaction.category),
    ).toContain("source_text");
    assertSafeHarnessOutput(result);
  });

  it("keeps the PR64 harness disconnected from runtime, network, UI, and write surfaces", () => {
    const source = stripStringAndPatternLiterals(
      readFileSync(HARNESS_SOURCE_FILE, "utf8"),
    );

    expect(source).not.toMatch(
      /@modelcontextprotocol|express|hono|fastify|react|iframe|widget/u,
    );
    expect(source).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/u,
    );
    expect(source).not.toMatch(
      /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
    );
    expect(source).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/u);
    expect(source).not.toMatch(
      /\b(writeFile|appendFile|createWriteStream|rm|unlink)\s*\(/u,
    );
  });
});
