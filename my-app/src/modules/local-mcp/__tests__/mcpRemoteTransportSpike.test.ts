import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import remoteTransportSource from "../mcpRemoteTransportSpike.ts?raw";
import {
  buildDisabledLocalMcpRemoteTransportConfig,
  buildNonProductionLocalMcpRemoteTransportSpikeConfig,
  isAllowedLocalMcpHost,
  isAllowedLocalMcpOrigin,
  validateLocalMcpRemoteTransportConfig,
  validateLocalMcpRemoteTransportPreflight,
} from "../mcpRemoteTransportSpike";
import type {
  LocalMcpRemoteTransportBlockReasonV1,
  LocalMcpRemoteTransportConfigV1,
  LocalMcpRemoteTransportPreflightInputV1,
} from "../mcpRemoteTransportSpike";

function nonProductionConfig(
  overrides: Partial<Record<keyof LocalMcpRemoteTransportConfigV1, unknown>> = {},
): LocalMcpRemoteTransportConfigV1 {
  return {
    ...buildNonProductionLocalMcpRemoteTransportSpikeConfig({
      allowedOrigins: ["https://mcp.twoweeks.test", "http://localhost:5173"],
      allowedHosts: ["mcp.twoweeks.test", "localhost:5173"],
    }),
    ...overrides,
  } as LocalMcpRemoteTransportConfigV1;
}

function validPreflightInput(
  config: LocalMcpRemoteTransportConfigV1 = nonProductionConfig(),
): LocalMcpRemoteTransportPreflightInputV1 {
  return {
    kind: "local_mcp_remote_transport_preflight_input",
    config,
    origin: "https://mcp.twoweeks.test",
    host: "mcp.twoweeks.test",
    userId: "user_1",
    sessionId: "session_1",
    requestSizeBytes: 128,
    expectedResponseSizeBytes: 256,
    nowMs: 1_812_716_800_000,
    version: 1,
  };
}

function expectBlockedFor(
  input: LocalMcpRemoteTransportPreflightInputV1,
  reason: LocalMcpRemoteTransportBlockReasonV1,
): void {
  const result = validateLocalMcpRemoteTransportPreflight(input);
  expect(result.status).toBe("blocked");
  expect(result.blockedReasons).toContain(reason);
  expect(result.safeSummary).not.toMatch(/user_1|session_1|mcp\.twoweeks\.test|raw|source|stack/u);
}

describe("local MCP remote transport disabled config", () => {
  it("builds a deterministic disabled config with no allowlists and all boundaries required", () => {
    const first = buildDisabledLocalMcpRemoteTransportConfig();
    const second = buildDisabledLocalMcpRemoteTransportConfig();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "local_mcp_remote_transport_config",
      mode: "disabled",
      transportKind: "none",
      authMode: "future_required",
      requireOriginValidation: true,
      requireExplicitAuthBeforeRemote: true,
      requireApprovalBoundary: true,
      requireAuditBoundary: true,
      requireHandlerBoundary: true,
      version: 1,
    });
    expect(first.allowedOrigins).toEqual([]);
    expect(first.allowedHosts).toEqual([]);
    expect(() => validateLocalMcpRemoteTransportConfig(first)).not.toThrow();
  });

  it("blocks preflight with transport_disabled", () => {
    const result = validateLocalMcpRemoteTransportPreflight({
      kind: "local_mcp_remote_transport_preflight_input",
      config: buildDisabledLocalMcpRemoteTransportConfig(),
      requestSizeBytes: 1,
      version: 1,
    });

    expect(result).toEqual({
      kind: "local_mcp_remote_transport_preflight_result",
      status: "blocked",
      blockedReasons: ["transport_disabled"],
      safeSummary: "Remote transport disabled.",
      version: 1,
    });
  });
});

