export type LocalMcpServerSkeletonV1 = Readonly<{
  kind: "local_mcp_server_skeleton";
  mode: "disabled";
  enabled: false;
  localOnly: true;
  endpoint: "none";
  listener: "none";
  routePaths: readonly [];
  exposedToolNames: readonly [];
  callableToolNames: readonly [];
  resourceUris: readonly [];
  constraints: LocalMcpServerSkeletonConstraintsV1;
  version: 1;
}>;

export type LocalMcpServerSkeletonConstraintsV1 = Readonly<{
  disabledByDefault: true;
  noEndpoint: true;
  noListener: true;
  noRoute: true;
  noRemoteTransport: true;
  noToolListingRuntime: true;
  noToolCallingRuntime: true;
  noRealHandlers: true;
  noRealUserData: true;
  noOAuth: true;
  noUiResources: true;
  noOutboundHttp: true;
  noLlmCalls: true;
  noExportDownloadSendSubmitApply: true;
  noProductionBehavior: true;
  version: 1;
}>;

const DISABLED_CONSTRAINTS: LocalMcpServerSkeletonConstraintsV1 = {
  disabledByDefault: true,
  noEndpoint: true,
  noListener: true,
  noRoute: true,
  noRemoteTransport: true,
  noToolListingRuntime: true,
  noToolCallingRuntime: true,
  noRealHandlers: true,
  noRealUserData: true,
  noOAuth: true,
  noUiResources: true,
  noOutboundHttp: true,
  noLlmCalls: true,
  noExportDownloadSendSubmitApply: true,
  noProductionBehavior: true,
  version: 1,
} as const;

const SKELETON_KEYS = [
  "kind",
  "mode",
  "enabled",
  "localOnly",
  "endpoint",
  "listener",
  "routePaths",
  "exposedToolNames",
  "callableToolNames",
  "resourceUris",
  "constraints",
  "version",
] as const;

const REQUIRED_TRUE_CONSTRAINTS = [
  "disabledByDefault",
  "noEndpoint",
  "noListener",
  "noRoute",
  "noRemoteTransport",
  "noToolListingRuntime",
  "noToolCallingRuntime",
  "noRealHandlers",
  "noRealUserData",
  "noOAuth",
  "noUiResources",
  "noOutboundHttp",
  "noLlmCalls",
  "noExportDownloadSendSubmitApply",
  "noProductionBehavior",
] as const;

export function buildDisabledLocalMcpServerSkeleton(): LocalMcpServerSkeletonV1 {
  const skeleton: LocalMcpServerSkeletonV1 = {
    kind: "local_mcp_server_skeleton",
    mode: "disabled",
    enabled: false,
    localOnly: true,
    endpoint: "none",
    listener: "none",
    routePaths: [],
    exposedToolNames: [],
    callableToolNames: [],
    resourceUris: [],
    constraints: { ...DISABLED_CONSTRAINTS },
    version: 1,
  };

  assertLocalMcpServerSkeletonDisabled(skeleton);
  return cloneSkeleton(skeleton);
}

export function assertLocalMcpServerSkeletonDisabled(skeleton: LocalMcpServerSkeletonV1): void {
  const record = asPlainRecord(skeleton, "Local MCP server skeleton must be an object");
  assertExactKeys(record, SKELETON_KEYS, "Local MCP server skeleton");

  if (record.kind !== "local_mcp_server_skeleton") {
    throw new TypeError("Local MCP server skeleton kind is invalid");
  }
  if (record.mode !== "disabled" || record.enabled !== false) {
    throw new TypeError("Local MCP server skeleton must be disabled");
  }
  if (record.localOnly !== true) {
    throw new TypeError("Local MCP server skeleton must be local-only");
  }
  if (record.endpoint !== "none" || record.listener !== "none") {
    throw new TypeError("Local MCP server skeleton must not expose an endpoint or listener");
  }
  assertEmptyArray(record.routePaths, "route paths");
  assertEmptyArray(record.exposedToolNames, "exposed tool names");
  assertEmptyArray(record.callableToolNames, "callable tool names");
  assertEmptyArray(record.resourceUris, "resource URIs");
  assertDisabledConstraints(record.constraints);
  if (record.version !== 1) {
    throw new TypeError("Local MCP server skeleton version must be 1");
  }
}

function assertDisabledConstraints(value: unknown): void {
  const constraints = asPlainRecord(value, "Local MCP server skeleton constraints must be an object");
  assertExactKeys(constraints, [...REQUIRED_TRUE_CONSTRAINTS, "version"], "Local MCP server skeleton constraints");

  for (const constraint of REQUIRED_TRUE_CONSTRAINTS) {
    if (constraints[constraint] !== true) {
      throw new TypeError(`Local MCP server skeleton requires ${constraint}`);
    }
  }
  if (constraints.version !== 1) {
    throw new TypeError("Local MCP server skeleton constraints version must be 1");
  }
}

function cloneSkeleton(skeleton: LocalMcpServerSkeletonV1): LocalMcpServerSkeletonV1 {
  return Object.freeze({
    ...skeleton,
    routePaths: Object.freeze([]),
    exposedToolNames: Object.freeze([]),
    callableToolNames: Object.freeze([]),
    resourceUris: Object.freeze([]),
    constraints: Object.freeze({ ...skeleton.constraints }),
  });
}

function assertEmptyArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 0) {
    throw new TypeError(`Local MCP server skeleton ${label} must be empty`);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((key) => actualKeys.includes(key))) {
    throw new TypeError(`${label} must not contain extra or missing fields`);
  }
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Record<string, unknown>;
}
