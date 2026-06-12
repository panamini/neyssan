import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpRedactedAuditEntry,
  buildLocalMcpRedactedAuditSafeRefusal,
  collectLocalMcpRedactedAuditRedactions,
  validateLocalMcpRedactedAuditEntry,
} from "../mcpRedactedAuditLog";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../mcpRedactedAuditLog.ts");

const SENSITIVE_PAYLOAD = {
  rawCvText: "RAW_CV_DO_NOT_ECHO candidate private work history",
  rawJobText: "RAW_JOB_DO_NOT_ECHO confidential job description",
  authorization: "Bearer SECRET_BEARER_DO_NOT_ECHO",
  access_token: "OAUTH_ACCESS_TOKEN_DO_NOT_ECHO",
  refreshToken: "REFRESH_TOKEN_DO_NOT_ECHO",
  clientSecret: "CLIENT_SECRET_DO_NOT_ECHO",
  sessionSecret: "SESSION_SECRET_DO_NOT_ECHO",
  privateFacts: ["PRIVATE_FACT_DO_NOT_ECHO"],
  never_use: ["NEVER_USE_FACT_DO_NOT_ECHO"],
  generatedArtifact: "GENERATED_FULL_ARTIFACT_DO_NOT_ECHO",
  clerkUserId: "user_real_123",
  convexUserId: "convex_real_123",
  email: "real-user@example.test",
} as const;

const SENSITIVE_PAYLOAD_KEYS = Object.keys(SENSITIVE_PAYLOAD);

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  "rawCvText",
  "rawJobText",
  "authorization",
  "RAW_CV_DO_NOT_ECHO",
  "RAW_JOB_DO_NOT_ECHO",
  "SECRET_BEARER_DO_NOT_ECHO",
  "OAUTH_ACCESS_TOKEN_DO_NOT_ECHO",
  "REFRESH_TOKEN_DO_NOT_ECHO",
  "CLIENT_SECRET_DO_NOT_ECHO",
  "SESSION_SECRET_DO_NOT_ECHO",
  "PRIVATE_FACT_DO_NOT_ECHO",
  "NEVER_USE_FACT_DO_NOT_ECHO",
  "GENERATED_FULL_ARTIFACT_DO_NOT_ECHO",
  "user_real_123",
  "convex_real_123",
  "real-user@example.test",
  "access_token",
  "refreshToken",
  "clientSecret",
  "sessionSecret",
  "privateFacts",
  "never_use",
  "generatedArtifact",
  "clerkUserId",
  "convexUserId",
  "email",
  "rawPayload",
] as const;

