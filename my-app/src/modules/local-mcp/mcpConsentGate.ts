export type LocalMcpConsentSurfaceV1 =
  | "fixture_only"
  | "future_real_data_read"
  | "future_write_action";

export type LocalMcpConsentPurposeV1 =
  | "fixture_summary_preview"
  | "future_real_data_read"
  | "future_write_action";

export type LocalMcpConsentGrantV1 = Readonly<{
  kind: "local_mcp_consent_grant";
  granted: boolean;
  purposes: readonly LocalMcpConsentPurposeV1[];
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reason?: string;
  version: 1;
}>;

export type LocalMcpConsentGateInputV1 = Readonly<{
  kind: "local_mcp_consent_gate_input";
  requestedSurface: LocalMcpConsentSurfaceV1;
  consent?: unknown;
  version: 1;
}>;

export type LocalMcpConsentGateBlockedReasonV1 =
  | "consent_missing"
  | "consent_malformed"
  | "consent_denied"
  | "consent_expired"
  | "consent_insufficient";

export type LocalMcpConsentGateAllowedReasonV1 =
  | "fixture_only_consent_not_required"
  | "consent_present_for_future_surface";

export type LocalMcpConsentGateResultV1 = Readonly<
  | {
      kind: "local_mcp_consent_gate_result";
      allowed: true;
      requestedSurface: LocalMcpConsentSurfaceV1;
      reason: LocalMcpConsentGateAllowedReasonV1;
      safeSummary: string;
      version: 1;
    }
  | {
      kind: "local_mcp_consent_gate_result";
      allowed: false;
      requestedSurface: LocalMcpConsentSurfaceV1;
      reason: LocalMcpConsentGateBlockedReasonV1;
      safeRefusal: LocalMcpConsentSafeRefusalV1;
      version: 1;
    }
>;

export type LocalMcpConsentSafeRefusalV1 = Readonly<{
  code: "consent_required";
  message: "Refused. Consent boundary blocked.";
  safeForModel: true;
  fixtureOnly: true;
  version: 1;
}>;

const CONSENT_GRANT_KEYS = [
  "kind",
  "granted",
  "purposes",
  "grantedBy",
  "grantedAt",
  "expiresAt",
  "reason",
  "version",
] as const;

export function validateLocalMcpConsentGate(
  input: LocalMcpConsentGateInputV1,
  now: Date = new Date(),
): LocalMcpConsentGateResultV1 {
  if (input.requestedSurface === "fixture_only") {
    return {
      kind: "local_mcp_consent_gate_result",
      allowed: true,
      requestedSurface: input.requestedSurface,
      reason: "fixture_only_consent_not_required",
      safeSummary: "Fixture-only preview remains fake-data-only. Consent does not approve execution.",
      version: 1,
    };
  }

  if (input.consent === undefined) return blocked(input.requestedSurface, "consent_missing");

  const consent = parseLocalMcpConsentGrant(input.consent);
  if (!consent) return blocked(input.requestedSurface, "consent_malformed");
  if (consent.granted !== true) return blocked(input.requestedSurface, "consent_denied");
  if (Date.parse(consent.expiresAt) <= now.getTime()) return blocked(input.requestedSurface, "consent_expired");
  if (!consent.purposes.includes(requiredPurposeForSurface(input.requestedSurface))) {
    return blocked(input.requestedSurface, "consent_insufficient");
  }

  return {
    kind: "local_mcp_consent_gate_result",
    allowed: true,
    requestedSurface: input.requestedSurface,
    reason: "consent_present_for_future_surface",
    safeSummary: "Consent boundary satisfied only. Auth, handler execution, and write actions remain blocked.",
    version: 1,
  };
}

export function buildLocalMcpConsentSafeRefusal(): LocalMcpConsentSafeRefusalV1 {
  return {
    code: "consent_required",
    message: "Refused. Consent boundary blocked.",
    safeForModel: true,
    fixtureOnly: true,
    version: 1,
  };
}

export function parseLocalMcpConsentGrant(value: unknown): LocalMcpConsentGrantV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedKeys(value, CONSENT_GRANT_KEYS)) return undefined;
  if (value.kind !== "local_mcp_consent_grant") return undefined;
  if (typeof value.granted !== "boolean") return undefined;
  if (!Array.isArray(value.purposes) || !value.purposes.every(isConsentPurpose)) return undefined;
  if (value.purposes.length === 0) return undefined;
  if (!hasVisibleText(value.grantedBy)) return undefined;
  if (!isStrictIsoUtcTimestamp(value.grantedAt) || !isStrictIsoUtcTimestamp(value.expiresAt)) return undefined;
  if (value.reason !== undefined && !hasVisibleText(value.reason)) return undefined;
  if (value.version !== 1) return undefined;

  return {
    kind: "local_mcp_consent_grant",
    granted: value.granted,
    purposes: [...value.purposes],
    grantedBy: value.grantedBy,
    grantedAt: value.grantedAt,
    expiresAt: value.expiresAt,
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
    version: 1,
  };
}

function blocked(
  requestedSurface: LocalMcpConsentSurfaceV1,
  reason: LocalMcpConsentGateBlockedReasonV1,
): LocalMcpConsentGateResultV1 {
  return {
    kind: "local_mcp_consent_gate_result",
    allowed: false,
    requestedSurface,
    reason,
    safeRefusal: buildLocalMcpConsentSafeRefusal(),
    version: 1,
  };
}

function requiredPurposeForSurface(surface: Exclude<LocalMcpConsentSurfaceV1, "fixture_only">): LocalMcpConsentPurposeV1 {
  return surface;
}

function isConsentPurpose(value: unknown): value is LocalMcpConsentPurposeV1 {
  return (
    value === "fixture_summary_preview" ||
    value === "future_real_data_read" ||
    value === "future_write_action"
  );
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    hasVisibleText(value) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function hasVisibleText(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value);
}
