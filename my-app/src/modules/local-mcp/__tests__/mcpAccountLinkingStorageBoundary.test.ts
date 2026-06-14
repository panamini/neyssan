import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpAccountLinkingStorageSafeRefusal,
  validateLocalMcpAccountLinkingStorageBoundary,
  type LocalMcpAccountLinkingStorageBoundaryInputV1,
  type LocalMcpAccountLinkingStorageRecordShapeV1,
} from "../mcpAccountLinkingStorageBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpAccountLinkingStorageBoundary.ts");

const FIXTURE_PROVIDER_SUBJECT = "stytch-user-test-123";
const FIXTURE_CLIENT_ID = "chatgpt-fixture-client";
const FIXTURE_CLERK_ID = "clerk_test_123";
const FIXTURE_READ_SCOPES = ["twoweeks.application_package.read", "twoweeks.mcp.read"] as const;

const FIXTURE_RECORD: LocalMcpAccountLinkingStorageRecordShapeV1 = {
  kind: "local_mcp_account_link_record",
  provider: "stytch",
  providerSubject: FIXTURE_PROVIDER_SUBJECT,
  twoweeksClerkId: FIXTURE_CLERK_ID,
  clientIdentity: FIXTURE_CLIENT_ID,
  grantedReadScopes: [...FIXTURE_READ_SCOPES],
  grantRef: "grant_ref_fixture",
  consentRef: "consent_ref_fixture",
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-14T00:10:00.000Z",
  state: "active",
  version: 1,
};

function buildInput(
  overrides: Partial<LocalMcpAccountLinkingStorageBoundaryInputV1> & {
    accountLinks?: readonly unknown[];
  } = {},
): LocalMcpAccountLinkingStorageBoundaryInputV1 {
  return {
    kind: "local_mcp_account_linking_storage_boundary_input",
    providerSubject: FIXTURE_PROVIDER_SUBJECT,
    clientIdentity: FIXTURE_CLIENT_ID,
    requiredReadScopes: ["twoweeks.mcp.read"],
    accountLinks: [FIXTURE_RECORD],
    version: 1,
    ...overrides,
  };
}

function buildRecord(
  overrides: Partial<LocalMcpAccountLinkingStorageRecordShapeV1> = {},
): LocalMcpAccountLinkingStorageRecordShapeV1 {
  return {
    ...FIXTURE_RECORD,
    ...overrides,
    grantedReadScopes: overrides.grantedReadScopes
      ? [...overrides.grantedReadScopes]
      : [...FIXTURE_RECORD.grantedReadScopes],
  };
}

describe("local MCP account-linking storage boundary", () => {
  it("accepts a valid fixture account-link record only as server-internal state", () => {
    const result = validateLocalMcpAccountLinkingStorageBoundary(buildInput());

    expect(result).toMatchObject({
      kind: "local_mcp_account_linking_storage_result",
      allowed: true,
      reason: "verified_server_only",
      serverOnly: {
        linkState: "verified_server_only",
        readScopeState: "read_only_verified",
        grantedReadScopes: [...FIXTURE_READ_SCOPES],
        version: 1,
      },
      capabilities: {
        accountLinkingStorage: "server_only",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });

    const serialized = JSON.stringify(result);
    for (const fragment of [
      FIXTURE_CLERK_ID,
      FIXTURE_PROVIDER_SUBJECT,
      "user_real_123",
      "real-user@example.test",
      "rawClaims",
      "bearer",
      "token",
    ] as const) {
      expect(serialized).not.toContain(fragment);
    }
  });

  it("denies missing link", () => {
    expect(validateLocalMcpAccountLinkingStorageBoundary(buildInput({ accountLinks: [] }))).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "missing_account_link",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies revoked link", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              state: "revoked",
              revokedAt: "2026-06-14T00:11:00.000Z",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "revoked_account_link",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies stale link", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              state: "stale",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "stale_account_link",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies ambiguous multiple links", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord(),
            buildRecord({
              grantRef: "grant_ref_fixture_2",
              consentRef: "consent_ref_fixture_2",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "ambiguous_account_link",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies wrong provider", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              provider: "clerk",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "provider_mismatch",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies wrong Stytch subject", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              providerSubject: "stytch-user-other",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "provider_subject_mismatch",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies wrong client identity", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              clientIdentity: "claude-fixture-client",
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "client_identity_mismatch",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies missing Twoweeks read scope", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          requiredReadScopes: ["twoweeks.evidence_graph.read"],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "missing_required_read_scope",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("denies generic OIDC scopes only", () => {
    expect(
      validateLocalMcpAccountLinkingStorageBoundary(
        buildInput({
          accountLinks: [
            buildRecord({
              grantedReadScopes: ["openid", "profile", "email"],
            }),
          ],
        }),
      ),
    ).toEqual({
      kind: "local_mcp_account_linking_storage_result",
      allowed: false,
      reason: "insufficient_scope_metadata",
      safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
      capabilities: {
        accountLinkingStorage: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        credentialStorage: "none",
        consent: "not_evaluated",
        audit: "not_evaluated",
        retentionDeletion: "not_evaluated",
        version: 1,
      },
      modelVisible: false,
      fixtureOnly: true,
      version: 1,
    });
  });

  it("does not expose clerkId, userId, email, providerSubject, token, or raw claims in output", () => {
    const result = validateLocalMcpAccountLinkingStorageBoundary(buildInput());
    const serialized = JSON.stringify(result);

    expect(result.allowed).toBe(true);
    for (const fragment of [
      FIXTURE_CLERK_ID,
      "user_real_123",
      "real-user@example.test",
      FIXTURE_PROVIDER_SUBJECT,
      "providerSubject",
      "token",
      "rawClaims",
    ] as const) {
      expect(serialized).not.toContain(fragment);
    }
  });

  it("does not authorize real data access", () => {
    expect(validateLocalMcpAccountLinkingStorageBoundary(buildInput()).capabilities.dataReads).toBe("blocked");
  });

  it("does not authorize write surfaces", () => {
    expect(validateLocalMcpAccountLinkingStorageBoundary(buildInput()).capabilities.dataWrites).toBe("blocked");
  });

  it("does not authorize handler execution", () => {
    expect(validateLocalMcpAccountLinkingStorageBoundary(buildInput()).capabilities.handlerExecution).toBe("blocked");
  });

  it("does not authorize export, download, send, submit, or apply surfaces", () => {
    expect(validateLocalMcpAccountLinkingStorageBoundary(buildInput()).capabilities.writeActions).toBe("blocked");
  });

  it("does not import Convex, network, handler, or model surfaces", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
      (match) => match[1],
    );
    const forbiddenImportPattern = /(?:convex|ctx\.db|ctx\.runQuery|fetch\s*\(|https?|oauth\/callback|tokenStorage|tools\/list|tools\/call|openai|llm|download|send|submit|apply)/iu;

    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(forbiddenImportPattern);
    }

    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\bctx\.db\b/u);
    expect(source).not.toMatch(/\bctx\.runQuery\b/u);
    expect(source).not.toMatch(/oauth\/callback/u);
    expect(source).not.toMatch(/\btokenStorage\b/u);
    expect(source).not.toMatch(/\btools\/list\b/u);
    expect(source).not.toMatch(/\btools\/call\b/u);
    expect(source).not.toMatch(/\bopenai\b/u);
    expect(source).not.toMatch(/\bllm\b/u);
    expect(source).not.toMatch(/\bdownload\b/u);
    expect(source).not.toMatch(/\bsend\b/u);
    expect(source).not.toMatch(/\bsubmit\b/u);
    expect(source).not.toMatch(/\bapply\b/u);
  });
});
