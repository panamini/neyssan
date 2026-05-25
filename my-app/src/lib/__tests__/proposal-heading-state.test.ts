import { describe, expect, it } from "vitest";

import {
  buildProposalApplicantContactLine,
  mergeProposalContactDefaults,
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
});
