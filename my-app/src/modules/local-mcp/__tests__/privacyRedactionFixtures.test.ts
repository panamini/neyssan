import { describe, expect, it } from "vitest";
import {
  buildLocalMcpSafeArgumentSummary,
} from "../mcpApprovalAuditBoundary";
import {
  buildLocalMcpCallError,
  buildLocalMcpErrorToolResult,
} from "../mcpCallEnvelope";
import privacyRedactionSource from "../privacyRedactionFixtures.ts?raw";
import {
  LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1,
  LOCAL_MCP_PRIVACY_FIXTURE_SCOPE_V1,
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpPrivacyFixtureSet,
  buildLocalMcpSafeTextFixtureOutput,
  buildLocalMcpUnsafeFixtureOutput,
  collectLocalMcpPrivacyLeakFindings,
  isLocalMcpPrivacyFixtureCategory,
  redactLocalMcpFixtureSentinelsFromText,
} from "../privacyRedactionFixtures";
import type {
  LocalMcpPrivacyFixtureCategoryV1,
  LocalMcpPrivacyFixtureSetV1,
} from "../privacyRedactionFixtures";

const EXPECTED_CATEGORIES: readonly LocalMcpPrivacyFixtureCategoryV1[] = [
  "private_fact",
  "never_use_fact",
  "raw_source_document",
  "raw_resume_text",
  "source_quote_dump",
  "raw_arguments",
  "secret",
  "session_detail",
  "stack_trace",
  "generated_full_text",
] as const;

function sentinelValue(
  fixtureSet: LocalMcpPrivacyFixtureSetV1,
  category: LocalMcpPrivacyFixtureCategoryV1,
): string {
  const sentinel = fixtureSet.sentinels.find((item) => item.category === category);
  if (!sentinel) throw new TypeError("missing sentinel in test fixture");
  return sentinel.val;
}

function stableSerialize(val: unknown): string {
  return JSON.stringify(val, Object.keys(flattenKeys(val)).sort());
}

function flattenKeys(val: unknown, keys: Record<string, true> = {}): Record<string, true> {
  if (!val || typeof val !== "object") return keys;
  if (Array.isArray(val)) {
    val.forEach((item) => flattenKeys(item, keys));
    return keys;
  }
  Object.keys(val as Record<string, unknown>).forEach((key) => {
    keys[key] = true;
    flattenKeys((val as Record<string, unknown>)[key], keys);
  });
  return keys;
}

describe("local MCP privacy fixture set", () => {
  it("builds deterministic fixture sentinels", () => {
    const first = buildLocalMcpPrivacyFixtureSet();
    const second = buildLocalMcpPrivacyFixtureSet();

    expect(first).toEqual(second);
    expect(first.kind).toBe("local_mcp_privacy_fixture_set");
    expect(first.version).toBe(1);
    expect(first.sentinels.map((sentinel) => sentinel.category)).toEqual(EXPECTED_CATEGORIES);
  });

  it("contains one sentinel per privacy category", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const values = fixtureSet.sentinels.map((sentinel) => sentinel.val);

    expect(LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1).toEqual(EXPECTED_CATEGORIES);
    expect(new Set(fixtureSet.sentinels.map((sentinel) => sentinel.category)).size).toBe(
      EXPECTED_CATEGORIES.length,
    );
    expect(new Set(values).size).toBe(EXPECTED_CATEGORIES.length);
    expect(values.every((value) => value.includes("DO_NOT_EXPOSE"))).toBe(true);
  });

  it("returns defensive clones", () => {
    const first = buildLocalMcpPrivacyFixtureSet();
    const second = buildLocalMcpPrivacyFixtureSet();

    expect(first.sentinels).not.toBe(second.sentinels);
    expect(first.sentinels[0]).not.toBe(second.sentinels[0]);

    (first.sentinels as { pop: () => unknown }).pop();
    (first.sentinels[0] as { val: string } | undefined)!.val = "mutated";

    expect(buildLocalMcpPrivacyFixtureSet()).toEqual(second);
  });

  it("clarifies the product privacy boundary without banning artifact generation", () => {
    expect(LOCAL_MCP_PRIVACY_FIXTURE_SCOPE_V1).toEqual({
      kind: "local_mcp_privacy_fixture_scope",
      appliesOnlyTo: [
        "local_mcp_safe_outputs",
        "outside_twoweeks_output_like_summaries",
        "safe_errors",
        "audit_safe_messages",
        "dry_run_results",
        "schema_previews",
        "diagnostic_output",
        "fixture_output",
      ],
      notGlobalProductBan: true,
      allowedFutureProductArtifactFlow: [
        "user_requested_job_search",
        "approved_career_context_and_selected_job_context",
        "complete_tailored_resume_cv_generation",
        "complete_cover_letter_generation",
        "user_view_edit_copy_export_or_send_in_dedicated_future_pr",
        "bounded_tool_results_or_artifact_refs_for_approved_integrations",
      ],
      genericSafeOutputForbiddenMaterial: EXPECTED_CATEGORIES,
      artifactBoundaryRequirement: "future_dedicated_artifact_boundary_required",
      version: 1,
    });
  });
});

