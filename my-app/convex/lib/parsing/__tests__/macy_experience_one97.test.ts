import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("Macy heuristics: experience fallback", () => {
  it("recovers company-title-date trio when structured experience is empty", () => {
    const rawText = `
MACY WILLIAMS
Email: macy@example.com | Phone: +1 555 111 2222

Experience
One97 Communications Limited
Data Scientist
Jan 2019 — Till Date
• Building predictive market models
• Partnering with product teams

Skills
Python
Machine Learning
`;

    const parserResult = {
      normalized: {
        rawText,
        experience: [],
        skills: [{ name: "Python" }, { name: "Machine Learning" }],
        contact: {
          raw: "MACY WILLIAMS\nEmail: macy@example.com\nPhone: +1 555 111 2222",
        },
      },
      raw_sections: [],
    };

    const context = {
      rawText,
      mode: "text",
      parserUrl: "https://parser.test",
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience as Array<Record<string, any>>;

    expect(experience.length).toBeGreaterThan(0);
    const entry = experience[0];
    expect(entry.company).toBe("One97 Communications Limited");
    expect(entry.position).toBe("Data Scientist");
    expect(entry.startDate).toBe("2019-01-01");
    expect(entry.endDate).toBeNull();
    expect(entry.isCurrent).toBe(true);
    expect(Array.isArray(entry.responsibilityBullets)).toBe(true);
    expect(entry.responsibilityBullets?.length).toBeGreaterThan(0);
  });
});
