import {
  isLocalMcpAllowedInternalToolId,
  parseLocalMcpRequest,
} from "./schema";
import type {
  LocalMcpAuthorizationResultV1,
  LocalMcpToolRegistryV1,
} from "./schema";
import {
  buildLocalMcpToolRegistry,
  getLocalMcpTool,
} from "./toolRegistry";

export function authorizeLocalMcpRequest(
  req: unknown,
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
): LocalMcpAuthorizationResultV1 {
  const parsed = parseLocalMcpRequest(req);
  if (!parsed) return deny("invalid_request");

  const tool = getLocalMcpTool(parsed.toolId, registry);
  if (!tool) return deny("unknown_tool");
  if (parsed.userId.trim().length === 0) return deny("missing_user");
  if (!isLocalMcpAllowedInternalToolId(tool.internalToolId) || tool.riskLevel === "blocked") {
    return deny("tool_not_allowlisted");
  }
  if (tool.requiresApproval && parsed.approval?.approved !== true) return deny("approval_required");

  return { allowed: true, version: 1 };
}

function deny(
  reason: Exclude<LocalMcpAuthorizationResultV1["reason"], undefined>,
): LocalMcpAuthorizationResultV1 {
  return {
    allowed: false,
    reason,
    version: 1,
  };
}
