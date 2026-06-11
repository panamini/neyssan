import { describe, expect, it } from "vitest";
import approvalUxCopySource from "../mcpApprovalUxCopyFixtures.ts?raw";
import {
  LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1,
  LOCAL_MCP_CALL_ERROR_CODES_FOR_APPROVAL_UX_COPY_V1,
  LOCAL_MCP_REMOTE_TRANSPORT_BLOCK_REASONS_FOR_APPROVAL_UX_COPY_V1,
  LOCAL_MCP_TOOL_VISIBILITY_STATES_FOR_APPROVAL_UX_COPY_V1,
  assertLocalMcpApprovalUxCopyEntry,
  buildLocalMcpApprovalUxCopyFixtureOutput,
  buildLocalMcpApprovalUxCopyFixtureOutputs,
  countLocalMcpApprovalUxCopyWords,
  getLocalMcpApprovalUxCopy,
  localMcpCallErrorCodeToApprovalUxCopyKey,
  localMcpRemoteTransportBlockReasonToApprovalUxCopyKey,
  localMcpToolVisibilityStateToApprovalUxCopyKey,
} from "../mcpApprovalUxCopyFixtures";
import type {
  LocalMcpApprovalUxCopyEntryV1,
  LocalMcpApprovalUxCopyKeyV1,
} from "../mcpApprovalUxCopyFixtures";
import type { LocalMcpCallErrorCodeV1 } from "../mcpCallEnvelope";
import type { LocalMcpRemoteTransportBlockReasonV1 } from "../mcpRemoteTransportSpike";
import type { LocalMcpToolVisibilityStateV1 } from "../mcpToolVisibilityPolicy";
import {
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpPrivacyFixtureSet,
} from "../privacyRedactionFixtures";

const EXPECTED_COPY_TEXT: Readonly<Record<LocalMcpApprovalUxCopyKeyV1, string>> = {
  invalid_request: "Request blocked.",
  tool_unavailable: "Tool unavailable.",
  check_inputs: "Check inputs.",
  sign_in_required: "Sign in required.",
  approval_required: "Approval required.",
  review_first: "Review first. Nothing runs.",
  approve_tool: "Approve this tool?",
  deny: "Deny",
  denied: "Denied. Nothing ran.",
  approval_expired: "Approval expired. Try again.",
  tool_disabled: "Tool disabled.",
  too_large_input: "Input too large.",
  too_large_output: "Output too large.",
  privacy_review_required: "Privacy review required.",
  handler_unavailable: "No handler available.",
  timed_out: "Timed out. Try again.",
  rate_limited: "Slow down. Try again.",
  stopped_safely: "Stopped safely.",
  hidden: "Hidden.",
  dry_run_only: "Dry run only.",
  blocked_privacy: "Blocked. Review privacy.",
  transport_disabled: "Transport disabled.",
  remote_blocked: "Remote blocked.",
  origin_blocked: "Origin blocked.",
  host_blocked: "Host blocked.",
  auth_required: "Auth required.",
  session_expired: "Session expired.",
  invalid_limit: "Limit invalid.",
  handler_boundary_required: "Handler boundary required.",
  approval_boundary_required: "Approval boundary required.",
  audit_boundary_required: "Audit boundary required.",
  safe_summary_only: "Safe summary only.",
} as const;

const EXPECTED_CALL_ERROR_CODES: readonly LocalMcpCallErrorCodeV1[] = [
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
] as const;

const EXPECTED_TRANSPORT_BLOCK_REASONS: readonly LocalMcpRemoteTransportBlockReasonV1[] = [
  "transport_disabled",
  "production_transport_not_allowed",
  "missing_origin",
  "origin_not_allowed",
  "missing_host",
  "host_not_allowed",
  "auth_required_before_remote",
  "missing_user",
  "missing_session",
  "invalid_request_size",
  "request_too_large",
  "invalid_response_size",
  "response_too_large",
  "invalid_timeout",
  "invalid_rate_limit",
  "handler_boundary_required",
  "approval_boundary_required",
  "audit_boundary_required",
] as const;

const EXPECTED_VISIBILITY_STATES: readonly LocalMcpToolVisibilityStateV1[] = [
  "hidden",
  "listed_disabled",
  "listed_dry_run",
  "listed_requires_approval",
  "listed_ready_for_review",
  "blocked_by_privacy",
  "disabled_by_admin",
] as const;

