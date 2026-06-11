import {
  buildInternalToolContractRegistry,
} from "../internal-tool-contracts/contracts";
import type {
  InternalToolContractRegistryV1,
  InternalToolContractV1,
  InternalToolIdV1,
} from "../internal-tool-contracts/schema";
import {
  cloneLocalMcpToolDefinition,
  isLocalMcpAllowedInternalToolId,
  validateLocalMcpToolDefinition,
} from "./schema";
import type {
  LocalMcpToolDefinitionV1,
  LocalMcpToolIdV1,
  LocalMcpToolRegistryV1,
} from "./schema";

const LOCAL_MCP_TOOL_MAPPINGS: readonly Readonly<{
  id: LocalMcpToolIdV1;
  internalToolId: InternalToolIdV1;
}>[] = [
  {
    id: "local_mcp.application_package.summarize",
    internalToolId: "application_package.summarize",
  },
  {
    id: "local_mcp.evidence_graph.summarize",
    internalToolId: "evidence_graph.summarize",
  },
  {
    id: "local_mcp.resume_variant_plan.summarize",
    internalToolId: "resume_variant_plan.summarize",
  },
  {
    id: "local_mcp.review_cockpit.summarize",
    internalToolId: "review_cockpit.summarize",
  },
] as const;

export function buildLocalMcpToolRegistry(
  internalRegistry: InternalToolContractRegistryV1 = buildInternalToolContractRegistry(),
): LocalMcpToolRegistryV1 {
  const contractsById = new Map<InternalToolIdV1, InternalToolContractV1>(
    internalRegistry.contracts.map((contract) => [contract.id, contract]),
  );
  const tools = LOCAL_MCP_TOOL_MAPPINGS.map((mapping) => {
    const contract = contractsById.get(mapping.internalToolId);
    if (!contract) throw new TypeError("Local MCP mapping references unknown internal contract");
    if (!isLocalMcpAllowedInternalToolId(contract.id)) {
      throw new TypeError("Local MCP mapping references non-allowlisted internal contract");
    }
    if (contract.status !== "active") throw new TypeError("Local MCP mapping requires active contract");
    if (contract.riskLevel === "blocked") throw new TypeError("Local MCP mapping rejects blocked contract");

    const tool: LocalMcpToolDefinitionV1 = {
      id: mapping.id,
      internalToolId: contract.id,
      desc: contract.description,
      version: 1,
      riskLevel: contract.riskLevel,
      requiresApproval: contract.riskLevel === "medium",
      inputKinds: contract.input.map((input) => input.kind),
      outputKind: contract.output.kind,
    };
    validateLocalMcpToolDefinition(tool);
    return tool;
  }).sort((a, b) => compareLocalMcpToolIds(a.id, b.id));

  return {
    tools: tools.map(cloneLocalMcpToolDefinition),
    toolIds: tools.map((tool) => tool.id),
    version: 1,
  };
}

export function listLocalMcpTools(): readonly LocalMcpToolDefinitionV1[] {
  return buildLocalMcpToolRegistry().tools.map(cloneLocalMcpToolDefinition);
}

export function getLocalMcpTool(
  toolId: string,
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
): LocalMcpToolDefinitionV1 | undefined {
  const tool = registry.tools.find((candidate) => candidate.id === toolId);
  return tool ? cloneLocalMcpToolDefinition(tool) : undefined;
}

function compareLocalMcpToolIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
