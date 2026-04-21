import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resumeMock } from "../../features/verbati/resume/resume.mock";
import {
  DEFAULT_VERBATI_STYLE,
  getResumeTemplateId,
} from "../../features/verbati/style";
import {
  buildResumePrintRoutePayload,
  buildStyledResumePrintSource,
  type ResumePrintRoutePayload,
} from "../../lib/document-export-models";
import { generateCvTemplate } from "../../lib/cv-template";
import { getResumeTemplateDefinition } from "../../lib/layout/resumeTemplates";
import { planWorkshopResumePages } from "../../lib/resume/resumePagination";
import { ResumePrintPage } from "../ResumePrintPage";

function buildPayload(): ResumePrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: "en",
    resumeData: resumeMock,
    stylePreset: {
      ...DEFAULT_VERBATI_STYLE,
      familyId: "two-column",
      layout: "two-column",
    },
    resumeTemplateId: getResumeTemplateId({
      ...DEFAULT_VERBATI_STYLE,
      familyId: "two-column",
      layout: "two-column",
    }),
    rendererVariantId: "robial",
  };
}

function buildWorkshopOverflowPayload(): ResumePrintRoutePayload {
  const currentCv = generateCvTemplate("Workshop Overflow CV");
  currentCv.metadata.verbatiStyle = {
    familyId: "workshop",
    layout: "workshop",
    typography: "soft-serif",
    palette: "pierre",
  };
  const experienceSection = currentCv.sections.find(
    (section) => section.type === "experience",
  );
  if (experienceSection?.structuredContent && Array.isArray(experienceSection.structuredContent)) {
    experienceSection.structuredContent = Array.from({ length: 10 }, (_, index) => ({
      ...(experienceSection.structuredContent[0] ?? {
        id: `exp-${index + 1}`,
        company: "",
        position: "",
        startDate: "2024-01-01T00:00:00.000Z",
        isCurrent: false,
        currentlyWorking: false,
        achievements: [],
      }),
      id: `exp-${index + 1}`,
      company: `Northline ${index + 1}`,
      position: `Operations Lead ${index + 1}`,
      startDate: "2024-01-01T00:00:00.000Z",
      isCurrent: false,
      currentlyWorking: false,
      responsibilities:
        `Committed responsibility ${index + 1}\nCommitted follow-up ${index + 1}\nCommitted delivery ${index + 1}`,
      achievements: [],
    }));
  }

  const previewSource = buildStyledResumePrintSource({
    currentCv,
    stylePreset: currentCv.metadata.verbatiStyle,
  });
  if (!previewSource) {
    throw new Error("Expected workshop preview source for overflow payload test.");
  }

  return buildResumePrintRoutePayload({ data: previewSource });
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

function buildDenseWorkshopCommittedPayload(): ResumePrintRoutePayload {
  const stylePreset = {
    familyId: "workshop",
    layout: "workshop",
    typography: "quiet-editorial",
    palette: "sauge",
  } as const;
  const resumeData = {
    ...resumeMock,
    metadata: resumeMock.metadata.slice(0, 1),
    contact: resumeMock.contact.slice(0, 2),
    education: [],
    certifications: [],
    affiliations: [],
    hobbyItems: [],
    hobbies: [],
    textSections: [],
    projects: [],
    skillItems: [],
    languages: [],
    summary: Array.from({ length: 30 }, (_, index) => `summary-${index + 1}`).join(" "),
    experience: [
      {
        ...resumeMock.experience[0]!,
        id: "exp-print-dense-1",
        role: "1",
        description: makeDenseTokenBlock("1", 40),
        bullets: [],
      },
      {
        ...resumeMock.experience[0]!,
        id: "exp-print-dense-2",
        role: "2",
        description: makeDenseTokenBlock("2", 8),
        bullets: [],
      },
      {
        ...resumeMock.experience[0]!,
        id: "exp-print-dense-3",
        role: "3",
        description: makeDenseTokenBlock("3", 8),
        bullets: [],
      },
    ],
  };
  const committedPages = planWorkshopResumePages({
    data: resumeData,
    template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
    stylePreset,
  }).committedPages;

  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: "en",
    resumeData,
    stylePreset,
    resumeTemplateId: "workshop_resume_onecol_ats",
    rendererVariantId: "swissminima",
    committedPages,
  };
}

