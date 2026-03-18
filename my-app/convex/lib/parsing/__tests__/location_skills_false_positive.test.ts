import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("Contact location sanitization", () => {
  it("removes skill-derived location tokens like 'Python, Ma'", () => {
    const rawText = `Python, Ma is not a location but appears in skills`;

    const parserResult = {
      normalized: {
        rawText,
        contact: {
          raw: "MACY WILLIAMS\nEmail: macy@example.com\nPhone: +1 555 000 0000\nPython, Ma",
          location: "Python, Ma",
        },
        skills: [{ name: "Python" }, { name: "Machine Learning" }],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, {
      rawText,
      mode: "text",
      parserUrl: "https://parser.test",
    });

    expect(canonical.normalized?.contact?.location ?? "").not.toMatch(/python/i);
  });
});

