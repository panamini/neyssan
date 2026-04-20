import { describe, expect, it } from "vitest";

import { normalizeAndValidateCvDocument } from "../normalize-cv";

describe("normalize-cv metadata passthrough", () => {
  it("preserves verbatiStyle metadata through strict normalization", () => {
    const result = normalizeAndValidateCvDocument({
      title: "Styled CV",
      metadata: {
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        version: 1,
        verbatiStyle: {
          familyId: "two-column",
          layout: "two-column",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      },
      sections: [],
    });

    expect(result.success).toBe(true);
    expect(result.document?.metadata?.verbatiStyle).toEqual({
      familyId: "two-column",
      layout: "two-column",
      typography: "quiet-editorial",
      palette: "pierre",
    });
  });
});
