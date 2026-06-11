import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import {
  buildInternalToolContractRegistry,
  getInternalToolContract,
  listInternalToolContracts,
} from "../../internal-tool-contracts/contracts";
import type {
  InternalToolContractRegistryV1,
  InternalToolContractV1,
} from "../../internal-tool-contracts/schema";
import { authorizeLocalMcpRequest } from "../authz";
import { executeLocalMcpRequest } from "../localMcpAdapter";
import type {
  LocalMcpRequestV1,
  LocalMcpToolDefinitionV1,
  LocalMcpToolIdV1,
} from "../schema";
import {
  buildLocalMcpToolRegistry,
  getLocalMcpTool,
  listLocalMcpTools,
} from "../toolRegistry";

const EXPECTED_LOCAL_TOOL_IDS = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const EXPECTED_INTERNAL_TOOL_IDS = [
  "application_package.summarize",
  "evidence_graph.summarize",
  "resume_variant_plan.summarize",
  "review_cockpit.summarize",
] as const;

const LOCAL_MCP_SOURCE_FILES = [
  "src/modules/local-mcp/schema.ts",
  "src/modules/local-mcp/toolRegistry.ts",
  "src/modules/local-mcp/authz.ts",
  "src/modules/local-mcp/localMcpAdapter.ts",
] as const;

function approvedRequest(
  toolId: LocalMcpToolIdV1 = "local_mcp.application_package.summarize",
  args: Record<string, unknown> = { applicationPackageRef: { id: "pkg_1" } },
): LocalMcpRequestV1 {
  return {
    toolId,
    userId: "user_1",
    arguments: args,
    approval: {
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T00:00:00.000Z",
      reason: "dry-run review",
      version: 1,
    },
    version: 1,
  };
}

function internalRegistryWith(
  contracts: readonly InternalToolContractV1[],
): InternalToolContractRegistryV1 {
  return {
    contracts,
    contractIds: contracts.map((contract) => contract.id).sort(),
    version: 1,
  } as InternalToolContractRegistryV1;
}

function mutateFirstToolDesc(tools: readonly LocalMcpToolDefinitionV1[]): void {
  (tools[0] as { desc: string }).desc = "mutated";
}

