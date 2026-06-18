export type McpOutboundEgressHttpMethodV1 =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type McpOutboundEgressSchemeV1 = "https" | "http";

export type McpOutboundEgressActionCategoryV1 =
  | "read_only"
  | "send_message"
  | "submit_application"
  | "apply_to_job"
  | "save_artifact"
  | "export_to_destination";

export type McpOutboundEgressDataClassV1 =
  | "safe_summary"
  | "generated_artifact"
  | "application_material"
  | "destination_metadata"
  | "safe_ref"
  | "user_confirmation"
  | "audit_metadata";

export type McpOutboundEgressBlockedReasonV1 =
  | "invalid_url"
  | "unsupported_scheme"
  | "credentials_in_url"
  | "host_not_allowlisted"
  | "localhost_blocked"
  | "private_network_blocked"
  | "link_local_blocked"
  | "metadata_endpoint_blocked"
  | "reserved_ip_blocked"
  | "method_not_allowlisted"
  | "path_not_allowlisted"
  | "port_not_allowlisted"
  | "redirects_disabled"
  | "unsafe_output_metadata";

export type McpOutboundEgressAllowlistRuleV1 = Readonly<{
  id: string;
  host: string;
  includeSubdomains?: boolean;
  schemes?: readonly McpOutboundEgressSchemeV1[];
  methods: readonly McpOutboundEgressHttpMethodV1[];
  pathPrefixes?: readonly string[];
  actionCategory: McpOutboundEgressActionCategoryV1;
  purpose: string;
  dataClasses: readonly McpOutboundEgressDataClassV1[];
  userVisibleReason: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  version: 1;
}>;

