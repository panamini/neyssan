import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResumePage from "../ResumePage";
import { resumeMock } from "../resume.mock";
import type { ResumeLayoutVariantId } from "../resume.types";
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
    installMatchMediaStub();
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

      expect(container.textContent?.match(/ROBERT COOPER/g)?.length ?? 0).toBe(1);
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

    render(
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
  });

  it("shows LinkedIn in Swiss contact and does not duplicate the website across notes", () => {
    render(
      <ResumePage
        data={resumeMock}
        mode="swissminima"
        stylePreset={DEFAULT_VERBATI_STYLE}
        stageLayout={FIXED_STAGE_LAYOUT}
      />,
    );

    expect(screen.getAllByText("elenamarlowe.design")).toHaveLength(1);
    expect(screen.getByText("linkedin.com/in/elenamarlowe")).toBeInTheDocument();
  });

  it("shows certification dates and credential details in Swiss support sections", () => {
    render(
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

    expect(screen.getByText(/Nielsen Norman Group/)).toBeInTheDocument();
    expect(
      screen.getByText(/2022 · Credential ID: NNG-2022/),
    ).toBeInTheDocument();
  });
});
