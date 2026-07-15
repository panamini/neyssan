// @vitest-environment node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMcpOAuthProductionViteAllowedHosts,
  createLocalMcpDevEndpointPlugin,
  normalizeMcpOAuthProductionRedirectUris,
} from "../../../../vite.config";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import type {
  McpOAuthAuthorizationRequestBoundaryConfigV1,
  McpOAuthAuthorizationRequestBoundaryHandoffV1,
  McpOAuthAuthorizationTrustedOwnerV1,
} from "../mcpOAuthAuthorizationRequestBoundary";
import {
  buildMcpOAuthLocalDevRouteAdapterConfig,
  handleMcpOAuthLocalDevRouteRequest,
  LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG,
  LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR,
} from "../mcpOAuthLocalDevRouteAdapter";
import {
  buildMcpAuthenticatedProtocolEnvelope,
  parseMcpJsonRpcProtocolMessage,
} from "../mcpAuthenticatedProtocolEnvelope";
import type { McpProductionPrivateBetaGateConfigInputV1 } from "../mcpProductionPrivateBetaGate";
import {
  MCP_PRODUCTION_LAUNCH_READINESS_AUTHENTICATED_PROTOCOL_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_POLICY_KERNEL_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PRIVATE_BETA_GATE_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_CATALOG_SUBMISSION_URL_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PROVIDER_WRITE_EXPANSION_BLOCKED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_LAUNCH_REQUESTED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_EXECUTION_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_STATUS_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_SCHEMA_MATCHER_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_READ_ONLY_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_LIST_METADATA_REVIEWED_FLAG,
  MCP_PRODUCTION_LAUNCH_READINESS_UNRESOLVED_BLOCKING_FINDINGS_FLAG,
  type McpProductionLaunchReadinessConfigInputV1,
  type McpProductionLaunchReadinessEvidenceInputV1,
} from "../mcpProductionLaunchReadiness";
import { evaluateMcpProductionPolicy } from "../mcpProductionPolicyKernel";
import {
  MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
  type McpProductionReadonlySummaryExecutionInputV1,
  type McpProductionReadonlySummaryExecutionResultV1,
} from "../mcpProductionReadonlySummaryExecutor";
import {
  buildMcpProductionReadonlySummaryMcpResultV2,
  buildMcpProductionReadonlySummaryOutputSchemaV2,
  MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
} from "../mcpProductionReadonlySummaryProjectorV2";
import { buildMcpProductionToolsListResult } from "../mcpProductionToolsListProjection";
import type { McpOAuthProductionActivationDependenciesV1 } from "../mcpOAuthProductionActivationBoundary";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  handleMcpOAuthProductionRouteRequest,
  isMcpOAuthProductionRouteHandledPath,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
  MCP_OAUTH_PRODUCTION_TOKEN_PATH,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
  type McpOAuthProductionAuthorizationCodeCreatePortInputV1,
  type McpOAuthProductionRouteAdapterDependenciesV1,
  type McpOAuthProductionRouteAdapterRequestV1,
  type McpOAuthProductionRoutePathV1,
} from "../mcpOAuthProductionRouteAdapter";
import { MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG } from "../mcpOAuthProductionRoutePreflightBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  type McpOAuthContinuationHandleCodecV1,
} from "../mcpOAuthLoginReturnContinuationBoundary";
import {
  MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER,
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
} from "../../../pages/sign-in-return";

const { convexHttpClientMutation, convexHttpClientQuery, convexHttpClientSetAdminAuth, ConvexHttpClientMock } = vi.hoisted(() => {
  const mutation = vi.fn();
  const query = vi.fn();
  const setAdminAuth = vi.fn();
  return {
    convexHttpClientMutation: mutation,
    convexHttpClientQuery: query,
    convexHttpClientSetAdminAuth: setAdminAuth,
    ConvexHttpClientMock: vi.fn(function ConvexHttpClient() {
      return { mutation, query, setAdminAuth };
    }),
  };
});

const { createRemoteJWKSetMock, jwtVerifyMock } = vi.hoisted(() => ({
  createRemoteJWKSetMock: vi.fn(() => "clerk_jwks_fixture"),
  jwtVerifyMock: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: ConvexHttpClientMock,
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  jwtVerify: jwtVerifyMock,
}));

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthProductionRouteAdapter.ts");
const AUTHENTICATED_ENVELOPE_SOURCE_FILE = resolve(TEST_DIR, "../mcpAuthenticatedProtocolEnvelope.ts");
const READONLY_SUMMARY_EXECUTOR_SOURCE_FILE = resolve(TEST_DIR, "../mcpProductionReadonlySummaryExecutor.ts");
const VITE_CONFIG_SOURCE = resolve(TEST_DIR, "../../../../vite.config.ts");
const REPOSITORY_ROOT = resolve(TEST_DIR, "../../../../..");
const RUN_SCRIPT_SOURCE = resolve(REPOSITORY_ROOT, "run.sh");
const DOCKERIGNORE_SOURCE = resolve(REPOSITORY_ROOT, ".dockerignore");
const ROOT_ENV_EXAMPLE_SOURCE = resolve(REPOSITORY_ROOT, ".env.example");
const APP_ENV_EXAMPLE_SOURCE = resolve(REPOSITORY_ROOT, "my-app/.env.local.example");
const INFISICAL_PROJECT_CONFIG_SOURCE = resolve(REPOSITORY_ROOT, ".infisical.json");
const LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND = "mcp_production_tools_call_readonly_synthetic_result";
const APP_ORIGIN = "http://localhost:5173";
const PROD_APP_ORIGIN = "https://mcp.twoweeks.example.test";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const RESOURCE = "https://mcp.twoweeks.example.test/resource";
const CLIENT_ID = "chatgpt_apps_sdk_client";
const STATE = "opaque_state_1234567890";
const RAW_CODE_VERIFIER = "V".repeat(43);
const PKCE = pkceChallenge(RAW_CODE_VERIFIER);
const RAW_HANDLE = "0123456789abcdef".repeat(4);
const HANDLE_HASH = sha256Hex(RAW_HANDLE);
const BROWSER_NONCE = "b".repeat(64);
const BROWSER_NONCE_COOKIE = `tw_mcp_oauth_continue=${BROWSER_NONCE}`;
const RAW_AUTHORIZATION_CODE = "C".repeat(43);
const AUTHORIZATION_CODE_DIGEST = sha256Hex(RAW_AUTHORIZATION_CODE);
const RAW_ACCESS_TOKEN = "T".repeat(43);
const ACCESS_TOKEN_DIGEST = sha256Hex(RAW_ACCESS_TOKEN);
const RAW_CONFIDENTIAL_CLIENT_SECRET = "confidential_client_post_secret_fixture";
const CONFIDENTIAL_CLIENT_SECRET_DIGEST = sha256Hex(RAW_CONFIDENTIAL_CLIENT_SECRET);
const OWNER_ID = "user_twoweeks_fixture_123";
const OTHER_OWNER_ID = "user_twoweeks_fixture_456";
const OWNER_DIGEST = sha256Hex(OWNER_ID);
const OTHER_OWNER_DIGEST = sha256Hex(OTHER_OWNER_ID);
const SENSITIVE_ROUTE_SENTINELS = Object.freeze([
  "raw CV text sentinel",
  "raw job description sentinel",
  "raw proposal body sentinel",
  "system prompt sentinel",
  "provider output sentinel",
  "quoted source sentence sentinel",
  "user@example.test",
  "access_token_secret_sentinel",
  "refresh_token_secret_sentinel",
  "https://private.example.test/path?token=secret",
  "Error: private stack trace sentinel",
  "jd7c0nveXsentinel000000000000",
  "internalQueryRefSentinel",
]);
const CLERK_ISSUER = "https://clerk.twoweeks.example.test";
const CLERK_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signature";
const NOW = Date.parse("2026-06-27T09:00:00.000Z");
const FORBIDDEN_ROUTE_SOURCE_PATTERNS = Object.freeze([
  /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/u,
  /from\s+["']@stytch|Stytch|OAuthProvider/u,
  /exchangeAuthorizationCode|executeAccountLinkLifecycle/u,
  /\b(?:insert|patch|replace|delete)\s*\(/u,
  /\b(?:localStorage|sessionStorage|document\.cookie)\b/u,
  /authorizationCodeIssued:\s*true|accountLinkCreated:\s*true/u,
  /refreshTokenPersisted:\s*true/u,
] as const);
const FORBIDDEN_PREFLIGHT_REIMPLEMENTATION_PATTERNS = Object.freeze([
  /buildMcpOAuthProductionActivationConfig/u,
  /buildMcpOperationalProductionOAuthActivationStatus/u,
  /MCP_OAUTH_PRODUCTION_RUNTIME_FLAG/u,
  /MCP_OAUTH_PRODUCTION_APPROVED_FLAG/u,
  /routeWiringEnabled\s*=/u,
] as const);
const FORBIDDEN_READONLY_SUMMARY_EXECUTOR_SOURCE_PATTERNS = Object.freeze([
  /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource|createRemoteJWKSet|jwtVerify)\b/u,
  /from\s+["'](?:@clerk|@langchain|@mistralai|@openai|axios|convex\/browser|convex\/server|jose|node-fetch|react|undici)/u,
  /\b(?:makeFunctionReference|FunctionReference|mutation|insert|patch|replace|delete)\b/u,
  /createAuthorizationCode|issueAccessToken|validateAuthorizationCode|refreshToken|accountLink|executeAccountLinkLifecycle/u,
  /exchangeAuthorizationCode|providerAdapter|modelPrompt|localStorage|sessionStorage|document\.cookie/u,
  /from\s+["'][.]{2}\/[.]{2}\/(?:components|pages|hooks|app|ui)\//u,
] as const);
const READONLY_SUMMARY_CASES = Object.freeze([
  {
    toolName: "twoweeks.application_package.summarize",
    argumentKey: "applicationPackageRef",
    rawRefId: "application-package-secret-ref",
    expectedKind: "mcp_application_package_summary_result",
    resultRefKey: "packageRef",
    safeRefId: "mcp-safe-ref:application-package:latest",
    category: "application_package",
    dataReads: "convex_application_package_summary",
    missingDataReason: "application_package_not_available",
  },
  {
    toolName: "twoweeks.evidence_graph.summarize",
    argumentKey: "evidenceGraphRef",
    rawRefId: "evidence-graph-secret-ref",
    expectedKind: "mcp_evidence_graph_summary_result",
    resultRefKey: "evidenceGraphRef",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    category: "evidence_graph",
    dataReads: "convex_evidence_graph_summary",
    missingDataReason: "evidence_graph_not_available",
  },
  {
    toolName: "twoweeks.resume_variant_plan.summarize",
    argumentKey: "resumeVariantPlanRef",
    rawRefId: "resume-variant-plan-secret-ref",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    resultRefKey: "resumeVariantPlanRef",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    category: "resume_variant_plan",
    dataReads: "convex_resume_variant_plan_summary",
    missingDataReason: "resume_variant_plan_not_available",
  },
  {
    toolName: "twoweeks.review_cockpit.summarize",
    argumentKey: "reviewCockpitRef",
    rawRefId: "review-cockpit-secret-ref",
    expectedKind: "mcp_review_cockpit_summary_result",
    resultRefKey: "reviewCockpitRef",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
    category: "review_cockpit",
    dataReads: "convex_review_cockpit_summary",
    missingDataReason: "review_cockpit_not_available",
  },
] as const);
const COMPATIBILITY_CATALOG_CASES = Object.freeze([
  {
    id: "twoweeks.application_package.summarize",
    title: "Twoweeks application package summary",
    url: "https://mcp.twoweeks.ai/mcp#application-package",
    category: "application_package",
    text: "Safe catalog entry for the read-only Twoweeks application package summary. It exposes only capability and availability status through the OAuth-protected summary tool.",
  },
  {
    id: "twoweeks.evidence_graph.summarize",
    title: "Twoweeks evidence graph summary",
    url: "https://mcp.twoweeks.ai/mcp#evidence-graph",
    category: "evidence_graph",
    text: "Safe catalog entry for the read-only Twoweeks evidence graph summary. It exposes only capability and availability status through the OAuth-protected summary tool.",
  },
  {
    id: "twoweeks.resume_variant_plan.summarize",
    title: "Twoweeks resume variant plan summary",
    url: "https://mcp.twoweeks.ai/mcp#resume-variant-plan",
    category: "resume_variant_plan",
    text: "Safe catalog entry for the read-only Twoweeks resume variant plan summary. It exposes only capability and availability status through the OAuth-protected summary tool.",
  },
  {
    id: "twoweeks.review_cockpit.summarize",
    title: "Twoweeks review cockpit summary",
    url: "https://mcp.twoweeks.ai/mcp#review-cockpit",
    category: "review_cockpit",
    text: "Safe catalog entry for the read-only Twoweeks review cockpit summary. It exposes only capability and availability status through the OAuth-protected summary tool.",
  },
] as const);

type StoredPreAuthIntentRecord = {
  kind: "mcp_oauth_pre_auth_intent_record";
  version: 1;
  preAuthHandleHash: string;
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  responseType: "code";
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  approvedOptionalParameters?: Readonly<Partial<Record<"nonce" | "prompt", string>>>;
  providerValidationStatus: "pending";
  status: "pre_auth_pending" | "claimed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  claimedAt?: number;
  storageVersion: 1;
  _id: string;
  _creationTime: number;
};

type StoredAuthorizationIntentRecord = {
  kind: "mcp_oauth_authorization_intent_record";
  version: 1;
  intentHandleHash: string;
  twoweeksClerkId: string;
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  responseType: "code";
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  approvedOptionalParameters?: Readonly<Partial<Record<"nonce" | "prompt", string>>>;
  providerValidationStatus: "pending";
  status: "pending" | "consumed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  consumedAt?: number;
  storageVersion: 1;
  _id: string;
  _creationTime: number;
};

type StoredAuthorizationCodeRecord = {
  kind: "mcp_oauth_authorization_code_record";
  version: 1;
  authorizationCodeDigest: string;
  twoweeksClerkId: string;
  ownerIssuer: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
  status: "pending" | "consumed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  consumedAt?: number;
  storageVersion: 1;
  _id: string;
  _creationTime: number;
};

type StoredAccessTokenRecord = {
  kind: "mcp_oauth_access_token_record";
  version: 1;
  accessTokenDigest: string;
  authorizationCodeDigest: string;
  twoweeksClerkId: string;
  ownerIssuer: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
  status: "active" | "expired" | "revoked";
  issuedAt: number;
  updatedAt: number;
  expiresAt: number;
  storageVersion: 1;
  _id: string;
  _creationTime: number;
};

const PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: RESOURCE,
  providerEnvironment: "prod_us_1",
  allowedClientIds: [CLIENT_ID],
  requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
  version: 1,
} as const;

afterEach(() => {
  convexHttpClientMutation.mockReset();
  convexHttpClientQuery.mockReset();
  convexHttpClientSetAdminAuth.mockReset();
  ConvexHttpClientMock.mockClear();
  createRemoteJWKSetMock.mockClear();
  jwtVerifyMock.mockReset();
  vi.unstubAllEnvs();
});

const deterministicCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
  generate: () => Object.freeze({ rawHandle: RAW_HANDLE, intentHandleHash: HANDLE_HASH }),
  validate: (rawHandle: unknown): rawHandle is string =>
    defaultMcpOAuthContinuationHandleCodecV1.validate(rawHandle),
  hash: (rawHandle: string) => sha256Hex(rawHandle),
});

