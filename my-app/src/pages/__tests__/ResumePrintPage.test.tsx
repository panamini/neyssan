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

function buildWorkshopEducationPayload(): ResumePrintRoutePayload {
  const currentCv = generateCvTemplate("Workshop Education CV");
  currentCv.metadata.verbatiStyle = {
    familyId: "workshop",
    layout: "workshop",
    typography: "quiet-editorial",
    palette: "sauge",
  };
  const educationSection = currentCv.sections.find(
    (section) => section.type === "education",
  );
  if (educationSection?.structuredContent && Array.isArray(educationSection.structuredContent)) {
    educationSection.structuredContent = [
      {
        ...(educationSection.structuredContent[0] ?? {
          id: "edu-print-1",
          institution: "",
          degree: "",
          isCurrent: false,
        }),
        id: "edu-print-1",
        institution: "Northbridge University",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        grade: "3.9 GPA",
        startDate: "2016-01-01T00:00:00.000Z",
        endDate: "2020-01-01T00:00:00.000Z",
        startDatePrecision: "year",
        endDatePrecision: "year",
        isCurrent: false,
      },
    ];
  }

  const previewSource = buildStyledResumePrintSource({
    currentCv,
    stylePreset: currentCv.metadata.verbatiStyle,
  });
  if (!previewSource) {
    throw new Error("Expected workshop preview source for education payload test.");
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

function buildRichWorkshopCommittedPayload(): ResumePrintRoutePayload {
  const stylePreset = {
    familyId: "workshop",
    layout: "workshop",
    typography: "quiet-editorial",
    palette: "sauge",
  } as const;
  const sourceResumeData = {
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
    achievements: [],
    achievementItems: [],
    summary: "Compact summary.",
    experience: [
      {
        ...resumeMock.experience[0]!,
        id: "exp-print-rich",
        description: "",
        bullets: [],
        responsibilitiesRich: {
          blocks: [
            {
              kind: "paragraph" as const,
              runs: [
                { text: "Directed the " },
                { text: "migration roadmap", bold: true },
                { text: " across three squads." },
              ],
            },
            {
              kind: "bullet_list" as const,
              items: [
                {
                  runs: [
                    { text: "Reduced " },
                    { text: "rollback incidents", italic: true },
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
          ],
        },
      },
    ],
  };
  const committedPages = planWorkshopResumePages({
    data: sourceResumeData,
    template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
    stylePreset,
  }).committedPages;
  const fallbackResumeData = {
    ...sourceResumeData,
    experience: sourceResumeData.experience.map((item) => ({
      ...item,
      responsibilitiesRich: undefined,
      description: "Fallback description should not render.",
      bullets: ["Fallback bullet should not render."],
    })),
  };

  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: "en",
    resumeData: fallbackResumeData,
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
    ).toBe("geist-baskervville");

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_BOOTSTRAP__).toEqual(buildPayload());
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "two-column",
        typography: "geist-baskervville",
        rendererVariantId: "robial",
        headingFontFamily: expect.stringContaining("Geist"),
        bodyFontFamily: expect.stringContaining("Baskervville"),
        inheritedBodyFontFamilyComputed: expect.any(String),
        surfaceFontFamilyComputed: expect.any(String),
        fontHeadingCssVar: expect.stringContaining("Geist"),
        fontBodyCssVar: expect.stringContaining("Baskervville"),
      }),
    );
  });

  it("renders Swiss Minima with a distinct heading/body font split on the print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        familyId: "swiss",
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

  it("renders the editorial sidebar resume through the legacy ResumePage path on the print route", async () => {
    const payload = buildPayload();
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...payload,
      resumeData: {
        ...payload.resumeData,
        experience: payload.resumeData.experience.map((item, index) =>
          index === 0
            ? {
                ...item,
                bullets: ["", "Visible editorial bullet", "   "],
              }
            : item,
        ),
      },
      stylePreset: {
        ...payload.stylePreset,
        resumeTemplateId: "editorial-sidebar" as const,
      },
      resumeTemplateId: "editorial-sidebar" as const,
      rendererVariantId: "editorialsidebar" as const,
      committedPages: undefined,
    };

    render(<ResumePrintPage />);

    expect(screen.queryByTestId("resume-template-renderer")).not.toBeInTheDocument();
    expect(document.querySelector(".resume-page--editorialsidebar")).toBeTruthy();
    expect(document.querySelector(".resume-inner--editorialsidebar")).toBeTruthy();
    expect(document.querySelector(".resume-grid--editorialsidebar")).toBeTruthy();
    expect(document.querySelector(".name--editorialsidebar")).toBeTruthy();
    expect(document.querySelector(".resume-sidebar--editorialsidebar")).toBeTruthy();
    expect(document.querySelector(".resume-main--editorialsidebar")).toBeTruthy();
    expect(screen.queryByText("Résumé")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work" })).toBeInTheDocument();
    expect(screen.getByText("Visible editorial bullet")).toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll(
          ".resume-page--editorialsidebar .bullet-list li",
        ),
      ).every((item) => item.textContent?.trim()),
    ).toBe(true);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });
  });

  it("renders the workshop template renderer on the print route for workshop payloads", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildWorkshopOverflowPayload();

    render(<ResumePrintPage />);

    expect(screen.getAllByTestId("resume-template-page").length).toBeGreaterThan(0);
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
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.pageCount).toBeGreaterThan(0);
  });

  it("fails closed when a Workshop print payload omits committed pages", async () => {
    const payload = buildWorkshopOverflowPayload();
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...payload,
      committedPages: undefined,
    };

    render(<ResumePrintPage />);

    expect(
      screen.getByText(/Committed workshop print pages are required/i),
    ).toBeInTheDocument();
    expect(window.__DASTI_RESUME_PRINT_STATUS__).toEqual(
      expect.objectContaining({
        status: "error",
        error: expect.stringMatching(/Committed workshop print pages/i),
      }),
    );
  });

  it("renders the two-column workshop template renderer on the print route", async () => {
    const payload = buildWorkshopOverflowPayload();
    const stylePreset = {
      ...payload.stylePreset,
      resumeTemplateId: "workshop_resume_twocol_ats" as const,
    };
    const committedPages = planWorkshopResumePages({
      data: payload.resumeData,
      template: getResumeTemplateDefinition("workshop_resume_twocol_ats"),
      stylePreset,
    }).committedPages;
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...payload,
      stylePreset,
      resumeTemplateId: "workshop_resume_twocol_ats",
      committedPages,
    };

    render(<ResumePrintPage />);

    expect(screen.getByTestId("resume-template-renderer")).toBeInTheDocument();
    expect(document.querySelector('[data-resume-template-layout="workshop-two-column"]')).toBeTruthy();
    expect(document.querySelector('[data-resume-template-column="sidebar"]')).toBeTruthy();
    expect(document.querySelector('[data-resume-template-column="main"]')).toBeTruthy();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });
  });

  it("renders workshop committed rich responsibilities on the print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildRichWorkshopCommittedPayload();

    const { container } = render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const experienceItem = container.querySelector(
      '[data-preview-section="experience"][data-preview-item-id="exp-print-rich"]',
    ) as HTMLElement | null;

    expect(experienceItem?.textContent).toContain(
      "Directed the migration roadmap across three squads.",
    );
    expect(experienceItem?.querySelector("strong")?.textContent).toBe(
      "migration roadmap",
    );
    expect(experienceItem?.querySelector("em")?.textContent).toBe(
      "rollback incidents",
    );
    expect(experienceItem?.querySelector("u")?.textContent).toBe(
      "launch checklists",
    );
    expect(experienceItem?.querySelectorAll("li")).toHaveLength(2);
    expect(experienceItem?.textContent).not.toContain(
      "Fallback description should not render.",
    );
    expect(experienceItem?.textContent).not.toContain(
      "Fallback bullet should not render.",
    );
  });

  it("renders composed education metadata on the workshop print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildWorkshopEducationPayload();

    render(<ResumePrintPage />);

    expect(
      screen.getByText("Bachelor of Science, Computer Science"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Northbridge University · Grade: 3.9 GPA · 2016 — 2020"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });
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

    const defaultSnapshot = window.__DASTI_RESUME_PRINT_STATUS__?.snapshot;

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

    expect(defaultSnapshot?.fontHeadingCssVar).toContain("Geist");
    expect(defaultSnapshot?.fontBodyCssVar).toContain("Baskervville");
    expect(monoSnapshot?.fontHeadingCssVar).toContain("Archivo");
    expect(monoSnapshot?.fontBodyCssVar).toContain("Archivo");
    expect(defaultSnapshot?.fontHeadingCssVar).not.toBe(
      monoSnapshot?.fontHeadingCssVar,
    );
    expect(defaultSnapshot?.fontBodyCssVar).not.toBe(
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
