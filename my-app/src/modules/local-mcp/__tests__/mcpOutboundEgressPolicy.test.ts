import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";
import { createMcpWriteActionProposal } from "../mcpWriteActionFramework";
import {
  assertMcpOutboundEgressAllowed,
  createMcpBlockedOutboundEgressResult,
  createMcpOutboundEgressPolicy,
  evaluateMcpOutboundEgressRequest,
  McpOutboundEgressBlockedError,
  normalizeMcpOutboundDestination,
  redactMcpOutboundUrlForAudit,
  type McpOutboundEgressAllowlistRuleV1,
  type McpOutboundEgressRequestV1,
} from "../mcpOutboundEgressPolicy";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const POLICY_SOURCE_FILE = resolve(TEST_DIR, "../mcpOutboundEgressPolicy.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpOutboundEgressPolicy.test.ts");

const BASE_RULE: McpOutboundEgressAllowlistRuleV1 = {
  id: "mcp-egress-rule:allowed-api",
  host: "api.allowed.example",
  schemes: ["https"],
  methods: ["GET"],
  pathPrefixes: ["/v1/"],
  actionCategory: "send_message",
  purpose: "Send approved application material through a future controlled connector.",
  dataClasses: ["safe_summary", "destination_metadata", "audit_metadata"],
  userVisibleReason: "Allowed by explicit future connector destination policy.",
  timeoutMs: 5_000,
  maxResponseBytes: 32_768,
  version: 1,
};

function request(
  overrides: Partial<McpOutboundEgressRequestV1> = {},
): McpOutboundEgressRequestV1 {
  return {
    kind: "mcp_outbound_egress_request",
    destinationUrl: "https://api.allowed.example/v1/messages",
    method: "GET",
    actionCategory: "send_message",
    dataClasses: ["safe_summary", "destination_metadata", "audit_metadata"],
    version: 1,
    ...overrides,
  };
}

function policy(
  rules: readonly McpOutboundEgressAllowlistRuleV1[] = [BASE_RULE],
) {
  return createMcpOutboundEgressPolicy({ allowlist: rules });
}

function expectBlocked(
  input: Partial<McpOutboundEgressRequestV1>,
  reason: string,
): ReturnType<typeof evaluateMcpOutboundEgressRequest> {
  const result = evaluateMcpOutboundEgressRequest(request(input), policy());
  expect(result.allowed).toBe(false);
  if (result.allowed) throw new TypeError("expected egress decision to block");
  expect(result.reason).toBe(reason);
  expect(result.networkRequestExecuted).toBe(false);
  expect(result.externalSideEffect).toBe(false);
  expect(result.persisted).toBe(false);
  expect(result.credentialStorage).toBe("none");
  expect(result.tokenStorage).toBe("none");
  assertLocalMcpPrivacySafeOutput(result);
  return result;
}

function expectAllowed(
  input: Partial<McpOutboundEgressRequestV1> = {},
  rules: readonly McpOutboundEgressAllowlistRuleV1[] = [BASE_RULE],
): Extract<ReturnType<typeof evaluateMcpOutboundEgressRequest>, { allowed: true }> {
  const result = evaluateMcpOutboundEgressRequest(request(input), policy(rules));
  expect(result.allowed).toBe(true);
  if (!result.allowed) throw new TypeError("expected egress decision to allow");
  expect(result.allowlistRuleId).toBe(rules[0].id);
  expect(result.networkRequestExecuted).toBe(false);
  expect(result.externalSideEffect).toBe(false);
  expect(result.persisted).toBe(false);
  expect(result.credentialStorage).toBe("none");
  expect(result.tokenStorage).toBe("none");
  assertLocalMcpPrivacySafeOutput(result);
  return result;
}

