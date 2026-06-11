export type LocalMcpRemoteTransportModeV1 =
  | "disabled"
  | "non_production_spike_only";

export type LocalMcpRemoteTransportKindV1 =
  | "none"
  | "stdio_design"
  | "streamable_http_design";

export type LocalMcpRemoteAuthModeV1 =
  | "none_for_local_only"
  | "future_required";

export type LocalMcpRemoteTransportConfigV1 = Readonly<{
  kind: "local_mcp_remote_transport_config";
  mode: LocalMcpRemoteTransportModeV1;
  transportKind: LocalMcpRemoteTransportKindV1;
  allowedOrigins: readonly string[];
  allowedHosts: readonly string[];
  authMode: LocalMcpRemoteAuthModeV1;
  requireOriginValidation: true;
  requireExplicitAuthBeforeRemote: true;
  requireApprovalBoundary: true;
  requireAuditBoundary: true;
  requireHandlerBoundary: true;
  maxRequestBytes: number;
  maxResponseBytes: number;
  timeoutMs: number;
  rateLimit: Readonly<{
    perUserPerMinute: number;
    perSessionPerMinute: number;
    globalPerMinute: number;
  }>;
  version: 1;
}>;

export type LocalMcpRemoteTransportPreflightInputV1 = Readonly<{
  kind: "local_mcp_remote_transport_preflight_input";
  config: LocalMcpRemoteTransportConfigV1;
  origin?: string;
  host?: string;
  userId?: string;
  sessionId?: string;
  requestSizeBytes: number;
  expectedResponseSizeBytes?: number;
  nowMs?: number;
  version: 1;
}>;

export type LocalMcpRemoteTransportPreflightStatusV1 =
  | "blocked"
  | "allowed_for_non_production_spike";

export type LocalMcpRemoteTransportBlockReasonV1 =
  | "transport_disabled"
  | "production_transport_not_allowed"
  | "missing_origin"
  | "origin_not_allowed"
  | "missing_host"
  | "host_not_allowed"
  | "auth_required_before_remote"
  | "missing_user"
  | "missing_session"
  | "invalid_request_size"
  | "request_too_large"
  | "invalid_response_size"
  | "response_too_large"
  | "invalid_timeout"
  | "invalid_rate_limit"
  | "handler_boundary_required"
  | "approval_boundary_required"
  | "audit_boundary_required";

export type LocalMcpRemoteTransportPreflightResultV1 = Readonly<{
  kind: "local_mcp_remote_transport_preflight_result";
  status: LocalMcpRemoteTransportPreflightStatusV1;
  blockedReasons: readonly LocalMcpRemoteTransportBlockReasonV1[];
  safeSummary: string;
  version: 1;
}>;

const DEFAULT_MAX_REQUEST_BYTES = 16 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RATE_LIMIT = {
  perUserPerMinute: 12,
  perSessionPerMinute: 6,
  globalPerMinute: 60,
} as const;

export function buildDisabledLocalMcpRemoteTransportConfig(): LocalMcpRemoteTransportConfigV1 {
  const config: LocalMcpRemoteTransportConfigV1 = {
    kind: "local_mcp_remote_transport_config",
    mode: "disabled",
    transportKind: "none",
    allowedOrigins: [],
    allowedHosts: [],
    authMode: "future_required",
    requireOriginValidation: true,
    requireExplicitAuthBeforeRemote: true,
    requireApprovalBoundary: true,
    requireAuditBoundary: true,
    requireHandlerBoundary: true,
    maxRequestBytes: DEFAULT_MAX_REQUEST_BYTES,
    maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    rateLimit: { ...DEFAULT_RATE_LIMIT },
    version: 1,
  };
  validateLocalMcpRemoteTransportConfig(config);
  return cloneConfig(config);
}