describe("local MCP privacy leak detection", () => {
  it("passes a safe summary output", () => {
    const result = collectLocalMcpPrivacyLeakFindings(
      buildLocalMcpSafeTextFixtureOutput({ summary: "Risk flags only.", refIds: ["pkg_1"] }),
    );

    expect(result).toEqual({
      kind: "local_mcp_privacy_redaction_check_result",
      safe: true,
      findings: [],
      checkedPathCount: expect.any(Number),
      version: 1,
    });
    expect(result.checkedPathCount).toBeGreaterThan(0);
  });

  it("detects every sentinel in nested output values", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const unsafe = {
      content: fixtureSet.sentinels.map((sentinel, index) => ({
        type: "text",
        text: `unsafe ${index}: ${sentinel.val}`,
      })),
    };

    const result = collectLocalMcpPrivacyLeakFindings(unsafe, fixtureSet);

    expect(result.safe).toBe(false);
    expect(result.findings.map((finding) => finding.category)).toEqual(EXPECTED_CATEGORIES);
  });

  it("detects sentinel values in object keys", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const sentinel = sentinelValue(fixtureSet, "private_fact");
    const result = collectLocalMcpPrivacyLeakFindings(
      {
        structuredContent: {
          [`unsafe_${sentinel}`]: "safe value",
        },
      },
      fixtureSet,
    );

    expect(result.safe).toBe(false);
    expect(result.findings).toEqual([
      {
        category: "private_fact",
        label: "private fact sentinel",
        path: "$.structuredContent.[key#0]<key>",
        version: 1,
      },
    ]);
    expect(result.findings[0].path).not.toContain(sentinel);
  });

  it("reports stable safe paths without raw payload dumps", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const sentinel = sentinelValue(fixtureSet, "raw_arguments");
    const result = collectLocalMcpPrivacyLeakFindings(
      {
        arguments: {
          rawText: sentinel,
        },
      },
      fixtureSet,
    );

    expect(result.findings).toEqual([
      {
        category: "raw_arguments",
        label: "raw arguments sentinel",
        path: "$.arguments.rawText",
        version: 1,
      },
    ]);
    expect(JSON.stringify(result.findings)).not.toContain(sentinel);
  });

  it("handles arrays, nulls, booleans, numbers, and circular objects", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const unsafe = sentinelValue(fixtureSet, "secret");
    const circular: Record<string, unknown> = {
      items: [null, true, 42, unsafe],
    };
    circular.self = circular;

    const result = collectLocalMcpPrivacyLeakFindings(circular, fixtureSet);

    expect(result.safe).toBe(false);
    expect(result.findings).toEqual([
      {
        category: "secret",
        label: "secret sentinel",
        path: "$.items[3]",
        version: 1,
      },
    ]);
    expect(result.checkedPathCount).toBeGreaterThan(4);
  });

  it("does not mutate checked values", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const checked = {
      content: [{ type: "text", text: "Safe summary only." }],
      structuredContent: { refIds: ["pkg_1"] },
    };
    const before = stableSerialize(checked);

    collectLocalMcpPrivacyLeakFindings(checked, fixtureSet);

    expect(stableSerialize(checked)).toBe(before);
  });
});

describe("local MCP privacy assertion", () => {
  it("does not throw for safe output", () => {
    expect(() =>
      assertLocalMcpPrivacySafeOutput(
        buildLocalMcpSafeTextFixtureOutput({ summary: "Safe summary only." }),
      ),
    ).not.toThrow();
  });

  it("throws safe err for unsafe output without leaking sentinel values", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const sentinel = sentinelValue(fixtureSet, "private_fact");

    expect(() =>
      assertLocalMcpPrivacySafeOutput({ content: [{ text: sentinel }] }, fixtureSet),
    ).toThrow(TypeError);

    try {
      assertLocalMcpPrivacySafeOutput({ content: [{ text: sentinel }] }, fixtureSet);
      throw new Error("expected privacy assertion to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TypeError);
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("private_fact");
      expect(message).not.toContain(sentinel);
      expect(message).not.toContain("raw src text");
    }
  });
});