describe("MCP OAuth production route adapter", () => {
  it("keeps production routes disabled by default", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        kind: "mcp_oauth_production_route_response",
        status: "blocked",
        reason: "disabled",
        route: "oauth_authorize",
        safeForModel: true,
        allowedByPreflight: false,
        preflightDecision: "disabled",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
        tokenPersisted: false,
        hostedMcpStarted: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when only the production runtime flag is enabled", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ runtime: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_approval_flag",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_approval_flag",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when the production runtime flag is missing", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ approved: "1", routeWiring: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_runtime_flag",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_runtime_flag",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling without the explicit production route wiring flag", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ runtime: "1", approved: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_endpoint_exposure_not_enabled",
        allowedByPreflight: false,
        preflightDecision: "blocked_endpoint_exposure_not_enabled",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when provider config is malformed", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          issuer: "http://stytch.example.test/",
        },
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_misconfigured_provider",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_misconfigured_provider",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when activation dependency ports are unavailable", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_activation_dependency",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_activation_dependency",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("allows authorize pre-auth creation when activation dependency ports are unavailable", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: PROVIDER_CONFIG,
    });

    const authorizeResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    const callbackResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      config,
    );

    expect(authorizeResponse).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expect(callbackResponse).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_activation_dependency",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_activation_dependency",
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(authorizeResponse, [], { allowRawHandle: true });
    expectNoRouteLeakage(callbackResponse);
  });

  it("fails closed when production authorize is ready but missing pre-auth dependencies", async () => {
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      config,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "dependency_unavailable",
        route: "oauth_authorize",
        allowedByPreflight: true,
        preflightDecision: "ready_to_wire",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects invalid production authorization requests before creating pre-auth storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        "GET",
        authorizationRequestPath({ owner: "owner_should_not_echo" }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "invalid_authorization_request",
        route: "oauth_authorize",
        authorizationCodeIssued: false,
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response, ["owner_should_not_echo"]);
  });

  it("rejects production authorization requests on an unexpected host before storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: "unexpected.example.test" },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "invalid_host",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("accepts production authorization requests with an explicit default HTTPS host port", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: "mcp.twoweeks.example.test:443" },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("accepts canonical origin-only config with a trailing slash", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        authorizationPageOrigin: `${PROD_APP_ORIGIN}/`,
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(response.headers.location).not.toContain(`${PROD_APP_ORIGIN}//sign-in`);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("rejects ambiguous multi-valued host headers before storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: ["mcp.twoweeks.example.test", "unexpected.example.test"] },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "invalid_host",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps malformed production authorization origins to a server-side failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        authorizationPageOrigin: "not-a-url",
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps malformed production authorization config to a server-side failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        allowedRedirectUris: [],
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("rejects production authorization config that drifts from the preflighted provider config", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        canonicalResource: "https://mcp.twoweeks.example.test/drifted-resource",
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("accepts authorization config when preflight provider client IDs only differ by normalization", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          allowedClientIds: [` ${CLIENT_ID} `, CLIENT_ID],
        },
      }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("requires a quota gate before unauthenticated production pre-auth storage", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "rate_limited",
        safeFailure: {
          code: "mcp_oauth_pre_auth_quota_denied",
          message: "Pre-auth quota denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "pre_auth_quota_denied",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      authorizationPageOrigin: PROD_APP_ORIGIN,
      clientId: CLIENT_ID,
      resource: RESOURCE,
      now: NOW,
      version: 1,
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps invalid quota requests to bad request instead of throttling", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "invalid_request",
        safeFailure: {
          code: "mcp_oauth_pre_auth_quota_denied",
          message: "Pre-auth quota denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "pre_auth_quota_denied",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("bounds stalled quota checks before awaiting pre-auth storage", async () => {
    vi.useFakeTimers();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    try {
      const responsePromise = handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );
      await vi.advanceTimersByTimeAsync(2_500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        handled: true,
        status: 503,
        json: {
          status: "blocked",
          reason: "pre_auth_quota_denied",
          preAuthIntentCreated: false,
        },
      });
      expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
      expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
      expectNoRouteLeakage(response);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps thrown pre-auth storage failures to retryable dependency failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      createPreAuthIntent: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps pre-auth handle collisions to conflict without leaking the handle", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: false,
        reason: "handle_collision",
        safeFailure: {
          code: "mcp_oauth_pre_auth_intent_denied",
          message: "Pre-auth intent denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("creates one ownerless pre-auth intent and redirects to the fixed Clerk sign-in return path", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        "GET",
        authorizationRequestPath({ nonce: "nonce_fixture", prompt: "consent" }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303, bodyText: "" });
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      pragma: "no-cache",
      location: `${PROD_APP_ORIGIN}/sign-in?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}&${MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER}=${BROWSER_NONCE}`,
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      callerKey: "unknown",
    });
    expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
      preAuthHandleHash: HANDLE_HASH,
      now: NOW,
      deadlineEpochMs: NOW + 2_500,
      timeoutMs: 2_500,
      version: 1,
    });
    expect(JSON.stringify(dependencies.createPreAuthIntent.mock.calls[0]?.[0])).not.toContain(RAW_HANDLE);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("twoweeksClerkId");
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("stytchSubject");
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("accountLinkId");
    expect(JSON.stringify(ctx.preAuthRows[0])).not.toContain(RAW_HANDLE);
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("issues a production authorization code from a valid owner-bound continuation without provider, token, or account-link behavior", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);

    const authorizeResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    const continuationResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(authorizeResponse).toMatchObject({ handled: true, status: 303 });
    expect(authorizeResponse.headers["set-cookie"]).toContain(BROWSER_NONCE_COOKIE);
    expect(authorizeResponse.headers["set-cookie"]).toContain("HttpOnly");
    expect(authorizeResponse.headers["set-cookie"]).toContain("SameSite=Lax");
    const signInRedirect = new URL(authorizeResponse.headers.location);
    expect(signInRedirect.searchParams.get(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER)).toBe(RAW_HANDLE);
    expect(signInRedirect.searchParams.get(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER)).toBe(BROWSER_NONCE);
    expect(continuationResponse).toMatchObject({
      handled: true,
      status: 302,
      bodyText: "",
    });
    const clientRedirect = new URL(continuationResponse.headers.location);
    expect(`${clientRedirect.origin}${clientRedirect.pathname}`).toBe(REDIRECT_URI);
    expect(clientRedirect.searchParams.get("code")).toBe(RAW_AUTHORIZATION_CODE);
    expect(clientRedirect.searchParams.get("state")).toBe(STATE);
    expect(clientRedirect.searchParams.get("iss")).toBe("https://mcp.twoweeks.example.test/");
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(1);
    expect(dependencies.consumeAuthorizationIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.createAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner.mock.calls[0]?.[0]).toEqual({
      preAuthHandleHash: HANDLE_HASH,
      authenticatedOwnerIdentity: {
        subject: OWNER_ID,
        issuer: CLERK_ISSUER,
        version: 1,
      },
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(dependencies.bindPreAuthIntentToAuthenticatedOwner.mock.calls[0]?.[0])).not.toContain(
      RAW_HANDLE,
    );
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "claimed",
      claimedAt: NOW,
      updatedAt: NOW,
    });
    expect(ctx.authorizationRows[0]).toMatchObject({ status: "consumed", consumedAt: NOW });
    expect(ctx.authorizationCodeRows).toHaveLength(1);
    expect(ctx.authorizationCodeRows[0]).toMatchObject({
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: CLERK_ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      state: STATE,
      codeChallenge: PKCE,
      codeChallengeMethod: "S256",
      productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
      status: "pending",
    });
    expect(JSON.stringify(dependencies.createAuthorizationCode.mock.calls[0]?.[0])).not.toContain(
      RAW_AUTHORIZATION_CODE,
    );
    expect(JSON.stringify(ctx.authorizationCodeRows[0])).not.toContain(RAW_AUTHORIZATION_CODE);
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(authorizeResponse, [], { allowRawHandle: true });
    expect(JSON.stringify(continuationResponse)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(continuationResponse)).not.toContain(OWNER_ID);
    expect(JSON.stringify(continuationResponse)).not.toContain(PKCE);
  });

  it("accepts browser-returned production continuation parameters when the nonce precedes the intent", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);

    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPathNonceFirst()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 302,
      bodyText: "",
    });
    expect(new URL(response.headers.location).searchParams.get("code")).toBe(RAW_AUTHORIZATION_CODE);
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(1);
    expect(dependencies.consumeAuthorizationIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.createAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(PKCE);
  });

  it("issues a production access token for a valid authorization-code token request", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);

    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        access_token: RAW_ACCESS_TOKEN,
        token_type: "Bearer",
        expires_in: 3_600,
        scope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      },
    });
    expect(dependencies.issueAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.issueAccessToken.mock.calls[0]?.[0]).toEqual({
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      codeChallenge: PKCE,
      now: NOW,
      deadlineEpochMs: NOW + 2_500,
      timeoutMs: 2_500,
      version: 1,
    });
    expect(ctx.authorizationCodeRows[0]).toMatchObject({ status: "consumed", consumedAt: NOW });
    expect(ctx.accessTokenRows).toHaveLength(1);
    expect(ctx.accessTokenRows[0]).toMatchObject({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: CLERK_ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      status: "active",
      issuedAt: NOW,
      expiresAt: NOW + 60 * 60 * 1_000,
    });
    expect(JSON.stringify(ctx.accessTokenRows[0])).not.toContain(RAW_ACCESS_TOKEN);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [], { allowAccessTokenResponse: true });
    expect(JSON.stringify(response)).not.toContain(RAW_AUTHORIZATION_CODE);
    expect(JSON.stringify(response)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(response)).not.toContain(RAW_CODE_VERIFIER);
    expect(JSON.stringify(response)).not.toContain("refresh_token");
  });

  it("returns a safe production /mcp initialize response after bearer verification", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);

    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    const tokenResponse = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);
    const mcpResponse = await handleMcpOAuthProductionRouteRequest(mcpRequest(), config, dependencies);

    expect(tokenResponse).toMatchObject({ handled: true, status: 200 });
    expect(mcpResponse).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "initialize",
        result: {
          protocolVersion: "2025-11-25",
          serverInfo: {
            name: "twoweeks-production-mcp-auth-boundary",
            version: "1.0.0",
          },
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken.mock.calls[0]?.[0]).toEqual({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      allowedClientIds: [CLIENT_ID],
      resource: RESOURCE,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(dependencies.verifyAccessToken.mock.calls[0]?.[0])).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(mcpResponse)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(mcpResponse)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(mcpResponse)).not.toContain(OWNER_ID);
    expect(JSON.stringify(mcpResponse)).not.toContain("authenticated");
    expect(JSON.stringify(mcpResponse)).not.toContain("tools/list");
    expect(JSON.stringify(mcpResponse)).not.toContain("tools/call");
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(mcpResponse);
  });

  it("accepts production /mcp notifications/initialized without side effects", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(`Bearer ${RAW_ACCESS_TOKEN}`, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }, { "mcp-protocol-version": "2025-11-25" }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 202, json: null });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("allows unauthenticated production /mcp initialize for ChatGPT mixed-auth discovery only", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, mcpInitializeRequest("initialize-discovery"), { "mcp-protocol-version": "2025-11-25" }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "initialize-discovery",
        result: {
          protocolVersion: "2025-11-25",
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it.each([
    ["2025-06-18", "2025-06-18"],
    ["2099-01-01", "2025-11-25"],
  ])("negotiates initialize protocol %s as %s", async (requestedVersion, expectedVersion) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, {
        jsonrpc: "2.0",
        id: "initialize-version-negotiation",
        method: "initialize",
        params: {
          protocolVersion: requestedVersion,
          capabilities: {},
          clientInfo: { name: "chatgpt-compatible-client", version: "1" },
        },
      }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "initialize-version-negotiation",
        result: { protocolVersion: expectedVersion },
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it.each(["2025-06-18", "2025-11-25"])(
    "allows unauthenticated production /mcp tools/list for negotiated protocol %s",
    async (protocolVersion) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, mcpJsonRpcRequest("tools/list", "tools-list-discovery"), {
        "mcp-protocol-version": protocolVersion,
      }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-discovery",
        result: {
          tools: expect.any(Array),
        },
      },
    });
    const tools = (response.json as { result: { tools: readonly Record<string, unknown>[] } }).result.tools;
    expect(tools).toHaveLength(6);
    for (const tool of tools) {
      expect(tool.securitySchemes).toEqual([
        { type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] },
      ]);
      expect(tool._meta).toEqual({
        securitySchemes: [{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }],
      });
    }
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    },
  );

  it("allows unauthenticated production /mcp tools/list discovery without a protocol-version header", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, mcpJsonRpcRequest("tools/list", "tools-list-discovery-no-version")),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-discovery-no-version",
        result: {
          tools: expect.any(Array),
        },
      },
    });
    const tools = (response.json as { result: { tools: readonly Record<string, unknown>[] } }).result.tools;
    expect(tools).toHaveLength(6);
    for (const tool of tools) {
      expect(tool.securitySchemes).toEqual([
        { type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] },
      ]);
    }
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("allows unauthenticated production /mcp discovery from a configured OAuth redirect origin", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, mcpJsonRpcRequest("tools/list", "tools-list-chatgpt-origin"), {
        "mcp-protocol-version": "2025-11-25",
        origin: new URL(REDIRECT_URI).origin,
      }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-chatgpt-origin",
        result: {
          tools: expect.any(Array),
        },
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("returns safe production /mcp ping responses after bearer verification", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("ping", "ping-1"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "ping-1",
        result: {},
      },
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it.each(["2025-06-18", "2025-11-25"])(
    "returns authenticated production tools/list metadata for negotiated protocol %s",
    async (protocolVersion) => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        { jsonrpc: "2.0", id: "tools-list-1", method: "tools/list" },
        { "mcp-protocol-version": protocolVersion },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-1",
        result: {
          tools: expect.any(Array),
        },
      },
    });
    const bodyText = JSON.stringify(response);
    const result = (response.json as {
      result: { tools: readonly Record<string, unknown>[] };
    }).result;
    expect(() => ListToolsResultSchema.parse(result)).not.toThrow();
    const tools = result.tools;
    expect(tools).toHaveLength(6);
    expect(tools.map((tool) => tool.name)).toEqual([
      "search",
      "fetch",
      "twoweeks.application_package.summarize",
      "twoweeks.evidence_graph.summarize",
      "twoweeks.resume_variant_plan.summarize",
      "twoweeks.review_cockpit.summarize",
    ]);
    for (const tool of tools) {
      expect(Object.keys(tool).sort()).toEqual([
        "_meta",
        "annotations",
        "description",
        "inputSchema",
        "name",
        "outputSchema",
        "securitySchemes",
        "title",
      ]);
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(tool.securitySchemes).toEqual([
        { type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] },
      ]);
      expect(tool._meta).toEqual({
        securitySchemes: [{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }],
      });
      expect(tool).not.toHaveProperty("localToolId");
      expect(tool).not.toHaveProperty("internalToolId");
      expect(tool).not.toHaveProperty("handler");
      expect(tool).not.toHaveProperty("execute");
      expect(tool).not.toHaveProperty("call");
      expect(String(tool.description)).not.toContain("dry-run");
      expect(String(tool.description)).not.toContain("internal");
      expect(String(tool.description)).not.toContain("local");
      const toolCase = READONLY_SUMMARY_CASES.find((candidate) => candidate.toolName === tool.name);
      if (!toolCase) {
        expect(["search", "fetch"]).toContain(tool.name);
        expect(tool.outputSchema).toEqual(tool.name === "search"
          ? {
              type: "object",
              additionalProperties: false,
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      url: { type: "string" },
                    },
                    required: ["id", "title", "url"],
                  },
                },
              },
              required: ["results"],
            }
          : {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                text: { type: "string" },
                url: { type: "string" },
                metadata: {
                  type: "object",
                  additionalProperties: { type: "string" },
                },
              },
              required: ["id", "title", "text", "url"],
            });
        continue;
      }
      expect(tool.outputSchema).toEqual(
        buildMcpProductionReadonlySummaryOutputSchemaV2(toolCase.toolName),
      );
      expect(JSON.stringify(tool.outputSchema)).not.toContain('"summary"');
      expect(JSON.stringify(tool.outputSchema)).not.toContain("safeCounts");
      expect(JSON.stringify(tool.outputSchema)).not.toContain("safeCategories");
      expect(JSON.stringify(tool.outputSchema)).not.toContain("safeFlags");
      expect(String(tool.description)).toMatch(/^Use this to inspect read-only /u);
      const refSchema = (
        tool.inputSchema as {
          properties?: Record<string, { properties?: Record<string, Record<string, unknown>> }>;
        }
      ).properties?.[toolCase.argumentKey];
      const idSchema = refSchema?.properties?.id ?? {};
      expect(idSchema).toMatchObject({
        type: "string",
        description: `Canonical production safe ref id: ${toolCase.safeRefId}.`,
        const: toolCase.safeRefId,
        enum: [toolCase.safeRefId],
      });
    }
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.consumeAuthorizationIntent).not.toHaveBeenCalled();
    expect(dependencies.createAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expect(bodyText).not.toContain(RAW_ACCESS_TOKEN);
    expect(bodyText).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(bodyText).not.toContain(OWNER_ID);
    expect(bodyText).not.toContain("mcpOAuthAccessTokens_fixture");
    expect(bodyText).not.toContain("provider");
    expect(bodyText).not.toContain("authorizationCodeDigest");
    expect(bodyText).not.toContain("localToolId");
    expect(bodyText).not.toContain("internalToolId");
    expect(bodyText).not.toContain("local_mcp_dry_run");
    expect(bodyText).not.toContain("dry-run");
    expect(bodyText).not.toContain("https://");
    },
  );

  it("accepts safe tools/list metadata params without echoing progress tokens", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "tools-list-progress", { _meta: { progressToken: "progress-1" } }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-progress",
        result: {
          tools: expect.any(Array),
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain("progress-1");
  });

  it("denies production /mcp before policy when private beta config is missing", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("twoweeks/provider.call", "beta-missing"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
        activationDependencies: activationDependencies(),
      }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "private_beta_gate_denied",
        route: "mcp",
        privateBetaGateAllowed: false,
        privateBetaGateCode: "private_beta_missing_config",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain("Method not found.");
    expectNoRouteLeakage(response);
  });

  it("fails malformed and empty production private beta config before policy", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const malformedResponse = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "beta-malformed"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
        activationDependencies: activationDependencies(),
        privateBeta: { enabled: true, allowedClientIds: ["bad\nclient"], allowedResources: [RESOURCE] },
      }),
      dependencies,
    );
    const emptyResponse = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "beta-empty"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
        activationDependencies: activationDependencies(),
        privateBeta: { enabled: true, allowedClientIds: [], allowedResources: [RESOURCE] },
      }),
      dependencies,
    );

    expect(malformedResponse).toMatchObject({
      status: 403,
      json: {
        reason: "private_beta_gate_denied",
        privateBetaGateCode: "private_beta_malformed_config",
      },
    });
    expect(emptyResponse).toMatchObject({
      status: 403,
      json: {
        reason: "private_beta_gate_denied",
        privateBetaGateCode: "private_beta_empty_allowlist",
      },
    });
    expect(JSON.stringify(malformedResponse)).not.toContain("bad\nclient");
    expect(JSON.stringify(emptyResponse)).not.toContain(CLIENT_ID);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(2);
  });

  it("keeps private beta /mcp available when launch readiness config is absent", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpInitializeRequest("initialize-without-launch-readiness"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "initialize-without-launch-readiness",
        result: {
          protocolVersion: "2025-11-25",
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain("launch_config_missing");
    expect(JSON.stringify(response)).not.toContain("public_launch");
    expectNoRouteLeakage(response);
  });

  it("blocks public launch readiness requests before production MCP policy dispatch", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "public-launch-blocked", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-public-launch-blocked" } },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig(
        { runtime: "1", approved: "1", routeWiring: "1" },
        activationDependencies(),
        privateBetaConfig(),
        launchReadinessConfig({ publicLaunchRequested: true }),
      ),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "launch_readiness_blocked",
        route: "mcp",
        launchReadinessCode: "public_launch_blocked",
        launchReadinessPublicLaunchAllowed: false,
        launchReadinessPublicLaunchBlocked: true,
        launchReadinessPrivateBetaGateCode: "private_beta_allowed",
      },
    });
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("tools");
    expect(JSON.stringify(response)).not.toContain("raw-ref-public-launch-blocked");
    expect(JSON.stringify(response)).not.toContain("Method not found.");
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expectNoRouteLeakage(response);
  });

  it.each([
    ["cursor", { cursor: "cursor-1" }],
    ["filters", { filters: { name: "twoweeks.application_package.summarize" } }],
    ["unknown param", { unknown: true }],
    ["unsafe progress token", { _meta: { progressToken: { id: "nested" } } }],
  ] as const)("fails tools/list closed for %s params", async (_label, params) => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "tools-list-invalid", params),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-list-invalid",
        error: {
          code: -32602,
          message: "Invalid tools/list params.",
          safeForModel: true,
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it.each(
    READONLY_SUMMARY_CASES.flatMap((toolCase) =>
      (["2025-06-18", "2025-11-25"] as const).map((protocolVersion) => ({
        ...toolCase,
        protocolVersion,
      })),
    ),
  )(
    "executes a safe V2 production tools/call summary for $toolName under protocol $protocolVersion",
    async (toolCase) => {
      const ctx = makeCtx();
      ctx.accessTokenRows.push(storedAccessToken());
      const activation = activationDependencies();
      const executionResults: McpProductionReadonlySummaryExecutionResultV1[] = [];
      const dependencies = {
        ...routeDependencies(ctx),
        executeReadonlySummaryTool: vi.fn(async (input) => {
          const result = fakeReadonlySummaryExecutionResult(input);
          executionResults.push(result);
          return result;
        }),
      } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
      const response = await handleMcpOAuthProductionRouteRequest(
        mcpRequest(
          `Bearer ${RAW_ACCESS_TOKEN}`,
          mcpJsonRpcRequest("tools/call", "tools-call-preserved", {
            name: toolCase.toolName,
            arguments: { [toolCase.argumentKey]: { id: toolCase.safeRefId } },
            _meta: { progressToken: "progress-token-secret" },
          }),
          { "mcp-protocol-version": toolCase.protocolVersion },
        ),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation),
        dependencies,
      );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-call-preserved",
      },
    });
    expect(executionResults).toHaveLength(1);
    const executionResult = executionResults[0];
    if (!executionResult) throw new Error("expected one read-only summary execution result");
    const expectedMcpResult = buildMcpProductionReadonlySummaryMcpResultV2({
      toolName: toolCase.toolName,
      executionResult,
      nowEpochMs: NOW,
      forbiddenSubstrings: [OWNER_ID],
      version: 2,
    });
    const result = (
      response.json as {
        result: {
          content: readonly unknown[];
          structuredContent: Record<string, unknown>;
        };
      }
    ).result;
    expect(result).toEqual(expectedMcpResult);
    expect(Object.keys(result).sort()).toEqual(["content", "structuredContent"]);
    expect(result.structuredContent).toMatchObject({
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status: "OK",
      toolName: toolCase.toolName,
      version: 2,
    });
    const bodyText = JSON.stringify(response);
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool.mock.calls[0]?.[0]).toEqual({
      toolName: toolCase.toolName,
      twoweeksClerkId: OWNER_ID,
      ref: { id: toolCase.safeRefId },
      version: 1,
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.consumeAuthorizationIntent).not.toHaveBeenCalled();
    expect(dependencies.createAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.validateAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expect(bodyText).not.toContain(RAW_ACCESS_TOKEN);
    expect(bodyText).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(bodyText).not.toContain(OWNER_ID);
    expect(bodyText).not.toContain(toolCase.rawRefId);
    expect(bodyText).not.toContain(toolCase.expectedKind);
    expect(bodyText).not.toContain(toolCase.safeRefId);
    expect(bodyText).not.toContain(toolCase.dataReads);
    expect(bodyText).not.toContain(new Date(NOW).toISOString());
    expect(bodyText).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
    expect(bodyText).not.toContain('"summary"');
    expect(bodyText).not.toContain("capabilities");
    expect(bodyText).not.toContain("safeCounts");
    expect(bodyText).not.toContain("safeCategories");
    expect(bodyText).not.toContain("modelVisible");
    expect(bodyText).not.toContain("progress-token-secret");
    expect(bodyText).not.toContain("rawArgumentsEchoed");
    expect(bodyText).not.toContain("progressTokenEchoed");
    expect(bodyText).not.toContain("effects");
    expect(bodyText).not.toContain("publicOutput");
    expect(bodyText).not.toContain("mcpOAuthAccessTokens_fixture");
    expect(bodyText).not.toContain("mcpOAuthAuthorizationCodes_fixture");
    expect(bodyText).not.toContain("mcpOAuthAuthorizationIntents_fixture");
    expect(bodyText).not.toContain("mcpOAuthPreAuthIntents_fixture");
    expect(bodyText).not.toContain("localToolId");
    expect(bodyText).not.toContain("internalToolId");
    expect(bodyText).not.toContain('"handler":');
    expect(bodyText).not.toContain("function");
    expect(bodyText).not.toContain("https://");
    expect(bodyText).not.toContain("stytch");
    expect(bodyText).not.toContain("access_token");
    expect(bodyText).not.toContain("refresh_token");
    expect(bodyText).not.toContain("authorizationCodeDigest");
    expect(bodyText).not.toContain("stack");
    },
  );

  it.each([
    {
      expectedStatus: "STALE",
      internalStatus: "available",
      protocolVersion: "2025-06-18",
      toolCase: READONLY_SUMMARY_CASES[1],
      updatedAtEpochMs: NOW - 60 * 24 * 60 * 60 * 1_000,
    },
    {
      expectedStatus: "NO_DATA",
      internalStatus: "no_data_available",
      protocolVersion: "2025-11-25",
      toolCase: READONLY_SUMMARY_CASES[2],
      updatedAtEpochMs: NOW,
    },
    {
      expectedStatus: "ONBOARDING_REQUIRED",
      internalStatus: "onboarding_required",
      protocolVersion: "2025-06-18",
      toolCase: READONLY_SUMMARY_CASES[3],
      updatedAtEpochMs: NOW,
    },
  ] as const)(
    "projects a valid summary call to V2 $expectedStatus without retrying the reader",
    async ({ expectedStatus, internalStatus, protocolVersion, toolCase, updatedAtEpochMs }) => {
      const ctx = makeCtx();
      ctx.accessTokenRows.push(storedAccessToken());
      const executionResults: McpProductionReadonlySummaryExecutionResultV1[] = [];
      const dependencies = {
        ...routeDependencies(ctx),
        executeReadonlySummaryTool: vi.fn(async (input) => {
          const result = fakeReadonlySummaryExecutionResult(input, updatedAtEpochMs, internalStatus);
          executionResults.push(result);
          return result;
        }),
      } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
      const response = await handleMcpOAuthProductionRouteRequest(
        mcpRequest(
          `Bearer ${RAW_ACCESS_TOKEN}`,
          mcpJsonRpcRequest("tools/call", `tools-call-${expectedStatus.toLowerCase()}`, {
            name: toolCase.toolName,
            arguments: { [toolCase.argumentKey]: { id: toolCase.safeRefId } },
          }),
          { "mcp-protocol-version": protocolVersion },
        ),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activationDependencies()),
        dependencies,
      );

      expect(executionResults).toHaveLength(1);
      const executionResult = executionResults[0];
      if (!executionResult) throw new Error("expected one read-only summary execution result");
      const expectedMcpResult = buildMcpProductionReadonlySummaryMcpResultV2({
        toolName: toolCase.toolName,
        executionResult,
        nowEpochMs: NOW,
        forbiddenSubstrings: [OWNER_ID],
        version: 2,
      });
      const result = (
        response.json as {
          result: {
            content: readonly unknown[];
            structuredContent: Record<string, unknown>;
          };
        }
      ).result;
      expect(result).toEqual(expectedMcpResult);
      expect(Object.keys(result).sort()).toEqual(["content", "structuredContent"]);
      expect(result.structuredContent).toMatchObject({
        kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
        status: expectedStatus,
        toolName: toolCase.toolName,
        version: 2,
      });
      expect(dependencies.executeReadonlySummaryTool).toHaveBeenCalledTimes(1);
      const bodyText = JSON.stringify(response);
      expect(bodyText).not.toContain("safeCounts");
      expect(bodyText).not.toContain("safeCategories");
      expect(bodyText).not.toContain("safeFlags");
      expect(bodyText).not.toContain("capabilities");
      expect(bodyText).not.toContain(toolCase.safeRefId);
      expect(bodyText).not.toContain(OWNER_ID);
      expect(bodyText).not.toContain('"summary"');
    },
  );

  it("executes safe search and fetch compatibility tools after bearer token", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);
    const searchResponse = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "compat-search", {
          name: "search",
          arguments: { query: "application package" },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      config,
      dependencies,
    );

    expect(searchResponse).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "compat-search",
        result: {
          structuredContent: {
            results: COMPATIBILITY_CATALOG_CASES.map(({ id, title, url }) => ({ id, title, url })),
          },
        },
      },
    });
    const searchResult = (
      searchResponse.json as {
        result: {
          content: readonly [{ type: string; text: string }];
          structuredContent: { results: readonly unknown[] };
        };
      }
    ).result;
    expect(Object.keys(searchResult).sort()).toEqual(["content", "structuredContent"]);
    expect(Object.keys(searchResult.structuredContent)).toEqual(["results"]);
    expect(searchResult.structuredContent.results).toEqual(
      COMPATIBILITY_CATALOG_CASES.map(({ id, title, url }) => ({ id, title, url })),
    );
    for (const result of searchResult.structuredContent.results as readonly Record<string, unknown>[]) {
      expect(Object.keys(result).sort()).toEqual(["id", "title", "url"]);
    }
    expect(searchResult.content).toHaveLength(1);
    expect(Object.keys(searchResult.content[0]).sort()).toEqual(["text", "type"]);
    expect(searchResult.content[0].type).toBe("text");
    expect(JSON.parse(searchResult.content[0].text)).toEqual(searchResult.structuredContent);
    const fetchResponses = [];
    for (const [index, catalogCase] of COMPATIBILITY_CATALOG_CASES.entries()) {
      const fetchResponse = await handleMcpOAuthProductionRouteRequest(
        mcpRequest(
          `Bearer ${RAW_ACCESS_TOKEN}`,
          mcpJsonRpcRequest("tools/call", `compat-fetch-${index}`, {
            name: "fetch",
            arguments: { id: catalogCase.id },
          }),
          { "mcp-protocol-version": "2025-11-25" },
        ),
        config,
        dependencies,
      );
      expect(fetchResponse).toMatchObject({
        handled: true,
        status: 200,
        json: { jsonrpc: "2.0", id: `compat-fetch-${index}` },
      });
      const fetchResult = (
        fetchResponse.json as {
          result: {
            content: readonly [{ type: string; text: string }];
            structuredContent: {
              id: string;
              title: string;
              text: string;
              url: string;
              metadata: { source: string; category: string };
            };
          };
        }
      ).result;
      expect(Object.keys(fetchResult).sort()).toEqual(["content", "structuredContent"]);
      expect(Object.keys(fetchResult.structuredContent).sort()).toEqual([
        "id",
        "metadata",
        "text",
        "title",
        "url",
      ]);
      expect(Object.keys(fetchResult.structuredContent.metadata).sort()).toEqual([
        "category",
        "source",
      ]);
      expect(fetchResult.structuredContent).toEqual({
        id: catalogCase.id,
        title: catalogCase.title,
        text: catalogCase.text,
        url: catalogCase.url,
        metadata: {
          source: "twoweeks_safe_summary_catalog",
          category: catalogCase.category,
        },
      });
      expect(fetchResult.content).toHaveLength(1);
      expect(Object.keys(fetchResult.content[0]).sort()).toEqual(["text", "type"]);
      expect(fetchResult.content[0].type).toBe("text");
      expect(JSON.parse(fetchResult.content[0].text)).toEqual(fetchResult.structuredContent);
      fetchResponses.push(fetchResponse);
    }
    const bodyText = JSON.stringify({ searchResponse, fetchResponses });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(5);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(5);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.consumeAuthorizationIntent).not.toHaveBeenCalled();
    expect(dependencies.createAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.validateAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expect(bodyText).not.toContain(RAW_ACCESS_TOKEN);
    expect(bodyText).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(bodyText).not.toContain(OWNER_ID);
    expect(bodyText).not.toContain("application package raw");
    expect(bodyText).not.toContain("provider");
    expect(bodyText).not.toContain("client_secret");
    expect(bodyText).not.toContain("refresh_token");
  });

  it("drops adversarial read-only summary executor sentinels from production tools/call output", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const toolCase = READONLY_SUMMARY_CASES[0];
    const executionResults: McpProductionReadonlySummaryExecutionResultV1[] = [];
    const dependencies = {
      ...routeDependencies(ctx),
      executeReadonlySummaryTool: vi.fn(async (input) => {
        const base = fakeReadonlySummaryExecutionResult(input);
        if (!base.ok) return base;
        const result = Object.freeze({
          ...base,
          structuredContent: Object.freeze({
            ...base.structuredContent,
            safeCategories: Object.freeze(
              Object.fromEntries(SENSITIVE_ROUTE_SENTINELS.map((sentinel, index) => [`sentinel${index}`, sentinel])),
            ),
          }),
        });
        executionResults.push(result);
        return result;
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "adversarial-summary-sentinels", {
          name: toolCase.toolName,
          arguments: { [toolCase.argumentKey]: { id: toolCase.safeRefId } },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activationDependencies()),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "adversarial-summary-sentinels",
        result: {
          content: [{ type: "text", text: "Read-only summary status: MALFORMED." }],
          structuredContent: {
            kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
            status: "MALFORMED",
            toolName: toolCase.toolName,
            nextActionCode: "contact_support",
            retryable: false,
            version: 2,
          },
        },
      },
    });
    expect(executionResults).toHaveLength(1);
    const executionResult = executionResults[0];
    if (!executionResult) throw new Error("expected one adversarial summary execution result");
    expect((response.json as { result: unknown }).result).toEqual(
      buildMcpProductionReadonlySummaryMcpResultV2({
        toolName: toolCase.toolName,
        executionResult,
        nowEpochMs: NOW,
        forbiddenSubstrings: [OWNER_ID],
        version: 2,
      }),
    );
    const bodyText = JSON.stringify(response);
    expect(dependencies.executeReadonlySummaryTool).toHaveBeenCalledTimes(1);
    expect(bodyText).not.toContain('"summary"');
    expect(bodyText).not.toContain("safeCategories");
    expect(bodyText).not.toContain("capabilities");
    expect(bodyText).not.toContain(toolCase.safeRefId);
    for (const sentinel of SENSITIVE_ROUTE_SENTINELS) {
      expect(bodyText).not.toContain(sentinel);
    }
  });

  it.each(READONLY_SUMMARY_CASES)(
    "fails stale or typo production summary refs for $toolName before executor dispatch",
    async (toolCase) => {
      const ctx = makeCtx();
      ctx.accessTokenRows.push(storedAccessToken());
      const dependencies = routeDependencies(ctx);
      const response = await handleMcpOAuthProductionRouteRequest(
        mcpRequest(
          `Bearer ${RAW_ACCESS_TOKEN}`,
          mcpJsonRpcRequest("tools/call", "stale-summary-ref", {
            name: toolCase.toolName,
            arguments: { [toolCase.argumentKey]: { id: toolCase.rawRefId } },
          }),
          { "mcp-protocol-version": "2025-11-25" },
        ),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );

      expect(response).toMatchObject({
        handled: true,
        status: 200,
        json: {
          jsonrpc: "2.0",
          id: "stale-summary-ref",
          error: {
            code: -32602,
            message: "Invalid tools/call arguments.",
            safeForModel: true,
          },
        },
      });
      expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
      expect(JSON.stringify(response)).not.toContain(toolCase.rawRefId);
      expect(JSON.stringify(response)).not.toContain(OWNER_ID);
      expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
      expect(JSON.stringify(response)).not.toContain(MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2);
    },
  );

  it("fails unknown production tools/call tools distinctly from unknown JSON-RPC methods", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "unknown-tool", {
          name: "twoweeks.missing.summarize",
          arguments: {},
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "unknown-tool",
        error: {
          code: -32602,
          message: "Unknown tools/call tool.",
          safeForModel: true,
        },
      },
    });
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("Method not found.");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2);
  });

  it("fails malformed production tools/call params closed without executing a boundary result", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "tools-call-invalid", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-should-not-echo" }, task: "do more" },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "tools-call-invalid",
        error: {
          code: -32602,
          message: "Invalid tools/call arguments.",
          safeForModel: true,
        },
      },
    });
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("raw-ref-should-not-echo");
    expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
    expect(JSON.stringify(response)).not.toContain(MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2);
  });

  it("fails a valid production tools/call safely when the read-only summary executor dependency is missing", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const { executeReadonlySummaryTool: _omitted, ...dependencies } = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "missing-readonly-executor", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: READONLY_SUMMARY_CASES[0].safeRefId } },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "missing-readonly-executor",
        result: {
          content: [{ type: "text", text: "Read-only summary status: DEPENDENCY_MISSING." }],
          structuredContent: {
            kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
            status: "DEPENDENCY_MISSING",
            toolName: "twoweeks.application_package.summarize",
            nextActionCode: "try_again_later",
            retryable: true,
            version: 2,
          },
        },
      },
    });
    expect((response.json as { result: unknown }).result).toEqual(
      buildMcpProductionReadonlySummaryMcpResultV2({
        toolName: "twoweeks.application_package.summarize",
        failure: "dependency_missing",
        nowEpochMs: NOW,
        version: 2,
      }),
    );
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-missing-executor");
    expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
  });

  it("fails read-only summary executor errors safely without reporting invalid client arguments", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = {
      ...routeDependencies(ctx),
      executeReadonlySummaryTool: vi.fn(async () => {
        throw new Error("storage unavailable for raw-ref-executor-throw");
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "readonly-executor-throw", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: READONLY_SUMMARY_CASES[0].safeRefId } },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "readonly-executor-throw",
        result: {
          content: [{ type: "text", text: "Read-only summary status: MALFORMED." }],
          structuredContent: {
            kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
            status: "MALFORMED",
            toolName: "twoweeks.application_package.summarize",
            nextActionCode: "contact_support",
            retryable: false,
            version: 2,
          },
        },
      },
    });
    expect((response.json as { result: unknown }).result).toEqual(
      buildMcpProductionReadonlySummaryMcpResultV2({
        toolName: "twoweeks.application_package.summarize",
        failure: "malformed",
        nowEpochMs: NOW,
        version: 2,
      }),
    );
    expect(dependencies.executeReadonlySummaryTool).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-executor-throw");
    expect(JSON.stringify(response)).not.toContain("storage unavailable");
    expect(JSON.stringify(response)).not.toContain("stack");
    expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
  });

  it("bounds stalled read-only summary execution before returning a production tools/call response", async () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = {
      ...routeDependencies(ctx),
      executeReadonlySummaryTool: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    try {
      const responsePromise = handleMcpOAuthProductionRouteRequest(
        mcpRequest(
          `Bearer ${RAW_ACCESS_TOKEN}`,
          mcpJsonRpcRequest("tools/call", "readonly-executor-timeout", {
            name: "twoweeks.application_package.summarize",
            arguments: { applicationPackageRef: { id: READONLY_SUMMARY_CASES[0].safeRefId } },
          }),
          { "mcp-protocol-version": "2025-11-25" },
        ),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );
      await vi.advanceTimersByTimeAsync(2_500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        handled: true,
        status: 200,
        json: {
          jsonrpc: "2.0",
          id: "readonly-executor-timeout",
          result: {
            content: [{ type: "text", text: "Read-only summary status: TIMEOUT." }],
            structuredContent: {
              kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
              status: "TIMEOUT",
              toolName: "twoweeks.application_package.summarize",
              nextActionCode: "retry_request",
              retryable: true,
              version: 2,
            },
          },
        },
      });
      expect((response.json as { result: unknown }).result).toEqual(
        buildMcpProductionReadonlySummaryMcpResultV2({
          toolName: "twoweeks.application_package.summarize",
          failure: "timeout",
          nowEpochMs: NOW,
          version: 2,
        }),
      );
      expect(dependencies.executeReadonlySummaryTool).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
      expect(JSON.stringify(response)).not.toContain("raw-ref-executor-timeout");
      expect(JSON.stringify(response)).not.toContain("readonly_summary_execution_timeout");
      expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
    } finally {
      vi.useRealTimers();
    }
  });

  it("denies non-allowlisted private beta identities before tools/call validation", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "beta-denied-before-tools-call", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-private-beta-denied" }, task: "do more" },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig(
        { runtime: "1", approved: "1", routeWiring: "1" },
        activationDependencies(),
        privateBetaConfig({ allowedSubjectDigests: [OTHER_OWNER_DIGEST] }),
      ),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "private_beta_gate_denied",
        route: "mcp",
        privateBetaGateCode: "private_beta_subject_not_allowed",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-private-beta-denied");
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(OTHER_OWNER_ID);
  });

  it("rejects private beta subject digest arrays with iterator-masked invalid slots", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const iteratorMaskedSubjectDigests = [OWNER_DIGEST, "not-a-digest"];
    Object.defineProperty(iteratorMaskedSubjectDigests, Symbol.iterator, {
      value: function* maskedIterator() {
        yield OWNER_DIGEST;
      },
    });
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "iterator-masked-digest"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig(
        { runtime: "1", approved: "1", routeWiring: "1" },
        activationDependencies(),
        privateBetaConfig({ allowedSubjectDigests: iteratorMaskedSubjectDigests }),
      ),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "private_beta_gate_denied",
        route: "mcp",
        privateBetaGateCode: "private_beta_malformed_config",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("rejects array-like private beta subject digest config at the route builder", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const arrayLikeSubjectDigests = {
      0: OWNER_DIGEST,
      length: 1,
    } as unknown as readonly string[];
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/list", "array-like-subject-digests"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig(
        { runtime: "1", approved: "1", routeWiring: "1" },
        activationDependencies(),
        privateBetaConfig({ allowedSubjectDigests: arrayLikeSubjectDigests }),
      ),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "private_beta_gate_denied",
        route: "mcp",
        privateBetaGateCode: "private_beta_malformed_config",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("does not let public-launch-shaped readiness config bypass private beta eligibility", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "public-launch-cannot-bypass-beta", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-public-launch-bypass" } },
        }),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig(
        { runtime: "1", approved: "1", routeWiring: "1" },
        activationDependencies(),
        privateBetaConfig({ allowedSubjectDigests: [OTHER_OWNER_DIGEST] }),
        launchReadinessConfig({ publicLaunchRequested: true }),
      ),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "private_beta_gate_denied",
        route: "mcp",
        privateBetaGateCode: "private_beta_subject_not_allowed",
      },
    });
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("public_launch");
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-public-launch-bypass");
    expect(JSON.stringify(response)).not.toContain(OTHER_OWNER_ID);
  });

  it("keeps unknown production /mcp methods method-not-found after bearer verification", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("twoweeks/provider.call", "unknown-1"),
        { "mcp-protocol-version": "2025-11-25" },
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "unknown-1",
        error: {
          code: -32601,
          message: "Method not found.",
          safeForModel: true,
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("keeps production MCP policy decision-only and tools/list projection separate", () => {
    const jsonRpcMessage = parseMcpJsonRpcProtocolMessage(JSON.stringify(mcpJsonRpcRequest("tools/list", "tools-list")));
    if (!jsonRpcMessage) throw new Error("fixture JSON-RPC should parse");
    const toolsCallMessage = parseMcpJsonRpcProtocolMessage(JSON.stringify(
      mcpJsonRpcRequest("tools/call", "tools-call-policy", {
        name: "twoweeks.application_package.summarize",
        arguments: { applicationPackageRef: { id: "policy-raw-ref" }, task: "do more" },
      }),
    ));
    if (!toolsCallMessage) throw new Error("fixture tools/call JSON-RPC should parse");
    const envelope = buildMcpAuthenticatedProtocolEnvelope({
      verifiedClientId: CLIENT_ID,
      verifiedResource: RESOURCE,
      verifiedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
      callerKey: "198.51.100.9",
      jsonRpcMessage,
      createdAt: NOW,
    });
    const toolsCallEnvelope = buildMcpAuthenticatedProtocolEnvelope({
      verifiedClientId: CLIENT_ID,
      verifiedResource: RESOURCE,
      verifiedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
      callerKey: "198.51.100.9",
      jsonRpcMessage: toolsCallMessage,
      createdAt: NOW,
    });
    const decision = evaluateMcpProductionPolicy(envelope);
    const toolsCallDecision = evaluateMcpProductionPolicy(toolsCallEnvelope);
    const projection = buildMcpProductionToolsListResult();

    expect(decision).toEqual({
      kind: "mcp_production_policy_decision",
      decision: "allow_metadata",
      method: "tools/list",
      reason: "metadata_listing_allowed",
      version: 1,
    });
    expect(Object.keys(decision).sort()).toEqual(["decision", "kind", "method", "reason", "version"]);
    expect(JSON.stringify(decision)).not.toContain("jsonrpc");
    expect(JSON.stringify(decision)).not.toContain("result");
    expect(decision).not.toHaveProperty("tools");
    expect(decision).not.toHaveProperty("response");
    expect(decision).not.toHaveProperty("payload");
    expect(toolsCallDecision).toEqual({
      kind: "mcp_production_policy_decision",
      decision: "allow_read_only_call",
      method: "tools/call",
      reason: "read_only_call_boundary_allowed",
      version: 1,
    });
    expect(Object.keys(toolsCallDecision).sort()).toEqual(["decision", "kind", "method", "reason", "version"]);
    expect(JSON.stringify(toolsCallDecision)).not.toContain("policy-raw-ref");
    expect(JSON.stringify(toolsCallDecision)).not.toContain("arguments");
    expect(JSON.stringify(toolsCallDecision)).not.toContain("inputSchema");
    expect(JSON.stringify(toolsCallDecision)).not.toContain("result");
    expect(toolsCallDecision).not.toHaveProperty("tools");
    expect(toolsCallDecision).not.toHaveProperty("response");
    expect(toolsCallDecision).not.toHaveProperty("payload");
    expect(projection.tools).toHaveLength(6);
    for (const tool of projection.tools) {
      expect(Object.keys(tool).sort()).toEqual([
        "_meta",
        "annotations",
        "description",
        "inputSchema",
        "name",
        "outputSchema",
        "securitySchemes",
        "title",
      ]);
      expect(tool.securitySchemes).toEqual([
        { type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] },
      ]);
      expect(tool).not.toHaveProperty("localToolId");
      expect(tool).not.toHaveProperty("internalToolId");
      const readonlySummaryCase = READONLY_SUMMARY_CASES.find(
        ({ toolName }) => toolName === tool.name,
      );
      if (readonlySummaryCase) {
        expect(tool.outputSchema).toEqual(
          buildMcpProductionReadonlySummaryOutputSchemaV2(readonlySummaryCase.toolName),
        );
      } else {
        expect(tool.outputSchema).toMatchObject({ type: "object" });
      }
    }
  });

  it("creates immutable authenticated protocol envelopes before policy evaluation", () => {
    const envelopeSource = readFileSync(AUTHENTICATED_ENVELOPE_SOURCE_FILE, "utf8");
    const parsedMessage = parseMcpJsonRpcProtocolMessage(JSON.stringify(
      mcpJsonRpcRequest("tools/list", "tools-list", { _meta: { progressToken: 1 } }),
    ));
    if (!parsedMessage) throw new Error("fixture JSON-RPC should parse");

    const envelope = buildMcpAuthenticatedProtocolEnvelope({
      verifiedClientId: CLIENT_ID,
      verifiedResource: RESOURCE,
      verifiedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
      callerKey: "198.51.100.9",
      jsonRpcMessage: parsedMessage,
      createdAt: NOW,
    });

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.verifiedScopes)).toBe(true);
    expect(Object.isFrozen(envelope.jsonRpc)).toBe(true);
    expect(Object.isFrozen((envelope.jsonRpc.params as { _meta: unknown })._meta)).toBe(true);
    expect(evaluateMcpProductionPolicy(envelope)).toMatchObject({
      decision: "allow_metadata",
      method: "tools/list",
    });
    expect(envelope).toMatchObject({
      authenticated: true,
      verifiedClientId: CLIENT_ID,
      verifiedResource: RESOURCE,
      accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
      modelVisible: false,
      safeForLogging: false,
    });
    expect(JSON.stringify(envelope)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(envelope)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(envelope)).not.toContain(OWNER_ID);
    expect(envelopeSource).toContain("Object.freeze");
  });

  it("rejects non-JSON params before building authenticated protocol envelopes", () => {
    expect(() => buildMcpAuthenticatedProtocolEnvelope({
      verifiedClientId: CLIENT_ID,
      verifiedResource: RESOURCE,
      verifiedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
      callerKey: "198.51.100.9",
      jsonRpcMessage: {
        jsonrpc: "2.0",
        id: "tools-list",
        method: "tools/list",
        params: { createdAt: new Date(NOW) },
      },
      createdAt: NOW,
    })).toThrow("MCP JSON-RPC params must be JSON-serializable plain values");
  });

  it.each([
    ["missing", {}],
    ["unsupported", { "mcp-protocol-version": "not-a-version" }],
  ] as const)(
    "rejects %s MCP-Protocol-Version for production /mcp messages after bearer verification",
    async (_label, extraHeaders) => {
      const ctx = makeCtx();
      ctx.accessTokenRows.push(storedAccessToken());
      const dependencies = routeDependencies(ctx);
      const response = await handleMcpOAuthProductionRouteRequest(
        mcpRequest(`Bearer ${RAW_ACCESS_TOKEN}`, mcpJsonRpcRequest("ping", "ping-1"), extraHeaders),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );

      expect(response).toMatchObject({
        handled: true,
        status: 400,
        json: {
          jsonrpc: "2.0",
          id: "ping-1",
          error: {
            code: -32600,
            message: "Unsupported MCP protocol version.",
            safeForModel: true,
          },
        },
      });
      expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
      expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
      expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
      expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    },
  );

  it("rejects invalid production /mcp Origin after bearer verification before JSON-RPC parsing", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(`Bearer ${RAW_ACCESS_TOKEN}`, "{not-json", { origin: "https://evil.example" }),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Invalid Origin header.",
          safeForModel: true,
        },
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain("Invalid JSON-RPC request.");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("fails malformed production /mcp JSON-RPC safely after bearer verification", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(`Bearer ${RAW_ACCESS_TOKEN}`, "{not-json"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      routeDependencies(ctx),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Invalid JSON-RPC request.",
          safeForModel: true,
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it.each([
    ["missing Authorization", mcpRequest(null, mcpJsonRpcRequest("tools/call", "missing-auth", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
    }))],
    ["malformed Authorization scheme", mcpRequest(`Basic ${RAW_ACCESS_TOKEN}`, mcpJsonRpcRequest("tools/call", "bad-scheme", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
    }))],
    ["missing bearer token", mcpRequest("Bearer", mcpJsonRpcRequest("tools/call", "missing-token", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
    }))],
    ["oversized bearer token", mcpRequest(`Bearer ${"T".repeat(200)}`, mcpJsonRpcRequest("tools/call", "oversized-token", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
    }))],
    ["ambiguous Authorization headers", mcpRequest([`Bearer ${RAW_ACCESS_TOKEN}`, `Bearer ${"R".repeat(43)}`], mcpJsonRpcRequest("tools/call", "ambiguous-auth", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
    }))],
  ] as const)("fails /mcp closed with %s before digest lookup", async (_label, input) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      input,
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "invalid_authorization_header",
        route: "mcp",
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        accountLinkCreated: false,
        hostedMcpStarted: false,
      },
    });
    expectMcpBearerChallenge(response);
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [], { allowBearerChallenge: true });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("fails missing /mcp Authorization before malformed JSON-RPC dispatch", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, "{not-json"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "invalid_authorization_header",
        route: "mcp",
      },
    });
    expectMcpBearerChallenge(response);
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("Invalid JSON-RPC request.");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("fails missing /mcp Authorization before tools/call boundary validation", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        null,
        mcpJsonRpcRequest("tools/call", "auth-before-tools-call", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-before-auth" }, task: "do more" },
        }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "invalid_authorization_header",
        route: "mcp",
      },
    });
    expectMcpBearerChallenge(response);
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-before-auth");
  });

  it("fails /mcp closed when a valid-shaped bearer token misses digest storage", async () => {
    const dependencies = routeDependencies(makeCtx());
    const rawUnknownToken = "R".repeat(43);
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(`Bearer ${rawUnknownToken}`),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "bearer_verification_failed",
        route: "mcp",
        hostedMcpStarted: false,
      },
    });
    expectMcpBearerChallenge(response);
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken.mock.calls[0]?.[0].accessTokenDigest).toBe(sha256Hex(rawUnknownToken));
    expect(JSON.stringify(response)).not.toContain(rawUnknownToken);
    expect(JSON.stringify(response)).not.toContain(sha256Hex(rawUnknownToken));
  });

  it.each([
    ["expired token", 401, (row: StoredAccessTokenRecord) => Object.assign(row, { expiresAt: NOW })],
    ["revoked token", 401, (row: StoredAccessTokenRecord) => Object.assign(row, { status: "revoked" as const })],
    ["wrong client binding", 401, (row: StoredAccessTokenRecord) => Object.assign(row, { clientId: "other_client" })],
    ["wrong resource binding", 401, (row: StoredAccessTokenRecord) => Object.assign(row, { resource: "https://mcp.twoweeks.example.test/other-resource" })],
    ["missing application scope", 403, (row: StoredAccessTokenRecord) => Object.assign(row, { scopes: ["openid"] })],
    ["unauthorized scope state", 403, (row: StoredAccessTokenRecord) => Object.assign(row, { scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "twoweeks:write"] })],
  ] as const)("fails /mcp bearer verification for %s", async (_label, status, mutateRow) => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);
    mutateRow(ctx.accessTokenRows[0]);

    const response = await handleMcpOAuthProductionRouteRequest(mcpRequest(), config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status,
      json: {
        status: "blocked",
        reason: "bearer_verification_failed",
        route: "mcp",
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        accountLinkCreated: false,
        hostedMcpStarted: false,
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    if (status === 401 || status === 403) {
      expectMcpBearerChallenge(response);
    }
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expectNoRouteLeakage(response, [], { allowBearerChallenge: true });
  });

  it("trusts storage-side access-token expiry verification when the app clock is ahead", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      now: vi.fn(() => NOW + 60 * 60 * 1_000),
      verifyAccessToken: vi.fn(async () => ({
        kind: "mcp_oauth_access_token_verify_result",
        ok: true,
        reason: "verified",
        serverOnly: {
          status: "active",
          twoweeksClerkId: OWNER_ID,
          ownerIssuer: CLERK_ISSUER,
          clientId: CLIENT_ID,
          resource: RESOURCE,
          scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
          expiresAt: NOW + 1,
          tokenActive: true,
          tokenExpired: false,
          tokenRevoked: false,
          rawAccessTokenPersisted: false,
          rawAccessTokenEchoed: false,
          digestEchoed: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "initialize",
        result: {
          protocolVersion: "2025-11-25",
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("applies /mcp bearer verification quota before Convex digest lookup", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "rate_limited",
        safeFailure: { code: "mcp_oauth_bearer_verification_quota_denied" },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const rawUnknownToken = "R".repeat(43);

    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(`Bearer ${rawUnknownToken}`),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
        hostedMcpStarted: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      authorizationPageOrigin: PROD_APP_ORIGIN,
      clientId: "mcp_bearer_verification",
      resource: RESOURCE,
      callerKey: "198.51.100.9",
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(dependencies.checkPreAuthQuota.mock.calls[0]?.[0])).not.toContain(rawUnknownToken);
    expect(JSON.stringify(dependencies.checkPreAuthQuota.mock.calls[0]?.[0])).not.toContain(sha256Hex(rawUnknownToken));
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(response.headers).not.toHaveProperty("WWW-Authenticate");
    expect(JSON.stringify(response)).not.toContain(rawUnknownToken);
    expect(JSON.stringify(response)).not.toContain(sha256Hex(rawUnknownToken));
  });

  it("applies /mcp bearer quota before tools/call boundary validation", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "rate_limited",
        safeFailure: { code: "mcp_oauth_bearer_verification_quota_denied" },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(
        `Bearer ${RAW_ACCESS_TOKEN}`,
        mcpJsonRpcRequest("tools/call", "quota-before-tools-call", {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "raw-ref-before-quota" }, task: "do more" },
        }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("Invalid tools/call");
    expect(JSON.stringify(response)).not.toContain("raw-ref-before-quota");
  });

  it("keys /mcp bearer verification quota from the socket address, not caller-supplied forwarding headers", async () => {
    const quotaCounts = new Map<string, number>();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async (input) => {
        const count = (quotaCounts.get(input.callerKey) ?? 0) + 1;
        quotaCounts.set(input.callerKey, count);
        if (count > 1) {
          return Object.freeze({
            kind: "mcp_oauth_pre_auth_quota_result",
            ok: false,
            reason: "rate_limited",
            safeFailure: { code: "pre_auth_quota_denied" },
            safeForLogging: true,
            version: 1,
          });
        }
        return Object.freeze({
          kind: "mcp_oauth_pre_auth_quota_result",
          ok: true,
          reason: "accepted",
          safeForLogging: true,
          version: 1,
        });
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const requestWithForwardingHeader = (forwardedFor: string) => ({
      ...mcpRequest(),
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "x-forwarded-for": forwardedFor,
        "cf-connecting-ip": "203.0.113.250",
        "x-real-ip": "203.0.113.251",
      },
      remoteAddress: "198.51.100.9",
    } satisfies McpOAuthProductionRouteAdapterRequestV1);

    const firstResponse = await handleMcpOAuthProductionRouteRequest(
      requestWithForwardingHeader("203.0.113.10"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );
    const secondResponse = await handleMcpOAuthProductionRouteRequest(
      requestWithForwardingHeader("203.0.113.11"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(firstResponse).toMatchObject({ handled: true, status: 401 });
    expect(secondResponse).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(2);
    expect(dependencies.checkPreAuthQuota.mock.calls.map((call) => call[0].callerKey)).toEqual([
      "198.51.100.9",
      "198.51.100.9",
    ]);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
  });

  it("ignores rotated X-Real-IP and CF-Connecting-IP values for /mcp bearer verification quota", async () => {
    const quotaCounts = new Map<string, number>();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async (input) => {
        const count = (quotaCounts.get(input.callerKey) ?? 0) + 1;
        quotaCounts.set(input.callerKey, count);
        if (count > 1) {
          return Object.freeze({
            kind: "mcp_oauth_pre_auth_quota_result",
            ok: false,
            reason: "rate_limited",
            safeFailure: { code: "pre_auth_quota_denied" },
            safeForLogging: true,
            version: 1,
          });
        }
        return Object.freeze({
          kind: "mcp_oauth_pre_auth_quota_result",
          ok: true,
          reason: "accepted",
          safeForLogging: true,
          version: 1,
        });
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const requestWithCallerHeaders = (realIp: string, cfConnectingIp: string) => ({
      ...mcpRequest(),
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": realIp,
        "cf-connecting-ip": cfConnectingIp,
      },
      remoteAddress: "198.51.100.9",
    } satisfies McpOAuthProductionRouteAdapterRequestV1);

    await handleMcpOAuthProductionRouteRequest(
      requestWithCallerHeaders("203.0.113.11", "203.0.113.12"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );
    const secondResponse = await handleMcpOAuthProductionRouteRequest(
      requestWithCallerHeaders("203.0.113.21", "203.0.113.22"),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(secondResponse).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(2);
    expect(dependencies.checkPreAuthQuota.mock.calls.map((call) => call[0].callerKey)).toEqual([
      "198.51.100.9",
      "198.51.100.9",
    ]);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes IPv4-mapped IPv6 socket addresses before /mcp bearer verification quota", async () => {
    const quotaCounts = new Map<string, number>();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async (input) => {
        const count = (quotaCounts.get(input.callerKey) ?? 0) + 1;
        quotaCounts.set(input.callerKey, count);
        return Object.freeze({
          kind: "mcp_oauth_pre_auth_quota_result",
          ok: count === 1,
          reason: count === 1 ? "accepted" : "rate_limited",
          ...(count === 1 ? {} : { safeFailure: { code: "pre_auth_quota_denied" } }),
          safeForLogging: true,
          version: 1,
        } as const);
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    await handleMcpOAuthProductionRouteRequest(
      { ...mcpRequest(), remoteAddress: "127.0.0.1" },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );
    const secondResponse = await handleMcpOAuthProductionRouteRequest(
      { ...mcpRequest(), remoteAddress: "::ffff:127.0.0.1" },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(secondResponse).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
      },
    });
    expect(dependencies.checkPreAuthQuota.mock.calls.map((call) => call[0].callerKey)).toEqual([
      "127.0.0.1",
      "127.0.0.1",
    ]);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes IPv6 casing before /mcp bearer verification quota", async () => {
    const quotaCounts = new Map<string, number>();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async (input) => {
        const count = (quotaCounts.get(input.callerKey) ?? 0) + 1;
        quotaCounts.set(input.callerKey, count);
        return Object.freeze({
          kind: "mcp_oauth_pre_auth_quota_result",
          ok: count === 1,
          reason: count === 1 ? "accepted" : "rate_limited",
          ...(count === 1 ? {} : { safeFailure: { code: "pre_auth_quota_denied" } }),
          safeForLogging: true,
          version: 1,
        } as const);
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    await handleMcpOAuthProductionRouteRequest(
      { ...mcpRequest(), remoteAddress: "2001:DB8::1" },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );
    const secondResponse = await handleMcpOAuthProductionRouteRequest(
      { ...mcpRequest(), remoteAddress: "2001:db8::1" },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(secondResponse).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
      },
    });
    expect(dependencies.checkPreAuthQuota.mock.calls.map((call) => call[0].callerKey)).toEqual([
      "2001:db8::1",
      "2001:db8::1",
    ]);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", undefined],
    ["empty", "   "],
    ["literal unknown", "unknown"],
    ["malformed", "not-an-ip-address"],
    ["overlong", "1".repeat(129)],
    ["control-character-containing", "198.51.100.9\n"],
  ] as const)("fails /mcp bearer verification closed with %s remoteAddress before quota or digest lookup", async (_label, remoteAddress) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      { ...mcpRequest(), remoteAddress },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "bearer_verification_caller_untrusted",
        route: "mcp",
        hostedMcpStarted: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(response.headers).not.toHaveProperty("WWW-Authenticate");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain("unknown");
  });

  it("maps /mcp bearer verification quota dependency failure to retryable 503 before Convex lookup", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(async () => {
        throw new Error("quota unavailable");
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "bearer_verification_quota_denied",
        route: "mcp",
        hostedMcpStarted: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(response.headers).not.toHaveProperty("WWW-Authenticate");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("maps /mcp bearer verification storage unavailability to retryable 503", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      verifyAccessToken: vi.fn(async () => safeAccessTokenVerifyFailure("storage_unavailable")),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "bearer_verification_failed",
        route: "mcp",
        hostedMcpStarted: false,
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(response.headers).not.toHaveProperty("WWW-Authenticate");
    expectNoRouteLeakage(response);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("fails invalid bearer headers before private beta eligibility", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(null, mcpJsonRpcRequest("tools/call", "private-beta-before-auth", {
        name: "twoweeks.application_package.summarize",
        arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
      })),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
        activationDependencies: activationDependencies(),
      }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        reason: "invalid_authorization_header",
        route: "mcp",
      },
    });
    expect(JSON.stringify(response)).not.toContain("private_beta");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects malformed access-token verification success proofs without executing MCP", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      verifyAccessToken: vi.fn(async () => ({
        kind: "mcp_oauth_access_token_verify_result",
        ok: true,
        reason: "verified",
        serverOnly: {
          status: "active",
          twoweeksClerkId: OWNER_ID,
          ownerIssuer: CLERK_ISSUER,
          clientId: CLIENT_ID,
          resource: RESOURCE,
          scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
          expiresAt: NOW + 60 * 60 * 1_000,
          tokenActive: true,
          tokenExpired: false,
          tokenRevoked: false,
          rawAccessTokenPersisted: false,
          rawAccessTokenEchoed: true,
          digestEchoed: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      mcpRequest(),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "bearer_verification_failed",
        route: "mcp",
        hostedMcpStarted: false,
        tokenIssued: false,
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("accepts form-encoded percent characters in decoded token parameters", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    const percentRedirectUri = `${REDIRECT_URI}%`;
    Object.assign(ctx.authorizationCodeRows[0], { redirectUri: percentRedirectUri });

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ redirect_uri: percentRedirectUri })),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        access_token: RAW_ACCESS_TOKEN,
        token_type: "Bearer",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalled();
    expect(dependencies.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: percentRedirectUri }),
    );
    expectNoRouteLeakage(response, [], { allowAccessTokenResponse: true });
  });

  it("fails closed when the confidential-client policy is absent", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: undefined,
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: PROVIDER_CONFIG,
      activationDependencies: activationDependencies(),
    });

    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET]);
  });

  it("issues an access token when configured client_secret_post matches the allowlisted client digest", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_secret: RAW_CONFIDENTIAL_CLIENT_SECRET })),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        access_token: RAW_ACCESS_TOKEN,
        token_type: "Bearer",
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(2);
    expect(dependencies.issueAccessToken).toHaveBeenCalledTimes(1);
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET], { allowAccessTokenResponse: true });
  });

  it("rejects client_secret_basic even when its credentials match the allowlisted client", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_id: "" }), {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicClientAuthorizationHeader(CLIENT_ID, RAW_CONFIDENTIAL_CLIENT_SECRET),
      }),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET]);
  });

  it("fails closed before quota or token issuance when configured client_secret_post is missing", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_secret: "" })),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET]);
  });

  it("fails closed before quota or token issuance when unconfigured client_secret_basic is sent", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: undefined,
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_id: "", client_secret: "" }), {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicClientAuthorizationHeader(CLIENT_ID, RAW_CONFIDENTIAL_CLIENT_SECRET),
      }),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET]);
  });

  it("fails closed before quota or token issuance when configured client_secret_post is wrong", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    const wrongSecret = "confidential_client_wrong_secret_fixture";

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_secret: wrongSecret })),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET, wrongSecret]);
  });

  it("fails closed before quota or token issuance when configured client_secret_basic is wrong", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    const wrongSecret = "confidential_client_wrong_secret_fixture";

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_id: "" }), {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicClientAuthorizationHeader(CLIENT_ID, wrongSecret),
      }),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET, wrongSecret]);
  });

  it("fails closed before quota or token issuance when client_secret_post and client_secret_basic are both sent", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      clientSecretPost: clientSecretPostPolicy(),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(tokenRequestBody({ client_secret: RAW_CONFIDENTIAL_CLIENT_SECRET }), {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicClientAuthorizationHeader(CLIENT_ID, RAW_CONFIDENTIAL_CLIENT_SECRET),
      }),
      config,
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [RAW_CONFIDENTIAL_CLIENT_SECRET]);
  });

  it("consumes a valid authorization code once and rejects token replay", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const first = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);
    const second = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expect(first).toMatchObject({ handled: true, status: 200 });
    expectOAuthTokenErrorResponse(second, 400, "invalid_grant");
    expect(dependencies.issueAccessToken).toHaveBeenCalledTimes(2);
    expect(ctx.authorizationCodeRows[0]).toMatchObject({ status: "consumed", consumedAt: NOW });
    expect(ctx.accessTokenRows).toHaveLength(1);
    expectNoRouteLeakage(first, [], { allowAccessTokenResponse: true });
    expectNoRouteLeakage(second);
  });

  it("rejects malformed access-token expiry proof without returning token material", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    dependencies.issueAccessToken.mockResolvedValueOnce(accessTokenIssueSuccess({
      issuedAt: NOW - 60 * 60 * 1_000,
      expiresAt: NOW + 60 * 60 * 1_000,
      expiresIn: 7_200,
    }));
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 503, "invalid_grant");
    expect(ctx.accessTokenRows).toHaveLength(0);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain("access_token");
    expect(JSON.stringify(response)).not.toContain("refresh_token");
  });

  it("rejects access-token issue success without the submitted PKCE proof", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    dependencies.issueAccessToken.mockResolvedValueOnce(accessTokenIssueSuccess({
      codeChallenge: pkceChallenge("W".repeat(43)),
    }));
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 503, "invalid_grant");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain("access_token");
  });

  it("rejects access-token issue success with unauthorized scopes", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    dependencies.issueAccessToken.mockResolvedValueOnce(accessTokenIssueSuccess({
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "admin"],
    }));
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 503, "invalid_grant");
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain("access_token");
    expect(JSON.stringify(response)).not.toContain("admin");
  });

  it("allows exactly one concurrent token redemption success for the same authorization code", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const responses = await Promise.all([
      handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies),
      handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 400)).toHaveLength(1);
    expect(ctx.authorizationCodeRows[0]).toMatchObject({ status: "consumed", consumedAt: NOW });
    expect(ctx.accessTokenRows).toHaveLength(1);
    for (const response of responses) {
      expectNoRouteLeakage(response, [], { allowAccessTokenResponse: response.status === 200 });
    }
  });

  it("does not consume an authorization code when access-token generation fails", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      generateAccessToken: vi.fn(() => "not_a_valid_access_token"),
    };
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 500, "invalid_request");
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expect(ctx.authorizationCodeRows[0]).toMatchObject({ status: "pending" });
    expect(ctx.authorizationCodeRows[0]).not.toHaveProperty("consumedAt");
    expect(ctx.accessTokenRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("checks token request quota before access-token issuance", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    dependencies.checkPreAuthQuota.mockResolvedValueOnce({
      kind: "mcp_oauth_pre_auth_quota_result",
      ok: false,
      reason: "rate_limited",
      safeFailure: { code: "token_quota_denied" },
      safeForLogging: true,
      version: 1,
    });

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 429, "invalid_request");
    expect(dependencies.checkPreAuthQuota).toHaveBeenLastCalledWith({
      authorizationPageOrigin: PROD_APP_ORIGIN,
      clientId: CLIENT_ID,
      resource: RESOURCE,
      callerKey: "unknown",
      now: NOW,
      version: 1,
    });
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expect(ctx.authorizationCodeRows[0]).toMatchObject({ status: "pending" });
  });

  it("fails production token requests with the wrong method before issuance", async () => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...tokenRequest(),
        method: "GET",
        bodyText: undefined,
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 405,
      headers: { allow: "POST" },
    });
    expect(response.json).toEqual({ error: "invalid_request" });
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it.each([
    ["missing body", { ...tokenRequest(), bodyText: undefined }, "invalid_request", 400],
    [
      "unsupported content type",
      tokenRequest(tokenRequestBody(), { host: "mcp.twoweeks.example.test", "content-type": "application/json" }),
      "unsupported_token_content_type",
      415,
    ],
    ["malformed body", tokenRequest("grant_type=authorization_code&code=%"), "invalid_request", 400],
    ["wrong grant type", tokenRequest(tokenRequestBody({ grant_type: "refresh_token" })), "invalid_request", 400],
    ["missing code", tokenRequest(tokenRequestBody({ code: "" })), "invalid_request", 400],
    ["unallowed client_id", tokenRequest(tokenRequestBody({ client_id: "rotated_client_id" })), "invalid_request", 400],
  ] as const)("fails production token request with %s", async (_label, tokenInput, _reason, status) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      tokenInput,
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, status, "invalid_request");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it.each([
    ["missing resource", tokenRequestBody({ resource: "" })],
    ["malformed resource", tokenRequestBody({ resource: "not-a-url" })],
    ["non-HTTPS resource", tokenRequestBody({ resource: "http://mcp.twoweeks.example.test/resource" })],
    ["query resource", tokenRequestBody({ resource: `${RESOURCE}?unexpected=1` })],
    ["fragment resource", tokenRequestBody({ resource: `${RESOURCE}#fragment` })],
    ["mismatched resource", tokenRequestBody({ resource: "https://mcp.twoweeks.example.test/other-resource" })],
  ] as const)("fails production token request with %s before code lookup", async (_label, bodyText) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(bodyText),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_target");
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it.each([
    ["expired code", (row: StoredAuthorizationCodeRecord) => Object.assign(row, { expiresAt: NOW })],
    ["already consumed code", (row: StoredAuthorizationCodeRecord) => Object.assign(row, { status: "consumed" as const, consumedAt: NOW })],
    ["wrong client_id", (row: StoredAuthorizationCodeRecord) => Object.assign(row, { clientId: "other_client" })],
    [
      "wrong redirect_uri",
      (row: StoredAuthorizationCodeRecord) =>
        Object.assign(row, { redirectUri: "https://chatgpt.example.test/connector/oauth/other-callback" }),
    ],
    ["PKCE mismatch", (row: StoredAuthorizationCodeRecord) => Object.assign(row, { codeChallenge: pkceChallenge("W".repeat(43)) })],
  ] as const)("fails production token issuance for %s", async (_label, mutateRow) => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    mutateRow(ctx.authorizationCodeRows[0]);

    const response = await handleMcpOAuthProductionRouteRequest(tokenRequest(), config, dependencies);

    expectOAuthTokenErrorResponse(response, 400, "invalid_grant");
    expect(dependencies.issueAccessToken).toHaveBeenCalledTimes(1);
    expect(ctx.authorizationCodeRows).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain(RAW_AUTHORIZATION_CODE);
    expect(JSON.stringify(response)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(response)).not.toContain(RAW_CODE_VERIFIER);
    expect(JSON.stringify(response)).not.toContain("access_token");
    expect(JSON.stringify(response)).not.toContain("refresh_token");
  });

  it.each([
    [
      "malformed percent redirect_uri",
      `grant_type=authorization_code&code=${RAW_AUTHORIZATION_CODE}&client_id=${CLIENT_ID}&redirect_uri=https://chatgpt.example.test/connector/oauth/%&resource=${encodeURIComponent(RESOURCE)}&code_verifier=${RAW_CODE_VERIFIER}`,
    ],
    [
      "control-character redirect_uri",
      `grant_type=authorization_code&code=${RAW_AUTHORIZATION_CODE}&client_id=${CLIENT_ID}&redirect_uri=https%3A%2F%2Fchatgpt.example.test%2Fconnector%2Foauth%2Fcallback%0A&resource=${encodeURIComponent(RESOURCE)}&code_verifier=${RAW_CODE_VERIFIER}`,
    ],
  ] as const)("fails production token request with %s before code lookup", async (_label, bodyText) => {
    const dependencies = routeDependencies(makeCtx());
    const response = await handleMcpOAuthProductionRouteRequest(
      tokenRequest(bodyText),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expectOAuthTokenErrorResponse(response, 400, "invalid_request");
    expect(dependencies.issueAccessToken).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("blocks copied production login-return handles without the browser-bound continuation cookie", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const copiedHandleRequest = {
      ...request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      headers: { host: "mcp.twoweeks.example.test" },
    };
    const response = await handleMcpOAuthProductionRouteRequest(copiedHandleRequest, config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "browser_bound_continuation_missing",
        route: "oauth_login_return",
        ownerBound: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("blocks production login-return continuations with a mismatched browser-bound cookie", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const mismatchedCookieRequest = {
      ...request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      headers: { host: "mcp.twoweeks.example.test", cookie: `tw_mcp_oauth_continue=${"c".repeat(64)}` },
    };
    const response = await handleMcpOAuthProductionRouteRequest(mismatchedCookieRequest, config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "browser_bound_continuation_missing",
        route: "oauth_login_return",
        ownerBound: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("fails production login-return continuation closed without authenticated owner identity", async () => {
    const ctx = makeCtx({ subject: null });
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("rejects invalid production login-return continuation handles before owner binding", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_CONTINUATION_PATH,
        "GET",
        `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=short`,
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "invalid_continuation_request",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("fails expired production login-return continuations without preparing owner-bound handoff", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    ctx.preAuthRows[0].expiresAt = NOW;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "expired", updatedAt: NOW });
    expectNoRouteLeakage(response);
  });

  it("makes production login-return continuation replay explicit and one-time", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const first = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    ctx.subject = OTHER_OWNER_ID;
    const replay = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(first).toMatchObject({
      handled: true,
      status: 302,
    });
    expect(new URL(first.headers.location).searchParams.get("code")).toBe(RAW_AUTHORIZATION_CODE);
    expect(replay).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(2);
    expect(dependencies.createAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(ctx.authorizationCodeRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "claimed", claimedAt: NOW });
    expectNoRouteLeakage(replay);
  });

  it("fails production login-return continuation closed when owner-binding dependencies are unavailable", async () => {
    const dependencies = {
      authorizationRequestConfig: authorizationRequestConfig(),
      handleCodec: deterministicCodec,
      now: vi.fn(() => NOW),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "dependency_unavailable",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it.each([
    [
      "client mismatch",
      (handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1): McpOAuthAuthorizationRequestBoundaryHandoffV1 => ({
        ...handoff,
        providerForwardRequest: {
          ...handoff.providerForwardRequest,
          clientId: "unexpected_client",
        },
      }),
    ],
    [
      "redirect URI mismatch",
      (handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1): McpOAuthAuthorizationRequestBoundaryHandoffV1 => ({
        ...handoff,
        providerForwardRequest: {
          ...handoff.providerForwardRequest,
          redirectUri: "https://chatgpt.example.test/connector/oauth/other-callback",
        },
      }),
    ],
  ] as const)("fails closed on owner-bound continuation %s before issuing a code", async (_label, mutateHandoff) => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      consumeAuthorizationIntent: vi.fn(async () => ({
        kind: "mcp_oauth_authorization_intent_consume_result",
        ok: true,
        reason: "consumed",
        serverOnly: {
          authorizationRequestHandoff: mutateHandoff(authorizationHandoff()),
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "authorization_intent_consume_failed",
        route: "oauth_login_return",
        authorizationCodeIssued: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createAuthorizationCode).not.toHaveBeenCalled();
    expect(ctx.authorizationCodeRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("rejects a configured path-prefix wildcard before creating a pre-auth intent", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: authorizationRequestConfig({
        allowedRedirectUris: ["https://chatgpt.example.test/connector/oauth/*"],
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.createAuthorizationCode).not.toHaveBeenCalled();
    expect(ctx.authorizationCodeRows).toHaveLength(0);
  });

  it("fails closed when authorization-code storage is unavailable after owner binding", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      createAuthorizationCode: vi.fn(async () => ({
        kind: "mcp_oauth_authorization_code_create_result",
        ok: false,
        reason: "storage_unavailable",
        safeFailure: { code: "mcp_oauth_authorization_code_denied" },
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "authorization_code_create_failed",
        route: "oauth_login_return",
        authorizationCodeIssued: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.authorizationRows[0]).toMatchObject({ status: "consumed" });
    expect(ctx.authorizationCodeRows).toHaveLength(0);
    expect(JSON.stringify(response)).not.toContain(RAW_AUTHORIZATION_CODE);
    expect(JSON.stringify(response)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain("access_token");
    expect(JSON.stringify(response)).not.toContain("refresh_token");
  });

  it("matches the production authorization guard against the trimmed provider resource", async () => {
    const dependencies = routeDependencies(makeCtx());
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: {
        ...PROVIDER_CONFIG,
        resource: ` ${RESOURCE} `,
      },
      activationDependencies: activationDependencies(),
    });

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
  });

  it("scopes pre-auth quota checks to the forwarded caller when present", async () => {
    const dependencies = routeDependencies(makeCtx());

    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: {
          host: "mcp.twoweeks.example.test",
          "x-forwarded-for": " 203.0.113.9, 198.51.100.1 ",
        },
        remoteAddress: "198.51.100.9",
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      callerKey: "203.0.113.9",
    });
  });

  it("refreshes the pre-auth create deadline after quota succeeds", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      now: vi.fn()
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW + 1_000)
        .mockReturnValueOnce(NOW + 1_000),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({ now: NOW });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
      now: NOW + 1_000,
      deadlineEpochMs: NOW + 1_000 + 2_500,
      timeoutMs: 2_500,
    });
  });

  it("rejects storage success unless it proves the created intent is still ownerless and non-executing", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: NOW + 60_000,
          containsOwnerIdentity: true,
          containsProviderSubject: false,
          containsAccountLinkId: false,
          authorizationGranted: false,
          consentCompleted: false,
          authorizationCodeIssued: false,
          tokenIssued: false,
          accountLinkCreated: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
        ownerBound: false,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects non-finite storage expiry before returning the sign-in redirect", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: Number.POSITIVE_INFINITY,
          containsOwnerIdentity: false,
          containsProviderSubject: false,
          containsAccountLinkId: false,
          authorizationGranted: false,
          consentCompleted: false,
          authorizationCodeIssued: false,
          tokenIssued: false,
          accountLinkCreated: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects storage success that expires before post-write validation", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      now: vi.fn()
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW + 2),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: NOW + 1,
          containsOwnerIdentity: false,
          containsProviderSubject: false,
          containsAccountLinkId: false,
          authorizationGranted: false,
          consentCompleted: false,
          authorizationCodeIssued: false,
          tokenIssued: false,
          accountLinkCreated: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.now).toHaveBeenCalledTimes(3);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expectNoRouteLeakage(response);
  });

  it("bounds stalled pre-auth storage before returning a production authorize response", async () => {
    vi.useFakeTimers();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    try {
      const responsePromise = handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );
      await vi.advanceTimersByTimeAsync(2_500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        handled: true,
        status: 503,
        json: {
          status: "blocked",
          reason: "pre_auth_create_failed",
          preAuthIntentCreated: false,
        },
      });
      expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
      expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
        deadlineEpochMs: NOW + 2_500,
        timeoutMs: 2_500,
      });
      expectNoRouteLeakage(response);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps production authorize guarded when the injected clock throws", async () => {
    const fallbackNow = NOW + 1_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(fallbackNow);
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      now: vi.fn(() => {
        throw new Error("clock unavailable");
      }),
    };

    try {
      const response = await handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );

      expect(response).toMatchObject({ handled: true, status: 303 });
      expect(dependencies.now).toHaveBeenCalledTimes(3);
      expect(ctx.preAuthRows).toHaveLength(1);
      expect(ctx.preAuthRows[0]).toMatchObject({
        status: "pre_auth_pending",
        preAuthHandleHash: HANDLE_HASH,
        createdAt: fallbackNow,
        updatedAt: fallbackNow,
      });
      expectNoRouteLeakage(response, [], { allowRawHandle: true });
    } finally {
      dateNow.mockRestore();
    }
  });

  it("keeps /oauth/callback guarded inert when production preflight is ready", async () => {
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH), config);

    expect(response).toMatchObject({
      handled: true,
      status: 501,
      json: {
        kind: "mcp_oauth_production_route_response",
        status: "guarded_inert",
        reason: "inert_handler_only",
        route: "oauth_callback",
        safeForModel: true,
        allowedByPreflight: true,
        preflightDecision: "ready_to_wire",
        guardedInertHandlerReached: true,
        oauthExecutionStarted: false,
        authorizationRequestAccepted: false,
        authorizationCodeAccepted: false,
        authorizationCodeIssued: false,
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        accountLinkCreated: false,
        tokenPersisted: false,
        refreshTokenPersisted: false,
        hostedMcpStarted: false,
        handlerMode: "inert_guarded_only",
      },
    });
    expectNoRouteLeakage(response);

    const unsupported = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_MCP_PATH, "GET"),
      config,
    );
    expect(unsupported).toMatchObject({
      handled: true,
      status: 405,
      headers: {
        allow: "POST",
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      json: {
        status: "blocked",
        reason: "unsupported_method",
        route: "mcp",
        allowedByPreflight: true,
        preflightDecision: "ready_to_wire",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(unsupported);
  });

  it("keeps blocked responses free of secrets, provider config values, owner identifiers, codes, and redirect secrets", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
        url: `${MCP_OAUTH_PRODUCTION_CALLBACK_PATH}?code=auth_code_should_not_echo&state=redirect_secret_should_not_echo&owner=owner_should_not_echo`,
      },
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          clientSecret: "client_secret_should_not_echo",
          accessToken: "access_token_should_not_echo",
          refreshToken: "refresh_token_should_not_echo",
        } as never,
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_endpoint_exposure_not_enabled",
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
        tokenPersisted: false,
      },
    });
    expectNoRouteLeakage(response, [
      "auth_code_should_not_echo",
      "redirect_secret_should_not_echo",
      "owner_should_not_echo",
      "client_secret_should_not_echo",
      "access_token_should_not_echo",
      "refresh_token_should_not_echo",
    ]);
  });

  it("has no provider call, token exchange, account-link, refresh-token, or direct storage path", () => {
    const source = readFileSync(SOURCE_FILE, "utf8").replaceAll('"fetch"', '"mcp_fetch_tool_name"');

    expectSourceNotToMatch(source, FORBIDDEN_ROUTE_SOURCE_PATTERNS);
  });

  it("keeps the production read-only summary executor free of provider, write, OAuth issuance, and UI imports", () => {
    const source = readFileSync(READONLY_SUMMARY_EXECUTOR_SOURCE_FILE, "utf8");

    expect(source).toContain("McpProductionToolsCallBoundaryValidationV1");
    expect(source).not.toContain("buildMcpProductionToolsCallReadonlySyntheticResult");
    expectSourceNotToMatch(source, FORBIDDEN_READONLY_SUMMARY_EXECUTOR_SOURCE_PATTERNS);
  });

  it("wires default Vite production dependencies to the four Convex internal summary queries", () => {
    const source = readFileSync(VITE_CONFIG_SOURCE, "utf8");

    expect(source).toContain("executeReadonlySummaryTool: buildProductionReadonlySummaryExecutor(convexClient)");
    expect(source).toContain("mcpApplicationPackageSummary:internalSummarizeMcpApplicationPackage");
    expect(source).toContain("mcpEvidenceGraphSummary:internalSummarizeMcpEvidenceGraph");
    expect(source).toContain("mcpResumeVariantPlanSummary:internalSummarizeMcpResumeVariantPlan");
    expect(source).toContain("mcpReviewCockpitSummary:internalSummarizeMcpReviewCockpit");
    expect(source).toContain("publicCatalogSubmissionUrlReviewed: isStrictEnabledFlag");
    expect(source).toContain("MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_CATALOG_SUBMISSION_URL_REVIEWED_FLAG");
    expect(source).toContain("toolsCallSyntheticMetadataCleanupReviewed: isStrictEnabledFlag");
    expect(source).toContain(
      "MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG",
    );
  });

  it("leaves local/dev MCP OAuth route behavior unchanged", async () => {
    const disabledLocalDev = await handleMcpOAuthLocalDevRouteRequest(
      {
        method: "GET",
        path: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        url: `${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}?state=local_state`,
        headers: { host: "localhost:5173" },
      },
      buildMcpOAuthLocalDevRouteAdapterConfig(),
      {},
    );
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");

    expect(disabledLocalDev).toMatchObject({ handled: false, status: 404 });
    expect(createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() })).toBeTruthy();
    expect(
      createLocalMcpDevEndpointPlugin({
        env: {
          [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
          [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
          [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
          LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
          LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
        },
      }),
    ).toBeTruthy();
    expect(viteSource).toContain("handleMcpOAuthProductionRouteRequest");
    expect(viteSource).toContain("isMcpOAuthProductionRouteHandledPath");
  });

  it("does not claim production authorize paths when only the local MCP endpoint is enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: { LOCAL_MCP_DEV_ENDPOINT: "1" },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
  });

  it("keeps local /mcp endpoint ahead of production route wiring when both flags are enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      headers: {
        host: "localhost:5173",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "init_local_mcp", method: "initialize" }),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      id: "init_local_mcp",
      result: {
        serverInfo: { name: "twoweeks-local-dev-fixture" },
      },
    });
    expect(response.body).not.toContain("inert_handler_only");
  });

  it("keeps production /oauth/authorize ahead of the local OAuth route when both flags are enabled", async () => {
    convexHttpClientMutation.mockImplementationOnce(async () => ({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: Date.now() + 10 * 60 * 1_000,
        containsOwnerIdentity: false,
        containsProviderSubject: false,
        containsAccountLinkId: false,
        authorizationGranted: false,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    }));
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
  });

  it("keeps production login-return continuation ahead of the local OAuth route when both flags are enabled", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);

    await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "mcp.twoweeks.example.test", cookie: BROWSER_NONCE_COOKIE },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(302);
    expect(new URL(response.headers.location).searchParams.get("code")).toBe(RAW_AUTHORIZATION_CODE);
    expect(new URL(response.headers.location).searchParams.get("state")).toBe(STATE);
    expect(response.body).not.toContain("mcp_oauth_local_dev_route_failure");
    expect(ctx.authorizationCodeRows).toHaveLength(1);
  });

  it("lets localhost login-return continuations fall through to the local OAuth route when production wiring is also enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "localhost:5173" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toMatchObject({
      kind: "mcp_oauth_local_dev_route_failure",
      reason: "dependency_unavailable",
    });
    expect(response.body).not.toContain("invalid_host");
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("wires production authorize requests into the live Vite middleware", async () => {
    const ctx = makeCtx();
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: routeDependencies(ctx),
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      location: `${PROD_APP_ORIGIN}/sign-in?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}&${MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER}=${BROWSER_NONCE}`,
    });
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
  });

  it("wires production authorize requests through real no-options Vite defaults", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    convexHttpClientMutation.mockImplementationOnce(async () => ({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: Date.now() + 10 * 60 * 1_000,
        containsOwnerIdentity: false,
        containsProviderSubject: false,
        containsAccountLinkId: false,
        authorizationGranted: false,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(ConvexHttpClientMock).toHaveBeenCalledWith("http://127.0.0.1:3210");
    expect(convexHttpClientSetAdminAuth).toHaveBeenCalledWith("convex_admin_key_fixture", undefined);
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation.mock.calls[0]?.[1]).toMatchObject({
      authorizationRequestProjection: {
        authorizationPage: {
          origin: PROD_APP_ORIGIN,
          path: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        },
      },
      version: 1,
    });
    expect(convexHttpClientMutation.mock.calls[0]?.[2]).toEqual({ skipQueue: true });
  });

  it("wires production login-return continuation through real no-options Vite defaults", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        sub: OWNER_ID,
        iss: CLERK_ISSUER,
        aud: "convex",
      },
    });
    convexHttpClientMutation
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_pre_auth_owner_binding_result",
        ok: true,
        reason: "bound",
        serverOnly: {
          ownerBoundIntent: {
            status: "pending",
            expiresAt: Date.now() + 10 * 60 * 1_000,
            version: 1,
          },
          preAuthIntent: {
            status: "claimed",
            version: 1,
          },
          trustedOwner: trustedOwner(),
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }))
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_authorization_intent_consume_result",
        ok: true,
        reason: "consumed",
        serverOnly: {
          authorizationRequestHandoff: authorizationHandoff(),
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }))
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_authorization_code_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pending",
          expiresAt: Date.now() + 5 * 60 * 1_000,
          rawAuthorizationCodePersisted: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${CLERK_JWT}`,
        cookie: BROWSER_NONCE_COOKIE,
      },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(302);
    expect(new URL(response.headers.location).searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(new URL(response.headers.location).searchParams.get("state")).toBe(STATE);
    expect(ConvexHttpClientMock).toHaveBeenCalledWith("http://127.0.0.1:3210");
    expect(createRemoteJWKSetMock).toHaveBeenCalledWith(new URL(`${CLERK_ISSUER}/.well-known/jwks.json`));
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      CLERK_JWT,
      "clerk_jwks_fixture",
      {
        issuer: CLERK_ISSUER,
        audience: "convex",
      },
    );
    expect(convexHttpClientSetAdminAuth).toHaveBeenNthCalledWith(1, "convex_admin_key_fixture", undefined);
    expect(convexHttpClientSetAdminAuth).toHaveBeenNthCalledWith(2, "convex_admin_key_fixture", {
      subject: OWNER_ID,
      issuer: CLERK_ISSUER,
    });
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(3);
    expect(convexHttpClientMutation.mock.calls[0]?.[1]).toEqual({
      preAuthHandleHash: HANDLE_HASH,
      now: expect.any(Number),
      version: 1,
    });
    expect(convexHttpClientMutation.mock.calls[0]?.[2]).toEqual({ skipQueue: true });
    expect(convexHttpClientMutation.mock.calls[1]?.[1]).toMatchObject({
      trustedOwner: trustedOwner(),
      intentHandleHash: HANDLE_HASH,
      version: 1,
    });
    expect(convexHttpClientMutation.mock.calls[2]?.[1]).toMatchObject({
      authorizationCodeDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      trustedOwner: trustedOwner(),
      productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
      version: 1,
    });
    expect(JSON.stringify(convexHttpClientMutation.mock.calls[2]?.[1])).not.toContain(
      new URL(response.headers.location).searchParams.get("code") ?? "",
    );
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(PKCE);
  });

  it("server-redirects browser document login-return continuations with a verified Clerk session cookie", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        sub: OWNER_ID,
        iss: CLERK_ISSUER,
      },
    });
    convexHttpClientMutation
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_pre_auth_owner_binding_result",
        ok: true,
        reason: "bound",
        serverOnly: {
          ownerBoundIntent: {
            status: "pending",
            expiresAt: Date.now() + 10 * 60 * 1_000,
            version: 1,
          },
          preAuthIntent: {
            status: "claimed",
            version: 1,
          },
          trustedOwner: trustedOwner(),
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }))
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_authorization_intent_consume_result",
        ok: true,
        reason: "consumed",
        serverOnly: {
          authorizationRequestHandoff: authorizationHandoff(),
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }))
      .mockImplementationOnce(async () => ({
        kind: "mcp_oauth_authorization_code_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pending",
          expiresAt: Date.now() + 5 * 60 * 1_000,
          rawAuthorizationCodePersisted: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: {
        host: "mcp.twoweeks.example.test",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        cookie: `${BROWSER_NONCE_COOKIE}; __session=${CLERK_JWT}`,
      },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(302);
    expect(new URL(response.headers.location).searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(new URL(response.headers.location).searchParams.get("state")).toBe(STATE);
    expect(jwtVerifyMock).toHaveBeenCalledWith(CLERK_JWT, "clerk_jwks_fixture", {
      issuer: CLERK_ISSUER,
    });
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(PKCE);
  });

  it("lets browser document login-return continuations with a stale Clerk session cookie fall through to the React bridge", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: {
        host: "mcp.twoweeks.example.test",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        cookie: `${BROWSER_NONCE_COOKIE}; __session=${CLERK_JWT}`,
      },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
    expect(jwtVerifyMock).toHaveBeenCalledWith(CLERK_JWT, "clerk_jwks_fixture", {
      issuer: CLERK_ISSUER,
    });
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("wires production token requests through real no-options Vite defaults with atomic token issuance", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    convexHttpClientMutation.mockImplementationOnce(async (_mutation, input) => ({
      kind: "mcp_oauth_access_token_issue_result",
      ok: true,
      reason: "issued",
      serverOnly: {
        tokenType: "Bearer",
        issuedAt: input.now,
        expiresAt: input.now + 60 * 60 * 1_000,
        expiresIn: 3_600,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        resource: RESOURCE,
        codeChallenge: PKCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
        productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
        codeConsumed: true,
        tokenIssued: true,
        tokenPersisted: true,
        rawAccessTokenPersisted: false,
        refreshTokenPersisted: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody(),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    const responseJson = JSON.parse(response.body);
    expect(responseJson).toMatchObject({
      access_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      token_type: "Bearer",
      scope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    });
    expect(responseJson.expires_in).toBeGreaterThan(0);
    expect(responseJson.expires_in).toBeLessThanOrEqual(3_600);
    expect(responseJson).not.toHaveProperty("refresh_token");
    expect(ConvexHttpClientMock).toHaveBeenCalledWith("http://127.0.0.1:3210");
    expect(convexHttpClientSetAdminAuth).toHaveBeenCalledWith("convex_admin_key_fixture", undefined);
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation.mock.calls[0]?.[1]).toEqual({
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      accessTokenDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      codeChallenge: PKCE,
      now: expect.any(Number),
      deadlineEpochMs: expect.any(Number),
      timeoutMs: 2_500,
      version: 1,
    });
    const mutationInput = convexHttpClientMutation.mock.calls[0]?.[1];
    expect(mutationInput.deadlineEpochMs).toBe(mutationInput.now + 2_500);
    expect(JSON.stringify(response)).not.toContain(RAW_AUTHORIZATION_CODE);
    expect(JSON.stringify(response)).not.toContain(AUTHORIZATION_CODE_DIGEST);
    expect(JSON.stringify(response)).not.toContain(convexHttpClientMutation.mock.calls[0]?.[1].accessTokenDigest);
    expect(JSON.stringify(response)).not.toContain(RAW_CODE_VERIFIER);
    expect(JSON.stringify(response)).not.toContain("refresh_token");
  });

  it("wires production /mcp bearer verification through Vite without execution", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push({
      kind: "mcp_oauth_access_token_record",
      version: 1,
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: CLERK_ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
      status: "active",
      issuedAt: NOW,
      updatedAt: NOW,
      expiresAt: NOW + 60 * 60 * 1_000,
      storageVersion: 1,
      _id: "mcpOAuthAccessTokens_fixture_vite",
      _creationTime: NOW,
    });
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(mcpInitializeRequest()),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "initialize",
      result: {
        protocolVersion: "2025-11-25",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(dependencies.verifyAccessToken.mock.calls[0]?.[0]).toEqual({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      allowedClientIds: [CLIENT_ID],
      resource: RESOURCE,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("wires production /mcp initialized notifications through Vite with an empty 202 body", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken({ _id: "mcpOAuthAccessTokens_fixture_vite_notification" }));
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe("");
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("wires complete production launch readiness evidence env through the default Vite /mcp config", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken({ _id: "mcpOAuthAccessTokens_fixture_vite_public_launch" }));
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_CATALOG_SUBMISSION_URL_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_PRIVATE_BETA_GATE_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_AUTHENTICATED_PROTOCOL_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_POLICY_KERNEL_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_LIST_METADATA_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_READ_ONLY_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG]: "0",
        [MCP_PRODUCTION_LAUNCH_READINESS_SCHEMA_MATCHER_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_EXECUTION_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_STATUS_REVIEWED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_PROVIDER_WRITE_EXPANSION_BLOCKED_FLAG]: "1",
        [MCP_PRODUCTION_LAUNCH_READINESS_UNRESOLVED_BLOCKING_FINDINGS_FLAG]: "0",
      },
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify(mcpJsonRpcRequest("tools/list", "vite-launch-readiness-complete")),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "vite-launch-readiness-complete",
      result: {
        tools: expect.any(Array),
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("wires production public launch readiness env through the default Vite /mcp config", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken({ _id: "mcpOAuthAccessTokens_fixture_vite_public_launch_blocked" }));
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_LAUNCH_REQUESTED_FLAG]: "1",
      },
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify(mcpJsonRpcRequest("tools/list", "vite-public-launch-blocked")),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "blocked",
      reason: "launch_readiness_blocked",
      route: "mcp",
      launchReadinessCode: "public_launch_blocked",
      launchReadinessPublicLaunchAllowed: false,
      launchReadinessPublicLaunchBlocked: true,
      launchReadinessPrivateBetaGateCode: "private_beta_allowed",
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(dependencies.executeReadonlySummaryTool).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("tools/list");
    expect(JSON.stringify(response)).not.toContain("twoweeks.application_package.summarize");
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("forwards MCP-Protocol-Version to reject unsupported production /mcp messages in Vite", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken({ _id: "mcpOAuthAccessTokens_fixture_vite_protocol" }));
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "not-a-version",
      },
      body: JSON.stringify(mcpJsonRpcRequest("ping", "ping-1")),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "ping-1",
      error: {
        code: -32600,
        message: "Unsupported MCP protocol version.",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("forwards Origin to reject invalid production /mcp browser origins in Vite", async () => {
    const ctx = makeCtx();
    ctx.accessTokenRows.push(storedAccessToken({ _id: "mcpOAuthAccessTokens_fixture_vite_origin" }));
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(mcpInitializeRequest()),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Invalid Origin header.",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("verifies production /mcp bearer tokens against the protected resource host when origins differ", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    const ctx = makeCtx();
    ctx.accessTokenRows.push({
      kind: "mcp_oauth_access_token_record",
      version: 1,
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: CLERK_ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
      status: "active",
      issuedAt: NOW,
      updatedAt: NOW,
      expiresAt: NOW + 60 * 60 * 1_000,
      storageVersion: 1,
      _id: "mcpOAuthAccessTokens_fixture_cross_origin",
      _creationTime: NOW,
    });
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: { ...PROVIDER_CONFIG, resource },
      activationDependencies: activationDependencies(),
      privateBeta: privateBetaConfig({ allowedResources: [resource] }),
    });
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: authorizationRequestConfig({
        authorizationPageOrigin: authorizationOrigin,
        canonicalResource: resource,
      }),
    };

    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_MCP_PATH),
        remoteAddress: "198.51.100.9",
        headers: {
          host: "resource.twoweeks.example.test",
          authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        },
        bodyText: JSON.stringify(mcpInitializeRequest()),
      },
      config,
      dependencies,
    );
    const wrongHostResponse = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_MCP_PATH),
        remoteAddress: "198.51.100.9",
        headers: {
          host: "auth.twoweeks.example.test",
          authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        },
      },
      config,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      jsonrpc: "2.0",
      id: "initialize",
      result: {
        protocolVersion: "2025-11-25",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
    });
    expect(wrongHostResponse).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "invalid_host",
        route: "mcp",
      },
    });
    expect(dependencies.verifyAccessToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(wrongHostResponse)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(wrongHostResponse)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("fails default production /mcp closed without the subject digest allowlist env", async () => {
    convexHttpClientQuery.mockResolvedValue({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        status: "active",
        twoweeksClerkId: OWNER_ID,
        ownerIssuer: CLERK_ISSUER,
        clientId: CLIENT_ID,
        resource: RESOURCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
        expiresAt: Date.now() + 60 * 60 * 1_000,
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
        rawAccessTokenPersisted: false,
        rawAccessTokenEchoed: false,
        digestEchoed: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    const plugin = createLocalMcpDevEndpointPlugin({ env: prodRouteEnvWithoutPrivateBetaSubjectDigests() });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(mcpInitializeRequest()),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "blocked",
      reason: "private_beta_gate_denied",
      privateBetaGateCode: "private_beta_empty_allowlist",
    });
    expect(convexHttpClientQuery).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(convexHttpClientQuery.mock.calls[0]?.[1]).toMatchObject({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      allowedClientIds: [CLIENT_ID],
      resource: RESOURCE,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      version: 1,
    });
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
  });

  it("fails default production /mcp closed for malformed subject digest CSV", async () => {
    convexHttpClientQuery.mockResolvedValue({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        status: "active",
        twoweeksClerkId: OWNER_ID,
        ownerIssuer: CLERK_ISSUER,
        clientId: CLIENT_ID,
        resource: RESOURCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
        expiresAt: Date.now() + 60 * 60 * 1_000,
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
        rawAccessTokenPersisted: false,
        rawAccessTokenEchoed: false,
        digestEchoed: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    const malformedValues = [
      `,${OWNER_DIGEST}`,
      `${OWNER_DIGEST},`,
      `${OWNER_DIGEST},,${OWNER_DIGEST}`,
      ` ${OWNER_DIGEST}`,
      `${OWNER_DIGEST} `,
    ];

    for (const malformedValue of malformedValues) {
      const env = prodRouteEnv();
      env.MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS = malformedValue;
      const plugin = createLocalMcpDevEndpointPlugin({ env });
      const middleware = readConfiguredMiddleware(plugin);
      const response = await invokeStreamingMiddleware(middleware, {
        method: "POST",
        url: MCP_OAUTH_PRODUCTION_MCP_PATH,
        remoteAddress: "198.51.100.9",
        headers: {
          host: "mcp.twoweeks.example.test",
          authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(mcpInitializeRequest()),
      });

      expect(response.next).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toMatchObject({
        status: "blocked",
        reason: "private_beta_gate_denied",
        privateBetaGateCode: "private_beta_malformed_config",
      });
      expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
      expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
      expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    }
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("wires default Vite production tools/call to the Convex read-only summary query", async () => {
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(NOW);
    const toolCase = READONLY_SUMMARY_CASES[0];
    convexHttpClientQuery.mockImplementation(async (_query, input) => {
      if (isPlainTestRecord(input) && input.accessTokenDigest === ACCESS_TOKEN_DIGEST) {
        return {
          kind: "mcp_oauth_access_token_verify_result",
          ok: true,
          reason: "verified",
          serverOnly: {
            status: "active",
            twoweeksClerkId: OWNER_ID,
            ownerIssuer: CLERK_ISSUER,
            clientId: CLIENT_ID,
            resource: RESOURCE,
            scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
            productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
            expiresAt: Date.now() + 60 * 60 * 1_000,
            tokenActive: true,
            tokenExpired: false,
            tokenRevoked: false,
            rawAccessTokenPersisted: false,
            rawAccessTokenEchoed: false,
            digestEchoed: false,
            version: 1,
          },
          modelVisible: false,
          safeForLogging: false,
          version: 1,
        };
      }
      if (isPlainTestRecord(input) && isPlainTestRecord(input.applicationPackageRef)) {
        const result = fakeReadonlySummaryExecutionResult(
          {
            toolName: toolCase.toolName,
            twoweeksClerkId: OWNER_ID,
            ref: { id: String(input.applicationPackageRef.id) },
            version: 1,
          },
          Date.now(),
        );
        if (!result.ok) throw new Error("expected fake read-only summary success");
        return result.structuredContent;
      }
      throw new Error("unexpected Convex query input");
    });
    const plugin = createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify(mcpJsonRpcRequest("tools/call", "vite-readonly-summary", {
        name: toolCase.toolName,
        arguments: { [toolCase.argumentKey]: { id: toolCase.safeRefId } },
      })),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const expectedExecutionResult = fakeReadonlySummaryExecutionResult(
      {
        toolName: toolCase.toolName,
        twoweeksClerkId: OWNER_ID,
        ref: { id: toolCase.safeRefId },
        version: 1,
      },
      NOW,
    );
    if (!expectedExecutionResult.ok) throw new Error("expected fake read-only summary success");
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: "vite-readonly-summary",
      result: buildMcpProductionReadonlySummaryMcpResultV2({
        toolName: toolCase.toolName,
        executionResult: expectedExecutionResult,
        nowEpochMs: NOW,
        version: 2,
      }),
    });
    expect(convexHttpClientQuery).toHaveBeenCalledTimes(2);
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(convexHttpClientQuery.mock.calls[0]?.[1]).toMatchObject({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      allowedClientIds: [CLIENT_ID],
      resource: RESOURCE,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      version: 1,
    });
    expect(convexHttpClientQuery.mock.calls[1]?.[1]).toEqual({
      twoweeksClerkId: OWNER_ID,
      applicationPackageRef: {
        id: toolCase.safeRefId,
        label: "Application package availability",
        status: "available",
        category: "application_package",
        count: 1,
        version: 1,
      },
    });
    expect(JSON.stringify(response)).not.toContain("raw-ref-vite-summary");
    expect(JSON.stringify(response)).not.toContain(OWNER_ID);
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(response)).not.toContain('"summary"');
    expect(JSON.stringify(response)).not.toContain(toolCase.expectedKind);
    expect(JSON.stringify(response)).not.toContain(toolCase.safeRefId);
    expect(JSON.stringify(response)).not.toContain(LEGACY_TOOLS_CALL_SYNTHETIC_RESULT_KIND);
    dateNow.mockRestore();
  });

  it("wires default production /mcp through the resource host when auth and resource origins differ", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    convexHttpClientQuery.mockResolvedValue({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        status: "active",
        twoweeksClerkId: OWNER_ID,
        ownerIssuer: CLERK_ISSUER,
        clientId: CLIENT_ID,
        resource,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
        expiresAt: Date.now() + 60 * 60 * 1_000,
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
        rawAccessTokenPersisted: false,
        rawAccessTokenEchoed: false,
        digestEchoed: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: authorizationOrigin,
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
        MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES: resource,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      remoteAddress: "198.51.100.9",
      headers: {
        host: "resource.twoweeks.example.test",
        authorization: `Bearer ${RAW_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(mcpInitializeRequest()),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "initialize",
      result: {
        protocolVersion: "2025-11-25",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
    });
    expect(convexHttpClientQuery).toHaveBeenCalledTimes(1);
    expect(convexHttpClientQuery.mock.calls[0]?.[1]).toMatchObject({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      resource,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      version: 1,
    });
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(response)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("serves production protected-resource metadata at the root and advertised resource URL", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: authorizationOrigin,
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const rootResponse = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
      headers: { host: "resource.twoweeks.example.test" },
    });
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-protected-resource/resource",
      headers: { host: "resource.twoweeks.example.test" },
    });

    expect(rootResponse.next).not.toHaveBeenCalled();
    expect(rootResponse.statusCode).toBe(200);
    expect(rootResponse.headers).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    expect(JSON.parse(rootResponse.body)).toEqual({
      resource,
      authorization_servers: [`${authorizationOrigin}/`],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });
    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    expect(JSON.parse(response.body)).toEqual({
      resource,
      authorization_servers: [`${authorizationOrigin}/`],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("serves production authorization-server metadata for the protected-resource issuer", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: authorizationOrigin,
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "auth.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    expect(JSON.parse(response.body)).toEqual({
      issuer: `${authorizationOrigin}/`,
      authorization_endpoint: `${authorizationOrigin}${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}`,
      token_endpoint: `${authorizationOrigin}${MCP_OAUTH_PRODUCTION_TOKEN_PATH}`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("serves production authorization-server metadata at the MCP-scoped discovery path", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: authorizationOrigin,
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
        MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES: resource,
        MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256: CONFIDENTIAL_CLIENT_SECRET_DIGEST,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server/mcp",
      headers: { host: "auth.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    expect(JSON.parse(response.body)).toMatchObject({
      issuer: `${authorizationOrigin}/`,
      authorization_endpoint: `${authorizationOrigin}${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}`,
      token_endpoint: `${authorizationOrigin}${MCP_OAUTH_PRODUCTION_TOKEN_PATH}`,
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });
    expect(response.body).not.toContain(RAW_CONFIDENTIAL_CLIENT_SECRET);
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("advertises only client_secret_post in production authorization-server metadata when the private-beta digest is configured", async () => {
    const authorizationOrigin = "https://auth.twoweeks.example.test";
    const resource = "https://resource.twoweeks.example.test/resource";
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: authorizationOrigin,
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
        MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES: resource,
        MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256: CONFIDENTIAL_CLIENT_SECRET_DIGEST,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "auth.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    });
    expect(response.body).not.toContain(RAW_CONFIDENTIAL_CLIENT_SECRET);
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("does not downgrade production metadata or token parsing when the client_secret_post digest is missing", async () => {
    const env = prodRouteEnv();
    delete env.MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256;
    const plugin = createLocalMcpDevEndpointPlugin({ env });
    const middleware = readConfiguredMiddleware(plugin);

    const metadataResponse = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const tokenResponse = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody(),
    });

    expect(metadataResponse.next).not.toHaveBeenCalled();
    expect(metadataResponse.statusCode).toBe(200);
    expect(JSON.parse(metadataResponse.body)).toMatchObject({
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    });
    expect(tokenResponse.next).not.toHaveBeenCalled();
    expect(tokenResponse.statusCode).toBe(400);
    expect(JSON.parse(tokenResponse.body)).toEqual({ error: "invalid_request" });
    expect(tokenResponse.body).not.toContain(RAW_CONFIDENTIAL_CLIENT_SECRET);
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("keeps the configured confidential-client implementation post-only", () => {
    const routeSource = readFileSync(SOURCE_FILE, "utf8");
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");

    expect(routeSource).toContain("clientSecretPostMatches");
    expect(routeSource).not.toContain("client_secret_basic");
    expect(routeSource).not.toContain("readTokenBasicClientAuthentication");
    expect(viteSource).toContain('["client_secret_post"]');
    expect(viteSource).not.toContain("client_secret_basic");
  });

  it("locks the reproducible private-beta runtime files to secret-safe locations", () => {
    const runSource = readFileSync(RUN_SCRIPT_SOURCE, "utf8");
    const dockerignore = readFileSync(DOCKERIGNORE_SOURCE, "utf8");
    const rootEnvExample = readFileSync(ROOT_ENV_EXAMPLE_SOURCE, "utf8");
    const appEnvExample = readFileSync(APP_ENV_EXAMPLE_SOURCE, "utf8");
    const infisicalProjectConfig = JSON.parse(readFileSync(INFISICAL_PROJECT_CONFIG_SOURCE, "utf8")) as {
      defaultEnvironment?: string;
      domain?: string;
      workspaceId?: string;
    };
    const canonicalKeys = [
      "MCP_OAUTH_PRODUCTION_CLIENT_IDS",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS",
      "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256",
    ] as const;

    expect(runSource).toContain("mcp-private-beta) mcp_private_beta_stack");
    expect(runSource).toContain("mcp-secret-sync) mcp_secret_sync");
    expect(runSource).toContain("mcp-check) mcp_check");
    expect(runSource).toContain("mcp_check_root_env_key");
    expect(runSource).toContain("mcp_derive_clerk_publishable_key");
    expect(runSource).toContain("mcp_resolve_clerk_publishable_key");
    expect(runSource).toContain("canonical_server_keys");
    expect(runSource).toContain("canonical server keys are allowed only in root .env.local");
    expect(runSource).toContain("cloudflared-mcp-credentials.json");
    expect(runSource).toContain('local service_host="host.docker.internal"');
    expect(runSource).toContain("service: http://${service_host}:${MCP_PRIVATE_BETA_VITE_PORT}");
    expect(runSource).toContain("--token-file /run/secrets/cloudflared-token");
    expect(runSource).not.toContain('--token "${TUNNEL_TOKEN}"');
    expect(dockerignore).toMatch(/^\*\*\/\.env\*$/mu);
    for (const key of canonicalKeys) {
      expect(rootEnvExample).toMatch(new RegExp(`^${key}=`, "mu"));
    }
    expect(rootEnvExample).toMatch(/^MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=$/mu);
    expect(rootEnvExample).toContain("MCP_OAUTH_PRODUCTION_CLIENT_SECRET");
    expect(rootEnvExample).not.toContain("MCP_PRODUCTION_PRIVATE_BETA_");
    expect(rootEnvExample).not.toContain("MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECTS=");
    expect(appEnvExample).toContain("server-only MCP_OAUTH_PRODUCTION_*");
    expect(infisicalProjectConfig.workspaceId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(infisicalProjectConfig.defaultEnvironment).toBe("dev");
    expect(infisicalProjectConfig.domain).toBe("https://eu.infisical.com");
  });

  it("syncs the Infisical MCP client secret to a digest without printing secret material", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "pr305-mcp-secret-sync-"));
    const fixtureRunScript = resolve(fixtureRoot, "run.sh");
    const fixtureRootEnv = resolve(fixtureRoot, ".env.local");
    const fixtureProjectConfig = resolve(fixtureRoot, ".infisical.json");
    const fixtureBinDir = resolve(fixtureRoot, "bin");
    const fixtureInfisical = resolve(fixtureBinDir, "infisical");
    const fixtureChmod = resolve(fixtureBinDir, "chmod");
    const fixtureArgsFile = resolve(fixtureRoot, "infisical-args.txt");
    const rawFixtureSecret = "fixture-confidential-client-secret-that-is-never-real";
    const expectedDigest = createHash("sha256").update(rawFixtureSecret).digest("hex");
    const previousFixtureDigest = createHash("sha256").update("previous-fixture-secret").digest("hex");
    const originalRootEnv = `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=${previousFixtureDigest}\nUNRELATED_FIXTURE=value\n`;

    try {
      mkdirSync(fixtureBinDir, { recursive: true });
      copyFileSync(RUN_SCRIPT_SOURCE, fixtureRunScript);
      chmodSync(fixtureRunScript, 0o700);
      writeFileSync(fixtureRootEnv, originalRootEnv, { mode: 0o600 });
      writeFileSync(
        fixtureProjectConfig,
        `${JSON.stringify({ workspaceId: "fixture", defaultEnvironment: "dev", domain: "https://eu.infisical.com" })}\n`,
        { mode: 0o600 },
      );
      writeFileSync(
        fixtureInfisical,
        `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${INFISICAL_FIXTURE_MODE:-success}" == "fail" ]]; then
  printf '%s\\n' '${rawFixtureSecret}'
  exit 1
fi
printf '%s\\n' "$@" >"\${INFISICAL_FIXTURE_ARGS_FILE:?}"
printf '%s\\n' '${rawFixtureSecret}'
`,
        { mode: 0o700 },
      );

      rmSync(fixtureProjectConfig);
      const missingProjectConfig = spawnSync("bash", ["-x", fixtureRunScript, "mcp-secret-sync"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fixtureBinDir}:${process.env.PATH ?? ""}`,
        },
      });
      const missingProjectConfigOutput = `${missingProjectConfig.stdout}${missingProjectConfig.stderr}`;

      expect(missingProjectConfig.status).not.toBe(0);
      expect(missingProjectConfigOutput).toContain(".infisical.json is required");
      expect(missingProjectConfig.stderr).toMatch(/\+ echo .*\.infisical\.json is required/u);
      expect(missingProjectConfigOutput).not.toContain(rawFixtureSecret);
      expect(missingProjectConfigOutput).not.toContain(expectedDigest);
      expect(missingProjectConfigOutput).not.toContain(previousFixtureDigest);
      expect(readFileSync(fixtureRootEnv, "utf8")).toBe(originalRootEnv);

      writeFileSync(
        fixtureProjectConfig,
        `${JSON.stringify({ workspaceId: "fixture", defaultEnvironment: "dev", domain: "https://eu.infisical.com" })}\n`,
        { mode: 0o600 },
      );

      const failedRetrieval = spawnSync("bash", ["-x", fixtureRunScript, "mcp-secret-sync"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          INFISICAL_FIXTURE_MODE: "fail",
          PATH: `${fixtureBinDir}:${process.env.PATH ?? ""}`,
        },
      });
      const failedOutput = `${failedRetrieval.stdout}${failedRetrieval.stderr}`;

      expect(failedRetrieval.status).not.toBe(0);
      expect(failedOutput).toContain("secret retrieval failed; value not printed");
      expect(failedRetrieval.stderr).toMatch(/\+ echo .*secret retrieval failed/u);
      expect(failedOutput).not.toContain(rawFixtureSecret);
      expect(failedOutput).not.toContain(expectedDigest);
      expect(failedOutput).not.toContain(previousFixtureDigest);
      expect(readFileSync(fixtureRootEnv, "utf8")).toBe(originalRootEnv);

      writeFileSync(fixtureChmod, "#!/usr/bin/env bash\nexit 1\n", { mode: 0o700 });
      const failedPermissions = spawnSync("bash", ["-x", fixtureRunScript, "mcp-secret-sync"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          INFISICAL_FIXTURE_ARGS_FILE: fixtureArgsFile,
          PATH: `${fixtureBinDir}:${process.env.PATH ?? ""}`,
        },
      });
      const failedPermissionsOutput = `${failedPermissions.stdout}${failedPermissions.stderr}`;

      expect(failedPermissions.status).not.toBe(0);
      expect(failedPermissionsOutput).toContain("temporary env permissions failed; value not printed");
      expect(failedPermissions.stderr).toMatch(/\+ echo .*temporary env permissions failed/u);
      expect(failedPermissionsOutput).not.toContain(rawFixtureSecret);
      expect(failedPermissionsOutput).not.toContain(expectedDigest);
      expect(failedPermissionsOutput).not.toContain(previousFixtureDigest);
      expect(readFileSync(fixtureRootEnv, "utf8")).toBe(originalRootEnv);
      rmSync(fixtureChmod);

      const result = spawnSync("bash", ["-x", fixtureRunScript, "mcp-secret-sync"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          INFISICAL_FIXTURE_ARGS_FILE: fixtureArgsFile,
          PATH: `${fixtureBinDir}:${process.env.PATH ?? ""}`,
        },
      });
      const output = `${result.stdout}${result.stderr}`;
      const updatedRootEnv = readFileSync(fixtureRootEnv, "utf8");
      const infisicalArgs = readFileSync(fixtureArgsFile, "utf8").trim().split("\n");

      expect(result.status).toBe(0);
      expect(output).toContain("mcp-secret-sync: PASS");
      expect(result.stderr).toMatch(/\+ echo .*mcp-secret-sync: PASS/u);
      expect(output).not.toContain(rawFixtureSecret);
      expect(output).not.toContain(expectedDigest);
      expect(output).not.toContain(previousFixtureDigest);
      expect(infisicalArgs).toEqual([
        "secrets",
        "get",
        "MCP_OAUTH_PRODUCTION_CLIENT_SECRET",
        "--env=dev",
        "--path=/",
        "--domain=https://eu.infisical.com",
        "--plain",
        "--silent",
      ]);
      expect(updatedRootEnv).toContain(`MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=${expectedDigest}`);
      expect(updatedRootEnv).toContain("UNRELATED_FIXTURE=value");
      expect(statSync(fixtureRootEnv).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("requires canonical server keys to originate from root .env.local", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "pr305-mcp-check-"));
    const fixtureRunScript = resolve(fixtureRoot, "run.sh");
    const fixtureAppDir = resolve(fixtureRoot, "my-app");
    const fixtureRootEnv = resolve(fixtureRoot, ".env.local");
    const fixtureAppEnv = resolve(fixtureAppDir, ".env.local");
    const fixtureAppBaseEnv = resolve(fixtureAppDir, ".env");
    const fixtureStateDir = resolve(fixtureRoot, "tmp/dev-stack");
    const fixtureStateFile = resolve(fixtureStateDir, "pids.env");
    const fixtureTunnelCredentials = resolve(fixtureRoot, "tunnel-credentials.json");
    const fixtureEnvLines = [
      "MCP_OAUTH_PRODUCTION_RUNTIME=1",
      "MCP_OAUTH_PRODUCTION_APPROVED=1",
      "MCP_OAUTH_PRODUCTION_ROUTE_WIRING=1",
      "MCP_OAUTH_PRODUCTION_CLIENT_IDS=local-chatgpt-client",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED=1",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS=local-chatgpt-client",
      "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES=https://mcp.twoweeks.ai/mcp",
      `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS=${OWNER_DIGEST}`,
      "MCP_OAUTH_PRODUCTION_RESOURCE=https://mcp.twoweeks.ai/mcp",
      "MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN=https://mcp.twoweeks.ai",
      "MCP_OAUTH_PRODUCTION_REDIRECT_URIS=https://chatgpt.com/connector/oauth/b7v_6OncLEsg",
      "MCP_OAUTH_PRODUCTION_ISSUER=https://issuer.example.test",
      "MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT=test",
      `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=${"0".repeat(64)}`,
      "CLERK_JWT_ISSUER_DOMAIN=https://issuer.example.test",
      "CONVEX_URL=http://127.0.0.1:3210",
      "CONVEX_AUTH_TOKEN=fixture-admin-token",
      `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${fixtureTunnelCredentials}`,
    ];

    try {
      mkdirSync(fixtureAppDir, { recursive: true });
      copyFileSync(RUN_SCRIPT_SOURCE, fixtureRunScript);
      chmodSync(fixtureRunScript, 0o700);
      writeFileSync(fixtureTunnelCredentials, "{}\n", { mode: 0o600 });
      writeFileSync(fixtureRootEnv, `${fixtureEnvLines.join("\n")}\n`, { mode: 0o600 });
      writeFileSync(fixtureAppEnv, "VITE_FIXTURE=1\n", { mode: 0o600 });

      const accepted = spawnSync("bash", ["-x", fixtureRunScript, "mcp-check"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "" },
      });
      const acceptedOutput = `${accepted.stdout}${accepted.stderr}`;
      expect(accepted.status).toBe(0);
      expect(acceptedOutput).toContain("mcp-check: PASS");
      expect(acceptedOutput).not.toContain("pk_test_");
      expect(acceptedOutput).not.toContain("pk_live_");
      expect(acceptedOutput).not.toContain(OWNER_DIGEST);
      expect(acceptedOutput).not.toContain("fixture-admin-token");
      expect(acceptedOutput).not.toContain("0".repeat(64));

      const rawSubject = "raw-subject-fixture-do-not-print";
      writeFileSync(
        fixtureRootEnv,
        `${fixtureEnvLines.join("\n")}\nMCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECTS=${rawSubject}\n`,
        { mode: 0o600 },
      );
      const rawSubjectRejected = spawnSync("bash", ["-x", fixtureRunScript, "mcp-check"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "" },
      });
      const rawSubjectOutput = `${rawSubjectRejected.stdout}${rawSubjectRejected.stderr}`;
      expect(rawSubjectRejected.status).not.toBe(0);
      expect(rawSubjectOutput).toContain("raw private-beta subject identifiers are forbidden");
      expect(rawSubjectOutput).not.toContain(rawSubject);
      expect(rawSubjectOutput).not.toContain(OWNER_DIGEST);
      expect(rawSubjectOutput).not.toContain("fixture-admin-token");

      writeFileSync(
        fixtureRootEnv,
        `${fixtureEnvLines.filter((line) => !line.startsWith("CONVEX_AUTH_TOKEN=")).join("\n")}\n`,
        { mode: 0o600 },
      );
      const inheritedOnly = spawnSync("bash", [fixtureRunScript, "mcp-check"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          CONVEX_AUTH_TOKEN: "inherited-fixture-value",
          VITE_CLERK_PUBLISHABLE_KEY: "",
        },
      });
      expect(inheritedOnly.status).not.toBe(0);
      expect(`${inheritedOnly.stdout}${inheritedOnly.stderr}`).toContain(
        "CONVEX_AUTH_TOKEN must be defined in root .env.local",
      );
      expect(`${inheritedOnly.stdout}${inheritedOnly.stderr}`).not.toContain("inherited-fixture-value");

      writeFileSync(fixtureRootEnv, `${fixtureEnvLines.join("\n")}\n`, { mode: 0o600 });
      writeFileSync(fixtureAppEnv, "MCP_OAUTH_PRODUCTION_RUNTIME=1\n", { mode: 0o600 });
      const appOverride = spawnSync("bash", [fixtureRunScript, "mcp-check"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "" },
      });
      expect(appOverride.status).not.toBe(0);
      expect(`${appOverride.stdout}${appOverride.stderr}`).toContain(
        "canonical server keys are allowed only in root .env.local",
      );

      writeFileSync(fixtureAppEnv, "VITE_FIXTURE=1\n", { mode: 0o600 });
      writeFileSync(fixtureAppBaseEnv, "CONVEX_URL=http://127.0.0.1:9999\n", { mode: 0o600 });
      const nonMcpOverride = spawnSync("bash", [fixtureRunScript, "mcp-check"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "" },
      });
      expect(nonMcpOverride.status).not.toBe(0);
      expect(`${nonMcpOverride.stdout}${nonMcpOverride.stderr}`).toContain(
        "canonical server keys are allowed only in root .env.local",
      );

      rmSync(fixtureAppBaseEnv, { force: true });
      mkdirSync(fixtureStateDir, { recursive: true });
      writeFileSync(fixtureStateFile, "STACK_MODE=mcp-private-beta\n", { mode: 0o600 });
      writeFileSync(
        fixtureRootEnv,
        `${fixtureEnvLines
          .map((line) =>
            line.startsWith("CLERK_JWT_ISSUER_DOMAIN=") ? "CLERK_JWT_ISSUER_DOMAIN=invalid-issuer" : line,
          )
          .join("\n")}\n`,
        { mode: 0o600 },
      );
      const reloadEnv = spawnSync("bash", [fixtureRunScript, "reload-env"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "" },
      });
      expect(reloadEnv.status).not.toBe(0);
      expect(`${reloadEnv.stdout}${reloadEnv.stderr}`).toContain(
        "cannot derive the Clerk publishable key from CLERK_JWT_ISSUER_DOMAIN",
      );
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("does not downgrade production metadata or token parsing when the configured client_secret_post digest is malformed", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256: "not-a-sha256-digest",
      },
    });
    const middleware = readConfiguredMiddleware(plugin);

    const metadataResponse = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const tokenResponse = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody(),
    });

    expect(metadataResponse.next).not.toHaveBeenCalled();
    expect(metadataResponse.statusCode).toBe(200);
    expect(JSON.parse(metadataResponse.body)).toMatchObject({
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    });
    expect(tokenResponse.next).not.toHaveBeenCalled();
    expect(tokenResponse.statusCode).toBe(400);
    expect(JSON.parse(tokenResponse.body)).toEqual({ error: "invalid_request" });
    expect(metadataResponse.body).not.toContain("not-a-sha256-digest");
    expect(tokenResponse.body).not.toContain("not-a-sha256-digest");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("does not serve production authorization-server metadata while the auth preflight is closed", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        MCP_OAUTH_PRODUCTION_RUNTIME: "0",
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("returns explicit not found for unsupported production OpenID discovery instead of Vite HTML", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/openid-configuration",
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(response.body)).toMatchObject({
      error: "not_found",
    });
    expect(response.body).not.toContain("<!doctype html>");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("handles production well-known HEAD probes without falling through to Vite HTML", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() });
    const middleware = readConfiguredMiddleware(plugin);
    const authorizationServerResponse = await invokeMiddleware(middleware, {
      method: "HEAD",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const protectedResourceResponse = await invokeMiddleware(middleware, {
      method: "HEAD",
      url: "/.well-known/oauth-protected-resource/resource",
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const rootProtectedResourceResponse = await invokeMiddleware(middleware, {
      method: "HEAD",
      url: "/.well-known/oauth-protected-resource",
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const openIdResponse = await invokeMiddleware(middleware, {
      method: "HEAD",
      url: "/.well-known/openid-configuration",
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(authorizationServerResponse.next).not.toHaveBeenCalled();
    expect(authorizationServerResponse.statusCode).toBe(200);
    expect(authorizationServerResponse.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(authorizationServerResponse.body).toBe("");
    expect(protectedResourceResponse.next).not.toHaveBeenCalled();
    expect(protectedResourceResponse.statusCode).toBe(200);
    expect(protectedResourceResponse.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(protectedResourceResponse.body).toBe("");
    expect(rootProtectedResourceResponse.next).not.toHaveBeenCalled();
    expect(rootProtectedResourceResponse.statusCode).toBe(200);
    expect(rootProtectedResourceResponse.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(rootProtectedResourceResponse.body).toBe("");
    expect(openIdResponse.next).not.toHaveBeenCalled();
    expect(openIdResponse.statusCode).toBe(404);
    expect(openIdResponse.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(openIdResponse.body).toBe("");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("does not serve production protected-resource metadata while the auth preflight is closed", async () => {
    const resource = "https://resource.twoweeks.example.test/resource";
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        MCP_OAUTH_PRODUCTION_RUNTIME: "0",
        MCP_OAUTH_PRODUCTION_RESOURCE: resource,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: "/.well-known/oauth-protected-resource/resource",
      headers: { host: "resource.twoweeks.example.test" },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("bounds production token request bodies in Vite before adapter validation", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: routeDependencies(makeCtx()),
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${"C".repeat(5_000)}`,
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(413);
    expect(JSON.parse(response.body)).toMatchObject({
      kind: "mcp_oauth_production_route_response",
      status: "blocked",
      reason: "token_request_body_too_large",
      route: "oauth_token",
      authorizationCodeAccepted: false,
      authorizationCodeConsumed: false,
      tokenIssued: false,
    });
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("keeps production token request bodies unread when the preflight gate is closed", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        MCP_OAUTH_PRODUCTION_RUNTIME: "0",
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${"C".repeat(5_000)}`,
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({
      kind: "mcp_oauth_production_route_response",
      status: "blocked",
      reason: "blocked_missing_runtime_flag",
      route: "oauth_token",
      allowedByPreflight: false,
      authorizationCodeAccepted: false,
      authorizationCodeConsumed: false,
      tokenIssued: false,
    });
    expect(response.body).not.toContain("token_request_body_too_large");
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("fails default production login-return continuation closed without a verified request identity", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "mcp.twoweeks.example.test", cookie: BROWSER_NONCE_COOKIE },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "blocked",
      reason: "owner_binding_failed",
      route: "oauth_login_return",
      ownerBound: false,
      authorizationCodeIssued: false,
      tokenExchangeAttempted: false,
      accountLinkCreated: false,
    });
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("lets browser document login-return continuations without a Clerk session fall through to the React bridge", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: {
        host: "mcp.twoweeks.example.test",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        cookie: BROWSER_NONCE_COOKIE,
      },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("fails closed when the default Convex client cannot be constructed", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    ConvexHttpClientMock.mockImplementationOnce(() => {
      throw new Error("invalid deployment url");
    });

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("pre_auth_create_failed");
    expect(convexHttpClientSetAdminAuth).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("maps default token issuance storage unavailability to a retryable failure", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    ConvexHttpClientMock.mockImplementationOnce(() => {
      throw new Error("invalid deployment url");
    });

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
      headers: {
        host: "mcp.twoweeks.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody(),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: "invalid_grant" });
    expect(convexHttpClientSetAdminAuth).not.toHaveBeenCalled();
    expect(convexHttpClientQuery).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("registers the production authorize middleware for Vite preview", async () => {
    const ctx = makeCtx();
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: routeDependencies(ctx),
    });
    const middleware = readConfiguredPreviewMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(ctx.preAuthRows).toHaveLength(1);
  });

  it("allows the production OAuth host through Vite preview host validation", () => {
    expect(buildMcpOAuthProductionViteAllowedHosts(prodRouteEnv())).toEqual([
      "host.docker.internal",
      "mcp.twoweeks.example.test",
    ]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      ...prodRouteEnv(),
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: "https://auth.twoweeks.example.test",
      MCP_OAUTH_PRODUCTION_RESOURCE: "https://resource.twoweeks.example.test/resource",
    })).toEqual([
      "host.docker.internal",
      "auth.twoweeks.example.test",
      "resource.twoweeks.example.test",
    ]);
    expect(buildMcpOAuthProductionViteAllowedHosts({})).toEqual(["host.docker.internal"]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: "https://mcp.twoweeks.example.test/path",
    })).toEqual(["host.docker.internal"]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      MCP_OAUTH_PRODUCTION_RESOURCE: "http://resource.twoweeks.example.test/resource",
    })).toEqual(["host.docker.internal"]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: "file://mcp.twoweeks.example.test/",
    })).toEqual(["host.docker.internal"]);
  });

  it("canonicalizes production OAuth redirect URI env entries before exact handoff comparison", () => {
    expect(
      normalizeMcpOAuthProductionRedirectUris(
        "https://chatgpt.example.test:443/connector/oauth/callback?state=fixture,https://chatgpt.example.test/connector/oauth/callback?state=fixture",
      ),
    ).toEqual(["https://chatgpt.example.test/connector/oauth/callback?state=fixture"]);
    expect(normalizeMcpOAuthProductionRedirectUris("https://*.example.test/connector/oauth/callback")).toEqual([]);
    expect(normalizeMcpOAuthProductionRedirectUris("https://chatgpt.example.test/connector/oauth/*")).toEqual([]);
    expect(
      normalizeMcpOAuthProductionRedirectUris("https://chatgpt.example.test/connector/oauth/ca\nllback"),
    ).toEqual([]);
    expect(normalizeMcpOAuthProductionRedirectUris("https://chatgpt.example.test/connector/oauth/%")).toEqual([]);
  });

  it("uses the PR92 route preflight instead of reimplementing production activation or status logic", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).toContain("buildMcpOAuthProductionRoutePreflight");
    expect(source).toContain("from \"./mcpOAuthProductionRoutePreflightBoundary\"");
    expect(source).toContain("isRouteAllowedByPreflight(route, config.preflight)");
    expect(source).toContain("preflight.authorizeAllowedToWire");
    expect(source).toContain("preflight.allowedToWire");
    expectSourceNotToMatch(source, FORBIDDEN_PREFLIGHT_REIMPLEMENTATION_PATTERNS);
  });

  it("runs private beta and launch readiness only after authenticated /mcp context and before policy dispatch", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const bearerIndex = source.indexOf("const bearerToken = readBearerAccessToken");
    const quotaIndex = source.indexOf("const quotaInput = Object.freeze({", bearerIndex);
    const verifyIndex = source.indexOf("let verifyResult: McpOAuthProductionAccessTokenVerifyPortResultV1", quotaIndex);
    const protocolParseIndex = source.indexOf("const jsonRpcMessage = parseMcpJsonRpcProtocolMessage", verifyIndex);
    const envelopeIndex = source.indexOf("const envelope = buildMcpAuthenticatedProtocolEnvelope", protocolParseIndex);
    const gateIndex = source.indexOf("const privateBetaDecision = evaluateMcpProductionPrivateBetaGate", envelopeIndex);
    const gateDeniedIndex = source.indexOf("return mcpPrivateBetaGateDeniedResponse(preflight, privateBetaDecision)", gateIndex);
    const launchReadinessIndex = source.indexOf("const launchReadinessDecision = evaluateMcpProductionLaunchReadiness", gateDeniedIndex);
    const launchReadinessDeniedIndex = source.indexOf(
      "return await handleLaunchReadinessCheckedMcpJsonRpc(",
      launchReadinessIndex,
    );
    const dispatchIndex = source.indexOf(
      "const decision = evaluateMcpProductionPolicy(envelope)",
      launchReadinessDeniedIndex,
    );

    expect(bearerIndex).toBeGreaterThanOrEqual(0);
    expect(quotaIndex).toBeGreaterThan(bearerIndex);
    expect(verifyIndex).toBeGreaterThan(quotaIndex);
    expect(protocolParseIndex).toBeGreaterThan(verifyIndex);
    expect(envelopeIndex).toBeGreaterThan(protocolParseIndex);
    expect(gateIndex).toBeGreaterThan(envelopeIndex);
    expect(gateDeniedIndex).toBeGreaterThan(gateIndex);
    expect(launchReadinessIndex).toBeGreaterThan(gateDeniedIndex);
    expect(launchReadinessDeniedIndex).toBeGreaterThan(launchReadinessIndex);
    expect(dispatchIndex).toBeGreaterThan(launchReadinessDeniedIndex);
  });

  it("only claims the intended production entrypoint paths", () => {
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_CONTINUATION_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_TOKEN_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_CALLBACK_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_MCP_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/authorize/extra")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/token/extra")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/continue/extra")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/mcp/tools/list")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/mcp/tools/call")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/tools/list")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/tools/call")).toBe(false);
  });
});

function activationDependencies(): McpOAuthProductionActivationDependenciesV1 {
  return {
    providerAdapter: {
      provider: "stytch",
      exchangeAuthorizationCode: vi.fn(async () => ({
        kind: "mcp_oauth_production_token_exchange_result",
        ok: false,
        reason: "not_executed_in_route_adapter_test",
        safeFailure: { code: "not_executed" },
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      })),
      version: 1,
    },
    executeAccountLinkLifecycle: vi.fn(async () => ({
      kind: "mcp_account_link_lifecycle_result",
      operation: "link",
      ok: false,
      reason: "not_executed_in_route_adapter_test",
      safeFailure: { code: "not_executed" },
      modelVisible: false,
      version: 1,
    })),
  };
}

function routeConfig(
  flags: Readonly<{ runtime?: string; approved?: string; routeWiring?: string }>,
  dependencies: McpOAuthProductionActivationDependenciesV1 = activationDependencies(),
  privateBeta: McpProductionPrivateBetaGateConfigInputV1 = privateBetaConfig(),
  launchReadiness?: McpProductionLaunchReadinessConfigInputV1,
) {
  return buildMcpOAuthProductionRouteAdapterConfig({
    flags,
    providerConfig: PROVIDER_CONFIG,
    activationDependencies: dependencies,
    privateBeta,
    ...(launchReadiness ? { launchReadiness } : {}),
  });
}

function clientSecretPostPolicy(
  overrides: Partial<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["clientSecretPost"]>> = {},
): NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["clientSecretPost"]> {
  return Object.freeze({
    allowedClientId: CLIENT_ID,
    clientSecretSha256: CONFIDENTIAL_CLIENT_SECRET_DIGEST,
    version: 1,
    ...overrides,
  });
}

function privateBetaConfig(
  overrides: Partial<McpProductionPrivateBetaGateConfigInputV1> = {},
): McpProductionPrivateBetaGateConfigInputV1 {
  return {
    enabled: true,
    allowedClientIds: [CLIENT_ID],
    allowedResources: [RESOURCE],
    allowedSubjectDigests: [OWNER_DIGEST],
    ...overrides,
  };
}

function launchReadinessConfig(
  overrides: Partial<McpProductionLaunchReadinessConfigInputV1> = {},
): McpProductionLaunchReadinessConfigInputV1 {
  return {
    publicLaunchRequested: false,
    evidence: completeLaunchReadinessEvidence(),
    version: 1,
    ...overrides,
  };
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
    schemaMatcherReviewed: true,
    readonlySummaryExecutionReviewed: true,
    readonlySummaryStatusReviewed: true,
    providerWriteExpansionBlocked: true,
    unresolvedBlockingFindings: false,
    version: 1,
    ...overrides,
  };
}

function request(
  path: McpOAuthProductionRoutePathV1,
  method = path === MCP_OAUTH_PRODUCTION_MCP_PATH || path === MCP_OAUTH_PRODUCTION_TOKEN_PATH ? "POST" : "GET",
  url = path,
): McpOAuthProductionRouteAdapterRequestV1 {
  return {
    method,
    path,
    url,
    headers: {
      host: "mcp.twoweeks.example.test",
      ...(path === MCP_OAUTH_CONTINUATION_PATH ? { cookie: BROWSER_NONCE_COOKIE } : {}),
    },
  };
}

function routeDependencies(ctx: ReturnType<typeof makeCtx>) {
  const dependencies = {
    authorizationRequestConfig: authorizationRequestConfig(),
    clientSecretPost: clientSecretPostPolicy(),
    checkPreAuthQuota: vi.fn(async () => ({
      kind: "mcp_oauth_pre_auth_quota_result",
      ok: true,
      reason: "accepted",
      safeForLogging: true,
      version: 1,
    })),
    createPreAuthIntent: vi.fn(async (input) => createFakePreAuthIntent(ctx, input)),
    bindPreAuthIntentToAuthenticatedOwner: vi.fn(async (input) =>
      bindFakePreAuthIntentToAuthenticatedOwner(ctx, input),
    ),
    consumeAuthorizationIntent: vi.fn(async (input) => consumeFakeAuthorizationIntent(ctx, input)),
    createAuthorizationCode: vi.fn(async (input) => createFakeAuthorizationCode(ctx, input)),
    validateAuthorizationCode: vi.fn(async (input) => validateFakeAuthorizationCode(ctx, input)),
    issueAccessToken: vi.fn(async (input) => issueFakeAccessToken(ctx, input)),
    verifyAccessToken: vi.fn(async (input) => verifyFakeAccessToken(ctx, input)),
    executeReadonlySummaryTool: vi.fn(async (input) => fakeReadonlySummaryExecutionResult(input)),
    readAuthenticatedOwnerIdentity: vi.fn(async () =>
      ctx.subject === null
        ? undefined
        : {
            subject: ctx.subject,
            issuer: CLERK_ISSUER,
            version: 1,
          },
    ),
    generateBrowserBoundContinuationNonce: vi.fn(() => BROWSER_NONCE),
    generateAuthorizationCode: vi.fn(() => RAW_AUTHORIZATION_CODE),
    generateAccessToken: vi.fn(() => RAW_ACCESS_TOKEN),
    handleCodec: deterministicCodec,
    now: vi.fn(() => NOW),
  } satisfies Required<
    Pick<
      McpOAuthProductionRouteAdapterDependenciesV1,
      | "authorizationRequestConfig"
      | "clientSecretPost"
      | "checkPreAuthQuota"
      | "createPreAuthIntent"
      | "bindPreAuthIntentToAuthenticatedOwner"
      | "consumeAuthorizationIntent"
      | "createAuthorizationCode"
      | "validateAuthorizationCode"
      | "issueAccessToken"
      | "verifyAccessToken"
      | "executeReadonlySummaryTool"
      | "readAuthenticatedOwnerIdentity"
      | "generateBrowserBoundContinuationNonce"
      | "generateAuthorizationCode"
      | "generateAccessToken"
      | "handleCodec"
      | "now"
      >
  >;
  return dependencies;
}

function fakeReadonlySummaryExecutionResult(
  input: McpProductionReadonlySummaryExecutionInputV1,
  updatedAtEpochMs = NOW,
  status: "available" | "no_data_available" | "onboarding_required" = "available",
): McpProductionReadonlySummaryExecutionResultV1 {
  const toolCase = READONLY_SUMMARY_CASES.find((candidate) => candidate.toolName === input.toolName);
  if (!toolCase) return fakeReadonlySummaryExecutionFailure("unsupported_tool");
  const projectionData = fakeReadonlySummaryProjectionData(input.toolName);
  const missingDataReason = status === "onboarding_required"
    ? "owner_onboarding_required"
    : status === "no_data_available"
      ? toolCase.missingDataReason
      : undefined;
  return Object.freeze({
    ok: true as const,
    content: Object.freeze([
      Object.freeze({
        type: "text" as const,
        text: "Read-only summary returned.",
      }),
    ]),
    structuredContent: Object.freeze({
      kind: toolCase.expectedKind,
      allowed: true,
      status,
      updatedAt: new Date(updatedAtEpochMs).toISOString(),
      [toolCase.resultRefKey]: Object.freeze({
        id: toolCase.safeRefId,
        label: "Safe summary availability",
        status,
        category: toolCase.category,
        count: status === "available" ? 1 : 0,
        updatedAt: new Date(updatedAtEpochMs).toISOString(),
        version: 1,
      }),
      availability: Object.freeze({
        source: toolCase.dataReads,
        ownerState: status === "onboarding_required" ? "onboarding_required" : "resolved",
        version: 1,
      }),
      safeCounts: projectionData.safeCounts,
      safeCategories: projectionData.safeCategories,
      ...(projectionData.safeFlags ? { safeFlags: projectionData.safeFlags } : {}),
      ...(missingDataReason ? { missingDataReason } : {}),
      capabilities: Object.freeze({
        ownerResolution: status === "onboarding_required" ? "blocked" : "server_only",
        dataReads: toolCase.dataReads,
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
        version: 1,
      }),
      modelVisible: true,
      version: 1,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}

function fakeReadonlySummaryProjectionData(
  toolName: McpProductionReadonlySummaryExecutionInputV1["toolName"],
): Readonly<{
  safeCounts: Readonly<Record<string, unknown>>;
  safeCategories: Readonly<Record<string, unknown>>;
  safeFlags?: Readonly<Record<string, unknown>>;
}> {
  switch (toolName) {
    case "twoweeks.application_package.summarize":
      return Object.freeze({
        safeCounts: Object.freeze({ artifacts: 2, reviewItems: 0, warnings: 0, blockers: 0, version: 1 }),
        safeCategories: Object.freeze({ packageStatus: "ready_for_review", version: 1 }),
      });
    case "twoweeks.evidence_graph.summarize":
      return Object.freeze({
        safeCounts: Object.freeze({ approvedFacts: 6, missingEvidence: 0, staleSources: 0, blockers: 0, version: 1 }),
        safeCategories: Object.freeze({
          evidenceCoverage: "complete",
          provenanceCoverage: "complete",
          qualityStatus: "ready_for_review",
          blockerCategory: "none",
          nextReviewHint: "ready_for_review",
          version: 1,
        }),
      });
    case "twoweeks.resume_variant_plan.summarize":
      return Object.freeze({
        safeCounts: Object.freeze({ planItems: 7, claimBackedItems: 7, reviewNeededItems: 0, blockers: 0, version: 1 }),
        safeCategories: Object.freeze({
          planStatus: "ready_for_review",
          targetDocumentKind: "resume",
          tailoringCompleteness: "complete",
          blockerCategory: "none",
          missingInputCategory: "none",
          nextReviewHint: "ready_for_review",
          version: 1,
        }),
      });
    case "twoweeks.review_cockpit.summarize":
      return Object.freeze({
        safeCounts: Object.freeze({
          pendingReviews: 0,
          approvedReviews: 1,
          blockedReviews: 0,
          missingReviewItems: 0,
          version: 1,
        }),
        safeCategories: Object.freeze({
          reviewReadiness: "ready_for_review",
          reviewGateStatus: "ready",
          blockerCategory: "none",
          missingReviewCategory: "none",
          nextReviewHint: "ready_for_review",
          nextUserAction: "none",
          version: 1,
        }),
        safeFlags: Object.freeze({ approvalNeeded: false, staleData: false, overLimit: false, version: 1 }),
      });
  }
}

function fakeReadonlySummaryExecutionFailure(
  code: "unsupported_tool" | "query_failed" | "malformed_result" = "query_failed",
): McpProductionReadonlySummaryExecutionResultV1 {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({
      code,
      message: MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
      safeForModel: true as const,
      rawArgumentsEchoed: false as const,
      ownerIdentityEchoed: false as const,
      tokenMaterialEchoed: false as const,
      internalQueryRefEchoed: false as const,
      providerMetadataEchoed: false as const,
      stackTraceEchoed: false as const,
      version: 1 as const,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}

function authorizationRequestConfig(
  overrides: Partial<McpOAuthAuthorizationRequestBoundaryConfigV1> = {},
): McpOAuthAuthorizationRequestBoundaryConfigV1 {
  return Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_config",
    authorizationPageOrigin: PROD_APP_ORIGIN,
    authorizationPagePath: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
    canonicalResource: RESOURCE,
    allowedRedirectUris: [REDIRECT_URI],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: ["openid", "email", "profile"],
    allowedOptionalParameters: ["nonce", "prompt"],
    maxUrlLength: 4_096,
    maxParameterLength: 512,
    maxStateLength: 512,
    maxIdTokenHintLength: 1_024,
    clientIdPolicy: Object.freeze({
      mode: "predefined_allowlist",
      allowedClientIds: [CLIENT_ID],
      version: 1,
    }),
    localDevelopmentOnly: true,
    allowHttpLocalhostAuthorizationOrigin: false,
    version: 1,
    ...overrides,
  });
}

function authorizationRequestPath(
  overrides: Readonly<Partial<Record<string, string>>> = {},
): string {
  const params = new URLSearchParams();
  params.append("response_type", overrides.response_type ?? "code");
  params.append("client_id", overrides.client_id ?? CLIENT_ID);
  params.append("redirect_uri", overrides.redirect_uri ?? REDIRECT_URI);
  params.append("scope", overrides.scope ?? `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid`);
  params.append("state", overrides.state ?? STATE);
  params.append("code_challenge", overrides.code_challenge ?? PKCE);
  params.append("code_challenge_method", overrides.code_challenge_method ?? "S256");
  params.append("resource", overrides.resource ?? RESOURCE);
  if (overrides.nonce !== undefined) params.append("nonce", overrides.nonce);
  if (overrides.prompt !== undefined) params.append("prompt", overrides.prompt);
  if (overrides.owner !== undefined) params.append("owner", overrides.owner);
  return `${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}?${params.toString()}`;
}

function continuationPath(): string {
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: RAW_HANDLE,
    [MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER]: BROWSER_NONCE,
  });
  return `${MCP_OAUTH_CONTINUATION_PATH}?${params.toString()}`;
}

function continuationPathNonceFirst(): string {
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER]: BROWSER_NONCE,
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: RAW_HANDLE,
  });
  return `${MCP_OAUTH_CONTINUATION_PATH}?${params.toString()}`;
}

function tokenRequestBody(
  overrides: Readonly<
    Partial<
      Record<
        "grant_type" | "code" | "client_id" | "redirect_uri" | "resource" | "code_verifier" | "client_secret",
        string
      >
    >
  > = {},
): string {
  const params = new URLSearchParams();
  params.append("grant_type", overrides.grant_type ?? "authorization_code");
  if (overrides.code !== "") params.append("code", overrides.code ?? RAW_AUTHORIZATION_CODE);
  if (overrides.client_id !== "") params.append("client_id", overrides.client_id ?? CLIENT_ID);
  params.append("redirect_uri", overrides.redirect_uri ?? REDIRECT_URI);
  if (overrides.resource !== "") params.append("resource", overrides.resource ?? RESOURCE);
  params.append("code_verifier", overrides.code_verifier ?? RAW_CODE_VERIFIER);
  if (overrides.client_secret !== "") {
    params.append("client_secret", overrides.client_secret ?? RAW_CONFIDENTIAL_CLIENT_SECRET);
  }
  return params.toString();
}

function basicClientAuthorizationHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function tokenRequest(
  bodyText = tokenRequestBody(),
  headers: Readonly<Record<string, string | undefined>> = {
    host: "mcp.twoweeks.example.test",
    "content-type": "application/x-www-form-urlencoded",
  },
): McpOAuthProductionRouteAdapterRequestV1 {
  return {
    method: "POST",
    path: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
    url: MCP_OAUTH_PRODUCTION_TOKEN_PATH,
    headers,
    bodyText,
  };
}

function mcpRequest(
  authorization: string | readonly string[] | null = `Bearer ${RAW_ACCESS_TOKEN}`,
  body: unknown = mcpInitializeRequest(),
  extraHeaders: Readonly<Record<string, string | readonly string[] | undefined>> = {},
): McpOAuthProductionRouteAdapterRequestV1 {
  return {
    method: "POST",
    path: MCP_OAUTH_PRODUCTION_MCP_PATH,
    url: MCP_OAUTH_PRODUCTION_MCP_PATH,
    remoteAddress: "198.51.100.9",
    headers: {
      host: "mcp.twoweeks.example.test",
      ...(authorization !== null ? { authorization } : {}),
      ...extraHeaders,
    },
    bodyText: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function mcpInitializeRequest(id: string | number | null = "initialize") {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "chatgpt-apps-sdk-fixture",
        version: "1.0.0",
      },
    },
  } as const;
}

function mcpJsonRpcRequest(method: string, id: string | number | null = method, params: unknown = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

function makeCtx(options: Readonly<{ subject?: string | null }> = {}) {
  const preAuthRows: StoredPreAuthIntentRecord[] = [];
  const authorizationRows: StoredAuthorizationIntentRecord[] = [];
  const authorizationCodeRows: StoredAuthorizationCodeRecord[] = [];
  const accessTokenRows: StoredAccessTokenRecord[] = [];

  return {
    preAuthRows,
    authorizationRows,
    authorizationCodeRows,
    accessTokenRows,
    subject: options.subject === undefined ? OWNER_ID : options.subject,
  };
}

function storedAccessToken(overrides: Partial<StoredAccessTokenRecord> = {}): StoredAccessTokenRecord {
  return {
    kind: "mcp_oauth_access_token_record",
    version: 1,
    accessTokenDigest: ACCESS_TOKEN_DIGEST,
    authorizationCodeDigest: AUTHORIZATION_CODE_DIGEST,
    twoweeksClerkId: OWNER_ID,
    ownerIssuer: CLERK_ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
    productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
    status: "active",
    issuedAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + 60 * 60 * 1_000,
    storageVersion: 1,
    _id: "mcpOAuthAccessTokens_fixture_stored",
    _creationTime: NOW,
    ...overrides,
  };
}

function createFakePreAuthIntent(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>> {
  if (ctx.preAuthRows.some((row) => row.preAuthHandleHash === input.preAuthHandleHash)) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: false,
      reason: "handle_collision",
      safeFailure: {
        code: "mcp_oauth_pre_auth_intent_denied",
        message: "Pre-auth intent denied.",
        safeForModel: true,
        sensitiveValuesEchoed: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const projection = input.authorizationRequestProjection;
  const optionalParameters = projection.providerForwardRequest.approvedOptionalParameters;
  const row: StoredPreAuthIntentRecord = {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash: input.preAuthHandleHash,
    authorizationPageOrigin: projection.authorizationPage.origin,
    authorizationPagePath: projection.authorizationPage.path,
    responseType: "code",
    clientId: projection.providerForwardRequest.clientId,
    redirectUri: projection.providerForwardRequest.redirectUri,
    resource: projection.providerForwardRequest.resource,
    scopes: [...projection.providerForwardRequest.scopes],
    state: projection.providerForwardRequest.state,
    codeChallenge: projection.providerForwardRequest.pkce.codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters ? { approvedOptionalParameters: optionalParameters } : {}),
    providerValidationStatus: "pending",
    status: "pre_auth_pending",
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + 10 * 60 * 1_000,
    storageVersion: 1,
    _id: `mcpOAuthPreAuthIntents_fixture_${ctx.preAuthRows.length + 1}`,
    _creationTime: NOW,
  };
  ctx.preAuthRows.push(row);

  return Promise.resolve({
    kind: "mcp_oauth_pre_auth_intent_create_result",
    ok: true,
    reason: "created",
    serverOnly: {
      status: "pre_auth_pending",
      expiresAt: row.expiresAt,
      containsOwnerIdentity: false,
      containsProviderSubject: false,
      containsAccountLinkId: false,
      authorizationGranted: false,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function bindFakePreAuthIntentToAuthenticatedOwner(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>> {
  if (ctx.subject === null) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "unauthenticated",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (
    input.authenticatedOwnerIdentity.subject !== ctx.subject ||
    input.authenticatedOwnerIdentity.issuer !== CLERK_ISSUER
  ) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "not_found_or_forbidden",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const rows = ctx.preAuthRows.filter((row) => row.preAuthHandleHash === input.preAuthHandleHash);
  if (rows.length === 0) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "not_found_or_forbidden",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (rows.length > 1) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "duplicate_pre_auth_record",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const row = rows[0];
  if (row.status === "claimed") {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "already_claimed",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (row.status === "expired" || input.now >= row.expiresAt) {
    row.status = "expired";
    row.updatedAt = input.now;
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "expired",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  row.status = "claimed";
  row.updatedAt = input.now;
  row.claimedAt = input.now;
  ctx.authorizationRows.push(ownerBoundIntentFromPreAuthRow(ctx, row, input.now));
  return Promise.resolve({
    kind: "mcp_oauth_pre_auth_owner_binding_result",
    ok: true,
    reason: "bound",
    serverOnly: {
      ownerBoundIntent: {
        status: "pending",
        expiresAt: input.now + 10 * 60 * 1_000,
        version: 1,
      },
      preAuthIntent: {
        status: "claimed",
        version: 1,
      },
      trustedOwner: {
        kind: "mcp_oauth_authorization_trusted_owner",
        twoweeksClerkId: ctx.subject,
        version: 1,
      },
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function ownerBoundIntentFromPreAuthRow(
  ctx: ReturnType<typeof makeCtx>,
  row: StoredPreAuthIntentRecord,
  now: number,
): StoredAuthorizationIntentRecord {
  return {
    kind: "mcp_oauth_authorization_intent_record",
    version: 1,
    intentHandleHash: row.preAuthHandleHash,
    twoweeksClerkId: ctx.subject ?? OWNER_ID,
    authorizationPageOrigin: row.authorizationPageOrigin,
    authorizationPagePath: row.authorizationPagePath,
    responseType: "code",
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    resource: row.resource,
    scopes: [...row.scopes],
    state: row.state,
    codeChallenge: row.codeChallenge,
    codeChallengeMethod: "S256",
    ...(row.approvedOptionalParameters ? { approvedOptionalParameters: row.approvedOptionalParameters } : {}),
    providerValidationStatus: "pending",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 10 * 60 * 1_000,
    storageVersion: 1,
    _id: `mcpOAuthAuthorizationIntents_fixture_${ctx.authorizationRows.length + 1}`,
    _creationTime: NOW,
  };
}

function consumeFakeAuthorizationIntent(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["consumeAuthorizationIntent"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["consumeAuthorizationIntent"]>> {
  const rows = ctx.authorizationRows.filter((row) => row.intentHandleHash === input.intentHandleHash);
  if (rows.length !== 1) return Promise.resolve(safeAuthorizationIntentConsumeFailure("not_found_or_forbidden"));
  const row = rows[0];
  if (row.twoweeksClerkId !== input.trustedOwner.twoweeksClerkId) {
    return Promise.resolve(safeAuthorizationIntentConsumeFailure("not_found_or_forbidden"));
  }
  if (row.status === "consumed") return Promise.resolve(safeAuthorizationIntentConsumeFailure("already_consumed"));
  if (row.status === "expired" || input.now >= row.expiresAt) {
    row.status = "expired";
    row.updatedAt = input.now;
    return Promise.resolve(safeAuthorizationIntentConsumeFailure("expired"));
  }
  row.status = "consumed";
  row.updatedAt = input.now;
  row.consumedAt = input.now;
  return Promise.resolve({
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: true,
    reason: "consumed",
    serverOnly: {
      authorizationRequestHandoff: authorizationHandoff(row),
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function createFakeAuthorizationCode(
  ctx: ReturnType<typeof makeCtx>,
  input: McpOAuthProductionAuthorizationCodeCreatePortInputV1,
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createAuthorizationCode"]>> {
  if (ctx.authorizationCodeRows.some((row) => row.authorizationCodeDigest === input.authorizationCodeDigest)) {
    return Promise.resolve({
      kind: "mcp_oauth_authorization_code_create_result",
      ok: false,
      reason: "digest_collision",
      safeFailure: { code: "mcp_oauth_authorization_code_denied" },
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  const row: StoredAuthorizationCodeRecord = {
    kind: "mcp_oauth_authorization_code_record",
    version: 1,
    authorizationCodeDigest: input.authorizationCodeDigest,
    twoweeksClerkId: input.trustedOwner.twoweeksClerkId,
    ownerIssuer: input.authenticatedOwnerIdentity.issuer,
    clientId: input.authorizationRequest.clientId,
    redirectUri: input.authorizationRequest.redirectUri,
    resource: input.authorizationRequest.resource,
    scopes: [...input.authorizationRequest.scopes],
    state: input.authorizationRequest.state,
    codeChallenge: input.authorizationRequest.codeChallenge,
    codeChallengeMethod: "S256",
    productionEnvironment: input.productionEnvironment,
    status: "pending",
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + 5 * 60 * 1_000,
    storageVersion: 1,
    _id: `mcpOAuthAuthorizationCodes_fixture_${ctx.authorizationCodeRows.length + 1}`,
    _creationTime: NOW,
  };
  ctx.authorizationCodeRows.push(row);
  return Promise.resolve({
    kind: "mcp_oauth_authorization_code_create_result",
    ok: true,
    reason: "created",
    serverOnly: {
      status: "pending",
      expiresAt: row.expiresAt,
      rawAuthorizationCodePersisted: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function validateFakeAuthorizationCode(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["validateAuthorizationCode"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["validateAuthorizationCode"]>> {
  const rows = ctx.authorizationCodeRows.filter((row) => row.authorizationCodeDigest === input.authorizationCodeDigest);
  if (rows.length === 0) return Promise.resolve(safeAuthorizationCodeValidateFailure("not_found_or_forbidden"));
  if (rows.length > 1) return Promise.resolve(safeAuthorizationCodeValidateFailure("duplicate_storage_record"));
  const row = rows[0];
  if (row.clientId !== input.clientId || row.redirectUri !== input.redirectUri || row.codeChallenge !== input.codeChallenge) {
    return Promise.resolve(safeAuthorizationCodeValidateFailure("not_found_or_forbidden"));
  }
  if (row.status === "consumed") return Promise.resolve(safeAuthorizationCodeValidateFailure("already_consumed"));
  if (row.status === "expired" || input.now >= row.expiresAt) {
    return Promise.resolve(safeAuthorizationCodeValidateFailure("expired"));
  }
  return Promise.resolve({
    kind: "mcp_oauth_authorization_code_validate_result",
    ok: true,
    reason: "validated",
    serverOnly: {
      status: "pending",
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      resource: row.resource,
      scopes: [...row.scopes],
      state: row.state,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: "S256",
      productionEnvironment: row.productionEnvironment,
      expiresAt: row.expiresAt,
      codeConsumed: false,
      tokenIssued: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function issueFakeAccessToken(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]>> {
  if (input.deadlineEpochMs !== input.now + 2_500 || input.timeoutMs !== 2_500) {
    return Promise.resolve(safeAccessTokenIssueFailure("invalid_input"));
  }
  const rows = ctx.authorizationCodeRows.filter((row) => row.authorizationCodeDigest === input.authorizationCodeDigest);
  if (rows.length === 0) return Promise.resolve(safeAccessTokenIssueFailure("not_found_or_forbidden"));
  if (rows.length > 1) return Promise.resolve(safeAccessTokenIssueFailure("duplicate_storage_record"));
  const row = rows[0];
  if (
    row.clientId !== input.clientId ||
    row.redirectUri !== input.redirectUri ||
    row.resource !== input.resource ||
    row.codeChallenge !== input.codeChallenge
  ) {
    return Promise.resolve(safeAccessTokenIssueFailure("not_found_or_forbidden"));
  }
  if (row.status === "consumed") return Promise.resolve(safeAccessTokenIssueFailure("already_consumed"));
  if (row.status === "expired" || input.now >= row.expiresAt) {
    row.status = "expired";
    row.updatedAt = input.now;
    return Promise.resolve(safeAccessTokenIssueFailure("expired"));
  }
  if (ctx.accessTokenRows.some((candidate) => candidate.accessTokenDigest === input.accessTokenDigest)) {
    return Promise.resolve(safeAccessTokenIssueFailure("access_token_digest_collision"));
  }

  const tokenRow: StoredAccessTokenRecord = {
    kind: "mcp_oauth_access_token_record",
    version: 1,
    accessTokenDigest: input.accessTokenDigest,
    authorizationCodeDigest: row.authorizationCodeDigest,
    twoweeksClerkId: row.twoweeksClerkId,
    ownerIssuer: row.ownerIssuer,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    resource: row.resource,
    scopes: [...row.scopes],
    productionEnvironment: row.productionEnvironment,
    status: "active",
    issuedAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + 60 * 60 * 1_000,
    storageVersion: 1,
    _id: `mcpOAuthAccessTokens_fixture_${ctx.accessTokenRows.length + 1}`,
    _creationTime: NOW,
  };
  ctx.accessTokenRows.push(tokenRow);
  row.status = "consumed";
  row.updatedAt = input.now;
  row.consumedAt = input.now;
  return Promise.resolve({
    kind: "mcp_oauth_access_token_issue_result",
    ok: true,
    reason: "issued",
    serverOnly: {
      tokenType: "Bearer",
      issuedAt: tokenRow.issuedAt,
      expiresAt: tokenRow.expiresAt,
      expiresIn: Math.floor((tokenRow.expiresAt - tokenRow.issuedAt) / 1_000),
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      resource: row.resource,
      codeChallenge: row.codeChallenge,
      scopes: [...row.scopes],
      productionEnvironment: row.productionEnvironment,
      codeConsumed: true,
      tokenIssued: true,
      tokenPersisted: true,
      rawAccessTokenPersisted: false,
      refreshTokenPersisted: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function verifyFakeAccessToken(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["verifyAccessToken"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["verifyAccessToken"]>> {
  const rows = ctx.accessTokenRows.filter((row) => row.accessTokenDigest === input.accessTokenDigest);
  if (rows.length === 0) return Promise.resolve(safeAccessTokenVerifyFailure("not_found_or_forbidden"));
  if (rows.length > 1) return Promise.resolve(safeAccessTokenVerifyFailure("duplicate_storage_record"));
  const row = rows[0];
  if (!input.allowedClientIds.includes(row.clientId)) {
    return Promise.resolve(safeAccessTokenVerifyFailure("wrong_client"));
  }
  if (row.resource !== input.resource) return Promise.resolve(safeAccessTokenVerifyFailure("wrong_resource"));
  if (!row.scopes.includes(input.requiredScope)) {
    return Promise.resolve(safeAccessTokenVerifyFailure("missing_required_scope"));
  }
  if (row.scopes.some((scope) => ![input.requiredScope, "openid", "email", "profile"].includes(scope))) {
    return Promise.resolve(safeAccessTokenVerifyFailure("unauthorized_scope_state"));
  }
  if (row.status === "expired" || input.now >= row.expiresAt) {
    return Promise.resolve(safeAccessTokenVerifyFailure("expired"));
  }
  if (row.status !== "active") return Promise.resolve(safeAccessTokenVerifyFailure("inactive"));
  return Promise.resolve({
    kind: "mcp_oauth_access_token_verify_result",
    ok: true,
    reason: "verified",
    serverOnly: {
      status: "active",
      twoweeksClerkId: row.twoweeksClerkId,
      ownerIssuer: row.ownerIssuer,
      clientId: row.clientId,
      resource: row.resource,
      scopes: [...row.scopes],
      productionEnvironment: row.productionEnvironment,
      expiresAt: row.expiresAt,
      tokenActive: true,
      tokenExpired: false,
      tokenRevoked: false,
      rawAccessTokenPersisted: false,
      rawAccessTokenEchoed: false,
      digestEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

type AccessTokenIssueSuccess = Extract<
  Awaited<ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["issueAccessToken"]>>>,
  { ok: true }
>;

function accessTokenIssueSuccess(
  serverOnlyOverrides: Partial<AccessTokenIssueSuccess["serverOnly"]> = {},
): AccessTokenIssueSuccess {
  return {
    kind: "mcp_oauth_access_token_issue_result",
    ok: true,
    reason: "issued",
    serverOnly: {
      tokenType: "Bearer",
      issuedAt: NOW,
      expiresAt: NOW + 60 * 60 * 1_000,
      expiresIn: 3_600,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      codeChallenge: PKCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
      codeConsumed: true,
      tokenIssued: true,
      tokenPersisted: true,
      rawAccessTokenPersisted: false,
      refreshTokenPersisted: false,
      version: 1,
      ...serverOnlyOverrides,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function safeAuthorizationIntentConsumeFailure(reason: string) {
  return {
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: false,
    reason,
    safeFailure: {
      code: "mcp_oauth_authorization_intent_denied",
      message: "Authorization intent denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  } as const;
}

function safeAuthorizationCodeValidateFailure(
  reason:
    | "invalid_input"
    | "invalid_code_digest"
    | "not_found_or_forbidden"
    | "malformed_storage_record"
    | "expired"
    | "already_consumed"
    | "duplicate_storage_record",
) {
  return {
    kind: "mcp_oauth_authorization_code_validate_result",
    ok: false,
    reason,
    safeFailure: {
      code: "mcp_oauth_authorization_code_denied",
      message: "Authorization code denied.",
      safeForModel: true,
      rawCodeEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  } as const;
}

function safeAccessTokenIssueFailure(
  reason:
    | "invalid_input"
    | "invalid_code_digest"
    | "invalid_access_token_digest"
    | "not_found_or_forbidden"
    | "storage_unavailable"
    | "malformed_storage_record"
    | "expired"
    | "already_consumed"
    | "duplicate_storage_record"
    | "access_token_digest_collision",
) {
  return {
    kind: "mcp_oauth_access_token_issue_result",
    ok: false,
    reason,
    safeFailure: {
      code: "mcp_oauth_authorization_code_denied",
      message: "Authorization code denied.",
      safeForModel: true,
      rawCodeEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  } as const;
}

function safeAccessTokenVerifyFailure(
  reason:
    | "invalid_input"
    | "invalid_access_token_digest"
    | "not_found_or_forbidden"
    | "storage_unavailable"
    | "malformed_storage_record"
    | "duplicate_storage_record"
    | "expired"
    | "inactive"
    | "wrong_client"
    | "wrong_resource"
    | "missing_required_scope"
    | "unauthorized_scope_state",
) {
  return {
    kind: "mcp_oauth_access_token_verify_result",
    ok: false,
    reason,
    safeFailure: {
      code: "mcp_oauth_access_token_denied",
      message: "Access token denied.",
      safeForModel: true,
      rawTokenEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  } as const;
}

function authorizationHandoff(
  row: StoredAuthorizationIntentRecord = ownerBoundIntentFromPreAuthRow(makeCtx(), {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash: HANDLE_HASH,
    authorizationPageOrigin: PROD_APP_ORIGIN,
    authorizationPagePath: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
    responseType: "code",
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
    state: STATE,
    codeChallenge: PKCE,
    codeChallengeMethod: "S256",
    providerValidationStatus: "pending",
    status: "claimed",
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + 10 * 60 * 1_000,
    storageVersion: 1,
    _id: "mcpOAuthPreAuthIntents_fixture_handoff",
    _creationTime: NOW,
  }, NOW),
): McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  return {
    authorizationPage: {
      origin: row.authorizationPageOrigin,
      path: row.authorizationPagePath,
    },
    providerForwardRequest: {
      responseType: "code",
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      resource: row.resource,
      scopes: [...row.scopes],
      state: row.state,
      pkce: {
        codeChallenge: row.codeChallenge,
        codeChallengeMethod: "S256",
      },
      ...(row.approvedOptionalParameters ? { approvedOptionalParameters: row.approvedOptionalParameters } : {}),
      version: 1,
    },
    trustedOwner: trustedOwner(row.twoweeksClerkId),
    providerValidation: {
      status: "pending",
      clientRegistrationValidated: false,
      redirectUriValidatedByProvider: false,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      stytchSubjectResolved: false,
      accountLinkCreated: false,
      version: 1,
    },
    futureIntent: {
      kind: "mcp_oauth_authorization_intent_contract",
      storage: "future_short_lived_server_store",
      preservesProviderForwardRequest: true,
      serverMustPersistBeforeLoginReturn: true,
      serverPreservedSensitiveOptionalParameters: ["login_hint", "id_token_hint"],
      modelVisible: false,
      version: 1,
    },
    loginReturn: {
      path: MCP_OAUTH_CONTINUATION_PATH,
      target: "authorization_page",
      usesClientRedirectUri: false,
      containsOwnerIdentity: false,
      sensitiveOptionalParametersInUrl: false,
      persisted: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function trustedOwner(twoweeksClerkId = OWNER_ID): McpOAuthAuthorizationTrustedOwnerV1 {
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
  };
}

function safeOwnerBindingFailure() {
  return {
    code: "mcp_oauth_pre_auth_owner_binding_denied",
    message: "Pre-auth owner binding denied.",
    safeForModel: true,
    handleEchoed: false,
    digestEchoed: false,
    identityEchoed: false,
    sensitiveValuesEchoed: false,
    version: 1,
  } as const;
}

function readConfiguredMiddleware(plugin: ReturnType<typeof createLocalMcpDevEndpointPlugin>) {
  expect(plugin).toBeTruthy();
  const middlewares = {
    use: vi.fn(),
  };
  plugin?.configureServer?.({ middlewares } as never);
  expect(middlewares.use).toHaveBeenCalledTimes(1);
  return middlewares.use.mock.calls[0]?.[0] as (
    req: { method?: string; url?: string; headers: Record<string, string | undefined>; socket?: { remoteAddress?: string } },
    res: {
      statusCode?: number;
      writableEnded?: boolean;
      setHeader: (key: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void,
  ) => void;
}

function readConfiguredPreviewMiddleware(plugin: ReturnType<typeof createLocalMcpDevEndpointPlugin>) {
  expect(plugin).toBeTruthy();
  const middlewares = {
    use: vi.fn(),
  };
  plugin?.configurePreviewServer?.({ middlewares } as never);
  expect(middlewares.use).toHaveBeenCalledTimes(1);
  return middlewares.use.mock.calls[0]?.[0] as ReturnType<typeof readConfiguredMiddleware>;
}

function invokeMiddleware(
  middleware: ReturnType<typeof readConfiguredMiddleware>,
  requestInput: { method: string; url: string; headers: Record<string, string | undefined>; remoteAddress?: string },
): Promise<Readonly<{ statusCode: number | undefined; headers: Record<string, string>; body: string; next: ReturnType<typeof vi.fn> }>> {
  const next = vi.fn();
  const headers: Record<string, string> = {};
  return new Promise((resolve) => {
    const response = {
      statusCode: undefined as number | undefined,
      writableEnded: false,
      setHeader(key: string, value: string) {
        headers[key.toLowerCase()] = value;
      },
      end(body = "") {
        response.writableEnded = true;
        resolve({
          statusCode: response.statusCode,
          headers,
          body,
          next,
        });
      },
    };
    middleware(
      {
        ...requestInput,
        socket: requestInput.remoteAddress === undefined ? {} : { remoteAddress: requestInput.remoteAddress },
      },
      response,
      () => {
        next();
        resolve({
          statusCode: response.statusCode,
          headers,
          body: "",
          next,
        });
      },
    );
  });
}

function invokeStreamingMiddleware(
  middleware: ReturnType<typeof readConfiguredMiddleware>,
  requestInput: { method: string; url: string; headers: Record<string, string | undefined>; body: string; remoteAddress?: string },
): Promise<Readonly<{ statusCode: number | undefined; headers: Record<string, string>; body: string; next: ReturnType<typeof vi.fn> }>> {
  const next = vi.fn();
  const headers: Record<string, string> = {};
  const request = Object.assign(new EventEmitter(), {
    method: requestInput.method,
    url: requestInput.url,
    headers: requestInput.headers,
    socket: { remoteAddress: requestInput.remoteAddress ?? "127.0.0.1" },
    setEncoding: vi.fn(),
    destroy: vi.fn(),
  });
  return new Promise((resolve) => {
    const response = {
      statusCode: undefined as number | undefined,
      writableEnded: false,
      setHeader(key: string, value: string) {
        headers[key.toLowerCase()] = value;
      },
      end(body = "") {
        response.writableEnded = true;
        resolve({
          statusCode: response.statusCode,
          headers,
          body,
          next,
        });
      },
    };
    middleware(request, response, () => {
      next();
      resolve({
        statusCode: response.statusCode,
        headers,
        body: "",
        next,
      });
    });
    queueMicrotask(() => {
      request.emit("data", requestInput.body);
      request.emit("end");
    });
  });
}

function prodRouteEnv(): Record<string, string> {
  return {
    MCP_OAUTH_PRODUCTION_RUNTIME: "1",
    MCP_OAUTH_PRODUCTION_APPROVED: "1",
    [MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG]: "1",
    MCP_OAUTH_PRODUCTION_RESOURCE: RESOURCE,
    MCP_OAUTH_PRODUCTION_ISSUER: PROVIDER_CONFIG.issuer,
    MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT: PROVIDER_CONFIG.providerEnvironment,
    MCP_OAUTH_PRODUCTION_CLIENT_IDS: CLIENT_ID,
    MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: PROD_APP_ORIGIN,
    MCP_OAUTH_PRODUCTION_REDIRECT_URIS: REDIRECT_URI,
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED: "1",
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS: CLIENT_ID,
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES: RESOURCE,
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS: OWNER_DIGEST,
    MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256: CONFIDENTIAL_CLIENT_SECRET_DIGEST,
    CLERK_JWT_ISSUER_DOMAIN: CLERK_ISSUER,
    CONVEX_URL: "http://127.0.0.1:3210",
    CONVEX_KEY: "convex_admin_key_fixture",
  };
}

function prodRouteEnvWithoutPrivateBetaSubjectDigests(): Record<string, string> {
  const env = prodRouteEnv();
  delete env.MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS;
  return env;
}

function expectOAuthTokenErrorResponse(
  response: Readonly<{ handled: boolean; status: number; json?: unknown }>,
  status: number,
  error: "invalid_request" | "invalid_grant" | "invalid_target",
): void {
  expect(response).toMatchObject({
    handled: true,
    status,
    json: { error },
  });
  expect(response.json).toEqual({ error });
}

function expectNoRouteLeakage(
  value: unknown,
  extraForbidden: readonly string[] = [],
  options: Readonly<{
    allowRawHandle?: boolean;
    allowAccessTokenResponse?: boolean;
    allowBearerChallenge?: boolean;
  }> = {},
): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    PROVIDER_CONFIG.provider,
    PROVIDER_CONFIG.issuer,
    PROVIDER_CONFIG.resource,
    PROVIDER_CONFIG.providerEnvironment,
    PROVIDER_CONFIG.allowedClientIds[0],
    REDIRECT_URI,
    STATE,
    PKCE,
    HANDLE_HASH,
    OWNER_ID,
    OTHER_OWNER_ID,
    "authorization_code",
    "auth_code",
    ...(options.allowAccessTokenResponse ? [] : ["access_token"]),
    "refresh_token",
    ...(options.allowBearerChallenge ? [] : ["id_token"]),
    "client_secret",
    "redirect_secret",
    "owner_should_not_echo",
    ...extraForbidden,
  ] as const) {
    expect(serialized).not.toContain(forbidden);
  }
  if (!options.allowRawHandle) expect(serialized).not.toContain(RAW_HANDLE);
}

function expectMcpBearerChallenge(response: {
  headers: Readonly<Record<string, string>>;
  json?: unknown;
}): void {
  const challenge = response.headers["WWW-Authenticate"];
  expect(challenge).toContain(
    'Bearer resource_metadata="https://mcp.twoweeks.example.test/.well-known/oauth-protected-resource/resource"',
  );
  expect(challenge).toContain(`scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`);
  const body = response.json as { _meta?: { "mcp/www_authenticate"?: readonly string[] } };
  expect(body._meta).toEqual({ "mcp/www_authenticate": [challenge] });
}

function isPlainTestRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectSourceNotToMatch(source: string, patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    expect(source).not.toMatch(pattern);
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function pkceChallenge(value: string): string {
  return createHash("sha256").update(value, "ascii").digest("base64url");
}
