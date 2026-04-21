import { describe, expect, it } from "vitest";

import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import { generateCvTemplate } from "../cv-template";
import { buildResumeExportSource } from "../document-export-models";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { planWorkshopResumePages } from "../resume/resumePagination";

function repeatWords(label: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join(" ");
}

function makeTextBlock(label: string, usefulLines: number) {
  return repeatWords(label, usefulLines * 10);
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

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
        responsibilities: [
          makeTextBlock(`parity-segment-${index + 1}-a`, 4),
          makeTextBlock(`parity-segment-${index + 1}-b`, 4),
          ...Array.from({ length: 3 }, (__, bulletIndex) =>
            makeTextBlock(
              `parity-bullet-${index + 1}-${bulletIndex + 1}`,
              3,
            ),
          ),
        ].join("\n"),
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
    const exportExperienceItems = exportSource?.committedPages
      ?.flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        continued: item.continued,
        blocks: item.blocks.map((block) => ({
          kind: block.kind,
          text: block.text,
        })),
      }));
    const plannerExperienceItems = directPlan.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        continued: item.continued,
        blocks: item.blocks.map((block) => ({
          kind: block.kind,
          text: block.text,
        })),
      }));

    expect(exportExperienceItems).toEqual(plannerExperienceItems);
  });

  it("keeps dense-token workshop continuation boundaries aligned between planner and export", () => {
    const currentCv = generateCvTemplate("Workshop dense parity");
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
      experienceSection.structuredContent = [
        {
          ...(experienceSection.structuredContent[0] ?? {
            id: "exp-dense-1",
            company: "",
            position: "",
            startDate: "2023-01-01T00:00:00.000Z",
            isCurrent: false,
            currentlyWorking: false,
            achievements: [],
          }),
          id: "exp-dense-1",
          company: "Parity Dense Co",
          position: "1",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          responsibilities: makeDenseTokenBlock("1", 40),
          achievements: [],
        },
        {
          ...(experienceSection.structuredContent[0] ?? {
            id: "exp-dense-2",
            company: "",
            position: "",
            startDate: "2023-01-01T00:00:00.000Z",
            isCurrent: false,
            currentlyWorking: false,
            achievements: [],
          }),
          id: "exp-dense-2",
          company: "Parity Dense Co",
          position: "2",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          responsibilities: makeDenseTokenBlock("2", 8),
          achievements: [],
        },
        {
          ...(experienceSection.structuredContent[0] ?? {
            id: "exp-dense-3",
            company: "",
            position: "",
            startDate: "2023-01-01T00:00:00.000Z",
            isCurrent: false,
            currentlyWorking: false,
            achievements: [],
          }),
          id: "exp-dense-3",
          company: "Parity Dense Co",
          position: "3",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          responsibilities: makeDenseTokenBlock("3", 8),
          achievements: [],
        },
      ];
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

    const plannerDenseItems = directPlan.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        continued: item.continued,
        blocks: item.blocks.map((block) => block.text),
      }));
    const exportDenseItems = exportSource?.committedPages
      ?.flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        continued: item.continued,
        blocks: item.blocks.map((block) => block.text),
      }));

    expect(exportDenseItems).toEqual(plannerDenseItems);
    expect(
      plannerDenseItems?.findIndex((item) => item.id === "exp-dense-2"),
    ).toBeGreaterThan(
      plannerDenseItems?.findLastIndex((item) => item.id === "exp-dense-1") ?? -1,
    );
  });
});
