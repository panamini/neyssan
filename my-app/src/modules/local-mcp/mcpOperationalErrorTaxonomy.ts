export const MCP_OPERATIONAL_ERROR_CATEGORIES = [
  "auth_required",
  "auth_invalid",
  "account_link_missing",
  "account_link_invalid",
  "consent_missing",
  "consent_stale",
  "privacy_blocked",
  "feature_disabled",
  "config_invalid",
  "rate_limited",
  "budget_exhausted",
  "stale_confirmation",
  "ownership_mismatch",
  "artifact_stale",
  "destination_invalid",
  "operation_conflict",
  "external_action_disabled",
  "unknown_external_result",
  "dependency_unavailable",
  "internal_validation_error",
] as const;

export type McpOperationalErrorCategoryV1 =
  (typeof MCP_OPERATIONAL_ERROR_CATEGORIES)[number];

const MCP_OPERATIONAL_REASON_CATEGORY_MAP = Object.freeze({
  missing_authorization_header: "auth_required",
  missing_bearer_token: "auth_required",
  missing_token: "auth_required",
  missing_authentication: "auth_required",

  malformed_authorization_header: "auth_invalid",
  malformed_bearer_token: "auth_invalid",
  malformed_jwt: "auth_invalid",
  malformed_jwt_header: "auth_invalid",
  malformed_claims: "auth_invalid",
  malformed_jwks: "auth_invalid",
  unknown_kid: "auth_invalid",
  invalid_issuer: "auth_invalid",
  invalid_audience: "auth_invalid",
  invalid_client: "auth_invalid",
  invalid_scope: "auth_invalid",
  insufficient_scope: "auth_invalid",
  token_expired: "auth_invalid",
  token_not_yet_valid: "auth_invalid",
  token_iat_in_future: "auth_invalid",
  signature_verification_failed: "auth_invalid",
  unsupported_alg: "auth_invalid",

  missing_account_link: "account_link_missing",
  provider_account_not_linked: "account_link_missing",

  malformed_account_link: "account_link_invalid",
  malformed_record: "account_link_invalid",
  provider_mismatch: "account_link_invalid",
  client_mismatch: "account_link_invalid",
  revoked_account_link: "account_link_invalid",
  stale_account_link: "account_link_invalid",
  expired_account_link: "account_link_invalid",
  ambiguous_account_link: "account_link_invalid",
  missing_required_read_scope: "account_link_invalid",
  owner_mapping_invalid: "account_link_invalid",

  missing_consent: "consent_missing",
  consent_required: "consent_missing",
  stale_consent: "consent_stale",
  expired_consent: "consent_stale",

  privacy_guard_refused: "privacy_blocked",
  privacy_blocked: "privacy_blocked",
  local_url_blocked: "privacy_blocked",
  private_network_blocked: "privacy_blocked",
  data_class_disallowed: "privacy_blocked",
  source_guard_rejected: "privacy_blocked",
  sensitive_payload_rejected: "privacy_blocked",

  feature_disabled: "feature_disabled",
  kill_switch_disabled: "feature_disabled",
  manual_handoff_disabled: "feature_disabled",
  live_external_actions_disabled: "feature_disabled",
  write_execution_disabled: "feature_disabled",

  config_invalid: "config_invalid",
  malformed_config: "config_invalid",
  missing_config: "config_invalid",
  missing_jwks: "config_invalid",
  unsafe_config_status: "config_invalid",

  rate_limited: "rate_limited",
  budget_exhausted: "budget_exhausted",
  stale_confirmation: "stale_confirmation",
  confirmation_expired: "stale_confirmation",
  ownership_mismatch: "ownership_mismatch",
  owner_mismatch: "ownership_mismatch",
  artifact_stale: "artifact_stale",
  stale_artifact: "artifact_stale",

  destination_invalid: "destination_invalid",
  invalid_destination: "destination_invalid",
  destination_not_allowlisted: "destination_invalid",
  unsafe_scheme: "destination_invalid",
  redirect_blocked: "destination_invalid",

  operation_conflict: "operation_conflict",
  operation_already_completed: "operation_conflict",
  handoff_already_confirmed: "operation_conflict",

  external_action_disabled: "external_action_disabled",
  provider_authorization_required: "external_action_disabled",
  live_dispatch_disabled: "external_action_disabled",

  unknown_external_result: "unknown_external_result",
  external_result_unknown: "unknown_external_result",

  dependency_unavailable: "dependency_unavailable",
  unavailable_dependency: "dependency_unavailable",

  internal_validation_error: "internal_validation_error",
  invalid_input: "internal_validation_error",
  malformed_input: "internal_validation_error",
} satisfies Readonly<Record<string, McpOperationalErrorCategoryV1>>);

type McpOperationalErrorReasonV1 =
  keyof typeof MCP_OPERATIONAL_REASON_CATEGORY_MAP;

const MCP_OPERATIONAL_ERROR_CATEGORY_SET = new Set<string>(
  MCP_OPERATIONAL_ERROR_CATEGORIES,
);

export function isMcpOperationalErrorCategory(
  value: unknown,
): value is McpOperationalErrorCategoryV1 {
  return (
    typeof value === "string" && MCP_OPERATIONAL_ERROR_CATEGORY_SET.has(value)
  );
}

export function parseMcpOperationalErrorCategory(
  value: unknown,
): McpOperationalErrorCategoryV1 | undefined {
  return isMcpOperationalErrorCategory(value) ? value : undefined;
}

export function assertMcpOperationalErrorCategory(
  value: unknown,
): asserts value is McpOperationalErrorCategoryV1 {
  if (!isMcpOperationalErrorCategory(value)) {
    throw new Error("Invalid MCP operational error category");
  }
}

export function mapMcpOperationalReasonToCategory(
  reason: unknown,
): McpOperationalErrorCategoryV1 | undefined {
  if (
    typeof reason !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      MCP_OPERATIONAL_REASON_CATEGORY_MAP,
      reason,
    )
  ) {
    return undefined;
  }

  return MCP_OPERATIONAL_REASON_CATEGORY_MAP[
    reason as McpOperationalErrorReasonV1
  ];
}