export function buildNonProductionLocalMcpRemoteTransportSpikeConfig(
  input: Readonly<{
    allowedOrigins: readonly string[];
    allowedHosts: readonly string[];
  }>,
): LocalMcpRemoteTransportConfigV1 {
  const config: LocalMcpRemoteTransportConfigV1 = {
    kind: "local_mcp_remote_transport_config",
    mode: "non_production_spike_only",
    transportKind: "streamable_http_design",
    allowedOrigins: normalizeAllowlist(input.allowedOrigins, normalizeOrigin, "origin"),
    allowedHosts: normalizeAllowlist(input.allowedHosts, normalizeHost, "host"),
    authMode: "future_required",
    requireOriginValidation: true,
    requireExplicitAuthBeforeRemote: true,
    requireApprovalBoundary: true,
    requireAuditBoundary: true,
    requireHandlerBoundary: true,
    maxRequestBytes: DEFAULT_MAX_REQUEST_BYTES,
    maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    rateLimit: { ...DEFAULT_RATE_LIMIT },
    version: 1,
  };
  validateLocalMcpRemoteTransportConfig(config);
  return cloneConfig(config);
}

export function validateLocalMcpRemoteTransportConfig(
  config: LocalMcpRemoteTransportConfigV1,
): void {
  if (!isPlainRecord(config)) throw new TypeError("Local MCP remote transport config must be an object");
  if (config.kind !== "local_mcp_remote_transport_config") {
    throw new TypeError("Local MCP remote transport config kind is invalid");
  }
  if (config.version !== 1) throw new TypeError("Local MCP remote transport config version must be 1");
  if (!isRemoteTransportMode(config.mode)) {
    throw new TypeError("Local MCP remote transport mode is invalid");
  }
  if (!isRemoteTransportKind(config.transportKind)) {
    throw new TypeError("Local MCP remote transport kind is invalid");
  }
  if (config.mode === "disabled" && config.transportKind !== "none") {
    throw new TypeError("Disabled Local MCP remote transport must use no transport kind");
  }
  if (config.mode === "non_production_spike_only" && config.transportKind === "none") {
    throw new TypeError("Non-production Local MCP remote transport spike requires a design transport kind");
  }
  if (config.authMode !== "future_required") {
    throw new TypeError("Local MCP remote transport requires future auth before remote access");
  }
  assertTrue(config.requireOriginValidation, "origin validation");
  assertTrue(config.requireExplicitAuthBeforeRemote, "explicit auth before remote");
  assertTrue(config.requireApprovalBoundary, "approval boundary");
  assertTrue(config.requireAuditBoundary, "audit boundary");
  assertTrue(config.requireHandlerBoundary, "handler boundary");
  assertPositiveInteger(config.maxRequestBytes, "max request bytes");
  assertPositiveInteger(config.maxResponseBytes, "max response bytes");
  assertPositiveInteger(config.timeoutMs, "timeout");
  assertRateLimit(config.rateLimit);
  assertAllowlist(config.allowedOrigins, normalizeOrigin, "origin");
  assertAllowlist(config.allowedHosts, normalizeHost, "host");
  if (config.mode === "disabled") {
    if (config.allowedOrigins.length > 0 || config.allowedHosts.length > 0) {
      throw new TypeError("Disabled Local MCP remote transport must not allow origins or hosts");
    }
    return;
  }
  if (config.allowedOrigins.length === 0 || config.allowedHosts.length === 0) {
    throw new TypeError("Non-production Local MCP remote transport spike requires explicit allowlists");
  }
}

