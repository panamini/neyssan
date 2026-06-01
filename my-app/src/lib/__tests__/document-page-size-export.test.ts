import { describe, expect, it } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { generateCvTemplate } from "../cv-template";
import {
  buildProposalExportSource,
  buildResumeExportSource,
} from "../document-export-models";
import {
  renderProposalStyledExportDocument,
  renderResumeStyledExportDocument,
} from "../export-renderers";

describe("page-size export rendering", () => {
  it("emits true Letter @page and page vars for resume PDF HTML", () => {
    const source = buildResumeExportSource({
      currentCv: generateCvTemplate("Letter resume"),
      stylePreset: DEFAULT_VERBATI_STYLE,
      pageSizePreference: "letter",
    });

    if (!source) {
      throw new Error("Expected resume export source.");
    }

    const html = renderResumeStyledExportDocument({
      data: source,
      stylePreset: DEFAULT_VERBATI_STYLE,
    });

    expect(html).toContain("size: 215.9mm 279.4mm;");
    expect(html).toContain("--page-width: 215.9mm;");
    expect(html).toContain("--page-height: 279.4mm;");
    expect(html).not.toContain("size: A4;");
  });

  it("emits true Letter @page and page vars for proposal PDF HTML", () => {
    const source = buildProposalExportSource({
      content: "Dear team,\n\nProposal body.",
      proposalType: "cover_letter",
      documentTitle: "Proposal",
      documentMeta: "alex@example.com",
      contactLine: "alex@example.com",
      letterDate: "Paris, April 16, 2026",
      recipientDetails: "Hiring Manager",
      applicantHeader: null,
      templateId: "two_column_rail",
      pageSizePreference: "letter",
    });

    const html = renderProposalStyledExportDocument({
      data: source,
      stylePreset: DEFAULT_VERBATI_STYLE,
    });

    expect(html).toContain("size: 215.9mm 279.4mm;");
    expect(html).toContain("--page-width: 215.9mm;");
    expect(html).toContain("--page-height: 279.4mm;");
    expect(html).not.toContain("size: A4;");
  });
});