function unsafeCopy(text: string): LocalMcpApprovalUxCopyEntryV1 {
  return {
    ...getLocalMcpApprovalUxCopy("denied"),
    text,
  };
}

function expectMappedCopy(key: LocalMcpApprovalUxCopyKeyV1): void {
  const copy = getLocalMcpApprovalUxCopy(key);
  const output = buildLocalMcpApprovalUxCopyFixtureOutput(key);

  expect(LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1).toContain(key);
  expect(copy.text).toBe(EXPECTED_COPY_TEXT[key]);
  expect(output.text).toBe(copy.text);
  expect(() => assertLocalMcpPrivacySafeOutput(output)).not.toThrow();
}

describe("local MCP approval UX copy catalog", () => {
  it("keeps a closed deterministic copy catalog with exact strings", () => {
    expect(LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1).toEqual(Object.keys(EXPECTED_COPY_TEXT));

    for (const key of LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1) {
      const copy = getLocalMcpApprovalUxCopy(key);
      expect(copy).toEqual({
        key,
        text: EXPECTED_COPY_TEXT[key],
        tone: expect.any(String),
        maxWords: expect.any(Number),
        version: 1,
      });
    }
  });

  it("builds one fixture output for every copy key", () => {
    const outputs = buildLocalMcpApprovalUxCopyFixtureOutputs();

    expect(outputs.map((output) => output.key)).toEqual(LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1);
    for (const output of outputs) {
      expect(output).toEqual({
        kind: "local_mcp_approval_ux_copy_fixture_output",
        key: output.key,
        text: EXPECTED_COPY_TEXT[output.key],
        tone: getLocalMcpApprovalUxCopy(output.key).tone,
        version: 1,
      });
    }
  });
});

describe("local MCP approval UX copy style validation", () => {
  it("counts words by whitespace while leaving attached punctuation harmless", () => {
    expect(countLocalMcpApprovalUxCopyWords("Denied. Nothing ran.")).toBe(3);
    expect(countLocalMcpApprovalUxCopyWords("Approval expired. Try again.")).toBe(4);
    expect(countLocalMcpApprovalUxCopyWords("Blocked. Review privacy.")).toBe(3);
  });

  it("keeps button copy short and without sentence periods", () => {
    const deny = getLocalMcpApprovalUxCopy("deny");

    expect(deny.tone).toBe("button");
    expect(deny.maxWords).toBe(3);
    expect(deny.text).toBe("Deny");
    expect(() => assertLocalMcpApprovalUxCopyEntry(deny)).not.toThrow();
    expect(() =>
      assertLocalMcpApprovalUxCopyEntry({
        ...deny,
        text: "Deny.",
      }),
    ).toThrow(TypeError);
  });

  it("allows only approve_tool to use a question mark", () => {
    const approve = getLocalMcpApprovalUxCopy("approve_tool");

    expect(approve).toMatchObject({
      text: "Approve this tool?",
      tone: "action",
    });
    expect(() => assertLocalMcpApprovalUxCopyEntry(approve)).not.toThrow();
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("Try again?"))).toThrow(TypeError);
  });

  it("rejects forbidden action terms and raw payload markers", () => {
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("Ready to send."))).toThrow(
      TypeError,
    );
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("Raw payload blocked."))).toThrow(
      TypeError,
    );
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("The raw value is hidden."))).toThrow(
      TypeError,
    );
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("Privacy review required.")))
      .not.toThrow();
    expect(() => assertLocalMcpApprovalUxCopyEntry(unsafeCopy("Safe summary only."))).not.toThrow();
  });
});

describe("local MCP PR19 call error copy mapping", () => {
  it("maps every call error code to a copy key", () => {
    expect(LOCAL_MCP_CALL_ERROR_CODES_FOR_APPROVAL_UX_COPY_V1).toEqual(EXPECTED_CALL_ERROR_CODES);

    for (const code of LOCAL_MCP_CALL_ERROR_CODES_FOR_APPROVAL_UX_COPY_V1) {
      expectMappedCopy(localMcpCallErrorCodeToApprovalUxCopyKey(code));
    }
  });
});

