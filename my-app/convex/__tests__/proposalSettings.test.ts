import { describe, expect, it } from "vitest";

import {
  buildCanonicalProposalVerbatiStyle,
  inferLegacyProposalStyleChoice,
} from "../proposalSettings";

describe("proposal settings canonical style persistence", () => {
  it("migrates legacy styleChoice rows into canonical verbatiStyle idempotently", () => {
    const canonical = buildCanonicalProposalVerbatiStyle({
      styleChoice: "warm",
      fontPairId: "quiet-editorial",
      paletteOverride: "sauge",
      accentHex: null,
    });

    expect(canonical).toEqual({
      familyId: "editorial",
      layout: "editorial",
      typography: "quiet-editorial",
      palette: "sauge",
    });

    expect(
      buildCanonicalProposalVerbatiStyle({
        verbatiStyle: canonical,
      }),
    ).toEqual(canonical);
  });

  it("preserves hidden persisted workshop styles instead of rewriting them", () => {
    const canonical = buildCanonicalProposalVerbatiStyle({
      verbatiStyle: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      },
      styleChoice: "balanced",
    });

    expect(canonical).toEqual({
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    });
    expect(inferLegacyProposalStyleChoice(canonical)).toBe("balanced");
  });
});
