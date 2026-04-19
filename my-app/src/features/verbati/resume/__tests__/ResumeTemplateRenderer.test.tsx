import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResumeTemplateRenderer from "../ResumeTemplateRenderer";
import { resumeMock } from "../resume.mock";

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

  it("renders borderline workshop content as a single A4 page instead of a tiny orphan tail page", async () => {
    const onStablePageCountChange = vi.fn();

    render(
      <ResumeTemplateRenderer
        data={{
          ...resumeMock,
          metadata: resumeMock.metadata.slice(0, 1),
          contact: resumeMock.contact.slice(0, 2),
          experience: resumeMock.experience.slice(0, 3),
          education: resumeMock.education.slice(0, 1),
          skillItems: resumeMock.skillItems.slice(0, 4),
          languages: resumeMock.languages.slice(0, 3),
          projects: [],
          achievements: [],
          achievementItems: [],
          certifications: [],
          affiliations: [],
          hobbyItems: [],
          hobbies: [],
          textSections: [],
        }}
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

    expect(screen.getAllByTestId("resume-template-page")).toHaveLength(1);
    expect(screen.getByText(resumeMock.name)).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();

    await waitFor(() => {
      expect(onStablePageCountChange).toHaveBeenCalledWith(1);
    });
  });
});