export function validateLocalMcpRemoteTransportPreflight(
  input: LocalMcpRemoteTransportPreflightInputV1,
): LocalMcpRemoteTransportPreflightResultV1 {
  const blockedReasons: LocalMcpRemoteTransportBlockReasonV1[] = [];

  if (!isPlainRecord(input) || input.kind !== "local_mcp_remote_transport_preflight_input" || input.version !== 1) {
    addReason(blockedReasons, "production_transport_not_allowed");
    return buildPreflightResult(blockedReasons);
  }

  const config = input.config;
  if (!isPlainRecord(config) || config.kind !== "local_mcp_remote_transport_config" || config.version !== 1) {
    addReason(blockedReasons, "production_transport_not_allowed");
    return buildPreflightResult(blockedReasons);
  }

  if (config.mode === "disabled") {
    addReason(blockedReasons, "transport_disabled");
    return buildPreflightResult(blockedReasons);
  }

  if (config.mode !== "non_production_spike_only" || config.transportKind === "none") {
    addReason(blockedReasons, "production_transport_not_allowed");
  }

  const allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [];
  const allowedHosts = Array.isArray(config.allowedHosts) ? config.allowedHosts : [];

  if (!Array.isArray(config.allowedOrigins)) addReason(blockedReasons, "origin_not_allowed");
  if (!Array.isArray(config.allowedHosts)) addReason(blockedReasons, "host_not_allowed");

  if (!isNonEmptyString(input.origin)) {
    addReason(blockedReasons, "missing_origin");
  } else if (!isAllowedLocalMcpOrigin(input.origin, allowedOrigins)) {
    addReason(blockedReasons, "origin_not_allowed");
  }

  if (!isNonEmptyString(input.host)) {
    addReason(blockedReasons, "missing_host");
  } else if (!isAllowedLocalMcpHost(input.host, allowedHosts)) {
    addReason(blockedReasons, "host_not_allowed");
  }

  if (config.authMode !== "future_required" || config.requireExplicitAuthBeforeRemote !== true) {
    addReason(blockedReasons, "auth_required_before_remote");
  }
  if (!isNonEmptyString(input.userId)) addReason(blockedReasons, "missing_user");
  if (!isNonEmptyString(input.sessionId)) addReason(blockedReasons, "missing_session");
  if (!Number.isInteger(input.requestSizeBytes) || input.requestSizeBytes < 0) {
    addReason(blockedReasons, "invalid_request_size");
  } else if (!isWithinSizeLimit(input.requestSizeBytes, config.maxRequestBytes)) {
    addReason(blockedReasons, "request_too_large");
  }
  if (
    !Number.isInteger(config.maxResponseBytes) ||
    config.maxResponseBytes <= 0
  ) {
    addReason(blockedReasons, "response_too_large");
  } else if (
    input.expectedResponseSizeBytes !== undefined &&
    (!Number.isInteger(input.expectedResponseSizeBytes) || input.expectedResponseSizeBytes < 0)
  ) {
    addReason(blockedReasons, "invalid_response_size");
  } else if (
    input.expectedResponseSizeBytes !== undefined &&
    !isWithinSizeLimit(input.expectedResponseSizeBytes, config.maxResponseBytes)
  ) {
    addReason(blockedReasons, "response_too_large");
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    addReason(blockedReasons, "invalid_timeout");
  }
  if (!isValidRateLimit(config.rateLimit)) {
    addReason(blockedReasons, "invalid_rate_limit");
  }
  if (config.requireHandlerBoundary !== true) {
    addReason(blockedReasons, "handler_boundary_required");
  }
  if (config.requireApprovalBoundary !== true) {
    addReason(blockedReasons, "approval_boundary_required");
  }
  if (config.requireAuditBoundary !== true) {
    addReason(blockedReasons, "audit_boundary_required");
  }
  if (config.requireOriginValidation !== true) {
    addReason(blockedReasons, "production_transport_not_allowed");
  }

  return buildPreflightResult(blockedReasons);
}

export function isAllowedLocalMcpOrigin(
  origin: string,
  allowedOrigins: readonly string[],
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);
}

export function isAllowedLocalMcpHost(
  host: string,
  allowedHosts: readonly string[],
): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;
  return allowedHosts.some((allowedHost) => normalizeHost(allowedHost) === normalizedHost);
}