describe("local MCP remote transport non-production spike config", () => {
  it("builds a deterministic non-production config with normalized allowlists", () => {
    const first = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
      allowedOrigins: ["HTTPS://MCP.TWOWEEKS.TEST", "http://localhost:5173"],
      allowedHosts: ["LOCALHOST:5173", "mcp.twoweeks.test"],
    });
    const second = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
      allowedOrigins: ["http://localhost:5173", "https://mcp.twoweeks.test"],
      allowedHosts: ["mcp.twoweeks.test", "localhost:5173"],
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      mode: "non_production_spike_only",
      transportKind: "streamable_http_design",
      authMode: "future_required",
      requireApprovalBoundary: true,
      requireAuditBoundary: true,
      requireHandlerBoundary: true,
    });
    expect(first.allowedOrigins).toEqual(["http://localhost:5173", "https://mcp.twoweeks.test"]);
    expect(first.allowedHosts).toEqual(["localhost:5173", "mcp.twoweeks.test"]);
  });

  it("requires explicit allowed origins and hosts", () => {
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: [],
        allowedHosts: ["mcp.twoweeks.test"],
      }),
    ).toThrow(/allowlists/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["https://mcp.twoweeks.test"],
        allowedHosts: [],
      }),
    ).toThrow(/allowlists/u);
  });

  it("rejects wildcard and empty origin or host allowlist entries", () => {
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["*"],
        allowedHosts: ["mcp.twoweeks.test"],
      }),
    ).toThrow(/unsafe/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["https://*.twoweeks.test"],
        allowedHosts: ["mcp.twoweeks.test"],
      }),
    ).toThrow(/unsafe/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: [""],
        allowedHosts: ["mcp.twoweeks.test"],
      }),
    ).toThrow(/unsafe/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["https://mcp.twoweeks.test"],
        allowedHosts: ["*"],
      }),
    ).toThrow(/unsafe/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["https://mcp.twoweeks.test"],
        allowedHosts: ["*.twoweeks.test"],
      }),
    ).toThrow(/unsafe/u);
    expect(() =>
      buildNonProductionLocalMcpRemoteTransportSpikeConfig({
        allowedOrigins: ["https://mcp.twoweeks.test"],
        allowedHosts: [""],
      }),
    ).toThrow(/unsafe/u);
  });

  it("does not mutate input arrays", () => {
    const allowedOrigins = ["https://mcp.twoweeks.test"];
    const allowedHosts = ["mcp.twoweeks.test"];
    const config = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
      allowedOrigins,
      allowedHosts,
    });

    allowedOrigins[0] = "https://evil.example";
    allowedHosts[0] = "evil.example";

    expect(config.allowedOrigins).toEqual(["https://mcp.twoweeks.test"]);
    expect(config.allowedHosts).toEqual(["mcp.twoweeks.test"]);
  });
});

describe("local MCP remote origin and host policy", () => {
  it("allows exact normalized origins only", () => {
    const allowedOrigins = ["https://mcp.twoweeks.test"];

    expect(isAllowedLocalMcpOrigin("HTTPS://MCP.TWOWEEKS.TEST", allowedOrigins)).toBe(true);
    expect(isAllowedLocalMcpOrigin("https://unknown.twoweeks.test", allowedOrigins)).toBe(false);
    expect(isAllowedLocalMcpOrigin("*", allowedOrigins)).toBe(false);
    expect(isAllowedLocalMcpOrigin("https://user:pass@mcp.twoweeks.test", allowedOrigins)).toBe(false);
    expect(isAllowedLocalMcpOrigin("http://mcp.twoweeks.test", allowedOrigins)).toBe(false);
  });

  it("allows localhost origins only when explicitly listed", () => {
    expect(isAllowedLocalMcpOrigin("http://localhost:5173", ["http://localhost:5173"])).toBe(true);
    expect(isAllowedLocalMcpOrigin("http://localhost:5173", ["https://mcp.twoweeks.test"])).toBe(false);
    expect(isAllowedLocalMcpOrigin("http://127.0.0.1:5173", ["http://localhost:5173"])).toBe(false);
  });

  it("allows exact normalized hosts only", () => {
    expect(isAllowedLocalMcpHost("MCP.TWOWEEKS.TEST", ["mcp.twoweeks.test"])).toBe(true);
    expect(isAllowedLocalMcpHost("unknown.twoweeks.test", ["mcp.twoweeks.test"])).toBe(false);
    expect(isAllowedLocalMcpHost("*", ["mcp.twoweeks.test"])).toBe(false);
    expect(isAllowedLocalMcpHost("mcp.twoweeks.test.evil.example", ["mcp.twoweeks.test"])).toBe(false);
    expect(isAllowedLocalMcpHost("localhost:5173", ["mcp.twoweeks.test"])).toBe(false);
    expect(isAllowedLocalMcpHost("localhost:5173", ["localhost:5173"])).toBe(true);
  });

  it("normalizes hosts through URL parsing for IDNA and default ports", () => {
    const config = buildNonProductionLocalMcpRemoteTransportSpikeConfig({
      allowedOrigins: ["https://mcp.twoweeks.test"],
      allowedHosts: ["☃.example", "mcp.twoweeks.test:443"],
    });

    expect(config.allowedHosts).toEqual(["mcp.twoweeks.test", "xn--n3h.example"]);
    expect(isAllowedLocalMcpHost("xn--n3h.example", config.allowedHosts)).toBe(true);
    expect(isAllowedLocalMcpHost("☃.example", config.allowedHosts)).toBe(true);
    expect(isAllowedLocalMcpHost("mcp.twoweeks.test", config.allowedHosts)).toBe(true);
  });
});

