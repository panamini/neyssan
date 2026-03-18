import { describe, it, expect, vi } from "vitest";

/**
 * Mock sanitizer to make repair step unrepairable when TEST_MALFORMED=1.
 * This forces attemptLLMParse to fail and parseCV to fall back to heuristics.
 */
vi.mock("../../parsing_shared/utils", async () => {
  // Reuse real implementation for all exports except sanitizeProviderResponse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const real: any = await vi.importActual("../../parsing_shared/utils");
  return {
    ...real,
    sanitizeProviderResponse: (raw: string) => {
      return process.env.TEST_MALFORMED === "1" ? "" : real.sanitizeProviderResponse(raw);
    },
  };
});

/**
 * Force deterministic LLM behavior in tests:
 * - When TEST_MALFORMED=1 => return human-readable text (non-JSON) to trigger heuristic fallback
 * - Otherwise => return a deterministic JSON payload to exercise the LLM path
 */
vi.mock("../../parsing_shared/providers", () => ({
  __esModule: true,
  createLLMCaller: () => {
    return async (_prompt: string, _schema?: unknown, _opts?: unknown) => {
      // Short, non-JSON stub that will fail sanitizer/repair checks (forces heuristic fallback)
      const human = "NO_JSON_SHORT";
      const json = JSON.stringify({
        sections: [
          {
            title: "Professional Experience",
            content: "Senior Developer at ABC Inc. (2020-2023)...",
            fieldKey: "experience",
            confidence: 0.98
          }
        ]
      });
      const text = process.env.TEST_MALFORMED === "1" ? human : json;
      return { text, fallbackUsed: false };
    };
  },
}));
 
/**
 * Mock validator to force LLM outputs invalid when TEST_MALFORMED=1.
 * Ensures parseCV falls back to heuristics deterministically.
 */
vi.mock("../../parsing/llmValidator", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const real: any = await vi.importActual("../../parsing/llmValidator");
  return {
    ...real,
    validateLLMOutput: (parsed: any, _rawText?: string) => {
      if (process.env.TEST_MALFORMED === "1") {
        return { isValid: false, confidence: 0, issues: ["forced-invalid-by-test"] };
      }
      return real.validateLLMOutput(parsed, _rawText);
    },
  };
});

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