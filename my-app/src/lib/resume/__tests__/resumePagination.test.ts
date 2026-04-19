import { describe, expect, it } from "vitest";

import { planWorkshopResumePages } from "../resumePagination";
import { resumeMock } from "../../../features/verbati/resume/resume.mock";
import { getResumeTemplateDefinition } from "../../layout/resumeTemplates";

const workshopTemplate = getResumeTemplateDefinition(
  "workshop_resume_onecol_ats",
);

describe("resumePagination", () => {
  it("keeps a compact resume on a single page", () => {
    const result = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        skillItems: resumeMock.skillItems.slice(0, 3),
        languages: resumeMock.languages.slice(0, 1),
        experience: resumeMock.experience.slice(0, 1),
        projects: resumeMock.projects.slice(0, 1),
        education: resumeMock.education.slice(0, 1),
        achievements: [],
        achievementItems: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template: workshopTemplate,
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.entries.some((entry) => entry.kind === "profile")).toBe(
      true,
    );
  });

  it("splits long workshop content across multiple pages with section continuation", () => {
    const result = planWorkshopResumePages({
      data: {
        ...resumeMock,
        experience: Array.from({ length: 8 }, (_, index) => ({
          ...resumeMock.experience[index % resumeMock.experience.length]!,
          id: `exp-overflow-${index + 1}`,
          bullets: Array.from({ length: 5 }, (__, bulletIndex) =>
            `Oversized responsibility ${index + 1}.${bulletIndex + 1} with enough copy to force planner overflow and continued section layout.`,
          ),
        })),
        projects: Array.from({ length: 4 }, (_, index) => ({
          ...resumeMock.projects[index % resumeMock.projects.length]!,
          id: `project-overflow-${index + 1}`,
          description:
            "Large workshop project description repeated to increase the estimated page footprint and trigger continuation handling.",
        })),
      },
      template: workshopTemplate,
    });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages.some((page) => page.sections.some((section) => section.continued))).toBe(
      true,
    );
  });

  it("emits serializable committed pages and fragments for workshop export parity", () => {
    const result = planWorkshopResumePages({
      data: {
        ...resumeMock,
        experience: Array.from({ length: 6 }, (_, index) => ({
          ...resumeMock.experience[index % resumeMock.experience.length]!,
          id: `exp-committed-${index + 1}`,
          bullets: Array.from({ length: 4 }, (__, bulletIndex) =>
            `Committed workshop bullet ${index + 1}.${bulletIndex + 1} with enough content to keep the page planner splitting consistently.`,
          ),
        })),
        projects: Array.from({ length: 3 }, (_, index) => ({
          ...resumeMock.projects[index % resumeMock.projects.length]!,
          id: `project-committed-${index + 1}`,
          description:
            "Committed workshop project description repeated to force export page fragments across multiple pages.",
        })),
      },
      template: workshopTemplate,
    });

    expect(result.committedPages).toHaveLength(result.pages.length);
    expect(result.committedPages[0]?.fragments[0]).toEqual(
      expect.objectContaining({
        fragmentId: expect.any(String),
        kind: "profile",
        sectionType: "profile",
      }),
    );
    expect(
      result.committedPages.some((page) =>
        page.fragments.some((fragment) => fragment.continued),
      ),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(result.committedPages))).toEqual(
      result.committedPages,
    );
  });

  it("keeps borderline A4 workshop content on the first page instead of creating an orphan tail page", () => {
    const result = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        experience: resumeMock.experience.slice(0, 3),
        education: resumeMock.education.slice(0, 1),
        skillItems: resumeMock.skillItems.slice(0, 4),
        languages: resumeMock.languages.slice(0, 3),
        projects: [],
        achievements: [],
        achievementItems: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template: workshopTemplate,
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(["profile", "summary", "experience", "languages"]),
    );
  });
});
