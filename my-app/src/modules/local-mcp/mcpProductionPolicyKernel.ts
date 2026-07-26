import type { McpAuthenticatedProtocolEnvelopeV1 } from "./mcpAuthenticatedProtocolEnvelope";

export type McpProductionPolicyDecisionV1 = Readonly<
  | {
      kind: "mcp_production_policy_decision";
      decision: "allow_protocol";
      method: "initialize" | "notifications/initialized" | "ping";
      reason: "protocol_method_allowed";
      version: 1;
    }
  | {
      kind: "mcp_production_policy_decision";
      decision: "allow_metadata";
      method: "tools/list";
      reason: "metadata_listing_allowed";
      version: 1;
    }
  | {
      kind: "mcp_production_policy_decision";
      decision: "invalid_params";
      method: "tools/list";
      reason: "tools_list_params_invalid";
      version: 1;
    }
  | {
      kind: "mcp_production_policy_decision";
      decision: "allow_read_only_call";
      method: "tools/call";
      reason: "read_only_call_boundary_allowed";
      version: 1;
    }
  | {
      kind: "mcp_production_policy_decision";
      decision: "method_not_found";
      method: string;
      reason: "unknown_method";
      version: 1;
    }
>;

export function evaluateMcpProductionPolicy(
  envelope: McpAuthenticatedProtocolEnvelopeV1,
): McpProductionPolicyDecisionV1 {
  const method = envelope.jsonRpc.method;
  if (method === "initialize" || method === "notifications/initialized" || method === "ping") {
    return Object.freeze({
      kind: "mcp_production_policy_decision",
      decision: "allow_protocol",
      method,
      reason: "protocol_method_allowed",
      version: 1,
    });
  }
  if (method === "tools/list") {
    if (isSafeToolsListParams(envelope.jsonRpc.params)) {
      return Object.freeze({
        kind: "mcp_production_policy_decision",
        decision: "allow_metadata",
        method,
        reason: "metadata_listing_allowed",
        version: 1,
      });
    }
    return Object.freeze({
      kind: "mcp_production_policy_decision",
      decision: "invalid_params",
      method,
      reason: "tools_list_params_invalid",
      version: 1,
    });
  }
  if (method === "tools/call") {
    return Object.freeze({
      kind: "mcp_production_policy_decision",
      decision: "allow_read_only_call",
      method,
      reason: "read_only_call_boundary_allowed",
      version: 1,
    });
  }
  return Object.freeze({
    kind: "mcp_production_policy_decision",
    decision: "method_not_found",
    method,
    reason: "unknown_method",
    version: 1,
  });
}

function isSafeToolsListParams(params: unknown): boolean {
  if (params === undefined) return true;
  if (!isPlainRecord(params)) return false;
  return hasNoKeys(params) || hasOnlySafeMetaParam(params);
}

function hasNoKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

function hasOnlySafeMetaParam(params: Record<string, unknown>): boolean {
  const keys = Object.keys(params);
  if (keys.length !== 1 || keys[0] !== "_meta") return false;
  return isSafeToolsListMeta(params._meta);
}

function isSafeToolsListMeta(meta: unknown): boolean {
  if (!isPlainRecord(meta)) return false;
  return hasNoKeys(meta) || hasOnlySafeProgressToken(meta);
}

function hasOnlySafeProgressToken(meta: Record<string, unknown>): boolean {
  const metaKeys = Object.keys(meta);
  return metaKeys.length === 1 && metaKeys[0] === "progressToken" && isProgressToken(meta.progressToken);
}

function isProgressToken(value: unknown): boolean {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