describe("local MCP registry", () => {
  it("builds deterministic registry output", () => {
    const first = buildLocalMcpToolRegistry();
    const second = buildLocalMcpToolRegistry();

    expect(first).toEqual(second);
    expect(first.version).toBe(1);
    expect(first.toolIds).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    expect(first.tools).not.toBe(second.tools);
  });

  it("exposes exactly four local tools", () => {
    const tools = listLocalMcpTools();

    expect(tools).toHaveLength(4);
    expect(tools.map((tool) => tool.id)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    expect(tools.map((tool) => tool.internalToolId)).toEqual(EXPECTED_INTERNAL_TOOL_IDS);
  });

  it("maps each local tool to an existing internal contract", () => {
    for (const tool of listLocalMcpTools()) {
      const contract = getInternalToolContract(tool.internalToolId);

      expect(contract?.id).toBe(tool.internalToolId);
      expect(tool.outputKind).toBe(contract?.output.kind);
      expect(tool.inputKinds).toEqual(contract?.input.map((input) => input.kind));
    }
  });

  it("requires approval for the exposed medium risk tools", () => {
    for (const tool of listLocalMcpTools()) {
      expect(tool.riskLevel).toBe("medium");
      expect(tool.requiresApproval).toBe(true);
    }
  });

  it("returns undefined for an unknown local tool", () => {
    expect(getLocalMcpTool("local_mcp.missing.summarize")).toBeUndefined();
  });

  it("returns defensively cloned tool definitions", () => {
    const first = listLocalMcpTools();
    const before = listLocalMcpTools()[0].desc;

    mutateFirstToolDesc(first);

    expect(listLocalMcpTools()[0].desc).toBe(before);
  });

  it("does not mutate the internal contract registry", () => {
    const registry = buildInternalToolContractRegistry();
    const before = stableSerialize(registry);

    buildLocalMcpToolRegistry(registry);

    expect(stableSerialize(registry)).toBe(before);
  });

  it("rejects a missing mapped internal contract", () => {
    const contracts = listInternalToolContracts().filter(
      (contract) => contract.id !== "application_package.summarize",
    );

    expect(() => buildLocalMcpToolRegistry(internalRegistryWith(contracts))).toThrow(TypeError);
  });

  it("rejects blocked or non-active mapped contracts", () => {
    const contracts = listInternalToolContracts();
    const withBlocked = contracts.map((contract) =>
      contract.id === "application_package.summarize"
        ? ({ ...contract, riskLevel: "blocked" } as InternalToolContractV1)
        : contract,
    );
    const withDraft = contracts.map((contract) =>
      contract.id === "application_package.summarize"
        ? ({ ...contract, status: "draft" } as InternalToolContractV1)
        : contract,
    );

    expect(() => buildLocalMcpToolRegistry(internalRegistryWith(withBlocked))).toThrow(TypeError);
    expect(() => buildLocalMcpToolRegistry(internalRegistryWith(withDraft))).toThrow(TypeError);
  });

  it("contains no forbidden write or external-host action terms in local tool metadata", () => {
    const forbiddenTerms = [
      "update",
      "submit",
      "publish",
      "export",
      "download",
      "network",
      "openai",
      "chatgpt",
      "claude",
      "browser",
      "scrape",
    ] as const;

    for (const tool of listLocalMcpTools()) {
      const metadata = [tool.id, tool.internalToolId, tool.desc].join(" ").toLowerCase();

      for (const term of forbiddenTerms) {
        expect(metadata).not.toContain(term);
      }
    }
  });
});

describe("local MCP authz", () => {
  it("allows an allowlisted medium risk tool when approval is approved", () => {
    expect(authorizeLocalMcpRequest(approvedRequest())).toEqual({
      allowed: true,
      version: 1,
    });
  });

  it("rejects an unknown local tool", () => {
    expect(
      authorizeLocalMcpRequest({
        ...approvedRequest(),
        toolId: "local_mcp.unknown.summarize",
      }),
    ).toEqual({
      allowed: false,
      reason: "unknown_tool",
      version: 1,
    });
  });

  it("rejects a missing user", () => {
    expect(authorizeLocalMcpRequest({ ...approvedRequest(), userId: "" })).toEqual({
      allowed: false,
      reason: "missing_user",
      version: 1,
    });
  });

  it("rejects an approval-required tool without approved approval", () => {
    const { approval: _approval, ...request } = approvedRequest();

    expect(authorizeLocalMcpRequest(request)).toEqual({
      allowed: false,
      reason: "approval_required",
      version: 1,
    });
  });

  it("rejects a malformed request", () => {
    expect(authorizeLocalMcpRequest({ ...approvedRequest(), version: 2 })).toEqual({
      allowed: false,
      reason: "invalid_request",
      version: 1,
    });
    expect(authorizeLocalMcpRequest(null)).toEqual({
      allowed: false,
      reason: "invalid_request",
      version: 1,
    });
  });
});

describe("local MCP adapter", () => {
  it("returns a stable success response for an authorized dry-run request", () => {
    const request = approvedRequest();
    const options = { now: () => "2026-06-11T00:00:00.000Z" };

    expect(executeLocalMcpRequest(request, options)).toEqual({
      success: true,
      toolId: "local_mcp.application_package.summarize",
      authorized: true,
      result: {
        kind: "local_mcp_dry_run",
        internalToolId: "application_package.summarize",
        input: { applicationPackageRef: { id: "pkg_1" } },
        outputKind: "application_package_summary",
        version: 1,
      },
      version: 1,
    });
    expect(executeLocalMcpRequest(request, options)).toEqual(executeLocalMcpRequest(request, options));
  });

  it("returns a stable refusal response for a denied request", () => {
    const { approval: _approval, ...request } = approvedRequest();

    expect(executeLocalMcpRequest(request)).toEqual({
      success: false,
      toolId: "local_mcp.application_package.summarize",
      authorized: false,
      err: {
        reason: "approval_required",
        version: 1,
      },
      version: 1,
    });
  });

  it("dispatches to the correct internal contract ID", () => {
    const response = executeLocalMcpRequest(
      approvedRequest("local_mcp.review_cockpit.summarize", {
        reviewCockpitRef: { id: "review_1" },
      }),
    );

    expect(response.result?.internalToolId).toBe("review_cockpit.summarize");
    expect(response.result?.outputKind).toBe("review_cockpit_summary");
  });

  it("does not mutate request inputs", () => {
    const args = { applicationPackageRef: { id: "pkg_1", tags: ["alpha"] } };
    const request = approvedRequest("local_mcp.application_package.summarize", args);
    const before = stableSerialize(request);

    const response = executeLocalMcpRequest(request);
    expect(stableSerialize(request)).toBe(before);

    args.applicationPackageRef.id = "mutated";
    args.applicationPackageRef.tags.push("mutated");

    expect(response.result?.input).toEqual({
      applicationPackageRef: { id: "pkg_1", tags: ["alpha"] },
    });
  });
});

describe("local MCP security boundaries", () => {
  it("implementation files use only relative imports", () => {
    for (const sourceFile of LOCAL_MCP_SOURCE_FILES) {
      const source = readFileSync(resolve(process.cwd(), sourceFile), "utf8");

      expect(source).not.toMatch(/from\s+["'](?!\.)/u);
    }
  });

  it("implementation files do not import product runtimes or UI routes", () => {
    for (const sourceFile of LOCAL_MCP_SOURCE_FILES) {
      const source = readFileSync(resolve(process.cwd(), sourceFile), "utf8");

      expect(source).not.toMatch(
        /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout|publicEndpointFetcher|sourceResolver)[^"']*["']/iu,
      );
    }
  });

  it("implementation files contain no remote host integration markers", () => {
    const blockedCalls = ["fetch", "axios", "undici"] as const;
    const blockedText = [
      "http",
      "websocket",
      "sse",
      "oauth",
      "openai",
      "chatgpt",
      "claude",
    ] as const;

    for (const sourceFile of LOCAL_MCP_SOURCE_FILES) {
      const source = readFileSync(resolve(process.cwd(), sourceFile), "utf8").toLowerCase();

      for (const call of blockedCalls) {
        expect(source).not.toContain(call);
      }
      for (const marker of blockedText) {
        expect(source).not.toContain(marker);
      }
    }
  });
});
