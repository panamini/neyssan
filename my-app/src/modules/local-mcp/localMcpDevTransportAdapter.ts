import {
  assertLocalMcpServerSkeletonDisabled,
  buildDisabledLocalMcpServerSkeleton,
} from "./localMcpServerSkeleton";
import type { LocalMcpServerSkeletonV1 } from "./localMcpServerSkeleton";
import { buildDisabledLocalMcpRemoteTransportConfig } from "./mcpRemoteTransportSpike";
import type { LocalMcpRemoteTransportConfigV1 } from "./mcpRemoteTransportSpike";

export type LocalMcpDevTransportAdapterV1 = Readonly<{
  kind: "local_mcp_dev_transport_adapter";
  mode: "disabled";
  environment: "local_dev_only";
  enabled: false;
  transport: "none";
  endpoint: "none";
  listener: "none";
  publicEndpoint: false;
  networkReachable: false;
  toolsListRuntime: false;
  toolsCallRuntime: false;
  realHandlers: false;
  realUserData: false;
  oauth: false;
  productionBehavior: false;
  serverSkeleton: LocalMcpServerSkeletonV1;
  remoteTransportConfig: LocalMcpRemoteTransportConfigV1;
  version: 1;
}>;

const ADAPTER_KEYS = [
  "kind",
  "mode",
  "environment",
  "enabled",
  "transport",
  "endpoint",
  "listener",
  "publicEndpoint",
  "networkReachable",
  "toolsListRuntime",
  "toolsCallRuntime",
  "realHandlers",
  "realUserData",
  "oauth",
  "productionBehavior",
  "serverSkeleton",
  "remoteTransportConfig",
  "version",
] as const;

const REQUIRED_FALSE_FLAGS = [
  "enabled",
  "publicEndpoint",
  "networkReachable",
  "toolsListRuntime",
  "toolsCallRuntime",
  "realHandlers",
  "realUserData",
  "oauth",
  "productionBehavior",
] as const;

const REMOTE_TRANSPORT_CONFIG_KEYS = [
  "kind",
  "mode",
  "transportKind",
  "allowedOrigins",
  "allowedHosts",
  "authMode",
  "requireOriginValidation",
  "requireExplicitAuthBeforeRemote",
  "requireApprovalBoundary",
  "requireAuditBoundary",
  "requireHandlerBoundary",
  "maxRequestBytes",
  "maxResponseBytes",
  "timeoutMs",
  "rateLimit",
  "version",
] as const;

const RATE_LIMIT_KEYS = ["perUserPerMinute", "perSessionPerMinute", "globalPerMinute"] as const;

export function buildDisabledLocalMcpDevTransportAdapter(): LocalMcpDevTransportAdapterV1 {
  const adapter: LocalMcpDevTransportAdapterV1 = {
    kind: "local_mcp_dev_transport_adapter",
    mode: "disabled",
    environment: "local_dev_only",
    enabled: false,
    transport: "none",
    endpoint: "none",
    listener: "none",
    publicEndpoint: false,
    networkReachable: false,
    toolsListRuntime: false,
    toolsCallRuntime: false,
    realHandlers: false,
    realUserData: false,
    oauth: false,
    productionBehavior: false,
    serverSkeleton: buildDisabledLocalMcpServerSkeleton(),
    remoteTransportConfig: buildDisabledLocalMcpRemoteTransportConfig(),
    version: 1,
  };

  assertLocalMcpDevTransportAdapterDisabled(adapter);
  return cloneAdapter(adapter);
}

