import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock the adapter factory so we bypass dynamic import and force the SDK path behavior.
// This returns an adapter whose `call` method resolves to an object the adapter would
// stringify and the parser can consume.
vi.mock("../../../../config/llmAdapters", () => {
  return {
    getLLMAdapter: (config: any) => {
      return {
        call: async (prompt: string, schema?: unknown) => {
          return {
            sections: [
              {
                title: "SDK Experience",
                content: "Worked via SDK at Acme",
                fieldKey: "experience",
                confidence: 0.9
              }
            ],
            metadata: {
              name: "SDK User",
              email: "sdk@test.com",
              phone: null,
              linkedinUrl: null
            }
          };
        }
      };
    }
  };
});

// Import after mocking so dynamic import picks up the mocked module
import { parseCV } from "../hybridParser";

beforeAll(() => {
  // Ensure the adapter will take the API-key path
  process.env.OPENAI_API_KEY = "sk-test-sdk";
});

afterAll(() => {
  // Tear down mocks and env changes
  try {
    vi.unmock("openai");
  } catch {
    // ignore
  }
  delete process.env.OPENAI_API_KEY;
});

describe("hybridParser - OpenAI SDK path", () => {
  it("uses the mocked SDK client and returns parsed LLM result", async () => {
    const cvText = `Jane Tester
Worked via SDK at Acme`;

    const result = await parseCV(cvText);

    expect(result.method).toBe("llm");
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.name).toBe("SDK User");
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sections[0].title).toBe("SDK Experience");
    expect(result.sections[0].confidence).toBeGreaterThan(0.4);
  });
});