describe("local MCP remote transport preflight", () => {
  it("blocks missing origin", () => {
    const { origin: _origin, ...input } = validPreflightInput();
    expectBlockedFor(input, "missing_origin");
  });

  it("blocks missing host", () => {
    const { host: _host, ...input } = validPreflightInput();
    expectBlockedFor(input, "missing_host");
  });

  it("blocks missing user", () => {
    const { userId: _userId, ...input } = validPreflightInput();
    expectBlockedFor(input, "missing_user");
  });

  it("blocks missing session", () => {
    const { sessionId: _sessionId, ...input } = validPreflightInput();
    expectBlockedFor(input, "missing_session");
  });

  it("blocks request and response sizes over configured limits", () => {
    const config = nonProductionConfig();

    expectBlockedFor(
      {
        ...validPreflightInput(config),
        requestSizeBytes: config.maxRequestBytes + 1,
      },
      "request_too_large",
    );
    expectBlockedFor(
      {
        ...validPreflightInput(config),
        expectedResponseSizeBytes: config.maxResponseBytes + 1,
      },
      "response_too_large",
    );
  });

  it("blocks negative request and response sizes as invalid sizes", () => {
    expectBlockedFor(
      {
        ...validPreflightInput(),
        requestSizeBytes: -1,
      },
      "invalid_request_size",
    );
    expectBlockedFor(
      {
        ...validPreflightInput(),
        expectedResponseSizeBytes: -1,
      },
      "invalid_response_size",
    );
  });

  it("blocks invalid timeout and rate-limit policies", () => {
    expectBlockedFor(validPreflightInput(nonProductionConfig({ timeoutMs: 0 })), "invalid_timeout");
    expectBlockedFor(
      validPreflightInput(
        nonProductionConfig({
          rateLimit: {
            perUserPerMinute: 0,
            perSessionPerMinute: 6,
            globalPerMinute: 60,
          },
        }),
      ),
      "invalid_rate_limit",
    );
  });

  it("blocks malformed config allowlists without throwing", () => {
    const config = {
      ...nonProductionConfig(),
      allowedOrigins: undefined,
      allowedHosts: undefined,
    } as unknown as LocalMcpRemoteTransportConfigV1;
    const result = validateLocalMcpRemoteTransportPreflight(validPreflightInput(config));

    expect(result.status).toBe("blocked");
    expect(result.blockedReasons).toEqual(expect.arrayContaining(["origin_not_allowed", "host_not_allowed"]));
  });

  it("blocks when required approval, audit, or handler boundaries are disabled", () => {
    expectBlockedFor(
      validPreflightInput(nonProductionConfig({ requireApprovalBoundary: false })),
      "approval_boundary_required",
    );
    expectBlockedFor(
      validPreflightInput(nonProductionConfig({ requireAuditBoundary: false })),
      "audit_boundary_required",
    );
    expectBlockedFor(
      validPreflightInput(nonProductionConfig({ requireHandlerBoundary: false })),
      "handler_boundary_required",
    );
  });

  it("blocks when future remote auth is not required", () => {
    expectBlockedFor(
      validPreflightInput(nonProductionConfig({ authMode: "none_for_local_only" })),
      "auth_required_before_remote",
    );
  });

  it("returns allowed_for_non_production_spike only when every safe condition is present", () => {
    const result = validateLocalMcpRemoteTransportPreflight(validPreflightInput());

    expect(result).toEqual({
      kind: "local_mcp_remote_transport_preflight_result",
      status: "allowed_for_non_production_spike",
      blockedReasons: [],
      safeSummary: "Remote transport preflight allowed for non-production spike only.",
      version: 1,
    });
  });

  it("does not mutate config or input", () => {
    const config = nonProductionConfig();
    const input = validPreflightInput(config);
    const beforeConfig = stableSerialize(config);
    const beforeInput = stableSerialize(input);

    validateLocalMcpRemoteTransportPreflight(input);

    expect(stableSerialize(config)).toBe(beforeConfig);
    expect(stableSerialize(input)).toBe(beforeInput);
  });
});

describe("local MCP remote transport spike scope guards", () => {
  it("does not import Convex, UI routes, product scouts, network clients, or external SDKs", () => {
    expect(remoteTransportSource).not.toMatch(
      /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout)[^"']*["']/iu,
    );
    expect(remoteTransportSource).not.toMatch(/\b(fetch|axios|undici)\b/iu);
    expect(remoteTransportSource).not.toMatch(/from\s+["'][^"']*(mcp|openai|oauth)[^"']*["']/iu);
  });

  it("does not define a callable transport, route, handler, protocol, or listener runtime", () => {
    expect(remoteTransportSource).not.toMatch(
      /\bfunction\s+(startServer|createServer|listen|serve|handleRequest|router|route|toolsCall|toolsList)\b/u,
    );
    expect(remoteTransportSource).not.toMatch(/\b(jsonrpc|EventSource|WebSocket|XMLHttpRequest)\b/iu);
    expect(remoteTransportSource).not.toMatch(/\bnew\s+(Request|Response|WebSocket|EventSource)\b/u);
    expect(remoteTransportSource).not.toMatch(/\b(createServer|listen)\s*\(/u);
  });
});
