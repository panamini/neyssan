// @vitest-environment node
import { describe, expect, it } from "vitest";
import type {
  McpProductionReadonlySummaryExecutionResultV1,
  McpProductionReadonlySummaryToolNameV1,
} from "../mcpProductionReadonlySummaryExecutor";
import {
  buildMcpProductionReadonlySummaryMcpResultV2,
  buildMcpProductionReadonlySummaryOutputSchemaV2,
  MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
  type McpProductionReadonlySummaryJsonSchemaV2,
} from "../mcpProductionReadonlySummaryProjectorV2";

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const FRESH_UPDATED_AT = "2026-07-14T12:00:00.000Z";
const OLD_UPDATED_AT = "2026-06-01T12:00:00.000Z";
const SENSITIVE_SENTINEL = "private-user-data-sentinel";

type ToolCase = Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  expectedKind: string;
  resultRefKey: string;
  safeRefId: string;
  category: string;
  dataReads: string;
  missingDataReason: string;
  safeCounts: Readonly<Record<string, unknown>>;
  safeCategories: Readonly<Record<string, unknown>>;
  safeFlags?: Readonly<Record<string, unknown>>;
  expectedData: Readonly<Record<string, unknown>>;
  expectedOkAction: string;
  expectedNoDataAction: string;
  expectedStaleAction: string;
}>;

