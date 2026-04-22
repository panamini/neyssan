import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResumeOneColAtsPage } from "../ResumeOneColAtsPage";
import { resumeMock } from "../resume.mock";
import { planWorkshopResumePages } from "../../../../lib/resume/resumePagination";
import {
  getResumeTemplateDefinition,
  resolveWorkshopPreviewLayoutContract,
} from "../../../../lib/layout/resumeTemplates";

function repeatWords(label: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join(" ");
}

function makeTextBlock(label: string, usefulLines: number) {
  return repeatWords(label, usefulLines * 10);
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

function buildRendererData() {
  return {
    ...resumeMock,
    metadata: resumeMock.metadata.slice(0, 1),
    contact: resumeMock.contact.slice(0, 2),
    education: [],
    certifications: [],
    affiliations: [],
    hobbyItems: [],
    hobbies: [],
    textSections: [],
  };
}

describe("ResumeOneColAtsPage", () => {
  it("renders shared preview-region attributes and active state for workshop pages", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
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
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
        activeTarget={{
          sectionType: "projects",
          sectionId: "projects-1",
          itemId: "project-1:description",
          previewSectionType: "selected_projects",
          source: "preview-panel",
        }}
      />,
    );

    expect(
      container.querySelector(
        '[data-preview-section="summary"][data-preview-section-id="summary-1"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '[data-preview-section="experience"][data-preview-item-id="exp-1"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '[data-preview-section="selected_projects"][data-preview-item-id="project-1:description"][data-preview-active="true"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-preview-section="experience"][data-no-pan="true"]'),
    ).toBeTruthy();
  });

  it("uses shared preview spacing tokens for the workshop page shell and header rhythm", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const pageShell = container.querySelector('[data-testid="resume-template-page"]');
    const profileHeader = container.querySelector('[data-preview-section="profile"]');

    expect(pageShell?.getAttribute("style")).toContain(
      "padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);",
    );
    expect(pageShell?.getAttribute("style")).toContain("gap: var(--body-row-gap);");
    expect(profileHeader?.getAttribute("style")).toContain("gap: var(--header-row-gap);");
    expect(profileHeader?.getAttribute("style")).toContain(
      "padding-bottom: var(--header-bottom-padding);",
    );
  });

  it("uses the shared workshop summary-width var for the summary measure", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        summary: "Compact summary.",
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const summaryItem = container.querySelector(
      '[data-preview-section="summary"][data-preview-item-id="summary"]',
    );

    expect(summaryItem?.getAttribute("style")).toContain(
      "max-width: var(--header-summary-width);",
    );
  });

  it("pins the workshop page grid to the top instead of stretching rows across the full A4 shell", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const pageShell = container.querySelector('[data-testid="resume-template-page"]');

    expect(pageShell?.getAttribute("style")).toContain("min-height: 100%;");
    expect(pageShell?.getAttribute("style")).toContain("align-content: start;");
    expect(pageShell?.getAttribute("style")).toContain("align-items: start;");
  });

  it("applies workshop font family vars on the page shell and headings", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const pageShell = container.querySelector(
      '[data-testid="resume-template-page"]',
    ) as HTMLElement | null;
    const firstHeading = container.querySelector("h1, h2, h3") as HTMLElement | null;

    expect(pageShell?.getAttribute("style")).toContain(
      "font-family: var(--body-font, var(--font-body-family));",
    );
    expect(firstHeading?.getAttribute("style")).toContain(
      "font-family: var(--heading-font, var(--font-heading-family));",
    );
  });

  it("uses caption, meta, and skill component vars for the workshop typography contract", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        skillItems: resumeMock.skillItems.slice(0, 2),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: [],
        hobbies: [],
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const metadataLabel = container.querySelector("dt");
    const experienceMeta = container.querySelector('[data-preview-row-id="exp-1"] p');
    const skillItem = container.querySelector('[data-preview-section="skills"][data-preview-item-id]');
    const skillContainer = skillItem?.parentElement;

    expect(metadataLabel?.getAttribute("style")).toContain(
      "font-size: var(--text-caption-size);",
    );
    expect(metadataLabel?.getAttribute("style")).toContain(
      "line-height: var(--text-caption-line);",
    );
    expect(experienceMeta?.getAttribute("style")).toContain(
      "font-size: var(--text-meta-size);",
    );
    expect(experienceMeta?.getAttribute("style")).toContain(
      "line-height: var(--text-meta-line);",
    );
    expect(skillItem?.getAttribute("style")).toContain(
      "padding: var(--skill-pad-block) var(--skill-pad-inline);",
    );
    expect(skillContainer?.getAttribute("style")).toContain("gap: var(--skill-gap);");
  });

  it("applies workshop density size adjustment vars to display, title, body, and body-sm roles", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...resumeMock,
        summary: "Compact summary.",
        metadata: resumeMock.metadata.slice(0, 1),
        contact: resumeMock.contact.slice(0, 2),
        skillItems: resumeMock.skillItems.slice(0, 2),
        languages: resumeMock.languages.slice(0, 1),
        experience: resumeMock.experience.slice(0, 1),
        projects: [],
        education: [],
        certifications: [],
        affiliations: [],
        hobbyItems: resumeMock.hobbyItems.slice(0, 1),
        hobbies: resumeMock.hobbies.slice(0, 1),
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const profileName = container.querySelector("h1");
    const firstSectionHeading = container.querySelector("h2");
    const summaryItem = container.querySelector(
      '[data-preview-section="summary"][data-preview-item-id="summary"]',
    );
    const skillItem = container.querySelector(
      '[data-preview-section="skills"][data-preview-item-id]',
    );
    const languageItem = container.querySelector(
      '[data-preview-section="languages"][data-preview-item-id]',
    );
    const hobbyItem = container.querySelector(
      '[data-preview-section="hobbies"][data-preview-item-id]',
    );

    expect(profileName?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-display-size) + var(--display-size-adjust));",
    );
    expect(firstSectionHeading?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-title-size) + var(--title-size-adjust) - var(--workshop-section-title-reduction));",
    );
    expect(summaryItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-size) + var(--body-size-adjust));",
    );
    expect(skillItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-sm-size) + var(--body-sm-size-adjust));",
    );
    expect(languageItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-sm-size) + var(--body-sm-size-adjust));",
    );
    expect(languageItem?.getAttribute("style")).toContain(
      "line-height: var(--text-body-sm-line);",
    );
    expect(hobbyItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-sm-size) + var(--body-sm-size-adjust));",
    );
    expect(hobbyItem?.getAttribute("style")).toContain(
      "line-height: var(--text-body-sm-line);",
    );
  });

  it("reads workshop section and item spacing from the shared template layout contract", () => {
    const baseTemplate = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const template = {
      ...baseTemplate,
      preview: {
        ...baseTemplate.preview,
        experienceBulletsGapMm: 1.6,
        workshopSectionShellGapMm: 4.4,
        workshopSectionContentGapMm: 5.5,
        workshopExperienceBlockGapMm: 2.3,
        workshopExperienceMetaGapMm: 1.1,
        workshopCompactMetaGapMm: 1.4,
      },
    };
    const layout = resolveWorkshopPreviewLayoutContract(template);
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        summary: "Compact summary.",
        experience: resumeMock.experience.slice(0, 1),
        projects: resumeMock.projects.slice(0, 1),
        education: resumeMock.education.slice(0, 1),
        languages: resumeMock.languages.slice(0, 1),
        skillItems: [],
        achievements: [],
        achievementItems: [],
        certifications: [],
        affiliations: [],
        hobbyItems: resumeMock.hobbyItems.slice(0, 1),
        hobbies: resumeMock.hobbies.slice(0, 1),
        textSections: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const experienceItem = container.querySelector(
      '[data-preview-section="experience"][data-preview-surface="item"]',
    );
    const experienceHeadingBlock = experienceItem?.firstElementChild as HTMLElement | null;
    const experienceRoleHeading = experienceHeadingBlock?.querySelector("h3") as HTMLElement | null;
    const experienceBulletList = experienceItem?.querySelector("ul") as HTMLElement | null;
    const educationSection = container.querySelector(
      '[data-preview-section="education"][data-preview-surface="section"]',
    ) as HTMLElement | null;
    const educationHeading = educationSection?.querySelector("h2") as HTMLElement | null;
    const educationContent = educationSection?.children.item(1) as HTMLElement | null;
    const educationItem = container.querySelector(
      '[data-preview-section="education"][data-preview-surface="item"]',
    );
    const projectHeadline = container.querySelector(
      '[data-preview-section="selected_projects"][data-preview-surface="item"]',
    );
    const projectCard = projectHeadline?.parentElement as HTMLElement | null;
    const languagesList = container.querySelector(
      '[data-preview-section="languages"][data-preview-surface="section"] ul',
    );
    const hobbiesList = container.querySelector(
      '[data-preview-section="hobbies"][data-preview-surface="section"] ul',
    );
    const languageItem = container.querySelector(
      '[data-preview-section="languages"][data-preview-item-id]',
    );
    const hobbyItem = container.querySelector(
      '[data-preview-section="hobbies"][data-preview-item-id]',
    );

    expect(experienceItem?.getAttribute("style")).toContain(
      `gap: ${layout.experienceBlockGapMm}mm;`,
    );
    expect(experienceHeadingBlock?.getAttribute("style")).toContain(
      `gap: ${layout.experienceMetaGapMm}mm;`,
    );
    expect(experienceRoleHeading?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-size) + var(--body-size-adjust) + var(--workshop-experience-heading-size-adjust));",
    );
    expect(experienceRoleHeading?.getAttribute("style")).toContain(
      "line-height: var(--workshop-experience-heading-line-height);",
    );
    expect(experienceBulletList?.getAttribute("style")).toContain(
      "padding-left: var(--flow-list-indent);",
    );
    expect(educationSection?.getAttribute("style")).toContain(
      `gap: ${layout.sectionShellGapMm}mm;`,
    );
    expect(educationHeading?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-title-size) + var(--title-size-adjust) - var(--workshop-section-title-reduction));",
    );
    expect(educationContent?.getAttribute("style")).toContain(
      `gap: ${layout.sectionContentGapMm}mm;`,
    );
    expect(educationItem?.getAttribute("style")).toContain("gap: var(--education-gap);");
    expect(projectHeadline?.getAttribute("style")).toContain(
      `gap: ${layout.compactMetaGapMm}mm;`,
    );
    expect(projectCard?.getAttribute("style")).toContain("gap: var(--project-gap);");
    expect(languagesList?.getAttribute("style")).toContain(
      "padding-left: var(--flow-list-indent);",
    );
    expect(languagesList?.getAttribute("style")).toContain(
      `gap: ${layout.listGapMm}mm;`,
    );
    expect(hobbiesList?.getAttribute("style")).toContain(
      "padding-left: var(--flow-list-indent);",
    );
    expect(hobbiesList?.getAttribute("style")).toContain(
      `gap: ${layout.listGapMm}mm;`,
    );
    expect(languageItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-sm-size) + var(--body-sm-size-adjust));",
    );
    expect(hobbyItem?.getAttribute("style")).toContain(
      "font-size: calc(var(--text-body-sm-size) + var(--body-sm-size-adjust));",
    );
  });

  it("renders continued experience fragments with repeated role, meta, and item-level continued without duplicating prior text", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const firstSegment = makeTextBlock("continued-fragment-a", 4);
    const secondSegment = makeTextBlock("continued-fragment-b", 16);
    const continuedBullet = makeTextBlock("continued-fragment-bullet", 4);
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        summary: makeTextBlock("continued-renderer-summary", 26),
        skillItems: [],
        languages: [],
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-render-continued",
            description: `${firstSegment}\n\n${secondSegment}`,
            bullets: [continuedBullet],
          },
        ],
        projects: [],
      },
      template,
    });
    const continuedPage = plan.committedPages.find((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "experience" &&
          fragment.items.some((item) => item.continued),
      ),
    );

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={continuedPage!}
        template={template}
      />,
    );
    const experienceParagraphs = Array.from(
      container.querySelectorAll('[data-preview-section="experience"] p'),
    );
    expect(container.textContent).toContain(resumeMock.experience[0]?.role ?? "");
    expect(container.textContent).toContain(
      [
        resumeMock.experience[0]?.company,
        resumeMock.experience[0]?.location,
        resumeMock.experience[0]?.period,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    expect(container.textContent).toContain("Continued");
    expect(container.textContent).toContain(secondSegment);
    expect(container.textContent).not.toContain(firstSegment);
    expect(container.textContent).not.toContain(continuedBullet);
    expect(
      experienceParagraphs.some((node) =>
        node.getAttribute("style")?.includes("overflow-wrap: anywhere;"),
      ),
    ).toBe(true);
    expect(container.querySelector('[data-preview-section="experience"] li')).toBeNull();
  });

  it("keeps non-fragmented experience rendering unchanged on committed workshop pages", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const description = makeTextBlock("unchanged-experience-description", 3);
    const bullet = makeTextBlock("unchanged-experience-bullet", 2);
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        summary: "Compact summary.",
        skillItems: [],
        languages: [],
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-render-unchanged",
            description,
            bullets: [bullet],
          },
        ],
        projects: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    expect(container.textContent).toContain(description);
    expect(container.textContent).toContain(bullet);
    expect(container.textContent).not.toContain("Continued");
  });

  it("restores explicit list marker styling for workshop experience bullet groups", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const bullet = makeTextBlock("styled-experience-bullet", 2);
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        summary: "Compact summary.",
        skillItems: [],
        languages: [],
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-render-styled-list",
            description: "",
            bullets: [bullet],
          },
        ],
        projects: [],
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const experienceList = container.querySelector(
      '[data-preview-section="experience"][data-preview-surface="item"] ul',
    ) as HTMLUListElement | null;

    expect(experienceList).toBeTruthy();
    expect(experienceList?.style.listStyleType).toBe("disc");
    expect(experienceList?.style.listStylePosition).toBe("outside");
    expect(experienceList?.style.paddingLeft).toBe("var(--flow-list-indent)");
    expect(experienceList?.style.gap).toBe("1.2mm");
  });

  it("restores explicit list marker styling for workshop achievements lists", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const achievementItems = [
      {
        ...resumeMock.achievementItems[0]!,
        id: "achievement-render-styled-1",
        text: "Delivered workshop renderer parity.",
      },
      {
        ...resumeMock.achievementItems[0]!,
        id: "achievement-render-styled-2",
        text: "Stabilized browser preview evidence.",
      },
    ];
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        experience: [],
        projects: [],
        education: [],
        skillItems: [],
        languages: [],
        achievements: achievementItems.map((item) => item.text),
        achievementItems,
      },
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const achievementsList = container.querySelector(
      '[data-preview-section="achievements"][data-preview-surface="section"] ul',
    ) as HTMLUListElement | null;

    expect(achievementsList).toBeTruthy();
    expect(achievementsList?.style.listStyleType).toBe("disc");
    expect(achievementsList?.style.listStylePosition).toBe("outside");
    expect(achievementsList?.style.paddingLeft).toBe("var(--flow-list-indent)");
    expect(achievementsList?.style.gap).toBe("1.2mm");
  });

  it("renders the dense workshop screenshot second page with the intact second entry before education", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const plan = planWorkshopResumePages({
      data: {
        ...buildRendererData(),
        summary: Array.from({ length: 30 }, (_, index) => `summary-${index + 1}`).join(" "),
        skillItems: [],
        languages: [],
        education: [
          {
            ...resumeMock.education[0]!,
            id: "edu-dense-render-1",
          },
        ],
        projects: [],
        experience: [
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-render-1",
            role: "1",
            description: makeDenseTokenBlock("1", 40),
            bullets: [],
          },
          {
            ...resumeMock.experience[0]!,
            id: "exp-dense-render-2",
            role: "2",
            description: makeDenseTokenBlock("2", 20),
            bullets: [],
          },
        ],
      },
      template,
      stylePreset: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });
    const continuedPage = plan.committedPages[1];

    const { container } = render(
      <ResumeOneColAtsPage
        data={resumeMock}
        page={continuedPage!}
        template={template}
      />,
    );

    const renderedExperienceItems = Array.from(
      container.querySelectorAll('[data-preview-section="experience"][data-preview-item-id]'),
    );

    expect(renderedExperienceItems[0]?.getAttribute("data-preview-item-id")).toBe(
      "exp-dense-render-2",
    );
    expect(renderedExperienceItems).toHaveLength(1);
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain(resumeMock.education[0]?.degree ?? "");
    expect(container.textContent).toContain(
      [
        resumeMock.experience[0]?.company,
        resumeMock.experience[0]?.location,
        resumeMock.experience[0]?.period,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    expect(container.textContent).toContain("Continued");
    expect(container.textContent).not.toContain(makeDenseTokenBlock("1", 40).slice(2552));
    expect(container.textContent).toContain(makeDenseTokenBlock("2", 20));
  });

  it("renders degree, field of study, grade, school, and period together on workshop education rows", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const educationData = {
      ...buildRendererData(),
      experience: [],
      projects: [],
      skillItems: [],
      languages: [],
      education: [
        {
          ...resumeMock.education[0]!,
          id: "edu-render-fields",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          grade: "3.9 GPA",
          school: "Northbridge University",
          period: "2016 — 2020",
        },
      ],
    };
    const plan = planWorkshopResumePages({
      data: educationData,
      template,
      stylePreset: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });

    render(
      <ResumeOneColAtsPage
        data={educationData}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    expect(
      screen.getByText("Bachelor of Science, Computer Science"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Northbridge University · Grade: 3.9 GPA · 2016 — 2020"),
    ).toBeInTheDocument();
  });
});
