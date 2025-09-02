import { describe, it, expect } from "vitest";
import { repairJSON } from "../../parsing_shared/repair";

describe("repairJSON", () => {
  it("extracts fenced JSON returned by an LLM and returns parsed JSON string", async () => {
    const mockLLM = async (prompt: string) => {
      return 'Some explanation followed by fenced JSON:\\n```json\\n{\"name\":\"Alice\",\"email\":\"alice@example.com\"}\\n```';
    };

    // Provide an input that contains a brace so the quick-reject heuristics allow a repair attempt.
    const res = await repairJSON("PREFIX {BROKEN_JSON_PLACEHOLDER} SUFFIX", 1000, mockLLM);
    expect(res).not.toBeNull();
    const parsed = JSON.parse(res as string);
    expect(parsed).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("returns null when the LLM cannot produce valid JSON", async () => {
    const mockLLM = async () => "I cannot repair this JSON at all.";
    const res = await repairJSON("something broken", 1000, mockLLM);
    expect(res).toBeNull();
  });
});