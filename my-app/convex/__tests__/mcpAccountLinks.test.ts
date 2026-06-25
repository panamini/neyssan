import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyMcpAccountLinkCanonicalStorageRecord,
  internalCreateMcpAccountLink,
  internalMarkMcpAccountLinkState,
  internalResolveActiveMcpAccountLink,
  projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate,
} from "../mcpAccountLinks";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../mcpAccountLinks.ts");
const SCHEMA_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../schema.ts");
const NOW = Date.UTC(2026, 5, 20, 12, 0, 0, 0);
const NOW_SECONDS = Math.floor(NOW / 1000);
const REQUIRED_READ_SCOPES = ["twoweeks.mcp.read"] as const;
const GRANTED_READ_SCOPES = [
  "twoweeks.mcp.read",
  "twoweeks.application_package.read",
] as const;
const CANONICAL_READ_SCOPE = "twoweeks:applications:read" as const;
const CANONICAL_ISSUER = "https://auth.example.test/oauth";
const CANONICAL_ENVIRONMENT = "production";
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
          const matching = applyConstraints(rows, constraints);
          return { collect: async () => matching };
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

  return { ctx: { db }, rows, patches, inserts };
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
