import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpSafeConvexSelectorProjectionSafeRefusal,
  projectLocalMcpSafeConvexSelectorRef,
  type LocalMcpSafeConvexSelectorProjectionCandidateV1,
  type LocalMcpSafeConvexSelectorProjectionRefClassV1,
  type LocalMcpSafeConvexSelectorProjectionResultV1,
} from "../mcpSafeConvexSelectorProjectionBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpSafeConvexSelectorProjectionBoundary.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpSafeConvexSelectorProjectionBoundary.test.ts");

const REF_ID_BY_CLASS = {
  applicationPackageRef: "mcp-safe-ref:application-package:fixture-1",
  evidenceGraphRef: "mcp-safe-ref:evidence-graph:fixture-1",
  resumeVariantPlanRef: "mcp-safe-ref:resume-variant-plan:fixture-1",
  reviewCockpitRef: "mcp-safe-ref:review-cockpit:fixture-1",
} as const satisfies Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, string>;

const REF_CLASSES = Object.keys(REF_ID_BY_CLASS) as LocalMcpSafeConvexSelectorProjectionRefClassV1[];

function buildCandidate(
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1 = "applicationPackageRef",
  overrides: Partial<LocalMcpSafeConvexSelectorProjectionCandidateV1> = {},
): LocalMcpSafeConvexSelectorProjectionCandidateV1 {
  return {
    kind: "local_mcp_safe_convex_selector_projection_candidate",
    refClass,
    refId: REF_ID_BY_CLASS[refClass],
    label: "Fixture projection",
    status: "available",
    updatedAt: "2026-06-15T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function expectBlocked(candidate: unknown): void {
  const result = projectLocalMcpSafeConvexSelectorRef(candidate);
  expect(result).toEqual({
    kind: "local_mcp_safe_convex_selector_projection_result",
    allowed: false,
    reason: expect.any(String),
    safeRefusal: buildLocalMcpSafeConvexSelectorProjectionSafeRefusal(),
    capabilities: {
      selectorProjection: "blocked",
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      convexAccess: "blocked",
      credentialStorage: "none",
      version: 1,
    },
    modelVisible: false,
    fixtureOnly: true,
    version: 1,
  });
}

function expectBlockedWithoutThrowing(candidate: unknown): void {
  expect(() => expectBlocked(candidate)).not.toThrow();
}

function expectSafeResult(result: LocalMcpSafeConvexSelectorProjectionResultV1): void {
  expect(result.allowed).toBe(true);
  if (!result.allowed) throw new TypeError("Expected projection to be allowed");

  expect(result).toMatchObject({
    kind: "local_mcp_safe_convex_selector_projection_result",
    allowed: true,
    capabilities: {
      selectorProjection: "fixture_only",
      dataReads: "fixture_projection_only",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      convexAccess: "blocked",
      credentialStorage: "none",
      version: 1,
    },
    modelVisible: true,
    fixtureOnly: true,
    version: 1,
  });

  const refKeys = Object.keys(result.projection);
  expect(refKeys).toHaveLength(1);
  expect(REF_CLASSES).toContain(refKeys[0]);

  const serialized = JSON.stringify(result);
  for (const fragment of [
    "RAW_CV_TEXT",
    "RAW_JOB_TEXT",
    "RAW_PROPOSAL_TEXT",
    "raw_text",
    "rawDescription",
    "sourceText",
    "sourceJobDescription",
    "cvDocument",
    "clerkId",
    "userId",
    "sessionId",
    "providerSubject",
    "stytch_subject",
    "accessToken",
    "refreshToken",
    "rawClaims",
    "structuredShadow",
    "rawSelectorResult",
    "sourceQuotes",
    "privateFacts",
    "never_use",
    "proposalDocument",
    "real-user@example.test",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function sourceFiles(): readonly string[] {
  return [BOUNDARY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) => readFileSync(file, "utf8"));
}

function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map((match) => match[1]);
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("local MCP safe Convex selector projection boundary", () => {
  it("rejects profile-shaped payloads containing raw profile fields", () => {
    expectBlocked({
      ...buildCandidate(),
      raw_text: "RAW_CV_TEXT: confidential resume body",
      email: "real-user@example.test",
      clerkId: "clerk_real_123",
      metadata: { rawResumeText: "nested raw text" },
      cvDocument: { sections: [{ content: "full resume section" }] },
    });
  });

  it("rejects active CV snapshot-shaped payloads containing raw resume text and identity fallback data", () => {
    expectBlocked({
      ...buildCandidate("resumeVariantPlanRef"),
      title: "real-user@example.test",
      clerkId: "clerk_real_123",
      personalizationContext: {
        summary: "RAW_CV_TEXT: full resume text should never be visible",
      },
    });
  });

  it("rejects job-shaped payloads containing raw descriptions, source text, and shadow data", () => {
    expectBlocked({
      ...buildCandidate("reviewCockpitRef"),
      rawDescription: "RAW_JOB_TEXT: full job description",
      sourceText: "source quote from job posting",
      raw_text: "legacy raw job text",
      structuredShadow: {
        matched: [{ requirement: { provenance: { sourceText: "raw source quote" } } }],
      },
    });
  });

  it("rejects proposal-shaped payloads containing full generated content and source job text", () => {
    expectBlocked({
      ...buildCandidate("applicationPackageRef"),
      content: "RAW_PROPOSAL_TEXT: full proposal content",
      sections: [{ type: "text", content: "full cover letter section content" }],
      metadata: {
        sourceJobDescription: "RAW_JOB_TEXT: source job description",
        proposalDocument: { content: "generated artifact" },
      },
    });
  });

  it("rejects debug and structured shadow payloads with source quotes or restricted facts", () => {
    expectBlocked({
      ...buildCandidate("evidenceGraphRef"),
      debugPayload: {
        structuredShadow: { status: "available" },
        rawSelectorResult: { sourceQuotes: ["direct source quote"] },
        privateFacts: ["private payroll termination fact"],
        never_use: ["never_use crypto outage fact"],
      },
    });
  });

  it("rejects generic OIDC, account, user, session, and credential identifiers", () => {
    const cases = [
      { sub: "stytch_subject_real_123" },
      { accountId: "account_real_123" },
      { userId: "user_real_123" },
      { sessionId: "session_real_123" },
      { accessToken: "Bearer fixture-token" },
      { refreshToken: "refresh-token-real" },
      { idToken: "id-token-real" },
      { clientSecret: "client-secret-real" },
      { authorizationHeader: "Bearer fixture-token" },
      { cookie: "session_cookie_real" },
      { providerCredentials: "provider_credentials_real" },
      { apiKey: "api_key_real" },
      { rawClaims: { scope: "openid email profile" } },
    ] as const;

    for (const extra of cases) {
      expectBlocked({ ...buildCandidate(), ...extra });
    }
  });

  it("rejects Convex document IDs before they can become model-visible refs", () => {
    expectBlocked(buildCandidate("applicationPackageRef", { refId: "j97convexdocumentid123456789" }));
    expectBlocked({ ...buildCandidate("applicationPackageRef"), _id: "j97convexdocumentid123456789" });
    expectBlocked(
      buildCandidate("applicationPackageRef", {
        refId: "mcp-safe-ref:application-package:j97convexdocumentid123456789",
      }),
    );
    expectBlocked(
      buildCandidate("evidenceGraphRef", {
        refId: "mcp-safe-ref:evidence-graph:j97_document-id_123456789",
      }),
    );
  });

  it("rejects malformed arrays and malformed ref candidates", () => {
    expectBlocked([]);
    expectBlocked([buildCandidate()]);
    expectBlocked({ ...buildCandidate(), refClass: "profileRef" });
    expectBlocked({ ...buildCandidate(), refId: "fixture-ref-without-safe-prefix" });
    expectBlocked({ ...buildCandidate(), label: "" });
    expectBlocked({ ...buildCandidate(), status: "ready_to_apply" });
    expectBlocked({ ...buildCandidate(), updatedAt: "not-a-date" });
  });

  it("rejects hidden own properties, symbol keys, and accessors without invoking getters", () => {
    const nonEnumerableRaw = { ...buildCandidate() };
    Object.defineProperty(nonEnumerableRaw, "raw_text", {
      value: "RAW_CV_TEXT: hidden resume body",
      enumerable: false,
    });

    const symbolRaw = { ...buildCandidate() } as Record<string | symbol, unknown>;
    symbolRaw[Symbol("raw_text")] = "RAW_CV_TEXT: symbol resume body";

    const throwingGetter = { ...buildCandidate() };
    Object.defineProperty(throwingGetter, "label", {
      enumerable: true,
      get() {
        throw new Error("getter should not run");
      },
    });

    expectBlockedWithoutThrowing(nonEnumerableRaw);
    expectBlockedWithoutThrowing(symbolRaw);
    expectBlockedWithoutThrowing(throwingGetter);
  });

  it("rejects nested descriptor hazards without invoking nested accessors", () => {
    const nestedAccessor = { safe: true };
    Object.defineProperty(nestedAccessor, "raw_text", {
      enumerable: true,
      get() {
        throw new Error("nested getter should not run");
      },
    });

    const nestedNonEnumerable = { safe: true };
    Object.defineProperty(nestedNonEnumerable, "raw_text", {
      value: "RAW_CV_TEXT: hidden nested resume body",
      enumerable: false,
    });

    const nestedSymbol = { safe: true } as Record<string | symbol, unknown>;
    nestedSymbol[Symbol("raw_text")] = "RAW_CV_TEXT: symbol nested resume body";

    expectBlockedWithoutThrowing({ ...buildCandidate(), fixtureOnlyNested: nestedAccessor });
    expectBlockedWithoutThrowing({ ...buildCandidate(), fixtureOnlyNested: nestedNonEnumerable });
    expectBlockedWithoutThrowing({ ...buildCandidate(), fixtureOnlyNested: nestedSymbol });
  });

  it("rejects inherited or prototype-backed records", () => {
    expectBlocked(Object.create(buildCandidate()));

    const nestedPrototype = Object.create({ raw_text: "inherited raw text" }) as Record<string, unknown>;
    expectBlocked({ ...buildCandidate(), nestedPrototype });
  });

  it("accepts minimal safe fixture inputs for each approved projection ref class", () => {
    for (const refClass of REF_CLASSES) {
      const result = projectLocalMcpSafeConvexSelectorRef(buildCandidate(refClass));
      expectSafeResult(result);
      if (!result.allowed) throw new TypeError("Expected projection to be allowed");
      expect(Object.keys(result.projection)).toEqual([refClass]);
      expect(result.projection[refClass]).toEqual({
        id: REF_ID_BY_CLASS[refClass],
        label: "Fixture projection",
        status: "available",
        updatedAt: "2026-06-15T00:00:00.000Z",
        version: 1,
      });
    }
  });

  it("keeps accepted outputs to safe refs only", () => {
    const result = projectLocalMcpSafeConvexSelectorRef(buildCandidate("evidenceGraphRef"));
    expectSafeResult(result);
  });

  it("keeps capabilities read-only and non-executable", () => {
    const result = projectLocalMcpSafeConvexSelectorRef(buildCandidate("reviewCockpitRef"));
    expect(result.capabilities).toMatchObject({
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      convexAccess: "blocked",
      credentialStorage: "none",
    });
  });

  it("keeps the new source files disconnected from runtime imports and executable calls", () => {
    const forbiddenImportSpecifier = /^(?:convex(?:\/|$)|node:https?$|https?$|@openai(?:\/|$)|openai(?:\/|$)|@modelcontextprotocol(?:\/|$)|axios$|undici$)|(?:\/|^)(?:_generated|handlers?|oauth|tools\/list|tools\/call)(?:\/|$)|token-storage|tokenStorage|llm-runtime|model-runtime/iu;
    const forbiddenCallPatterns = [
      /\bfetch\s*\(/u,
      /\bcreateServer\s*\(/u,
      /\.listen\s*\(/u,
      /\bnew\s+WebSocket\b/u,
      /\bEventSource\s*\(/u,
      /\bctx\.(?:db|runQuery|runMutation|scheduler|auth)\b/u,
      /\b(?:query|mutation|internalQuery|internalMutation|internalAction|action)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:executeLocalMcpRequest|handleLocalMcpDevEndpointRequest)\s*\(/u,
    ] as const;

    for (const source of sourceFiles()) {
      for (const specifier of importSpecifiers(source)) {
        expect(specifier).not.toMatch(forbiddenImportSpecifier);
      }

      const executableSource = stripStringAndPatternLiterals(source);
      for (const pattern of forbiddenCallPatterns) {
        expect(executableSource).not.toMatch(pattern);
      }
    }
  });
});
