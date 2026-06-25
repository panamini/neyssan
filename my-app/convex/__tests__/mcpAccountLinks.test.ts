import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyMcpAccountLinkCanonicalStorageRecord,
  internalCreateMcpAccountLink,
  internalLinkCanonicalMcpAccount,
  internalLookupMcpAuthPolicyAccountLinkCandidates,
  internalMarkMcpAccountLinkState,
  internalRefreshCanonicalMcpAccountLink,
  internalRevokeCanonicalMcpAccountLink,
  internalResolveActiveMcpAccountLink,
  MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES,
  projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate,
  type McpAccountLinkCanonicalPolicyCandidateV1,
  type McpAccountLinkLifecycleConfigV1,
  type McpTrustedAccountLinkOwnerV1,
  type McpVerifiedAccountLinkEvidenceV1,
} from "../mcpAccountLinks";
import {
  resolveMcpAuthPolicyAccountLink,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAuthorizedPrincipalV1,
} from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../mcpAccountLinks.ts");
const SCHEMA_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../schema.ts");
const NOW = Date.UTC(2026, 5, 20, 12, 0, 0, 0);
const NOW_SECONDS = Math.floor(NOW / 1000);
const REQUIRED_READ_SCOPES = ["twoweeks.mcp.read"] as const;
const GRANTED_READ_SCOPES = [
  "twoweeks.mcp.read",
  "twoweeks.application_package.read",
] as const;
const CANONICAL_READ_SCOPE = TWOWEEKS_APPLICATIONS_READ_SCOPE;
const CANONICAL_ISSUER = "https://auth.example.test/oauth";
const CANONICAL_ENVIRONMENT = "production";
const CANONICAL_RESOURCE = "https://mcp.example.test/mcp";
const UNSAFE_EPOCH_SECONDS_CASES = [
  ["Number.MAX_SAFE_INTEGER", Number.MAX_SAFE_INTEGER],
  ["1e100", 1e100],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["NaN", Number.NaN],
  ["decimal", NOW_SECONDS + 0.5],
  ["negative", -1],
] as const;
const TOKEN_STORAGE_FIELD_NAMES = [
  "accessToken",
  "refreshToken",
  "idToken",
  "authorizationHeader",
  "clientSecret",
  "rawClaims",
  "providerCredentials",
  "sessionCookie",
  "cookie",
] as const;

type McpAccountLinkRecord = {
  kind: "local_mcp_account_link_record";
  version: 1;
  provider: "stytch";
  providerSubject: string;
  twoweeksClerkId: string;
  clientId: string;
  grantedReadScopes: string[];
  grantRef: string;
  consentRef: string;
  state: "active" | "revoked" | "stale";
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number;
  revokedAt?: number;
  staleAt?: number;
  auditReasonCode: string;
  issuer?: string;
  providerEnvironment?: string;
  canonicalGrantedScopes?: string[];
  expiresAtEpochSeconds?: number;
  canonicalAccountLinkVersion?: 1;
};

type StoredMcpAccountLink = McpAccountLinkRecord & {
  _id: string;
  _creationTime: number;
};

type Constraint = Readonly<{ field: string; value: unknown }>;
type IndexCall = Readonly<{ indexName: string; constraints: readonly Constraint[] }>;

function accountLinkRecord(overrides: Partial<McpAccountLinkRecord> = {}): McpAccountLinkRecord {
  return {
    kind: "local_mcp_account_link_record",
    version: 1,
    provider: "stytch",
    providerSubject: "stytch_subject_fixture_123",
    twoweeksClerkId: "user_fixture_123",
    clientId: "stytch_client_fixture_123",
    grantedReadScopes: [...GRANTED_READ_SCOPES],
    grantRef: "grant:fixture:123",
    consentRef: "consent:fixture:123",
    state: "active",
    createdAt: NOW,
    updatedAt: NOW,
    lastVerifiedAt: NOW,
    auditReasonCode: "account_link_verified",
    ...overrides,
  };
}

function canonicalAccountLinkRecord(overrides: Partial<McpAccountLinkRecord> = {}): McpAccountLinkRecord {
  return accountLinkRecord({
    issuer: CANONICAL_ISSUER,
    providerEnvironment: CANONICAL_ENVIRONMENT,
    canonicalGrantedScopes: [CANONICAL_READ_SCOPE],
    expiresAtEpochSeconds: NOW_SECONDS + 3_600,
    canonicalAccountLinkVersion: 1,
    ...overrides,
  });
}

function storedAccountLink(overrides: Partial<StoredMcpAccountLink> = {}): StoredMcpAccountLink {
  const id = typeof overrides._id === "string" ? overrides._id : "mcpAccountLinks_fixture_1";
  return {
    ...accountLinkRecord(overrides),
    _id: id,
    _creationTime: NOW,
    ...overrides,
  };
}

function makeCtx(seed: StoredMcpAccountLink[] = []) {
  const rows = seed.map((row) => ({
    ...row,
    grantedReadScopes: [...row.grantedReadScopes],
    ...(row.canonicalGrantedScopes ? { canonicalGrantedScopes: [...row.canonicalGrantedScopes] } : {}),
  }));
  const patches: Array<{ id: string; patch: Partial<StoredMcpAccountLink> }> = [];
  const inserts: McpAccountLinkRecord[] = [];
  const indexCalls: IndexCall[] = [];
  let nextId = rows.length + 1;

  function applyConstraints(documents: StoredMcpAccountLink[], constraints: Constraint[]) {
    return documents.filter((document) =>
      constraints.every((constraint) => document[constraint.field as keyof StoredMcpAccountLink] === constraint.value),
    );
  }

  const db = {
    query: (tableName: string) => {
      if (tableName !== "mcpAccountLinks") throw new Error(`Unexpected table ${tableName}`);
      return {
        withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
          const constraints: Constraint[] = [];
          const query = {
            eq(field: string, value: unknown) {
              constraints.push({ field, value });
              return query;
            },
          };
          buildQuery(query);
          indexCalls.push({
            indexName: _indexName,
            constraints: constraints.map((constraint) => ({ ...constraint })),
          });
          const matching = applyConstraints(rows, constraints);
          return {
            collect: async () => matching,
            take: async (limit: number) => matching.slice(0, limit),
          };
        },
      };
    },
    insert: async (tableName: string, record: McpAccountLinkRecord) => {
      if (tableName !== "mcpAccountLinks") throw new Error(`Unexpected table ${tableName}`);
      const id = `mcpAccountLinks_fixture_${nextId++}`;
      inserts.push(record);
      rows.push({ ...record, _id: id, _creationTime: NOW });
      return id;
    },
    patch: async (id: string, patch: Partial<StoredMcpAccountLink>) => {
      const row = rows.find((item) => item._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      patches.push({ id, patch });
      Object.assign(row, patch);
    },
  };

  return { ctx: { db }, rows, patches, inserts, indexCalls };
}

