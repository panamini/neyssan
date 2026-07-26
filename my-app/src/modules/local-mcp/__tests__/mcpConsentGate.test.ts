import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpConsentSafeRefusal,
  parseLocalMcpConsentGrant,
  validateLocalMcpConsentGate,
} from "../mcpConsentGate";
import { simulateLocalMcpToolsCallFixture } from "../localMcpToolsCallFixture";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../mcpConsentGate.ts");
const NOW = new Date("2026-06-12T12:00:00.000Z");

const VALID_READ_CONSENT = {
  kind: "local_mcp_consent_grant",
  granted: true,
  purposes: ["future_real_data_read"],
  grantedBy: "fixture-user",
  grantedAt: "2026-06-12T11:00:00.000Z",
  expiresAt: "2099-06-12T13:00:00.000Z",
  reason: "fixture-only consent boundary test",
  version: 1,
} as const;

const VALID_WRITE_CONSENT = {
  ...VALID_READ_CONSENT,
  purposes: ["future_write_action"],
} as const;

const VALID_CALL_REQUEST = {
  kind: "local_mcp_tools_call_fixture_request",
  method: "tools/call",
  toolName: "twoweeks.application_package.summarize",
  arguments: {
    applicationPackageRef: { id: "pkg_1" },
    rawCvText: "RAW_CV_DO_NOT_ECHO",
  },
  user: {
    userId: "fixture-user",
    sessionId: "fixture-session",
  },
  approval: {
    approved: true,
    approvedBy: "reviewer_1",
    approvedAt: "2026-06-12T11:00:00.000Z",
    reason: "fixture-only review",
    version: 1,
  },
  requestId: "request_1",
  version: 1,
} as const;

