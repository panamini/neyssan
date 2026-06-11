import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpCallError,
  buildLocalMcpCallRefusalEnvelope,
  buildLocalMcpErrorToolResult,
  localToolIdToProjectedToolName,
  parseLocalMcpCallEnvelope,
  projectedToolNameToLocalToolId,
  validateLocalMcpCallEnvelope,
} from "../mcpCallEnvelope";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallErrorCodeV1,
  LocalMcpProjectedToolNameV1,
} from "../mcpCallEnvelope";
import type { LocalMcpToolIdV1, LocalMcpToolRegistryV1 } from "../schema";
import { buildLocalMcpToolRegistry } from "../toolRegistry";

const TOOL_PAIRS: readonly Readonly<{
  projectedName: LocalMcpProjectedToolNameV1;
  localToolId: LocalMcpToolIdV1;
  refField: string;
}>[] = [
  {
    projectedName: "twoweeks.application_package.summarize",
    localToolId: "local_mcp.application_package.summarize",
    refField: "applicationPackageRef",
  },
  {
    projectedName: "twoweeks.evidence_graph.summarize",
    localToolId: "local_mcp.evidence_graph.summarize",
    refField: "evidenceGraphRef",
  },
  {
    projectedName: "twoweeks.resume_variant_plan.summarize",
    localToolId: "local_mcp.resume_variant_plan.summarize",
    refField: "resumeVariantPlanRef",
  },
  {
    projectedName: "twoweeks.review_cockpit.summarize",
    localToolId: "local_mcp.review_cockpit.summarize",
    refField: "reviewCockpitRef",
  },
];

const ERROR_CODES: readonly LocalMcpCallErrorCodeV1[] = [
  "invalid_request",
  "unknown_tool",
  "invalid_tool_name",
  "invalid_arguments",
  "missing_user",
  "approval_required",
  "tool_not_allowlisted",
  "output_too_large",
  "privacy_filter_required",
  "handler_unavailable",
  "timeout",
  "rate_limited",
  "internal_error",
];

function envelope(
  overrides: Partial<LocalMcpCallEnvelopeV1> = {},
): LocalMcpCallEnvelopeV1 {
  return {
    kind: "local_mcp_call_envelope",
    toolName: "twoweeks.application_package.summarize",
    arguments: { applicationPackageRef: { id: "pkg_1" } },
    user: {
      userId: "user_1",
      sessionId: "session_1",
    },
    approval: {
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T00:00:00.000Z",
      reason: "local dry-run approval",
      version: 1,
    },
    requestId: "request_1",
    version: 1,
    ...overrides,
  };
}

function rawEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "local_mcp_call_envelope",
    toolName: "twoweeks.application_package.summarize",
    arguments: { applicationPackageRef: { id: "pkg_1" } },
    user: {
      userId: "user_1",
      sessionId: "session_1",
    },
    approval: {
      approved: true,
      approvedBy: "reviewer_1",
      approvedAt: "2026-06-11T00:00:00.000Z",
      reason: "local dry-run approval",
      version: 1,
    },
    requestId: "request_1",
    version: 1,
    ...overrides,
  };
}

describe("local MCP call envelope mapping", () => {
  it("maps each projected name to the expected local tool id", () => {
    for (const pair of TOOL_PAIRS) {
      expect(projectedToolNameToLocalToolId(pair.projectedName)).toBe(pair.localToolId);
    }
  });

  it("maps each local tool id to the expected projected name", () => {
    for (const pair of TOOL_PAIRS) {
      expect(localToolIdToProjectedToolName(pair.localToolId)).toBe(pair.projectedName);
    }
  });

  it("returns undefined for unknown projected names", () => {
    expect(projectedToolNameToLocalToolId("twoweeks.missing.summarize")).toBeUndefined();
  });
});