const TOOL_CASES: readonly ToolCase[] = Object.freeze([
  Object.freeze({
    toolName: "twoweeks.application_package.summarize",
    expectedKind: "mcp_application_package_summary_result",
    resultRefKey: "packageRef",
    safeRefId: "mcp-safe-ref:application-package:latest",
    category: "application_package",
    dataReads: "convex_application_package_summary",
    missingDataReason: "application_package_not_available",
    safeCounts: Object.freeze({
      packages: 1,
      artifacts: 2,
      provenanceLinks: 3,
      reviewItems: 0,
      warnings: 0,
      blockers: 0,
      version: 1,
    }),
    safeCategories: Object.freeze({
      packageStatus: "ready_for_review",
      resumeVariantArtifactStatus: "ready",
      coverLetterArtifactStatus: "ready",
      version: 1,
    }),
    expectedData: Object.freeze({
      packageStatus: "ready_for_review",
      artifactCount: 2,
      reviewItemCount: 0,
      warningCount: 0,
      blockerCount: 0,
    }),
    expectedOkAction: "ready_for_review",
    expectedNoDataAction: "create_application_package",
    expectedStaleAction: "refresh_inputs",
  }),
  Object.freeze({
    toolName: "twoweeks.evidence_graph.summarize",
    expectedKind: "mcp_evidence_graph_summary_result",
    resultRefKey: "evidenceGraphRef",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    category: "evidence_graph",
    dataReads: "convex_evidence_graph_summary",
    missingDataReason: "evidence_graph_not_available",
    safeCounts: Object.freeze({
      sourceDocuments: 2,
      candidateFacts: 8,
      approvedFacts: 6,
      pendingFacts: 2,
      rejectedFacts: 0,
      restrictedEvidence: 0,
      archivedEvidence: 0,
      provenanceLinks: 6,
      evidenceMatches: 5,
      allowedClaims: 5,
      missingEvidence: 0,
      riskFlags: 0,
      staleSources: 0,
      warnings: 0,
      blockers: 0,
      version: 1,
    }),
    safeCategories: Object.freeze({
      evidenceCoverage: "complete",
      provenanceCoverage: "complete",
      qualityStatus: "ready_for_review",
      blockerCategory: "none",
      nextReviewHint: "ready_for_review",
      version: 1,
    }),
    expectedData: Object.freeze({
      evidenceCoverage: "complete",
      provenanceCoverage: "complete",
      qualityStatus: "ready_for_review",
      blockerCategory: "none",
      approvedFactCount: 6,
      missingEvidenceCount: 0,
      staleSourceCount: 0,
      blockerCount: 0,
    }),
    expectedOkAction: "ready_for_review",
    expectedNoDataAction: "add_candidate_evidence",
    expectedStaleAction: "refresh_stale_sources",
  }),
  Object.freeze({
    toolName: "twoweeks.resume_variant_plan.summarize",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    resultRefKey: "resumeVariantPlanRef",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    category: "resume_variant_plan",
    dataReads: "convex_resume_variant_plan_summary",
    missingDataReason: "resume_variant_plan_not_available",
    safeCounts: Object.freeze({
      plans: 1,
      planItems: 7,
      claimBackedItems: 7,
      missingInputItems: 0,
      reviewNeededItems: 0,
      acceptedItems: 7,
      rejectedItems: 0,
      blockedItems: 0,
      warnings: 0,
      blockers: 0,
      restrictedFactBlockers: 0,
      excludedFactBlockers: 0,
      artifactTextBlockers: 0,
      allowedClaims: 7,
      sourceFacts: 8,
      evidenceMatches: 7,
      demands: 5,
      riskFlags: 0,
      version: 1,
    }),
    safeCategories: Object.freeze({
      planStatus: "ready_for_review",
      targetDocumentKind: "resume",
      tailoringCompleteness: "complete",
      blockerCategory: "none",
      missingInputCategory: "none",
      reviewNeededCategory: "ready_for_review",
      nextReviewHint: "ready_for_review",
      version: 1,
    }),
    expectedData: Object.freeze({
      planStatus: "ready_for_review",
      targetDocumentKind: "resume",
      tailoringCompleteness: "complete",
      blockerCategory: "none",
      missingInputCategory: "none",
      planItemCount: 7,
      claimBackedItemCount: 7,
      reviewNeededItemCount: 0,
      blockerCount: 0,
    }),
    expectedOkAction: "ready_for_review",
    expectedNoDataAction: "create_resume_variant_plan",
    expectedStaleAction: "refresh_inputs",
  }),
  Object.freeze({
    toolName: "twoweeks.review_cockpit.summarize",
    expectedKind: "mcp_review_cockpit_summary_result",
    resultRefKey: "reviewCockpitRef",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
    category: "review_cockpit",
    dataReads: "convex_review_cockpit_summary",
    missingDataReason: "review_cockpit_not_available",
    safeCounts: Object.freeze({
      reviewContexts: 1,
      reviewRuns: 1,
      reviewArtifacts: 2,
      applicationPackages: 1,
      pendingReviews: 0,
      approvedReviews: 1,
      blockedReviews: 0,
      failedRuns: 0,
      blockedRuns: 0,
      blockedArtifacts: 0,
      blockedPackages: 0,
      missingReviewItems: 0,
      approvalNeeded: 0,
      staleInputs: 0,
      overLimitCollections: 0,
      version: 1,
    }),
    safeCategories: Object.freeze({
      reviewReadiness: "ready_for_review",
      reviewGateStatus: "ready",
      blockerCategory: "none",
      missingReviewCategory: "none",
      nextReviewHint: "ready_for_review",
      nextUserAction: "none",
      version: 1,
    }),
    safeFlags: Object.freeze({
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
      version: 1,
    }),
    expectedData: Object.freeze({
      reviewReadiness: "ready_for_review",
      reviewGateStatus: "ready",
      blockerCategory: "none",
      missingReviewCategory: "none",
      pendingReviewCount: 0,
      approvedReviewCount: 1,
      blockedReviewCount: 0,
      missingReviewItemCount: 0,
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
    }),
    expectedOkAction: "ready_for_review",
    expectedNoDataAction: "add_application_context",
    expectedStaleAction: "refresh_inputs",
  }),
]);

