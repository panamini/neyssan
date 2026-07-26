import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpRetentionDeletionSafeRefusal,
  validateLocalMcpRetentionDeletionBoundary,
} from "../mcpRetentionDeletionBoundary";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../mcpRetentionDeletionBoundary.ts");
const NOW = new Date("2026-06-12T12:00:00.000Z");

const ACTIVE_RECORD = {
  kind: "local_mcp_retention_deletion_record",
  recordRef: "fixture-retention:summary-1",
  recordType: "fixture_summary",
  policyState: "retain_until",
  createdAt: "2026-06-12T10:00:00.000Z",
  retainUntil: "2026-06-12T13:00:00.000Z",
  version: 1,
} as const;

function source(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

describe("local MCP retention and deletion boundary", () => {
  it("allows fixture-only records that are still inside explicit retention", () => {
    expect(
      validateLocalMcpRetentionDeletionBoundary(
        {
          kind: "local_mcp_retention_deletion_input",
          record: ACTIVE_RECORD,
          version: 1,
        },
        NOW,
      ),
    ).toEqual({
      kind: "local_mcp_retention_deletion_result",
      allowed: true,
      reason: "within_retention_window",
      safeSummary: "Retention boundary satisfied for fixture-only data. No deletion or persistence action executed.",
      capabilities: {
        persistenceDeletion: "blocked",
        convexWrites: "blocked",
        authProtocol: "not_evaluated",
        consent: "not_evaluated",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        realUserData: "blocked",
        version: 1,
      },
      fixtureOnly: true,
      version: 1,
    });
  });

  it("allows ephemeral fixture records without implying persistence deletion", () => {
    const result = validateLocalMcpRetentionDeletionBoundary(
      {
        kind: "local_mcp_retention_deletion_input",
        record: {
          ...ACTIVE_RECORD,
          policyState: "fixture_ephemeral",
        },
        version: 1,
      },
      NOW,
    );

    expect(result).toMatchObject({
      allowed: true,
      reason: "fixture_ephemeral",
      capabilities: {
        persistenceDeletion: "blocked",
        convexWrites: "blocked",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        realUserData: "blocked",
      },
      fixtureOnly: true,
    });
  });

  it("fails closed for malformed, stale, expired, and deletion-requested future records", () => {
    const cases = [
      [{ ...ACTIVE_RECORD, recordRef: "user_real_123" }, "record_malformed"],
      [{ ...ACTIVE_RECORD, policyState: "stale" }, "record_stale"],
      [{ ...ACTIVE_RECORD, retainUntil: "2026-06-12T11:59:59.000Z" }, "retention_expired"],
      [{ ...ACTIVE_RECORD, policyState: "expired" }, "retention_expired"],
      [{ ...ACTIVE_RECORD, policyState: "deletion_requested", deletionRequestedAt: "2026-06-12T11:00:00.000Z" }, "deletion_requested"],
      [{ ...ACTIVE_RECORD, policyState: "deletion_completed", deletionCompletedAt: "2026-06-12T11:00:00.000Z" }, "deletion_completed"],
      [{ ...ACTIVE_RECORD, rawCvText: "RAW_CV_DO_NOT_ECHO" }, "record_malformed"],
    ] as const;

    for (const [record, reason] of cases) {
      const result = validateLocalMcpRetentionDeletionBoundary(
        {
          kind: "local_mcp_retention_deletion_input",
          record,
          version: 1,
        },
        NOW,
      );

      expect(result).toEqual({
        kind: "local_mcp_retention_deletion_result",
        allowed: false,
        reason,
        safeRefusal: buildLocalMcpRetentionDeletionSafeRefusal(),
        capabilities: {
          persistenceDeletion: "blocked",
          convexWrites: "blocked",
          authProtocol: "not_evaluated",
          consent: "not_evaluated",
          handlerExecution: "blocked",
          dataAccess: "blocked",
          writeAction: "blocked",
          realUserData: "blocked",
          version: 1,
        },
        fixtureOnly: true,
        version: 1,
      });
      expect(JSON.stringify(result)).not.toContain("RAW_CV_DO_NOT_ECHO");
      expect(JSON.stringify(result)).not.toContain("user_real_123");
    }
  });

  it("treats deletion completion as boundary evidence, not real deletion authority", () => {
    const result = validateLocalMcpRetentionDeletionBoundary(
      {
        kind: "local_mcp_retention_deletion_input",
        record: {
          ...ACTIVE_RECORD,
          policyState: "deletion_completed",
          deletionCompletedAt: "2026-06-12T11:00:00.000Z",
        },
        version: 1,
      },
      NOW,
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: "deletion_completed",
      capabilities: {
        persistenceDeletion: "blocked",
        convexWrites: "blocked",
        authProtocol: "not_evaluated",
        consent: "not_evaluated",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        realUserData: "blocked",
      },
      fixtureOnly: true,
    });
  });

  it("keeps retention and deletion source disconnected from runtime, persistence, network, auth, and product actions", () => {
    const implementation = source();
    const forbiddenSurfaceChecks = [
      { surface: "MCP SDK import", pattern: /@modelcontextprotocol/u },
      { surface: "OpenAI import", pattern: /@openai/u },
      { surface: "runtime framework import", pattern: /from\s+["'][^"']*(convex|components|pages|routes|openai|oauth|next\/server|react)[^"']*["']/iu },
      { surface: "server creation", pattern: /createServer/u },
      { surface: "listener", pattern: /\.listen\(/u },
      { surface: "transport connection", pattern: /server\.connect/u },
      { surface: "MCP route", pattern: /["'`]\/mcp/u },
      { surface: "HTTP client", pattern: /fetch\(|axios|undici/u },
      { surface: "streaming client", pattern: /WebSocket|EventSource/u },
      { surface: "Convex database", pattern: /ctx\.db/u },
      { surface: "persistence write", pattern: /\.(insert|patch|replace|delete)\(/u },
      { surface: "Convex mutation", pattern: /mutation/u },
      { surface: "tool execution", pattern: /executeLocalMcpRequest/u },
      { surface: "product write action", pattern: /exportFile|downloadFile|sendEmail|submitApplication|applyToJob/u },
      { surface: "OAuth secret", pattern: /access_token|refresh_token|client_secret|accountLinking/u },
    ] as const;

    for (const { pattern, surface } of forbiddenSurfaceChecks) {
      expect(implementation, `${surface} must stay out of PR57`).not.toMatch(pattern);
    }
  });
});