export function assertLocalMcpDevTransportAdapterDisabled(adapter: LocalMcpDevTransportAdapterV1): void {
  const record = asPlainRecord(adapter, "Local MCP dev transport adapter must be an object");
  assertExactKeys(record, ADAPTER_KEYS, "Local MCP dev transport adapter");

  if (record.kind !== "local_mcp_dev_transport_adapter") {
    throw new TypeError("Local MCP dev transport adapter kind is invalid");
  }
  if (record.mode !== "disabled") {
    throw new TypeError("Local MCP dev transport adapter must be disabled");
  }
  if (record.environment !== "local_dev_only") {
    throw new TypeError("Local MCP dev transport adapter must remain local-dev-only");
  }
  if (record.transport !== "none" || record.endpoint !== "none" || record.listener !== "none") {
    throw new TypeError("Local MCP dev transport adapter must not expose a transport boundary");
  }
  for (const flag of REQUIRED_FALSE_FLAGS) {
    if (record[flag] !== false) {
      throw new TypeError(`Local MCP dev transport adapter requires ${flag} to stay false`);
    }
  }
  assertLocalMcpServerSkeletonDisabled(record.serverSkeleton as LocalMcpServerSkeletonV1);
  assertDisabledRemoteTransportConfig(record.remoteTransportConfig);
  if (record.version !== 1) {
    throw new TypeError("Local MCP dev transport adapter version must be 1");
  }
}

function assertDisabledRemoteTransportConfig(value: unknown): void {
  const config = asPlainRecord(value, "Local MCP dev transport adapter remote config must be an object");
  assertExactKeys(config, REMOTE_TRANSPORT_CONFIG_KEYS, "Local MCP dev transport adapter remote config");
  assertRemoteConfigIdentity(config);
  assertEmptyStringArray(config.allowedOrigins, "origins");
  assertEmptyStringArray(config.allowedHosts, "hosts");
  assertRemoteSafetyBoundaries(config);
  assertRateLimit(config.rateLimit);
  if (config.version !== 1) {
    throw new TypeError("Local MCP dev transport adapter remote config version must be 1");
  }
}

function assertRemoteConfigIdentity(config: Record<string, unknown>): void {
  if (config.kind !== "local_mcp_remote_transport_config") {
    throw new TypeError("Local MCP dev transport adapter remote config kind is invalid");
  }
  if (config.mode !== "disabled" || config.transportKind !== "none") {
    throw new TypeError("Local MCP dev transport adapter remote config must be disabled");
  }
  if (config.authMode !== "future_required") {
    throw new TypeError("Local MCP dev transport adapter remote auth must stay future-only");
  }
}

function assertRemoteSafetyBoundaries(config: Record<string, unknown>): void {
  const requiredTrueKeys = [
    "requireOriginValidation",
    "requireExplicitAuthBeforeRemote",
    "requireApprovalBoundary",
    "requireAuditBoundary",
    "requireHandlerBoundary",
  ] as const;
  for (const key of requiredTrueKeys) {
    if (config[key] !== true) {
      throw new TypeError("Local MCP dev transport adapter remote config requires all safety boundaries");
    }
  }
}

function assertEmptyStringArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 0) {
    throw new TypeError(`Local MCP dev transport adapter remote ${label} must stay empty`);
  }
}

function assertRateLimit(value: unknown): void {
  const rateLimit = asPlainRecord(value, "Local MCP dev transport adapter rate limit must be an object");
  assertExactKeys(rateLimit, RATE_LIMIT_KEYS, "Local MCP dev transport adapter rate limit");
  for (const key of RATE_LIMIT_KEYS) {
    if (typeof rateLimit[key] !== "number" || !Number.isInteger(rateLimit[key]) || rateLimit[key] <= 0) {
      throw new TypeError(`Local MCP dev transport adapter rate limit ${key} must stay positive`);
    }
  }
}

function cloneAdapter(adapter: LocalMcpDevTransportAdapterV1): LocalMcpDevTransportAdapterV1 {
  return Object.freeze({
    ...adapter,
    serverSkeleton: buildDisabledLocalMcpServerSkeleton(),
    remoteTransportConfig: cloneRemoteTransportConfig(adapter.remoteTransportConfig),
  });
}

function cloneRemoteTransportConfig(config: LocalMcpRemoteTransportConfigV1): LocalMcpRemoteTransportConfigV1 {
  return Object.freeze({
    ...config,
    allowedOrigins: Object.freeze([...config.allowedOrigins]),
    allowedHosts: Object.freeze([...config.allowedHosts]),
    rateLimit: Object.freeze({ ...config.rateLimit }),
  });
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
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
