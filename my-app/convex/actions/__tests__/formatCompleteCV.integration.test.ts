import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the hybridParser module to simulate LLM output including languages and contact.
const parseCVMock = vi.fn(async (rawText: string) => {
  return {
    sections: [
      { title: "Languages", content: "English, French\nSpanish", fieldKey: "languages", confidence: 0.9 },
      { title: "Contact", content: "Phone: +33123456789\n123 Main St, Paris", fieldKey: "contact", confidence: 0.95 },
      { title: "Skills", content: "TypeScript, React", fieldKey: "skills", confidence: 0.9 },
      { title: "Identity", content: "John Doe\njohn@example.com", fieldKey: "identity", confidence: 0.9 },
    ],
    metadata: { name: "John Doe", email: "john@example.com", phone: "+33123456789" },
    method: "llm",
    warnings: []
  };
});

vi.mock("../../lib/parsing/hybridParser", () => {
  return {
    parseCV: parseCVMock
  };
});

describe("formatCompleteCV integration (languages & contact)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("parses languages and contact through the full action flow", async () => {
    const mod = await import("../formatCompleteCV");
    const runFormatCompleteCV = mod.runFormatCompleteCV as (args: { rawText: string }) => Promise<any>;

    const rawText = "Dummy CV text that will be parsed by mocked LLM";
    const res = await runFormatCompleteCV({ rawText });

    expect(res).toHaveProperty("status", "ok");
    const refined = res.result;
    expect(refined).toBeTruthy();
    // languages should be split and trimmed
    expect(refined.languages).toEqual(["English", "French", "Spanish"]);
    // contact should include phone and address heuristically extracted
    expect(refined.contact).toBeDefined();
    // phone extraction may include nearby characters; assert it contains the number
    expect(String(refined.contact.phone)).toContain("+33123456789");
    expect(refined.contact.address).toContain("123 Main St");
    // metadata should be propagated into identity
    expect(refined.identity).toBeDefined();
    expect(refined.identity.name).toBe("John Doe");
    expect(refined.identity.email).toBe("john@example.com");
  });
});