function buildPreflightResult(
  blockedReasons: readonly LocalMcpRemoteTransportBlockReasonV1[],
): LocalMcpRemoteTransportPreflightResultV1 {
  return {
    kind: "local_mcp_remote_transport_preflight_result",
    status: blockedReasons.length === 0 ? "allowed_for_non_production_spike" : "blocked",
    blockedReasons: [...blockedReasons],
    safeSummary:
      blockedReasons.length === 0
        ? "Remote transport preflight allowed for non-production spike only."
        : blockedReasons.includes("transport_disabled")
          ? "Remote transport disabled."
          : "Remote transport preflight blocked for non-production spike only.",
    version: 1,
  };
}

function normalizeAllowlist(
  values: readonly string[],
  normalize: (value: string) => string | undefined,
  label: string,
): readonly string[] {
  if (!Array.isArray(values)) throw new TypeError(`Local MCP ${label} allowlist must be an array`);
  const normalized = values.map((value) => normalize(value));
  if (normalized.some((value) => value === undefined)) {
    throw new TypeError(`Local MCP ${label} allowlist contains an unsafe value`);
  }
  return [...new Set(normalized as string[])].sort(compareStrings);
}

function assertAllowlist(
  values: readonly string[],
  normalize: (value: string) => string | undefined,
  label: string,
): void {
  if (!Array.isArray(values)) throw new TypeError(`Local MCP ${label} allowlist must be an array`);
  if (!values.every((value) => typeof value === "string" && normalize(value) !== undefined)) {
    throw new TypeError(`Local MCP ${label} allowlist contains an unsafe value`);
  }
}

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes("*")) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return undefined;
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
    if (parsed.protocol === "https:") return parsed.origin.toLowerCase();
    if (parsed.protocol === "http:" && isLocalhostName(parsed.hostname)) {
      return parsed.origin.toLowerCase();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeHost(value: string): string | undefined {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes("*") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("@") ||
    trimmed.includes("://")
  ) {
    return undefined;
  }
  try {
    const parsed = new URL(`https://${trimmed}`);
    if (!parsed.hostname || parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
    return parsed.host;
  } catch {
    return undefined;
  }
}

function isLocalhostName(value: string): boolean {
  const normalized = value.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function assertTrue(value: unknown, label: string): void {
  if (value !== true) throw new TypeError(`Local MCP remote transport requires ${label}`);
}

function assertPositiveInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new TypeError(`Local MCP remote transport requires positive ${label}`);
  }
}

function assertRateLimit(value: unknown): void {
  if (!isValidRateLimit(value)) {
    throw new TypeError("Local MCP remote transport requires positive rate limits");
  }
}

function isValidRateLimit(value: unknown): value is LocalMcpRemoteTransportConfigV1["rateLimit"] {
  return (
    isPlainRecord(value) &&
    Number.isInteger(value.perUserPerMinute) &&
    value.perUserPerMinute > 0 &&
    Number.isInteger(value.perSessionPerMinute) &&
    value.perSessionPerMinute > 0 &&
    Number.isInteger(value.globalPerMinute) &&
    value.globalPerMinute > 0
  );
}

function isWithinSizeLimit(value: number, max: number): boolean {
  return Number.isInteger(value) && Number.isInteger(max) && max > 0 && value <= max;
}

function isRemoteTransportMode(value: unknown): value is LocalMcpRemoteTransportModeV1 {
  return value === "disabled" || value === "non_production_spike_only";
}

function isRemoteTransportKind(value: unknown): value is LocalMcpRemoteTransportKindV1 {
  return value === "none" || value === "stdio_design" || value === "streamable_http_design";
}

function addReason(
  reasons: LocalMcpRemoteTransportBlockReasonV1[],
  reason: LocalMcpRemoteTransportBlockReasonV1,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function cloneConfig(config: LocalMcpRemoteTransportConfigV1): LocalMcpRemoteTransportConfigV1 {
  return {
    ...config,
    allowedOrigins: [...config.allowedOrigins],
    allowedHosts: [...config.allowedHosts],
    rateLimit: { ...config.rateLimit },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
