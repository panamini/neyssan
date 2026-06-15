import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildMcpProductionAccountLinkPersistenceSafeRefusal,
  buildMcpProductionAccountLinkRedactedAuditEvent,
  validateMcpProductionAccountLinkPersistenceBoundary,
  type McpProductionAccountLinkPersistenceBoundaryInputV1,
  type McpProductionAccountLinkPersistenceReasonV1,
  type McpProductionAccountLinkRecordV1,
} from "../mcpProductionAccountLinkPersistenceBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = resolve(TEST_DIR, "../mcpProductionAccountLinkPersistenceBoundary.ts");
const CONVEX_BOUNDARY_SOURCE = resolve(TEST_DIR, "../../../../convex/mcpAccountLinks.ts");
const SCHEMA_SOURCE = resolve(TEST_DIR, "../../../../convex/schema.ts");
const FIXTURE_PROVIDER_SUBJECT = "stytch-member-prod-123";
const FIXTURE_CLIENT_ID = "chatgpt-openai-apps-sdk-client";
const FIXTURE_CLERK_ID = "clerk_prod_owner_123";
const FIXTURE_NOW = 1_781_541_600_000;
const FIXTURE_READ_SCOPES = [
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const;

const FIXTURE_RECORD: McpProductionAccountLinkRecordV1 = {
  kind: "local_mcp_account_link_record",
  version: 1,
  provider: "stytch",
  providerSubject: FIXTURE_PROVIDER_SUBJECT,
  twoweeksClerkId: FIXTURE_CLERK_ID,
  clientId: FIXTURE_CLIENT_ID,
  grantedReadScopes: [...FIXTURE_READ_SCOPES],
  grantRef: "grant_ref_prod_123",
  consentRef: "consent_ref_prod_123",
  state: "active",
  createdAt: FIXTURE_NOW - 10_000,
  updatedAt: FIXTURE_NOW - 5_000,
  lastVerifiedAt: FIXTURE_NOW - 1_000,
  auditReasonCode: "account_link_verified",
};

describe("MCP production account-link persistence boundary", () => {
  it("accepts an active valid link as server-side only", () => {
    const result = validateMcpProductionAccountLinkPersistenceBoundary(buildInput());

    expect(result).toMatchObject({
      kind: "mcp_production_account_link_persistence_result",
      allowed: true,
      reason: "verified_server_only",
      serverOnly: {
        provider: "stytch",
        linkState: "active",
        ownerBinding: "twoweeks_owner_resolved_server_only_not_returned",
        clientCategory: "approved_ai_client",
        grantedReadScopes: [...FIXTURE_READ_SCOPES],
        requiredReadScopes: ["twoweeks.application_package.read", "twoweeks.mcp.read"],
        grantState: "grant_and_consent_refs_present",
        auditReasonCode: "account_link_verified",
        version: 1,
      },
      capabilities: {
        accountLinkPersistence: "server_only",
        provider: "stytch",
        modelVisibility: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        credentialStorage: "none",
        tokenStorage: "none",
        writeActions: "blocked",
        version: 1,
      },
      modelVisible: false,
      version: 1,
    });
  });

  it("rejects missing link", () => {
    expectDenied(buildInput({ accountLinks: [] }), "missing_account_link");
  });

  it("rejects revoked link", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRecord({
            state: "revoked",
            revokedAt: FIXTURE_NOW - 100,
          }),
        ],
      }),
      "revoked_account_link",
    );
  });

  it("rejects stale link", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRecord({
            state: "stale",
            staleAt: FIXTURE_NOW - 100,
          }),
        ],
      }),
      "stale_account_link",
    );
  });

  it("rejects ambiguous active links", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRecord({ grantRef: "grant_ref_prod_a", consentRef: "consent_ref_prod_a" }),
          buildRecord({ grantRef: "grant_ref_prod_b", consentRef: "consent_ref_prod_b" }),
        ],
      }),
      "ambiguous_account_link",
    );
  });

  it("rejects client mismatch", () => {
    expectDenied(
      buildInput({
        accountLinks: [buildRecord({ clientId: "other-approved-client" })],
      }),
      "client_mismatch",
    );
  });

  it("rejects missing required scope", () => {
    expectDenied(
      buildInput({
        requiredReadScopes: ["twoweeks.evidence_graph.read", "twoweeks.mcp.read"],
        accountLinks: [
          buildRecord({
            grantedReadScopes: ["twoweeks.application_package.read", "twoweeks.mcp.read"],
          }),
        ],
      }),
      "missing_required_read_scope",
    );
  });

  it("rejects expired links when an expiry policy exists", () => {
    expectDenied(
      buildInput({
        maxLinkAgeMs: 500,
      }),
      "expired_account_link",
    );
  });

  it("rejects malformed record", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRawRecord({
            grantRef: undefined,
          }),
        ],
      }),
      "malformed_record",
    );
  });

  it("rejects provider other than stytch", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRawRecord({
            provider: "clerk",
          }),
        ],
      }),
      "provider_mismatch",
    );
  });

  it("rejects records where Stytch subject equals Twoweeks owner id", () => {
    expectDenied(
      buildInput({
        accountLinks: [
          buildRecord({
            providerSubject: "shared_owner_id_123",
            twoweeksClerkId: "shared_owner_id_123",
          }),
        ],
      }),
      "malformed_record",
    );
  });

  it("keeps twoweeksClerkId server-only and never model-visible", () => {
    const result = validateMcpProductionAccountLinkPersistenceBoundary(buildInput());
    const serialized = JSON.stringify(result);

    expect(result.allowed).toBe(true);
    expect(serialized).not.toContain(FIXTURE_CLERK_ID);
    expect(serialized).not.toContain(FIXTURE_PROVIDER_SUBJECT);
    expect(serialized).not.toContain(FIXTURE_CLIENT_ID);
    expect(serialized).toContain("twoweeks_owner_resolved_server_only_not_returned");
    expect(result.modelVisible).toBe(false);
  });

  it("rejects token, raw claims, email, raw data, and Convex-id fields in link records", () => {
    for (const forbiddenRecord of [
      buildRawRecord({ accessToken: "secret" }),
      buildRawRecord({ refreshToken: "secret" }),
      buildRawRecord({ rawClaims: { sub: FIXTURE_PROVIDER_SUBJECT } }),
      buildRawRecord({ email: "real-user@example.test" }),
      buildRawRecord({ rawCvText: "raw resume text" }),
      buildRawRecord({ rawJobText: "raw job text" }),
      buildRawRecord({ proposalContent: "full generated artifact" }),
      buildRawRecord({ convexDocumentId: "jd7convexrealid" }),
    ] as const) {
      expectDenied(buildInput({ accountLinks: [forbiddenRecord] }), "malformed_record");
    }
  });

  it("emits only redacted audit/reason categories", () => {
    const auditEvent = buildMcpProductionAccountLinkRedactedAuditEvent({
      eventType: "account_link_refused",
      clientApproved: true,
      requiredReadScopes: ["twoweeks.mcp.read", "twoweeks.application_package.read"],
      linkState: "missing",
      reasonCode: "missing_account_link",
    });
    const serialized = JSON.stringify(auditEvent);

    expect(auditEvent).toEqual({
      kind: "mcp_production_account_link_redacted_audit_event",
      eventType: "account_link_refused",
      clientCategory: "approved_ai_client",
      scopeCategory: "data_class_read",
      linkState: "missing",
      reasonCode: "missing_account_link",
      safeForModel: true,
      version: 1,
    });
    for (const forbidden of [
      FIXTURE_PROVIDER_SUBJECT,
      FIXTURE_CLERK_ID,
      FIXTURE_CLIENT_ID,
      "real-user@example.test",
      "token",
      "rawClaims",
      "jd7convexrealid",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not authorize real CV, job, proposal, profile, application, or artifact reads", () => {
    const result = validateMcpProductionAccountLinkPersistenceBoundary(buildInput());

    expect(result.capabilities.dataReads).toBe("blocked");
    expect(result.capabilities.handlerExecution).toBe("blocked");
    expect(result.capabilities.productionConnector).toBe("blocked");
  });

  it("does not authorize export, download, send, submit, apply, or other write surfaces", () => {
    const result = validateMcpProductionAccountLinkPersistenceBoundary(buildInput());

    expect(result.capabilities.dataWrites).toBe("blocked");
    expect(result.capabilities.writeActions).toBe("blocked");
    expect(result.capabilities.tokenStorage).toBe("none");
    expect(result.capabilities.credentialStorage).toBe("none");
  });

  it("does not import or call forbidden runtime surfaces", () => {
    const boundarySource = readFileSync(BOUNDARY_SOURCE, "utf8");
    const convexSource = readFileSync(CONVEX_BOUNDARY_SOURCE, "utf8");
    const schemaSource = readFileSync(SCHEMA_SOURCE, "utf8");

    expect(boundarySource).not.toMatch(/activeCvSnapshots|profilesPublic|jobsPublic|proposalsPublic/u);
    expect(convexSource).not.toMatch(/activeCvSnapshots|profilesPublic|jobsPublic|proposalsPublic/u);
    expect(convexSource).not.toMatch(/userProfiles|jobs|proposals|applicationArtifacts|applicationPackages/u);
    expect(convexSource).toMatch(/query\("mcpAccountLinks"\)/u);
    expect(schemaSource).toMatch(/mcpAccountLinks: defineTable/u);

    for (const source of [boundarySource, convexSource] as const) {
      const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
        (match) => match[1],
      );
      for (const specifier of importSpecifiers) {
        expect(specifier).not.toMatch(/(?:node:http|node:https|@stytch|openai|langchain|tools\/list|tools\/call)/iu);
      }
      expect(source).not.toMatch(/\bfetch\s*\(/u);
      expect(source).not.toMatch(/\bXMLHttpRequest\b/u);
      expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
      expect(source).not.toMatch(/oauth\/callback|tokenEndpoint|refreshToken|revocationEndpoint/u);
      expect(source).not.toMatch(/\b(?:download|send|submit|apply)\s*\(/u);
    }
  });
});

function expectDenied(
  input: McpProductionAccountLinkPersistenceBoundaryInputV1,
  reason: McpProductionAccountLinkPersistenceReasonV1,
): void {
  expect(validateMcpProductionAccountLinkPersistenceBoundary(input)).toEqual({
    kind: "mcp_production_account_link_persistence_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpProductionAccountLinkPersistenceSafeRefusal(),
    capabilities: {
      accountLinkPersistence: "blocked",
      provider: "stytch",
      modelVisibility: "blocked",
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      writeActions: "blocked",
      version: 1,
    },
    modelVisible: false,
    version: 1,
  });
}

function buildInput(
  overrides: Partial<McpProductionAccountLinkPersistenceBoundaryInputV1> & {
    accountLinks?: readonly unknown[];
  } = {},
): McpProductionAccountLinkPersistenceBoundaryInputV1 {
  return {
    kind: "mcp_production_account_link_persistence_boundary_input",
    providerSubject: FIXTURE_PROVIDER_SUBJECT,
    clientId: FIXTURE_CLIENT_ID,
    requiredReadScopes: ["twoweeks.application_package.read", "twoweeks.mcp.read"],
    accountLinks: [FIXTURE_RECORD],
    now: FIXTURE_NOW,
    version: 1,
    ...overrides,
  };
}

function buildRecord(
  overrides: Partial<McpProductionAccountLinkRecordV1> = {},
): McpProductionAccountLinkRecordV1 {
  return {
    ...FIXTURE_RECORD,
    ...overrides,
    grantedReadScopes: overrides.grantedReadScopes
      ? [...overrides.grantedReadScopes]
      : [...FIXTURE_RECORD.grantedReadScopes],
  };
}

function buildRawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...FIXTURE_RECORD,
    grantedReadScopes: [...FIXTURE_RECORD.grantedReadScopes],
    ...overrides,
  };
}
