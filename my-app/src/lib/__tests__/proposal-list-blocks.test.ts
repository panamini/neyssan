import { describe, expect, it } from "vitest";
import { parseProposalPlainTextBlocks } from "../proposal-list-blocks";

describe("parseProposalPlainTextBlocks", () => {
  it("turns consecutive bullet-like lines into a list block", () => {
    expect(
      parseProposalPlainTextBlocks(
        "I can help with delivery.\n\n- Audit the current flow\n* Fix the export path\n• Verify the PDF\n\nThanks.",
      ),
    ).toEqual([
      { type: "paragraph", text: "I can help with delivery." },
      {
        type: "list",
        items: [
          "Audit the current flow",
          "Fix the export path",
          "Verify the PDF",
        ],
      },
      { type: "paragraph", text: "Thanks." },
    ]);
  });

  it("does not treat inline asterisks as list markers", () => {
    expect(parseProposalPlainTextBlocks("I can *emphasize* one point.")).toEqual([
      { type: "paragraph", text: "I can emphasize one point." },
    ]);
  });
});
