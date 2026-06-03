import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResumePage, { paginateResumeBlocks } from "../ResumePage";
import { resumeMock } from "../resume.mock";
import type { ResumeData, ResumeLayoutVariantId } from "../resume.types";
import {
  buildVerbatiThemeVars,
  DEFAULT_VERBATI_STYLE,
} from "../../style";
import { collectResumeFontDebugSnapshot } from "../../../../lib/resume-font-debug";
import type { VerbatiStylePreset } from "../../types";

const ACTIVE_VARIANTS: ResumeLayoutVariantId[] = [
  "swissminima",
  "robial",
];

const FIXED_STAGE_LAYOUT = {
  fitScale: 1,
  availableWidth: 794,
  availableHeight: 1123,
  stageWidth: 794,
  stageHeight: 1123,
  pageWidth: 794,
  pageHeight: 1123,
  overflowX: false,
  overflowY: false,
  isFit: true,
};

const RESUME_WITHOUT_PROJECTS = {
  ...resumeMock,
  projects: [],
};

type ResumeMeasureHeights = Record<
  string,
  {
    pageStart: number;
    continued?: number;
  }
>;

function installMatchMediaStub() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("(pointer: fine)"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function installCanvasStub() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        font: "",
        measureText: (sample: string) => ({ width: sample.length * 8 }),
      }) as CanvasRenderingContext2D,
  );
}

function buildMeasuredRect(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: height,
    right: 100,
    width: 100,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function getVisibleVariantPages(
  container: HTMLElement,
  mode: ResumeLayoutVariantId,
): HTMLElement[] {
  const paginatedPages = Array.from(
    container.querySelectorAll(
      `.resume-page--${mode}[data-resume-page-index]`,
    ),
  ) as HTMLElement[];

  if (paginatedPages.length > 0) {
    return paginatedPages;
  }

  const singlePage = container.querySelector(
    `.resume-page--${mode}:not(.resume-page--measure)`,
  ) as HTMLElement | null;

  return singlePage ? [singlePage] : [];
}

function mockResumeMeasurementHeights(heights: ResumeMeasureHeights) {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function mockRect(this: HTMLElement) {
      const blockId = this.dataset.resumeMeasureId;
      const position = this.dataset.resumeMeasurePosition;

      if (blockId) {
        const configuredHeight = heights[blockId];
        if (configuredHeight) {
          const measuredHeight =
            position === "continued"
              ? configuredHeight.continued ?? configuredHeight.pageStart
              : configuredHeight.pageStart;

          return buildMeasuredRect(measuredHeight);
        }
      }

      return originalGetBoundingClientRect.call(this);
    });
}

function renderVariantPreview(
  stylePreset: VerbatiStylePreset,
  mode: ResumeLayoutVariantId,
) {
  const view = render(
    <div className="theme-resume-calm" style={buildVerbatiThemeVars(stylePreset)}>
      <ResumePage
        data={resumeMock}
        mode={mode}
        stylePreset={stylePreset}
        stageLayout={FIXED_STAGE_LAYOUT}
      />
    </div>,
  );

  return {
    ...view,
    snapshot: collectResumeFontDebugSnapshot({
      root: view.container,
      stylePreset,
      rendererVariantId: mode,
    }),
  };
}

