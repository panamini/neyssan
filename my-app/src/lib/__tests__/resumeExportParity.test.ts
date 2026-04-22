import { describe, expect, it } from "vitest";

import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import {
  generateCvTemplate,
  makeAffiliationItem,
  makeHobbyItem,
  makeTextSection,
} from "../cv-template";
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

function buildCompactAtomicParityCv() {
  const currentCv = generateCvTemplate("Workshop compact parity");
  currentCv.metadata.verbatiStyle = {
    familyId: "workshop",
    layout: "workshop",
    typography: "quiet-editorial",
    palette: "sauge",
  };

  const educationSection = currentCv.sections.find((section) => section.type === "education");
  if (educationSection?.structuredContent && Array.isArray(educationSection.structuredContent)) {
    educationSection.structuredContent = Array.from({ length: 4 }, (_, index) => ({
      ...(educationSection.structuredContent[0] ?? {
        id: `edu-${index + 1}`,
        institution: "",
        degree: "",
        fieldOfStudy: "",
        isCurrent: false,
      }),
      id: `edu-export-tail-${index + 1}`,
      institution: `School ${index + 1}`,
      degree: `Degree ${index + 1}`,
      fieldOfStudy: `Field ${index + 1}`,
      startDate: undefined,
      endDate: undefined,
      isCurrent: false,
      grade: "",
      description: undefined,
    }));
  }

  const skillsSection = currentCv.sections.find((section) => section.type === "skills");
  if (skillsSection?.structuredContent && Array.isArray(skillsSection.structuredContent)) {
    skillsSection.structuredContent = Array.from({ length: 18 }, (_, index) => ({
      ...(skillsSection.structuredContent[0] ?? {
        id: `skill-${index + 1}`,
        name: "",
        level: "Intermediate",
      }),
      id: `skill-export-tail-${index + 1}`,
      name: `Skill ${index + 1}`,
      level: "Intermediate",
    }));
  }

  const languagesSection = currentCv.sections.find((section) => section.type === "languages");
  if (languagesSection?.structuredContent && Array.isArray(languagesSection.structuredContent)) {
    languagesSection.structuredContent = Array.from({ length: 32 }, (_, index) => ({
      ...(languagesSection.structuredContent[0] ?? {
        id: `language-${index + 1}`,
        name: "",
        level: "Intermediate",
      }),
      id: `language-export-tail-${index + 1}`,
      name: `Language ${index + 1}`,
      level: index % 2 === 0 ? "Native" : "Professional",
    }));
  }

  const achievementsSection = currentCv.sections.find((section) => section.type === "achievements");
  if (
    achievementsSection?.structuredContent &&
    Array.isArray(achievementsSection.structuredContent)
  ) {
    achievementsSection.structuredContent = Array.from({ length: 5 }, (_, index) => ({
      id: `achievement-export-tail-${index + 1}`,
      text: `Achievement ${index + 1}`,
    }));
  }

  const certificationsSection = currentCv.sections.find(
    (section) => section.type === "certifications",
  );
  if (
    certificationsSection?.structuredContent &&
    Array.isArray(certificationsSection.structuredContent)
  ) {
    certificationsSection.structuredContent = Array.from({ length: 10 }, (_, index) => ({
      ...(certificationsSection.structuredContent[0] ?? {
        id: `cert-${index + 1}`,
        certificationName: "",
        issuingOrganization: "",
        credentialId: "",
      }),
      id: `cert-export-tail-${index + 1}`,
      certificationName: `Certification ${index + 1}`,
      issuingOrganization: `Issuer ${index + 1}`,
      issueDate: undefined,
      expirationDate: null,
      credentialId: `cred-${index + 1}`,
    }));
  }

  const affiliationsSection = makeTextSection("Affiliations");
  affiliationsSection.structuredContent = Array.from({ length: 6 }, (_, index) => ({
    ...makeAffiliationItem(),
    id: `affiliation-export-tail-${index + 1}`,
    organizationName: `Organization ${index + 1}`,
    roleOrMembershipType: `Role ${index + 1}`,
    startDate: undefined,
    endDate: null,
    isCurrent: false,
    notes: `Affiliation note ${index + 1}`,
  }));
  currentCv.sections.push(affiliationsSection);

  const hobbiesSection = makeTextSection("Hobbies");
  hobbiesSection.structuredContent = Array.from({ length: 3 }, (_, index) => ({
    ...makeHobbyItem(),
    id: `hobby-export-tail-${index + 1}`,
    name: `Hobby ${index + 1}`,
  }));
  currentCv.sections.push(hobbiesSection);

  return currentCv;
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
        responsibilitiesRich:
          item.responsibilitiesRich?.blocks.map((block) =>
            block.kind === "paragraph"
              ? {
                  kind: block.kind,
                  runs: block.runs.map((run) => ({ ...run })),
                }
              : {
                  kind: block.kind,
                  items: block.items.map((richItem) => ({
                    runs: richItem.runs.map((run) => ({ ...run })),
                  })),
                },
          ) ?? [],
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
        responsibilitiesRich:
          item.responsibilitiesRich?.blocks.map((block) =>
            block.kind === "paragraph"
              ? {
                  kind: block.kind,
                  runs: block.runs.map((run) => ({ ...run })),
                }
              : {
                  kind: block.kind,
                  items: block.items.map((richItem) => ({
                    runs: richItem.runs.map((run) => ({ ...run })),
                  })),
                },
          ) ?? [],
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

  it("keeps workshop rich responsibilities committed shape aligned between planner and export", () => {
    const currentCv = generateCvTemplate("Workshop rich parity");
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
            id: "exp-rich-parity",
            company: "",
            position: "",
            startDate: "2023-01-01T00:00:00.000Z",
            isCurrent: false,
            currentlyWorking: false,
            achievements: [],
          }),
          id: "exp-rich-parity",
          company: "Parity Studio",
          position: "Platform Lead",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          responsibilities: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Directed the " },
                  {
                    type: "text",
                    text: "migration roadmap",
                    marks: [{ type: "bold" }],
                  },
                  { type: "text", text: " across three squads." },
                ],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Reduced " },
                          {
                            type: "text",
                            text: "rollback incidents",
                            marks: [{ type: "italic" }],
                          },
                          { type: "text", text: " by 38%." },
                        ],
                      },
                    ],
                  },
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Formalized " },
                          {
                            type: "text",
                            text: "launch checklists",
                            marks: [{ type: "underline" }],
                          },
                          { type: "text", text: " across squads." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
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

    const plannerRichItems = directPlan.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        responsibilitiesRich:
          item.responsibilitiesRich?.blocks.map((block) =>
            block.kind === "paragraph"
              ? {
                  kind: block.kind,
                  runs: block.runs.map((run) => ({ ...run })),
                }
              : {
                  kind: block.kind,
                  items: block.items.map((richItem) => ({
                    runs: richItem.runs.map((run) => ({ ...run })),
                  })),
                },
          ) ?? [],
      }));
    const exportRichItems = exportSource?.committedPages
      ?.flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .map((item) => ({
        id: item.id,
        responsibilitiesRich:
          item.responsibilitiesRich?.blocks.map((block) =>
            block.kind === "paragraph"
              ? {
                  kind: block.kind,
                  runs: block.runs.map((run) => ({ ...run })),
                }
              : {
                  kind: block.kind,
                  items: block.items.map((richItem) => ({
                    runs: richItem.runs.map((run) => ({ ...run })),
                  })),
                },
          ) ?? [],
      }));

    expect(exportRichItems).toEqual(plannerRichItems);
  });

  it("keeps compact atomic workshop fragments aligned between planner and export", () => {
    const currentCv = buildCompactAtomicParityCv();
    const canonical = buildCanonicalResumeRenderModelFromCv(currentCv);
    const directPlan = planWorkshopResumePages({
      data: canonical,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
    });
    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const compactKinds = [
      "education",
      "skills",
      "languages",
      "achievements",
      "certifications",
      "affiliations",
      "hobbies",
    ] as const;

    for (const kind of compactKinds) {
      const plannerIds = directPlan.committedPages.flatMap((page) =>
        page.fragments.flatMap((fragment) =>
          fragment.kind === kind && "items" in fragment
            ? fragment.items.map((item) => item.id)
            : [],
        ),
      );
      const exportIds = exportSource?.committedPages?.flatMap((page) =>
        page.fragments.flatMap((fragment) =>
          fragment.kind === kind && "items" in fragment
            ? fragment.items.map((item) => item.id)
            : [],
        ),
      );

      expect(exportIds).toEqual(plannerIds);
    }
  });
});
