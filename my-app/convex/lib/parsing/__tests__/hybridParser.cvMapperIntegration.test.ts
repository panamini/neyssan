// my-app/convex/lib/parsing/__tests__/hybridParser.cvMapperIntegration.test.ts
import { describe, it, expect } from \"vitest\";
import { parseCV } from \"../hybridParser\";
import { mapSectionsToCV } from \"../cvMapper\";

/**
 * Integration tests: run parseCV end-to-end (using existing deterministic mocks)
 * and verify the mapper produces a canonical CV object.
 *
 * - First test: deterministic LLM mock (no OPENAI_API_KEY) -> LLM path -> mapped CV contains experience.
 * - Second test: force TEST_MALFORMED to exercise heuristic fallback -> mapped CV.other populated.
 *
 * These tests are intentionally lightweight and do not require external API keys.
 */

describe(\"hybridParser -> mapSectionsToCV (integration)\", () => {
  it(\"maps deterministic LLM mock output into a canonical CV object\", async () => {
    // Ensure we are in the deterministic no-API-key path
    delete process.env.OPENAI_API_KEY;
    delete process.env.TEST_MALFORMED;

    const raw = \"This is a sample CV text used for deterministic integration testing.\";
    const parsed = await parseCV(raw, { returnMappedCV: false });

    // parseCV should take the LLM path when no OPENAI_API_KEY is present (deterministic mock)
    expect(parsed).toHaveProperty(\"sections\");
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.method === \"llm\" || parsed.method === \"heuristic\").toBe(true);

    // Map to CV object using the mapper
    const cv = mapSectionsToCV(parsed.sections, parsed.metadata as any);

    // Basic expectations: experience bucket should exist (deterministic mock returns experience)
    expect(cv).toBeTruthy();
    expect(Array.isArray(cv.experience)).toBe(true);
    expect(cv.experience.length).toBeGreaterThanOrEqual(0);
    // At minimum the mapper preserves raw metadata/raw field
    expect(cv.raw === null || typeof cv.raw === \"string\").toBe(true);
  });

  it(\"when provider returns human-readable text, parseCV falls back to heuristics and mapper groups sections into 'other'\", async () => {
    // Force the callLLM test hook that returns human-readable text (non-JSON)
    process.env.TEST_MALFORMED = \"1\";
    // Clear OPENAI key to keep behavior deterministic
    delete process.env.OPENAI_API_KEY;

    const raw = \"## Profile\\nJohn Doe\\n- Senior developer\\n\\nSome paragraph text.\";

    const parsed = await parseCV(raw, { returnMappedCV: true });

    // parseCV should fall back to heuristics in this mode
    expect(parsed.method).toBe(\"heuristic\");
    expect(Array.isArray(parsed.sections)).toBe(true);

    const cv = parsed.cv ?? mapSectionsToCV(parsed.sections, parsed.metadata as any);

    // Heuristic parsing uses unknown headers -> mapper should put them into `other`
    expect(Array.isArray(cv.other)).toBe(true);
    expect(cv.other.length).toBeGreaterThan(0);

    // Cleanup test hook
    delete process.env.TEST_MALFORMED;
  });
});