describe("local MCP PR25 visibility copy mapping", () => {
  it("maps every visibility state to a copy key", () => {
    expect(LOCAL_MCP_TOOL_VISIBILITY_STATES_FOR_APPROVAL_UX_COPY_V1).toEqual(
      EXPECTED_VISIBILITY_STATES,
    );

    for (const state of LOCAL_MCP_TOOL_VISIBILITY_STATES_FOR_APPROVAL_UX_COPY_V1) {
      expectMappedCopy(localMcpToolVisibilityStateToApprovalUxCopyKey(state));
    }
  });

  it("keeps ready-for-review copy non-executable", () => {
    const key = localMcpToolVisibilityStateToApprovalUxCopyKey("listed_ready_for_review");
    const copy = getLocalMcpApprovalUxCopy(key);

    expect(key).toBe("review_first");
    expect(copy.text).toBe("Review first. Nothing runs.");
    expect(copy.text.toLowerCase()).not.toContain("prod");
    expect(copy.text.toLowerCase()).not.toContain("ready to send");
    expect(copy.text.toLowerCase()).not.toContain("ready to apply");
  });
});

describe("local MCP PR22 transport copy mapping", () => {
  it("maps every transport block reason to a copy key", () => {
    expect(LOCAL_MCP_REMOTE_TRANSPORT_BLOCK_REASONS_FOR_APPROVAL_UX_COPY_V1).toEqual(
      EXPECTED_TRANSPORT_BLOCK_REASONS,
    );

    for (const reason of LOCAL_MCP_REMOTE_TRANSPORT_BLOCK_REASONS_FOR_APPROVAL_UX_COPY_V1) {
      expectMappedCopy(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey(reason));
    }
  });

  it("maps origin/session/size reasons to specific copy", () => {
    expect(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey("transport_disabled")).toBe(
      "transport_disabled",
    );
    expect(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey("origin_not_allowed")).toBe(
      "origin_blocked",
    );
    expect(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey("missing_session")).toBe(
      "session_expired",
    );
    expect(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey("request_too_large")).toBe(
      "too_large_input",
    );
    expect(localMcpRemoteTransportBlockReasonToApprovalUxCopyKey("response_too_large")).toBe(
      "too_large_output",
    );
  });
});

describe("local MCP approval UX copy privacy integration", () => {
  it("all default copy entries pass PR24 privacy checks", () => {
    for (const key of LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1) {
      expect(() => assertLocalMcpPrivacySafeOutput(getLocalMcpApprovalUxCopy(key))).not.toThrow();
    }
  });

  it("copy fixture outputs pass PR24 privacy checks", () => {
    for (const output of buildLocalMcpApprovalUxCopyFixtureOutputs()) {
      expect(() => assertLocalMcpPrivacySafeOutput(output)).not.toThrow();
    }
  });

  it("unsafe copy is rejected before fixture output returns", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const sentinel = fixtureSet.sentinels[0].val;
    const copy: LocalMcpApprovalUxCopyEntryV1 = {
      ...getLocalMcpApprovalUxCopy("denied"),
      text: sentinel,
    };

    expect(() => buildLocalMcpApprovalUxCopyFixtureOutput("denied", copy, fixtureSet)).toThrow(
      TypeError,
    );
  });

  it("does not leak any sentinel through catalog or fixture JSON", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const serialized = JSON.stringify({
      copy: LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1.map(getLocalMcpApprovalUxCopy),
      outputs: buildLocalMcpApprovalUxCopyFixtureOutputs(fixtureSet),
    });

    for (const sentinel of fixtureSet.sentinels) {
      expect(serialized).not.toContain(sentinel.val);
    }
  });
});

describe("local MCP approval UX copy scope guard", () => {
  it("does not import product runtimes, UI, transport, network, persistence, or SDKs", () => {
    const source = approvalUxCopySource;

    expect(source).not.toMatch(/from\s+["'][^"']*convex[^"']*["']/iu);
    expect(source).not.toMatch(/from\s+["'][^"']*(?:components|pages|routes)\/[^"']*["']/iu);
    expect(source).not.toContain("controlled-ats-scout");
    expect(source).not.toMatch(/\b(fetch|axios|undici)\b/iu);
    expect(source).not.toMatch(/\b(http|websocket|sse|oauth)\b/iu);
    expect(source).not.toMatch(
      /\bfunction\s+(?:submit|export|download|persist|handler|invoke)\b/iu,
    );
    expect(source).not.toMatch(
      /\bconst\s+(?:submit|export|download|persist|handler|invoke)\b/iu,
    );
  });
});
