// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildMcpProductionReadonlySummaryStatusMcpResult,
  MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND,
  type McpProductionReadonlySummaryStatusV1,
} from "../mcpProductionReadonlySummaryStatusNormalizer";
import {
  MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
  type McpProductionReadonlySummaryExecutionFailureCodeV1,
  type McpProductionReadonlySummaryExecutionResultV1,
} from "../mcpProductionReadonlySummaryExecutor";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const FRESH_UPDATED_AT = "2026-06-30T12:00:00.000Z";
const OLD_UPDATED_AT = "2026-06-01T12:00:00.000Z";
const OWNER_ID = "user_twoweeks_fixture_123";

const STRICT_STATUSES: readonly McpProductionReadonlySummaryStatusV1[] = Object.freeze([
  "OK",
  "STALE",
  "NO_DATA",
  "ONBOARDING_REQUIRED",
  "MALFORMED",
  "TIMEOUT",
  "DEPENDENCY_MISSING",
]);

const TOOL_CASES = Object.freeze([
  {
    toolName: "twoweeks.application_package.summarize",
    expectedKind: "mcp_application_package_summary_result",
    resultRefKey: "packageRef",
    safeRefId: "mcp-safe-ref:application-package:latest",
    category: "application_package",
    dataReads: "convex_application_package_summary",
    missingDataReason: "application_package_not_available",
  },
  {
    toolName: "twoweeks.evidence_graph.summarize",
    expectedKind: "mcp_evidence_graph_summary_result",
    resultRefKey: "evidenceGraphRef",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    category: "evidence_graph",
    dataReads: "convex_evidence_graph_summary",
    missingDataReason: "evidence_graph_not_available",
  },
  {
    toolName: "twoweeks.resume_variant_plan.summarize",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    resultRefKey: "resumeVariantPlanRef",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    category: "resume_variant_plan",
    dataReads: "convex_resume_variant_plan_summary",
    missingDataReason: "resume_variant_plan_not_available",
  },
  {
    toolName: "twoweeks.review_cockpit.summarize",
    expectedKind: "mcp_review_cockpit_summary_result",
    resultRefKey: "reviewCockpitRef",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
    category: "review_cockpit",
    dataReads: "convex_review_cockpit_summary",
    missingDataReason: "review_cockpit_not_available",
  },
] as const);

