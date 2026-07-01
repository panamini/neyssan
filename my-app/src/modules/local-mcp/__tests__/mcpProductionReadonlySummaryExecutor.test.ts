// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { validateMcpProductionToolsCallBoundary } from "../mcpProductionToolsCallBoundary";
import {
  buildMcpProductionReadonlySummaryExecutionInput,
  buildMcpProductionReadonlySummaryExecutor,
  MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
  type McpProductionReadonlySummaryExecutionInputV1,
  type McpProductionReadonlySummaryQueryPortInputV1,
} from "../mcpProductionReadonlySummaryExecutor";

const OWNER_ID = "user_twoweeks_fixture_123";

const READONLY_SUMMARY_CASES = Object.freeze([
  {
    toolName: "twoweeks.application_package.summarize",
    query: "applicationPackageSummary",
    argumentKey: "applicationPackageRef",
    rawRefId: "raw-application-package-ref",
    expectedKind: "mcp_application_package_summary_result",
    resultRefKey: "packageRef",
    safeRefId: "mcp-safe-ref:application-package:latest",
    category: "application_package",
    label: "Application package availability",
    dataReads: "convex_application_package_summary",
  },
  {
    toolName: "twoweeks.evidence_graph.summarize",
    query: "evidenceGraphSummary",
    argumentKey: "evidenceGraphRef",
    rawRefId: "raw-evidence-graph-ref",
    expectedKind: "mcp_evidence_graph_summary_result",
    resultRefKey: "evidenceGraphRef",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    category: "evidence_graph",
    label: "Candidate evidence availability",
    dataReads: "convex_evidence_graph_summary",
  },
  {
    toolName: "twoweeks.resume_variant_plan.summarize",
    query: "resumeVariantPlanSummary",
    argumentKey: "resumeVariantPlanRef",
    rawRefId: "raw-resume-variant-plan-ref",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    resultRefKey: "resumeVariantPlanRef",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    category: "resume_variant_plan",
    label: "Resume variant plan availability",
    dataReads: "convex_resume_variant_plan_summary",
  },
  {
    toolName: "twoweeks.review_cockpit.summarize",
    query: "reviewCockpitSummary",
    argumentKey: "reviewCockpitRef",
    rawRefId: "raw-review-cockpit-ref",
    expectedKind: "mcp_review_cockpit_summary_result",
    resultRefKey: "reviewCockpitRef",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
    category: "review_cockpit",
    label: "Review cockpit availability",
    dataReads: "convex_review_cockpit_summary",
  },
] as const);

