import { describe, expect, it } from "vitest";

import {
  buildMcpOperationalAccountLinkStatus,
  buildMcpOperationalEgressStatus,
  buildMcpOperationalLiveExternalActionStatus,
  buildMcpOperationalManualHandoffStatus,
  buildMcpOperationalWriteActionStatus,
} from "../mcpOperationalStatus";

describe("mcpOperationalStatus", () => {
  it("summarizes manual handoff kill-switch state without exposing config values", () => {
    expect(
      buildMcpOperationalManualHandoffStatus({
        kind: "manual_application_handoff_server_config_status",
        featureFlagId: "TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED",
        featureFlagVersion: 1,
        enabled: false,
        configured: false,
        status: "feature_disabled",
        credentialStorage: "none",
        tokenStorage: "none",
        valuesExposed: false,
        version: 1,
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "manual_handoff",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("summarizes live external action status as blocked without provider details", () => {
    expect(
      buildMcpOperationalLiveExternalActionStatus({
        kind: "live_external_action_server_config_status",
        integrationId: "ats_authorization_pending_v1",
        actionCategory: "apply_to_job",
        featureFlagId: "TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED",
        enabled: true,
        configured: false,
        status: "provider_authorization_required",
        missingConfiguration: ["provider_authorization_boundary"],
        credentialStorage: "none",
        tokenStorage: "none",
        valuesExposed: false,
        version: 1,
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "live_external_action",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "external_action_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("fails closed when safe config status includes unsafe material", () => {
    expect(
      buildMcpOperationalManualHandoffStatus({
        enabled: true,
        configured: true,
        status: "enabled",
        credentialStorage: "none",
        tokenStorage: "none",
        valuesExposed: false,
        rawConfig: "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "manual_handoff",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("maps existing account-link, egress, and write-action refusals to bounded categories", () => {
    expect(buildMcpOperationalAccountLinkStatus("missing_account_link")).toMatchObject({
      capability: "account_link",
      category: "account_link_missing",
      valuesExposed: false,
    });
    expect(buildMcpOperationalAccountLinkStatus("revoked_account_link")).toMatchObject({
      capability: "account_link",
      category: "account_link_invalid",
      valuesExposed: false,
    });
    expect(buildMcpOperationalEgressStatus("local_url_blocked")).toMatchObject({
      capability: "outbound_egress",
      category: "privacy_blocked",
      valuesExposed: false,
    });
    expect(buildMcpOperationalWriteActionStatus("write_execution_disabled")).toMatchObject({
      capability: "write_action",
      category: "feature_disabled",
      valuesExposed: false,
    });
  });
});