export type McpOutboundEgressPolicyV1 = Readonly<{
  kind: "mcp_outbound_egress_policy";
  defaultAllowed: false;
  allowlist: readonly McpOutboundEgressAllowlistRuleV1[];
  redirectPolicy: McpOutboundEgressRedirectPolicyDecisionV1;
  networkRequestExecuted: false;
  externalSideEffect: false;
  persisted: false;
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpOutboundEgressRedirectPolicyInputV1 = Readonly<{
  mode: "disabled" | "follow";
  maxRedirects: number;
  version: 1;
}>;

export type McpOutboundEgressRedirectPolicyDecisionV1 = Readonly<{
  mode: "disabled";
  maxRedirects: 0;
  redirectsFollowed: 0;
  version: 1;
}>;

export type McpOutboundEgressRequestV1 = Readonly<{
  kind: "mcp_outbound_egress_request";
  destinationUrl: string;
  method?: string;
  actionCategory: McpOutboundEgressActionCategoryV1;
  dataClasses: readonly McpOutboundEgressDataClassV1[];
  redirectPolicy?: McpOutboundEgressRedirectPolicyInputV1;
  headers?: Readonly<Record<string, string>>;
  bodyPreview?: unknown;
  version: 1;
}>;

export type McpOutboundEgressDestinationV1 = Readonly<{
  kind: "mcp_outbound_egress_destination";
  scheme: string;
  host: string;
  origin: string;
  port?: number;
  path: string;
  pathClassification: "root_path" | "path_present" | "allowlisted_path_prefix";
  blockedReason?: McpOutboundEgressBlockedReasonV1;
  version: 1;
}>;

export type McpOutboundEgressDecisionV1 = Readonly<
  | {
      kind: "mcp_outbound_egress_decision";
      allowed: true;
      reason: "allowlist_rule_matched";
      userVisibleReason: string;
      normalizedDestination: McpOutboundEgressDestinationV1;
      redactedUrl: string;
      method: McpOutboundEgressHttpMethodV1;
      actionCategory: McpOutboundEgressActionCategoryV1;
      dataClasses: readonly McpOutboundEgressDataClassV1[];
      allowlistRuleId: string;
      purpose: string;
      timeoutMs?: number;
      maxResponseBytes?: number;
      redirectPolicy: McpOutboundEgressRedirectPolicyDecisionV1;
      networkRequestExecuted: false;
      externalSideEffect: false;
      persisted: false;
      credentialStorage: "none";
      tokenStorage: "none";
      version: 1;
    }
  | {
      kind: "mcp_outbound_egress_decision";
      allowed: false;
      reason: McpOutboundEgressBlockedReasonV1;
      userVisibleReason: string;
      normalizedDestination?: McpOutboundEgressDestinationV1;
      redactedUrl: string;
      method: McpOutboundEgressHttpMethodV1 | "UNKNOWN";
      actionCategory?: McpOutboundEgressActionCategoryV1;
      dataClasses: readonly McpOutboundEgressDataClassV1[];
      redirectPolicy: McpOutboundEgressRedirectPolicyDecisionV1;
      networkRequestExecuted: false;
      externalSideEffect: false;
      persisted: false;
      credentialStorage: "none";
      tokenStorage: "none";
      version: 1;
    }
>;

export type McpOutboundEgressSafeRefusalV1 = Readonly<{
  code: "mcp_outbound_egress_blocked";
  message: "Refused. Outbound egress policy blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  networkRequestExecuted: false;
  externalSideEffect: false;
  version: 1;
}>;

export type McpOutboundEgressBlockedResultV1 = Readonly<{
  kind: "mcp_outbound_egress_blocked_result";
  allowed: false;
  decision: Extract<McpOutboundEgressDecisionV1, { allowed: false }>;
  safeRefusal: McpOutboundEgressSafeRefusalV1;
  networkRequestExecuted: false;
  externalSideEffect: false;
  persisted: false;
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

type ParsedRequest = Readonly<{
  destinationUrl: string;
  method: McpOutboundEgressHttpMethodV1 | "UNKNOWN";
  actionCategory: McpOutboundEgressActionCategoryV1;
  dataClasses: readonly McpOutboundEgressDataClassV1[];
  redirectsDisabled: boolean;
}>;

type HostRisk = Readonly<{
  reason: McpOutboundEgressBlockedReasonV1;
}>;

type NormalizedDestinationForPolicy = Readonly<{
  destination: McpOutboundEgressDestinationV1;
  policyPath: string;
}>;

export class McpOutboundEgressBlockedError extends Error {
  readonly decision: Extract<McpOutboundEgressDecisionV1, { allowed: false }>;

  constructor(decision: Extract<McpOutboundEgressDecisionV1, { allowed: false }>) {
    super("Outbound egress policy blocked");
    this.name = "McpOutboundEgressBlockedError";
    this.decision = decision;
  }
}

const DEFAULT_REDIRECT_POLICY: McpOutboundEgressRedirectPolicyDecisionV1 = {
  mode: "disabled",
  maxRedirects: 0,
  redirectsFollowed: 0,
  version: 1,
};

const DEFAULT_POLICY: McpOutboundEgressPolicyV1 = {
  kind: "mcp_outbound_egress_policy",
  defaultAllowed: false,
  allowlist: [],
  redirectPolicy: DEFAULT_REDIRECT_POLICY,
  networkRequestExecuted: false,
  externalSideEffect: false,
  persisted: false,
  credentialStorage: "none",
  tokenStorage: "none",
  version: 1,
};

const HTTP_METHODS = new Set<McpOutboundEgressHttpMethodV1>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

const ACTION_CATEGORIES = new Set<McpOutboundEgressActionCategoryV1>([
  "read_only",
  "send_message",
  "submit_application",
  "apply_to_job",
  "save_artifact",
  "export_to_destination",
]);

const DATA_CLASSES = new Set<McpOutboundEgressDataClassV1>([
  "safe_summary",
  "generated_artifact",
  "application_material",
  "destination_metadata",
  "safe_ref",
  "user_confirmation",
  "audit_metadata",
]);

const SAFE_TEXT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APP|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT|ARGUMENTS)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /STACK_TRACE_SENTINEL_DO_NOT_EXPOSE/u,
  /DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:access|refresh)[_-]?token\b/iu,
  /\b(?:authorization|cookie|set-cookie)\b/iu,
  /\braw[_ -]?(?:cv|resume|job|proposal|application|arguments|text)\b/iu,
  /\b(?:private[_ -]?fact|never[_ -]?use|source[_ -]?quote)\b/iu,
];

const USER_VISIBLE_REASON_BY_BLOCKED_REASON: Readonly<
  Record<McpOutboundEgressBlockedReasonV1, string>