describe("ResumePrintPage", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
      },
    });
    HTMLCanvasElement.prototype.getContext = (() => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 10 }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    delete window.__DASTI_RESUME_PRINT_PAYLOAD__;
    delete window.__DASTI_RESUME_PRINT_BOOTSTRAP__;
    delete window.__DASTI_RESUME_PRINT_STATUS__;
  });

  it("renders the real ResumePage tree for the injected payload and marks the route ready", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildPayload();

    render(<ResumePrintPage />);

    expect(screen.getByLabelText("Grid 17/18")).toBeInTheDocument();
    expect(document.querySelector(".resume-page--robial")).toBeTruthy();
    expect(
      document
        .querySelector(".dasti-resume-print-route")
        ?.getAttribute("data-style-layout"),
    ).toBe("two-column");
    expect(
      document
        .querySelector(".dasti-resume-print-route")
        ?.getAttribute("data-style-typography"),
    ).toBe("quiet-editorial");

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_BOOTSTRAP__).toEqual(buildPayload());
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "two-column",
        typography: "quiet-editorial",
        rendererVariantId: "robial",
        headingFontFamily: expect.stringContaining("Fraunces"),
        bodyFontFamily: expect.stringContaining("Syne"),
        inheritedBodyFontFamilyComputed: expect.any(String),
        surfaceFontFamilyComputed: expect.any(String),
        fontHeadingCssVar: expect.stringContaining("Fraunces"),
        fontBodyCssVar: expect.stringContaining("Syne"),
      }),
    );
  });

  it("renders Swiss Minima with a distinct heading/body font split on the print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "swiss",
        typography: "quiet-editorial",
      },
      rendererVariantId: "swissminima",
    };

    render(<ResumePrintPage />);

    expect(screen.getByLabelText("Swiss Minima")).toBeInTheDocument();
    expect(document.querySelector(".resume-page--swissminima")).toBeTruthy();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "swiss",
        typography: "quiet-editorial",
        rendererVariantId: "swissminima",
        headingFontFamily: expect.stringContaining("Fraunces"),
        bodyFontFamily: expect.stringContaining("Syne"),
        fontHeadingCssVar: expect.stringContaining("Fraunces"),
        fontBodyCssVar: expect.stringContaining("Syne"),
        headingFontFamilyComputed: "var(--font-heading-family)",
        bodyFontFamilyComputed: "var(--font-body-family)",
        inheritedBodyFontFamilyComputed: "var(--font-body-family)",
      }),
    );
  });

  it("renders the workshop template renderer on the print route for workshop payloads", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildWorkshopOverflowPayload();

    render(<ResumePrintPage />);

    expect(screen.getAllByTestId("resume-template-page").length).toBeGreaterThan(1);
    expect(screen.getByTestId("resume-template-renderer")).toBeInTheDocument();
    expect(document.querySelector(".resume-page--swissminima")).toBeFalsy();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "workshop",
        typography: "soft-serif",
        rendererVariantId: "swissminima",
      }),
    );
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.pageCount).toBe(
      screen.getAllByTestId("resume-template-page").length,
    );
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.pageCount).toBeGreaterThan(1);
  });

  it("renders dense workshop continuation from committed pages before later entries on the print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildDenseWorkshopCommittedPayload();

    const { container } = render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const pageShells = Array.from(container.querySelectorAll('[data-testid="resume-template-page"]'));
    const continuedPage = pageShells.find((page) => page.textContent?.includes("Continued"));
    const continuedItems = Array.from(
      continuedPage?.querySelectorAll('[data-preview-section="experience"][data-preview-item-id]') ??
        [],
    );

    expect(pageShells.length).toBeGreaterThan(1);
    expect(continuedPage?.textContent).toContain("Continued");
    expect(continuedItems[0]?.getAttribute("data-preview-item-id")).toBe("exp-print-dense-2");
    expect(
      continuedItems.findIndex(
        (node) => node.getAttribute("data-preview-item-id") === "exp-print-dense-2",
      ),
    ).toBe(0);
    expect(
      continuedItems.findIndex(
        (node) => node.getAttribute("data-preview-item-id") === "exp-print-dense-3",
      ),
    ).toBeGreaterThan(
      continuedItems.findIndex(
        (node) => node.getAttribute("data-preview-item-id") === "exp-print-dense-2",
      ),
    );
    expect(
      continuedItems.findIndex(
        (node) => node.getAttribute("data-preview-item-id") === "exp-print-dense-1",
      ),
    ).toBe(-1);
  });

  it("keeps Robial print-route vars aligned when typography changes", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildPayload();

    const quietView = render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const quietSnapshot = window.__DASTI_RESUME_PRINT_STATUS__?.snapshot;

    quietView.unmount();
    delete window.__DASTI_RESUME_PRINT_STATUS__;
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
        typography: "mono-signal",
      },
      rendererVariantId: "robial",
    };

    render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const monoSnapshot = window.__DASTI_RESUME_PRINT_STATUS__?.snapshot;

    expect(quietSnapshot?.fontHeadingCssVar).toContain("Fraunces");
    expect(quietSnapshot?.fontBodyCssVar).toContain("Syne");
    expect(monoSnapshot?.fontHeadingCssVar).toContain("Archivo");
    expect(monoSnapshot?.fontBodyCssVar).toContain("Archivo");
    expect(quietSnapshot?.fontHeadingCssVar).not.toBe(
      monoSnapshot?.fontHeadingCssVar,
    );
    expect(quietSnapshot?.fontBodyCssVar).not.toBe(
      monoSnapshot?.fontBodyCssVar,
    );
  });

  it("reports an explicit error when the print payload is missing", async () => {
    render(<ResumePrintPage />);

    expect(
      screen.getByText("Resume print payload is missing."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("error");
    });
  });
});
