import { describe, expect, it } from "vitest";

import {
  buildProposalRecipientDetails,
  buildProposalRecipientPrefill,
  parseProposalRecipientDetails,
  replaceProposalSalutation,
} from "../proposal-header";

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

describe("proposal recipient heading fields", () => {
  it("preserves recipient company and city positions when optional fields are blank", () => {
    const recipientDetails = buildProposalRecipientDetails({
      name: "Hiring Manager",
      company: "Acme",
      city: "Paris",
    });

    expect(recipientDetails).toBe("Hiring Manager\n\nAcme\n\n\nParis");
    expect(parseProposalRecipientDetails(recipientDetails)).toMatchObject({
      name: "Hiring Manager",
      role: "",
      company: "Acme",
      city: "Paris",
    });
  });

  it("does not shift imported company into the recipient name slot", () => {
    const recipientDetails = buildProposalRecipientPrefill({
      company: "Us Smart Tools",
      city: "New York",
      email: "jobs@example.com",
    });

    expect(parseProposalRecipientDetails(recipientDetails)).toMatchObject({
      name: "",
      role: "",
      company: "Us Smart Tools",
      email: "jobs@example.com",
      city: "New York",
    });
  });

  it("parses labeled recipient lines without leaking labels into empty slots", () => {
    expect(
      parseProposalRecipientDetails("Company: Acme\nCity: Paris"),
    ).toMatchObject({
      name: "",
      role: "",
      company: "Acme",
      city: "Paris",
    });
  });
});
