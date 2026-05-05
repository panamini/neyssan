import { describe, expect, it } from "vitest";

import { replaceProposalSalutation } from "../proposal-header";

describe("proposal header salutation editing", () => {
  it("replaces a partial custom salutation instead of stacking typed letters", () => {
    const body = "I am interested in the role.\n\nKind regards,\nJane";
    const afterFirstLetter = replaceProposalSalutation({
      content: body,
      salutation: "H",
      previousSalutation: "",
    });

    expect(afterFirstLetter).toBe(
      "H\n\nI am interested in the role.\n\nKind regards,\nJane",
    );

    const afterSecondLetter = replaceProposalSalutation({
      content: afterFirstLetter,
      salutation: "HR",
      previousSalutation: "H",
    });

    expect(afterSecondLetter).toBe(
      "HR\n\nI am interested in the role.\n\nKind regards,\nJane",
    );
  });
});