describe("ResumePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installMatchMediaStub();
    installCanvasStub();
  });

  it("renders the kept comparisonAll variants without throwing", () => {
    render(
      <ResumePage
        data={resumeMock}
        mode="comparisonAll"
        comparisonVariantIds={ACTIVE_VARIANTS}
        stylePreset={DEFAULT_VERBATI_STYLE}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );

    expect(screen.getByLabelText("Swiss Minima")).toBeInTheDocument();
    expect(screen.getByLabelText("Grid 17/18")).toBeInTheDocument();
    expect(screen.queryByLabelText("Volk Register")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Editorial Wide")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Modernist Grid")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quire")).not.toBeInTheDocument();
    expect(screen.getAllByText("Education").length).toBeGreaterThan(0);
  });

  it("renders full Swiss summary text in preview mode without line clamping", () => {
    const longSummary = Array.from(
      { length: 48 },
      (_, index) => `full-summary-${index + 1}`,
    ).join(" ");

    const { container } = render(
      <ResumePage
        data={{
          ...resumeMock,
          summary: longSummary,
        }}
        mode="swissminima"
        stylePreset={{
          ...DEFAULT_VERBATI_STYLE,
          layout: "swiss",
        }}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );

    const summaryParagraph = container.querySelector(
      '[data-preview-section="summary"] p[data-font-probe="body"]',
    ) as HTMLElement | null;
    const summaryStyle = summaryParagraph?.style;

    expect(summaryParagraph?.textContent).toBe(longSummary);
    expect(summaryParagraph).toHaveClass("summary");
    expect(summaryStyle?.display).not.toBe("-webkit-box");
    expect(summaryStyle?.getPropertyValue("-webkit-line-clamp")).toBe("");
    expect(summaryStyle?.overflow).not.toBe("hidden");
    expect(summaryStyle?.textTransform).not.toBe("uppercase");
  });

  it("renders rich summary editing in the shared preview renderer", () => {
    const richSummaryData: ResumeData = {
      ...resumeMock,
      summary: "Lead resilient editorial teams.",
      summaryRich: {
        blocks: [
          {
            kind: "paragraph",
            runs: [
              { text: "Lead", bold: true },
              { text: " resilient editorial teams." },
            ],
          },
        ],
      },
    };
    const onFieldDocChange = vi.fn();

    const { container } = render(
      <ResumePage
        data={richSummaryData}
        mode="swissminima"
        stylePreset={{
          ...DEFAULT_VERBATI_STYLE,
          layout: "swiss",
        }}
        inlineEditing={{
          enabled: true,
          onActivate: vi.fn(),
          onDeactivate: vi.fn(),
          onSummaryChange: vi.fn(),
          onTextSectionChange: vi.fn(),
          onFieldChange: vi.fn(),
          onFieldDocChange,
        }}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );

    const richSummaryEditor = container.querySelector(
      ".paper-rich-inline-editor",
    ) as HTMLElement | null;

    expect(richSummaryEditor).toBeTruthy();
    expect(richSummaryEditor).toHaveAttribute(
      "data-paper-field-path",
      "structuredContent.0.summary",
    );
    expect(richSummaryEditor).toHaveAttribute("aria-label", "Edit Summary");
    expect(richSummaryEditor).toHaveAttribute("data-resume-inline-editable", "true");
  });

  it("keeps Swiss body content on the shared body font while headings stay on the heading font", () => {
    const quietSwiss = {
      ...DEFAULT_VERBATI_STYLE,
      layout: "swiss",
      typography: "quiet-editorial",
    } satisfies VerbatiStylePreset;
    const quietView = renderVariantPreview(quietSwiss, "swissminima");

    const page = quietView.container.querySelector(
      ".resume-page--swissminima",
    ) as HTMLElement | null;
    const heading = quietView.container.querySelector(
      '[data-font-probe="heading"]',
    ) as HTMLElement | null;
    const body = quietView.container.querySelector(
      '[data-font-probe="body"]',
    ) as HTMLElement | null;
    const inheritedBodyProbe = quietView.container.querySelector(
      '[data-font-probe="body-inherited"]',
    ) as HTMLElement | null;

    expect(page?.style.fontFamily).toBe("var(--font-body-family)");
    expect(heading?.style.fontFamily).toBe("var(--font-heading-family)");
    expect(body?.style.fontFamily).toBe("var(--font-body-family)");
    expect(inheritedBodyProbe).toBeTruthy();
    expect(quietView.snapshot.fontHeadingCssVar).toContain("Fraunces");
    expect(quietView.snapshot.fontBodyCssVar).toContain("Syne");
    expect(quietView.snapshot.headingFontFamilyComputed).toBe(
      "var(--font-heading-family)",
    );
    expect(quietView.snapshot.bodyFontFamilyComputed).toBe(
      "var(--font-body-family)",
    );
    expect(quietView.snapshot.inheritedBodyFontFamilyComputed).toBe(
      "var(--font-body-family)",
    );

    quietView.unmount();

    const monoSwiss = {
      ...quietSwiss,
      typography: "mono-signal",
    } satisfies VerbatiStylePreset;
    const monoView = renderVariantPreview(monoSwiss, "swissminima");

    expect(monoView.snapshot.fontHeadingCssVar).toContain("Archivo");
    expect(monoView.snapshot.fontBodyCssVar).toContain("Archivo");
    expect(monoView.snapshot.inheritedBodyFontFamilyComputed).toBe(
      "var(--font-body-family)",
    );
    expect(quietView.snapshot.fontHeadingCssVar).not.toBe(
      monoView.snapshot.fontHeadingCssVar,
    );
    expect(quietView.snapshot.fontBodyCssVar).not.toBe(
      monoView.snapshot.fontBodyCssVar,
    );
  });

  it("renders editorial sidebar experience company bold and role regular", () => {
    const view = renderVariantPreview(
      {
        ...DEFAULT_VERBATI_STYLE,
        layout: "workshop",
        typography: "quiet-editorial",
        resumeTemplateId: "editorial-sidebar",
      },
      "editorialsidebar",
    );

    const page = view.container.querySelector(
      ".resume-page--editorialsidebar",
    ) as HTMLElement | null;
    const title = page?.querySelector(
      ".experience-item--editorialsidebar .entry-title--editorialsidebar",
    ) as HTMLElement | null;
    const company = title?.querySelector(".entry-company") as HTMLElement | null;
    const role = title?.querySelector(".entry-role") as HTMLElement | null;

    expect(title).toHaveTextContent(resumeMock.experience[0]?.company ?? "");
    expect(title).toHaveTextContent(resumeMock.experience[0]?.role ?? "");
    expect(company).toHaveTextContent(resumeMock.experience[0]?.company ?? "");
    expect(role).toHaveTextContent(resumeMock.experience[0]?.role ?? "");
    expect(company).toHaveClass("entry-company");
    expect(role).toHaveClass("entry-role");
  });

  it("keeps the outer preview frame sized to one page while the stacked stage carries total stack height", async () => {
    const longSwissData: ResumeData = {
      ...resumeMock,
      summary:
        "Experienced product designer focused on systems, hiring, research, and multi-surface execution.",
      experience: Array.from({ length: 4 }, (_, index) => ({
        id: `exp-${index + 1}`,
        company: `Studio ${index + 1}`,
        role: "Principal Product Designer",
        startDate: "2019",
        endDate: "2024",
        bullets: [
          "Led multi-quarter redesigns across editor, dashboard, and onboarding surfaces.",
          "Built design systems and review rituals with product and engineering.",
          "Improved hiring loops, design critiques, and cross-functional planning.",
        ],
      })),
    };

    const measurementSpy = mockResumeMeasurementHeights({
      header: { pageStart: 180 },
      summary: { pageStart: 120 },
      "experience-heading": { pageStart: 40, continued: 40 },
      "experience-item:exp-1": { pageStart: 280, continued: 300 },
      "experience-item:exp-2": { pageStart: 280, continued: 300 },
      "experience-item:exp-3": { pageStart: 280, continued: 300 },
      "experience-item:exp-4": { pageStart: 280, continued: 300 },
      "support-row:0": { pageStart: 180, continued: 180 },
    });

    try {
      const { container } = render(
        <ResumePage
          data={longSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
        />,
      );

      await waitFor(() => {
        expect(getVisibleVariantPages(container, "swissminima").length).toBeGreaterThan(1);
      });

      const frame = container.querySelector(".resume-page-frame") as HTMLElement | null;
      const stage = container.querySelector(".resume-page-stage--stacked") as HTMLElement | null;

      expect(frame).not.toBeNull();
      expect(stage).not.toBeNull();
      const framePageHeight = Number.parseFloat(
        frame?.style.getPropertyValue("--preview-page-height") ?? "0",
      );
      const stagePageHeight = Number.parseFloat(
        stage?.style.getPropertyValue("--preview-page-height") ?? "0",
      );
      const frameStackHeight = Number.parseFloat(
        frame?.style.getPropertyValue("--preview-stack-height") ?? "0",
      );

      expect(framePageHeight).toBeGreaterThan(1000);
      expect(stagePageHeight).toBeCloseTo(framePageHeight, 3);
      expect(frameStackHeight).toBeGreaterThan(framePageHeight * 2);
    } finally {
      measurementSpy.mockRestore();
    }
  });

  it("keeps Robial preview vars aligned with distinct typography presets", () => {
    const quietRobial = {
      ...DEFAULT_VERBATI_STYLE,
      layout: "two-column",
      typography: "quiet-editorial",
    } satisfies VerbatiStylePreset;
    const quietView = renderVariantPreview(quietRobial, "robial");

    expect(
      quietView.container.querySelector(".resume-page--robial"),
    ).toBeTruthy();
    expect(
      quietView.container.querySelector('[data-font-probe="heading"]'),
    ).toBeTruthy();
    expect(
      quietView.container.querySelector('[data-font-probe="body"]'),
    ).toBeTruthy();
    expect(quietView.snapshot.fontHeadingCssVar).toContain("Fraunces");
    expect(quietView.snapshot.fontBodyCssVar).toContain("Syne");

    quietView.unmount();

    const monoRobial = {
      ...quietRobial,
      typography: "mono-signal",
    } satisfies VerbatiStylePreset;
    const monoView = renderVariantPreview(monoRobial, "robial");

    expect(monoView.snapshot.fontHeadingCssVar).toContain("Archivo");
    expect(monoView.snapshot.fontBodyCssVar).toContain("Archivo");
    expect(quietView.snapshot.fontHeadingCssVar).not.toBe(
      monoView.snapshot.fontHeadingCssVar,
    );
    expect(quietView.snapshot.fontBodyCssVar).not.toBe(
      monoView.snapshot.fontBodyCssVar,
    );
  });

  it("keeps workshop on the legacy swiss renderer path while using workshop template vars", () => {
    const workshopStyle = {
      ...DEFAULT_VERBATI_STYLE,
      familyId: "workshop",
      layout: "workshop",
    } satisfies VerbatiStylePreset;
    const { container } = renderVariantPreview(workshopStyle, "swissminima");

    const page = container.querySelector(
      ".resume-page--swissminima",
    ) as HTMLElement | null;

    expect(page).toBeTruthy();
    expect(page?.style.getPropertyValue("--sidebar-width")).toBe("0mm");
    expect(page?.style.getPropertyValue("--margin-left")).toBe("18mm");
    expect(page?.style.getPropertyValue("--header-summary-width")).toBe(
      "120mm",
    );
  });

  it.each(ACTIVE_VARIANTS)(
    "renders preview linking regions for %s with section and item targets",
    (mode) => {
      const { container } = render(
        <ResumePage
          data={resumeMock}
          mode={mode}
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          activeTarget={{
            sectionType: "experience",
            sectionId: "experience-1",
            itemId: "exp-2",
            source: "editor-focus",
          }}
        />,
      );

      expect(
        container.querySelector('[data-preview-section="profile"]'),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="contact"][data-preview-section-id="profile-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="contact"][data-preview-item-id="email"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="notes"][data-preview-section-id="profile-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="notes"][data-preview-item-id="location"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="summary"][data-preview-section-id="summary-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="experience"][data-preview-item-id="exp-2"][data-preview-active="true"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="selected_projects"][data-preview-item-id="project-1:name"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="languages"][data-preview-item-id="lang-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="certifications"][data-preview-item-id="cert-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="hobbies"][data-preview-item-id="hobby-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="affiliations"][data-preview-item-id="aff-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="additional_information"][data-preview-section-id="additional-information-1"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="contact"][data-no-pan="true"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="experience"][data-preview-item-id="exp-2"][data-no-pan="true"]',
        ),
      ).toBeTruthy();
    },
  );

  it.each(ACTIVE_VARIANTS)(
    "does not render a duplicate secondary identity line for %s when title matches the name",
    (mode) => {
      const identityOnlyData = {
        ...resumeMock,
        name: "ROBERT COOPER",
        title: "ROBERT COOPER",
        summary: "Short summary",
        metadata: [],
        contact: [],
        experience: [],
        education: [],
        projects: [],
        achievementItems: [],
        achievements: [],
        skills: [],
        skillItems: [],
        languages: [],
        hobbies: [],
        hobbyItems: [],
        certifications: [],
        affiliations: [],
        textSections: [],
      };

      const { container } = render(
        <ResumePage
          data={identityOnlyData}
          mode={mode}
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
        />,
      );
      const visibleText = getVisibleVariantPages(container, mode)
        .map((page) => page.textContent ?? "")
        .join(" ");

      expect(visibleText.match(/ROBERT COOPER/g)?.length ?? 0).toBe(1);
    },
  );

  it.each(ACTIVE_VARIANTS)(
    "keeps alias highlights precise for %s when notes is the active preview family",
    (mode) => {
      const { container } = render(
        <ResumePage
          data={resumeMock}
          mode={mode}
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          activeTarget={
            {
              sectionType: "profile",
              sectionId: "profile-1",
              source: "preview-panel",
              previewSectionType: "notes",
            } as any
          }
        />,
      );

      expect(
        container.querySelector(
          '[data-preview-section="notes"][data-preview-active="true"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="contact"][data-preview-active="true"]',
        ),
      ).toBeNull();
      expect(
        container.querySelector(
          '[data-preview-section="profile"][data-preview-active="true"]',
        ),
      ).toBeNull();
    },
  );

  it.each(ACTIVE_VARIANTS)(
    "highlights only the targeted selected_projects field for %s",
    (mode) => {
      const { container } = render(
        <ResumePage
          data={resumeMock}
          mode={mode}
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          activeTarget={
            {
              sectionType: "projects",
              sectionId: "projects-1",
              itemId: "project-1:description",
              previewSectionType: "selected_projects",
              source: "preview-panel",
            } as any
          }
        />,
      );

      expect(
        container.querySelector(
          '[data-preview-section="selected_projects"][data-preview-item-id="project-1:description"][data-preview-active="true"]',
        ),
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-preview-section="selected_projects"][data-preview-item-id="project-1:name"][data-preview-active="true"]',
        ),
      ).toBeNull();
    },
  );

  it.each([
    { mode: "robial" as const, heading: "Selected projects" },
    { mode: "editorialmag" as const, heading: "Selected projects" },
    { mode: "signalgrid" as const, heading: "Selected Projects" },
  ])(
    "does not render the empty projects section in %s when projects are removed",
    ({ mode, heading }) => {
      render(
        <ResumePage
          data={RESUME_WITHOUT_PROJECTS}
          mode={mode}
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          onRemoveSection={vi.fn()}
        />,
      );

      expect(screen.queryByText(heading)).not.toBeInTheDocument();

      if (mode === "robial") {
        expect(
          screen.queryByRole("button", {
            name: "Delete Selected projects",
          }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("renders a preview-side delete control for optional sections and reports the canonical section target", () => {
    const onRemoveSection = vi.fn();

    const { container } = render(
      <ResumePage
        data={resumeMock}
        mode="swissminima"
        stylePreset={DEFAULT_VERBATI_STYLE}
        stageLayout={FIXED_STAGE_LAYOUT}
        onRemoveSection={onRemoveSection}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Selected Projects" }),
    );

    expect(onRemoveSection).toHaveBeenCalledWith({
      sectionId: "projects-1",
      sectionType: "projects",
      sectionTitle: "Selected Projects",
      previewSectionType: "selected_projects",
    });

    const measurementShell = container.querySelector(
      ".resume-page-measure-shell",
    ) as HTMLDivElement | null;
    expect(measurementShell).toHaveAttribute("aria-hidden", "true");
    expect(measurementShell).toHaveAttribute("inert", "");
  });

  it("shows LinkedIn in Swiss contact and does not duplicate the website across notes", () => {
    const { container } = render(
      <ResumePage
        data={resumeMock}
        mode="swissminima"
        stylePreset={DEFAULT_VERBATI_STYLE}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );
    const [swissPage] = getVisibleVariantPages(container, "swissminima");

    expect(within(swissPage).getAllByText("elenamarlowe.design")).toHaveLength(
      1,
    );
    expect(
      within(swissPage).getByText("linkedin.com/in/elenamarlowe"),
    ).toBeInTheDocument();
  });

  it("shows certification dates and credential details in Swiss support sections", () => {
    const { container } = render(
      <ResumePage
        data={{
          ...resumeMock,
          certifications: [
            {
              id: "cert-1",
              name: "Service Design Masterclass",
              issuer: "Nielsen Norman Group",
              meta: "2022 · Credential ID: NNG-2022",
              sectionId: "certifications-1",
              sectionType: "certifications",
              sectionTitle: "Certifications",
              sectionOrder: 8,
            },
          ],
        }}
        mode="swissminima"
        stylePreset={DEFAULT_VERBATI_STYLE}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );
    const [swissPage] = getVisibleVariantPages(container, "swissminima");

    expect(within(swissPage).getByText(/Nielsen Norman Group/)).toBeInTheDocument();
    expect(
      within(swissPage).getByText(/2022 · Credential ID: NNG-2022/),
    ).toBeInTheDocument();
  });

  it("keeps experience headings with the next item when a page is almost full", () => {
    const pages = paginateResumeBlocks({
      blocks: [
        {
          id: "header",
          kind: "header",
          pageStartHeightPx: 70,
          continuedHeightPx: 70,
        },
        {
          id: "experience-heading",
          kind: "experience-heading",
          pageStartHeightPx: 12,
          continuedHeightPx: 18,
          keepWithNext: true,
        },
        {
          id: "experience-item:exp-1",
          kind: "experience-item",
          pageStartHeightPx: 24,
          continuedHeightPx: 30,
        },
        {
          id: "support-row:0",
          kind: "support-row",
          pageStartHeightPx: 18,
          continuedHeightPx: 24,
        },
      ],
      pageHeightPx: 100,
      options: {
        policy: "full",
      },
    });

    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((block) => block.blockId)).toEqual(["header"]);
    expect(pages[1].blocks.map((block) => block.blockId)).toEqual([
      "experience-heading",
      "experience-item:exp-1",
      "support-row:0",
    ]);
  });

  it("repeats the Swiss experience heading when later items continue on a new page", () => {
    const pages = paginateResumeBlocks({
      blocks: [
        {
          id: "header",
          kind: "header",
          pageStartHeightPx: 20,
          continuedHeightPx: 20,
        },
        {
          id: "summary",
          kind: "summary",
          pageStartHeightPx: 20,
          continuedHeightPx: 25,
        },
        {
          id: "experience-heading",
          kind: "experience-heading",
          pageStartHeightPx: 10,
          continuedHeightPx: 16,
          keepWithNext: true,
        },
        {
          id: "experience-item:exp-1",
          kind: "experience-item",
          pageStartHeightPx: 24,
          continuedHeightPx: 30,
        },
        {
          id: "experience-item:exp-2",
          kind: "experience-item",
          pageStartHeightPx: 24,
          continuedHeightPx: 30,
          repeatOnPageStartId: "experience-heading",
        },
        {
          id: "support-row:0",
          kind: "support-row",
          pageStartHeightPx: 18,
          continuedHeightPx: 24,
        },
      ],
      pageHeightPx: 100,
      options: {
        policy: "full",
      },
    });

    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((block) => block.blockId)).toEqual([
      "header",
      "summary",
      "experience-heading",
      "experience-item:exp-1",
    ]);
    expect(
      pages[1].blocks.map((block) => ({
        blockId: block.blockId,
        repeated: block.repeated ?? false,
      })),
    ).toEqual([
      {
        blockId: "experience-heading",
        repeated: true,
      },
      {
        blockId: "experience-item:exp-2",
        repeated: false,
      },
      {
        blockId: "support-row:0",
        repeated: false,
      },
    ]);
  });

  it("renders Swiss Minima as multiple preview pages when long experience content exceeds the first page", async () => {
    const longSwissData: ResumeData = {
      ...resumeMock,
      experience: [
        ...resumeMock.experience,
        {
          id: "exp-4",
          sectionId: "experience-1",
          sectionType: "experience",
          sectionTitle: "Experience",
          sectionOrder: 2,
          role: "Principal Product Designer",
          company: "Studio Common",
          period: "2013 — 2015",
          location: "Copenhagen",
          bullets: [
            "Built cross-channel commerce experiences for editorial teams with dense content and high publishing cadence.",
            "Introduced reusable narrative layout patterns that improved handoff clarity and implementation speed.",
            "Partnered with content and product leads on multi-market launches and governance.",
          ],
        },
      ],
      projects: [],
      achievementItems: [],
      achievements: [],
      hobbyItems: [],
      hobbies: [],
      certifications: [],
      affiliations: [],
      textSections: [],
    };
    const measurementSpy = mockResumeMeasurementHeights({
      header: {
        pageStart: 180,
        continued: 180,
      },
      summary: {
        pageStart: 120,
        continued: 150,
      },
      "experience-heading": {
        pageStart: 30,
        continued: 60,
      },
      "experience-item:exp-1": {
        pageStart: 220,
        continued: 250,
      },
      "experience-item:exp-2": {
        pageStart: 220,
        continued: 250,
      },
      "experience-item:exp-3": {
        pageStart: 220,
        continued: 250,
      },
      "experience-item:exp-4": {
        pageStart: 220,
        continued: 250,
      },
      "support-row:0": {
        pageStart: 180,
        continued: 210,
      },
    });

    try {
      const { container } = render(
        <ResumePage
          data={longSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
        />,
      );

      const pages = await waitFor(() => {
        const visiblePages = getVisibleVariantPages(container, "swissminima");

        expect(visiblePages).toHaveLength(2);

        return visiblePages;
      });
      const pageShells = Array.from(
        container.querySelectorAll(".resume-page-stack__page-shell"),
      );

      expect(container.querySelector(".resume-page-stage--stacked")).toBeTruthy();
      expect(pageShells).toHaveLength(2);

      expect(
        Array.from(
          pages[0].querySelectorAll<HTMLElement>("[data-resume-block-id]"),
        ).map((block) => block.dataset.resumeBlockId),
      ).toEqual([
        "header",
        "summary",
        "experience-heading",
        "experience-item:exp-1",
        "experience-item:exp-2",
      ]);
      expect(
        Array.from(
          pages[1].querySelectorAll<HTMLElement>("[data-resume-block-id]"),
        ).map((block) => ({
          blockId: block.dataset.resumeBlockId,
          repeated: block.dataset.resumeBlockRepeated ?? "false",
        })),
      ).toEqual([
        {
          blockId: "experience-heading",
          repeated: "true",
        },
        {
          blockId: "experience-item:exp-3",
          repeated: "false",
        },
        {
          blockId: "experience-item:exp-4",
          repeated: "false",
        },
        {
          blockId: "support-row:0",
          repeated: "false",
        },
      ]);
      expect(
        pages[0].querySelector('[data-resume-block-kind="support-row"]'),
      ).toBeNull();
      expect(
        within(pages[1]).getByText("Principal Product Designer"),
      ).toBeInTheDocument();
    } finally {
      measurementSpy.mockRestore();
    }
  });

  it("uses the Swiss live area height when deciding whether support rows still fit on page 1", async () => {
    const nearLimitSwissData: ResumeData = {
      ...resumeMock,
      experience: resumeMock.experience.slice(0, 2),
      projects: [],
      achievementItems: [],
      achievements: [],
      hobbyItems: [],
      hobbies: [],
      certifications: [],
      affiliations: [],
      textSections: [],
    };
    const measurementSpy = mockResumeMeasurementHeights({
      header: {
        pageStart: 150,
        continued: 150,
      },
      summary: {
        pageStart: 90,
        continued: 120,
      },
      "experience-heading": {
        pageStart: 30,
        continued: 60,
      },
      "experience-item:exp-1": {
        pageStart: 230,
        continued: 250,
      },
      "experience-item:exp-2": {
        pageStart: 230,
        continued: 250,
      },
      "support-row:0": {
        pageStart: 220,
        continued: 240,
      },
    });

    try {
      const { container } = render(
        <ResumePage
          data={nearLimitSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
        />,
      );

      const pages = await waitFor(() => {
        const visiblePages = getVisibleVariantPages(container, "swissminima");

        expect(visiblePages).toHaveLength(2);

        return visiblePages;
      });

      expect(
        Array.from(
          pages[0].querySelectorAll<HTMLElement>("[data-resume-block-id]"),
        ).map((block) => block.dataset.resumeBlockId),
      ).toEqual([
        "header",
        "summary",
        "experience-heading",
        "experience-item:exp-1",
        "experience-item:exp-2",
      ]);
      expect(
        Array.from(
          pages[1].querySelectorAll<HTMLElement>("[data-resume-block-id]"),
        ).map((block) => block.dataset.resumeBlockId),
      ).toEqual(["support-row:0"]);
    } finally {
      measurementSpy.mockRestore();
    }
  });
  it("updates Swiss preview metrics when added support sections create a new page", async () => {
    const initialSwissData: ResumeData = {
      ...resumeMock,
      projects: [],
      achievementItems: [],
      achievements: [],
      hobbyItems: [],
      hobbies: [],
      certifications: [],
      affiliations: [],
      textSections: [],
      skills: ["Curriculum design", "Mentoring", "Program operations"],
      skillItems: [
        {
          id: "skill-1",
          name: "Curriculum design",
          sectionId: "skills-1",
          sectionType: "skills",
        },
      ],
      languages: [],
    };
    const expandedSwissData: ResumeData = {
      ...initialSwissData,
      projects: [
        {
          id: "project-1",
          name: "Student success dashboard",
          meta: "React · 2024",
          description: "Built a cross-functional outcomes dashboard.",
          sectionId: "projects-1",
          sectionType: "projects",
        },
      ],
      certifications: [
        {
          id: "cert-1",
          name: "Instructional Design Certificate",
          issuer: "Coursera",
          meta: "2023",
          sectionId: "certifications-1",
          sectionType: "certifications",
        },
      ],
      affiliations: [
        {
          id: "affiliation-1",
          organizationName: "National Educators Guild",
          roleOrMembershipType: "Member",
          dateRange: "2021 - Present",
          notes: "Regional mentorship committee",
          sectionId: "affiliations-1",
          sectionType: "affiliations",
        },
      ],
      textSections: [
        {
          id: "additional-1",
          sectionId: "additional-1",
          sectionType: "additional_information",
          sectionTitle: "Additional Information",
          sectionOrder: 9,
          text: "Available for evening workshops and curriculum audits.",
        },
      ],
    };
    const handlePreviewMetricsChange = vi.fn();
    const measurementSpy = mockResumeMeasurementHeights({
      header: { pageStart: 160, continued: 160 },
      summary: { pageStart: 100, continued: 100 },
      "experience-heading": { pageStart: 36, continued: 36 },
      "experience-item:exp-1": { pageStart: 240, continued: 240 },
      "experience-item:exp-2": { pageStart: 240, continued: 240 },
      "experience-item:exp-3": { pageStart: 240, continued: 240 },
      "support-row:0": { pageStart: 180, continued: 180 },
      "support-row:1": { pageStart: 440, continued: 440 },
    });

    try {
      const { rerender } = render(
        <ResumePage
          data={initialSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          onPreviewMetricsChange={handlePreviewMetricsChange}
        />,
      );

      await waitFor(() => {
        expect(handlePreviewMetricsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            pageCount: 1,
          }),
        );
      });

      rerender(
        <ResumePage
          data={expandedSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          onPreviewMetricsChange={handlePreviewMetricsChange}
        />,
      );

      await waitFor(() => {
        expect(handlePreviewMetricsChange).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pageCount: 2,
          }),
        );
      });
    } finally {
      measurementSpy.mockRestore();
    }
  });
  it("publishes the measured Swiss stack height instead of assuming full page-count height", async () => {
    const longSwissData: ResumeData = {
      ...resumeMock,
      experience: [
        ...resumeMock.experience,
        {
          id: "exp-4",
          sectionId: "experience-1",
          sectionType: "experience",
          sectionTitle: "Experience",
          sectionOrder: 2,
          role: "Principal Product Designer",
          company: "Studio Common",
          period: "2013 — 2015",
          location: "Copenhagen",
          bullets: [
            "Built cross-channel commerce experiences for editorial teams with dense content and high publishing cadence.",
            "Introduced reusable narrative layout patterns that improved handoff clarity and implementation speed.",
            "Partnered with content and product leads on multi-market launches and governance.",
          ],
        },
      ],
      projects: [],
      achievementItems: [],
      achievements: [],
      hobbyItems: [],
      hobbies: [],
      certifications: [],
      affiliations: [],
      textSections: [],
    };
    const handlePreviewMetricsChange = vi.fn();
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    const measurementSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function mockRect(this: HTMLElement) {
        const blockId = this.dataset.resumeMeasureId;
        const position = this.dataset.resumeMeasurePosition;
        const configuredHeight: ResumeMeasureHeights[string] | undefined = blockId
          ? {
              header: { pageStart: 180, continued: 180 },
              summary: { pageStart: 120, continued: 150 },
              "experience-heading": { pageStart: 30, continued: 60 },
              "experience-item:exp-1": { pageStart: 220, continued: 250 },
              "experience-item:exp-2": { pageStart: 220, continued: 250 },
              "experience-item:exp-3": { pageStart: 220, continued: 250 },
              "experience-item:exp-4": { pageStart: 220, continued: 250 },
              "support-row:0": { pageStart: 180, continued: 210 },
            }[blockId]
          : undefined;

        if (configuredHeight) {
          const measuredHeight =
            position === "continued"
              ? configuredHeight.continued ?? configuredHeight.pageStart
              : configuredHeight.pageStart;

          return buildMeasuredRect(measuredHeight);
        }

        if (this.classList.contains("resume-page-stack")) {
          return buildMeasuredRect(2100);
        }

        return originalGetBoundingClientRect.call(this);
      });

    try {
      render(
        <ResumePage
          data={longSwissData}
          mode="swissminima"
          stylePreset={DEFAULT_VERBATI_STYLE}
          stageLayout={FIXED_STAGE_LAYOUT}
          onPreviewMetricsChange={handlePreviewMetricsChange}
        />,
      );

      await waitFor(() => {
        const lastCall = handlePreviewMetricsChange.mock.lastCall?.[0];
        expect(lastCall?.pageCount).toBe(2);
        expect(lastCall?.stackHeightPx).toBeGreaterThan(2098);
        expect(lastCall?.stackHeightPx).toBeLessThan(2101);
      });
    } finally {
      measurementSpy.mockRestore();
    }
  });
});
