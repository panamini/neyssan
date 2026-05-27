import { describe, expect, it } from "vitest";

import { resolveProposalStyleCommitTemplateId } from "../proposal-style-commit";
import type { VerbatiStylePreset } from "../../features/verbati/types";

const workshopStyle = {
  layout: "workshop",
  typography: "geist-baskervville",
  palette: "ink",
  accentHex: null,
} satisfies VerbatiStylePreset;

describe("resolveProposalStyleCommitTemplateId", () => {
  it("preserves the current proposal template for color and font style commits", () => {
    expect(
      resolveProposalStyleCommitTemplateId({
        currentTemplateId: "director-letterhead",
        stylePreset: {
          ...workshopStyle,
          typography: "ledger-sans",
          palette: "sauge",
        },
      }),
    ).toBe("director-letterhead");
  });

  it("falls back to the style twin only when no current template is available", () => {
    expect(
      resolveProposalStyleCommitTemplateId({
        currentTemplateId: null,
        stylePreset: workshopStyle,
      }),
    ).toBe("workshop_proposal_margin");
  });

  it("allows explicit template requests to override the current template", () => {
    expect(
      resolveProposalStyleCommitTemplateId({
        currentTemplateId: "director-letterhead",
        requestedTemplateId: "film-foto-letterhead",
        stylePreset: workshopStyle,
      }),
    ).toBe("film-foto-letterhead");
  });

  it("treats an explicit null template request as a reset to the style twin", () => {
    expect(
      resolveProposalStyleCommitTemplateId({
        currentTemplateId: "director-letterhead",
        requestedTemplateId: null,
        stylePreset: workshopStyle,
      }),
    ).toBe("workshop_proposal_margin");
  });
});