describe("MCP production read-only summary status normalizer", () => {
  it.each(TOOL_CASES)("wraps a fresh available $toolName summary as OK", (toolCase) => {
    const result = normalize(toolCase, safeExecutionResult(toolCase, { updatedAt: FRESH_UPDATED_AT }));

    expect(result).toMatchObject({
      content: [{ type: "text", text: "Read-only summary status: OK." }],
      structuredContent: {
        kind: MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND,
        status: "OK",
        toolName: toolCase.toolName,
        summary: {
          kind: toolCase.expectedKind,
          status: "available",
          updatedAt: FRESH_UPDATED_AT,
          [toolCase.resultRefKey]: {
            id: toolCase.safeRefId,
            updatedAt: FRESH_UPDATED_AT,
          },
        },
        version: 1,
      },
    });
  });

  it("marks old available summaries as STALE", () => {
    const toolCase = TOOL_CASES[0];
    const result = normalize(toolCase, safeExecutionResult(toolCase, { updatedAt: OLD_UPDATED_AT }));

    expect(result.structuredContent.status).toBe("STALE");
    expect(result.structuredContent.summary).toMatchObject({ updatedAt: OLD_UPDATED_AT });
  });

  it("marks otherwise safe summaries without a safe timestamp as STALE", () => {
    const toolCase = TOOL_CASES[0];
    const result = normalize(toolCase, safeExecutionResult(toolCase));

    expect(result.structuredContent.status).toBe("STALE");
    expect(result.structuredContent.summary).toMatchObject({ status: "available" });
  });

  it("maps safe no-data and onboarding states to explicit statuses", () => {
    const noData = normalize(TOOL_CASES[0], safeExecutionResult(TOOL_CASES[0], { status: "no_data_available" }));
    const onboarding = normalize(TOOL_CASES[1], safeExecutionResult(TOOL_CASES[1], { status: "onboarding_required" }));

    expect(noData.structuredContent.status).toBe("NO_DATA");
    expect(noData.structuredContent.summary).toMatchObject({ status: "no_data_available" });
    expect(onboarding.structuredContent.status).toBe("ONBOARDING_REQUIRED");
    expect(onboarding.structuredContent.summary).toMatchObject({ status: "onboarding_required" });
  });

  it.each([
    ["wrong kind", { kind: "mcp_production_tools_call_readonly_synthetic_result" }],
    ["unknown shape", { allowed: true, status: "available" }],
    ["unsafe PR106 status", { status: "ready_but_unknown" }],
    ["owner echo", { safeCategories: { owner: OWNER_ID, version: 1 } }],
    ["provider metadata", { safeCategories: { provider: "https://provider.example.test", version: 1 } }],
  ] as const)("maps malformed output safely: %s", (_label, patch) => {
    const toolCase = TOOL_CASES[0];
    const result = normalize(
      toolCase,
      safeExecutionResult(toolCase, patch),
      { forbiddenSubstrings: [OWNER_ID] },
    );

    expect(result.structuredContent).toEqual({
      kind: MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND,
      status: "MALFORMED",
      toolName: toolCase.toolName,
      version: 1,
    });
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
    expect(JSON.stringify(result)).not.toContain("provider.example.test");
  });

  it("maps missing dependency, timeout, and executor query failures without leaking internals", () => {
    const toolCase = TOOL_CASES[0];
    const missing = buildMcpProductionReadonlySummaryStatusMcpResult({
      toolName: toolCase.toolName,
      failure: "dependency_missing",
      nowEpochMs: NOW,
      version: 1,
    });
    const timeout = buildMcpProductionReadonlySummaryStatusMcpResult({
      toolName: toolCase.toolName,
      failure: "timeout",
      nowEpochMs: NOW,
      version: 1,
    });
    const queryFailed = normalize(toolCase, failureResult("query_failed"));

    expect(missing.structuredContent.status).toBe("DEPENDENCY_MISSING");
    expect(timeout.structuredContent.status).toBe("TIMEOUT");
    expect(queryFailed.structuredContent.status).toBe("MALFORMED");
    expect(JSON.stringify({ missing, timeout, queryFailed })).not.toContain("stack");
    expect(JSON.stringify({ missing, timeout, queryFailed })).not.toContain("storage unavailable");
    expect(missing.structuredContent).not.toHaveProperty("summary");
    expect(timeout.structuredContent).not.toHaveProperty("summary");
    expect(queryFailed.structuredContent).not.toHaveProperty("summary");
  });

  it("does not mutate the raw PR106 executor output before PR107 wrapping", () => {
    const toolCase = TOOL_CASES[0];
    const executionResult = safeExecutionResult(toolCase, { updatedAt: FRESH_UPDATED_AT });
    const before = JSON.stringify(executionResult);

    const result = normalize(toolCase, executionResult);

    expect(JSON.stringify(executionResult)).toBe(before);
    expect(result.structuredContent.summary).toEqual(executionResult.structuredContent);
  });

  it("never emits a status outside the strict PR107 enum", () => {
    const toolCase = TOOL_CASES[0];
    const outcomes = [
      normalize(toolCase, safeExecutionResult(toolCase, { updatedAt: FRESH_UPDATED_AT })),
      normalize(toolCase, safeExecutionResult(toolCase, { updatedAt: OLD_UPDATED_AT })),
      normalize(toolCase, safeExecutionResult(toolCase)),
      normalize(toolCase, safeExecutionResult(toolCase, { status: "no_data_available" })),
      normalize(toolCase, safeExecutionResult(toolCase, { status: "onboarding_required" })),
      normalize(toolCase, safeExecutionResult(toolCase, { status: "unknown" })),
      buildMcpProductionReadonlySummaryStatusMcpResult({
        toolName: toolCase.toolName,
        failure: "timeout",
        nowEpochMs: NOW,
        version: 1,
      }),
      buildMcpProductionReadonlySummaryStatusMcpResult({
        toolName: toolCase.toolName,
        failure: "dependency_missing",
        nowEpochMs: NOW,
        version: 1,
      }),
    ];

    expect(outcomes.map((outcome) => outcome.structuredContent.status).every((status) =>
      STRICT_STATUSES.includes(status)
    )).toBe(true);
  });
});

function normalize(
  toolCase: typeof TOOL_CASES[number],
  executionResult: McpProductionReadonlySummaryExecutionResultV1,
  options: Readonly<{ forbiddenSubstrings?: readonly string[] }> = {},
) {
  return buildMcpProductionReadonlySummaryStatusMcpResult({
    toolName: toolCase.toolName,
    executionResult,
    nowEpochMs: NOW,
    forbiddenSubstrings: options.forbiddenSubstrings,
    version: 1,
  });
}

function safeExecutionResult(
  toolCase: typeof TOOL_CASES[number],
  patch: Readonly<Record<string, unknown>> = {},
): McpProductionReadonlySummaryExecutionResultV1 {
  const status = typeof patch.status === "string" ? patch.status : "available";
  const updatedAt = typeof patch.updatedAt === "string" ? patch.updatedAt : undefined;
  const missingDataReason = status === "onboarding_required"
    ? "owner_onboarding_required"
    : status === "no_data_available"
      ? toolCase.missingDataReason
      : undefined;
  return Object.freeze({
    ok: true as const,
    content: Object.freeze([
      Object.freeze({ type: "text" as const, text: "Read-only summary returned." }),
    ]),
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
      safeCounts: Object.freeze({ version: 1 }),
      safeCategories: Object.freeze({ version: 1 }),
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
      ...patch,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}

function failureResult(
  code: McpProductionReadonlySummaryExecutionFailureCodeV1,
): McpProductionReadonlySummaryExecutionResultV1 {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({
      code,
      message: MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
      safeForModel: true as const,
      rawArgumentsEchoed: false as const,
      ownerIdentityEchoed: false as const,
      tokenMaterialEchoed: false as const,
      internalQueryRefEchoed: false as const,
      providerMetadataEchoed: false as const,
      stackTraceEchoed: false as const,
      version: 1 as const,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}
