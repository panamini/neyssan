import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResumeOneColAtsPage } from "../ResumeOneColAtsPage";
import { resumeMock } from "../resume.mock";
import { planWorkshopResumePages } from "../../../../lib/resume/resumePagination";
import { getResumeTemplateDefinition } from "../../../../lib/layout/resumeTemplates";

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
        page={plan.pages[0]!}
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
        page={plan.pages[0]!}
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
});