async function resolveWith(seed: StoredMcpAccountLink[]) {
  const { ctx } = makeCtx(seed);
  return await internalResolveActiveMcpAccountLink._handler(ctx as any, {
    providerSubject: "stytch_subject_fixture_123",
    clientId: "stytch_client_fixture_123",
    requiredReadScopes: [...REQUIRED_READ_SCOPES],
    now: NOW,
    maxLinkAgeMs: 1_000,
  });
}

async function lookupPolicyCandidatesWith(seed: StoredMcpAccountLink[]) {
  const { ctx, indexCalls } = makeCtx(seed);
  const candidates = await internalLookupMcpAuthPolicyAccountLinkCandidates._handler(ctx as any, {
    issuer: CANONICAL_ISSUER,
    subject: "stytch_subject_fixture_123",
    providerEnvironment: CANONICAL_ENVIRONMENT,
    version: 1,
  });
  return { candidates, indexCalls };
}

function authorizedPrincipal(
  overrides: Partial<McpAuthPolicyAuthorizedPrincipalV1> = {},
): McpAuthPolicyAuthorizedPrincipalV1 {
  return {
    kind: "mcp_auth_policy_authorized_principal",
    issuer: CANONICAL_ISSUER,
    subject: "stytch_subject_fixture_123",
    audience: "https://mcp.example.test/mcp",
    clientId: "stytch_client_fixture_123",
    grantedScopes: [CANONICAL_READ_SCOPE],
    providerEnvironment: CANONICAL_ENVIRONMENT,
    version: 1,
    ...overrides,
  };
}

function canonicalPolicyCandidate(
  overrides: Partial<McpAccountLinkCanonicalPolicyCandidateV1> = {},
): McpAccountLinkCanonicalPolicyCandidateV1 {
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: CANONICAL_ISSUER,
    subject: "stytch_subject_fixture_123",
    providerEnvironment: CANONICAL_ENVIRONMENT,
    clientId: "stytch_client_fixture_123",
    twoweeksClerkId: "user_fixture_123",
    grantedScopes: [CANONICAL_READ_SCOPE],
    state: "active",
    createdAtEpochSeconds: NOW_SECONDS,
    updatedAtEpochSeconds: NOW_SECONDS,
    expiresAtEpochSeconds: NOW_SECONDS + 3_600,
    version: 1,
    ...overrides,
  };
}

function trustedOwner(
  overrides: Partial<McpTrustedAccountLinkOwnerV1> = {},
): McpTrustedAccountLinkOwnerV1 {
  return {
    kind: "mcp_trusted_account_link_owner",
    twoweeksClerkId: "user_fixture_123",
    version: 1,
    ...overrides,
  };
}

function lifecycleConfig(
  overrides: Partial<McpAccountLinkLifecycleConfigV1> = {},
): McpAccountLinkLifecycleConfigV1 {
  return {
    kind: "mcp_account_link_lifecycle_config",
    expectedIssuer: CANONICAL_ISSUER,
    expectedResource: CANONICAL_RESOURCE,
    expectedProviderEnvironment: CANONICAL_ENVIRONMENT,
    allowedClientIds: ["stytch_client_fixture_123"],
    clockSkewSeconds: 300,
    version: 1,
    ...overrides,
  };
}

function verifiedEvidence(
  overrides: Partial<McpVerifiedAccountLinkEvidenceV1> = {},
): McpVerifiedAccountLinkEvidenceV1 {
  return {
    kind: "mcp_verified_account_link_evidence",
    provider: "stytch",
    issuer: CANONICAL_ISSUER,
    subject: "stytch_subject_fixture_123",
    providerEnvironment: CANONICAL_ENVIRONMENT,
    clientId: "stytch_client_fixture_123",
    resource: CANONICAL_RESOURCE,
    grantedScopes: [CANONICAL_READ_SCOPE],
    expiresAtEpochSeconds: NOW_SECONDS + 3_600,
    verifiedAtEpochSeconds: NOW_SECONDS,
    cryptographicVerification: "already_verified_by_provider_adapter",
    version: 1,
    ...overrides,
  };
}

function lifecycleIdentity(overrides: Partial<ReturnType<typeof verifiedEvidence>> = {}) {
  const evidence = verifiedEvidence(overrides);
  return {
    kind: "mcp_account_link_lifecycle_identity" as const,
    issuer: evidence.issuer,
    subject: evidence.subject,
    providerEnvironment: evidence.providerEnvironment,
    clientId: evidence.clientId,
    version: 1 as const,
  };
}

function malformedLookupCandidate(reason: "malformed_storage_record" | "candidate_overflow") {
  return {
    kind: "mcp_auth_policy_account_link_lookup_malformed_candidate",
    reason,
    version: 1,
  };
}

