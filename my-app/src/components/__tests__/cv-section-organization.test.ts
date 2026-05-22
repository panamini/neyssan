import { describe, expect, it } from "vitest";

import {
  CANONICAL_SECTION_ORDER,
  compareSectionsByRecommendedOrder,
  insertSectionByCanonicalOrder,
  isSectionReorderLocked,
  normalizeCvSectionOrder,
} from "../../lib/cv-section-organization";
import type { CvSection } from "../../types/cvDocument";

function makeSection(id: string, type: string, title: string): CvSection {
  return {
    id,
    type,
    title,
    blocks: [],
    structuredContent: [],
  } as CvSection;
}

describe("cv-section-organization", () => {
  it("uses the single canonical section order source of truth", () => {
    expect(CANONICAL_SECTION_ORDER).toEqual([
      "profile",
      "summary",
      "experience",
      "achievements",
      "projects",
      "certifications",
      "skills",
      "education",
      "languages",
      "affiliations",
      "additional_information",
      "hobbies",
      "custom",
    ]);
  });

  it("sorts recommended order from the canonical ranking without dynamic overrides", () => {
    const sections = [
      makeSection("education", "education", "Education"),
      makeSection("projects", "projects", "Projects"),
      makeSection("experience", "experience", "Experience"),
      makeSection("affiliations", "text", "Affiliations"),
      makeSection("summary", "summary", "Summary"),
      makeSection("profile", "profile", "Profile"),
      makeSection("custom", "text", "Speaking"),
      makeSection("skills", "skills", "Skills"),
    ];

    const orderedTitles = [...sections]
      .sort(compareSectionsByRecommendedOrder)
      .map((section) => section.title);

    expect(orderedTitles).toEqual([
      "Profile",
      "Summary",
      "Experience",
      "Projects",
      "Skills",
      "Education",
      "Affiliations",
      "Speaking",
    ]);
  });

  it("normalizes locked top sections while preserving the saved order of remaining sections", () => {
    const sections = [
      makeSection("summary", "summary", "Summary"),
      makeSection("experience", "experience", "Experience"),
      makeSection("profile", "profile", "Profile"),
      makeSection("education", "education", "Education"),
      makeSection("skills", "skills", "Skills"),
    ];

    const normalized = normalizeCvSectionOrder(sections);

    expect(normalized.map((section) => section.title)).toEqual([
      "Profile",
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ]);
    expect(normalized.map((section) => section.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps reorder locks limited to profile and summary", () => {
    expect(isSectionReorderLocked(makeSection("profile", "profile", "Profile"))).toBe(
      true,
    );
    expect(isSectionReorderLocked(makeSection("summary", "summary", "Summary"))).toBe(
      true,
    );
    expect(
      isSectionReorderLocked(makeSection("experience", "experience", "Experience")),
    ).toBe(false);
  });

  it.each([
    {
      title: "Achievements",
      newSection: makeSection("achievements", "achievements", "Achievements"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("skills", "skills", "Skills"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Achievements",
        "Skills",
      ],
    },
    {
      title: "Projects",
      newSection: makeSection("projects", "projects", "Projects"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("skills", "skills", "Skills"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Projects",
        "Skills",
      ],
    },
    {
      title: "Certifications",
      newSection: makeSection(
        "certifications",
        "certifications",
        "Certifications",
      ),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("skills", "skills", "Skills"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Certifications",
        "Skills",
      ],
    },
    {
      title: "Languages",
      newSection: makeSection("languages", "languages", "Languages"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("education", "education", "Education"),
        makeSection("hobbies", "text", "Hobbies"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Education",
        "Languages",
        "Hobbies",
      ],
    },
    {
      title: "Affiliations",
      newSection: makeSection("affiliations", "text", "Affiliations"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("languages", "languages", "Languages"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Languages",
        "Affiliations",
      ],
    },
    {
      title: "Additional information",
      newSection: makeSection(
        "additional-information",
        "text",
        "Additional Information",
      ),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("languages", "languages", "Languages"),
        makeSection("hobbies", "text", "Hobbies"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Languages",
        "Additional Information",
        "Hobbies",
      ],
    },
    {
      title: "Hobbies",
      newSection: makeSection("hobbies", "text", "Hobbies"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("languages", "languages", "Languages"),
        makeSection("custom", "text", "Speaking"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Languages",
        "Hobbies",
        "Speaking",
      ],
    },
    {
      title: "Custom section",
      newSection: makeSection("custom-new", "text", "Custom section"),
      existingSections: [
        makeSection("profile", "profile", "Profile"),
        makeSection("summary", "summary", "Summary"),
        makeSection("experience", "experience", "Experience"),
        makeSection("hobbies", "text", "Hobbies"),
        makeSection("custom", "text", "Speaking"),
      ],
      expectedOrder: [
        "Profile",
        "Summary",
        "Experience",
        "Hobbies",
        "Speaking",
        "Custom section",
      ],
    },
  ])("inserts $title at its canonical position", ({
    newSection,
    existingSections,
    expectedOrder,
  }) => {
    expect(
      insertSectionByCanonicalOrder(existingSections, newSection).map(
        (section) => section.title,
      ),
    ).toEqual(expectedOrder);
  });
});
