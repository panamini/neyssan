import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResumeTemplateRenderer from "../ResumeTemplateRenderer";
import { resumeMock } from "../resume.mock";
import { planWorkshopResumePages } from "../../../../lib/resume/resumePagination";
import { getResumeTemplateDefinition } from "../../../../lib/layout/resumeTemplates";

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

  it("injects live font and palette theme vars for workshop preview rendering", () => {
    const { container } = render(
      <ResumeTemplateRenderer
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "soft-serif",
          palette: "encre",
        }}
        resumeTemplateId="workshop_resume_onecol_ats"
      />,
    );

    const renderer = container.querySelector(
      '[data-testid="resume-template-renderer"]',
    ) as HTMLElement | null;

    expect(renderer?.style.getPropertyValue("--color-accent")).toBe("#3f5b67");
    expect(renderer?.style.getPropertyValue("--color-text")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--font-heading-family")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--font-body-family")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--text-meta-size")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--text-meta-line")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--skill-gap")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--skill-pad-inline")).toBeTruthy();
    expect(renderer?.style.getPropertyValue("--skill-pad-block")).toBeTruthy();
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

    expect(projectPageIndex).toBe(3);
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

  it("renders both hobbies together on the last page before additional information after dense achievements packing", () => {
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
    const hobbyPageIndex = plan.committedPages.findIndex((page) =>
      page.fragments.some((fragment) => fragment.kind === "hobbies"),
    );

    expect(hobbyPageIndex).toBe(2);
    expect(
      Array.from(
        pages[hobbyPageIndex]?.querySelectorAll(
          '[data-preview-section="hobbies"][data-preview-item-id]',
        ) ?? [],
        (node) => node.getAttribute("data-preview-item-id"),
      ).filter((value): value is string => Boolean(value)),
    ).toEqual(["hobby-render-achievement-tail-1", "hobby-render-achievement-tail-2"]);
    expect(
      pages[hobbyPageIndex - 1]?.querySelector(
        '[data-preview-section="hobbies"][data-preview-item-id]',
      ),
    ).toBeFalsy();
    expect(
      pages[hobbyPageIndex]?.querySelector(
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

  it("renders custom text sections on the same rescued last page as hobbies and preserves the custom title", () => {
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
      "hobbies",
      "additional_information",
    ]);
    expect(
      Array.from(
        lastPage.querySelectorAll('[data-preview-section="hobbies"][data-preview-item-id]'),
      ).length,
    ).toBeGreaterThan(0);
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
});
