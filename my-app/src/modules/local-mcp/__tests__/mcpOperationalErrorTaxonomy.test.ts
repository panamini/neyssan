import { describe, expect, it } from "vitest";

import {
  MCP_OPERATIONAL_ERROR_CATEGORIES,
  assertMcpOperationalErrorCategory,
  isMcpOperationalErrorCategory,
  mapMcpOperationalReasonToCategory,
  parseMcpOperationalErrorCategory,
} from "../mcpOperationalErrorTaxonomy";

describe("mcpOperationalErrorTaxonomy", () => {
  it("keeps the operational categories bounded to the PR83 decision set", () => {
    expect(MCP_OPERATIONAL_ERROR_CATEGORIES).toEqual([
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
    ]);
  });

  it("maps known detailed refusal reasons without accepting arbitrary labels", () => {
    expect(mapMcpOperationalReasonToCategory("missing_bearer_token")).toBe(
      "auth_required",
    );
    expect(mapMcpOperationalReasonToCategory("revoked_account_link")).toBe(
      "account_link_invalid",
    );
    expect(mapMcpOperationalReasonToCategory("rate_limited")).toBe(
      "rate_limited",
    );
    expect(mapMcpOperationalReasonToCategory("provider_authorization_required")).toBe(
      "external_action_disabled",
    );

    expect(mapMcpOperationalReasonToCategory("token pasted into log")).toBe(
      undefined,
    );
    expect(mapMcpOperationalReasonToCategory({ reason: "rate_limited" })).toBe(
      undefined,
    );
  });

  it("parses and asserts only bounded categories", () => {
    expect(isMcpOperationalErrorCategory("privacy_blocked")).toBe(true);
    expect(parseMcpOperationalErrorCategory("privacy_blocked")).toBe(
      "privacy_blocked",
    );
    expect(parseMcpOperationalErrorCategory("arbitrary_metric_label")).toBe(
      undefined,
    );
    expect(() =>
      assertMcpOperationalErrorCategory("arbitrary_metric_label"),
    ).toThrow("Invalid MCP operational error category");
  });
});
