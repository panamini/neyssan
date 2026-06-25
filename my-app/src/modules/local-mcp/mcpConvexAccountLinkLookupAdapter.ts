import type {
  McpAccountLinkLookupPortInputV1,
  McpAccountLinkLookupPortV1,
} from "./mcpAuthRequestOrchestrator";

export const MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT = Object.freeze({
  kind: "mcp_auth_policy_account_link_lookup_malformed_candidate",
  reason: "malformed_adapter_result",
  version: 1,
} as const);

export type McpConvexAccountLinkLookupRunQueryV1 = (
  queryRef: unknown,
  args: McpAccountLinkLookupPortInputV1,
) => Promise<unknown>;

export type McpConvexAccountLinkLookupAdapterConfigV1 = Readonly<{
  kind: "mcp_convex_account_link_lookup_adapter_config";
  queryRef: unknown;
  runQuery: McpConvexAccountLinkLookupRunQueryV1;
  serverOnly: true;
  version: 1;
}>;

export function buildMcpConvexAccountLinkLookupAdapter(
  config: McpConvexAccountLinkLookupAdapterConfigV1,
): McpAccountLinkLookupPortV1 {
  if (!isValidConfig(config)) {
    return async () => Object.freeze([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
  }

  return async (input) => {
    let result: unknown;
    try {
      result = await config.runQuery(config.queryRef, {
        issuer: input.issuer,
        subject: input.subject,
        providerEnvironment: input.providerEnvironment,
        version: 1,
      });
    } catch {
      return Object.freeze([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
    }

    return Array.isArray(result)
      ? Object.freeze([...result])
      : Object.freeze([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
  };
}

function isValidConfig(config: McpConvexAccountLinkLookupAdapterConfigV1): boolean {
  return (
    config.kind === "mcp_convex_account_link_lookup_adapter_config" &&
    typeof config.runQuery === "function" &&
    config.queryRef !== undefined &&
    config.serverOnly === true &&
    config.version === 1
  );
}
