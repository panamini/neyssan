import { describe, expect, it } from "vitest";

import { normalizeResumePreviewTokens } from "../../layout/documentTokenNormalizer";
import { ptToMm } from "../../layout/documentTokens";
import { planWorkshopResumePages } from "../resumePagination";
import { resumeMock } from "../../../features/verbati/resume/resume.mock";
import { buildCanonicalResumeRenderModelFromCv } from "../../buildCanonicalResumeRenderModel";
import type { CvDocument } from "../../../types/cvDocument";
import {
  getResumeTemplateDefinition,
  resolveWorkshopPreviewLayoutContract,
} from "../../layout/resumeTemplates";
import { resolveWorkshopHeadingFitContract } from "../workshopHeadingContract";

const workshopTemplate = getResumeTemplateDefinition(
  "workshop_resume_onecol_ats",
);
const workshopTwoColumnTemplate = getResumeTemplateDefinition(
  "workshop_resume_twocol_ats",
);
const maggieLetterTemplate = getResumeTemplateDefinition(
  "maggie_letter_resume",
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

type CompactAtomicTailCase = {
  kind:
    | "education"
    | "skills"
    | "languages"
    | "achievements"
    | "certifications"
    | "affiliations"
    | "hobbies";
  buildData: () => typeof resumeMock;
  expectedItemIds: string[];
};

function listFragmentItemIds(fragment: { items: Array<{ id: string }> }) {
  return fragment.items.map((item) => item.id);
}

function buildCompactAtomicTailCases(): CompactAtomicTailCase[] {
  const educationItems = Array.from({ length: 4 }, (_, index) => ({
    ...resumeMock.education[0]!,
    id: `edu-tail-${index + 1}`,
    degree: `Degree ${index + 1}`,
    school: `School ${index + 1}`,
    period: `201${index}-201${index + 1}`,
  }));
  const skillItems = Array.from({ length: 18 }, (_, index) => ({
    ...resumeMock.skillItems[index % resumeMock.skillItems.length]!,
    id: `skill-tail-${index + 1}`,
    name: `Skill ${index + 1}`,
  }));
  const languageItems = Array.from({ length: 32 }, (_, index) => ({
    ...resumeMock.languages[index % resumeMock.languages.length]!,
    id: `language-tail-${index + 1}`,
    name: `Language ${index + 1}`,
    level: index % 2 === 0 ? "Native" : "Professional",
  }));
  const achievementItems = Array.from({ length: 5 }, (_, index) => ({
    ...resumeMock.achievementItems[index % resumeMock.achievementItems.length]!,
    id: `achievement-tail-${index + 1}`,
    text: `Achievement ${index + 1}`,
  }));
  const certificationItems = Array.from({ length: 10 }, (_, index) => ({
    ...resumeMock.certifications[index % resumeMock.certifications.length]!,
    id: `cert-tail-${index + 1}`,
    name: `Certification ${index + 1}`,
    issuer: `Issuer ${index + 1}`,
  }));
  const affiliationItems = Array.from({ length: 6 }, (_, index) => ({
    ...resumeMock.affiliations[index % resumeMock.affiliations.length]!,
    id: `affiliation-tail-${index + 1}`,
    organizationName: `Organization ${index + 1}`,
    roleOrMembershipType: `Role ${index + 1}`,
    notes: `Affiliation note ${index + 1}`,
  }));
  const hobbyItems = Array.from({ length: 3 }, (_, index) => ({
    ...resumeMock.hobbyItems[index % resumeMock.hobbyItems.length]!,
    id: `hobby-tail-${index + 1}`,
    name: `Hobby ${index + 1}`,
  }));

  return [
    {
      kind: "education",
      buildData: () => ({
        ...resumeMock,
        education: educationItems,
      }),
      expectedItemIds: educationItems.map((item) => item.id),
    },
    {
      kind: "skills",
      buildData: () => ({
        ...resumeMock,
        education: educationItems,
        skillItems,
        skills: skillItems.map((item) => item.name),
      }),
      expectedItemIds: skillItems.map((item) => item.id),
    },
    {
      kind: "languages",
      buildData: () => ({
        ...resumeMock,
        languages: languageItems,
      }),
      expectedItemIds: languageItems.map((item) => item.id),
    },
    {
      kind: "achievements",
      buildData: () => ({
        ...resumeMock,
        achievementItems,
        achievements: achievementItems.map((item) => item.text),
      }),
      expectedItemIds: achievementItems.map((item) => item.id),
    },
    {
      kind: "certifications",
      buildData: () => ({
        ...resumeMock,
        certifications: certificationItems,
      }),
      expectedItemIds: certificationItems.map((item) => item.id),
    },
    {
      kind: "affiliations",
      buildData: () => ({
        ...resumeMock,
        affiliations: affiliationItems,
      }),
      expectedItemIds: affiliationItems.map((item) => item.id),
    },
    {
      kind: "hobbies",
      buildData: () => ({
        ...resumeMock,
        hobbyItems,
        hobbies: hobbyItems.map((item) => item.name),
      }),
      expectedItemIds: hobbyItems.map((item) => item.id),
    },
  ];
}

function buildSelectedProjectsTailFixture(projectCount = 3) {
  return {
    ...resumeMock,
    projects: Array.from({ length: projectCount }, (_, index) => ({
      ...resumeMock.projects[index % resumeMock.projects.length]!,
      id: `project-tail-${index + 1}`,
      name: `Project ${index + 1}`,
      meta: `Meta ${index + 1}`,
      description: `Selected project ${index + 1} ${repeatWords(
        `detail-${index + 1}`,
        70,
      )}`,
    })),
  };
}

function buildSkillsTailSelectedProjectsFixture() {
  const education = Array.from({ length: 4 }, (_, index) => ({
    ...resumeMock.education[0]!,
    id: `edu-tail-${index + 1}`,
    degree: `Degree ${index + 1}`,
    school: `School ${index + 1}`,
    period: `201${index}-201${index + 1}`,
  }));
  const skillItems = Array.from({ length: 18 }, (_, index) => ({
    ...resumeMock.skillItems[index % resumeMock.skillItems.length]!,
    id: `skill-tail-${index + 1}`,
    name: `Skill ${index + 1}`,
  }));

  return {
    ...resumeMock,
    education,
    skillItems,
    skills: skillItems.map((item) => item.name),
    projects: buildSelectedProjectsTailFixture(2).projects,
  };
}

function buildLanguagesTailSelectedProjectsFixture() {
  const languages = Array.from({ length: 32 }, (_, index) => ({
    ...resumeMock.languages[index % resumeMock.languages.length]!,
    id: `language-tail-${index + 1}`,
    name: `Language ${index + 1}`,
    level: index % 2 === 0 ? "Native" : "Professional",
  }));

  return {
    ...resumeMock,
    languages,
    projects: buildSelectedProjectsTailFixture(2).projects,
  };
}

function buildAchievementsTailHobbiesFixture() {
  const achievementItems = Array.from({ length: 5 }, (_, index) => ({
    ...resumeMock.achievementItems[index % resumeMock.achievementItems.length]!,
    id: `achievement-tail-${index + 1}`,
    text: `Achievement ${index + 1}`,
  }));
  const hobbyItems = Array.from({ length: 2 }, (_, index) => ({
    ...resumeMock.hobbyItems[index % resumeMock.hobbyItems.length]!,
    id: `hobby-achievement-tail-${index + 1}`,
    name: `Hobby ${index + 1}`,
  }));

  return {
    ...resumeMock,
    achievementItems,
    achievements: achievementItems.map((item) => item.text),
    hobbyItems,
    hobbies: hobbyItems.map((item) => item.name),
  };
}

function buildCustomTextTailFixture() {
  return {
    ...resumeMock,
    textSections: resumeMock.textSections.map((item, index) =>
      index === 0
        ? {
            ...item,
            id: "custom-tail-1",
            sectionType: "custom" as const,
            sectionTitle: "Custom Section",
          }
        : item,
    ),
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

  it("reads workshop compact list spacing estimates from the shared template layout contract for languages and hobbies", () => {
    const tunedTemplate = buildWorkshopTemplateOverride({
      experienceBulletsGapMm: 2.1,
    });
    const baselineLayout = resolveWorkshopPreviewLayoutContract(workshopTemplate);
    const tunedLayout = resolveWorkshopPreviewLayoutContract(tunedTemplate);
    const data = {
      ...buildPlannerData(),
      summary: "",
      experience: [],
      languages: resumeMock.languages.slice(0, 2),
      hobbyItems: resumeMock.hobbyItems.slice(0, 2),
      hobbies: resumeMock.hobbies.slice(0, 2),
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
      2 * (tunedLayout.listGapMm - baselineLayout.listGapMm);

    expect(tunedPlan.pages).toHaveLength(1);
    expect(baselinePlan.pages).toHaveLength(1);
    expect(tunedPlan.pages[0]?.estimatedHeight).toBeCloseTo(
      (baselinePlan.pages[0]?.estimatedHeight ?? 0) + expectedDeltaMm,
      6,
    );
  });

  it("reads workshop heading-fit estimates from the canonical preview token contract", () => {
    const tunedTemplate = buildWorkshopTemplateOverride({
      workshopSectionTitleReductionMm: 1.4,
      workshopExperienceHeadingSizeAdjustMm: 0.35,
      workshopExperienceHeadingLineHeight: 1.4,
    });
    const baselineTokens = normalizeResumePreviewTokens({
      resumeTemplateId: workshopTemplate.id,
      template: workshopTemplate,
    });
    const tunedTokens = normalizeResumePreviewTokens({
      resumeTemplateId: tunedTemplate.id,
      template: tunedTemplate,
    });
    const baselineHeading = resolveWorkshopHeadingFitContract(baselineTokens);
    const tunedHeading = resolveWorkshopHeadingFitContract(tunedTokens);
    const layout = resolveWorkshopPreviewLayoutContract(workshopTemplate);
    const titleLineHeight = baselineTokens.flow.type.title.lineHeight ?? 1.1;
    const titleSizeMm = ptToMm(
      (baselineTokens.flow.type.title.sizePt ?? 0) +
        (baselineTokens.flow.density.titleAdjustPt ?? 0),
    );
    const bodySizeMm = ptToMm(
      (baselineTokens.flow.type.body.sizePt ?? 0) +
        (baselineTokens.flow.density.bodyAdjustPt ?? 0),
    );
    const baselineSectionHeaderHeight = Math.max(
      6,
      Math.max(0, titleSizeMm - baselineHeading.sectionTitleReductionMm) *
        titleLineHeight +
        layout.sectionShellGapMm,
    );
    const tunedSectionHeaderHeight = Math.max(
      6,
      Math.max(0, titleSizeMm - tunedHeading.sectionTitleReductionMm) *
        titleLineHeight +
        layout.sectionShellGapMm,
    );
    const baselineExperienceHeadingLineHeightMm =
      (bodySizeMm + baselineHeading.experienceHeadingSizeAdjustMm) *
      baselineHeading.experienceHeadingLineHeight;
    const tunedExperienceHeadingLineHeightMm =
      (bodySizeMm + tunedHeading.experienceHeadingSizeAdjustMm) *
      tunedHeading.experienceHeadingLineHeight;
    const data = {
      ...buildPlannerData(),
      summary: "",
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-heading-contract-1",
          role: "R",
          company: "C",
          location: "L",
          period: "P",
          description: "Short description.",
          bullets: [],
        },
      ],
      education: [
        {
          ...resumeMock.education[0]!,
          id: "edu-heading-contract-1",
          degree: "D",
          school: "S",
          period: "P",
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

    expect(baselineHeading).toEqual({
      sectionTitleReductionMm: 0.95,
      experienceHeadingSizeAdjustMm: 0.2,
      experienceHeadingLineHeight: 1.25,
      bottomFitSafetyMm: 0.5,
    });
    expect(tunedHeading).toEqual({
      sectionTitleReductionMm: 1.4,
      experienceHeadingSizeAdjustMm: 0.35,
      experienceHeadingLineHeight: 1.4,
      bottomFitSafetyMm: 0.5,
    });
    expect(tunedPlan.pages[0]?.estimatedHeight).toBeCloseTo(
      (baselinePlan.pages[0]?.estimatedHeight ?? 0) +
        2 * (tunedSectionHeaderHeight - baselineSectionHeaderHeight) +
        (tunedExperienceHeadingLineHeightMm -
          baselineExperienceHeadingLineHeightMm),
      6,
    );
  });

  it("reads workshop bottom-fit safety from the canonical preview token contract", () => {
    const tunedTemplate = buildWorkshopTemplateOverride({
      workshopBottomFitSafetyMm: 4,
    });
    const baselineTokens = normalizeResumePreviewTokens({
      resumeTemplateId: workshopTemplate.id,
      template: workshopTemplate,
    });
    const tunedTokens = normalizeResumePreviewTokens({
      resumeTemplateId: tunedTemplate.id,
      template: tunedTemplate,
    });
    const baselineDebugTrace = { splitDecisions: [] };
    const tunedDebugTrace = { splitDecisions: [] };
    const data = {
      ...buildPlannerData(),
      summary: makeTextBlock("bottom-fit-summary", 30),
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-bottom-fit-1",
          role: "1",
          description: makeDenseTokenBlock("1", 80),
          bullets: [],
        },
      ],
    };

    planWorkshopResumePages({
      data,
      template: workshopTemplate,
      debugTrace: baselineDebugTrace,
    });
    planWorkshopResumePages({
      data,
      template: tunedTemplate,
      debugTrace: tunedDebugTrace,
    });

    expect(resolveWorkshopHeadingFitContract(baselineTokens).bottomFitSafetyMm).toBe(
      0.5,
    );
    expect(resolveWorkshopHeadingFitContract(tunedTokens).bottomFitSafetyMm).toBe(4);
    expect(baselineDebugTrace.splitDecisions.length).toBeGreaterThan(0);
    expect(tunedDebugTrace.splitDecisions.length).toBeGreaterThan(0);
    expect(
      tunedDebugTrace.splitDecisions[0]?.availableUsefulLines,
    ).toBeLessThan(baselineDebugTrace.splitDecisions[0]?.availableUsefulLines ?? 0);
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

  it.each(buildCompactAtomicTailCases())(
    "moves $kind to the next page when the current page would otherwise leave a one-item tail",
    ({ kind, buildData, expectedItemIds }) => {
      const result = planWorkshopResumePages({
        data: buildData(),
        template: workshopTemplate,
      });

      const sectionFragments = result.committedPages.flatMap((page) =>
        page.fragments
          .filter((fragment) => fragment.kind === kind)
          .map((fragment) => ({ pageIndex: page.index, fragment })),
      );

      expect(sectionFragments).toHaveLength(1);
      expect(sectionFragments[0]?.fragment.continued).toBe(false);
      expect(sectionFragments[0]?.fragment).toHaveProperty("items");
      expect(
        listFragmentItemIds(
          sectionFragments[0]?.fragment as { items: Array<{ id: string }> },
        ),
      ).toEqual(expectedItemIds);
      expect(
        result.committedPages.some((page) =>
          page.fragments.some((fragment) => fragment.kind === kind && fragment.continued),
        ),
      ).toBe(false);
    },
  );

  it("keeps selected projects contiguous so achievements does not start before the section is fully complete", () => {
    const result = planWorkshopResumePages({
      data: buildSelectedProjectsTailFixture(4),
      template: workshopTemplate,
    });

    const projectFragments = result.committedPages.flatMap((page) =>
      page.fragments
        .filter((fragment) => fragment.kind === "selected_projects")
        .map((fragment) => ({ pageIndex: page.index, fragment })),
    );
    const achievementPageIndices = result.committedPages.flatMap((page, pageIndex) =>
      page.fragments.some((fragment) => fragment.kind === "achievements")
        ? [pageIndex]
        : [],
    );
    const firstAchievementPageIndex = achievementPageIndices[0];
    const lastProjectPageIndex = projectFragments.at(-1)?.pageIndex;

    expect(projectFragments).toHaveLength(2);
    expect(projectFragments[0]?.pageIndex).toBe(1);
    expect(projectFragments[1]?.pageIndex).toBe(2);
    expect(projectFragments[0]?.fragment.continued).toBe(false);
    expect(projectFragments[1]?.fragment.continued).toBe(true);
    expect(
      projectFragments[0]?.fragment.kind === "selected_projects"
        ? projectFragments[0].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      projectFragments[1]?.fragment.kind === "selected_projects"
        ? projectFragments[1].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["project-tail-3", "project-tail-4"]);
    expect(firstAchievementPageIndex).toBe(lastProjectPageIndex);
    expect(
      result.committedPages[1]?.fragments.some(
        (fragment) => fragment.kind === "achievements",
      ),
    ).toBe(false);
    expect(result.committedPages[2]?.fragments.slice(0, 3).map((fragment) => fragment.kind))
      .toEqual(["selected_projects", "achievements", "certifications"]);
  });

  it("moves a two-card selected projects section to the next page when dense skills packing would otherwise leave an isolated continued card", () => {
    const result = planWorkshopResumePages({
      data: buildSkillsTailSelectedProjectsFixture(),
      template: workshopTemplate,
    });

    const projectFragments = result.committedPages.flatMap((page) =>
      page.fragments
        .filter((fragment) => fragment.kind === "selected_projects")
        .map((fragment) => ({ pageIndex: page.index, fragment })),
    );

    expect(projectFragments).toHaveLength(1);
    expect(projectFragments[0]?.pageIndex).toBe(2);
    expect(projectFragments[0]?.fragment.continued).toBe(false);
    expect(
      projectFragments[0]?.fragment.kind === "selected_projects"
        ? projectFragments[0].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      result.committedPages[1]?.fragments.some(
        (fragment) => fragment.kind === "selected_projects",
      ),
    ).toBe(false);
  });

  it("moves a two-card selected projects section to the next page when dense languages packing would otherwise leave an isolated continued card", () => {
    const result = planWorkshopResumePages({
      data: buildLanguagesTailSelectedProjectsFixture(),
      template: workshopTemplate,
    });

    const projectFragments = result.committedPages.flatMap((page) =>
      page.fragments
        .filter((fragment) => fragment.kind === "selected_projects")
        .map((fragment) => ({ pageIndex: page.index, fragment })),
    );

    expect(projectFragments).toHaveLength(1);
    expect(projectFragments[0]?.pageIndex).toBe(2);
    expect(projectFragments[0]?.fragment.continued).toBe(false);
    expect(
      projectFragments[0]?.fragment.kind === "selected_projects"
        ? projectFragments[0].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      result.committedPages[1]?.fragments.some(
        (fragment) => fragment.kind === "selected_projects",
      ),
    ).toBe(false);
  });

  it("keeps the first fitting hobby on the current page and continues the remainder before additional information after dense achievements packing", () => {
    const result = planWorkshopResumePages({
      data: buildAchievementsTailHobbiesFixture(),
      template: workshopTemplate,
    });

    const hobbyFragments = result.committedPages.flatMap((page) =>
      page.fragments
        .filter((fragment) => fragment.kind === "hobbies")
        .map((fragment) => ({ pageIndex: page.index, fragment })),
    );

    expect(hobbyFragments).toHaveLength(2);
    expect(hobbyFragments[0]?.pageIndex).toBe(1);
    expect(hobbyFragments[0]?.fragment.continued).toBe(false);
    expect(
      hobbyFragments[0]?.fragment.kind === "hobbies"
        ? hobbyFragments[0].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["hobby-achievement-tail-1"]);
    expect(
      hobbyFragments[1]?.pageIndex,
    ).toBe(2);
    expect(hobbyFragments[1]?.fragment.continued).toBe(true);
    expect(
      hobbyFragments[1]?.fragment.kind === "hobbies"
        ? hobbyFragments[1].fragment.items.map((item) => item.id)
        : [],
    ).toEqual(["hobby-achievement-tail-2"]);
    expect(result.committedPages[2]?.fragments.map((fragment) => fragment.kind)).toEqual([
      "hobbies",
      "additional_information",
    ]);
  });

  it("keeps hobbies on the current page when the full hobbies block fits before trailing additional information", () => {
    const result = planWorkshopResumePages({
      data: resumeMock,
      template: workshopTemplate,
    });

    expect(result.committedPages[1]?.fragments.map((fragment) => fragment.kind)).toEqual([
      "skills",
      "languages",
      "selected_projects",
      "achievements",
      "certifications",
      "affiliations",
      "hobbies",
    ]);
    expect(result.committedPages[2]?.fragments.map((fragment) => fragment.kind)).toEqual([
      "additional_information",
    ]);
  });

  it("lets custom text sections continue on the next page without re-pulling hobbies off the current page", () => {
    const result = planWorkshopResumePages({
      data: buildCustomTextTailFixture(),
      template: workshopTemplate,
    });

    const lastPage = result.committedPages.at(-1);
    const customFragment = lastPage?.fragments.find(
      (fragment) => fragment.kind === "additional_information",
    );

    expect(result.committedPages[1]?.fragments.at(-1)?.kind).toBe("hobbies");
    expect(lastPage?.fragments.map((fragment) => fragment.kind)).toEqual([
      "additional_information",
    ]);
    expect(customFragment?.title).toBe("Custom Section");
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

  it("plans blank-CV-created filled sections through the canonical render model onto page 2", () => {
    const doc: CvDocument = {
      id: "blank-overflow",
      title: "Blank overflow",
      metadata: {
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-1",
              name: "Ada Lovelace",
              desiredPosition: "Engineer",
              email: "ada@example.com",
            },
          ],
        },
        {
          id: "summary",
          title: "Summary",
          type: "summary",
          blocks: [],
          structuredContent: [
            {
              id: "summary-1",
              summary: makeTextBlock("blank-summary", 16),
            },
          ],
        },
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: Array.from({ length: 6 }, (_, index) => ({
            id: `exp-${index + 1}`,
            position: `Role ${index + 1}`,
            company: `Company ${index + 1}`,
            startDate: "2020",
            endDate: "2026",
            responsibilities: Array.from({ length: 4 }, (__, bulletIndex) =>
              `Blank-created responsibility ${index + 1}.${bulletIndex + 1} with enough detail to consume workshop page height.`,
            ),
          })),
        },
        {
          id: "projects",
          title: "Projects",
          type: "projects",
          blocks: [],
          structuredContent: [
            {
              id: "project-1",
              name: "Overflow project",
              description: "Project added from a blank CV after the first page is full.",
            },
          ],
        },
      ],
    };

    const data = buildCanonicalResumeRenderModelFromCv(doc, { includeDrafts: true });
    const result = planWorkshopResumePages({ data, template: workshopTemplate });

    expect(result.committedPages.length).toBeGreaterThan(1);
    expect(
      result.committedPages
        .slice(1)
        .some((page) =>
          page.fragments.some(
            (fragment) =>
              fragment.kind === "selected_projects" &&
              fragment.items.some((item) => item.id === "project-1"),
          ),
        ),
    ).toBe(true);
  });

  it("preserves paragraph-only responsibilitiesRich in planner and committed experience fragments", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Compact summary.",
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-rich-paragraph-only",
            description: "",
            bullets: [],
            responsibilitiesRich: {
              blocks: [
                {
                  kind: "paragraph",
                  runs: [
                    { text: "Led " },
                    { text: "platform migration", bold: true },
                    { text: " planning." },
                  ],
                },
              ],
            },
          },
        ],
      },
      template: workshopTemplate,
    });

    const plannerItem = result.pages[0]?.entries.find(
      (entry) => entry.kind === "experience" && entry.sourceEntryId === "exp-rich-paragraph-only",
    );
    const committedItem = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find((item) => item.id === "exp-rich-paragraph-only");

    expect(plannerItem?.kind).toBe("experience");
    if (plannerItem?.kind !== "experience") {
      throw new Error("Expected experience planner item");
    }

    expect(plannerItem.blocks.map((block) => block.text)).toEqual([
      "Led platform migration planning.",
    ]);
    expect(plannerItem.responsibilitiesRich).toEqual({
      blocks: [
        {
          kind: "paragraph",
          sourceBlockIndex: 0,
          runs: [
            { text: "Led " },
            { text: "platform migration", bold: true },
            { text: " planning." },
          ],
        },
      ],
    });
    expect(committedItem?.responsibilitiesRich).toEqual(
      plannerItem.responsibilitiesRich,
    );
  });

  it("preserves bullet-only responsibilitiesRich order in planner and committed fragments", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Compact summary.",
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-rich-bullets-only",
            description: "",
            bullets: [],
            responsibilitiesRich: {
              blocks: [
                {
                  kind: "bullet_list",
                  items: [
                    { runs: [{ text: "Reduced rollback incidents by 38%." }] },
                    { runs: [{ text: "Defined launch checklists for every squad." }] },
                  ],
                },
              ],
            },
          },
        ],
      },
      template: workshopTemplate,
    });

    const plannerItem = result.pages[0]?.entries.find(
      (entry) => entry.kind === "experience" && entry.sourceEntryId === "exp-rich-bullets-only",
    );
    const committedItem = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find((item) => item.id === "exp-rich-bullets-only");

    expect(plannerItem?.kind).toBe("experience");
    if (plannerItem?.kind !== "experience") {
      throw new Error("Expected experience planner item");
    }

    expect(plannerItem.blocks.map((block) => block.kind)).toEqual(["bullet", "bullet"]);
    expect(plannerItem.blocks.map((block) => block.text)).toEqual([
      "Reduced rollback incidents by 38%.",
      "Defined launch checklists for every squad.",
    ]);
    expect(committedItem?.responsibilitiesRich).toEqual({
      blocks: [
        {
          kind: "bullet_list",
          sourceBlockIndex: 0,
          items: [
            {
              runs: [{ text: "Reduced rollback incidents by 38%." }],
              sourceBlockIndex: 0,
              sourceItemIndex: 0,
            },
            {
              runs: [{ text: "Defined launch checklists for every squad." }],
              sourceBlockIndex: 0,
              sourceItemIndex: 1,
            },
          ],
        },
      ],
    });
  });

  it("preserves mixed responsibilitiesRich block order and inline marks in committed fragments", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Compact summary.",
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-rich-mixed",
            description: "",
            bullets: [],
            responsibilitiesRich: {
              blocks: [
                {
                  kind: "paragraph",
                  runs: [
                    { text: "Directed the " },
                    { text: "migration roadmap", bold: true },
                    { text: " across three squads." },
                  ],
                },
                {
                  kind: "bullet_list",
                  items: [
                    {
                      runs: [
                        { text: "Reduced " },
                        { text: "rollback incidents", italic: true },
                        { text: " by 38%." },
                      ],
                    },
                    {
                      runs: [
                        { text: "Formalized " },
                        { text: "launch checklists", underline: true },
                        { text: " across squads." },
                      ],
                    },
                  ],
                },
                {
                  kind: "paragraph",
                  runs: [{ text: "Partnered closely with design and QA." }],
                },
              ],
            },
          },
        ],
      },
      template: workshopTemplate,
    });

    const committedItem = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find((item) => item.id === "exp-rich-mixed");

    expect(committedItem?.blocks.map((block) => `${block.kind}:${block.text}`)).toEqual([
      "text:Directed the migration roadmap across three squads.",
      "bullet:Reduced rollback incidents by 38%.",
      "bullet:Formalized launch checklists across squads.",
      "text:Partnered closely with design and QA.",
    ]);
    expect(committedItem?.responsibilitiesRich).toEqual({
      blocks: [
        {
          kind: "paragraph",
          sourceBlockIndex: 0,
          runs: [
            { text: "Directed the " },
            { text: "migration roadmap", bold: true },
            { text: " across three squads." },
          ],
        },
        {
          kind: "bullet_list",
          sourceBlockIndex: 1,
          items: [
            {
              runs: [
                { text: "Reduced " },
                { text: "rollback incidents", italic: true },
                { text: " by 38%." },
              ],
              sourceBlockIndex: 1,
              sourceItemIndex: 0,
            },
            {
              runs: [
                { text: "Formalized " },
                { text: "launch checklists", underline: true },
                { text: " across squads." },
              ],
              sourceBlockIndex: 1,
              sourceItemIndex: 1,
            },
          ],
        },
        {
          kind: "paragraph",
          sourceBlockIndex: 2,
          runs: [{ text: "Partnered closely with design and QA." }],
        },
      ],
    });
  });

  it("preserves bullet-list then paragraph order in continued committed rich fragments", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "",
        education: [resumeMock.education[0]!],
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-rich-continued-order",
            description: "",
            bullets: [],
            responsibilitiesRich: {
              blocks: [
                {
                  kind: "paragraph",
                  runs: [{ text: makeTextBlock("continued-rich-prelude", 1) }],
                },
                {
                  kind: "bullet_list",
                  items: Array.from({ length: 4 }, (_, index) => ({
                    runs: [{ text: makeTextBlock(`continued-rich-bullet-${index + 1}`, 7) }],
                  })),
                },
                {
                  kind: "paragraph",
                  runs: [{ text: makeTextBlock("continued-rich-tail", 1) }],
                },
              ],
            },
          },
        ],
      },
      template: workshopTemplate,
    });

    const fullCommittedItem = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find((item) => item.id === "exp-rich-continued-order" && !item.continued);
    const continuedCommittedItem = result.committedPages
      .flatMap((page) => page.fragments)
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find(
        (item) =>
          item.id === "exp-rich-continued-order" &&
          item.continued &&
          item.responsibilitiesRich?.blocks.some((block) => block.kind === "paragraph"),
      );

    expect(fullCommittedItem?.responsibilitiesRich?.blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "bullet_list",
    ]);
    expect(continuedCommittedItem?.responsibilitiesRich?.blocks.map((block) => block.kind)).toEqual([
      "bullet_list",
      "paragraph",
    ]);
    expect(continuedCommittedItem?.responsibilitiesRich).toEqual({
      blocks: [
        {
          kind: "bullet_list",
          sourceBlockIndex: 1,
          items: [
            {
              runs: [{ text: makeTextBlock("continued-rich-bullet-4", 7) }],
              sourceBlockIndex: 1,
              sourceItemIndex: 3,
            },
          ],
        },
        {
          kind: "paragraph",
          sourceBlockIndex: 2,
          runs: [{ text: makeTextBlock("continued-rich-tail", 1) }],
        },
      ],
    });
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
    expect(
      experienceItems.every(
        (item) => item.responsibilitiesRich && item.responsibilitiesRich.blocks.length > 0,
      ),
    ).toBe(true);
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
      ["certifications:cont"],
      ["achievements"],
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

  it("keeps compact sidebar skills on page one when main content overflows in two-column Workshop", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Compact summary.",
        experience: Array.from({ length: 5 }, (_, index) => ({
          ...resumeMock.experience[0]!,
          id: `lane-exp-${index + 1}`,
          role: `Role ${index + 1}`,
          company: `Company ${index + 1}`,
          description: makeDenseTokenBlock(`lane${index + 1}`, 26),
          bullets: [],
        })),
        skillItems: Array.from({ length: 6 }, (_, index) => ({
          ...resumeMock.skillItems[index % resumeMock.skillItems.length]!,
          id: `lane-skill-${index + 1}`,
          name: `Skill ${index + 1}`,
        })),
      },
      template: workshopTwoColumnTemplate,
    });

    expect(result.committedPages.length).toBeGreaterThan(1);
    expect(result.committedPages[0]?.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skills", lane: "sidebar" }),
      ]),
    );
    expect(result.committedPages[0]?.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "experience", lane: "main" }),
      ]),
    );
  });

  it("moves first main-lane body entry to page two when page-one header leaves no room", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: makeDenseTokenBlock("header", 130),
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "lane-first-main-overflow",
            role: "Principal Designer",
            company: "Studio",
            description: "Small body entry that fits on a fresh page.",
            bullets: [],
          },
        ],
      },
      template: workshopTwoColumnTemplate,
    });

    expect(result.committedPages[0]?.fragments.some((fragment) => fragment.kind === "experience")).toBe(false);
    expect(result.committedPages[1]?.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "experience", lane: "main" }),
      ]),
    );
  });

  it("assigns education and achievements to the main lane for two-column Workshop", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        education: [resumeMock.education[0]!],
        achievementItems: [
          {
            id: "lane-achievement-1",
            text: "Raised qualified conversion by 24% through calmer onboarding.",
            sectionId: "achievements-1",
            sectionType: "achievements",
            sectionTitle: "Achievements",
          },
        ],
        achievements: ["Raised qualified conversion by 24% through calmer onboarding."],
      },
      template: workshopTwoColumnTemplate,
    });
    const fragments = result.committedPages.flatMap((page) => page.fragments);

    expect(fragments.find((fragment) => fragment.kind === "education")).toEqual(
      expect.objectContaining({ lane: "main" }),
    );
    expect(fragments.find((fragment) => fragment.kind === "achievements")).toEqual(
      expect.objectContaining({ lane: "main" }),
    );
  });

  it("assigns Maggie Letter committed sections to its native lanes", () => {
    const result = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        summary: "Maggie summary.",
        education: [resumeMock.education[0]!],
        skillItems: [resumeMock.skillItems[0]!],
        skills: [resumeMock.skillItems[0]!.name],
        languages: [resumeMock.languages[0]!],
        certifications: [resumeMock.certifications[0]!],
        achievementItems: [resumeMock.achievementItems[0]!],
        achievements: [resumeMock.achievementItems[0]!.text],
        hobbyItems: [resumeMock.hobbyItems[0]!],
        hobbies: [resumeMock.hobbyItems[0]!.name],
        experience: [resumeMock.experience[0]!],
        projects: [resumeMock.projects[0]!],
        affiliations: [resumeMock.affiliations[0]!],
        textSections: [
          {
            id: "additional-info-1",
            type: "additional_information",
            title: "Additional Information",
            text: "Available for US Letter export checks.",
          },
        ],
      },
      template: maggieLetterTemplate,
    });
    const lanesByKind = new Map(
      result.committedPages
        .flatMap((page) => page.fragments)
        .map((fragment) => [fragment.kind, fragment.lane]),
    );

    expect(result.committedPages.length).toBeGreaterThan(0);
    expect(lanesByKind.get("profile")).toBe("header");
    expect(lanesByKind.get("summary")).toBe("header");
    for (const kind of [
      "education",
      "skills",
      "achievements",
      "languages",
      "certifications",
      "hobbies",
    ] as const) {
      expect(lanesByKind.get(kind)).toBe("sidebar");
    }
    for (const kind of [
      "experience",
      "selected_projects",
      "affiliations",
      "additional_information",
    ] as const) {
      expect(lanesByKind.get(kind)).toBe("main");
    }
  });

  it("keeps compact certifications in sidebar and promotes detailed certifications to main", () => {
    const compact = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        certifications: [
          {
            id: "cert-compact-1",
            name: "AWS SAA",
            issuer: "AWS",
            meta: "2026",
            sectionId: "certifications-1",
            sectionType: "certifications",
            sectionTitle: "Certifications",
          },
        ],
      },
      template: workshopTwoColumnTemplate,
    });
    const detailed = planWorkshopResumePages({
      data: {
        ...buildPlannerData(),
        certifications: [
          {
            id: "cert-detailed-1",
            name: "Enterprise Architecture Certification With Long Credential Title",
            issuer: "International Architecture Credentialing Board",
            meta: "License ID ABC-123-456-789 · expires December 2028",
            sectionId: "certifications-1",
            sectionType: "certifications",
            sectionTitle: "Certifications",
          },
        ],
      },
      template: workshopTwoColumnTemplate,
    });

    expect(
      compact.committedPages.flatMap((page) => page.fragments).find((fragment) => fragment.kind === "certifications"),
    ).toEqual(expect.objectContaining({ lane: "sidebar" }));
    expect(
      detailed.committedPages.flatMap((page) => page.fragments).find((fragment) => fragment.kind === "certifications"),
    ).toEqual(expect.objectContaining({ lane: "main" }));
  });
});
