import { describe, expect, it } from "vitest";

import {
  buildMcpOperationalAccountLinkStatus,
  buildMcpOperationalEgressStatus,
  buildMcpOperationalLiveExternalActionStatus,
  buildMcpOperationalManualHandoffStatus,
  buildMcpOperationalProductionMcpLaunchReadinessStatus,
  buildMcpOperationalProductionOAuthActivationStatus,
  buildMcpOperationalWriteActionStatus,
} from "../mcpOperationalStatus";
import { buildMcpOAuthProductionActivationConfig } from "../mcpOAuthProductionActivationBoundary";
import {
  evaluateMcpProductionLaunchReadiness,
  type McpProductionLaunchReadinessEvidenceInputV1,
} from "../mcpProductionLaunchReadiness";
import type { McpProductionPrivateBetaGateDecisionV1 } from "../mcpProductionPrivateBetaGate";

const PRODUCTION_OAUTH_PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: "https://mcp.twoweeks.example.test/resource",
  providerEnvironment: "prod_us_1",
  allowedClientIds: ["chatgpt_apps_sdk_client"],
  requiredReadScopes: ["twoweeks:applications:read"],
  version: 1,
} as const;

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

  it("summarizes production OAuth activation as disabled unless both PR89 flags are present", () => {
    expect(
      buildMcpOperationalProductionOAuthActivationStatus(
        buildMcpOAuthProductionActivationConfig({
          providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it.each([
    { runtime: "1" as const },
    { approved: "1" as const },
  ])("keeps production OAuth activation disabled when flags are partial: %j", (flags) => {
    expect(
      buildMcpOperationalProductionOAuthActivationStatus(
        buildMcpOAuthProductionActivationConfig({
          flags,
          providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("summarizes dual-flagged production OAuth activation as runtime-blocked status only", () => {
    expect(
      buildMcpOperationalProductionOAuthActivationStatus(
        buildMcpOAuthProductionActivationConfig({
          flags: { runtime: "1", approved: "1" },
          providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "auth_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("summarizes production MCP launch readiness without exposing evidence values", () => {
    expect(
      buildMcpOperationalProductionMcpLaunchReadinessStatus(
        evaluateMcpProductionLaunchReadiness({
          privateBetaDecision: allowedPrivateBetaDecision(),
          config: {
            publicLaunchRequested: true,
            evidence: completeLaunchReadinessEvidence(),
            version: 1,
          },
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("keeps production MCP launch readiness blocked when config is missing", () => {
    expect(
      buildMcpOperationalProductionMcpLaunchReadinessStatus(
        evaluateMcpProductionLaunchReadiness({
          privateBetaDecision: allowedPrivateBetaDecision(),
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("maps production MCP launch readiness private beta denial to an auth block", () => {
    expect(
      buildMcpOperationalProductionMcpLaunchReadinessStatus(
        evaluateMcpProductionLaunchReadiness({
          privateBetaDecision: deniedPrivateBetaDecision(),
          config: {
            publicLaunchRequested: true,
            evidence: completeLaunchReadinessEvidence(),
            version: 1,
          },
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "auth_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("maps production MCP launch readiness private beta config failures to misconfigured status", () => {
    for (const privateBetaGateCode of [
      "private_beta_missing_config",
      "private_beta_malformed_config",
      "private_beta_empty_allowlist",
    ] as const) {
      expect(
        buildMcpOperationalProductionMcpLaunchReadinessStatus(
          evaluateMcpProductionLaunchReadiness({
            privateBetaDecision: deniedPrivateBetaDecision(privateBetaGateCode),
          }),
        ),
      ).toEqual({
        kind: "mcp_operational_status",
        capability: "production_mcp_launch_readiness",
        enabled: false,
        configValid: false,
        featureState: "misconfigured",
        category: "config_invalid",
        valuesExposed: false,
        version: 1,
      });
    }
  });

  it("maps production MCP launch readiness private beta kill-switch to disabled status", () => {
    expect(
      buildMcpOperationalProductionMcpLaunchReadinessStatus(
        evaluateMcpProductionLaunchReadiness({
          privateBetaDecision: deniedPrivateBetaDecision("private_beta_disabled"),
        }),
      ),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
      valuesExposed: false,
      version: 1,
    });
  });

  it("fails production MCP launch readiness status closed for invalid or unsafe decision shapes", () => {
    const invalidDecision = evaluateMcpProductionLaunchReadiness({
      privateBetaDecision: allowedPrivateBetaDecision(),
      config: { evidence: { policyKernelReviewed: "yes" } },
    });

    expect(buildMcpOperationalProductionMcpLaunchReadinessStatus(invalidDecision)).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
      valuesExposed: false,
      version: 1,
    });
    expect(buildMcpOperationalProductionMcpLaunchReadinessStatus({
      ...invalidDecision,
      rawConfig: "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
    })).toEqual({
      kind: "mcp_operational_status",
      capability: "production_mcp_launch_readiness",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
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

  it("fails closed when production OAuth activation parsing rejects unsafe provider config", () => {
    const parsedConfig = buildMcpOAuthProductionActivationConfig({
      flags: { runtime: "1", approved: "1" },
      providerConfig: {
        ...PRODUCTION_OAUTH_PROVIDER_CONFIG,
        issuer: "http://stytch.example.test/",
      },
    });

    expect(parsedConfig).toMatchObject({
      enabled: false,
      providerConfig: undefined,
      requiredFlags: {
        runtimeValue: "1",
        approvedValue: "1",
      },
    });
    expect(buildMcpOperationalProductionOAuthActivationStatus(parsedConfig)).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("fails closed when production OAuth activation provider config is not a record", () => {
    const parsedConfig = buildMcpOAuthProductionActivationConfig({
      flags: { runtime: "1", approved: "1" },
      providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
    });

    expect(
      buildMcpOperationalProductionOAuthActivationStatus({
        ...parsedConfig,
        providerConfig: null,
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("fails closed when raw production OAuth activation provider config has invalid nested shape", () => {
    const parsedConfig = buildMcpOAuthProductionActivationConfig({
      flags: { runtime: "1", approved: "1" },
      providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
    });

    expect(
      buildMcpOperationalProductionOAuthActivationStatus({
        ...parsedConfig,
        providerConfig: {
          ...PRODUCTION_OAUTH_PROVIDER_CONFIG,
          issuer: "http://stytch.example.test/",
        },
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
      enabled: false,
      configValid: false,
      featureState: "misconfigured",
      category: "config_invalid",
      valuesExposed: false,
      version: 1,
    });
  });

  it("fails closed when production OAuth activation config has unknown keys", () => {
    const parsedConfig = buildMcpOAuthProductionActivationConfig({
      flags: { runtime: "1", approved: "1" },
      providerConfig: PRODUCTION_OAUTH_PROVIDER_CONFIG,
    });

    expect(
      buildMcpOperationalProductionOAuthActivationStatus({
        ...parsedConfig,
        extraStatus: "benign",
      }),
    ).toEqual({
      kind: "mcp_operational_status",
      capability: "production_oauth_activation",
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

function allowedPrivateBetaDecision(): McpProductionPrivateBetaGateDecisionV1 {
  return Object.freeze({
    kind: "mcp_production_private_beta_gate_decision",
    allowed: true,
    code: "private_beta_allowed",
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    version: 1,
  });
}

function deniedPrivateBetaDecision(
  code: Exclude<McpProductionPrivateBetaGateDecisionV1["code"], "private_beta_allowed"> =
    "private_beta_subject_not_allowed",
): McpProductionPrivateBetaGateDecisionV1 {
  return Object.freeze({
    kind: "mcp_production_private_beta_gate_decision",
    allowed: false,
    code,
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    version: 1,
  });
}

function completeLaunchReadinessEvidence(
  overrides: Partial<McpProductionLaunchReadinessEvidenceInputV1> = {},
): McpProductionLaunchReadinessEvidenceInputV1 {
  return {
    publicCatalogSubmissionUrlReviewed: true,
    privateBetaGateReviewed: true,
    authenticatedMcpProtocolReviewed: true,
    policyKernelReviewed: true,
    toolsListMetadataReviewed: true,
    toolsCallReadOnlyReviewed: true,
    readonlySummaryExecutionReviewed: true,
    readonlySummaryStatusReviewed: true,
    schemaMatcherReviewed: true,
    providerWriteExpansionBlocked: true,
    unresolvedBlockingFindings: false,
    version: 1,
    ...overrides,
  };
}