describe("local MCP privacy text redaction", () => {
  it("redacts every sentinel from text", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const text = fixtureSet.sentinels.map((sentinel) => sentinel.val).join(" | ");
    const redacted = redactLocalMcpFixtureSentinelsFromText(text, fixtureSet);

    expect(redacted).toBe(
      "[redacted:private_fact] | [redacted:never_use_fact] | [redacted:raw_source_document] | [redacted:raw_resume_text] | [redacted:source_quote_dump] | [redacted:raw_arguments] | [redacted:secret] | [redacted:session_detail] | [redacted:stack_trace] | [redacted:generated_full_text]",
    );
    for (const sentinel of fixtureSet.sentinels) {
      expect(redacted).not.toContain(sentinel.val);
    }
  });

  it("leaves safe text unchanged", () => {
    expect(redactLocalMcpFixtureSentinelsFromText("Safe summary only.")).toBe(
      "Safe summary only.",
    );
  });

  it("rejects non-string input", () => {
    expect(() => redactLocalMcpFixtureSentinelsFromText(42 as unknown as string)).toThrow(
      TypeError,
    );
  });
});

describe("local MCP safe fixture output builder", () => {
  it("builds bounded safe output", () => {
    const output = buildLocalMcpSafeTextFixtureOutput({
      status: "ready".repeat(30),
      summary: "Safe summary ".repeat(80),
      refIds: ["pkg_1"],
    });

    expect(output.kind).toBe("local_mcp_safe_text_fixture_output");
    expect(output.version).toBe(1);
    expect(output.status.length).toBeLessThanOrEqual(80);
    expect(output.summary.length).toBeLessThanOrEqual(500);
    expect(() => assertLocalMcpPrivacySafeOutput(output)).not.toThrow();
  });

  it("clones refIds and does not mutate input", () => {
    const input = {
      refIds: ["pkg_1", "pkg_2"],
    };
    const output = buildLocalMcpSafeTextFixtureOutput(input);

    expect(output.refIds).toEqual(["pkg_1", "pkg_2"]);
    expect(output.refIds).not.toBe(input.refIds);
    input.refIds.push("mutated");
    expect(output.refIds).toEqual(["pkg_1", "pkg_2"]);
  });

  it("rejects unsafe summary strings", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();

    expect(() =>
      buildLocalMcpSafeTextFixtureOutput({
        summary: sentinelValue(fixtureSet, "generated_full_text"),
      }),
    ).toThrow(TypeError);
  });
});

describe("local MCP unsafe fixture outputs", () => {
  it("builds one unsafe fixture per category", () => {
    for (const category of EXPECTED_CATEGORIES) {
      expect(buildLocalMcpUnsafeFixtureOutput(category)).toEqual(expect.any(Object));
    }
  });

  it("each unsafe fixture is detected by the privacy checker", () => {
    for (const category of EXPECTED_CATEGORIES) {
      const result = collectLocalMcpPrivacyLeakFindings(
        buildLocalMcpUnsafeFixtureOutput(category),
      );

      expect(result.safe).toBe(false);
      expect(result.findings.map((finding) => finding.category)).toContain(category);
    }
  });

  it("rejects unknown categories", () => {
    expect(isLocalMcpPrivacyFixtureCategory("private_fact")).toBe(true);
    expect(isLocalMcpPrivacyFixtureCategory("missing")).toBe(false);
    expect(() =>
      buildLocalMcpUnsafeFixtureOutput("missing" as LocalMcpPrivacyFixtureCategoryV1),
    ).toThrow(TypeError);
  });
});

describe("local MCP privacy fixtures against existing outputs", () => {
  it("confirms PR19 err tool results stay privacy safe", () => {
    const result = buildLocalMcpErrorToolResult(buildLocalMcpCallError("approval_required"));

    expect(() => assertLocalMcpPrivacySafeOutput(result)).not.toThrow();
  });

  it("confirms PR20 safe arg summaries stay privacy safe", () => {
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const rawText = sentinelValue(fixtureSet, "raw_arguments");
    const summary = buildLocalMcpSafeArgumentSummary({
      applicationPackageRef: { id: "application-package:abc" },
      rawText,
    });
    const serialized = JSON.stringify(summary);

    expect(() => assertLocalMcpPrivacySafeOutput(summary, fixtureSet)).not.toThrow();
    expect(serialized).not.toContain(rawText);
    expect(summary).toEqual({
      kind: "local_mcp_safe_argument_summary",
      fields: ["applicationPackageRef"],
      refIds: ["application-package:abc"],
      omittedRawValueCount: 1,
      version: 1,
    });
  });
});

describe("local MCP privacy fixture scope guard", () => {
  it("does not import product runtimes, UI, transport, network, persistence, or SDKs", () => {
    const src = privacyRedactionSource;
    expect(src).not.toMatch(/from\s+["'].*convex/i);
    expect(src).not.toMatch(/from\s+["'].*(?:components|pages|routes)\//i);
    expect(src).not.toContain("controlled-ats-scout");
    expect(src).not.toMatch(/\bfetch\b|\baxios\b|\bundici\b/i);
    expect(src).not.toMatch(/\bhttp\b|\bwebsocket\b|\bsse\b|\boauth\b/i);
    expect(src).not.toMatch(/\bfunction\s+(?:submit|export|download|persist|handler)\b/i);
    expect(src).not.toMatch(/\bconst\s+(?:submit|export|download|persist|handler)\b/i);
  });
});
