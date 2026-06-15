import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpReadOnlyTwoweeksDataAdapterSafeRefusal,
  projectMcpReadOnlyTwoweeksDataAdapter,
  type McpReadOnlyTwoweeksDataAdapterInputV1,
} from "../mcpReadOnlyTwoweeksDataAdapter";
import type { McpProductionAccountLinkPersistenceResultV1 } from "../mcpProductionAccountLinkPersistenceBoundary";
import type { McpProductionStytchOAuthConfigBoundaryResultV1 } from "../mcpProductionStytchOAuthConfigBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ADAPTER_SOURCE_FILE = resolve(TEST_DIR, "../mcpReadOnlyTwoweeksDataAdapter.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpReadOnlyTwoweeksDataAdapter.test.ts");
const NOW = new Date("2026-06-15T12:00:00.000Z");

const ALL_SCOPES = [
  "twoweeks.mcp.read",
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const;

const AUTH_ALLOWED = {
  kind: "mcp_production_stytch_oauth_config_boundary_result",
  allowed: true,
  reason: "authorized_server_only",
  serverOnly: {
    provider: "stytch",
    authState: "verified_access_token",
    clientCategory: "approved_ai_client",
    resourceCategory: "twoweeks_mcp_resource",
    grantedReadScopes: ALL_SCOPES,
    requiredReadScopes: ["twoweeks.mcp.read"],
    subjectBinding: "verified_stytch_subject_server_only_not_returned",
    offlineAccessStoresRefreshTokens: false,
    version: 1,
  },
  capabilities: {
    authDecision: "server_only",
    provider: "stytch",
    tokenVerification: "local_jwt_only",
    signingAlgorithm: "RS256_only",
    jwks: "server_provided_only",
    remoteJwks: "blocked",
    tokenIntrospection: "blocked",
    tokenStorage: "none",
    refreshTokenStorage: "none",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    version: 1,
  },
  modelVisible: false,
  version: 1,
} as const satisfies McpProductionStytchOAuthConfigBoundaryResultV1;

const AUTH_DENIED = {
  kind: "mcp_production_stytch_oauth_config_boundary_result",
  allowed: false,
  reason: "missing_bearer_token",
  safeRefusal: {
    code: "production_stytch_oauth_boundary_blocked",
    message: "Authorization required.",
    safeForModel: true,
    tokenEchoed: false,
    rawClaimsExposed: false,
    stytchSubjectExposed: false,
    version: 1,
  },
  capabilities: {
    ...AUTH_ALLOWED.capabilities,
    authDecision: "blocked",
  },
  modelVisible: false,
  version: 1,
} as const satisfies McpProductionStytchOAuthConfigBoundaryResultV1;

const ACCOUNT_LINK_ALLOWED = {
  kind: "mcp_production_account_link_persistence_result",
  allowed: true,
  reason: "verified_server_only",
  serverOnly: {
    provider: "stytch",
    linkState: "active",
    ownerBinding: "twoweeks_owner_resolved_server_only_not_returned",
    clientCategory: "approved_ai_client",
    grantedReadScopes: ALL_SCOPES,
    requiredReadScopes: ["twoweeks.mcp.read"],
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
} as const satisfies McpProductionAccountLinkPersistenceResultV1;

const ACCOUNT_LINK_DENIED = {
  kind: "mcp_production_account_link_persistence_result",
  allowed: false,
  reason: "revoked_account_link",
  safeRefusal: {
    code: "production_account_link_persistence_boundary_blocked",
    message: "Refused. Account-link persistence boundary blocked.",
    safeForModel: true,
    stytchSubjectExposed: false,
    clerkIdExposed: false,
    rawClaimsExposed: false,
    tokenEchoed: false,
    version: 1,
  },
  capabilities: {
    ...ACCOUNT_LINK_ALLOWED.capabilities,
    accountLinkPersistence: "blocked",
  },
  modelVisible: false,
  version: 1,
} as const satisfies McpProductionAccountLinkPersistenceResultV1;

const ACCOUNT_LINK_RESOLUTION = {
  kind: "mcp_account_link_server_only_owner_resolution",
  provider: "stytch",
  twoweeksClerkId: "clerk_DO_NOT_ECHO",
  grantedReadScopes: ALL_SCOPES,
  grantRef: "grant-ref-1",
  consentRef: "consent-ref-1",
  auditReasonCode: "account_link_verified",
  version: 1,
} as const;

const CONSENT = {
  kind: "local_mcp_consent_grant",
  granted: true,
  purposes: ["future_real_data_read"],
  grantedBy: "boundary-operator",
  grantedAt: "2026-06-15T11:00:00.000Z",
  expiresAt: "2099-06-15T11:00:00.000Z",
  reason: "read-only MCP data refs",
  version: 1,
} as const;

const RETENTION_RECORD = {
  kind: "local_mcp_retention_deletion_record",
  recordRef: "fixture-retention:mcp-read-only-data-refs",
  recordType: "future_audit",
  policyState: "retain_until",
  createdAt: "2026-06-15T11:00:00.000Z",
  retainUntil: "2099-06-15T11:00:00.000Z",
  version: 1,
} as const;

function dataRefs(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_read_only_twoweeks_data_refs_result",
    ownerState: "resolved",
    refs: [
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "applicationPackageRef",
        refId: "mcp-safe-ref:application-package:latest",
        label: "Application package availability",
        status: "available",
        category: "application_package",
        count: 2,
        updatedAt: "2026-06-15T11:30:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "evidenceGraphRef",
        refId: "mcp-safe-ref:evidence-graph:profile",
        label: "Candidate evidence availability",
        status: "available",
        category: "evidence_graph",
        count: 3,
        updatedAt: "2026-06-15T11:20:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "resumeVariantPlanRef",
        refId: "mcp-safe-ref:resume-variant-plan:latest",
        label: "Resume variant plan availability",
        status: "available",
        category: "resume_variant_plan",
        count: 1,
        updatedAt: "2026-06-15T11:10:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "reviewCockpitRef",
        refId: "mcp-safe-ref:review-cockpit:latest",
        label: "Review cockpit availability",
        status: "available",
        category: "review_cockpit",
        count: 4,
        updatedAt: "2026-06-15T11:40:00.000Z",
        version: 1,
      },
    ],
    blockedRefClasses: [],
    capabilities: {
      ownerResolvedServerOnly: true,
      dataReads: "convex_read_only_refs",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      version: 1,
    },
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function adapterInput(
  overrides: Partial<McpReadOnlyTwoweeksDataAdapterInputV1> = {},
): McpReadOnlyTwoweeksDataAdapterInputV1 {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_input",
    authBoundary: AUTH_ALLOWED,
    accountLinkBoundary: ACCOUNT_LINK_ALLOWED,
    accountLinkResolution: ACCOUNT_LINK_RESOLUTION,
    consent: CONSENT,
    retentionRecord: RETENTION_RECORD,
    readOnlyDataRefs: dataRefs(),
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function expectBlockedWithoutTouchingData(
  overrides: Partial<McpReadOnlyTwoweeksDataAdapterInputV1>,
  reason: string,
): void {
  const throwingDataRefs = {};
  Object.defineProperty(throwingDataRefs, "kind", {
    enumerable: true,
    get() {
      throw new Error("data refs must not be read before boundary gates pass");
    },
  });

  const result = projectMcpReadOnlyTwoweeksDataAdapter(
    adapterInput({ readOnlyDataRefs: throwingDataRefs, ...overrides }),
  );

  expect(result).toEqual({
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpReadOnlyTwoweeksDataAdapterSafeRefusal(),
    capabilities: expect.objectContaining({
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
    }),
    modelVisible: true,
    version: 1,
  });
}

function expectInvalidAdapterInput(value: unknown): void {
  expect(() => projectMcpReadOnlyTwoweeksDataAdapter(value)).not.toThrow();
  expect(projectMcpReadOnlyTwoweeksDataAdapter(value)).toEqual({
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: false,
    reason: "invalid_input",
    safeRefusal: buildMcpReadOnlyTwoweeksDataAdapterSafeRefusal(),
    capabilities: expect.objectContaining({
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
    }),
    modelVisible: true,
    version: 1,
  });
}

function assertNoSensitiveOutput(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "clerk_DO_NOT_ECHO",
    "providerSubject",
    "stytch_subject",
    "rawClaims",
    "accessToken",
    "refreshToken",
    "Bearer ",
    "RAW_CV_TEXT",
    "RAW_JOB_TEXT",
    "sourceText",
    "sourceQuote",
    "rawDescription",
    "sourceJobDescription",
    "proposal content",
    "privateFacts",
    "never_use",
    "structuredShadow",
    "rawSelectorResult",
    "debugPayload",
    "real-user@example.test",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function sourceFiles(): readonly string[] {
  return [ADAPTER_SOURCE_FILE, TEST_SOURCE_FILE].map((file) => readFileSync(file, "utf8"));
}

function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
    (match) => match[1],
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR59 read-only Twoweeks data adapter", () => {
  it("fails closed for malformed top-level adapter input", () => {
    for (const value of [undefined, null, [], {}, { kind: "wrong", version: 1 }] as const) {
      expectInvalidAdapterInput(value);
    }
  });

  it("fails closed for non-plain or prototype-backed top-level adapter input", () => {
    expectInvalidAdapterInput(Object.create(adapterInput()));

    class PrototypeBackedAdapterInput {
      kind = "mcp_read_only_twoweeks_data_adapter_input";
      authBoundary = AUTH_ALLOWED;
      accountLinkBoundary = ACCOUNT_LINK_ALLOWED;
      accountLinkResolution = ACCOUNT_LINK_RESOLUTION;
      consent = CONSENT;
      retentionRecord = RETENTION_RECORD;
      readOnlyDataRefs = dataRefs();
      now = NOW;
      version = 1;
    }

    expectInvalidAdapterInput(new PrototypeBackedAdapterInput());
  });

  it("fails closed for a top-level symbol key", () => {
    const input = adapterInput() as Record<PropertyKey, unknown>;
    input[Symbol("unexpected")] = "blocked";

    expectInvalidAdapterInput(input);
  });

  it("fails closed for a top-level non-enumerable key", () => {
    const input = adapterInput() as Record<PropertyKey, unknown>;
    Object.defineProperty(input, "hidden", {
      enumerable: false,
      value: "blocked",
    });

    expectInvalidAdapterInput(input);
  });

  it("fails closed for a top-level throwing getter without invoking it", () => {
    let getterInvoked = false;
    const input = adapterInput() as Record<PropertyKey, unknown>;
    Object.defineProperty(input, "kind", {
      enumerable: true,
      get() {
        getterInvoked = true;
        throw new Error("adapter getter must not be invoked");
      },
    });

    expectInvalidAdapterInput(input);
    expect(getterInvoked).toBe(false);
  });

  it("fails closed for top-level boundary accessors without invoking them", () => {
    for (const propertyName of [
      "authBoundary",
      "accountLinkBoundary",
      "readOnlyDataRefs",
      "retentionRecord",
    ] as const) {
      let getterInvoked = false;
      const input = adapterInput() as Record<PropertyKey, unknown>;
      Object.defineProperty(input, propertyName, {
        enumerable: true,
        get() {
          getterInvoked = true;
          throw new Error(`${propertyName} getter must not be invoked`);
        },
      });

      expectInvalidAdapterInput(input);
      expect(getterInvoked).toBe(false);
    }
  });

  it("requires production Stytch authorization before touching data refs", () => {
    expectBlockedWithoutTouchingData({ authBoundary: AUTH_DENIED }, "auth_required");
  });

  it("requires the server-only account-link boundary before touching data refs", () => {
    expectBlockedWithoutTouchingData(
      { accountLinkBoundary: ACCOUNT_LINK_DENIED },
      "account_link_required",
    );
    expectBlockedWithoutTouchingData(
      { accountLinkResolution: { ...ACCOUNT_LINK_RESOLUTION, provider: "other" } },
      "account_link_required",
    );
  });

  it("requires consent before touching data refs", () => {
    expectBlockedWithoutTouchingData({ consent: undefined }, "consent_required");
    expectBlockedWithoutTouchingData(
      { consent: { ...CONSENT, expiresAt: "2026-06-15T11:59:59.000Z" } },
      "consent_required",
    );
    expectBlockedWithoutTouchingData(
      { consent: { ...CONSENT, purposes: ["fixture_summary_preview"] } },
      "consent_required",
    );
  });

  it("requires retention/deletion boundary success before projection", () => {
    const result = projectMcpReadOnlyTwoweeksDataAdapter(
      adapterInput({
        retentionRecord: {
          ...RETENTION_RECORD,
          policyState: "deletion_requested",
          deletionRequestedAt: "2026-06-15T11:30:00.000Z",
        },
      }),
    );

    expect(result).toMatchObject({ allowed: false, reason: "retention_blocked" });
    assertNoSensitiveOutput(result);
  });

  it("projects only approved opaque refs with safe categories and counts", () => {
    const result = projectMcpReadOnlyTwoweeksDataAdapter(adapterInput());

    expect(result).toMatchObject({
      kind: "mcp_read_only_twoweeks_data_adapter_result",
      allowed: true,
      reason: "read_only_refs_projected",
      refs: {
        applicationPackageRef: {
          id: "mcp-safe-ref:application-package:latest",
          status: "available",
          category: "application_package",
          count: 2,
        },
        evidenceGraphRef: {
          id: "mcp-safe-ref:evidence-graph:profile",
          status: "available",
          category: "evidence_graph",
          count: 3,
        },
        resumeVariantPlanRef: {
          id: "mcp-safe-ref:resume-variant-plan:latest",
          status: "available",
          category: "resume_variant_plan",
          count: 1,
        },
        reviewCockpitRef: {
          id: "mcp-safe-ref:review-cockpit:latest",
          status: "available",
          category: "review_cockpit",
          count: 4,
        },
      },
      blockedRefClasses: [],
      audit: {
        checked: true,
        persisted: false,
        rawPayloadLogged: false,
      },
      capabilities: {
        auth: "production_stytch_verified",
        accountLink: "server_only_owner_resolved",
        consent: "future_real_data_read",
        audit: "redacted_boundary_checked",
        retention: "boundary_checked",
        dataReads: "convex_read_only_refs",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
        credentialStorage: "none",
        tokenStorage: "none",
        version: 1,
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("preserves valid adapter input behavior after descriptor-safe parsing", () => {
    const result = projectMcpReadOnlyTwoweeksDataAdapter(adapterInput());

    expect(result).toMatchObject({
      allowed: true,
      reason: "read_only_refs_projected",
      refs: {
        applicationPackageRef: {
          id: "mcp-safe-ref:application-package:latest",
          status: "available",
        },
      },
      capabilities: {
        dataReads: "convex_read_only_refs",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("does not project a class unless auth, account link, and owner resolution include that class scope", () => {
    const scopedAuth = {
      ...AUTH_ALLOWED,
      serverOnly: {
        ...AUTH_ALLOWED.serverOnly,
        grantedReadScopes: ["twoweeks.mcp.read", "twoweeks.evidence_graph.read"],
      },
    } as const satisfies McpProductionStytchOAuthConfigBoundaryResultV1;
    const scopedAccountLink = {
      ...ACCOUNT_LINK_ALLOWED,
      serverOnly: {
        ...ACCOUNT_LINK_ALLOWED.serverOnly,
        grantedReadScopes: ["twoweeks.mcp.read", "twoweeks.evidence_graph.read"],
      },
    } as const satisfies McpProductionAccountLinkPersistenceResultV1;
    const scopedResolution = {
      ...ACCOUNT_LINK_RESOLUTION,
      grantedReadScopes: ["twoweeks.mcp.read", "twoweeks.evidence_graph.read"],
    } as const;

    const result = projectMcpReadOnlyTwoweeksDataAdapter(
      adapterInput({
        authBoundary: scopedAuth,
        accountLinkBoundary: scopedAccountLink,
        accountLinkResolution: scopedResolution,
      }),
    );

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new TypeError("Expected read-only projection");
    expect(Object.keys(result.refs)).toEqual(["evidenceGraphRef"]);
    expect(result.blockedRefClasses).toEqual([
      { refClass: "applicationPackageRef", reason: "missing_class_scope", version: 1 },
      { refClass: "resumeVariantPlanRef", reason: "missing_class_scope", version: 1 },
      { refClass: "reviewCockpitRef", reason: "missing_class_scope", version: 1 },
    ]);
    assertNoSensitiveOutput(result);
  });

  it("returns safe no-data and onboarding refs without widening capabilities", () => {
    const result = projectMcpReadOnlyTwoweeksDataAdapter(
      adapterInput({
        readOnlyDataRefs: dataRefs({
          ownerState: "onboarding_required",
          refs: [
            {
              kind: "mcp_read_only_twoweeks_data_ref_candidate",
              refClass: "applicationPackageRef",
              refId: "mcp-safe-ref:application-package:latest",
              label: "Application package availability",
              status: "onboarding_required",
              category: "application_package",
              count: 0,
              version: 1,
            },
          ],
        }),
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      reason: "read_only_refs_unavailable",
      refs: {
        applicationPackageRef: {
          status: "onboarding_required",
          count: 0,
        },
      },
      capabilities: {
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
    });
    assertNoSensitiveOutput(result);
  });

  it("fails closed when a safe-ref candidate contains raw or identifier-shaped payload", () => {
    const result = projectMcpReadOnlyTwoweeksDataAdapter(
      adapterInput({
        readOnlyDataRefs: dataRefs({
          refs: [
            {
              kind: "mcp_read_only_twoweeks_data_ref_candidate",
              refClass: "applicationPackageRef",
              refId: "mcp-safe-ref:application-package:j97convexdocumentid",
              label: "Application package availability",
              status: "available",
              category: "application_package",
              count: 1,
              rawDescription: "RAW_JOB_TEXT",
              version: 1,
            },
          ],
        }),
      }),
    );

    expect(result).toMatchObject({ allowed: false, reason: "unsafe_projection_blocked" });
    assertNoSensitiveOutput(result);
  });

  it("keeps the source disconnected from handlers, tools runtime, connectors, network, model calls, and writes", () => {
    const allowedImports = new Set([
      "../mcpReadOnlyTwoweeksDataAdapter",
      "../mcpProductionAccountLinkPersistenceBoundary",
      "../mcpProductionStytchOAuthConfigBoundary",
      "../mcpConsentGate",
      "../mcpRedactedAuditLog",
      "../mcpRetentionDeletionBoundary",
      "../mcpSafeConvexSelectorProjectionBoundary",
      "node:fs",
      "node:path",
      "node:url",
      "vitest",
    ]);
    const forbiddenImportSpecifier =
      /^(?:convex(?:\/|$)|node:https?$|https?$|@openai(?:\/|$)|openai(?:\/|$)|@modelcontextprotocol(?:\/|$)|axios$|undici$)|(?:\/|^)(?:_generated|handlers?|tools\/list|tools\/call)(?:\/|$)|token-storage|tokenStorage|llm-runtime|model-runtime/iu;
    const forbiddenCallPatterns = [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bcreateServer\s*\(/u,
      /\.listen\s*\(/u,
      /\bnew\s+WebSocket\b/u,
      /\bEventSource\s*\(/u,
      /\bctx\.(?:db|runQuery|runMutation|scheduler|auth)\b/u,
      /\b(?:query|mutation|internalQuery|internalMutation|internalAction|action)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:executeLocalMcpRequest|handleLocalMcpDevEndpointRequest)\s*\(/u,
      /\b(?:openai|langchain|tokenEndpoint|refreshToken|revocationEndpoint|oauth\/callback)\b/iu,
    ] as const;

    for (const source of sourceFiles()) {
      for (const specifier of importSpecifiers(source)) {
        expect(allowedImports.has(specifier) || !forbiddenImportSpecifier.test(specifier)).toBe(true);
      }

      const executableSource = stripStringAndPatternLiterals(source);
      for (const pattern of forbiddenCallPatterns) {
        expect(executableSource).not.toMatch(pattern);
      }
    }
  });

  it("keeps top-level adapter parsing descriptor-safe before input reads", () => {
    const implementation = readFileSync(ADAPTER_SOURCE_FILE, "utf8");
    const executableSource = stripStringAndPatternLiterals(implementation);
    const functionStart = executableSource.indexOf("export function projectMcpReadOnlyTwoweeksDataAdapter");
    const parseCall = executableSource.indexOf("parseAdapterInput(input)", functionStart);
    const preParseSource = executableSource.slice(functionStart, parseCall);

    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(parseCall).toBeGreaterThan(functionStart);
    expect(executableSource).toContain("function parseAdapterInput(value: unknown)");
    expect(executableSource).toContain("Object.getOwnPropertyDescriptors");
    expect(executableSource).toContain("Reflect.ownKeys");
    expect(preParseSource).not.toMatch(
      /\binput\.(?:kind|version|authBoundary|accountLinkBoundary|accountLinkResolution|consent|retentionRecord|readOnlyDataRefs|now)\b/u,
    );
  });
});
