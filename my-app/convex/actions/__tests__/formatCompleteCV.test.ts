import { describe, it, expect, vi } from "vitest";

/**
 * Tests for formatCompleteCV action
 *
 * These tests mock the hybrid parser to simulate cases where the LLM returned
 * human-readable markdown (which causes the validator to fall back to heuristics)
 * and where metadata fields may be null. The action must normalize null -> undefined
 * for optional identity fields so Zod validation does not throw.
 *
 * The test imports the module under test dynamically after configuring the mock,
 * to ensure the mocked module is used by the action implementation.
 */

// Mock the hybrid parser module before importing the action under test
vi.mock("../../lib/parsing/hybridParser", () => {
  return {
    parseCV: vi.fn(),
  };
});

describe("formatCompleteCV normalization and heuristics", () => {
  it("normalizes null metadata -> undefined and returns heuristics result without throwing", async () => {
    const hybrid = await import("../../lib/parsing/hybridParser");
    (hybrid.parseCV as any).mockResolvedValue({
      sections: [],
      metadata: { name: null, email: null, phone: "3868683442" },
      method: "heuristic",
      warnings: ["Section 0 content not found in original text", "Low text coverage: 0.0%"],
    });

    const mod = await import("../formatCompleteCV");
    const runFormatCompleteCV = mod.runFormatCompleteCV as (args: { rawText: string }) => Promise<any>;

    const res = await runFormatCompleteCV({ rawText: "some CV text" });
    expect(res.status).toBe("ok");
    expect(res.result).toBeTruthy();
    expect(res.result.identity).toBeDefined();
    // nulls must be converted to undefined
    expect(res.result.identity.name).toBeUndefined();
    expect(res.result.identity.email).toBeUndefined();
    expect(res.result.identity.phone).toBe("3868683442");
    // diagnostics should contain fallback warnings
    expect(res.result.diagnostics).toBeDefined();
    expect(Array.isArray(res.result.diagnostics.warnings)).toBe(true);
    expect(res.result.diagnostics.warnings).toContain("Section 0 content not found in original text");
  });

  it("handles missing metadata fields (undefined) gracefully", async () => {
    const hybrid = await import("../../lib/parsing/hybridParser");
    (hybrid.parseCV as any).mockResolvedValue({
      sections: [],
      metadata: {},
      method: "heuristic",
      warnings: [],
    });

    const mod = await import("../formatCompleteCV");
    const runFormatCompleteCV = mod.runFormatCompleteCV as (args: { rawText: string }) => Promise<any>;

    const res = await runFormatCompleteCV({ rawText: "some CV text" });
    expect(res.status).toBe("ok");
    expect(res.result.identity).toBeDefined();
    expect(res.result.identity.name).toBeUndefined();
    expect(res.result.identity.email).toBeUndefined();
    expect(res.result.identity.phone).toBeUndefined();
  });
});