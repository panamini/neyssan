import { describe, expect, it } from "vitest";

import {
  buildProposalDocumentBlocks,
  paginateMeasuredProposalBlocks,
  parseProposalDocumentContent,
  splitParagraphIntoPaginationFragments,
} from "../ProposalDocumentRenderer";

describe("ProposalDocumentRenderer helpers", () => {
  it("builds a closing block when the parsed document includes a signoff", () => {
    const parsed = parseProposalDocumentContent(
      "Dear Hiring Manager,\n\nParagraph one.\n\nWarm regards,\nAlex Martin",
      "cover_letter",
    );

    const blocks = buildProposalDocumentBlocks(parsed);

    expect(blocks.map((block) => block.type)).toEqual([
      "salutation",
      "paragraph",
      "closing",
    ]);
  });

  it("builds a closing block for deterministic French signoffs", () => {
    const parsed = parseProposalDocumentContent(
      "Madame, Monsieur,\n\nParagraphe.\n\nBien cordialement,\nAlex Martin",
      "cover_letter",
    );

    const blocks = buildProposalDocumentBlocks(parsed);

    expect(blocks.at(-1)).toMatchObject({
      type: "closing",
      signOff: "Bien cordialement,",
      signatureName: "Alex Martin",
    });
  });

  it("paginates measured blocks into continuation pages when content exceeds one page", () => {
    const pages = paginateMeasuredProposalBlocks({
      capacity: 300,
      blocks: [
        { height: 80, gapBefore: 0 },
        { height: 120, gapBefore: 24 },
        { height: 120, gapBefore: 24 },
        { height: 70, gapBefore: 28 },
      ],
    });

    expect(pages).toEqual([[0, 1], [2, 3]]);
  });

  it("reserves the first-page lead-in so page one does not overfill its bottom margin", () => {
    const pages = paginateMeasuredProposalBlocks({
      capacity: 300,
      firstPageLeadIn: 80,
      continuationPageLeadIn: 0,
      blocks: [
        { height: 80, gapBefore: 0 },
        { height: 120, gapBefore: 24 },
        { height: 70, gapBefore: 28 },
      ],
    });

    expect(pages).toEqual([[0], [1, 2]]);
  });

  it("keeps a small safety reserve at the bottom of each page", () => {
    const pages = paginateMeasuredProposalBlocks({
      capacity: 300,
      firstPageLeadIn: 80,
      continuationPageLeadIn: 0,
      pageBreakSafetyReserve: 28,
      blocks: [
        { height: 80, gapBefore: 0 },
        { height: 100, gapBefore: 24 },
        { height: 50, gapBefore: 28 },
      ],
    });

    expect(pages).toEqual([[0], [1, 2]]);
  });

  it("splits oversized paragraphs into pagination fragments before layout", () => {
    const fragments = splitParagraphIntoPaginationFragments(
      "I led proposal operations across legal, employment, and delivery teams while keeping review loops fast. I translated stakeholder feedback into clearer drafts and tighter decision notes without slowing the timeline. I coordinated revisions across teams so the final proposal stayed coherent from the first paragraph through the final sign-off.",
    );

    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments.join(" ")).toContain(
      "I led proposal operations across legal, employment, and delivery teams",
    );
  });
});
