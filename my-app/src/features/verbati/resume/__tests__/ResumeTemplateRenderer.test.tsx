import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResumeTemplateRenderer from "../ResumeTemplateRenderer";
import { resumeMock } from "../resume.mock";
import { planWorkshopResumePages } from "../../../../lib/resume/resumePagination";
import { getResumeTemplateDefinition } from "../../../../lib/layout/resumeTemplates";

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
});
