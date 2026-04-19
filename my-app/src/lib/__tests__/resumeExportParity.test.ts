import { describe, expect, it } from "vitest";

import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import { generateCvTemplate } from "../cv-template";
import { buildResumeExportSource } from "../document-export-models";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { planWorkshopResumePages } from "../resume/resumePagination";

describe("resumeExportParity", () => {
  it("keeps workshop export page boundaries aligned with the shared planner model", () => {
    const currentCv = generateCvTemplate("Workshop parity");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    };

    const experienceSection = currentCv.sections.find(
      (section) => section.type === "experience",
    );
    if (experienceSection?.structuredContent && Array.isArray(experienceSection.structuredContent)) {
      experienceSection.structuredContent = Array.from({ length: 8 }, (_, index) => ({
        ...(experienceSection.structuredContent[0] ?? {
          id: `exp-${index + 1}`,
          company: "",
          position: "",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          achievements: [],
        }),
        id: `exp-${index + 1}`,
        company: `Parity Corp ${index + 1}`,
        position: `Lead ${index + 1}`,
        startDate: "2023-01-01T00:00:00.000Z",
        isCurrent: false,
        currentlyWorking: false,
        responsibilities: Array.from({ length: 5 }, (__, bulletIndex) =>
          `Planner/export parity responsibility ${index + 1}.${bulletIndex + 1} with enough copy to keep page splits deterministic.`,
        ).join("\n"),
        achievements: [],
      }));
    }

    const canonical = buildCanonicalResumeRenderModelFromCv(currentCv);
    const directPlan = planWorkshopResumePages({
      data: canonical,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
    });
    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });

    expect(exportSource?.committedPages).toHaveLength(directPlan.pageCount);
    expect(exportSource?.committedPages?.map((page) => page.fragments.length)).toEqual(
      directPlan.pages.map((page) => page.sections.length),
    );
    expect(
      exportSource?.committedPages?.map((page) =>
        page.fragments.map((fragment) => fragment.kind),
      ),
    ).toEqual(
      directPlan.pages.map((page) => page.sections.map((section) => section.kind)),
    );
  });
});
