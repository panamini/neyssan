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
