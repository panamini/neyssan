import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const adapterPath = "../../../../config/llmAdapters";
const telemetryPath = "../../../../config/llmTelemetry";

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  vi.resetModules();
  try {
    const telemetry = await import(telemetryPath);
    telemetry.clearTelemetry();
  } catch {}
  delete process.env.MISTRAL_API_KEY;
  // Ensure we don't have a mock lingering
  (globalThis as any).fetch = originalFetch;
  vi.unmock("../../../../config/llmAdapters");
});

afterEach(() => {
  // Restore global fetch
  (globalThis as any).fetch = originalFetch;
  vi.unmock("../../../../config/llmAdapters");
});

describe("mistral adapter - SDK shapes (via fetch fallback mocks)", () => {
  it("handles fetch response with output[].content[].json", async () => {
    // Mock fetch to return a payload shaped like an SDK 'output[].content[].json'
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              { json: { sections: [{ title: "Fetch Experience" }] } }
            ]
          }
        ]
      })
    });

    process.env.MISTRAL_API_KEY = "sk-mistral-test";
    const { getLLMAdapter } = await import(adapterPath);
    const adapter = getLLMAdapter({ provider: "mistral", model: "mistral-test" } as any);

    const res = await adapter.call("Test prompt");
    expect(res).toBeTruthy();
    expect(typeof res === "object").toBe(true);
    expect((res).sections?.[0]?.title).toBe("Fetch Experience");
  });

  it("handles fetch response with generations[].text", async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generations: [{ text: "Generated text output from fetch" }]
      })
    });

    process.env.MISTRAL_API_KEY = "sk-mistral-test";
    const { getLLMAdapter } = await import(adapterPath);
    const adapter = getLLMAdapter({ provider: "mistral", model: "mistral-test" } as any);

    const res = await adapter.call("Test prompt");
    expect(res).toBe("Generated text output from fetch");
  });

  it("handles fetch response with top-level output_text", async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "Top level text from fetch" })
    });

    process.env.MISTRAL_API_KEY = "sk-mistral-test";
    const { getLLMAdapter } = await import(adapterPath);
    const adapter = getLLMAdapter({ provider: "mistral", model: "mistral-test" } as any);

    const res = await adapter.call("Test prompt");
    expect(res).toBe("Top level text from fetch");
  });
});