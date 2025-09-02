import { describe, it, expect } from "vitest";
 
describe("parseCV retry + fallback", () => {
  it("falls back to heuristics when LLM output is human-readable and repair fails", async () => {
    // Force the module's test hook that causes callLLM to return human-readable markdown
    process.env.TEST_MALFORMED = "1";
    // Ensure the test uses the fast callLLM path for repair by clearing any OpenAI key
    // (this prevents the module from choosing callOpenAIResponsesForRepair which hits SDK/fetch paths)
    process.env.OPENAI_API_KEY = "";
    // Force GPT-only path so adapters are skipped and callLLM is used directly.
    process.env.FORCE_GPT_ONLY = "1";
 
    // Import parseCV after configuring env so the module's runtime checks pick up the test overrides.
    const { parseCV } = await import("../hybridParser");
 
    const rawText = `
John Doe
Professional Experience
- Senior dev at ACME (2021-2024)
`;
 
    const res = await parseCV(rawText);
    expect(res).toBeDefined();
    expect(res.method).toBe("heuristic");
    expect(Array.isArray(res.sections)).toBe(true);
    expect(res.sections.length).toBeGreaterThan(0);
 
    // Clean up test env
    delete process.env.TEST_MALFORMED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.FORCE_GPT_ONLY;
  });
});