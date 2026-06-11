import {
  authorizeLocalMcpRequest,
} from "./authz";
import {
  cloneLocalMcpArguments,
  getRequestToolId,
  parseLocalMcpRequest,
} from "./schema";
import type {
  ExecuteLocalMcpRequestOptionsV1,
  LocalMcpResponseV1,
} from "./schema";
import {
  buildLocalMcpToolRegistry,
  getLocalMcpTool,
} from "./toolRegistry";

export function executeLocalMcpRequest(
  req: unknown,
  options: ExecuteLocalMcpRequestOptionsV1 = {},
): LocalMcpResponseV1 {
  const registry = options.registry ?? buildLocalMcpToolRegistry();
  const authorization = authorizeLocalMcpRequest(req, registry);
  const parsed = parseLocalMcpRequest(req);
  const toolId = parsed?.toolId ?? getRequestToolId(req);

  if (!authorization.allowed) {
    return {
      success: false,
      toolId,
      authorized: false,
      err: {
        reason: authorization.reason ?? "invalid_request",
        version: 1,
      },
      version: 1,
    };
  }

  if (!parsed) {
    return {
      success: false,
      toolId,
      authorized: false,
      err: {
        reason: "invalid_request",
        version: 1,
      },
      version: 1,
    };
  }

  const tool = getLocalMcpTool(parsed.toolId, registry);
  if (!tool) {
    return {
      success: false,
      toolId,
      authorized: false,
      err: {
        reason: "unknown_tool",
        version: 1,
      },
      version: 1,
    };
  }

  return {
    success: true,
    toolId: tool.id,
    authorized: true,
    result: {
      kind: "local_mcp_dry_run",
      internalToolId: tool.internalToolId,
      input: cloneLocalMcpArguments(parsed.arguments),
      outputKind: tool.outputKind,
      version: 1,
    },
    version: 1,
  };
}
