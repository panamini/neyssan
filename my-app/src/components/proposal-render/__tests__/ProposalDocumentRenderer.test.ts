import { describe, expect, it } from "vitest";

import {
  buildProposalDocumentBlocks,
  paginateMeasuredProposalBlocks,
  parseProposalDocumentContent,
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
});
