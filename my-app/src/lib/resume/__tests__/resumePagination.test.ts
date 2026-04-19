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
        experience: resumeMock.experience.slice(0, 1),
        projects: resumeMock.projects.slice(0, 1),
        achievements: [],
        achievementItems: [],
        certifications: [],
        affiliations: [],
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
});