describe("local MCP call envelope parsing", () => {
  it("parses a valid local envelope", () => {
    expect(parseLocalMcpCallEnvelope(rawEnvelope())).toEqual(envelope());
  });

  it("defensively clones arguments, user, and approval", () => {
    const input = rawEnvelope();
    const parsed = parseLocalMcpCallEnvelope(input);
    expect(parsed).toBeDefined();
    if (!parsed) return;

    expect(parsed.arguments).not.toBe(input.arguments);
    expect(parsed.user).not.toBe(input.user);
    expect(parsed.approval).not.toBe(input.approval);

    ((input.arguments as Record<string, unknown>).applicationPackageRef as { id: string }).id = "mutated";
    (input.user as { userId: string }).userId = "mutated";
    (input.approval as { approved: boolean }).approved = false;

    expect(parsed.arguments).toEqual({ applicationPackageRef: { id: "pkg_1" } });
    expect(parsed.user.userId).toBe("user_1");
    expect(parsed.approval?.approved).toBe(true);
  });

  it("rejects protocol-shaped calls", () => {
    expect(
      parseLocalMcpCallEnvelope({
        method: "tools/call",
        name: "twoweeks.application_package.summarize",
        params: { applicationPackageRef: { id: "pkg_1" } },
        version: 1,
      }),
    ).toBeUndefined();
  });

  it("rejects missing toolName", () => {
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ toolName: "" }))).toBeUndefined();
  });

  it("rejects missing user", () => {
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ user: undefined }))).toBeUndefined();
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ user: { userId: "" } }))).toBeUndefined();
  });

  it("rejects malformed arguments", () => {
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ arguments: [] }))).toBeUndefined();
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ arguments: { ref: new Date() } }))).toBeUndefined();
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ arguments: { ref: Promise.resolve() } }))).toBeUndefined();
  });

  it("rejects version other than 1", () => {
    expect(parseLocalMcpCallEnvelope(rawEnvelope({ version: 2 }))).toBeUndefined();
  });
});

describe("local MCP call envelope validation", () => {
  it("accepts valid envelopes for each projected tool when approval is present", () => {
    for (const pair of TOOL_PAIRS) {
      const result = validateLocalMcpCallEnvelope(
        envelope({
          toolName: pair.projectedName,
          arguments: { [pair.refField]: { id: "ref_1" } },
        }),
      );

      expect(result).toEqual({
        valid: true,
        toolName: pair.projectedName,
        localToolId: pair.localToolId,
        version: 1,
      });
    }
  });

  it("requires approval for current medium-risk tools", () => {
    const result = validateLocalMcpCallEnvelope(envelope({ approval: undefined }));

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.error.code).toBe("approval_required");
  });

  it("rejects unknown projected tools", () => {
    const result = validateLocalMcpCallEnvelope(envelope({ toolName: "twoweeks.missing.summarize" }));

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.error.code).toBe("unknown_tool");
  });

  it("rejects unsafe tool names before mapping", () => {
    const result = validateLocalMcpCallEnvelope(envelope({ toolName: "twoweeks.application package.summarize" }));

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.error.code).toBe("invalid_tool_name");
  });

  it("rejects a missing user identity", () => {
    const result = validateLocalMcpCallEnvelope(envelope({ user: { userId: "" } }));

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.error.code).toBe("missing_user");
  });

  it("rejects a known mapped tool when it is absent from the registry", () => {
    const registry: LocalMcpToolRegistryV1 = {
      tools: [],
      toolIds: [],
      version: 1,
    };
    const result = validateLocalMcpCallEnvelope(envelope(), registry);

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.error.code).toBe("tool_not_allowlisted");
  });

  it("rejects wrong argument fields and extra top-level arguments", () => {
    expect(
      validateLocalMcpCallEnvelope(envelope({ arguments: { evidenceGraphRef: { id: "graph_1" } } })),
    ).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });

    expect(
      validateLocalMcpCallEnvelope(
        envelope({
          arguments: {
            applicationPackageRef: { id: "pkg_1" },
            extra: { id: "extra_1" },
          },
        }),
      ),
    ).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
  });

  it("rejects malformed ref objects", () => {
    expect(
      validateLocalMcpCallEnvelope(envelope({ arguments: { applicationPackageRef: {} } })),
    ).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
    expect(
      validateLocalMcpCallEnvelope(envelope({ arguments: { applicationPackageRef: { id: "" } } })),
    ).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
    expect(
      validateLocalMcpCallEnvelope(
        envelope({ arguments: { applicationPackageRef: { id: "pkg_1", extra: true } } }),
      ),
    ).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
  });

  it("does not mutate the input envelope or registry", () => {
    const input = envelope();
    const registry = buildLocalMcpToolRegistry();
    const beforeEnvelope = JSON.stringify(input);
    const beforeRegistry = JSON.stringify(registry);

    validateLocalMcpCallEnvelope(input, registry);

    expect(JSON.stringify(input)).toBe(beforeEnvelope);
    expect(JSON.stringify(registry)).toBe(beforeRegistry);
  });
});

