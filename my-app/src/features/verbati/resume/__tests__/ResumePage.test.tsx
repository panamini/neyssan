import React from "react";
import { render, screen } from "@testing-library/react";
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
});
