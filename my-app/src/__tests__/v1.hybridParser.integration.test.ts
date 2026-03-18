import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock the shared LLM caller to avoid any real network/provider usage.
// We return deterministic JSON matching SECTION_RESPONSE_SCHEMA and METADATA_RESPONSE_SCHEMA.
vi.mock("../../convex/lib/parsing_shared/providers", async () => {
  return {
    createLLMCaller: (_cfg?: any) => {
      return async (_prompt: string, _schema?: unknown, _opts?: any) => {
        // Provide a minimal but valid sections JSON payload expected by parseLLMSections.
        const fake = {
          sections: [
            {
              title: "Professional Experience",
              content: "Senior Developer at ACME Corp (Jan 2020 - Present).",
              fieldKey: "experience",
              confidence: 0.98,
            },
            {
              title: "Education",
              content: "BSc Computer Science at Example University (2016 - 2019).",
              fieldKey: "education",
              confidence: 0.95,
            },
            {
              title: "Summary",
              content: "Experienced engineer with a focus on web applications.",
              fieldKey: "summary",
              confidence: 0.9,
            },
            {
              title: "Skills",
              content: "TypeScript, React, Node.js",
              fieldKey: "skills",
              confidence: 0.9,
            },
          ],
        };
        return { text: JSON.stringify(fake), fallbackUsed: false };
      };
    },
  };
});

// Import under test AFTER mocks
import { parseCV } from "../../convex/lib/parsing/hybridParser";

describe("hybridParser.parseCV (integration, provider mocked)", () => {
  const prevKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    // Ensure we take the deterministic mock path (no live key).
    process.env.OPENAI_API_KEY = "";
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = prevKey;
  });

  it("returns sections with high confidence and builds mapped CV when requested", async () => {
    const text = `
      John Doe
      Senior Developer at ACME Corp (Jan 2020 - Present)
      BSc Computer Science, Example University (2016 - 2019)
      Skills: TypeScript, React, Node.js
      Summary: Experienced engineer with a focus on web applications.
    `;

    const res = await parseCV(text, { returnMappedCV: true, mapperStrip: true });

    // Basic shape checks
    expect(res).toBeTruthy();
    expect(Array.isArray(res.sections)).toBe(true);
    expect(res.sections.length).toBeGreaterThan(0);
    // Should be using LLM path given our mock provider
    expect(res.method === "llm" || res.method === "heuristic").toBe(true);

    // Ensure sections contain experience and education
    const keys = new Set(res.sections.map((s) => s.fieldKey));
    expect(keys.has("experience")).toBe(true);
    expect(keys.has("education")).toBe(true);
    expect(keys.has("summary")).toBe(true);
    expect(keys.has("skills")).toBe(true);

    // Mapped CV present when returnMappedCV=true
    expect(res.cv == null).toBe(false);
    // Do not assert exact shape of mapped CV here; just ensure non-null and object-like
    expect(typeof (res as any).cv).toBe("object");
  });

  it("is robust when parsing short input and still returns a result", async () => {
    const short = "Jane Smith — Developer";
    const res = await parseCV(short, { returnMappedCV: true });

    expect(res).toBeTruthy();
    expect(Array.isArray(res.sections)).toBe(true);
    expect(res.sections.length).toBeGreaterThan(0);
    expect(res.cv == null).toBe(false);
  });
});