function source(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

describe("local MCP redacted audit log boundary", () => {
  it("builds fixture-only redacted audit entries without persistence or execution approval", () => {
    const entry = buildLocalMcpRedactedAuditEntry({
      eventId: "redacted-audit:consent-boundary-1",
      eventType: "consent_boundary_checked",
      occurredAt: "2026-06-12T19:30:00.000Z",
      outcome: "boundary_only",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      safeSummary: "Consent boundary checked. Redacted audit only.",
      consentBoundarySatisfied: true,
      rawPayload: SENSITIVE_PAYLOAD,
    });

    expect(entry).toMatchObject({
      kind: "local_mcp_redacted_audit_entry",
      eventId: "redacted-audit:consent-boundary-1",
      eventType: "consent_boundary_checked",
      occurredAt: "2026-06-12T19:30:00.000Z",
      outcome: "boundary_only",
      toolName: "twoweeks.application_package.summarize",
      localToolId: "local_mcp.application_package.summarize",
      safeSummary: "Consent boundary checked. Redacted audit only.",
      capabilities: {
        consent: "boundary_only",
        authProtocol: "not_evaluated",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        persistence: "none",
        productionConnector: "blocked",
        version: 1,
      },
      fixtureOnly: true,
      persisted: false,
      version: 1,
    });
    expect(validateLocalMcpRedactedAuditEntry(entry)).toMatchObject({ valid: true });
  });

  it("redacts sensitive raw payload categories without logging raw keys or values", () => {
    const entry = buildLocalMcpRedactedAuditEntry({
      eventType: "tool_call_refused",
      occurredAt: "2026-06-12T19:31:00.000Z",
      outcome: "refused",
      rawPayload: SENSITIVE_PAYLOAD,
    });
    const serialized = JSON.stringify(entry);

    expect(new Set(entry.redactions.map((redaction) => redaction.category))).toEqual(
      new Set([
        "artifact_text",
        "credential",
        "identity",
        "restricted_fact",
        "session_marker",
        "source_text",
      ]),
    );
    for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
      expect(serialized).not.toContain(fragment);
    }
    for (const key of SENSITIVE_PAYLOAD_KEYS) {
      expect(serialized).not.toContain(key);
    }
  });

  it("replaces unsafe summaries instead of logging raw CV, job, token, policy, or artifact text", () => {
    const entry = buildLocalMcpRedactedAuditEntry({
      eventType: "audit_entry_rejected",
      occurredAt: "2026-06-12T19:32:00.000Z",
      outcome: "invalid",
      safeSummary: "RAW_CV_DO_NOT_ECHO Bearer SECRET_BEARER_DO_NOT_ECHO PRIVATE_FACT_DO_NOT_ECHO",
      rawPayload: { note: "safe-looking but still raw payload" },
    });

    expect(entry.safeSummary).toBe("Redacted audit boundary event recorded. No product action executed.");
    expect(JSON.stringify(entry)).not.toContain("RAW_CV_DO_NOT_ECHO");
    expect(JSON.stringify(entry)).not.toContain("SECRET_BEARER_DO_NOT_ECHO");
    expect(JSON.stringify(entry)).not.toContain("PRIVATE_FACT_DO_NOT_ECHO");
  });

  it("does not treat ordinary words containing sid as session markers", () => {
    const safeSummary = "Consider inside and beside cases only.";
    const entry = buildLocalMcpRedactedAuditEntry({
      eventType: "tool_call_refused",
      occurredAt: "2026-06-12T19:32:30.000Z",
      outcome: "refused",
      toolName: "twoweeks.aside_tool.summarize",
      safeSummary,
      rawPayload: { note: "ordinary inside beside consider aside text" },
    });

    expect(entry.safeSummary).toBe(safeSummary);
    expect(entry.redactions).toEqual([{ category: "unknown_payload", occurrences: 1, version: 1 }]);
    expect(validateLocalMcpRedactedAuditEntry(entry)).toMatchObject({ valid: true });
  });

  it("does not treat ordinary raw payload keys containing sid as session markers", () => {
    expect(
      collectLocalMcpRedactedAuditRedactions({
        insideNote: "metadata",
        besideCase: "metadata",
        consideration: "metadata",
      }),
    ).toEqual([{ category: "unknown_payload", occurrences: 1, version: 1 }]);

    expect(
      collectLocalMcpRedactedAuditRedactions({
        sid: "opaque",
        sid_token: "opaque",
        sessionId: "opaque",
        sessionSecret: "opaque",
      }).some((redaction) => redaction.category === "session_marker"),
    ).toBe(true);
  });

  it("fails closed when validating malformed or unsafe audit entries", () => {
    expect(validateLocalMcpRedactedAuditEntry(null)).toEqual({
      valid: false,
      reason: "malformed_audit_entry",
      safeRefusal: buildLocalMcpRedactedAuditSafeRefusal(),
      version: 1,
    });

    const malformed = {
      ...buildLocalMcpRedactedAuditEntry({
        eventType: "tool_call_refused",
        occurredAt: "2026-06-12T19:33:00.000Z",
        outcome: "refused",
      }),
      rawPayload: "must_not_be_allowed",
    };
    expect(validateLocalMcpRedactedAuditEntry(malformed)).toEqual({
      valid: false,
      reason: "malformed_audit_entry",
      safeRefusal: buildLocalMcpRedactedAuditSafeRefusal(),
      version: 1,
    });

    const unsafe = {
      ...buildLocalMcpRedactedAuditEntry({
        eventType: "tool_call_refused",
        occurredAt: "2026-06-12T19:34:00.000Z",
        outcome: "refused",
      }),
      safeSummary: "Bearer SECRET_BEARER_DO_NOT_ECHO",
    };
    expect(validateLocalMcpRedactedAuditEntry(unsafe)).toEqual({
      valid: false,
      reason: "unsafe_audit_entry",
      safeRefusal: buildLocalMcpRedactedAuditSafeRefusal(),
      version: 1,
    });
  });

  it("does not treat audit success as auth, consent, handler, data, write, persistence, or connector approval", () => {
    const entry = buildLocalMcpRedactedAuditEntry({
      eventType: "consent_boundary_checked",
      occurredAt: "2026-06-12T19:35:00.000Z",
      outcome: "boundary_only",
      rawPayload: SENSITIVE_PAYLOAD,
    });

    expect(entry.capabilities).toEqual({
      consent: "not_evaluated",
      authProtocol: "not_evaluated",
      handlerExecution: "blocked",
      dataAccess: "blocked",
      writeAction: "blocked",
      persistence: "none",
      productionConnector: "blocked",
      version: 1,
    });
    expect(entry.persisted).toBe(false);
    expect(entry.fixtureOnly).toBe(true);
  });

  it("requires strict timestamp, safe event id, and safe tool metadata", () => {
    expect(() =>
      buildLocalMcpRedactedAuditEntry({
        eventType: "tool_call_refused",
        occurredAt: "June 12, 2026",
        outcome: "refused",
      }),
    ).toThrow(/timestamp/u);
    expect(() =>
      buildLocalMcpRedactedAuditEntry({
        eventId: "request-user_real_123",
        eventType: "tool_call_refused",
        occurredAt: "2026-06-12T19:36:00.000Z",
        outcome: "refused",
      }),
    ).toThrow(/event id/u);
    expect(() =>
      buildLocalMcpRedactedAuditEntry({
        eventType: "tool_call_refused",
        occurredAt: "2026-06-12T19:37:00.000Z",
        outcome: "refused",
        toolName: "twoweeks.application_package.execute",
      }),
    ).toThrow(/tool name/u);
  });

  it("summarizes unknown raw payloads without echoing values", () => {
    expect(collectLocalMcpRedactedAuditRedactions({ harmless: "metadata" })).toEqual([
      { category: "unknown_payload", occurrences: 1, version: 1 },
    ]);
  });

  it("keeps the source disconnected from persistence, network, auth runtime, and product actions", () => {
    const implementation = source();
    const forbiddenPatterns = [
      /@modelcontextprotocol/u,
      /@openai/u,
      /from\s+["'][^"']*(convex|components|pages|routes|openai|next\/server|react)[^"']*["']/iu,
      /createServer/u,
      /\.listen\(/u,
      /server\.connect/u,
      /["'`]\/mcp/u,
      /fetch\(/u,
      /axios/u,
      /undici/u,
      /WebSocket/u,
      /EventSource/u,
      /insert|upsert|mutation|database|table/u,
      /executeLocalMcpRequest/u,
      /exportFile|downloadFile|sendEmail|submitApplication|applyToJob/u,
    ] as const;

    for (const pattern of forbiddenPatterns) {
      expect(implementation).not.toMatch(pattern);
    }
  });
});