describe("MCP production read-only summary projector V2", () => {
  it.each(TOOL_CASES)("projects bounded, tool-correlated OK data for $toolName", (toolCase) => {
    const executionResult = safeExecutionResult(toolCase, { updatedAt: FRESH_UPDATED_AT });
    const before = JSON.stringify(executionResult);

    const result = project(toolCase, executionResult);

    expect(result).toEqual({
      content: [{ type: "text", text: "Read-only summary status: OK." }],
      structuredContent: {
        kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
        status: "OK",
        toolName: toolCase.toolName,
        freshness: "FRESH",
        data: toolCase.expectedData,
        nextActionCode: toolCase.expectedOkAction,
        version: 2,
      },
    });
    expect(matchesSchema(buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName), result.structuredContent)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.content)).toBe(true);
    expect(Object.isFrozen(result.structuredContent)).toBe(true);
    expect("data" in result.structuredContent && Object.isFrozen(result.structuredContent.data)).toBe(true);
    expect(JSON.stringify(executionResult)).toBe(before);
    expectPublicOnly(result);
  });

  it.each(TOOL_CASES)("uses exact STALE/UNKNOWN freshness and stale action for $toolName", (toolCase) => {
    const oldResult = project(toolCase, safeExecutionResult(toolCase, { updatedAt: OLD_UPDATED_AT }));
    const unknownResult = project(toolCase, safeExecutionResult(toolCase));

    expect(oldResult.structuredContent).toMatchObject({
      status: "STALE",
      freshness: "STALE",
      nextActionCode: toolCase.expectedStaleAction,
    });
    expect(unknownResult.structuredContent).toMatchObject({
      status: "STALE",
      freshness: "UNKNOWN",
      nextActionCode: toolCase.expectedStaleAction,
    });
    expect(matchesSchema(buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName), oldResult.structuredContent)).toBe(true);
    expect(matchesSchema(buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName), unknownResult.structuredContent)).toBe(true);
  });

  it.each(TOOL_CASES)("projects exact empty-state actions without optional payloads for $toolName", (toolCase) => {
    const noData = project(toolCase, safeExecutionResult(toolCase, { status: "no_data_available" }));
    const onboarding = project(toolCase, safeExecutionResult(toolCase, { status: "onboarding_required" }));

    expect(noData.structuredContent).toEqual({
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status: "NO_DATA",
      toolName: toolCase.toolName,
      nextActionCode: toolCase.expectedNoDataAction,
      version: 2,
    });
    expect(onboarding.structuredContent).toEqual({
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status: "ONBOARDING_REQUIRED",
      toolName: toolCase.toolName,
      nextActionCode: "complete_twoweeks_onboarding",
      version: 2,
    });
    for (const outcome of [noData, onboarding]) {
      expect(outcome.structuredContent).not.toHaveProperty("data");
      expect(outcome.structuredContent).not.toHaveProperty("freshness");
      expect(outcome.structuredContent).not.toHaveProperty("retryable");
      expect(matchesSchema(buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName), outcome.structuredContent)).toBe(true);
    }
  });

  it("projects exact retryability and never returns data for failure statuses", () => {
    const toolCase = TOOL_CASES[0];
    const timeout = projectFailure(toolCase, "timeout");
    const dependency = projectFailure(toolCase, "dependency_missing");
    const malformed = projectFailure(toolCase, "malformed");

    expect(timeout.structuredContent).toMatchObject({ status: "TIMEOUT", retryable: true, nextActionCode: "retry_request" });
    expect(dependency.structuredContent).toMatchObject({
      status: "DEPENDENCY_MISSING",
      retryable: true,
      nextActionCode: "try_again_later",
    });
    expect(malformed.structuredContent).toMatchObject({ status: "MALFORMED", retryable: false, nextActionCode: "contact_support" });
    for (const outcome of [timeout, dependency, malformed]) {
      expect(outcome.structuredContent).not.toHaveProperty("data");
      expect(outcome.structuredContent).not.toHaveProperty("freshness");
      expect(matchesSchema(buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName), outcome.structuredContent)).toBe(true);
    }
  });

  it.each([-1, 0.5, 101, "1"])("fails closed for an invalid bounded count: %s", (invalidCount) => {
    const toolCase = TOOL_CASES[0];
    const executionResult = safeExecutionResult(toolCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCounts: { ...toolCase.safeCounts, artifacts: invalidCount },
    });

    const result = project(toolCase, executionResult);

    expect(result.structuredContent).toEqual({
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status: "MALFORMED",
      toolName: toolCase.toolName,
      nextActionCode: "contact_support",
      retryable: false,
      version: 2,
    });
    expect(result.structuredContent).not.toHaveProperty("data");
  });

  it("fails closed for unknown internal keys, invalid enums, and sensitive sentinels", () => {
    const toolCase = TOOL_CASES[0];
    const unknownKey = project(toolCase, safeExecutionResult(toolCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCategories: { ...toolCase.safeCategories, unexpectedKey: "safe" },
    }));
    const invalidEnum = project(toolCase, safeExecutionResult(toolCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCategories: { ...toolCase.safeCategories, packageStatus: "unreviewed_new_state" },
    }));
    const invalidNestedVersion = project(toolCase, safeExecutionResult(toolCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCounts: { ...toolCase.safeCounts, version: 2 },
    }));
    const sentinel = buildMcpProductionReadonlySummaryMcpResultV2({
      toolName: toolCase.toolName,
      executionResult: safeExecutionResult(toolCase, {
        updatedAt: FRESH_UPDATED_AT,
        safeCategories: {
          ...toolCase.safeCategories,
          resumeVariantArtifactStatus: SENSITIVE_SENTINEL,
        },
      }),
      nowEpochMs: NOW,
      forbiddenSubstrings: [SENSITIVE_SENTINEL],
      version: 2,
    });

    for (const outcome of [unknownKey, invalidEnum, invalidNestedVersion, sentinel]) {
      expect(outcome.structuredContent).toMatchObject({
        status: "MALFORMED",
        nextActionCode: "contact_support",
        retryable: false,
      });
      expect(outcome.structuredContent).not.toHaveProperty("data");
      expect(JSON.stringify(outcome)).not.toContain(SENSITIVE_SENTINEL);
    }
  });

  it("uses the approved deterministic OK action precedence", () => {
    const applicationCase = TOOL_CASES[0];
    const evidenceCase = TOOL_CASES[1];
    const resumeCase = TOOL_CASES[2];
    const reviewCase = TOOL_CASES[3];
    const application = project(applicationCase, safeExecutionResult(applicationCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCounts: { ...applicationCase.safeCounts, blockers: 1, reviewItems: 4 },
      safeCategories: { ...applicationCase.safeCategories, packageStatus: "needs_review" },
    }));
    const evidence = project(evidenceCase, safeExecutionResult(evidenceCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCounts: { ...evidenceCase.safeCounts, missingEvidence: 2 },
      safeCategories: withoutKey(evidenceCase.safeCategories, "nextReviewHint"),
    }));
    const resume = project(resumeCase, safeExecutionResult(resumeCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCounts: { ...resumeCase.safeCounts, reviewNeededItems: 3 },
      safeCategories: {
        ...withoutKey(resumeCase.safeCategories, "nextReviewHint"),
        missingInputCategory: "none",
      },
    }));
    const review = project(reviewCase, safeExecutionResult(reviewCase, {
      updatedAt: FRESH_UPDATED_AT,
      safeCategories: {
        ...reviewCase.safeCategories,
        nextUserAction: "approve_review_gate",
        nextReviewHint: "review_blockers",
      },
    }));

    expect(application.structuredContent.nextActionCode).toBe("review_blockers");
    expect(evidence.structuredContent.nextActionCode).toBe("review_missing_evidence");
    expect(resume.structuredContent.nextActionCode).toBe("review_plan_items");
    expect(review.structuredContent.nextActionCode).toBe("approve_review_gate");
  });

  it.each(TOOL_CASES)("publishes seven closed branches correlated to $toolName", (toolCase) => {
    const schema = buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName);

    expect(schema.oneOf).toHaveLength(7);
    for (const branch of schema.oneOf ?? []) {
      expect(branch.additionalProperties).toBe(false);
      expect(branch.properties?.toolName?.const).toBe(toolCase.toolName);
    }
    const valid = project(toolCase, safeExecutionResult(toolCase, { updatedAt: FRESH_UPDATED_AT })).structuredContent;
    const wrongTool = { ...valid, toolName: differentToolName(toolCase.toolName) };
    const wrongData = { ...valid, data: { evidenceCoverage: "complete" } };
    const unknownRoot = { ...valid, unknownRoot: true };
    const unknownData = {
      ...valid,
      ...(valid.status === "OK" ? { data: { ...valid.data, unknownNested: true } } : {}),
    };

    expect(matchesSchema(schema, valid)).toBe(true);
    expect(matchesSchema(schema, wrongTool)).toBe(false);
    expect(matchesSchema(schema, wrongData)).toBe(false);
    expect(matchesSchema(schema, unknownRoot)).toBe(false);
    expect(matchesSchema(schema, unknownData)).toBe(false);
  });
});