describe("Convex MCP account links", () => {
  it("creates bounded active rows without token storage fields", async () => {
    const { ctx, rows, inserts } = makeCtx();

    const id = await internalCreateMcpAccountLink._handler(ctx as any, {
      record: accountLinkRecord(),
    });

    expect(id).toBe("mcpAccountLinks_fixture_1");
    expect(inserts).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "stytch",
      state: "active",
      auditReasonCode: "account_link_verified",
    });
    for (const fieldName of TOKEN_STORAGE_FIELD_NAMES) {
      expect(Object.prototype.hasOwnProperty.call(rows[0], fieldName)).toBe(false);
    }
  });

  it("keeps legacy account-link creation backward-compatible", async () => {
    const { ctx, rows } = makeCtx();

    await internalCreateMcpAccountLink._handler(ctx as any, {
      record: accountLinkRecord(),
    });

    expect(classifyMcpAccountLinkCanonicalStorageRecord(rows[0])).toBe("legacy_missing_canonical_fields");
    expect(rows[0]).not.toHaveProperty("issuer");
    expect(rows[0]).not.toHaveProperty("providerEnvironment");
    expect(rows[0]).not.toHaveProperty("canonicalGrantedScopes");
    expect(rows[0]).not.toHaveProperty("expiresAtEpochSeconds");
    expect(rows[0]).not.toHaveProperty("canonicalAccountLinkVersion");
  });

  it("accepts canonical storage fields when the complete canonical set is present", async () => {
    const { ctx, rows } = makeCtx();

    await internalCreateMcpAccountLink._handler(ctx as any, {
      record: canonicalAccountLinkRecord(),
    });

    expect(rows[0]).toMatchObject({
      issuer: CANONICAL_ISSUER,
      providerEnvironment: CANONICAL_ENVIRONMENT,
      canonicalGrantedScopes: [CANONICAL_READ_SCOPE],
      expiresAtEpochSeconds: NOW_SECONDS + 3_600,
      canonicalAccountLinkVersion: 1,
    });
    expect(classifyMcpAccountLinkCanonicalStorageRecord(rows[0])).toBe("canonical_ready");
  });

  it("rejects unsafe account-link identifiers and unbounded audit reason codes", async () => {
    for (const overrides of [
      { providerSubject: "access_token_real" },
      { twoweeksClerkId: "id_token_real" },
      { clientId: "client_secret_real" },
      { grantRef: "session_cookie_real" },
      { consentRef: "provider_credentials_real" },
      { auditReasonCode: "a".repeat(82) },
      { revokedAt: NOW + 1 },
      { staleAt: NOW + 1 },
    ] satisfies Array<Partial<McpAccountLinkRecord>>) {
      const { ctx } = makeCtx();

      await expect(
        internalCreateMcpAccountLink._handler(ctx as any, {
          record: accountLinkRecord(overrides),
        }),
      ).rejects.toThrow(/MCP account link/u);
    }
  });

  it.each([
    ["partial issuer only", { issuer: CANONICAL_ISSUER }],
    ["partial environment only", { providerEnvironment: CANONICAL_ENVIRONMENT }],
    ["partial canonical scopes only", { canonicalGrantedScopes: [CANONICAL_READ_SCOPE] }],
    ["partial expiry only", { expiresAtEpochSeconds: NOW_SECONDS + 3_600 }],
    ["partial canonical version only", { canonicalAccountLinkVersion: 1 }],
  ] as const)("rejects partial canonical account-link records: %s", async (_label, overrides) => {
    const { ctx } = makeCtx();

    await expect(
      internalCreateMcpAccountLink._handler(ctx as any, {
        record: accountLinkRecord(overrides as Partial<McpAccountLinkRecord>),
      }),
    ).rejects.toThrow(/MCP account link/u);
    expect(
      classifyMcpAccountLinkCanonicalStorageRecord(
        accountLinkRecord(overrides as Partial<McpAccountLinkRecord>),
      ),
    ).toBe("malformed");
  });

  it.each([
    ["malformed issuer", { issuer: "http://auth.example.test/oauth" }],
    ["email-like issuer", { issuer: "https://user@example.test/oauth" }],
    ["malformed provider environment", { providerEnvironment: "access_token_environment" }],
    ["malformed expiry", { expiresAtEpochSeconds: 1.5 }],
    ["missing canonical scope", { canonicalGrantedScopes: [] }],
    ["legacy dotted canonical scopes", { canonicalGrantedScopes: ["twoweeks.mcp.read"] }],
    ["raw claims field", { rawClaims: { sub: "subject_fixture" } }],
    ["provider payload field", { providerPayload: { email: "person@example.test" } }],
    ["debug payload field", { debugPayload: "private_fact" }],
  ] as const)("rejects malformed canonical account-link records: %s", async (_label, overrides) => {
    const { ctx } = makeCtx();

    await expect(
      internalCreateMcpAccountLink._handler(ctx as any, {
        record: canonicalAccountLinkRecord(overrides as Partial<McpAccountLinkRecord>),
      }),
    ).rejects.toThrow(/MCP account link/u);
    expect(
      classifyMcpAccountLinkCanonicalStorageRecord(
        canonicalAccountLinkRecord(overrides as Partial<McpAccountLinkRecord>),
      ),
    ).toBe("malformed");
  });

  it("classifies and projects only canonical-ready records into PR87.13 policy candidates", () => {
    const canonical = canonicalAccountLinkRecord();
    const projection = projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate(canonical);

    expect(classifyMcpAccountLinkCanonicalStorageRecord(accountLinkRecord())).toBe(
      "legacy_missing_canonical_fields",
    );
    expect(projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate(accountLinkRecord())).toEqual({
      classification: "legacy_missing_canonical_fields",
      policyCandidate: null,
      version: 1,
    });
    expect(projection).toEqual({
      classification: "canonical_ready",
      policyCandidate: {
        kind: "mcp_auth_policy_account_link_record",
        issuer: CANONICAL_ISSUER,
        subject: "stytch_subject_fixture_123",
        providerEnvironment: CANONICAL_ENVIRONMENT,
        clientId: "stytch_client_fixture_123",
        twoweeksClerkId: "user_fixture_123",
        grantedScopes: [CANONICAL_READ_SCOPE],
        state: "active",
        createdAtEpochSeconds: Math.floor(NOW / 1000),
        updatedAtEpochSeconds: Math.floor(NOW / 1000),
        expiresAtEpochSeconds: NOW_SECONDS + 3_600,
        version: 1,
      },
      version: 1,
    });
    expect(JSON.stringify(projection)).not.toContain("grant:fixture");
    expect(JSON.stringify(projection)).not.toContain("consent:fixture");
    expect(JSON.stringify(projection)).not.toContain("email");
    expect(JSON.stringify(projection)).not.toContain("_id");
  });

  it("allows legacy dotted scopes to remain in their separate legacy field", () => {
    expect(classifyMcpAccountLinkCanonicalStorageRecord(canonicalAccountLinkRecord())).toBe(
      "canonical_ready",
    );
    expect(
      classifyMcpAccountLinkCanonicalStorageRecord(
        canonicalAccountLinkRecord({
          grantedReadScopes: ["twoweeks.mcp.read", "twoweeks.review_cockpit.read"],
          canonicalGrantedScopes: [CANONICAL_READ_SCOPE],
        }),
      ),
    ).toBe("canonical_ready");
  });

  it("looks up canonical policy candidates by provider, issuer, subject, and environment only", async () => {
    const { candidates, indexCalls } = await lookupPolicyCandidatesWith([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_2",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_999",
          twoweeksClerkId: "user_fixture_999",
          grantRef: "grant:fixture:999",
          consentRef: "consent:fixture:999",
        }),
      }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_3",
        ...canonicalAccountLinkRecord({ providerEnvironment: "staging" }),
      }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_4",
        ...canonicalAccountLinkRecord({ issuer: "https://other-auth.example.test/oauth" }),
      }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_5",
        ...canonicalAccountLinkRecord({ providerSubject: "other_subject_fixture_123" }),
      }),
    ]);

    expect(indexCalls).toEqual([
      {
        indexName: "by_provider_issuer_subject_environment",
        constraints: [
          { field: "provider", value: "stytch" },
          { field: "issuer", value: CANONICAL_ISSUER },
          { field: "providerSubject", value: "stytch_subject_fixture_123" },
          { field: "providerEnvironment", value: CANONICAL_ENVIRONMENT },
        ],
      },
    ]);
    expect(candidates).toEqual([
      canonicalPolicyCandidate(),
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_999",
        twoweeksClerkId: "user_fixture_999",
      }),
    ]);
  });

  it("returns zero and one canonical candidates without inventing account-link fields", async () => {
    const emptyLookup = await lookupPolicyCandidatesWith([]);
    expect(emptyLookup.candidates).toEqual([]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: emptyLookup.candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "missing_account_link" });

    const singleLookup = await lookupPolicyCandidatesWith([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
    ]);
    expect(singleLookup.candidates).toEqual([canonicalPolicyCandidate()]);
    expect(JSON.stringify(singleLookup.candidates)).not.toContain("grant:fixture");
    expect(JSON.stringify(singleLookup.candidates)).not.toContain("consent:fixture");
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: singleLookup.candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({
      resolved: true,
      serverOnly: { twoweeksClerkId: "user_fixture_123", grantedScopes: [CANONICAL_READ_SCOPE] },
    });
  });

  it("keeps same-principal different-client candidates visible so resolver fails closed before client filtering", async () => {
    const { candidates } = await lookupPolicyCandidatesWith([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_2",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_999",
          twoweeksClerkId: "user_fixture_999",
          grantRef: "grant:fixture:999",
          consentRef: "consent:fixture:999",
        }),
      }),
    ]);

    expect(candidates).toEqual([
      canonicalPolicyCandidate(),
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_999",
        twoweeksClerkId: "user_fixture_999",
      }),
    ]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "duplicate_account_link" });
  });

  it("keeps revoked, stale, and expired same-principal candidates visible to the resolver", async () => {
    const { candidates } = await lookupPolicyCandidatesWith([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_2",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_124",
          twoweeksClerkId: "user_fixture_124",
          grantRef: "grant:fixture:124",
          consentRef: "consent:fixture:124",
          state: "revoked",
          revokedAt: NOW,
        }),
      }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_3",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_125",
          twoweeksClerkId: "user_fixture_125",
          grantRef: "grant:fixture:125",
          consentRef: "consent:fixture:125",
          state: "stale",
          staleAt: NOW,
        }),
      }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_4",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_126",
          twoweeksClerkId: "user_fixture_126",
          grantRef: "grant:fixture:126",
          consentRef: "consent:fixture:126",
          expiresAtEpochSeconds: NOW_SECONDS - 1,
        }),
      }),
    ]);

    expect(candidates).toEqual([
      canonicalPolicyCandidate(),
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_124",
        twoweeksClerkId: "user_fixture_124",
        state: "revoked",
      }),
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_125",
        twoweeksClerkId: "user_fixture_125",
        state: "stale",
      }),
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_126",
        twoweeksClerkId: "user_fixture_126",
        expiresAtEpochSeconds: NOW_SECONDS - 1,
      }),
    ]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "duplicate_account_link" });
  });

  it.each([
    ["revoked", { state: "revoked" as const, revokedAt: NOW }, "revoked_account_link"],
    ["stale", { state: "stale" as const, staleAt: NOW }, "stale_account_link"],
    ["expired", { expiresAtEpochSeconds: NOW_SECONDS - 1 }, "expired_account_link"],
  ] as const)("leaves final %s candidate denial to the resolver", async (_label, overrides, reason) => {
    const { candidates } = await lookupPolicyCandidatesWith([
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_1",
        ...canonicalAccountLinkRecord(overrides),
      }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason });
  });

  it("returns deterministic candidate order independent of fixture insertion order", async () => {
    const first = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...canonicalAccountLinkRecord({
        clientId: "stytch_client_fixture_222",
        twoweeksClerkId: "user_fixture_222",
        grantRef: "grant:fixture:222",
        consentRef: "consent:fixture:222",
      }),
    });
    const second = storedAccountLink({
      _id: "mcpAccountLinks_fixture_2",
      ...canonicalAccountLinkRecord({
        clientId: "stytch_client_fixture_111",
        twoweeksClerkId: "user_fixture_111",
        grantRef: "grant:fixture:111",
        consentRef: "consent:fixture:111",
      }),
    });

    await expect(lookupPolicyCandidatesWith([first, second])).resolves.toMatchObject({
      candidates: [
        canonicalPolicyCandidate({
          clientId: "stytch_client_fixture_111",
          twoweeksClerkId: "user_fixture_111",
        }),
        canonicalPolicyCandidate({
          clientId: "stytch_client_fixture_222",
          twoweeksClerkId: "user_fixture_222",
        }),
      ],
    });
    await expect(lookupPolicyCandidatesWith([second, first])).resolves.toMatchObject({
      candidates: [
        canonicalPolicyCandidate({
          clientId: "stytch_client_fixture_111",
          twoweeksClerkId: "user_fixture_111",
        }),
        canonicalPolicyCandidate({
          clientId: "stytch_client_fixture_222",
          twoweeksClerkId: "user_fixture_222",
        }),
      ],
    });
  });

  it("returns a malformed lookup candidate for matching partial canonical storage rows", async () => {
    const { candidates } = await lookupPolicyCandidatesWith([
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_1",
        ...accountLinkRecord({
          issuer: CANONICAL_ISSUER,
          providerEnvironment: CANONICAL_ENVIRONMENT,
        }),
      }),
    ]);

    expect(candidates).toEqual([malformedLookupCandidate("malformed_storage_record")]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });

  it.each([
    [
      "missing expiry",
      accountLinkRecord({
        issuer: CANONICAL_ISSUER,
        providerEnvironment: CANONICAL_ENVIRONMENT,
        canonicalGrantedScopes: [CANONICAL_READ_SCOPE],
        canonicalAccountLinkVersion: 1,
      }),
    ],
    [
      "missing client id",
      canonicalAccountLinkRecord({ clientId: undefined as unknown as string }),
    ],
    [
      "malformed timestamps",
      canonicalAccountLinkRecord({ updatedAt: NOW - 1, lastVerifiedAt: NOW - 1 }),
    ],
    [
      "legacy dotted canonical scope",
      canonicalAccountLinkRecord({ canonicalGrantedScopes: ["twoweeks.mcp.read"] }),
    ],
    [
      "mixed canonical and legacy dotted scopes",
      canonicalAccountLinkRecord({
        canonicalGrantedScopes: [CANONICAL_READ_SCOPE, "twoweeks.mcp.read"],
      }),
    ],
    [
      "malformed owner reference",
      canonicalAccountLinkRecord({ twoweeksClerkId: "access_token_owner" }),
    ],
  ] as const)("fails closed for matching malformed canonical rows: %s", async (_label, record) => {
    const { candidates } = await lookupPolicyCandidatesWith([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...record }),
    ]);

    expect(candidates).toEqual([malformedLookupCandidate("malformed_storage_record")]);
  });

  it("keeps incomplete legacy rows out of canonical lookup without mutating or synthesizing fields", async () => {
    const row = storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...accountLinkRecord() });
    const { candidates } = await lookupPolicyCandidatesWith([row]);

    expect(candidates).toEqual([]);
    expect(row).not.toHaveProperty("issuer");
    expect(row).not.toHaveProperty("providerEnvironment");
    expect(row).not.toHaveProperty("canonicalGrantedScopes");
    expect(row).not.toHaveProperty("expiresAtEpochSeconds");
    expect(row).not.toHaveProperty("canonicalAccountLinkVersion");
  });

  it("returns the full exact-bound candidate set without truncation", async () => {
    const { candidates } = await lookupPolicyCandidatesWith(
      Array.from({ length: MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES }, (_, index) =>
        storedAccountLink({
          _id: `mcpAccountLinks_fixture_${index + 1}`,
          ...canonicalAccountLinkRecord({
            clientId: `stytch_client_fixture_${String(index).padStart(3, "0")}`,
            twoweeksClerkId: `user_fixture_${String(index).padStart(3, "0")}`,
            grantRef: `grant:fixture:${String(index).padStart(3, "0")}`,
            consentRef: `consent:fixture:${String(index).padStart(3, "0")}`,
          }),
        }),
      ),
    );

    expect(candidates).toHaveLength(MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES);
    expect(candidates[0]).toEqual(
      canonicalPolicyCandidate({
        clientId: "stytch_client_fixture_000",
        twoweeksClerkId: "user_fixture_000",
      }),
    );
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "duplicate_account_link" });
  });

  it("fails closed when the same-principal candidate set exceeds the lookup bound", async () => {
    const { candidates } = await lookupPolicyCandidatesWith(
      Array.from({ length: MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1 }, (_, index) =>
        storedAccountLink({
          _id: `mcpAccountLinks_fixture_${index + 1}`,
          ...canonicalAccountLinkRecord({
            clientId: `stytch_client_fixture_${String(index).padStart(3, "0")}`,
            twoweeksClerkId: `user_fixture_${String(index).padStart(3, "0")}`,
            grantRef: `grant:fixture:${String(index).padStart(3, "0")}`,
            consentRef: `consent:fixture:${String(index).padStart(3, "0")}`,
          }),
        }),
      ),
    );

    expect(candidates).toEqual([malformedLookupCandidate("candidate_overflow")]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });

  it.each([
    ["null evidence", null, "malformed_evidence"],
    ["array evidence", [], "malformed_evidence"],
    ["extra key", { rawAccessToken: "token_fixture" }, "malformed_evidence"],
    ["wrong proof", { cryptographicVerification: "decoded_only" }, "malformed_evidence"],
    ["missing issuer", { issuer: undefined }, "malformed_evidence"],
    ["missing subject", { subject: undefined }, "malformed_evidence"],
    ["missing provider environment", { providerEnvironment: undefined }, "malformed_evidence"],
    ["missing client", { clientId: undefined }, "malformed_evidence"],
    ["missing resource", { resource: undefined }, "malformed_evidence"],
    ["wrong resource", { resource: "https://other.example.test/mcp" }, "wrong_resource"],
    ["missing canonical scope", { grantedScopes: [] }, "missing_canonical_scope"],
    ["legacy dotted scope", { grantedScopes: ["twoweeks.mcp.read"] }, "missing_canonical_scope"],
    [
      "mixed canonical and legacy scopes",
      { grantedScopes: [CANONICAL_READ_SCOPE, "twoweeks.mcp.read"] },
      "legacy_scope",
    ],
    [
      "expired evidence",
      { verifiedAtEpochSeconds: NOW_SECONDS - 3_600, expiresAtEpochSeconds: NOW_SECONDS - 1 },
      "expired_evidence",
    ],
    ["future verification", { verifiedAtEpochSeconds: NOW_SECONDS + 301 }, "future_evidence"],
    ["invalid expiry", { expiresAtEpochSeconds: 1.5 }, "malformed_evidence"],
    ["refresh token field", { refreshToken: "refresh_fixture" }, "malformed_evidence"],
    ["authorization code field", { authorizationCode: "code_fixture" }, "malformed_evidence"],
    ["email identity field", { email: "person@example.test" }, "malformed_evidence"],
    ["owner override field", { twoweeksClerkId: "user_fixture_999" }, "malformed_evidence"],
  ] as const)("rejects invalid authoritative lifecycle evidence: %s", async (_label, overrides, reason) => {
    const { ctx } = makeCtx();
    const evidence =
      overrides === null || Array.isArray(overrides)
        ? overrides
        : verifiedEvidence(overrides as Partial<McpVerifiedAccountLinkEvidenceV1>);

    await expect(
      internalLinkCanonicalMcpAccount._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence,
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason });
  });

  it.each(UNSAFE_EPOCH_SECONDS_CASES)(
    "rejects unsafe link evidence verifiedAtEpochSeconds: %s",
    async (_label, unsafeEpochSeconds) => {
      const { ctx, inserts } = makeCtx();

      await expect(
        internalLinkCanonicalMcpAccount._handler(ctx as any, {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence({
            verifiedAtEpochSeconds: unsafeEpochSeconds,
            expiresAtEpochSeconds: NOW_SECONDS + 3_600,
          }),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        }),
      ).resolves.toMatchObject({ ok: false, reason: "malformed_evidence" });
      expect(inserts).toHaveLength(0);
    },
  );

  it.each(UNSAFE_EPOCH_SECONDS_CASES)(
    "rejects unsafe link evidence expiresAtEpochSeconds: %s",
    async (_label, unsafeEpochSeconds) => {
      const { ctx, inserts } = makeCtx();

      await expect(
        internalLinkCanonicalMcpAccount._handler(ctx as any, {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence({ expiresAtEpochSeconds: unsafeEpochSeconds }),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        }),
      ).resolves.toMatchObject({ ok: false, reason: "malformed_evidence" });
      expect(inserts).toHaveLength(0);
    },
  );

  it("creates one canonical active account link from authoritative evidence and authorizes through lookup", async () => {
    const { ctx, rows, inserts } = makeCtx();

    const result = await internalLinkCanonicalMcpAccount._handler(ctx as any, {
      trustedOwner: trustedOwner(),
      evidence: verifiedEvidence(),
      config: lifecycleConfig(),
      nowEpochSeconds: NOW_SECONDS,
    });

    expect(result).toMatchObject({ ok: true, reason: "linked" });
    expect(inserts).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerSubject: "stytch_subject_fixture_123",
      twoweeksClerkId: "user_fixture_123",
      clientId: "stytch_client_fixture_123",
      issuer: CANONICAL_ISSUER,
      providerEnvironment: CANONICAL_ENVIRONMENT,
      canonicalGrantedScopes: [CANONICAL_READ_SCOPE],
      expiresAtEpochSeconds: NOW_SECONDS + 3_600,
      canonicalAccountLinkVersion: 1,
      state: "active",
      lastVerifiedAt: NOW,
    });
    for (const fieldName of TOKEN_STORAGE_FIELD_NAMES) {
      expect(Object.prototype.hasOwnProperty.call(rows[0], fieldName)).toBe(false);
    }
    expect(JSON.stringify(rows[0])).not.toContain("token_fixture");

    await expect(
      internalLinkCanonicalMcpAccount._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "already_linked" });
    expect(rows).toHaveLength(1);

    const { candidates } = await lookupPolicyCandidatesWith(rows);
    expect(candidates).toEqual([canonicalPolicyCandidate()]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({
      resolved: true,
      serverOnly: { twoweeksClerkId: "user_fixture_123", grantedScopes: [CANONICAL_READ_SCOPE] },
    });
  });

  it("fails closed for exact-client rows hidden from canonical lookup before insert", async () => {
    const malformedExactClientRow = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...accountLinkRecord({ twoweeksClerkId: "access_token_owner" }),
    });
    expect(classifyMcpAccountLinkCanonicalStorageRecord(malformedExactClientRow)).toBe("malformed");

    const malformedCtx = makeCtx([malformedExactClientRow]);
    await expect(
      internalLinkCanonicalMcpAccount._handler(malformedCtx.ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "malformed_candidate" });
    expect(malformedCtx.inserts).toHaveLength(0);
    expect(malformedCtx.rows).toEqual([malformedExactClientRow]);

    const exactClientOverflowCtx = makeCtx(
      Array.from({ length: MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1 }, (_, index) =>
        storedAccountLink({
          _id: `mcpAccountLinks_fixture_${index + 1}`,
          ...accountLinkRecord({
            twoweeksClerkId: `user_fixture_${String(index).padStart(3, "0")}`,
            grantRef: `grant:fixture:${String(index).padStart(3, "0")}`,
            consentRef: `consent:fixture:${String(index).padStart(3, "0")}`,
          }),
        }),
      ),
    );
    await expect(
      internalLinkCanonicalMcpAccount._handler(exactClientOverflowCtx.ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "candidate_overflow" });
    expect(exactClientOverflowCtx.inserts).toHaveLength(0);

    const legacyExactClientRow = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...accountLinkRecord(),
    });
    const legacyCtx = makeCtx([legacyExactClientRow]);
    await expect(
      internalLinkCanonicalMcpAccount._handler(legacyCtx.ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "malformed_candidate" });
    expect(legacyCtx.inserts).toHaveLength(0);
    expect(legacyCtx.rows).toEqual([legacyExactClientRow]);

    const hiddenCanonicalExactClientRow = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...canonicalAccountLinkRecord({
        issuer: "https://other-auth.example.test/oauth",
      }),
    });
    const hiddenCanonicalCtx = makeCtx([hiddenCanonicalExactClientRow]);
    await expect(
      internalLinkCanonicalMcpAccount._handler(hiddenCanonicalCtx.ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "duplicate_account_link" });
    expect(hiddenCanonicalCtx.inserts).toHaveLength(0);
    expect(hiddenCanonicalCtx.rows).toEqual([hiddenCanonicalExactClientRow]);

    const revokedExactClientRow = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...accountLinkRecord({ state: "revoked", revokedAt: NOW }),
    });
    const revokedCtx = makeCtx([revokedExactClientRow]);
    await expect(
      internalLinkCanonicalMcpAccount._handler(revokedCtx.ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "relink_required" });
    expect(revokedCtx.inserts).toHaveLength(0);
    expect(revokedCtx.rows).toEqual([revokedExactClientRow]);
  });

  it("fails closed for cross-owner, malformed, overflow, and revoked relink create attempts", async () => {
    await expect(
      internalLinkCanonicalMcpAccount._handler(
        makeCtx([
          storedAccountLink({
            _id: "mcpAccountLinks_fixture_1",
            ...canonicalAccountLinkRecord({
              clientId: "stytch_client_fixture_999",
              twoweeksClerkId: "user_fixture_999",
              grantRef: "grant:fixture:999",
              consentRef: "consent:fixture:999",
            }),
          }),
        ]).ctx as any,
        {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence(),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        },
      ),
    ).resolves.toMatchObject({ ok: false, reason: "cross_owner_conflict" });

    await expect(
      internalLinkCanonicalMcpAccount._handler(
        makeCtx([
          storedAccountLink({
            _id: "mcpAccountLinks_fixture_1",
            ...accountLinkRecord({
              issuer: CANONICAL_ISSUER,
              providerEnvironment: CANONICAL_ENVIRONMENT,
            }),
          }),
        ]).ctx as any,
        {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence(),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        },
      ),
    ).resolves.toMatchObject({ ok: false, reason: "malformed_candidate" });

    await expect(
      internalLinkCanonicalMcpAccount._handler(
        makeCtx(
          Array.from({ length: MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1 }, (_, index) =>
            storedAccountLink({
              _id: `mcpAccountLinks_fixture_${index + 1}`,
              ...canonicalAccountLinkRecord({
                clientId: `stytch_client_fixture_${String(index).padStart(3, "0")}`,
                twoweeksClerkId: `user_fixture_${String(index).padStart(3, "0")}`,
                grantRef: `grant:fixture:${String(index).padStart(3, "0")}`,
                consentRef: `consent:fixture:${String(index).padStart(3, "0")}`,
              }),
            }),
          ),
        ).ctx as any,
        {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence(),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        },
      ),
    ).resolves.toMatchObject({ ok: false, reason: "candidate_overflow" });

    const revoked = storedAccountLink({
      _id: "mcpAccountLinks_fixture_1",
      ...canonicalAccountLinkRecord({ state: "revoked", revokedAt: NOW }),
    });
    const { ctx, rows } = makeCtx([revoked]);
    await expect(
      internalLinkCanonicalMcpAccount._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence({ verifiedAtEpochSeconds: NOW_SECONDS + 10 }),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS + 10,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "relink_required" });
    expect(rows[0]).toMatchObject({ state: "revoked", revokedAt: NOW });
  });

  it("refreshes newer evidence idempotently and rejects replay or expiry regression", async () => {
    const { ctx, rows, patches } = makeCtx([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
    ]);

    await expect(
      internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence(),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "unchanged" });

    await expect(
      internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence({
          verifiedAtEpochSeconds: NOW_SECONDS - 1,
          expiresAtEpochSeconds: NOW_SECONDS + 3_700,
        }),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "stale_evidence" });

    await expect(
      internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence({
          verifiedAtEpochSeconds: NOW_SECONDS + 10,
          expiresAtEpochSeconds: NOW_SECONDS + 3_500,
        }),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS + 10,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "expiry_regression" });

    await expect(
      internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        evidence: verifiedEvidence({
          verifiedAtEpochSeconds: NOW_SECONDS + 10,
          expiresAtEpochSeconds: NOW_SECONDS + 7_200,
        }),
        config: lifecycleConfig(),
        nowEpochSeconds: NOW_SECONDS + 10,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "refreshed" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lastVerifiedAt: NOW + 10_000,
      updatedAt: NOW + 10_000,
      expiresAtEpochSeconds: NOW_SECONDS + 7_200,
      auditReasonCode: "account_link_refreshed",
    });
    expect(patches).toHaveLength(1);
  });

  it.each(UNSAFE_EPOCH_SECONDS_CASES)(
    "rejects unsafe refresh evidence verifiedAtEpochSeconds: %s",
    async (_label, unsafeEpochSeconds) => {
      const { ctx, rows, patches } = makeCtx([
        storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      ]);

      await expect(
        internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence({
            verifiedAtEpochSeconds: unsafeEpochSeconds,
            expiresAtEpochSeconds: NOW_SECONDS + 3_600,
          }),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        }),
      ).resolves.toMatchObject({ ok: false, reason: "malformed_evidence" });
      expect(patches).toHaveLength(0);
      expect(rows[0]).toMatchObject(canonicalAccountLinkRecord());
    },
  );

  it.each(UNSAFE_EPOCH_SECONDS_CASES)(
    "rejects unsafe refresh evidence expiresAtEpochSeconds: %s",
    async (_label, unsafeEpochSeconds) => {
      const { ctx, rows, patches } = makeCtx([
        storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      ]);

      await expect(
        internalRefreshCanonicalMcpAccountLink._handler(ctx as any, {
          trustedOwner: trustedOwner(),
          evidence: verifiedEvidence({ expiresAtEpochSeconds: unsafeEpochSeconds }),
          config: lifecycleConfig(),
          nowEpochSeconds: NOW_SECONDS,
        }),
      ).resolves.toMatchObject({ ok: false, reason: "malformed_evidence" });
      expect(patches).toHaveLength(0);
      expect(rows[0]).toMatchObject(canonicalAccountLinkRecord());
    },
  );

  it("revokes canonical links idempotently and resolver denies after revoke", async () => {
    const { ctx, rows, patches } = makeCtx([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
    ]);

    await expect(
      internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner({ twoweeksClerkId: "user_fixture_999" }),
        identity: lifecycleIdentity(),
        nowEpochSeconds: NOW_SECONDS + 20,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "cross_owner_conflict" });

    await expect(
      internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        identity: lifecycleIdentity({ subject: "stytch_subject_fixture_missing" }),
        nowEpochSeconds: NOW_SECONDS + 20,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "not_found" });

    await expect(
      internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        identity: lifecycleIdentity(),
        nowEpochSeconds: NOW_SECONDS + 20,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "revoked" });
    await expect(
      internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        identity: lifecycleIdentity(),
        nowEpochSeconds: NOW_SECONDS + 30,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "unchanged" });

    expect(rows[0]).toMatchObject({
      state: "revoked",
      revokedAt: NOW + 20_000,
      auditReasonCode: "account_link_revoked",
    });
    expect(patches).toHaveLength(1);

    const { candidates } = await lookupPolicyCandidatesWith(rows);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: CANONICAL_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS + 30,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "revoked_account_link" });
  });

  it("revokes the requested client when another client shares the issuer, subject, and environment", async () => {
    const { ctx, rows, patches } = makeCtx([
      storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      storedAccountLink({
        _id: "mcpAccountLinks_fixture_2",
        ...canonicalAccountLinkRecord({
          clientId: "stytch_client_fixture_999",
          twoweeksClerkId: "user_fixture_999",
          grantRef: "grant:fixture:999",
          consentRef: "consent:fixture:999",
        }),
      }),
    ]);

    await expect(
      internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
        trustedOwner: trustedOwner(),
        identity: lifecycleIdentity(),
        nowEpochSeconds: NOW_SECONDS + 20,
      }),
    ).resolves.toMatchObject({ ok: true, reason: "revoked" });

    expect(rows[0]).toMatchObject({
      clientId: "stytch_client_fixture_123",
      state: "revoked",
      revokedAt: NOW + 20_000,
      auditReasonCode: "account_link_revoked",
    });
    expect(rows[1]).toMatchObject({
      clientId: "stytch_client_fixture_999",
      state: "active",
    });
    expect(rows[1]).not.toHaveProperty("revokedAt");
    expect(patches).toHaveLength(1);
    expect(patches[0]?.id).toBe("mcpAccountLinks_fixture_1");
  });

  it.each(UNSAFE_EPOCH_SECONDS_CASES)(
    "rejects unsafe revoke nowEpochSeconds: %s",
    async (_label, unsafeEpochSeconds) => {
      const { ctx, rows, patches } = makeCtx([
        storedAccountLink({ _id: "mcpAccountLinks_fixture_1", ...canonicalAccountLinkRecord() }),
      ]);

      await expect(
        internalRevokeCanonicalMcpAccountLink._handler(ctx as any, {
          trustedOwner: trustedOwner(),
          identity: lifecycleIdentity(),
          nowEpochSeconds: unsafeEpochSeconds,
        }),
      ).resolves.toMatchObject({ ok: false, reason: "malformed_evidence" });
      expect(patches).toHaveLength(0);
      expect(rows[0]).toMatchObject({ state: "active" });
      expect(rows[0]).not.toHaveProperty("revokedAt");
    },
  );

  it("resolves only one active, non-expired account link with required scopes", async () => {
    await expect(resolveWith([storedAccountLink()])).resolves.toMatchObject({
      kind: "mcp_account_link_server_only_owner_resolution",
      provider: "stytch",
      twoweeksClerkId: "user_fixture_123",
      grantedReadScopes: [...GRANTED_READ_SCOPES],
      auditReasonCode: "account_link_verified",
      version: 1,
    });

    await expect(
      resolveWith([storedAccountLink({ state: "revoked", revokedAt: NOW - 1 })]),
    ).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ state: "stale", staleAt: NOW - 1 })])).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ revokedAt: NOW - 1 })])).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ staleAt: NOW - 1 })])).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ lastVerifiedAt: NOW - 2_000 })])).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ lastVerifiedAt: Number.NaN })])).resolves.toBeNull();
    await expect(resolveWith([storedAccountLink({ grantedReadScopes: ["twoweeks.review_cockpit.read"] })])).resolves.toBeNull();
    await expect(
      resolveWith([
        storedAccountLink({ _id: "mcpAccountLinks_fixture_1" }),
        storedAccountLink({ _id: "mcpAccountLinks_fixture_2", grantRef: "grant:fixture:456" }),
      ]),
    ).resolves.toBeNull();
  });

  it("applies local stale and revoked metadata idempotently", async () => {
    const { ctx, rows, patches } = makeCtx([storedAccountLink()]);

    await internalMarkMcpAccountLinkState._handler(ctx as any, {
      providerSubject: "stytch_subject_fixture_123",
      clientId: "stytch_client_fixture_123",
      state: "stale",
      changedAt: NOW + 1,
      auditReasonCode: "account_link_stale",
    });
    await internalMarkMcpAccountLinkState._handler(ctx as any, {
      providerSubject: "stytch_subject_fixture_123",
      clientId: "stytch_client_fixture_123",
      state: "stale",
      changedAt: NOW + 2,
      auditReasonCode: "account_link_stale",
    });
    await internalMarkMcpAccountLinkState._handler(ctx as any, {
      providerSubject: "stytch_subject_fixture_123",
      clientId: "stytch_client_fixture_123",
      state: "revoked",
      changedAt: NOW + 3,
      auditReasonCode: "account_link_revoked",
    });
    await internalMarkMcpAccountLinkState._handler(ctx as any, {
      providerSubject: "stytch_subject_fixture_123",
      clientId: "stytch_client_fixture_123",
      state: "revoked",
      changedAt: NOW + 4,
      auditReasonCode: "account_link_revoked",
    });

    expect(rows[0]).toMatchObject({
      state: "revoked",
      staleAt: NOW + 1,
      revokedAt: NOW + 3,
      auditReasonCode: "account_link_revoked",
    });
    expect(patches).toHaveLength(2);
    expect(patches.map((item) => item.patch.state)).toEqual(["stale", "revoked"]);
  });

  it("keeps helper source disconnected from provider APIs, token storage, browser automation, and PR80-live", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/u);
    expect(source).not.toMatch(/@stytch|oauth\/callback|tokenEndpoint|revocationEndpoint/u);
    expect(source).not.toMatch(/browser|playwright|liveExternalAction|manualApplicationHandoff/u);
    expect(source).not.toMatch(/publicQuery|httpAction|tools\/list|tools\/call/u);
    for (const fieldName of TOKEN_STORAGE_FIELD_NAMES) {
      expect(schemaSource).not.toMatch(new RegExp(`\\b${fieldName}\\s*:`, "u"));
    }
  });

  it("keeps the canonical schema/index additive and future lookup-safe", () => {
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(schemaSource).toMatch(/issuer:\s*v\.optional\(v\.string\(\)\)/u);
    expect(schemaSource).toMatch(/providerEnvironment:\s*v\.optional\(v\.string\(\)\)/u);
    expect(schemaSource).toMatch(/canonicalGrantedScopes:\s*v\.optional\(v\.array\(v\.string\(\)\)\)/u);
    expect(schemaSource).toMatch(/expiresAtEpochSeconds:\s*v\.optional\(v\.number\(\)\)/u);
    expect(schemaSource).toMatch(/canonicalAccountLinkVersion:\s*v\.optional\(v\.literal\(1\)\)/u);
    expect(schemaSource).toMatch(
      /\.index\("by_provider_issuer_subject_environment",\s*\[\s*"provider",\s*"issuer",\s*"providerSubject",\s*"providerEnvironment",\s*\]\)/u,
    );
    expect(schemaSource).toMatch(/\.index\("by_provider_subject_client", \["provider", "providerSubject", "clientId"\]\)/u);
    expect(schemaSource).toMatch(/\.index\("by_twoweeks_clerk_id", \["twoweeksClerkId"\]\)/u);
    expect(schemaSource).not.toMatch(
      /by_provider_issuer_subject_environment",\s*\[[^\]]*"clientId"/u,
    );
  });
});
