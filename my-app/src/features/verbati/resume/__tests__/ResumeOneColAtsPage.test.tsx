import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function makeInlineEditing() {
  return {
    enabled: true,
    activeTarget: null,
    onActivate: () => {},
    onDeactivate: () => {},
    onSummaryChange: () => {},
    onTextSectionChange: () => {},
    onFieldChange: () => {},
    onAddItem: () => {},
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
    const data = {
      ...resumeMock,
      summary: "Compact summary.",
    };
    const plan = planWorkshopResumePages({
      data: {
        ...data,
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
        data={data}
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

  it("applies the document accent to workshop section titles and rules", () => {
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

    const profileHeader = container.querySelector('[data-preview-section="profile"]');
    const sectionHeading = container.querySelector("h2");
    const sectionRule = sectionHeading?.parentElement?.querySelector("div");

    expect(profileHeader?.getAttribute("style")).toContain(
      "var(--color-accent)",
    );
    expect(sectionHeading?.getAttribute("style")).toContain(
      "color: var(--color-accent);",
    );
    expect(sectionRule?.getAttribute("style")).toContain(
      "var(--color-accent)",
    );
  });

  it("renders full workshop summary text in preview mode without clamp or ellipsis styles", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const longSummary = repeatWords("full-summary", 60);
    const data = {
      ...resumeMock,
      summary: longSummary,
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
    };
    const plan = planWorkshopResumePages({
      data,
      template,
    });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const summaryItem = container.querySelector(
      '[data-preview-section="summary"][data-preview-item-id="summary"]',
    );
    const summaryStyle = summaryItem?.getAttribute("style") ?? "";

    expect(summaryItem).toHaveTextContent(longSummary);
    expect(summaryStyle).not.toContain("-webkit-line-clamp");
    expect(summaryStyle).not.toContain("overflow: hidden");
    expect(summaryStyle).not.toContain("text-overflow: ellipsis");
  });

  it("hydrates rich summary marks in editable workshop display mode", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      summary: "Bold summary",
      summaryRich: {
        blocks: [
          {
            kind: "paragraph" as const,
            runs: [{ text: "Bold summary", bold: true }],
          },
        ],
      },
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const summaryItem = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.0.summary"]',
    );
    expect(summaryItem).toHaveAttribute("role", "textbox");
    expect(summaryItem).not.toHaveAttribute("contenteditable");
    expect(container.querySelector("strong")?.textContent).toBe("Bold summary");
  });

  it("syncs the editable rich summary when an external undo restores the paper text", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const appliedData = {
      ...resumeMock,
      summary: "Built better.",
      summaryRich: {
        blocks: [
          {
            kind: "paragraph" as const,
            runs: [{ text: "Built better." }],
          },
        ],
      },
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const restoredData = {
      ...appliedData,
      summary: "Builder.",
      summaryRich: {
        blocks: [
          {
            kind: "paragraph" as const,
            runs: [{ text: "Builder." }],
          },
        ],
      },
    };
    const appliedPlan = planWorkshopResumePages({ data: appliedData, template });
    const restoredPlan = planWorkshopResumePages({
      data: restoredData,
      template,
    });

    const { container, rerender } = render(
      <ResumeOneColAtsPage
        data={appliedData}
        page={appliedPlan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const summaryItem = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.0.summary"]',
    );
    expect(summaryItem).toHaveTextContent("Built better.");
    summaryItem?.focus();

    rerender(
      <ResumeOneColAtsPage
        data={restoredData}
        page={restoredPlan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    expect(summaryItem).toHaveTextContent("Builder.");
    expect(summaryItem).not.toHaveTextContent("Built better.");
  });

  it("preserves multiline summary whitespace in the editable workshop paper field", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      summary: "First line\nSecond line",
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
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const summaryItem = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.0.summary"]',
    );

    expect(summaryItem).toHaveValue("First line\nSecond line");
    expect(summaryItem).toHaveAttribute("aria-multiline", "true");
    expect(summaryItem?.getAttribute("style")).toContain("white-space: pre-wrap;");
  });

  it("hides Add paragraph for an experience entry that already has a paragraph", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "Owned the discovery narrative before the bullet outcomes.",
          bullets: ["Reduced delivery time by 28%."],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /\+ Add paragraph/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Add bullet/i })).toBeInTheDocument();
  });

  it("renders an editable empty draft bullet after an existing rich paragraph", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "Led product design.",
          bullets: [""],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: "Led product design." }],
              },
              {
                kind: "bullet_list" as const,
                items: [{ runs: [{ text: "" }] }],
              },
            ],
          },
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const richBody = screen.getByRole("textbox", {
      name: "Edit experience responsibilities",
    });
    expect(richBody).toHaveClass("paper-rich-inline-editor");
    expect(richBody).toHaveAttribute(
      "data-paper-field-path",
      expect.stringContaining("responsibilities"),
    );
    expect(richBody.querySelector("p")?.textContent).toBe("Led product design.");
    expect(richBody.querySelector("li")?.textContent).toBe("");
    expect(
      screen.queryByRole("textbox", { name: "Edit experience bullet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Add bullet/i })).toBeInTheDocument();
  });

  it("keeps Add paragraph available for an experience entry without a paragraph", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: undefined,
          bullets: ["Reduced delivery time by 28%."],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    expect(screen.getByRole("button", { name: /\+ Add paragraph/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Add bullet/i })).toBeInTheDocument();
  });

  it("routes the experience entry wand through the item action instead of the section action", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: resumeMock.experience.slice(0, 2),
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });
    const onAsk = vi.fn();
    const onAskItem = vi.fn();

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
        sectionActions={{
          hiddenSectionIds: [],
          onAsk,
          onAskItem,
          onToggleHidden: () => {},
          onDelete: () => {},
        }}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /Improve responsibilities for/i })[1]!,
    );

    expect(onAsk).not.toHaveBeenCalled();
    expect(onAskItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionType: "experience",
        itemId: data.experience[1]!.id,
        itemIndex: 1,
        field: "responsibilities",
      }),
    );
  });

  it("hides ambiguous section-level AI for experience and education", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: resumeMock.experience.slice(0, 1),
      projects: [],
      education: resumeMock.education.slice(0, 1),
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });
    const onAsk = vi.fn();
    const onAskItem = vi.fn();

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
        sectionActions={{
          hiddenSectionIds: [],
          onAsk,
          onAskItem,
          onToggleHidden: () => {},
          onDelete: () => {},
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Ask AI for Experience" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ask AI for Education" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Improve responsibilities for/i }),
    ).toBeInTheDocument();
  });

  it("marks the active experience AI target without rendering review UI in the paper flow", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
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
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
        paperAi={{
          activeTarget: {
            sectionId: "experience-1",
            sectionType: "experience",
            itemId: data.experience[0]!.id,
          },
        }}
      />,
    );

    expect(
      container.querySelector("[data-cv-ai-review-target='true']"),
    ).toBeTruthy();
    expect(screen.queryByText("Improved responsibility")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(
      container.querySelector("[data-paper-ai-suggestion]"),
    ).not.toBeInTheDocument();
  });

  it("does not render skill AI suggestions inside the paper flow", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
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
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    expect(screen.queryByText("Stakeholder mapping")).not.toBeInTheDocument();
    expect(
      container.querySelector("[data-paper-ai-suggestion='list']"),
    ).not.toBeInTheDocument();
  });

  it("shows section-level AI only for whitelisted paper sections", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
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
    };
    const plan = planWorkshopResumePages({ data, template });
    const onAsk = vi.fn();

    render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
        sectionActions={{
          hiddenSectionIds: [],
          onAsk,
          onToggleHidden: () => {},
          onDelete: () => {},
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ask AI for Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask AI for Skills" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ask AI for Experience" }),
    ).not.toBeInTheDocument();
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
    const firstSegment = makeTextBlock("continued-fragment-prelude", 1);
    const continuedBullets = Array.from({ length: 4 }, (_, index) =>
      makeTextBlock(`continued-fragment-bullet-${index + 1}`, 7),
    );
    const trailingParagraph = makeTextBlock("continued-fragment-tail", 1);
    const data = {
      ...buildRendererData(),
      summary: "",
      skillItems: [],
      languages: [],
      education: [resumeMock.education[0]!],
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-render-continued",
          description: firstSegment,
          bullets: continuedBullets,
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: firstSegment }],
              },
              {
                kind: "bullet_list" as const,
                items: continuedBullets.map((bullet, index) => ({
                  runs:
                    index === continuedBullets.length - 1
                      ? [{ text: bullet, italic: true }]
                      : [{ text: bullet }],
                })),
              },
              {
                kind: "paragraph" as const,
                runs: [{ text: trailingParagraph, underline: true }],
              },
            ],
          },
        },
      ],
      projects: [],
    };
    const plan = planWorkshopResumePages({
      data,
      template,
    });
    const continuedPage = plan.committedPages.find((page) =>
      page.fragments.some(
        (fragment) =>
          fragment.kind === "experience" &&
          fragment.items.some(
            (item) =>
              item.continued &&
              item.responsibilitiesRich?.blocks.some((block) => block.kind === "paragraph"),
          ),
      ),
    );
    const continuedItem = continuedPage?.fragments
      .filter((fragment) => fragment.kind === "experience")
      .flatMap((fragment) => fragment.items)
      .find(
        (item) =>
          item.id === "exp-render-continued" &&
          item.continued &&
          item.responsibilitiesRich?.blocks.some((block) => block.kind === "paragraph"),
      );
    const fallbackOnlyData = {
      ...data,
      experience: data.experience.map((item) => ({
        ...item,
        responsibilitiesRich: undefined,
      })),
    };

    const { container } = render(
      <ResumeOneColAtsPage
        data={fallbackOnlyData}
        page={continuedPage!}
        template={template}
      />,
    );
    const experienceParagraphs = Array.from(
      container.querySelectorAll('[data-preview-section="experience"] p'),
    );
    const experienceItem = container.querySelector(
      '[data-preview-section="experience"][data-preview-item-id="exp-render-continued"]',
    ) as HTMLElement | null;
    const lists = Array.from(experienceItem?.querySelectorAll(":scope > ul") ?? []);
    const continuedListItems = Array.from(lists[0]?.querySelectorAll(":scope > li") ?? []).map(
      (node) => node.textContent,
    );
    const directParagraphs = Array.from(experienceItem?.querySelectorAll(":scope > p") ?? []).map(
      (node) => node.textContent,
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
    continuedItem?.blocks.forEach((block) => {
      expect(container.textContent).toContain(block.text);
    });
    expect(container.textContent).not.toContain(firstSegment);
    expect(container.textContent).not.toContain(continuedBullets[0]!);
    expect(container.textContent).not.toContain(continuedBullets[1]!);
    expect(container.textContent).not.toContain(continuedBullets[2]!);
    expect(container.querySelector('[data-preview-section="experience"] strong')).toBeNull();
    expect(container.querySelector('[data-preview-section="experience"] em')?.textContent).toBe(
      continuedBullets[3],
    );
    expect(container.querySelector('[data-preview-section="experience"] u')?.textContent).toBe(
      trailingParagraph,
    );
    expect(
      experienceParagraphs.some((node) =>
        node.getAttribute("style")?.includes("overflow-wrap: anywhere;"),
      ),
    ).toBe(true);
    expect(lists).toHaveLength(1);
    expect(continuedListItems).toEqual([continuedBullets[3]]);
    expect(directParagraphs).toEqual([trailingParagraph]);
    expect(experienceItem?.innerHTML.indexOf("</ul><p")).toBeGreaterThan(-1);
  });

  it("renders project rich descriptions with paragraphs, bullets, and marks", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [],
      projects: [
        {
          ...resumeMock.projects[0]!,
          description: "Rich project\nBullet win",
          descriptionRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [
                  { text: "Rich ", bold: true },
                  { text: "project", italic: true, underline: true },
                ],
              },
              {
                kind: "bullet_list" as const,
                items: [{ runs: [{ text: "Bullet win", bold: true }] }],
              },
            ],
          },
        },
      ],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const projectDescription = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.item:project-1.description"]',
    );
    expect(projectDescription).toHaveAttribute("role", "textbox");
    expect(projectDescription?.querySelector("strong")?.textContent).toContain("Rich");
    expect(projectDescription?.querySelector("em")?.textContent).toBe("project");
    expect(projectDescription?.querySelector("u")?.textContent).toBe("project");
    expect(projectDescription?.querySelector("li")?.textContent).toBe("Bullet win");
  });

  it("uses the rich body editor for editable experience paragraphs plus bullets", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "Owned onboarding.",
          bullets: ["Launched activation checklist."],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: "Owned onboarding." }],
              },
              {
                kind: "bullet_list" as const,
                items: [
                  {
                    runs: [
                      { text: "Launched " },
                      { text: "activation", bold: true },
                      { text: " checklist", italic: true },
                      { text: ".", underline: true },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const experienceBody = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.item:exp-1.responsibilities"]',
    );
    expect(experienceBody).toHaveAttribute("role", "textbox");
    expect(experienceBody).toHaveClass("paper-rich-inline-editor");
    expect(experienceBody?.querySelector("textarea")).toBeNull();
    expect(experienceBody?.querySelector(".ProseMirror")).toBeTruthy();
    expect(experienceBody?.querySelector("p")?.textContent).toBe("Owned onboarding.");
    expect(experienceBody?.querySelector("li")?.textContent).toBe(
      "Launched activation checklist.",
    );
    expect(experienceBody?.querySelector("li strong")?.textContent).toBe("activation");
    expect(experienceBody?.querySelector("li em")?.textContent).toBe(" checklist");
    expect(experienceBody?.querySelector("li u")?.textContent).toBe(".");
    expect(
      screen.queryByRole("textbox", { name: "Edit experience bullet" }),
    ).not.toBeInTheDocument();
  });

  it("hides draft experience description sentinel text in the rich body editor", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "__draft_empty_experience_description__",
          bullets: [""],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: "__draft_empty_experience_description__" }],
              },
              {
                kind: "bullet_list" as const,
                items: [{ runs: [{ text: "" }] }],
              },
            ],
          },
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const experienceBody = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.item:exp-1.responsibilities"]',
    );
    expect(experienceBody).toHaveAttribute("role", "textbox");
    expect(experienceBody).not.toHaveTextContent("__draft_empty_experience_description__");
  });

  it("uses the rich body editor for editable experience bullet-only rich responsibilities", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "",
          bullets: ["Launched activation checklist."],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "bullet_list" as const,
                items: [{ runs: [{ text: "Launched activation checklist." }] }],
              },
            ],
          },
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const experienceBody = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.item:exp-1.responsibilities"]',
    );
    expect(experienceBody).toHaveAttribute("role", "textbox");
    expect(experienceBody).toHaveClass("paper-rich-inline-editor");
    expect(experienceBody?.querySelector("li")?.textContent).toBe(
      "Launched activation checklist.",
    );
    expect(
      screen.queryByRole("textbox", { name: "Edit experience bullet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Add paragraph/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Add bullet/i })).toBeInTheDocument();
  });

  it("hydrates responsibilitiesRich marks in editable workshop display mode", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [
        {
          ...resumeMock.experience[0]!,
          description: "Italic paragraph",
          bullets: [],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: "Italic paragraph", italic: true }],
              },
            ],
          },
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      textSections: [],
    };
    const plan = planWorkshopResumePages({ data, template });

    const { container } = render(
      <ResumeOneColAtsPage
        data={data}
        page={plan.committedPages[0]!}
        template={template}
        inlineEditing={makeInlineEditing()}
      />,
    );

    const experienceText = container.querySelector<HTMLElement>(
      '[data-paper-field-path="structuredContent.item:exp-1.responsibilities"]',
    );
    expect(experienceText).toHaveAttribute("role", "textbox");
    expect(container.querySelector("em")?.textContent).toBe("Italic paragraph");
  });

  it("renders responsibilitiesRich for full non-continued experience items", () => {
    const template = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const data = {
      ...buildRendererData(),
      summary: "Compact summary.",
      skillItems: [],
      languages: [],
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-rich-preview",
          description: "Led platform migration planning.",
          bullets: [
            "Cut release rollback rate by 38%.",
            "Formalized launch checklists across squads.",
          ],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [
                  { text: "Led " },
                  { text: "platform migration", bold: true },
                  { text: " planning." },
                ],
              },
              {
                kind: "bullet_list" as const,
                items: [
                  {
                    runs: [
                      { text: "Cut " },
                      { text: "release rollback rate", italic: true },
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
                kind: "paragraph" as const,
                runs: [{ text: "Partnered closely with design and QA." }],
              },
            ],
          },
        },
      ],
      projects: [],
    };
    const plan = planWorkshopResumePages({
      data,
      template,
    });
    const fallbackOnlyData = {
      ...data,
      experience: data.experience.map((item) => ({
        ...item,
        responsibilitiesRich: undefined,
        description: "Fallback description that should not render.",
        bullets: ["Fallback bullet that should not render."],
      })),
    };

    const { container } = render(
      <ResumeOneColAtsPage
        data={fallbackOnlyData}
        page={plan.committedPages[0]!}
        template={template}
      />,
    );

    const experienceItem = container.querySelector(
      '[data-preview-section="experience"][data-preview-item-id="exp-rich-preview"]',
    ) as HTMLElement | null;
    const paragraphNode = Array.from(experienceItem?.querySelectorAll("p") ?? []).find(
      (node) => node.textContent === "Led platform migration planning.",
    );
    const bulletTexts = Array.from(experienceItem?.querySelectorAll("li") ?? []).map(
      (node) => node.textContent,
    );
    const richList = experienceItem?.querySelector("ul") as HTMLUListElement | null;
    const directParagraphs = Array.from(experienceItem?.querySelectorAll(":scope > p") ?? []).map(
      (node) => node.textContent,
    );

    expect(paragraphNode).toBeTruthy();
    expect(directParagraphs).toEqual([
      "Led platform migration planning.",
      "Partnered closely with design and QA.",
    ]);
    expect(experienceItem?.querySelector("strong")?.textContent).toBe(
      "platform migration",
    );
    expect(experienceItem?.querySelector("em")?.textContent).toBe(
      "release rollback rate",
    );
    expect(experienceItem?.querySelector("u")?.textContent).toBe(
      "launch checklists",
    );
    expect(bulletTexts).toEqual([
      "Cut release rollback rate by 38%.",
      "Formalized launch checklists across squads.",
    ]);
    expect(experienceItem?.innerHTML.indexOf("</p><ul")).toBeGreaterThan(-1);
    expect(experienceItem?.innerHTML.indexOf("</ul><p")).toBeGreaterThan(-1);
    expect(richList?.style.listStyleType).toBe("disc");
    expect(richList?.style.listStylePosition).toBe("outside");
    expect(richList?.style.paddingLeft).toBe("var(--flow-list-indent)");
    expect(richList?.style.gap).toBe("1.2mm");
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
    const schoolLine = screen.getByText(
      "Northbridge University · Grade: 3.9 GPA · 2016 — 2020",
    );
    expect(schoolLine).toBeInTheDocument();
    expect(schoolLine.closest("p")?.getAttribute("style")).toContain(
      "font-size: var(--text-body-sm-size);",
    );
  });
});