function project(
  toolCase: ToolCase,
  executionResult: McpProductionReadonlySummaryExecutionResultV1,
) {
  return buildMcpProductionReadonlySummaryMcpResultV2({
    toolName: toolCase.toolName,
    executionResult,
    nowEpochMs: NOW,
    version: 2,
  });
}

function projectFailure(
  toolCase: ToolCase,
  failure: "dependency_missing" | "timeout" | "malformed",
) {
  return buildMcpProductionReadonlySummaryMcpResultV2({
    toolName: toolCase.toolName,
    failure,
    nowEpochMs: NOW,
    version: 2,
  });
}

function safeExecutionResult(
  toolCase: ToolCase,
  patch: Readonly<Record<string, unknown>> = {},
): McpProductionReadonlySummaryExecutionResultV1 {
  const status = typeof patch.status === "string" ? patch.status : "available";
  const updatedAt = typeof patch.updatedAt === "string" ? patch.updatedAt : undefined;
  const safeCounts = plainPatchRecord(patch.safeCounts) ?? toolCase.safeCounts;
  const safeCategories = plainPatchRecord(patch.safeCategories) ?? toolCase.safeCategories;
  const safeFlags = patch.safeFlags === undefined
    ? toolCase.safeFlags
    : plainPatchRecord(patch.safeFlags);
  const missingDataReason = status === "onboarding_required"
    ? "owner_onboarding_required"
    : status === "no_data_available"
      ? toolCase.missingDataReason
      : undefined;
  return Object.freeze({
    ok: true as const,
    content: Object.freeze([Object.freeze({ type: "text" as const, text: "Read-only summary returned." })]),
    structuredContent: Object.freeze({
      kind: toolCase.expectedKind,
      allowed: true,
      status,
      [toolCase.resultRefKey]: Object.freeze({
        id: toolCase.safeRefId,
        label: "Safe summary availability",
        status,
        category: toolCase.category,
        count: status === "available" ? 1 : 0,
        ...(updatedAt ? { updatedAt } : {}),
        version: 1,
      }),
      availability: Object.freeze({
        source: toolCase.dataReads,
        ownerState: status === "onboarding_required" ? "onboarding_required" : "resolved",
        version: 1,
      }),
      safeCounts: Object.freeze({ ...safeCounts }),
      safeCategories: Object.freeze({ ...safeCategories }),
      ...(safeFlags ? { safeFlags: Object.freeze({ ...safeFlags }) } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(missingDataReason ? { missingDataReason } : {}),
      capabilities: Object.freeze({
        ownerResolution: status === "onboarding_required" ? "blocked" : "server_only",
        dataReads: toolCase.dataReads,
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
        version: 1,
      }),
      modelVisible: true,
      version: 1,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}

function expectPublicOnly(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "safeCounts",
    "safeCategories",
    "safeFlags",
    "capabilities",
    "missingDataReason",
    "updatedAt",
    "mcp-safe-ref:",
    '"summary"',
    "https://",
    "access_token",
    "refresh_token",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

function matchesSchema(schema: McpProductionReadonlySummaryJsonSchemaV2, value: unknown): boolean {
  if (schema.oneOf) {
    return schema.oneOf.filter((branch) => matchesSchema(branch, value)).length === 1;
  }
  if (schema.const !== undefined && !Object.is(value, schema.const)) return false;
  if (schema.enum && (typeof value !== "string" || !schema.enum.includes(value))) return false;
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return false;
  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) return false;
    if (schema.minimum !== undefined && value < schema.minimum) return false;
    if (schema.maximum !== undefined && value > schema.maximum) return false;
  }
  if (schema.type === "array") {
    return Array.isArray(value) && (!schema.items || value.every((item) => matchesSchema(schema.items!, item)));
  }
  if (schema.type === "object") {
    if (!isPlainRecord(value)) return false;
    const properties = schema.properties ?? {};
    if (schema.required?.some((key) => !(key in value))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !(key in properties))) return false;
    return Object.entries(properties).every(([key, propertySchema]) =>
      !(key in value) || matchesSchema(propertySchema, value[key])
    );
  }
  return true;
}

function differentToolName(toolName: McpProductionReadonlySummaryToolNameV1): McpProductionReadonlySummaryToolNameV1 {
  return TOOL_CASES.find((toolCase) => toolCase.toolName !== toolName)?.toolName ?? TOOL_CASES[0].toolName;
}

function plainPatchRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isPlainRecord(value) ? value : undefined;
}

function withoutKey(
  value: Readonly<Record<string, unknown>>,
  keyToRemove: string,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== keyToRemove));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
