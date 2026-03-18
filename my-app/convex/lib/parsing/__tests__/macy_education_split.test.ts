import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("Macy heuristics: education dual degree splitting", () => {
  it("splits mashed dual-degree line into separate entries", () => {
    const rawText = `Education\nB.Tech in Computer Science, SGBAU 2017. M.Tech in Data Science, IIT Kanpur 2019`;

    const parserResult = {
      raw_sections: [
        {
          label: "EDUCATION",
          content: "B.Tech in Computer Science, SGBAU 2017. M.Tech in Data Science, IIT Kanpur 2019",
        },
      ],
      normalized: {
        rawText,
        education: [],
      },
    };

    const context = {
      rawText,
      mode: "text",
      parserUrl: "https://parser.test",
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const education = canonical.normalized?.education as Array<Record<string, any>>;

    expect(Array.isArray(education)).toBe(true);
    expect(education.length).toBe(2);
    expect(education[0]?.degree).toMatch(/B\.Tech/i);
    expect(education[0]?.institution).toMatch(/SGBAU/i);
    expect(education[1]?.degree).toMatch(/M\.Tech/i);
    expect(education[1]?.institution).toMatch(/IIT Kanpur/i);
  });
});