describe("MCP production read-only summary executor", () => {
  it.each(READONLY_SUMMARY_CASES)(
    "maps $toolName to the exact Convex internal summary query args",
    async (toolCase) => {
      const executionInput = executionInputFor(toolCase);
      expect(executionInput).toEqual({
        toolName: toolCase.toolName,
        twoweeksClerkId: OWNER_ID,
        ref: { id: toolCase.rawRefId },
        version: 1,
      });
      expect(JSON.stringify(executionInput)).not.toContain("progress-token-secret");
      expect(JSON.stringify(executionInput)).not.toContain("argumentFields");

      const runQuery = vi.fn(async (input: McpProductionReadonlySummaryQueryPortInputV1) =>
        summaryResultFor(toolCase, input),
      );
      const executor = buildMcpProductionReadonlySummaryExecutor(runQuery);
      const result = await executor(executionInput);

      expect(result).toMatchObject({
        ok: true,
        content: [{ type: "text", text: "Read-only summary returned." }],
        structuredContent: {
          kind: toolCase.expectedKind,
          [toolCase.resultRefKey]: {
            id: toolCase.safeRefId,
            category: toolCase.category,
          },
          capabilities: {
            dataReads: toolCase.dataReads,
            dataWrites: "blocked",
            networkAccess: "blocked",
            modelCalls: "blocked",
            writeActions: "blocked",
          },
        },
      });
      expect(runQuery).toHaveBeenCalledTimes(1);
      expect(runQuery.mock.calls[0]?.[0]).toEqual({
        query: toolCase.query,
        args: {
          twoweeksClerkId: OWNER_ID,
          [toolCase.argumentKey]: {
            id: toolCase.rawRefId,
            label: toolCase.label,
            status: "available",
            category: toolCase.category,
            count: 1,
            version: 1,
          },
        },
        version: 1,
      });
      const responseText = JSON.stringify(result);
      expect(responseText).not.toContain(OWNER_ID);
      expect(responseText).not.toContain(toolCase.rawRefId);
      expect(responseText).not.toContain("mcp_production_tools_call_readonly_synthetic_result");
    },
  );

  it("fails safely when the Convex query throws or storage is unavailable", async () => {
    const executor = buildMcpProductionReadonlySummaryExecutor(async () => {
      throw new Error("storage unavailable raw-application-package-ref");
    });
    const result = await executor(executionInputFor(READONLY_SUMMARY_CASES[0]));

    expect(result).toMatchObject({
      ok: false,
      failure: {
        code: "query_failed",
        message: MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
        safeForModel: true,
        rawArgumentsEchoed: false,
        ownerIdentityEchoed: false,
        internalQueryRefEchoed: false,
        stackTraceEchoed: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("storage unavailable");
    expect(JSON.stringify(result)).not.toContain("raw-application-package-ref");
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
  });

  it.each([
    ["wrong kind", { kind: "mcp_production_tools_call_readonly_synthetic_result" }],
    ["missing model-visible marker", { kind: "mcp_application_package_summary_result", allowed: true }],
    ["raw ref echo", { kind: "mcp_application_package_summary_result", rawRef: "raw-application-package-ref" }],
    ["raw owner echo", { kind: "mcp_application_package_summary_result", owner: OWNER_ID }],
  ] as const)("fails safely for malformed query result: %s", async (_label, queryResult) => {
    const executor = buildMcpProductionReadonlySummaryExecutor(async () => queryResult);
    const result = await executor(executionInputFor(READONLY_SUMMARY_CASES[0]));

    expect(result).toMatchObject({
      ok: false,
      failure: {
        code: "malformed_result",
        message: MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
        safeForModel: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(result)).not.toContain("raw-application-package-ref");
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
  });
});

function executionInputFor(
  toolCase: typeof READONLY_SUMMARY_CASES[number],
): McpProductionReadonlySummaryExecutionInputV1 {
  const validation = validateMcpProductionToolsCallBoundary({
    method: "tools/call",
    params: {
      name: toolCase.toolName,
      arguments: { [toolCase.argumentKey]: { id: toolCase.rawRefId } },
      _meta: { progressToken: "progress-token-secret" },
    },
    version: 1,
  });
  if (!validation.valid) {
    throw new Error("Expected tools/call validation to pass for read-only summary test fixture.");
  }
  const executionInput = buildMcpProductionReadonlySummaryExecutionInput({
    validation,
    twoweeksClerkId: OWNER_ID,
    version: 1,
  });
  if (!executionInput) {
    throw new Error("Expected read-only summary execution input to build from validated fixture.");
  }
  return executionInput;
}

function summaryResultFor(
  toolCase: typeof READONLY_SUMMARY_CASES[number],
  queryInput: McpProductionReadonlySummaryQueryPortInputV1,
): Readonly<Record<string, unknown>> {
  expect(queryInput.query).toBe(toolCase.query);
  return Object.freeze({
    kind: toolCase.expectedKind,
    allowed: true,
    status: "available",
    [toolCase.resultRefKey]: Object.freeze({
      id: toolCase.safeRefId,
      label: toolCase.label,
      status: "available",
      category: toolCase.category,
      count: 1,
      version: 1,
    }),
    availability: Object.freeze({
      source: toolCase.dataReads,
      ownerState: "resolved",
      version: 1,
    }),
    safeCounts: Object.freeze({ version: 1 }),
    safeCategories: Object.freeze({ version: 1 }),
    capabilities: Object.freeze({
      ownerResolution: "server_only",
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
  });
}
