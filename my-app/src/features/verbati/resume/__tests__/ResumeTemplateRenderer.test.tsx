import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResumeTemplateRenderer from "../ResumeTemplateRenderer";
import { resumeMock } from "../resume.mock";
import { buildVerbatiThemeVars } from "../../style";
import { normalizeResumePreviewTokens } from "../../../../lib/layout/documentTokenNormalizer";
import { serializeResumePreviewVars } from "../../../../lib/layout/documentTokenSerializers";
import { planWorkshopResumePages } from "../../../../lib/resume/resumePagination";
import { getResumeTemplateDefinition } from "../../../../lib/layout/resumeTemplates";

const WORKSHOP_ACTIVE_PREVIEW_THEME_VAR_NAMES = [
  "--font-heading-family",
  "--font-body-family",
  "--color-text",
  "--color-text-muted",
  "--color-text-subtle",
  "--color-border-strong",
  "--color-accent-soft",
  "--paper",
] as const;

const WORKSHOP_ACTIVE_PREVIEW_LAYOUT_VAR_NAMES = [
  "--page-width",
  "--page-height",
  "--margin-top",
  "--margin-right",
  "--margin-bottom",
  "--margin-left",
  "--header-row-gap",
  "--header-summary-width",
  "--header-bottom-padding",
  "--display-size-adjust",
  "--title-size-adjust",
  "--body-size-adjust",
  "--body-sm-size-adjust",
  "--text-display-size",
  "--text-display-line",
  "--text-title-size",
  "--text-title-line",
  "--text-body-size",
  "--text-body-line",
  "--text-body-sm-size",
  "--text-body-sm-line",
  "--text-caption-size",
  "--text-caption-line",
  "--text-meta-size",
  "--text-meta-line",
  "--body-row-gap",
  "--main-heading-margin",
  "--workshop-section-title-reduction",
  "--workshop-experience-heading-size-adjust",
  "--workshop-experience-heading-line-height",
  "--flow-list-indent",
  "--experience-bullets-padding",
  "--skill-gap",
  "--skill-pad-inline",
  "--skill-pad-block",
  "--project-gap",
  "--project-padding",
  "--education-gap",
] as const;

const WORKSHOP_ACTIVE_PREVIEW_VAR_NAMES = [
  ...WORKSHOP_ACTIVE_PREVIEW_THEME_VAR_NAMES,
  ...WORKSHOP_ACTIVE_PREVIEW_LAYOUT_VAR_NAMES,
].sort();

const WORKSHOP_LEGACY_PREVIEW_DECOR_VAR_NAMES = [
  "--resume-preview-page-background",
  "--resume-preview-page-border-color",
  "--resume-preview-page-border-width",
  "--resume-preview-page-shadow",
  "--resume-preview-frame-inset",
  "--resume-preview-frame-border",
] as const;

function pickCssVars(
  source: Record<string, string | undefined>,
  names: readonly string[],
): Record<string, string> {
  return names.reduce<Record<string, string>>((result, name) => {
    const value = source[name];
    if (typeof value === "string" && value.length > 0) {
      result[name] = value;
    }
    return result;
  }, {});
}

