import { describe, expect, it } from "vitest";

import { buildTypedSectionsFromNormalized, buildTypedSectionsFromReviewerSections } from "../cv/mapping-utils";

describe("buildTypedSectionsFromNormalized direct section materialization", () => {
  it("materializes projects, certifications, hobbies, affiliations, and additional information from raw sections", () => {
    const sections = buildTypedSectionsFromNormalized({
      rawSections: [
        { label: "Projects", content: "Parser reliability sprint\nReduced import recovery volume" },
        { label: "Certifications", content: "AWS Certified Developer\nAmazon Web Services" },
        { label: "Hobbies", content: "Chess, Hiking" },
        { label: "Affiliations", content: "Member, ACM" },
        { label: "Additional Information", content: "Available for relocation" },
      ],
    });

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "projects", title: "Projects" }),
        expect.objectContaining({ type: "certifications", title: "Certifications" }),
        expect.objectContaining({ type: "text", title: "Hobbies" }),
        expect.objectContaining({ type: "text", title: "Affiliations" }),
        expect.objectContaining({ type: "text", title: "Additional Information" }),
      ]),
    );
  });

  it("preserves explicit reviewer sections instead of collapsing them into experience or achievements", () => {
    const sections = buildTypedSectionsFromReviewerSections([
      { id: "1", title: "Projects", content: "Trust sprint parser improvements", fieldKey: "projects" },
      { id: "2", title: "Certifications", content: "AWS Certified Developer", fieldKey: "certifications" },
      { id: "3", title: "Hobbies", content: "Chess, Hiking", fieldKey: "hobbies" },
      { id: "4", title: "Affiliations", content: "Member, ACM", fieldKey: "affiliations" },
      { id: "5", title: "Additional Information", content: "Available for travel", fieldKey: "additional_information" },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "projects" }),
        expect.objectContaining({ type: "certifications" }),
        expect.objectContaining({ type: "text", title: "Hobbies" }),
        expect.objectContaining({ type: "text", title: "Affiliations" }),
        expect.objectContaining({ type: "text", title: "Additional Information" }),
      ]),
    );
  });
});