function source(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

describe("local MCP consent gate", () => {
  it("allows fixture-only preview without consent while stating no execution approval", () => {
    expect(
      validateLocalMcpConsentGate(
        {
          kind: "local_mcp_consent_gate_input",
          requestedSurface: "fixture_only",
          version: 1,
        },
        NOW,
      ),
    ).toEqual({
      kind: "local_mcp_consent_gate_result",
      allowed: true,
      requestedSurface: "fixture_only",
      reason: "fixture_only_consent_not_required",
      safeSummary: "Fixture-only preview remains fake-data-only. Consent does not approve execution.",
      version: 1,
    });
  });

  it("fails closed for missing, denied, malformed, expired, and insufficient consent", () => {
    const cases = [
      [undefined, "consent_missing"],
      [{ ...VALID_READ_CONSENT, granted: false }, "consent_denied"],
      [{ ...VALID_READ_CONSENT, token: "SECRET_DO_NOT_ECHO" }, "consent_malformed"],
      [{ ...VALID_READ_CONSENT, expiresAt: "2026-06-12T11:59:59.000Z" }, "consent_expired"],
      [{ ...VALID_READ_CONSENT, purposes: ["fixture_summary_preview"] }, "consent_insufficient"],
    ] as const;

    for (const [consent, reason] of cases) {
      const result = validateLocalMcpConsentGate(
        {
          kind: "local_mcp_consent_gate_input",
          requestedSurface: "future_real_data_read",
          ...(consent !== undefined ? { consent } : {}),
          version: 1,
        },
        NOW,
      );

      expect(result).toEqual({
        kind: "local_mcp_consent_gate_result",
        allowed: false,
        requestedSurface: "future_real_data_read",
        reason,
        safeRefusal: buildLocalMcpConsentSafeRefusal(),
        version: 1,
      });
      expect(JSON.stringify(result)).not.toContain("SECRET_DO_NOT_ECHO");
    }
  });

  it("treats consent success as a consent-only boundary, not auth or execution approval", () => {
    const result = validateLocalMcpConsentGate(
      {
        kind: "local_mcp_consent_gate_input",
        requestedSurface: "future_real_data_read",
        consent: VALID_READ_CONSENT,
        version: 1,
      },
      NOW,
    );

    expect(result).toEqual({
      kind: "local_mcp_consent_gate_result",
      allowed: true,
      requestedSurface: "future_real_data_read",
      reason: "consent_present_for_future_surface",
      safeSummary: "Consent boundary satisfied only. Auth, handler execution, and write actions remain blocked.",
      version: 1,
    });
  });

  it("parses consent grants defensively without accepting extra fields", () => {
    const parsed = parseLocalMcpConsentGrant(VALID_READ_CONSENT);
    expect(parsed).toEqual(VALID_READ_CONSENT);
    expect(parsed?.purposes).not.toBe(VALID_READ_CONSENT.purposes);
    expect(parseLocalMcpConsentGrant({ ...VALID_READ_CONSENT, rawPayload: "SECRET" })).toBeUndefined();
    expect(parseLocalMcpConsentGrant({ ...VALID_READ_CONSENT, expiresAt: "not-a-date" })).toBeUndefined();
    expect(parseLocalMcpConsentGrant({ ...VALID_READ_CONSENT, expiresAt: "June 12, 2099" })).toBeUndefined();
  });

  it("keeps consent boundary source disconnected from runtime, auth, network, and product surfaces", () => {
    const implementation = source();
    const forbiddenPatterns = [
      /@modelcontextprotocol/u,
      /@openai/u,
      /from\s+["'][^"']*(convex|components|pages|routes|openai|oauth|next\/server|react)[^"']*["']/iu,
      /registerTool/u,
      /registerResource/u,
      /StreamableHTTP/u,
      /createServer/u,
      /\.listen\(/u,
      /server\.connect/u,
      /["'`]\/mcp/u,
      /fetch\(/u,
      /axios/u,
      /undici/u,
      /WebSocket/u,
      /EventSource/u,
      /executeLocalMcpRequest/u,
      /exportFile|downloadFile|sendEmail|submitApplication|applyToJob/u,
      /access_token|refresh_token|client_secret|accountLinking/u,
    ] as const;

    for (const pattern of forbiddenPatterns) {
      expect(implementation).not.toMatch(pattern);
    }
  });
});

describe("local MCP tools/call consent boundary", () => {
  it("returns fixture-only consent refusal without echoing sensitive future-surface inputs", () => {
    const response = simulateLocalMcpToolsCallFixture({
      ...VALID_CALL_REQUEST,
      requestedSurface: "future_real_data_read",
      consent: { ...VALID_READ_CONSENT, token: "SECRET_DO_NOT_ECHO" },
    });

    expect(response).toMatchObject({
      success: false,
      error: {
        code: "consent_required",
        message: "Refused. Consent boundary blocked.",
        safeForModel: true,
      },
    });
    expect(JSON.stringify(response)).not.toContain("SECRET_DO_NOT_ECHO");
    expect(JSON.stringify(response)).not.toContain("RAW_CV_DO_NOT_ECHO");
  });

  it("threads the fixture clock through consent expiry checks", () => {
    expect(
      simulateLocalMcpToolsCallFixture(
        {
          ...VALID_CALL_REQUEST,
          requestedSurface: "future_real_data_read",
          consent: {
            ...VALID_READ_CONSENT,
            expiresAt: "2026-06-12T13:00:00.000Z",
          },
        },
        undefined,
        new Date("2026-06-12T14:00:00.000Z"),
      ),
    ).toMatchObject({ success: false, error: { code: "consent_required" } });
  });

  it("requires consent before future read surfaces but consent success still refuses auth-required surfaces", () => {
    expect(
      simulateLocalMcpToolsCallFixture({
        ...VALID_CALL_REQUEST,
        requestedSurface: "future_real_data_read",
        consent: undefined,
      }),
    ).toMatchObject({ success: false, error: { code: "consent_required" } });

    expect(
      simulateLocalMcpToolsCallFixture({
        ...VALID_CALL_REQUEST,
        requestedSurface: "future_real_data_read",
        consent: VALID_READ_CONSENT,
      }),
    ).toMatchObject({
      success: false,
      error: {
        code: "auth_required_surface_refusal",
        message: "Refused. Auth/OAuth surface blocked.",
      },
    });
  });

  it("requires consent before future write surfaces but consent success still refuses write actions", () => {
    expect(
      simulateLocalMcpToolsCallFixture({
        ...VALID_CALL_REQUEST,
        requestedSurface: "future_write_action",
        consent: { ...VALID_WRITE_CONSENT, purposes: ["fixture_summary_preview"] },
      }),
    ).toMatchObject({ success: false, error: { code: "consent_required" } });

    expect(
      simulateLocalMcpToolsCallFixture({
        ...VALID_CALL_REQUEST,
        requestedSurface: "future_write_action",
        consent: VALID_WRITE_CONSENT,
      }),
    ).toMatchObject({
      success: false,
      error: {
        code: "write_action_refusal",
        message: "Refused. Write action blocked.",
      },
    });
  });
});