> = {
  invalid_url: "Outbound destination URL is invalid.",
  unsupported_scheme: "Outbound destination scheme is not allowed.",
  credentials_in_url: "Outbound destination must not include embedded credentials.",
  host_not_allowlisted: "Outbound destination is not allowlisted.",
  localhost_blocked: "Localhost destinations are blocked.",
  private_network_blocked: "Private network destinations are blocked.",
  link_local_blocked: "Link-local destinations are blocked.",
  metadata_endpoint_blocked: "Cloud metadata destinations are blocked.",
  reserved_ip_blocked: "Reserved network destinations are blocked.",
  method_not_allowlisted: "Outbound method is not allowlisted.",
  path_not_allowlisted: "Outbound path is not allowlisted.",
  port_not_allowlisted: "Outbound destination port is not allowlisted.",
  redirects_disabled: "Outbound redirects are disabled.",
  unsafe_output_metadata: "Outbound egress metadata is unsafe.",
};

const UNSAFE_RULE_HOST_FRAGMENTS = ["*", "/", "\\", "@", "://"] as const;
const DOCUMENTATION_IPV4_PREFIXES: readonly (readonly number[])[] = [
  [192, 0, 0],
  [192, 0, 2],
  [198, 51, 100],
  [203, 0, 113],
] as const;

export function createMcpOutboundEgressPolicy(
  input: Readonly<{
    allowlist?: readonly McpOutboundEgressAllowlistRuleV1[];
  }> = {},
): McpOutboundEgressPolicyV1 {
  const allowlist = (input.allowlist ?? []).map(normalizeAllowlistRule);
  return {
    ...DEFAULT_POLICY,
    allowlist: allowlist.sort((left, right) => compareStrings(left.id, right.id)),
  };
}

export function evaluateMcpOutboundEgressRequest(
  input: unknown,
  policy: McpOutboundEgressPolicyV1 = DEFAULT_POLICY,
): McpOutboundEgressDecisionV1 {
  const parsedRequest = parseRequest(input);
  if (!parsedRequest) {
    return createBlockedDecision("invalid_url", undefined, undefined);
  }

  const normalizedDestination = normalizeMcpOutboundDestinationForPolicy(
    parsedRequest.destinationUrl,
  );
  if (!normalizedDestination) {
    return createBlockedDecision("invalid_url", parsedRequest, undefined);
  }
  const { destination, policyPath } = normalizedDestination;
  if (destination.blockedReason === "unsupported_scheme") {
    return createBlockedDecision(
      "unsupported_scheme",
      parsedRequest,
      destination,
    );
  }
  if (destination.blockedReason === "credentials_in_url") {
    return createBlockedDecision(
      "credentials_in_url",
      parsedRequest,
      destination,
    );
  }

  const hostRisk = classifyHostRisk(destination.host);
  if (hostRisk) {
    return createBlockedDecision(hostRisk.reason, parsedRequest, destination);
  }
  if (parsedRequest.redirectsDisabled === false) {
    return createBlockedDecision("redirects_disabled", parsedRequest, destination);
  }

  const hostRules = policy.allowlist.filter((rule) =>
    hostMatchesRule(destination.host, rule),
  );
  if (hostRules.length === 0) {
    return createBlockedDecision(
      "host_not_allowlisted",
      parsedRequest,
      destination,
    );
  }

  const schemeRules = hostRules.filter((rule) =>
    (rule.schemes ?? ["https"]).includes(
      destination.scheme as McpOutboundEgressSchemeV1,
    ),
  );
  if (schemeRules.length === 0) {
    return createBlockedDecision(
      "unsupported_scheme",
      parsedRequest,
      destination,
    );
  }
  if (!defaultPortAllowed(destination)) {
    return createBlockedDecision("port_not_allowlisted", parsedRequest, destination);
  }

  const methodRules = schemeRules.filter((rule) =>
    parsedRequest.method !== "UNKNOWN" && rule.methods.includes(parsedRequest.method),
  );
  if (methodRules.length === 0) {
    return createBlockedDecision(
      "method_not_allowlisted",
      parsedRequest,
      destination,
    );
  }

  const pathRules = methodRules.filter((rule) =>
    pathMatchesRule(policyPath, rule),
  );
  if (pathRules.length === 0) {
    return createBlockedDecision("path_not_allowlisted", parsedRequest, destination);
  }

  const rule = pathRules.find((candidate) =>
    candidate.actionCategory === parsedRequest.actionCategory &&
    dataClassesAllowed(parsedRequest.dataClasses, candidate.dataClasses),
  );
  if (!rule) {
    return createBlockedDecision(
      "host_not_allowlisted",
      parsedRequest,
      destination,
    );
  }

  return createAllowedOutboundEgressDecision(
    parsedRequest,
    {
      ...destination,
      pathClassification: "allowlisted_path_prefix",
    },
    rule,
  );
}

