import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("Macy heuristics: summary and desired position", () => {
  it("keeps full summary sentence and infers Data Scientist desired position from header", () => {
    const rawText = `
MACY WILLIAMS
Data Scientist | Delhi, India
Email: macy@example.com | Phone: +1 555 123 4567

ABOUT
Data Scientist working on problems related to market research and customer analysis. Passionate about experimentation and customer empathy.

SKILLS
Python
Machine Learning
`;

    const parserResult = {
      normalized: {
        rawText,
        summary: {
          text: "ABOUT\nData Scientist working on problems related to market research and customer analysis. Passionate about experimentation and customer empathy.",
        },
        contact: {
          raw: "MACY WILLIAMS\nData Scientist | Delhi, India\nEmail: macy@example.com\nPhone: +1 555 123 4567",
          desiredPosition: "Engineer",
          location: "Delhi, India",
        },
        skills: [{ name: "Python" }, { name: "Machine Learning" }],
        experience: [],
      },
    };

    const context = {
      rawText,
      mode: "text",
      parserUrl: "https://parser.test",
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summaryFirstSentence).toBe(
      "Data Scientist working on problems related to market research and customer analysis.",
    );
    expect(normalized.desiredPosition).toBe("Data Scientist");
    expect(normalized.contact?.desiredPosition).toBe("Data Scientist");
  });
});