function sourceFiles(): readonly string[] {
  return [POLICY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(source: string): string {
  const replacements: readonly [RegExp, string][] = [
    [/`(?:\\.|[^`\\])*`/gmu, '""'],
    [/"(?:\\.|[^"\\])*"/gmu, '""'],
    [/'(?:\\.|[^'\\])*'/gmu, '""'],
    [/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u"],
  ];
  return replacements.reduce(
    (output, [pattern, replacement]) => output.replace(pattern, replacement),
    source,
  );
}

describe("PR77 outbound egress allowlist and SSRF policy", () => {
  it("denies arbitrary outbound destinations by default", () => {
    const result = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://example.com/" }),
    );

    expect(result).toMatchObject({
      kind: "mcp_outbound_egress_decision",
      allowed: false,
      reason: "host_not_allowlisted",
      userVisibleReason: "Outbound destination is not allowlisted.",
      method: "GET",
      networkRequestExecuted: false,
      externalSideEffect: false,
      persisted: false,
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    });
    expect(result.redactedUrl).toBe("https://example.com/");
    assertLocalMcpPrivacySafeOutput(result);
  });

  it("allows only exact host, scheme, method, and path matches", () => {
    const result = expectAllowed();

    expect(result).toMatchObject({
      allowed: true,
      reason: "allowlist_rule_matched",
      normalizedDestination: {
        kind: "mcp_outbound_egress_destination",
        scheme: "https",
        host: "api.allowed.example",
        origin: "https://api.allowed.example",
        pathClassification: "allowlisted_path_prefix",
        version: 1,
      },
      method: "GET",
      actionCategory: "send_message",
      dataClasses: ["safe_summary", "destination_metadata", "audit_metadata"],
      redirectPolicy: {
        mode: "disabled",
        maxRedirects: 0,
        redirectsFollowed: 0,
        version: 1,
      },
    });
    expect(result.redactedUrl).toBe("https://api.allowed.example/v1/messages");
    expect(result.timeoutMs).toBe(5_000);
    expect(result.maxResponseBytes).toBe(32_768);

    expectBlocked(
      { destinationUrl: "https://api.allowed.example/private/messages" },
      "path_not_allowlisted",
    );
    expectBlocked({ method: "POST" }, "method_not_allowlisted");
    expectBlocked(
      { destinationUrl: "http://api.allowed.example/v1/messages" },
      "unsupported_scheme",
    );
  });

  it("does not let audit path redaction satisfy path allowlist matching", () => {
    const redactedPathRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:redacted-path-prefix",
      pathPrefixes: ["/redacted-path"],
    };

    const result = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://api.allowed.example/access-token" }),
      policy([redactedPathRule]),
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unsafe_output_metadata");
    expect(result.redactedUrl).toBe("https://api.allowed.example/redacted-path");
    expect(result.normalizedDestination?.path).toBe("/redacted-path");
    expect(JSON.stringify(result)).not.toContain("access-token");
    assertLocalMcpPrivacySafeOutput(result);
  });

  it("blocks unsafe policy paths before allowlist matching", () => {
    for (const destinationUrl of [
      "https://api.allowed.example/v1/SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
      "https://api.allowed.example/v1/%2e%2e%2fadmin",
    ] as const) {
      const result = evaluateMcpOutboundEgressRequest(
        request({ destinationUrl }),
        policy(),
      );
      const serialized = JSON.stringify(result);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("unsafe_output_metadata");
      expect(result.redactedUrl).toBe("https://api.allowed.example/redacted-path");
      expect(result.normalizedDestination?.path).toBe("/redacted-path");
      expect(serialized).not.toContain("SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE");
      expect(serialized).not.toContain("%2e");
      expect(serialized).not.toContain("%2f");
      assertLocalMcpPrivacySafeOutput(result);
    }
  });

  it("matches path prefixes only on segment boundaries", () => {
    const v1Rule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:v1-segment-prefix",
      pathPrefixes: ["/v1"],
    };
    const apiRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:api-segment-prefix",
      pathPrefixes: ["/api"],
    };

    expectAllowed({ destinationUrl: "https://api.allowed.example/v1" }, [v1Rule]);
    expectAllowed(
      { destinationUrl: "https://api.allowed.example/v1/messages" },
      [v1Rule],
    );

    for (const destinationUrl of [
      "https://api.allowed.example/v10/messages",
      "https://api.allowed.example/api-evil/messages",
      "https://api.allowed.example/api_private/messages",
    ] as const) {
      const result = evaluateMcpOutboundEgressRequest(
        request({ destinationUrl }),
        policy([destinationUrl.includes("/v10/") ? v1Rule : apiRule]),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("path_not_allowlisted");
      assertLocalMcpPrivacySafeOutput(result);
    }
  });

  it("requires explicit subdomain rules with real dot-boundary matching", () => {
    const subdomainRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:example-subdomains",
      host: "example.com",
      includeSubdomains: true,
      pathPrefixes: ["/"],
    };

    expectAllowed(
      { destinationUrl: "https://api.example.com/v1/messages" },
      [subdomainRule],
    );

    for (const destinationUrl of [
      "https://example.com.evil.test/v1/messages",
      "https://badexample.com/v1/messages",
      "https://evil-example.com/v1/messages",
    ] as const) {
      const result = evaluateMcpOutboundEgressRequest(
        request({ destinationUrl }),
        policy([subdomainRule]),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("host_not_allowlisted");
      assertLocalMcpPrivacySafeOutput(result);
    }

    const exactOnly = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://api.example.com/v1/messages" }),
      policy([{ ...subdomainRule, includeSubdomains: false }]),
    );
    expect(exactOnly.allowed).toBe(false);
    expect(exactOnly.reason).toBe("host_not_allowlisted");
  });

  it("blocks non-http(s) schemes and blocks http unless explicitly allowlisted", () => {
    for (const destinationUrl of [
      "file:///etc/passwd",
      "data:text/plain,hello",
      "blob:https://api.allowed.example/id",
      "javascript:alert(1)",
      "ftp://api.allowed.example/v1/messages",
      "gopher://api.allowed.example/v1/messages",
      ["ws", "://api.allowed.example/v1/messages"].join(""),
      "wss://api.allowed.example/v1/messages",
      "mailto:user@example.test",
    ] as const) {
      expectBlocked({ destinationUrl }, "unsupported_scheme");
    }

    expectBlocked(
      { destinationUrl: "http://api.allowed.example/v1/messages" },
      "unsupported_scheme",
    );

    const httpRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:http-explicit",
      schemes: ["http"],
    };
    expectAllowed(
      { destinationUrl: "http://api.allowed.example/v1/messages" },
      [httpRule],
    );
  });

  it("rejects non-default ports before future outbound execution", () => {
    expectAllowed({ destinationUrl: "https://api.allowed.example:443/v1/messages" });

    const httpsNonDefault = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://api.allowed.example:444/v1/messages" }),
      policy(),
    );
    expect(httpsNonDefault.allowed).toBe(false);
    expect(httpsNonDefault.reason).toBe("port_not_allowlisted");
    expect(httpsNonDefault.redactedUrl).toBe(
      "https://api.allowed.example:444/v1/messages",
    );
    assertLocalMcpPrivacySafeOutput(httpsNonDefault);

    const httpRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:http-default-port",
      schemes: ["http"],
    };
    expectAllowed(
      { destinationUrl: "http://api.allowed.example:80/v1/messages" },
      [httpRule],
    );

    const httpNonDefault = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "http://api.allowed.example:8080/v1/messages" }),
      policy([httpRule]),
    );
    expect(httpNonDefault.allowed).toBe(false);
    expect(httpNonDefault.reason).toBe("port_not_allowlisted");
    expect(httpNonDefault.redactedUrl).toBe(
      "http://api.allowed.example:8080/v1/messages",
    );
    assertLocalMcpPrivacySafeOutput(httpNonDefault);

    const explicitZeroPort = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://api.allowed.example:0/v1/messages" }),
      policy(),
    );
    expect(explicitZeroPort.allowed).toBe(false);
    expect(explicitZeroPort.reason).toBe("port_not_allowlisted");
    expect(explicitZeroPort.normalizedDestination?.port).toBe(0);
    assertLocalMcpPrivacySafeOutput(explicitZeroPort);
  });

  it("rejects duplicate allowlist rule ids", () => {
    expect(() =>
      createMcpOutboundEgressPolicy({
        allowlist: [
          BASE_RULE,
          {
            ...BASE_RULE,
            schemes: ["http"],
          },
        ],
      }),
    ).toThrow(TypeError);
  });

  it("blocks URLs with embedded credentials", () => {
    const result = expectBlocked(
      { destinationUrl: "https://user:pass@api.allowed.example/v1/messages" },
      "credentials_in_url",
    );

    expect(JSON.stringify(result)).not.toContain("user:pass");
  });

  it.each([
    ["http://localhost", "localhost_blocked"],
    ["http://localhost.", "localhost_blocked"],
    ["http://foo.localhost", "localhost_blocked"],
    ["http://127.0.0.1", "localhost_blocked"],
    ["http://127.1", "localhost_blocked"],
    ["http://0.0.0.0", "reserved_ip_blocked"],
    ["http://10.0.0.1", "private_network_blocked"],
    ["http://172.16.0.1", "private_network_blocked"],
    ["http://172.31.255.255", "private_network_blocked"],
    ["http://192.168.1.1", "private_network_blocked"],
    ["http://169.254.169.254", "metadata_endpoint_blocked"],
    ["http://[::1]", "localhost_blocked"],
    ["http://[fe80::1]", "link_local_blocked"],
    ["http://[fc00::1]", "private_network_blocked"],
    ["http://[::ffff:127.0.0.1]", "localhost_blocked"],
    ["http://[::ffff:10.0.0.1]", "private_network_blocked"],
    ["http://[::ffff:192.168.1.1]", "private_network_blocked"],
  ] as const)(
    "blocks SSRF-sensitive destination %s",
    (destinationUrl, reason) => {
      const result = expectBlocked({ destinationUrl }, reason);
      expect(result.networkRequestExecuted).toBe(false);
    },
  );

  it("blocks deterministic cloud metadata endpoints", () => {
    for (const destinationUrl of [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/",
      "https://metadata.google.internal/",
    ] as const) {
      const result = evaluateMcpOutboundEgressRequest(
        request({ destinationUrl }),
        policy([
          {
            ...BASE_RULE,
            host: "metadata.google.internal",
            schemes: ["https", "http"],
            pathPrefixes: ["/"],
          },
        ]),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("metadata_endpoint_blocked");
      assertLocalMcpPrivacySafeOutput(result);
    }
  });

  it("enforces method policy before future send/apply behavior can execute", () => {
    expectBlocked({ method: "POST" }, "method_not_allowlisted");

    const postRule: McpOutboundEgressAllowlistRuleV1 = {
      ...BASE_RULE,
      id: "mcp-egress-rule:post-allowed",
      methods: ["POST"],
    };
    const allowed = expectAllowed({ method: "post" }, [postRule]);
    expect(allowed.method).toBe("POST");
    expect(allowed.networkRequestExecuted).toBe(false);
  });

  it("models redirects as disabled and not followed by default", () => {
    const result = expectAllowed({
      redirectPolicy: { mode: "disabled", maxRedirects: 0, version: 1 },
    });

    expect(result.redirectPolicy).toEqual({
      mode: "disabled",
      maxRedirects: 0,
      redirectsFollowed: 0,
      version: 1,
    });

    expectBlocked(
      { redirectPolicy: { mode: "follow", maxRedirects: 1, version: 1 } },
      "redirects_disabled",
    );
  });

  it("redacts query, headers, bodies, secrets, raw artifacts, and private facts from decisions", () => {
    const result = expectAllowed({
      destinationUrl:
        "https://api.allowed.example/v1/messages?access_token=SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE&rawResume=RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
      headers: {
        Authorization: "Bearer SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
        Cookie: "sid=SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
        "X-Refresh-Token": "refresh_token=SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
      },
      bodyPreview:
        "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE NEVER_USE_SENTINEL_DO_NOT_EXPOSE SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE",
    });

    const serialized = JSON.stringify(result);
    expect(result.redactedUrl).toBe("https://api.allowed.example/v1/messages");
    for (const forbidden of [
      "access_token",
      "rawResume",
      "Authorization",
      "Cookie",
      "Bearer",
      "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
      "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
      "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
      "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
      "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
      "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
      "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
      "RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
    assertLocalMcpPrivacySafeOutput(result);
  });

  it("normalizes destinations and exposes only safe audit URLs", () => {
    expect(normalizeMcpOutboundDestination("https://API.ALLOWED.EXAMPLE:443/v1/messages?token=secret#frag")).toMatchObject({
      scheme: "https",
      host: "api.allowed.example",
      origin: "https://api.allowed.example",
      path: "/v1/messages",
    });
    expect(redactMcpOutboundUrlForAudit("https://api.allowed.example/v1/messages?token=secret#frag")).toBe(
      "https://api.allowed.example/v1/messages",
    );
    expect(normalizeMcpOutboundDestination("https://user:pass@example.test/")?.blockedReason).toBe(
      "credentials_in_url",
    );
    expect(redactMcpOutboundUrlForAudit("not a url")).toBe("invalid_url");
  });

  it("can be associated with a future write action without enabling execution", () => {
    const proposalResult = createMcpWriteActionProposal({
      kind: "mcp_write_action_intent",
      intentKind: "write_action",
      actionLabel: "send_application_message",
      actionCategory: "send_message",
      affectedSurface: "external_email",
      userVisibleSummary:
        "Send the approved application message to the selected destination.",
      riskLevel: "high",
      requiredConfirmationCopy:
        "I confirm this approved application message should be sent.",
      idempotencyKey: "mcp-write-action:send-application-message:077",
      rollbackPlan:
        "No external state exists in PR77; revert the enabling PR if needed.",
      dataClasses: [
        "safe_summary",
        "generated_artifact",
        "application_material",
        "destination_metadata",
        "user_confirmation",
        "audit_metadata",
      ],
      version: 1,
    });
    expect(proposalResult.allowed).toBe(true);
    if (!proposalResult.allowed) throw new TypeError("expected proposal");

    const decision = expectAllowed({
      method: "POST",
      destinationUrl: "https://api.allowed.example/v1/messages",
    }, [{ ...BASE_RULE, methods: ["POST"] }]);
    const combined = {
      proposalRef: proposalResult.proposal.proposalRef,
      actionCategory: proposalResult.proposal.actionCategory,
      egressDecision: decision,
      writeActionExecuted: false,
      networkRequestExecuted: false,
      externalSideEffect: false,
      persisted: false,
    };

    expect(combined.egressDecision.allowed).toBe(true);
    expect(combined.egressDecision.networkRequestExecuted).toBe(false);
    expect(combined.writeActionExecuted).toBe(false);
    assertLocalMcpPrivacySafeOutput(combined);
  });

  it("creates deterministic safe refusal metadata for blocked egress", () => {
    const decision = evaluateMcpOutboundEgressRequest(
      request({ destinationUrl: "https://evil-example.com/v1/messages" }),
      policy(),
    );
    const blocked = createMcpBlockedOutboundEgressResult(decision);

    expect(blocked).toMatchObject({
      kind: "mcp_outbound_egress_blocked_result",
      allowed: false,
      safeRefusal: {
        code: "mcp_outbound_egress_blocked",
        message: "Refused. Outbound egress policy blocked.",
        safeForModel: true,
        rawDataExposed: false,
        componentDataExposed: false,
        networkRequestExecuted: false,
        externalSideEffect: false,
        version: 1,
      },
      networkRequestExecuted: false,
      externalSideEffect: false,
      persisted: false,
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    });
    assertLocalMcpPrivacySafeOutput(blocked);
  });

  it("keeps PR77 source free of live network execution APIs", () => {
    const [policySource, testSource] = sourceFiles();
    const strippedPolicySource = stripStringAndPatternLiterals(policySource);

    expect(policySource).not.toMatch(
      /export\s+function\s+createMcpAllowedOutboundEgressDecision\b/u,
    );
    expect(policySource).not.toMatch(
      /from\s+["'][^"']*(?:node:http|node:https|node:dns|undici|axios|node-fetch)["']/iu,
    );
    expect(policySource).not.toMatch(
      /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
    );
    expect(strippedPolicySource).not.toMatch(
      /\b(fetch|axios|undici|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
    );
    expect(strippedPolicySource).not.toMatch(
      /\b(http|https)\.(?:request|get)\s*\(/u,
    );
    expect(strippedPolicySource).not.toMatch(/\bdns\./u);
    expect(strippedPolicySource).not.toMatch(
      /\b(writeFile|appendFile|createWriteStream|mkdir|rm|rename|unlink)\s*\(/u,
    );
    expect(strippedPolicySource).not.toMatch(
      /\b(registerTool|registerResource|tools\/call|tools\/list|window\.openai|postMessage)\b/u,
    );

    const strippedTestSource = stripStringAndPatternLiterals(testSource);
    expect(strippedTestSource).not.toMatch(/\b(fetch|axios|undici)\s*\(/u);
  });

  it("assert helper returns only allowed decisions and blocks unsafe continuation", () => {
    const allowed = assertMcpOutboundEgressAllowed(request(), policy());
    expect(allowed.allowed).toBe(true);
    expect(allowed.networkRequestExecuted).toBe(false);

    expect(() =>
      assertMcpOutboundEgressAllowed(
        request({ destinationUrl: "https://evil-example.com/v1/messages" }),
        policy(),
      ),
    ).toThrow(McpOutboundEgressBlockedError);

    try {
      assertMcpOutboundEgressAllowed(
        request({ destinationUrl: "https://evil-example.com/v1/messages" }),
        policy(),
      );
      throw new TypeError("expected outbound egress assertion to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(McpOutboundEgressBlockedError);
      if (!(error instanceof McpOutboundEgressBlockedError)) throw error;
      expect(error.decision.allowed).toBe(false);
      expect(error.decision.reason).toBe("host_not_allowlisted");
      assertLocalMcpPrivacySafeOutput(error.decision);
    }
  });
});