export function assertMcpOutboundEgressAllowed(
  input: unknown,
  policy: McpOutboundEgressPolicyV1 = DEFAULT_POLICY,
): Extract<McpOutboundEgressDecisionV1, { allowed: true }> {
  const decision = evaluateMcpOutboundEgressRequest(input, policy);
  if (!decision.allowed) {
    throw new McpOutboundEgressBlockedError(decision);
  }
  return decision;
}

function createAllowedOutboundEgressDecision(
  request: ParsedRequest,
  destination: McpOutboundEgressDestinationV1,
  rule: McpOutboundEgressAllowlistRuleV1,
): Extract<McpOutboundEgressDecisionV1, { allowed: true }> {
  return {
    kind: "mcp_outbound_egress_decision",
    allowed: true,
    reason: "allowlist_rule_matched",
    userVisibleReason: rule.userVisibleReason,
    normalizedDestination: destination,
    redactedUrl: redactedUrlFromDestination(destination),
    method: request.method === "UNKNOWN" ? "GET" : request.method,
    actionCategory: request.actionCategory,
    dataClasses: [...request.dataClasses],
    allowlistRuleId: rule.id,
    purpose: rule.purpose,
    ...(rule.timeoutMs ? { timeoutMs: rule.timeoutMs } : {}),
    ...(rule.maxResponseBytes ? { maxResponseBytes: rule.maxResponseBytes } : {}),
    redirectPolicy: DEFAULT_REDIRECT_POLICY,
    networkRequestExecuted: false,
    externalSideEffect: false,
    persisted: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

export function createMcpBlockedOutboundEgressResult(
  decision: McpOutboundEgressDecisionV1,
): McpOutboundEgressBlockedResultV1 {
  const blockedDecision = decision.allowed
    ? createBlockedDecision(
        "unsafe_output_metadata",
        {
          destinationUrl: decision.redactedUrl,
          method: decision.method,
          actionCategory: decision.actionCategory,
          dataClasses: decision.dataClasses,
          redirectsDisabled: true,
        },
        decision.normalizedDestination,
      )
    : decision;
  return {
    kind: "mcp_outbound_egress_blocked_result",
    allowed: false,
    decision: blockedDecision,
    safeRefusal: {
      code: "mcp_outbound_egress_blocked",
      message: "Refused. Outbound egress policy blocked.",
      safeForModel: true,
      rawDataExposed: false,
      componentDataExposed: false,
      networkRequestExecuted: false,
      externalSideEffect: false,
      version: 1,
    },
    networkRequestExecuted: false,
    externalSideEffect: false,
    persisted: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

export function normalizeMcpOutboundDestination(
  value: string,
): McpOutboundEgressDestinationV1 | undefined {
  return normalizeMcpOutboundDestinationForPolicy(value)?.destination;
}

function normalizeMcpOutboundDestinationForPolicy(
  value: string,
): NormalizedDestinationForPolicy | undefined {
  const parsed = parseUrl(value);
  if (!parsed) return undefined;

  const scheme = parsed.protocol.replace(/:$/u, "").toLowerCase();
  const host = normalizeParsedHost(parsed.hostname);
  const policyPath = parsed.pathname || "/";
  const path = safePathForAudit(policyPath);
  const port = parsePort(parsed.port);
  const destination: McpOutboundEgressDestinationV1 = {
    kind: "mcp_outbound_egress_destination",
    scheme,
    host,
    origin: buildSafeOrigin(scheme, host, parsed.port),
    ...(port ? { port } : {}),
    path,
    pathClassification: path === "/" ? "root_path" : "path_present",
    ...(!isHttpScheme(scheme) ? { blockedReason: "unsupported_scheme" as const } : {}),
    ...((parsed.username || parsed.password)
      ? { blockedReason: "credentials_in_url" as const }
      : {}),
    version: 1,
  };
  return { destination, policyPath };
}

export function redactMcpOutboundUrlForAudit(value: string): string {
  const destination = normalizeMcpOutboundDestination(value);
  if (!destination) return "invalid_url";
  return redactedUrlFromDestination(destination);
}

function parseRequest(input: unknown): ParsedRequest | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    record.kind !== "mcp_outbound_egress_request" ||
    record.version !== 1 ||
    typeof record.destinationUrl !== "string" ||
    !isActionCategory(record.actionCategory)
  ) {
    return undefined;
  }
  const dataClasses = parseDataClasses(record.dataClasses);
  if (!dataClasses) return undefined;
  const method = normalizeMethod(record.method ?? "GET");
  return {
    destinationUrl: record.destinationUrl,
    method,
    actionCategory: record.actionCategory,
    dataClasses,
    redirectsDisabled: parseRedirectPolicy(record.redirectPolicy),
  };
}

function normalizeAllowlistRule(
  rule: McpOutboundEgressAllowlistRuleV1,
): McpOutboundEgressAllowlistRuleV1 {
  assertValidAllowlistRuleMetadata(rule);
  const normalizedHost = requireRulePart(normalizeRuleHost(rule.host));
  const schemes = requireRulePart(normalizeSchemes(rule.schemes ?? ["https"]));
  const methods = requireRulePart(normalizeMethods(rule.methods));
  const pathPrefixes = requireRulePart(
    normalizePathPrefixes(rule.pathPrefixes ?? ["/"]),
  );
  const dataClasses = requireRulePart(parseDataClasses(rule.dataClasses));
  return {
    id: rule.id,
    host: normalizedHost,
    ...(rule.includeSubdomains ? { includeSubdomains: true } : {}),
    schemes,
    methods,
    pathPrefixes,
    actionCategory: rule.actionCategory,
    purpose: rule.purpose,
    dataClasses,
    userVisibleReason: rule.userVisibleReason,
    ...(rule.timeoutMs ? { timeoutMs: rule.timeoutMs } : {}),
    ...(rule.maxResponseBytes ? { maxResponseBytes: rule.maxResponseBytes } : {}),
    version: 1,
  };
}

function createBlockedDecision(
  reason: McpOutboundEgressBlockedReasonV1,
  request: ParsedRequest | undefined,
  destination: McpOutboundEgressDestinationV1 | undefined,
): Extract<McpOutboundEgressDecisionV1, { allowed: false }> {
  return {
    kind: "mcp_outbound_egress_decision",
    allowed: false,
    reason,
    userVisibleReason: userVisibleReasonFor(reason),
    ...(destination ? { normalizedDestination: destination } : {}),
    redactedUrl: destination ? redactedUrlFromDestination(destination) : "invalid_url",
    method: request?.method ?? "UNKNOWN",
    ...(request ? { actionCategory: request.actionCategory } : {}),
    dataClasses: request ? [...request.dataClasses] : [],
    redirectPolicy: DEFAULT_REDIRECT_POLICY,
    networkRequestExecuted: false,
    externalSideEffect: false,
    persisted: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function classifyHostRisk(host: string): HostRisk | undefined {
  const normalizedHost = stripTrailingDot(host.toLowerCase());
  if (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost")
  ) {
    return { reason: "localhost_blocked" };
  }
  if (
    normalizedHost === "metadata.google.internal" ||
    normalizedHost.endsWith(".metadata.google.internal")
  ) {
    return { reason: "metadata_endpoint_blocked" };
  }
  const ipv4 = parseIPv4Address(normalizedHost);
  if (ipv4) return classifyIPv4Risk(ipv4);
  const ipv6 = parseIPv6Address(normalizedHost);
  if (ipv6) return classifyIPv6Risk(ipv6);
  return undefined;
}

function classifyIPv4Risk(ipv4: readonly number[]): HostRisk | undefined {
  if (isMetadataIPv4(ipv4)) {
    return { reason: "metadata_endpoint_blocked" };
  }
  if (isLoopbackIPv4(ipv4)) return { reason: "localhost_blocked" };
  if (isPrivateIPv4(ipv4)) return { reason: "private_network_blocked" };
  if (isLinkLocalIPv4(ipv4)) return { reason: "link_local_blocked" };
  if (isReservedIPv4(ipv4)) return { reason: "reserved_ip_blocked" };
  return undefined;
}

function classifyIPv6Risk(ipv6: readonly number[]): HostRisk | undefined {
  if (isIpv6Loopback(ipv6)) return { reason: "localhost_blocked" };
  const mappedIpv4 = ipv4FromMappedIpv6(ipv6);
  if (mappedIpv4) return classifyIPv4Risk(mappedIpv4);
  const first = ipv6[0];
  if (ipv6.every((segment) => segment === 0)) {
    return { reason: "reserved_ip_blocked" };
  }
  if ((first & 0xfe00) === 0xfc00) {
    return { reason: "private_network_blocked" };
  }
  if ((first & 0xffc0) === 0xfe80) {
    return { reason: "link_local_blocked" };
  }
  if ((first & 0xff00) === 0xff00 || (first === 0x2001 && ipv6[1] === 0x0db8)) {
    return { reason: "reserved_ip_blocked" };
  }
  return undefined;
}

function hostMatchesRule(
  host: string,
  rule: McpOutboundEgressAllowlistRuleV1,
): boolean {
  const normalizedHost = stripTrailingDot(host.toLowerCase());
  const normalizedRuleHost = stripTrailingDot(rule.host.toLowerCase());
  return (
    normalizedHost === normalizedRuleHost ||
    Boolean(
      rule.includeSubdomains &&
        normalizedHost.endsWith(`.${normalizedRuleHost}`),
    )
  );
}

function pathMatchesRule(
  path: string,
  rule: McpOutboundEgressAllowlistRuleV1,
): boolean {
  return (rule.pathPrefixes ?? ["/"]).some((prefix) =>
    pathMatchesPrefix(path, prefix),
  );
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  if (prefix === "/") return true;
  if (prefix.endsWith("/")) return path.startsWith(prefix);
  return path === prefix || path.startsWith(`${prefix}/`);
}

function defaultPortAllowed(destination: McpOutboundEgressDestinationV1): boolean {
  if (destination.port === undefined) return true;
  if (destination.scheme === "https") return destination.port === 443;
  if (destination.scheme === "http") return destination.port === 80;
  return false;
}

function dataClassesAllowed(
  requested: readonly McpOutboundEgressDataClassV1[],
  allowed: readonly McpOutboundEgressDataClassV1[],
): boolean {
  return requested.every((item) => allowed.includes(item));
}

function parseRedirectPolicy(
  input: unknown,
): boolean {
  if (input === undefined) return true;
  const record = readPlainObjectRecord(input);
  return Boolean(
    record &&
      record.mode === "disabled" &&
      record.maxRedirects === 0 &&
      record.version === 1,
  );
}

function parseDataClasses(
  input: unknown,
): readonly McpOutboundEgressDataClassV1[] | undefined {
  if (!Array.isArray(input) || input.length === 0 || input.length > 12) {
    return undefined;
  }
  const output: McpOutboundEgressDataClassV1[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !DATA_CLASSES.has(item)) return undefined;
    if (!output.includes(item)) output.push(item);
  }
  return output;
}

function normalizeMethod(input: unknown): McpOutboundEgressHttpMethodV1 | "UNKNOWN" {
  if (typeof input !== "string") return "UNKNOWN";
  const normalized = input.trim().toUpperCase();
  return HTTP_METHODS.has(normalized as McpOutboundEgressHttpMethodV1)
    ? (normalized as McpOutboundEgressHttpMethodV1)
    : "UNKNOWN";
}

function normalizeMethods(
  input: readonly McpOutboundEgressHttpMethodV1[],
): readonly McpOutboundEgressHttpMethodV1[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const methods = input.map(normalizeMethod);
  if (methods.some((method) => method === "UNKNOWN")) return undefined;
  return [...new Set(methods as McpOutboundEgressHttpMethodV1[])].sort(
    compareStrings,
  );
}

function normalizeSchemes(
  input: readonly McpOutboundEgressSchemeV1[],
): readonly McpOutboundEgressSchemeV1[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const schemes = input.map((scheme) => scheme.toLowerCase());
  if (!schemes.every((scheme) => scheme === "https" || scheme === "http")) {
    return undefined;
  }
  return [...new Set(schemes as McpOutboundEgressSchemeV1[])].sort(compareStrings);
}

function normalizePathPrefixes(
  input: readonly string[],
): readonly string[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const prefixes = input.map((prefix) =>
    typeof prefix === "string" && prefix.startsWith("/") && isSafePath(prefix)
      ? prefix
      : undefined,
  );
  if (prefixes.some((prefix) => prefix === undefined)) return undefined;
  return [...new Set(prefixes as string[])].sort(compareStrings);
}

function normalizeRuleHost(value: string): string | undefined {
  if (!isSafeRuleHostText(value)) return undefined;
  const parsed = parseUrl(`https://${value.trim()}`);
  if (!isRootHostRuleUrl(parsed)) return undefined;
  return normalizeParsedHost(parsed.hostname);
}

function assertValidAllowlistRuleMetadata(
  rule: McpOutboundEgressAllowlistRuleV1,
): void {
  const checks = [
    isSafeRuleId(rule.id),
    isActionCategory(rule.actionCategory),
    isSafeText(rule.purpose, 300),
    isSafeText(rule.userVisibleReason, 240),
    isOptionalPositiveInteger(rule.timeoutMs),
    isOptionalPositiveInteger(rule.maxResponseBytes),
    rule.version === 1,
  ];
  if (checks.every(Boolean)) return;
  throw new TypeError("Local MCP outbound egress allowlist rule is invalid");
}

function requireRulePart<T>(value: T | undefined): T {
  if (value !== undefined) return value;
  throw new TypeError("Local MCP outbound egress allowlist rule is invalid");
}

function isSafeRuleHostText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    UNSAFE_RULE_HOST_FRAGMENTS.every((fragment) => !value.includes(fragment))
  );
}

function isRootHostRuleUrl(value: URL | undefined): value is URL {
  return Boolean(
    value &&
      value.pathname === "/" &&
      value.search.length === 0 &&
      value.hash.length === 0,
  );
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function parsePort(value: string): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

function normalizeParsedHost(host: string): string {
  return stripTrailingDot(
    host.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, ""),
  );
}

function stripTrailingDot(value: string): string {
  return value.replace(/\.+$/u, "");
}

function isHttpScheme(value: string): value is McpOutboundEgressSchemeV1 {
  return value === "https" || value === "http";
}

function buildSafeOrigin(scheme: string, host: string, port: string): string {
  const hostForOrigin = host.includes(":") ? `[${host}]` : host;
  const portSuffix = port ? `:${port}` : "";
  return `${scheme}://${hostForOrigin}${portSuffix}`;
}

function redactedUrlFromDestination(
  destination: McpOutboundEgressDestinationV1,
): string {
  return `${destination.origin}${destination.path}`;
}

function safePathForAudit(path: string): string {
  const normalized = path || "/";
  return isSafePath(normalized) ? normalized : "/redacted-path";
}

function isSafePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    path.length <= 256 &&
    !SAFE_TEXT_PATTERNS.some((pattern) => pattern.test(path.normalize("NFKC")))
  );
}

function isSafeRuleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^mcp-egress-rule:[a-z0-9][a-z0-9._:-]{1,96}$/u.test(value) &&
    isSafeText(value, 120)
  );
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= maxLength &&
    !SAFE_TEXT_PATTERNS.some((pattern) => pattern.test(value.normalize("NFKC")))
  );
}

function isActionCategory(
  value: unknown,
): value is McpOutboundEgressActionCategoryV1 {
  return typeof value === "string" && ACTION_CATEGORIES.has(value);
}

function isOptionalPositiveInteger(value: unknown): boolean {
  return (
    value === undefined ||
    (Number.isInteger(value) && (value as number) > 0 && (value as number) <= 10_000_000)
  );
}

function parseIPv4Address(value: string): readonly number[] | undefined {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value)) return undefined;
  const parts = value.split(".").map((part) => Number(part));
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : undefined;
}

function isMetadataIPv4(ipv4: readonly number[]): boolean {
  return ipv4[0] === 169 && ipv4[1] === 254 && ipv4[2] === 169 && ipv4[3] === 254;
}

function isLoopbackIPv4(ipv4: readonly number[]): boolean {
  return ipv4[0] === 127;
}

function isPrivateIPv4(ipv4: readonly number[]): boolean {
  const [first, second] = ipv4;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isLinkLocalIPv4(ipv4: readonly number[]): boolean {
  return ipv4[0] === 169 && ipv4[1] === 254;
}

function isReservedIPv4(ipv4: readonly number[]): boolean {
  return (
    ipv4[0] === 0 ||
    isDocumentationIPv4(ipv4) ||
    isBenchmarkIPv4(ipv4) ||
    ipv4[0] >= 224 ||
    ipv4.every((part) => part === 255)
  );
}

function isDocumentationIPv4(ipv4: readonly number[]): boolean {
  return DOCUMENTATION_IPV4_PREFIXES.some((prefix) =>
    prefix.every((part, index) => ipv4[index] === part),
  );
}

function isBenchmarkIPv4(ipv4: readonly number[]): boolean {
  return ipv4[0] === 198 && (ipv4[1] === 18 || ipv4[1] === 19);
}

function parseIPv6Address(value: string): readonly number[] | undefined {
  if (!value.includes(":") || value.includes("%")) return undefined;
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const left = parseIPv6SegmentList(halves[0]);
  const right = halves.length === 2 ? parseIPv6SegmentList(halves[1]) : [];
  return left && right
    ? expandIPv6Segments(left, right, halves.length === 2)
    : undefined;
}

function expandIPv6Segments(
  left: readonly number[],
  right: readonly number[],
  hasCompression: boolean,
): readonly number[] | undefined {
  if (!hasCompression) return left.length === 8 ? left : undefined;
  const missing = 8 - left.length - right.length;
  return missing >= 1
    ? [...left, ...Array.from({ length: missing }, () => 0), ...right]
    : undefined;
}

function parseIPv6SegmentList(value: string): readonly number[] | undefined {
  if (value.length === 0) return [];
  const output: number[] = [];
  for (const segment of value.split(":")) {
    if (segment.includes(".")) {
      const ipv4 = parseIPv4Address(segment);
      if (!ipv4) return undefined;
      output.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      continue;
    }
    if (!/^[0-9a-f]{1,4}$/iu.test(segment)) return undefined;
    output.push(Number.parseInt(segment, 16));
  }
  return output;
}

function isIpv6Loopback(ipv6: readonly number[]): boolean {
  return ipv6.slice(0, 7).every((segment) => segment === 0) && ipv6[7] === 1;
}

function ipv4FromMappedIpv6(ipv6: readonly number[]): readonly number[] | undefined {
  const isMapped =
    ipv6.slice(0, 5).every((segment) => segment === 0) && ipv6[5] === 0xffff;
  const isCompatible =
    ipv6.slice(0, 6).every((segment) => segment === 0) &&
    (ipv6[6] !== 0 || ipv6[7] > 1);
  if (!isMapped && !isCompatible) return undefined;
  return [
    (ipv6[6] >> 8) & 0xff,
    ipv6[6] & 0xff,
    (ipv6[7] >> 8) & 0xff,
    ipv6[7] & 0xff,
  ];
}

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isPlainObjectCandidate(value)) return undefined;
  return readPlainObjectDescriptorValues(value);
}

function isPlainObjectCandidate(value: unknown): value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return readObjectPrototype(value) !== undefined;
}

function readObjectPrototype(value: object): object | null | undefined {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null
      ? prototype
      : undefined;
  } catch {
    return undefined;
  }
}

function readPlainObjectDescriptorValues(
  value: object,
): Record<string, unknown> | undefined {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(descriptors).length > 0) return undefined;
    const record: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor
  );
}

function userVisibleReasonFor(reason: McpOutboundEgressBlockedReasonV1): string {
  return USER_VISIBLE_REASON_BY_BLOCKED_REASON[reason];
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
