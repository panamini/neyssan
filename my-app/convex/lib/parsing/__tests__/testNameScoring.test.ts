import { describe, expect, it } from "vitest";

import { extractName } from "../../parsing_shared/contactHeuristics";

describe("contact name scoring penalties", () => {
  it("keeps valid names that include penalty tokens when email alignment is strong", () => {
    const text = [
      "Atlantic Johnson",
      "atlantic.johnson@example.com",
      "Paris, France",
    ].join("\n");

    const result = extractName(text, "atlantic.johnson@example.com");

    expect(result.value).toBe("Atlantic Johnson");
    expect(result.confidence).not.toBeNull();
    expect(result.confidence ?? 0).toBeGreaterThan(0.5);
  });

  it("demotes geographic headings masquerading as names", () => {
    const text = [
      "Mediterranean Sea",
      "Conference Speaker",
      "m.sea@example.com",
      "Alice Laurent",
      "alice.laurent@example.com",
    ].join("\n");

    const penaltyCandidate = extractName(text, "m.sea@example.com");
    const validCandidate = extractName(text, "alice.laurent@example.com");

    expect(penaltyCandidate.confidence ?? 0).toBeLessThan(validCandidate.confidence ?? 1);
    expect(validCandidate.value).toBe("Alice Laurent");
  });
});
