import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Tests for parseCVEngine
 *
 * - Mocks the LLM caller (providers.createLLMCaller) to return a deterministic
 *   JSON-ish string containing sections + metadata.
 * - Mocks the parsing post-processor used by the engine (llmPostProcessor)
 *   so the engine's parserFn will parse our mocked LLM output deterministically.
 *
 * This verifies parseCVEngine behavior independent of the shim.
 */

vi.mock("../providers", () => {
  return {
    createLLMCaller: () => {
      // Return a callable that accepts (prompt, schema, opts) and returns a promise
      // resolving to { text } where text is the provider string the engine expects.
      return async (_prompt: string, _schema?: unknown, _opts?: unknown) => {
        const payload = {
          sections: [
            { title: "Languages", content: "English, French\nSpanish", fieldKey: "languages", confidence: 0.9 },
            { title: "Contact", content: "Phone: +33123456789\n123 Main St, Paris", fieldKey: "contact", confidence: 0.95 },
          ],
          metadata: { name: "John Doe", email: "john@example.com", phone: "+33123456789", linkedinUrl: null }
        };
        return { text: JSON.stringify(payload) };
      };
    }
  };
});

vi.mock("../parsing/llmPostProcessor", () => {
  return {
    // parseLLMSections should accept the raw provider string and return the canonical shape
    parseLLMSections: (raw: string) => {
      try {
        const j = JSON.parse(raw);
        if (j && Array.isArray(j.sections)) return { sections: j.sections };
      } catch {}
      // fallback: return an empty sections shape
      return { sections: [] };
    },
    parseLLMMetadata: (raw: string) => {
      try {
        const j = JSON.parse(raw);
        if (j && j.metadata) return j.metadata;
      } catch {}
      return { name: null, email: null, phone: null, linkedinUrl: null };
    }
  };
});

afterEach(() => vi.resetAllMocks());

describe("parseCVEngine (parsing_shared)", () => {
  it("parses languages and contact when LLM returns canonical JSON", async () => {
    const mod = await import("../engine");
    const { parseCVEngine } = mod as typeof import("../engine");
    const res = await parseCVEngine("English, French\nSpanish\n\nPhone: +33123456789\n123 Main St, Paris\n");

    expect(res).toBeDefined();
    expect(res.method).toBeDefined();
    // sections should include languages and contact
    const languagesSection = res.sections.find(s => s.fieldKey === "languages");
    expect(languagesSection).toBeDefined();
    expect(languagesSection?.content).toContain("English");
    const contactSection = res.sections.find(s => s.fieldKey === "contact");
    expect(contactSection).toBeDefined();
    expect(contactSection?.content).toContain("+33123456789");

    // metadata propagated
    expect(res.metadata).toBeDefined();
    expect(res.metadata.phone).toBe("+33123456789");
    expect(res.metadata.email).toBe("john@example.com");
  });
});