function getRenderedCssVarNames(node: HTMLElement): string[] {
  return Array.from(node.style)
    .filter((name) => name.startsWith("--"))
    .sort();
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

function buildWorkshopScreenshotFixture() {
  return {
    ...resumeMock,
    metadata: resumeMock.metadata.slice(0, 1),
    contact: resumeMock.contact.slice(0, 2),
    skillItems: [],
    languages: [],
    certifications: [],
    affiliations: [],
    hobbyItems: [],
    hobbies: [],
    projects: [],
    textSections: [],
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
function buildCompactAtomicRendererFixture() {
  const education = Array.from({ length: 4 }, (_, index) => ({
    ...resumeMock.education[0]!,
    id: `edu-render-tail-${index + 1}`,
    degree: `Degree ${index + 1}`,
    school: `School ${index + 1}`,
    period: `201${index}-201${index + 1}`,
  }));
  const skillItems = Array.from({ length: 18 }, (_, index) => ({
    ...resumeMock.skillItems[index % resumeMock.skillItems.length]!,
    id: `skill-render-tail-${index + 1}`,
    name: `Skill ${index + 1}`,
  }));
  const languages = Array.from({ length: 32 }, (_, index) => ({
    ...resumeMock.languages[index % resumeMock.languages.length]!,
    id: `language-render-tail-${index + 1}`,
    name: `Language ${index + 1}`,
    level: index % 2 === 0 ? "Native" : "Professional",
  }));
  const achievementItems = Array.from({ length: 5 }, (_, index) => ({
    ...resumeMock.achievementItems[index % resumeMock.achievementItems.length]!,
    id: `achievement-render-tail-${index + 1}`,
    text: `Achievement ${index + 1}`,
  }));
  const certifications = Array.from({ length: 10 }, (_, index) => ({
    ...resumeMock.certifications[index % resumeMock.certifications.length]!,
    id: `cert-render-tail-${index + 1}`,
    name: `Certification ${index + 1}`,
    issuer: `Issuer ${index + 1}`,
  }));
  const affiliations = Array.from({ length: 6 }, (_, index) => ({
    ...resumeMock.affiliations[index % resumeMock.affiliations.length]!,
    id: `affiliation-render-tail-${index + 1}`,
    organizationName: `Organization ${index + 1}`,
    roleOrMembershipType: `Role ${index + 1}`,
    notes: `Affiliation note ${index + 1}`,
  }));
  const hobbyItems = Array.from({ length: 3 }, (_, index) => ({
    ...resumeMock.hobbyItems[index % resumeMock.hobbyItems.length]!,
    id: `hobby-render-tail-${index + 1}`,
    name: `Hobby ${index + 1}`,
  }));

  return {
    ...resumeMock,
    education,
    skillItems,
    skills: skillItems.map((item) => item.name),
    languages,
    achievementItems,
    achievements: achievementItems.map((item) => item.text),
    certifications,
    affiliations,
    hobbyItems,
    hobbies: hobbyItems.map((item) => item.name),
  };
}

function buildSelectedProjectsTailRendererFixture(projectCount = 3) {
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

function buildSkillsTailSelectedProjectsRendererFixture() {
  const education = Array.from({ length: 4 }, (_, index) => ({
    ...resumeMock.education[0]!,
    id: `edu-render-tail-${index + 1}`,
    degree: `Degree ${index + 1}`,
    school: `School ${index + 1}`,
    period: `201${index}-201${index + 1}`,
  }));
  const skillItems = Array.from({ length: 18 }, (_, index) => ({
    ...resumeMock.skillItems[index % resumeMock.skillItems.length]!,
    id: `skill-render-tail-${index + 1}`,
    name: `Skill ${index + 1}`,
  }));

  return {
    ...resumeMock,
    education,
    skillItems,
    skills: skillItems.map((item) => item.name),
    projects: buildSelectedProjectsTailRendererFixture(2).projects,
  };
}

function buildLanguagesTailSelectedProjectsRendererFixture() {
  const languages = Array.from({ length: 32 }, (_, index) => ({
    ...resumeMock.languages[index % resumeMock.languages.length]!,
    id: `language-render-tail-${index + 1}`,
    name: `Language ${index + 1}`,
    level: index % 2 === 0 ? "Native" : "Professional",
  }));

  return {
    ...resumeMock,
    languages,
    projects: buildSelectedProjectsTailRendererFixture(2).projects,
  };
}

function buildAchievementsTailHobbiesRendererFixture() {
  const achievementItems = Array.from({ length: 5 }, (_, index) => ({
    ...resumeMock.achievementItems[index % resumeMock.achievementItems.length]!,
    id: `achievement-render-tail-${index + 1}`,
    text: `Achievement ${index + 1}`,
  }));
  const hobbyItems = Array.from({ length: 2 }, (_, index) => ({
    ...resumeMock.hobbyItems[index % resumeMock.hobbyItems.length]!,
    id: `hobby-render-achievement-tail-${index + 1}`,
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

function buildCustomTextTailRendererFixture() {
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

function buildAtomicContinuityFixture() {
  return {
    ...resumeMock,
    metadata: resumeMock.metadata.slice(0, 1),
    contact: resumeMock.contact.slice(0, 2),
    summary: "",
    experience: [],
    education: [],
    skillItems: [],
    languages: [],
    affiliations: [],
    hobbies: [],
    hobbyItems: [],
    projects: [],
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
    achievements: Array.from({ length: 6 }, (_, index) =>
      repeatWords(`achievement-${index + 1}`, 48),
    ),
    achievementItems: Array.from({ length: 6 }, (_, index) => ({
      id: `ach-${index + 1}`,
      sectionId: "achievements-1",
      sectionType: "achievements" as const,
      sectionTitle: "Achievements",
      sectionOrder: 80,
      text: repeatWords(`achievement-${index + 1}`, 48),
    })),
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

function summarizeCommittedPages(
  plan: ReturnType<typeof planWorkshopResumePages>,
): string[][] {
  return plan.committedPages.map((page) =>
    page.fragments.map(
      (fragment) => `${fragment.kind}${fragment.continued ? ":cont" : ""}`,
    ),
  );
}

describe("ResumeTemplateRenderer", () => {
  it("renders the workshop one-column ATS page set and reports stable page counts", async () => {
    const onStablePageCountChange = vi.fn();

    render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        resumeTemplateId="workshop_resume_onecol_ats"
        onStablePageCountChange={onStablePageCountChange}
      />,
    );

    expect(screen.getAllByTestId("resume-template-page").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(onStablePageCountChange).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  it("stays inert for non-workshop template ids", async () => {
    const onStablePageCountChange = vi.fn();

    const { container } = render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={{
          familyId: "swiss",
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        resumeTemplateId="swiss_resume_legacy"
        onStablePageCountChange={onStablePageCountChange}
      />,
    );

    expect(container).toBeEmptyDOMElement();

    await new Promise((resolve) => window.setTimeout(resolve, 70));
    expect(onStablePageCountChange).not.toHaveBeenCalled();
  });

  it("scales workshop pages inside the preview shell instead of resizing the underlying A4 page box", () => {
    const { container } = render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        resumeTemplateId="workshop_resume_onecol_ats"
        stageLayout={{
          fitScale: 0.5,
          availableWidth: 400,
          availableHeight: 600,
          stageWidth: 400,
          stageHeight: 600,
          pageWidth: 396.85,
          pageHeight: 561.25,
          overflowX: false,
          overflowY: false,
          isFit: true,
        }}
      />,
    );

    const scaledPageShell = container.querySelector(
      '[data-testid="resume-template-renderer"] > div',
    );
    const scaledPageInner = scaledPageShell?.firstElementChild as HTMLElement | null;

    expect(scaledPageShell?.getAttribute("style")).toContain("width: 396.85px;");
    expect(scaledPageShell?.getAttribute("style")).toContain("min-height: 561.25px;");
    expect(scaledPageShell?.getAttribute("style")).toContain("height: 561.25px;");
    expect(scaledPageShell?.getAttribute("style")).toContain("position: relative;");
    expect(scaledPageInner?.getAttribute("style")).toContain("width: 793.700");
    expect(scaledPageInner?.getAttribute("style")).toContain(
      "min-height: 1122.519",
    );
    expect(scaledPageInner?.getAttribute("style")).toContain("transform: scale(0.499");
    expect(scaledPageInner?.getAttribute("style")).toContain(
      "transform-origin: top left;",
    );
    expect(scaledPageInner?.getAttribute("style")).toContain("position: absolute;");
    expect(scaledPageInner?.getAttribute("style")).toContain("top: 0px;");
    expect(scaledPageInner?.getAttribute("style")).toContain("left: 0px;");
  });

  it("injects only the active workshop preview var contract and excludes legacy preview decor vars", () => {
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "soft-serif",
      palette: "encre",
    } as const;
    const expectedThemeVars = pickCssVars(
      buildVerbatiThemeVars(stylePreset) as Record<string, string | undefined>,
      WORKSHOP_ACTIVE_PREVIEW_THEME_VAR_NAMES,
    );
    const expectedLayoutVars = pickCssVars(
      serializeResumePreviewVars(
        normalizeResumePreviewTokens({
          resumeTemplateId: "workshop_resume_onecol_ats",
          stylePreset,
        }),
      ),
      WORKSHOP_ACTIVE_PREVIEW_LAYOUT_VAR_NAMES,
    );

    const { container } = render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const renderer = container.querySelector(
      '[data-testid="resume-template-renderer"]',
    ) as HTMLElement | null;

    expect(renderer).not.toBeNull();
    expect(getRenderedCssVarNames(renderer!)).toEqual(WORKSHOP_ACTIVE_PREVIEW_VAR_NAMES);

    Object.entries({
      ...expectedThemeVars,
      ...expectedLayoutVars,
    }).forEach(([name, value]) => {
      expect(renderer?.style.getPropertyValue(name)).toBe(value);
    });
    expect(renderer?.style.getPropertyValue("--flow-list-indent")).toBe(
      renderer?.style.getPropertyValue("--experience-bullets-padding"),
    );
    expect(renderer?.style.getPropertyValue("--workshop-section-title-reduction")).toBe(
      "0.95mm",
    );
    expect(
      renderer?.style.getPropertyValue("--workshop-experience-heading-size-adjust"),
    ).toBe("0.2mm");
    expect(
      renderer?.style.getPropertyValue("--workshop-experience-heading-line-height"),
    ).toBe("1.25");

    WORKSHOP_LEGACY_PREVIEW_DECOR_VAR_NAMES.forEach((name) => {
      expect(renderer?.style.getPropertyValue(name)).toBe("");
    });
  });

  it("renders the same committed workshop fragment boundaries that the live planner chooses for the screenshot fixture", () => {
    const data = buildWorkshopScreenshotFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });
    const firstPageHead =
      plan.committedPages[0]?.fragments.find((fragment) => fragment.kind === "experience")
        ?.kind === "experience"
        ? plan.committedPages[0]?.fragments.find((fragment) => fragment.kind === "experience")
            ?.items[0]?.blocks[0]?.text ?? ""
        : "";
    const secondPageTail =
      plan.committedPages[1]?.fragments.find((fragment) => fragment.kind === "experience")
        ?.kind === "experience"
        ? plan.committedPages[1]?.fragments.find((fragment) => fragment.kind === "experience")
            ?.items[0]?.blocks[0]?.text ?? ""
        : "";

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const firstPageExp1Article =
      pages[0]?.querySelector('[data-preview-row-id="exp-screenshot-1"]') ?? null;
    const firstPageExp2Article = pages[0]?.querySelector('[data-preview-row-id="exp-screenshot-2"]');
    const secondPageExp2Article =
      pages[1]?.querySelector('[data-preview-row-id="exp-screenshot-2"]') ?? null;
    const firstPageExp1Body =
      firstPageExp1Article?.querySelector(":scope > p:last-of-type") ?? null;
    const secondPageExp2Body =
      secondPageExp2Article?.querySelector(":scope > p:last-of-type") ?? null;
    const secondPageText = pages[1]?.textContent ?? "";

    expect(pages).toHaveLength(2);
    expect((firstPageExp1Body?.textContent ?? "").length).toBe(firstPageHead.length);
    expect(firstPageExp2Article).toBeNull();
    expect((secondPageExp2Body?.textContent ?? "").length).toBe(secondPageTail.length);
    expect(pages[1]?.querySelector('[data-preview-row-id="exp-screenshot-1"]')).toBeNull();
    expect(secondPageText).not.toContain("Company 1");
    expect(secondPageText).toContain("Company 2");
    expect(secondPageText).toContain("Degree");
  });

  it("keeps compact atomic section item order aligned with committed workshop pages", () => {
    const data = buildCompactAtomicRendererFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
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
      const committedIds = plan.committedPages.flatMap((page) =>
        page.fragments.flatMap((fragment) =>
          fragment.kind === kind && "items" in fragment
            ? fragment.items.map((item) => item.id)
            : [],
        ),
      );
      const renderedIds = pages.flatMap((page) =>
        Array.from(
          page.querySelectorAll(`[data-preview-section="${kind}"][data-preview-item-id]`),
          (node) => node.getAttribute("data-preview-item-id"),
        ).filter((value): value is string => Boolean(value)),
      );

      expect(renderedIds).toEqual(committedIds);
    }
  });

  it("renders selected projects contiguously so achievements does not start before the section is complete", () => {
    const data = buildSelectedProjectsTailRendererFixture(4);
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const plannedProjectPageIndices = plan.committedPages.flatMap((page, pageIndex) =>
      page.fragments.some((fragment) => fragment.kind === "selected_projects")
        ? [pageIndex]
        : [],
    );
    const renderedHeadPageProjectIds = Array.from(
      pages[plannedProjectPageIndices[0]]?.querySelectorAll(
        '[data-preview-section="selected_projects"][data-preview-item-id]',
      ) ?? [],
      (node) => node.getAttribute("data-preview-item-id"),
    ).filter((value): value is string => Boolean(value) && !value.endsWith(":description"));
    expect(
      Array.from(
        pages[plannedProjectPageIndices[1]]?.querySelectorAll(
          '[data-preview-section="selected_projects"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value) && !value.endsWith(":description")),
    ).toEqual(["project-tail-3", "project-tail-4"]);
    expect(renderedHeadPageProjectIds).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      pages[plannedProjectPageIndices[0]]?.querySelector(
        '[data-preview-section="achievements"][data-preview-item-id]',
      ),
    ).toBeFalsy();
    expect(
      Array.from(
        pages[plannedProjectPageIndices[1]]?.querySelectorAll(
          '[data-preview-section="achievements"][data-preview-item-id]',
        ) ?? [],
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders both selected project cards on the deferred page after dense skills packing", () => {
    const data = buildSkillsTailSelectedProjectsRendererFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const projectPageIndex = plan.committedPages.findIndex((page) =>
      page.fragments.some((fragment) => fragment.kind === "selected_projects"),
    );

    expect(projectPageIndex).toBe(2);
    expect(
      Array.from(
        pages[projectPageIndex]?.querySelectorAll(
          '[data-preview-section="selected_projects"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value) && !value.endsWith(":description")),
    ).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      pages[projectPageIndex - 1]?.querySelector(
        '[data-preview-section="selected_projects"][data-preview-item-id]',
      ),
    ).toBeFalsy();
  });

  it("renders both selected project cards on the deferred page after dense languages packing", () => {
    const data = buildLanguagesTailSelectedProjectsRendererFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const projectPageIndex = plan.committedPages.findIndex((page) =>
      page.fragments.some((fragment) => fragment.kind === "selected_projects"),
    );

    expect(projectPageIndex).toBe(2);
    expect(
      Array.from(
        pages[projectPageIndex]?.querySelectorAll(
          '[data-preview-section="selected_projects"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value) && !value.endsWith(":description")),
    ).toEqual(["project-tail-1", "project-tail-2"]);
    expect(
      pages[projectPageIndex - 1]?.querySelector(
        '[data-preview-section="selected_projects"][data-preview-item-id]',
      ),
    ).toBeFalsy();
  });

  it("renders the fitting hobby on the current page and continues the remainder before additional information after dense achievements packing", () => {
    const data = buildAchievementsTailHobbiesRendererFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const firstHobbyPageIndex = plan.committedPages.findIndex((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "hobbies" &&
          fragment.kind === "hobbies" &&
          fragment.items.some((item) => item.id === "hobby-render-achievement-tail-1"),
      ),
    );
    const continuedHobbyPageIndex = plan.committedPages.findIndex((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "hobbies" &&
          fragment.kind === "hobbies" &&
          fragment.items.some((item) => item.id === "hobby-render-achievement-tail-2"),
      ),
    );

    expect(firstHobbyPageIndex).toBe(1);
    expect(continuedHobbyPageIndex).toBe(2);
    expect(
      Array.from(
        pages[firstHobbyPageIndex]?.querySelectorAll(
          '[data-preview-section="hobbies"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value)),
    ).toEqual(["hobby-render-achievement-tail-1"]);
    expect(
      Array.from(
        pages[continuedHobbyPageIndex]?.querySelectorAll(
          '[data-preview-section="hobbies"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value)),
    ).toEqual(["hobby-render-achievement-tail-2"]);
    expect(
      pages[firstHobbyPageIndex - 1]?.querySelector(
        '[data-preview-section="hobbies"][data-preview-item-id]',
      ),
    ).toBeFalsy();
    expect(
      pages[continuedHobbyPageIndex]?.querySelector(
        '[data-preview-section="additional_information"][data-preview-item-id]',
      ),
    ).toBeTruthy();
  });

  it("renders a single additional information heading on the last page so the long-form section does not read as resumed after hobbies", () => {
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data: resumeMock,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const lastPage = screen.getAllByTestId("resume-template-page")[plan.committedPages.length - 1]!;
    const headings = Array.from(
      lastPage.querySelectorAll('[data-preview-section="additional_information"] h2, [data-preview-section="additional_information"] h3'),
      (node) => node.textContent?.trim(),
    ).filter((value): value is string => Boolean(value));

    expect(headings).toEqual(["Additional Information"]);
  });

  it("renders custom text sections on the following page without pulling hobbies off the current page", () => {
    const data = buildCustomTextTailRendererFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const lastPageIndex = plan.committedPages.length - 1;
    const lastPage = pages[lastPageIndex]!;

    expect(plan.committedPages[lastPageIndex]?.fragments.map((fragment) => fragment.kind)).toEqual([
      "additional_information",
    ]);
    expect(plan.committedPages[lastPageIndex - 1]?.fragments.at(-1)?.kind).toBe("hobbies");
    expect(
      Array.from(
        lastPage.querySelectorAll('[data-preview-section="hobbies"][data-preview-item-id]'),
      ).length,
    ).toBe(0);
    expect(
      lastPage.querySelector('[data-preview-section="additional_information"][data-preview-item-id="custom-tail-1"]'),
    ).toBeTruthy();
    expect(lastPage.textContent).toContain("Custom Section");
    expect(
      Array.from(
        lastPage.querySelectorAll('[data-preview-section="additional_information"] h2, [data-preview-section="additional_information"] h3'),
        (node) => node.textContent?.trim(),
      ).filter((value): value is string => Boolean(value)),
    ).toEqual(["Custom Section"]);
  });

  it("keeps atomic non-experience section continuity aligned with committed workshop pages", () => {
    const data = buildAtomicContinuityFixture();
    const stylePreset = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plan = planWorkshopResumePages({
      data,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset,
    });

    render(
      <ResumeTemplateRenderer
        data={data}
        stylePreset={stylePreset}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const pages = screen.getAllByTestId("resume-template-page");
    const pageTexts = pages.map((page) => page.textContent ?? "");

    expect(summarizeCommittedPages(plan)).toEqual([
      ["profile", "certifications", "achievements"],
      ["achievements:cont", "additional_information"],
      ["additional_information:cont"],
    ]);
    expect(pageTexts).toHaveLength(3);
    expect(pageTexts[0]).toContain("achievement-1-1");
    expect(pageTexts[0]).not.toContain("additional-1");
    expect(pageTexts[1]).toContain("achievement-6-1");
    expect(pageTexts[1]).toContain("additional-1");
    expect(pageTexts[2]).toContain("Custom Section");
    expect(pageTexts[2]).not.toContain("achievement-1-1");
  });
});
