import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Additional parseCVEngine tests:
 *  - French CV handling (ensures engine can parse French-like content)
 *  - Repair flow simulation: first LLM response is malformed, second attempt (repair) returns valid JSON
 *
 * Provider mock behavior is controlled by the env variable TEST_SCENARIO so we can
 * change behavior per-test without relying on test-time vi.mock calls inside test scopes.
 */

/* Mock the post-processor to parse provider JSON payloads deterministically */
vi.mock("../parsing/llmPostProcessor", () => {
  return {
    parseLLMSections: (raw: string) => {
      try {
        const j = JSON.parse(raw);
        if (j && Array.isArray(j.sections)) return { sections: j.sections };
      } catch {}
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

/* Top-level provider mock that branches behavior by process.env.TEST_SCENARIO.
   This avoids hoisting pitfalls with vitest and lets tests set the scenario
   before calling parseCVEngine. */
const callCounts: Record<string, number> = {};

vi.mock("../providers", () => {
  return {
    createLLMCaller: () => {
      return async (prompt: string, _schema?: unknown, _opts?: unknown) => {
        const scenario = process.env.TEST_SCENARIO ?? "default";
        callCounts[scenario] = (callCounts[scenario] || 0) + 1;
        // French scenario: always return French canonical JSON
        if (scenario === "french") {
          const payload = {
            sections: [
              { title: "Langues", content: "Français (natif), Anglais (courant)", fieldKey: "languages", confidence: 0.9 },
              { title: "Coordonnées", content: "Téléphone: +33123456789\n123 Rue Exemple, Paris", fieldKey: "contact", confidence: 0.95 },
            ],
            metadata: { name: "Jean Dupont", email: "jean@example.fr", phone: "+33123456789", linkedinUrl: null }
          };
          return { text: JSON.stringify(payload) };
        }
        // Repair scenario: first call returns broken text, subsequent calls return repaired JSON
        if (scenario === "repair") {
          if (callCounts[scenario] === 1) {
            return { text: "Some unstructured response: languages -> French, English; contact -> Phone +33123456789" };
          } else {
            const payload = {
              sections: [
                { title: "Languages", content: "French, English", fieldKey: "languages", confidence: 0.9 },
                { title: "Contact", content: "Phone: +33123456789", fieldKey: "contact", confidence: 0.95 },
              ],
              metadata: { name: null, email: null, phone: "+33123456789", linkedinUrl: null }
            };
            return { text: JSON.stringify(payload) };
          }
        }
        // Default canonical payload used by other tests
        const defaultPayload = {
          sections: [
            { title: "Languages", content: "English, French\nSpanish", fieldKey: "languages", confidence: 0.9 },
            { title: "Contact", content: "Phone: +33123456789\n123 Main St, Paris", fieldKey: "contact", confidence: 0.95 },
          ],
          metadata: { name: "John Doe", email: "john@example.com", phone: "+33123456789", linkedinUrl: null }
        };
        return { text: JSON.stringify(defaultPayload) };
      };
    }
  };
});

afterEach(() => {
  vi.resetAllMocks();
  // Clear scenario-specific counters
  for (const k of Object.keys(callCounts)) delete callCounts[k];
  delete process.env.TEST_SCENARIO;
});

describe("parseCVEngine extra tests", () => {
  it("parses French CV content", async () => {
    process.env.TEST_SCENARIO = "french";
    const mod = await import("../engine");
    const { parseCVEngine } = mod as typeof import("../engine");
    const raw = "Ce CV est en français.\nLangues:\nFrançais (natif), Anglais (courant)\n\nCoordonnées:\nTéléphone: +33123456789\n123 Rue Exemple, Paris\n";
    const res = await parseCVEngine(raw);

    expect(res).toBeDefined();
    expect(res.sections.find(s => s.fieldKey === "languages")).toBeDefined();
    expect(res.sections.find(s => s.fieldKey === "contact")).toBeDefined();
    expect(res.metadata.email).toBe("jean@example.fr");
  });

  it("performs repair when initial provider output is malformed (simulated)", async () => {
    process.env.TEST_SCENARIO = "repair";
    const mod = await import("../engine");
    const { parseCVEngine } = mod as typeof import("../engine");
    const rawText = "Dummy CV text for repair-flow simulation. Contains languages and phone in prose. French, English. Phone +33123456789.";
    const res = await parseCVEngine(rawText);

    // After repair, engine should have extracted sections/metadata
    expect(res).toBeDefined();
    const langs = res.sections.find(s => s.fieldKey === "languages");
    expect(langs).toBeDefined();
    expect(langs?.content).toContain("French");
    const contact = res.sections.find(s => s.fieldKey === "contact");
    expect(contact).toBeDefined();
    expect(res.metadata.phone).toBe("+33123456789");
  });
});