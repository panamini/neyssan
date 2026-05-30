import { describe, expect, it } from "vitest";

import {
  buildProposalApplicantContactLine,
  buildProposalContactLineFromParts,
  hasManualProposalHeadingDraft,
  mergeProposalContactDefaults,
  parseProposalContactLine,
  resolveAutoHeadingField,
} from "../proposal-heading-state";

describe("proposal heading state", () => {
  it("builds applicant contact lines in the drawer/document order", () => {
    expect(
      buildProposalApplicantContactLine({
        website: "https://alex.example",
        email: "alex@example.com",
        location: "Paris",
        linkedin: "linkedin.com/in/alex",
        phone: "+33 6 00 00 00 00",
      }),
    ).toBe(
      "alex@example.com · +33 6 00 00 00 00 · Paris · linkedin.com/in/alex · https://alex.example",
    );
  });

  it("collapses missing contact parts without empty separators", () => {
    expect(
      buildProposalApplicantContactLine({
        email: "alex@example.com",
        location: "Paris",
        website: "https://alex.example",
      }),
    ).toBe("alex@example.com · Paris · https://alex.example");
  });

  it("keeps a literal LinkedIn drawer value in the structured contact fields", () => {
    expect(
      parseProposalContactLine(
        "eggyugyail@email.com · +38686834400002 · CA 90291 United States · LINKEDIN · PORTFOLIO.COM",
      ),
    ).toMatchObject({
      email: "eggyugyail@email.com",
      phone: "+38686834400002",
      location: "CA 90291 United States",
      linkedin: "LINKEDIN",
      website: "PORTFOLIO.COM",
    });
  });

  it("round-trips arbitrary profile and website drawer text", () => {
    const contactLine = buildProposalContactLineFromParts({
      email: "alex@example.com",
      phone: "+33 6 00 00 00 00",
      location: "Paris",
      linkedin: "public profile, Upwork on request",
      website: "portfolio, GitHub on request",
    });

    expect(contactLine).toBe(
      "alex@example.com · +33 6 00 00 00 00 · Paris · Profile: public profile, Upwork on request · Website: portfolio, GitHub on request",
    );
    expect(parseProposalContactLine(contactLine)).toMatchObject({
      email: "alex@example.com",
      phone: "+33 6 00 00 00 00",
      location: "Paris",
      linkedin: "public profile, Upwork on request",
      website: "portfolio, GitHub on request",
    });
  });

  it("treats Upwork text as profile contact metadata", () => {
    expect(
      parseProposalContactLine(
        "alex@example.com · Paris · Upwork: robert cooper · Website: portfolio text",
      ),
    ).toMatchObject({
      email: "alex@example.com",
      location: "Paris",
      linkedin: "Upwork: robert cooper",
      website: "portfolio text",
    });
  });

  it("recovers ordered unlabeled profile and website values from existing contact lines", () => {
    expect(
      parseProposalContactLine(
        "alex@example.com · +33 6 00 00 00 00 · Paris · public profile · portfolio text",
      ),
    ).toMatchObject({
      email: "alex@example.com",
      phone: "+33 6 00 00 00 00",
      location: "Paris",
      linkedin: "public profile",
      website: "portfolio text",
    });
  });

  it("keeps attached CV contact values ahead of settings defaults", () => {
    const merged = mergeProposalContactDefaults(
      {
        email: "cv@example.com",
        phone: "+33 6 11 11 11 11",
        linkedin: "linkedin.com/in/cv",
        website: "https://cv.example",
        location: "Lyon",
      },
      {
        email: "settings@example.com",
        phone: "+33 6 22 22 22 22",
        linkedin: "linkedin.com/in/settings",
        website: "https://settings.example",
        location: "Paris",
      },
    );

    expect(merged).toMatchObject({
      email: "cv@example.com",
      phone: "+33 6 11 11 11 11",
      linkedin: "linkedin.com/in/cv",
      website: "https://cv.example",
      location: "Lyon",
    });
  });

  it("uses settings contact defaults only for missing CV fields", () => {
    const merged = mergeProposalContactDefaults(
      {
        email: "cv@example.com",
        phone: null,
        linkedin: "",
        website: undefined,
        location: "Lyon",
      },
      {
        email: "settings@example.com",
        phone: "+33 6 22 22 22 22",
        linkedin: "linkedin.com/in/settings",
        website: "https://settings.example",
        location: "Paris",
      },
    );

    expect(merged).toMatchObject({
      email: "cv@example.com",
      phone: "+33 6 22 22 22 22",
      linkedin: "linkedin.com/in/settings",
      website: "https://settings.example",
      location: "Lyon",
    });
  });

  it("preserves manual heading overrides during regeneration", () => {
    expect(
      resolveAutoHeadingField({
        current: "Manual title",
        previousAuto: "Previous automatic title",
        nextAuto: "Next automatic title",
      }),
    ).toBe("Manual title");
  });

  it("refreshes empty or still-automatic heading values", () => {
    expect(
      resolveAutoHeadingField({
        current: "",
        previousAuto: "Previous automatic title",
        nextAuto: "Next automatic title",
      }),
    ).toBe("Next automatic title");
    expect(
      resolveAutoHeadingField({
        current: "Previous automatic title",
        previousAuto: "Previous automatic title",
        nextAuto: "Next automatic title",
      }),
    ).toBe("Next automatic title");
  });

  it("treats manually touched heading fields as a persistable draft even before body generation", () => {
    expect(
      hasManualProposalHeadingDraft({
        applicantName: false,
        applicantRole: false,
        applicantCompany: false,
        contactLine: true,
        letterDate: false,
        recipientDetails: true,
        subject: false,
        salutation: false,
        signatureSignOff: false,
      }),
    ).toBe(true);

    expect(
      hasManualProposalHeadingDraft({
        applicantName: false,
        applicantRole: false,
        applicantCompany: false,
        contactLine: false,
        letterDate: false,
        recipientDetails: false,
        subject: false,
        salutation: false,
        signatureSignOff: false,
      }),
    ).toBe(false);

    expect(
      hasManualProposalHeadingDraft({
        applicantName: false,
        applicantRole: false,
        applicantCompany: false,
        contactLine: false,
        letterDate: false,
        recipientDetails: false,
        subject: false,
        salutation: false,
        signatureSignOff: true,
      }),
    ).toBe(true);
  });
});
