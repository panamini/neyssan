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
      data: resumeMock,
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
});
