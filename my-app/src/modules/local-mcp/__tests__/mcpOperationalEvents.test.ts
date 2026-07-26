import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildMcpOperationalEvent,
  classifyMcpOperationalIncident,
} from "../mcpOperationalEvents";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_MCP_DIR = resolve(__dirname, "..");

describe("mcpOperationalEvents", () => {
  it("builds a bounded redacted event without metadata or raw values", () => {
    expect(
      buildMcpOperationalEvent({
        capability: "manual_handoff",
        action: "prepare_manual_handoff",
        category: "rate_limited",
        outcome: "rate_limited",
        featureState: "enabled",
        severity: "warning",
        timeBucket: "2026-06-20T15:00Z",
      }),
    ).toEqual({
      kind: "mcp_operational_event",
      capability: "manual_handoff",
      action: "prepare_manual_handoff",
      category: "rate_limited",
      outcome: "rate_limited",
      featureState: "enabled",
      severity: "warning",
      timeBucket: "2026-06-20T15:00Z",
      incident: {
        kind: "mcp_operational_incident_classification",
        isIncident: false,
        response: "none",
        version: 1,
      },
      version: 1,
    });
  });

  it("rejects arbitrary labels, raw identifiers, URLs, and credential material", () => {
    expect(() =>
      buildMcpOperationalEvent({
        capability: "manual_handoff",
        action: "prepare_manual_handoff",
        category: "rate_limited",
        outcome: "rate_limited",
        featureState: "enabled",
        severity: "warning",
        metadata: { ownerProfileId: "user_12345" },
      }),
    ).toThrow("Invalid MCP operational event field");

    expect(() =>
      buildMcpOperationalEvent({
        capability: "outbound_egress",
        action: "evaluate_egress",
        category: "destination_invalid",
        outcome: "blocked",
        featureState: "blocked",
        severity: "error",
        timeBucket: "https://ats.example/apply?token=secret",
      }),
    ).toThrow("Unsafe MCP operational event material");

    expect(() =>
      buildMcpOperationalEvent({
        capability: "local_mcp",
        action: "authenticate",
        category: "auth_invalid",
        outcome: "blocked",
        featureState: "blocked",
        severity: "error",
        timeBucket: "2026-06-20T15:00Z",
        incidentSignal: "privacy_guard_failure",
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
      }),
    ).toThrow("Invalid MCP operational event field");
  });

  it("classifies incidents only when a bounded incident signal is explicit", () => {
    expect(
      classifyMcpOperationalIncident({ category: "unknown_external_result" }),
    ).toEqual({
      kind: "mcp_operational_incident_classification",
      isIncident: false,
      response: "none",
      version: 1,
    });

    expect(
      buildMcpOperationalEvent({
        capability: "live_external_action",
        action: "finalize_external_action",
        category: "unknown_external_result",
        outcome: "failed_closed",
        featureState: "blocked",
        severity: "critical",
        incidentSignal: "unknown_external_result_after_dispatch",
      }).incident,
    ).toEqual({
      kind: "mcp_operational_incident_classification",
      isIncident: true,
      signal: "unknown_external_result_after_dispatch",
      response: "operator_review",
      version: 1,
    });

    expect(() =>
      buildMcpOperationalEvent({
        capability: "manual_handoff",
        action: "prepare_manual_handoff",
        category: "rate_limited",
        outcome: "rate_limited",
        featureState: "enabled",
        severity: "warning",
        incidentSignal: "unknown_external_result_after_dispatch",
      }),
    ).toThrow("Invalid MCP operational incident category");
  });

  it("keeps PR83 implementation free of forbidden vendor and integration surfaces", () => {
    const checkedFiles = [
      "mcpOperationalErrorTaxonomy.ts",
      "mcpOperationalEvents.ts",
      "mcpOperationalStatus.ts",
    ];
    const forbidden = [
      /@opentelemetry|datadog|newrelic|rollbar/iu,
      /from\s+["']@sentry|import\s+["']@sentry/iu,
      /\bfetch\s*\(|XMLHttpRequest|axios\s*\./iu,
      /oauth[\s_-]+callback|token[\s_-]+exchange|refresh[\s_-]+token|revocation[\s_-]+endpoint/iu,
      /playwright|puppeteer|selenium/iu,
      /provider\s+api|provider\s+adapter|live\s+provider/iu,
      /public\s+dashboard|public\s+metrics|external\s+observability/iu,
    ];

    for (const fileName of checkedFiles) {
      const source = readFileSync(resolve(LOCAL_MCP_DIR, fileName), "utf8");
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