describe("local MCP call errors", () => {
  it("builds stable safe-for-model errors for every code", () => {
    for (const code of ERROR_CODES) {
      const error = buildLocalMcpCallError(code);

      expect(error).toMatchObject({
        code,
        safeForModel: true,
        version: 1,
      });
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.message).not.toContain("pkg_1");
      expect(error.message.toLowerCase()).not.toContain("private");
      expect(error.message.toLowerCase()).not.toContain("never_use");
      expect(error.message.toLowerCase()).not.toContain("source");
      expect(error.retryable).toBe(code === "timeout" || code === "rate_limited");
    }
  });

  it("uses false as the default retryable value for non-retryable errors", () => {
    expect(buildLocalMcpCallError("unknown_tool").retryable).toBe(false);
    expect(buildLocalMcpCallError("timeout").retryable).toBe(true);
    expect(buildLocalMcpCallError("unknown_tool", { retryable: true }).retryable).toBe(true);
  });

  it("builds an MCP-like but non-protocol error result", () => {
    const error = buildLocalMcpCallError("unknown_tool");
    const result = buildLocalMcpErrorToolResult(error);

    expect(result).toEqual({
      kind: "local_mcp_call_error_result",
      content: [{ type: "text", text: "The requested tool is not available." }],
      structuredContent: {
        error: {
          code: "unknown_tool",
          retryable: false,
          version: 1,
        },
        version: 1,
      },
      isError: true,
      version: 1,
    });
    expect(JSON.stringify(result)).not.toContain("pkg_1");
  });

  it("builds refusal envelopes without executing the tool", () => {
    const error = buildLocalMcpCallError("approval_required");

    expect(buildLocalMcpCallRefusalEnvelope("twoweeks.application_package.summarize", error)).toEqual({
      success: false,
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      result: buildLocalMcpErrorToolResult(error),
      error,
      version: 1,
    });
  });
});

describe("local MCP call envelope scope guards", () => {
  it("keeps PR19 out of protocol, transport, server, and product boundaries", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/modules/local-mcp/mcpCallEnvelope.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'].*convex/i);
    expect(source).not.toMatch(/from\s+["'].*(?:app|pages|components)\//i);
    expect(source).not.toContain("controlled-ats-scout");
    expect(source).not.toContain("tools/call");
    expect(source).not.toContain("jsonrpc");
    expect(source).not.toContain("params");
    expect(source).not.toMatch(/\bfetch\b|\baxios\b|\bundici\b|\bhttp\b|\bwebsocket\b|\bsse\b|\boauth\b/i);
    expect(source).not.toMatch(/\bfunction\s+(?:execute|handle|serve|route|transport)/i);
    expect(source).not.toMatch(/\bconst\s+(?:execute|handler|server|transport|router)\b/i);
  });
});
