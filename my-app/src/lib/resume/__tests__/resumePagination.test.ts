import { describe, expect, it } from "vitest";

import { planWorkshopResumePages } from "../resumePagination";
import { resumeMock } from "../../../features/verbati/resume/resume.mock";
import {
  getResumeTemplateDefinition,
  resolveWorkshopPreviewLayoutContract,
} from "../../layout/resumeTemplates";

const workshopTemplate = getResumeTemplateDefinition(
  "workshop_resume_onecol_ats",
);

function buildWorkshopTemplateOverride(
  overrides: Partial<typeof workshopTemplate.preview>,
) {
  return {
    ...workshopTemplate,
    preview: {
      ...workshopTemplate.preview,
      ...overrides,
    },
  };
}

function repeatWords(label: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join(" ");
}

function makeTextBlock(label: string, usefulLines: number) {
  return repeatWords(label, usefulLines * 10);
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

function buildPlannerData() {
  return {
    ...resumeMock,
    metadata: resumeMock.metadata.slice(0, 1),
    contact: resumeMock.contact.slice(0, 2),
    skillItems: [],
    languages: [],
    education: [],
    achievements: [],
    achievementItems: [],
    certifications: [],
    affiliations: [],
    hobbyItems: [],
    hobbies: [],
    projects: [],
    textSections: [],
  };
}

function buildWorkshopScreenshotFixture() {
  return {
    ...buildPlannerData(),
    achievements: [],
    achievementItems: [],
    summary: Array.from({ length: 30 }, (_, index) => `summary-${index + 1}`).join(" "),
    experience: [
      {
        ...resumeMock.experience[0]!,
        id: "exp-screenshot-1",
        role: "1",
        company: "Company 1",
        description: makeDenseTokenBlock("1", 40),
        bullets: [],
      },
      {
        ...resumeMock.experience[0]!,
        id: "exp-screenshot-2",
        role: "2",
        company: "Company 2",
        description: makeDenseTokenBlock("2", 20),
        bullets: [],
      },
    ],
    education: [
      {
        ...resumeMock.education[0]!,
        id: "edu-screenshot-1",
        degree: "Degree",
        school: "School",
        period: "2019-2021",
      },
    ],
  };
}

function summarizeCommittedPages(
  result: ReturnType<typeof planWorkshopResumePages>,
) {
  return result.committedPages.map((page) =>
    page.fragments.map(
      (fragment) => `${fragment.kind}${fragment.continued ? ":cont" : ""}`,
    ),
  );
}

function buildAchievementsAdditionalInformationFixture() {
  return {
    ...buildPlannerData(),
    summary: "",
    experience: [],
    certifications: Array.from({ length: 6 }, (_, index) => ({
      id: `cert-${index + 1}`,
      sectionId: "certifications-1",
      sectionType: "certifications" as const,
      sectionTitle: "Certifications",
      sectionOrder: 70,
      name: repeatWords(`cert-name-${index + 1}`, 4),
      issuer: repeatWords(`cert-issuer-${index + 1}`, 4),
      meta: repeatWords(`cert-meta-${index + 1}`, 2),
    })),
    achievementItems: Array.from({ length: 6 }, (_, index) => ({
      id: `ach-${index + 1}`,
      sectionId: "achievements-1",
      sectionType: "achievements" as const,
      sectionTitle: "Achievements",
      sectionOrder: 80,
      text: repeatWords(`achievement-${index + 1}`, 48),
    })),
    achievements: Array.from({ length: 6 }, (_, index) =>
      repeatWords(`achievement-${index + 1}`, 48),
    ),
    textSections: [
      {
        id: "text-1",
        sectionId: "additional-information-1",
        sectionType: "additional_information" as const,
        sectionTitle: "Additional Information",
        sectionOrder: 110,
        text: repeatWords("additional", 18),
      },
      {
        id: "text-2",
        sectionId: "custom-1",
        sectionType: "custom" as const,
        sectionTitle: "Custom Section",
        sectionOrder: 120,
        text: repeatWords("custom", 18),
      },
    ],
  };
}

function buildCertificationsAchievementsFixture() {
  return {
    ...buildPlannerData(),
    summary: "",
    experience: [],
    certifications: Array.from({ length: 7 }, (_, index) => ({
      id: `cert-long-${index + 1}`,
      sectionId: "certifications-1",
      sectionType: "certifications" as const,
      sectionTitle: "Certifications",
      sectionOrder: 70,
      name: repeatWords(`cert-long-name-${index + 1}`, 40),
      issuer: repeatWords(`cert-long-issuer-${index + 1}`, 24),
      meta: repeatWords(`cert-long-meta-${index + 1}`, 16),
    })),
    achievementItems: Array.from({ length: 4 }, (_, index) => ({
      id: `ach-short-${index + 1}`,
      sectionId: "achievements-1",
      sectionType: "achievements" as const,
      sectionTitle: "Achievements",
      sectionOrder: 80,
      text: repeatWords(`achievement-short-${index + 1}`, 18),
    })),
    achievements: Array.from({ length: 4 }, (_, index) =>
      repeatWords(`achievement-short-${index + 1}`, 18),
    ),
  };
}

function buildSelectedProjectsHobbiesFixture() {
  return {
    ...buildPlannerData(),
    summary: "",
    experience: [],
    projects: Array.from({ length: 5 }, (_, index) => ({
      ...resumeMock.projects[0]!,
      id: `proj-${index + 1}`,
      sectionId: "projects-1",
      sectionType: "projects" as const,
      sectionTitle: "Selected Projects",
      sectionOrder: 50,
      name: `Project ${index + 1}`,
      description: repeatWords(`project-${index + 1}`, 70),
      skills: ["React", "TypeScript", "Node"],
    })),
    hobbyItems: Array.from({ length: 6 }, (_, index) => ({
      id: `hobby-${index + 1}`,
      sectionId: "hobbies-1",
      sectionType: "hobbies" as const,
      sectionTitle: "Hobbies",
      sectionOrder: 100,
      name: repeatWords(`hobby-${index + 1}`, 14),
    })),
    hobbies: Array.from({ length: 6 }, (_, index) =>
      repeatWords(`hobby-${index + 1}`, 14),
    ),
  };
}

describe("resumePagination", () => {
  it("reads workshop section and experience spacing estimates from the shared template layout contract", () => {
    const tunedTemplate = buildWorkshopTemplateOverride({
      workshopSectionShellGapMm: 4.1,
      workshopSectionContentGapMm: 5.4,
      workshopExperienceBlockGapMm: 2.2,
      workshopExperienceMetaGapMm: 1.1,
    });
    const baselineLayout = resolveWorkshopPreviewLayoutContract(workshopTemplate);
    const tunedLayout = resolveWorkshopPreviewLayoutContract(tunedTemplate);
    const data = {
      ...buildPlannerData(),
      summary: "",
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-contract-1",
          description: makeTextBlock("contract-description-a", 2),
          bullets: [makeTextBlock("contract-bullet-a", 2)],
        },
        {
          ...resumeMock.experience[1 % resumeMock.experience.length]!,
          id: "exp-contract-2",
          description: makeTextBlock("contract-description-b", 2),
          bullets: [makeTextBlock("contract-bullet-b", 2)],
        },
      ],
    };

    const baselinePlan = planWorkshopResumePages({
      data,
      template: workshopTemplate,
    });
    const tunedPlan = planWorkshopResumePages({
      data,
      template: tunedTemplate,
    });

    const expectedDeltaMm =
      (tunedLayout.sectionShellGapMm - baselineLayout.sectionShellGapMm) +
      (tunedLayout.sectionContentGapMm - baselineLayout.sectionContentGapMm) +
      4 * (tunedLayout.experienceBlockGapMm - baselineLayout.experienceBlockGapMm) +
      2 * (tunedLayout.experienceMetaGapMm - baselineLayout.experienceMetaGapMm);

    expect(tunedPlan.pages).toHaveLength(1);
    expect(baselinePlan.pages).toHaveLength(1);
    expect(tunedPlan.pages[0]?.estimatedHeight).toBeCloseTo(
      (baselinePlan.pages[0]?.estimatedHeight ?? 0) + expectedDeltaMm,
      6,
    );
  });

  it("reads workshop compact meta spacing estimates from the shared template layout contract", () => {
    const tunedTemplate = buildWorkshopTemplateOverride({
      workshopCompactMetaGapMm: 1.35,
    });
    const baselineLayout = resolveWorkshopPreviewLayoutContract(workshopTemplate);
    const tunedLayout = resolveWorkshopPreviewLayoutContract(tunedTemplate);
    const data = {
      ...buildPlannerData(),
      summary: "",
      experience: [],
      education: [
        {
          ...resumeMock.education[0]!,
          id: "edu-contract-1",
        },
      ],
      projects: [
        {
          ...resumeMock.projects[0]!,
          id: "project-contract-1",
        },
      ],
    };

    const baselinePlan = planWorkshopResumePages({
      data,
      template: workshopTemplate,
    });
    const tunedPlan = planWorkshopResumePages({
      data,
      template: tunedTemplate,
    });

    const expectedDeltaMm =
      2 * (tunedLayout.compactMetaGapMm - baselineLayout.compactMetaGapMm);

    expect(tunedPlan.pages).toHaveLength(1);
    expect(baselinePlan.pages).toHaveLength(1);
    expect(tunedPlan.pages[0]?.estimatedHeight).toBeCloseTo(
      (baselinePlan.pages[0]?.estimatedHeight ?? 0) + expectedDeltaMm,
      6,
    );
  });

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

  it("keeps a fitting experience entry as a single fragment with ordered content blocks", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Compact summary.",
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-fit",
            description: makeTextBlock("fit-description", 3),
            bullets: [
              makeTextBlock("fit-bullet-a", 2),
              makeTextBlock("fit-bullet-b", 2),
            ],
          },
        ],
      },
      template: workshopTemplate,
    });

    const experienceEntry = result.pages[0]?.sections
      .find((section) => section.key === "experience")
      ?.entries[0];
    const committedExperience = result.committedPages[0]?.fragments.find(
      (fragment) => fragment.kind === "experience",
    );
    const committedItem =
      committedExperience?.kind === "experience"
        ? committedExperience.items[0]
        : null;

    expect(result.pages).toHaveLength(1);
    expect(experienceEntry).toEqual(
      expect.objectContaining({
        kind: "experience",
        sourceEntryId: "exp-fit",
        continued: false,
        estimatedHeight: expect.any(Number),
      }),
    );
    expect(committedItem).toEqual(
      expect.objectContaining({
        id: "exp-fit",
        continued: false,
        role: expect.any(String),
        company: expect.any(String),
        location: expect.any(String),
        period: expect.any(String),
        blocks: [
          {
            kind: "text",
            text: makeTextBlock("fit-description", 3),
          },
          {
            kind: "bullet",
            text: makeTextBlock("fit-bullet-a", 2),
          },
          {
            kind: "bullet",
            text: makeTextBlock("fit-bullet-b", 2),
          },
        ],
      }),
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

  it("splits a slight experience overflow between text sub-blocks instead of pushing the whole entry", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("overflow-summary", 26),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-sub-block-split",
            description: [
              makeTextBlock("overflow-segment-a", 4),
              makeTextBlock("overflow-segment-b", 16),
            ].join("\n\n"),
            bullets: [makeTextBlock("overflow-bullet", 4)],
          },
        ],
      },
      template: workshopTemplate,
    });

    const firstPageExperience = result.committedPages[0]?.fragments.find(
      (fragment) => fragment.kind === "experience",
    );
    const continuedExperience = result.committedPages
      .slice(1)
      .flatMap((page) => page.fragments)
      .find(
        (fragment) => fragment.kind === "experience" && fragment.items[0]?.continued,
      );

    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages[0]?.sections.map((section) => section.key)).toContain(
      "experience",
    );
    expect(firstPageExperience).toEqual(
      expect.objectContaining({
        kind: "experience",
        items: [
          expect.objectContaining({
            id: "exp-sub-block-split",
            continued: false,
            blocks: expect.any(Array),
          }),
        ],
      }),
    );
    expect(continuedExperience).toEqual(
      expect.objectContaining({
        kind: "experience",
        continued: true,
        items: [
          expect.objectContaining({
            id: "exp-sub-block-split",
            continued: true,
            blocks: expect.arrayContaining([
              {
                kind: "text",
                text: makeTextBlock("overflow-segment-b", 16),
              },
            ]),
          }),
        ],
      }),
    );
    const firstPageBlocks =
      firstPageExperience?.kind === "experience"
        ? firstPageExperience.items[0]?.blocks ?? []
        : [];
    const secondPageBlocks =
      continuedExperience?.kind === "experience"
        ? continuedExperience.items[0]?.blocks ?? []
        : [];

    expect(firstPageBlocks.map((block) => block.text)).toEqual(
      expect.arrayContaining([makeTextBlock("overflow-segment-a", 4)]),
    );
    expect(firstPageBlocks.map((block) => block.text)).not.toContain(
      makeTextBlock("overflow-bullet", 4),
    );
    expect(secondPageBlocks.map((block) => block.text)).toContain(
      makeTextBlock("overflow-segment-b", 16),
    );
    expect(secondPageBlocks.map((block) => block.text)).not.toContain(
      makeTextBlock("overflow-bullet", 4),
    );
  });

  it("does not let later sections outrun pending experience content", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("fill-summary", 26),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-fill-current-page",
            description: [
              makeTextBlock("fill-segment-a", 4),
              makeTextBlock("fill-segment-b", 16),
            ].join("\n\n"),
            bullets: [makeTextBlock("fill-segment-bullet", 4)],
          },
        ],
        projects: [
          {
            ...resumeMock.projects[0]!,
            id: "project-after-split",
            description: "A short project should use the leftover space on page one.",
          },
        ],
      },
      template: workshopTemplate,
    });
    const firstProjectPageIndex = result.committedPages.findIndex((page) =>
      page.fragments.some((fragment) => fragment.kind === "selected_projects"),
    );
    const firstContinuedExperiencePageIndex = result.committedPages.findIndex((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "experience" &&
          fragment.items.some(
            (item) => item.id === "exp-fill-current-page" && item.continued,
          ),
      ),
    );

    expect(firstContinuedExperiencePageIndex).toBeGreaterThanOrEqual(0);
    expect(firstProjectPageIndex).toBeGreaterThan(firstContinuedExperiencePageIndex);
  });

  it("emits continued experience fragments for long entries without repeating earlier text", () => {
    const descriptionSegments = [
      makeTextBlock("continued-segment-a", 4),
      makeTextBlock("continued-segment-b", 4),
      makeTextBlock("continued-segment-c", 4),
    ];
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("continued-summary", 24),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-continued",
            description: descriptionSegments.join("\n\n"),
            bullets: Array.from({ length: 4 }, (_, index) =>
              makeTextBlock(`continued-bullet-${index + 1}`, 3),
            ),
          },
        ],
      },
      template: workshopTemplate,
    });

    const experienceItems = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .filter((item) => item.id === "exp-continued");

    expect(experienceItems.length).toBeGreaterThan(1);
    expect(experienceItems[0]?.continued).toBe(false);
    expect(experienceItems.slice(1).every((item) => item.continued)).toBe(true);
    expect(experienceItems.map((item) => item.blocks.map((block) => block.text))).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([descriptionSegments[0]!]),
        expect.arrayContaining([descriptionSegments[1]!]),
      ]),
    );
  });

  it("uses an intra-line text split only when both sides meet the minimum viable continuation rules", () => {
    const longSingleBlock = makeTextBlock("intra-line-segment", 20);
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("intra-line-summary", 30),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-intra-line",
            description: longSingleBlock,
            bullets: [],
          },
        ],
      },
      template: workshopTemplate,
    });

    const experienceItems = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .filter((item) => item.id === "exp-intra-line");

    expect(experienceItems).toHaveLength(2);
    expect(experienceItems[0]?.blocks).toHaveLength(1);
    expect(experienceItems[1]?.blocks).toHaveLength(1);
    expect(experienceItems[0]?.blocks[0]?.kind).toBe("text");
    expect(experienceItems[1]?.blocks[0]?.kind).toBe("text");
    expect(experienceItems[0]?.blocks[0]?.text).not.toBe(longSingleBlock);
    expect(experienceItems[1]?.blocks[0]?.text).not.toBe(longSingleBlock);
    expect((experienceItems[0]?.blocks[0]?.text.length ?? 0)).toBeGreaterThan(
      experienceItems[1]?.blocks[0]?.text.length ?? 0,
    );
  });

  it("continues a long unbroken experience block across pages instead of placing it intact and cropping it", () => {
    const longUnbrokenBlock = makeDenseTokenBlock("1", 80);
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("dense-summary", 30),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-token",
            description: longUnbrokenBlock,
            bullets: [],
          },
        ],
      },
      template: workshopTemplate,
    });

    const denseFragments = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .filter((item) => item.id === "exp-dense-token");

    expect(denseFragments.length).toBeGreaterThan(1);
    expect(denseFragments[0]?.continued).toBe(false);
    expect(denseFragments.slice(1).every((item) => item.continued)).toBe(true);
    expect(
      denseFragments.every((item) => item.blocks.every((block) => block.text.length >= 210)),
    ).toBe(true);
    expect(denseFragments.map((item) => item.blocks[0]?.text).join("")).toBe(
      longUnbrokenBlock,
    );
    expect(denseFragments.every((item) => item.blocks[0]?.text !== longUnbrokenBlock)).toBe(
      true,
    );
    expect(denseFragments[0]?.blocks[0]?.text.length).toBeGreaterThan(
      denseFragments[1]?.blocks[0]?.text.length ?? 0,
    );
  });

  it("continues a long unbroken experience bullet across pages instead of moving it whole or cropping it", () => {
    const denseBullet = makeDenseTokenBlock("9", 80);
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("dense-bullet-summary", 30),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-bullet",
            description: "",
            bullets: [denseBullet],
          },
        ],
      },
      template: workshopTemplate,
    });

    const denseBulletFragments = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .filter((item) => item.id === "exp-dense-bullet");

    expect(denseBulletFragments.length).toBeGreaterThan(1);
    expect(denseBulletFragments[0]?.continued).toBe(false);
    expect(denseBulletFragments.slice(1).every((item) => item.continued)).toBe(true);
    expect(
      denseBulletFragments.every((item) =>
        item.blocks.every((block) => block.kind === "bullet" && block.text.length >= 210),
      ),
    ).toBe(true);
    expect(denseBulletFragments.map((item) => item.blocks[0]?.text).join("")).toBe(
      denseBullet,
    );
    expect(denseBulletFragments[0]?.blocks[0]?.text.length).toBeGreaterThan(
      denseBulletFragments[1]?.blocks[0]?.text.length ?? 0,
    );
  });

  it("keeps dense entry continuation ahead of later experience entries in the exact 1-2-3 ordering case", () => {
    const denseEntry = makeDenseTokenBlock("1", 80);
    const secondEntry = makeDenseTokenBlock("2", 8);
    const thirdEntry = makeDenseTokenBlock("3", 8);
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeTextBlock("ordered-dense-summary", 30),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-1",
            role: "1",
            description: denseEntry,
            bullets: [],
          },
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-2",
            role: "2",
            description: secondEntry,
            bullets: [],
          },
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-3",
            role: "3",
            description: thirdEntry,
            bullets: [],
          },
        ],
      },
      template: workshopTemplate,
    });

    const committedExperienceItems = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items);
    const firstContinuedPage = result.committedPages.find((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "experience" &&
          fragment.items.some((item) => item.id === "exp-dense-1" && item.continued),
      ),
    );

    expect(result.committedPages[0]?.fragments.some((fragment) => fragment.kind === "experience")).toBe(
      true,
    );
    expect(
      committedExperienceItems.findIndex((item) => item.id === "exp-dense-2"),
    ).toBeGreaterThan(
      committedExperienceItems.findLastIndex((item) => item.id === "exp-dense-1"),
    );
    expect(
      committedExperienceItems.findIndex((item) => item.id === "exp-dense-3"),
    ).toBeGreaterThan(
      committedExperienceItems.findLastIndex((item) => item.id === "exp-dense-2"),
    );
    expect(
      firstContinuedPage?.fragments
        .filter((fragment) => fragment.kind === "experience")
        .flatMap((fragment) => fragment.items)[0],
    ).toEqual(
      expect.objectContaining({
        id: "exp-dense-1",
        continued: true,
      }),
    );
    expect(
      result.committedPages[0]?.fragments
        .filter((fragment) => fragment.kind === "experience")
        .flatMap((fragment) => fragment.items)
        .some((item) => item.id === "exp-dense-1" && item.blocks[0]?.text !== denseEntry),
    ).toBe(true);
  });

  it("keeps the first dense screenshot entry intact when the taller workshop page box fits it cleanly", () => {
    const debugTrace = { splitDecisions: [] };
    const result = planWorkshopResumePages({
      data: buildWorkshopScreenshotFixture(),
      template: workshopTemplate,
      stylePreset: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      },
      debugTrace,
    });

    const firstPageExperience =
      result.committedPages[0]?.fragments.find(
        (fragment) => fragment.kind === "experience",
      )?.kind === "experience"
        ? result.committedPages[0]?.fragments.find(
            (fragment) => fragment.kind === "experience",
          )
        : null;
    const secondPageExperience = result.committedPages[1]?.fragments.find(
      (fragment) => fragment.kind === "experience",
    );
    const firstPageItem =
      firstPageExperience?.kind === "experience"
        ? firstPageExperience.items[0]
        : null;
    const continuedItem =
      secondPageExperience?.kind === "experience"
        ? secondPageExperience.items[0]
        : null;

    expect(debugTrace.splitDecisions).toHaveLength(0);
    expect(firstPageItem).toEqual(
      expect.objectContaining({
        id: "exp-screenshot-1",
        continued: false,
        blocks: expect.arrayContaining([
          expect.objectContaining({
            kind: "text",
            text: makeDenseTokenBlock("1", 40),
          }),
        ]),
      }),
    );
    expect(continuedItem).toEqual(
      expect.objectContaining({
        id: "exp-screenshot-2",
        continued: false,
        blocks: expect.arrayContaining([
          expect.objectContaining({
            kind: "text",
            text: makeDenseTokenBlock("2", 20),
          }),
        ]),
      }),
    );
    expect(
      firstPageExperience?.kind === "experience"
        ? firstPageExperience.items[0]?.blocks[0]?.text.length
        : null,
    ).toBe(2800);
    expect(
      firstPageExperience?.kind === "experience"
        ? firstPageExperience.items.map((item) => item.id)
        : [],
    ).toEqual(["exp-screenshot-1"]);
    expect(
      secondPageExperience?.kind === "experience"
        ? secondPageExperience.items.map((item) => item.id)
        : [],
    ).toEqual(["exp-screenshot-2"]);
    expect(
      result.committedPages[1]?.fragments.map((fragment) => fragment.kind),
    ).toEqual(["experience", "education"]);
  });

  it("bails out safely for oversized atomic non-experience entries", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "",
        projects: [
          {
            ...resumeMock.projects[0]!,
            id: "project-oversized-atomic",
            description: makeTextBlock("oversized-project", 80),
          },
        ],
      },
      template: workshopTemplate,
    });

    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.pages.at(-1)?.sections.some((section) => section.key === "selected_projects")).toBe(
      true,
    );
  });

  it("does not let achievements resume after additional information has started", () => {
    const result = planWorkshopResumePages({
      data: buildAchievementsAdditionalInformationFixture(),
      template: workshopTemplate,
    });

    expect(summarizeCommittedPages(result)).toEqual([
      ["profile", "certifications", "achievements"],
      ["achievements:cont", "additional_information"],
      ["additional_information:cont"],
    ]);
  });

  it("does not let certifications resume after achievements have started", () => {
    const result = planWorkshopResumePages({
      data: buildCertificationsAchievementsFixture(),
      template: workshopTemplate,
    });

    expect(summarizeCommittedPages(result)).toEqual([
      ["profile", "certifications"],
      ["certifications:cont"],
      ["certifications:cont", "achievements"],
      ["achievements:cont"],
    ]);
  });

  it("does not let selected projects resume after hobbies have started", () => {
    const result = planWorkshopResumePages({
      data: buildSelectedProjectsHobbiesFixture(),
      template: workshopTemplate,
    });

    expect(summarizeCommittedPages(result)).toEqual([
      ["profile", "selected_projects"],
      ["selected_projects:cont", "hobbies"],
      ["hobbies:cont"],
    ]);
  });

  it("emits serializable committed pages and fragments for workshop export parity", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        experience: Array.from({ length: 6 }, (_, index) => ({
          ...resumeMock.experience[index % resumeMock.experience.length]!,
          id: `exp-committed-${index + 1}`,
          description: [
            makeTextBlock(`committed-segment-${index + 1}-a`, 3),
            makeTextBlock(`committed-segment-${index + 1}-b`, 3),
          ].join("\n\n"),
          bullets: Array.from({ length: 4 }, (__, bulletIndex) =>
            makeTextBlock(
              `committed-bullet-${index + 1}-${bulletIndex + 1}`,
              2,
            ),
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
    const committedExperience = result.committedPages
      .flatMap((page) => page.fragments)
      .find((fragment) => fragment.kind === "experience");
    expect(committedExperience).toEqual(
      expect.objectContaining({
        kind: "experience",
        items: expect.arrayContaining([
          expect.objectContaining({
            blocks: expect.any(Array),
            continued: expect.any(Boolean),
          }),
        ]),
      }),
    );
    expect(JSON.parse(JSON.stringify(result.committedPages))).toEqual(
      result.committedPages,
    );
  });
});
