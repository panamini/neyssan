import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("Spaced-caps normalization", () => {
  it("collapses spaced-caps name and desired position", () => {
    const rawText = `
K E I S U K E   Y A M A M O T O
J U N I O R  S O F T W A R E  D E V E L O P E R
Email: keisuke@example.com
`;

    const parserResult = {
      normalized: {
        rawText,
        contact: {
          raw: rawText,
          email: "keisuke@example.com",
        },
        skills: [{ name: "TypeScript" }],
        experience: [],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, {
      rawText,
      mode: "text",
      parserUrl: "https://parser.test",
    });

    expect(canonical.normalized?.name).toBe("Keisuke Yamamoto");
    expect(canonical.normalized?.desiredPosition).toBe("Junior Software Developer");
  });
});

