import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResumePreviewMetrics } from "../resume/ResumePage";
import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";
import { A4_PAGE_WIDTH_PX } from "../../../lib/document-stage";

const useDocumentStageLayoutMock = vi.fn(
  ({
    pageHeightPx = 1123,
  }: {
    pageHeightPx?: number;
  }) => ({
    availableWidth: 794,
    availableHeight: 1123,
    stageWidth: 794,
    stageHeight: Math.min(1123, pageHeightPx),
    pageWidth: 794,
    pageHeight: pageHeightPx,
    overflowX: false,
    overflowY: pageHeightPx > 1123,
    isFit: true,
  }),
);
const useDocumentViewportCenteringMock = vi.fn(() => ({
  attachViewport: () => undefined,
}));
const resumePreviewMetricsRef: {
  current:
    | {
        pageCount: number;
        pageGapPx: number;
        stackHeightPx: number;
      }
    | null;
} = {
  current: null,
};
const workshopPreviewMetricsRef: {
  current:
    | {
        pageCount: number;
        pageGapPx: number;
        stackHeightPx: number;
      }
    | null;
} = {
  current: null,
};

vi.mock("../../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: (args: { pageHeightPx?: number }) =>
    useDocumentStageLayoutMock(args),
}));

vi.mock("../../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: (args: unknown) =>
    useDocumentViewportCenteringMock(args),
}));

vi.mock("../../../lib/document-export-debug", () => ({
  readDocumentExportDebugConfig: () => false,
  setResumePreviewDebugCapture: vi.fn(),
}));

vi.mock("../../../lib/resume-font-debug", () => ({
  collectResumeFontDebugSnapshot: vi.fn(() => ({})),
}));

const resumePagePropsSpy = vi.fn();
const resumeTemplateRendererPropsSpy = vi.fn();

vi.mock("../resume/ResumePage", () => ({
  default: ({
    mode,
    activeTarget,
    onPreviewMetricsChange,
  }: {
    mode: string;
    activeTarget?: {
      sectionType?: string;
      itemId?: string;
      source?: string;
    } | null;
    onPreviewMetricsChange?: (metrics: ResumePreviewMetrics) => void;
  }) => {
    resumePagePropsSpy({ mode, activeTarget });
    React.useEffect(() => {
      if (resumePreviewMetricsRef.current) {
        onPreviewMetricsChange?.(resumePreviewMetricsRef.current);
      }
    }, [
      onPreviewMetricsChange,
      resumePreviewMetricsRef.current?.pageCount,
      resumePreviewMetricsRef.current?.pageGapPx,
      resumePreviewMetricsRef.current?.stackHeightPx,
    ]);

    return (
      <div data-testid="resume-page" data-mode={mode}>
        <button
          type="button"
          data-preview-section="contact"
          data-preview-section-id="profile-1"
          data-preview-surface="section"
        >
          Contact alias
        </button>
        <button
          type="button"
          data-preview-section="contact"
          data-preview-section-id="profile-1"
          data-preview-item-id="email"
          data-preview-surface="item"
        >
          Contact email field
        </button>
        <button
          type="button"
          data-preview-section="notes"
          data-preview-section-id="profile-1"
          data-preview-surface="section"
        >
          Notes alias
        </button>
        <button
          type="button"
          data-preview-section="selected_projects"
          data-preview-section-id="projects-1"
          data-preview-item-id="project-1"
          data-preview-surface="item"
          data-preview-active={
            activeTarget?.itemId === "project-1" ? "true" : undefined
          }
        >
          Selected project alias
        </button>
        <button
          type="button"
          data-preview-section="selected_projects"
          data-preview-section-id="projects-1"
          data-preview-item-id="project-1:description"
          data-preview-surface="item"
          data-preview-active={
            activeTarget?.itemId === "project-1:description"
              ? "true"
              : undefined
          }
        >
          Selected project description field
        </button>
      </div>
    );
  },
}));

vi.mock("../resume/ResumeTemplateRenderer", () => ({
  WORKSHOP_TEMPLATE_RENDERER_ID: "workshop_resume_onecol_ats",
  getResumeTemplateCanvasHeight: ({
    pageCount,
    pageHeightPx,
  }: {
    pageCount: number;
    pageHeightPx: number;
  }) => pageCount * pageHeightPx,
  RESUME_TEMPLATE_PAGE_GAP_PX: 24,
  default: ({
    activeTarget,
    onStablePageCountChange,
    onPreviewMetricsChange,
  }: {
    activeTarget?: {
      sectionType?: string;
      itemId?: string;
      source?: string;
    } | null;
    onStablePageCountChange?: (pageCount: number) => void;
    onPreviewMetricsChange?: (metrics: ResumePreviewMetrics) => void;
  }) => {
    resumeTemplateRendererPropsSpy({ activeTarget });
    React.useEffect(() => {
      onStablePageCountChange?.(3);
      if (workshopPreviewMetricsRef.current) {
        onPreviewMetricsChange?.(workshopPreviewMetricsRef.current);
      }
    }, [onPreviewMetricsChange, onStablePageCountChange]);

    return (
      <div data-testid="resume-template-renderer">
        <button
          type="button"
          data-preview-section="selected_projects"
          data-preview-section-id="projects-1"
          data-preview-item-id="project-1:description"
          data-preview-surface="item"
          data-preview-active={
            activeTarget?.itemId === "project-1:description"
              ? "true"
              : undefined
          }
        >
          Workshop project description field
        </button>
      </div>
    );
  },
}));

describe("VerbatiResumePreview", () => {
  afterEach(() => {
    resumePreviewMetricsRef.current = null;
    workshopPreviewMetricsRef.current = null;
    useDocumentStageLayoutMock.mockClear();
    useDocumentViewportCenteringMock.mockClear();
  });

  it("keeps workshop panel preview link intents and active highlighting intact on the template renderer path", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        activeTarget={{
          sectionType: "projects",
          sectionId: "projects-1",
          itemId: "project-1:description",
          previewSectionType: "selected_projects",
          source: "preview-panel",
        }}
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Workshop project description field" }),
    );

    expect(screen.getByTestId("resume-template-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("resume-page")).not.toBeInTheDocument();
    expect(
      document.querySelector(".dasti-doc-viewer-shell--resume-panel"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Workshop project description field" }),
    ).toHaveAttribute("data-preview-active", "true");
    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "project-1:description",
        previewSectionType: "selected_projects",
        source: "preview-panel",
      }),
    );
  });

  it("uses ResumeTemplateRenderer only for the workshop template path and reports stable page counts in workspace mode", async () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    expect(screen.getByTestId("resume-template-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("resume-page")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Page count")).toHaveTextContent("3 pages");
    });
  });

  it("uses measured workshop stack metrics for workspace canvas height instead of synthetic page-count sizing", async () => {
    workshopPreviewMetricsRef.current = {
      pageCount: 3,
      pageGapPx: 24,
      stackHeightPx: 4200,
    };
    const defaultStageLayoutImplementation =
      useDocumentStageLayoutMock.getMockImplementation();
    useDocumentStageLayoutMock.mockImplementation(() => ({
      availableWidth: 794,
      availableHeight: 1123,
      stageWidth: 794,
      stageHeight: 1123,
      pageWidth: 396.85,
      pageHeight: 561.25,
      overflowX: false,
      overflowY: false,
      isFit: true,
    }));

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Page count")).toHaveTextContent("3 pages");
    });

    const canvas = document.querySelector(
      "[data-document-page='true']",
    ) as HTMLDivElement | null;
    const expectedCanvasHeight = 4200 * (396.85 / A4_PAGE_WIDTH_PX);

    expect(Number.parseFloat(canvas?.style.height ?? "0")).toBeCloseTo(
      expectedCanvasHeight,
      2,
    );

    useDocumentStageLayoutMock.mockImplementation(
      defaultStageLayoutImplementation ?? (({ pageHeightPx = 1123 }) => ({
        availableWidth: 794,
        availableHeight: 1123,
        stageWidth: 794,
        stageHeight: Math.min(1123, pageHeightPx),
        pageWidth: 794,
        pageHeight: pageHeightPx,
        overflowX: false,
        overflowY: pageHeightPx > 1123,
        isFit: true,
      })),
    );
  });

  it("keeps non-workshop families entirely on the legacy ResumePage path", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "swiss",
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    expect(screen.getByTestId("resume-page")).toBeInTheDocument();
    expect(
      screen.queryByTestId("resume-template-renderer"),
    ).not.toBeInTheDocument();
  });

  it("keeps workshop compare-layout mode on the legacy comparison path without mixed rendering", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        compareLayouts
      />,
    );

    expect(screen.getByTestId("resume-page")).toHaveAttribute(
      "data-mode",
      "comparisonAll",
    );
    expect(
      screen.queryByTestId("resume-template-renderer"),
    ).not.toBeInTheDocument();
  });

  it("preserves workshop panel preview link intents through the template renderer path", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        activeTarget={{
          sectionType: "projects",
          sectionId: "projects-1",
          itemId: "project-1:description",
          previewSectionType: "selected_projects",
          source: "preview-panel",
        }}
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Workshop project description field" }),
    );

    expect(
      screen.getByRole("button", { name: "Workshop project description field" }),
    ).toHaveAttribute("data-preview-active", "true");
    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "project-1:description",
        previewSectionType: "selected_projects",
        source: "preview-panel",
      }),
    );
  });

  it("preserves workshop workspace preview link intents through the template renderer path", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
        activeTarget={{
          sectionType: "projects",
          sectionId: "projects-1",
          itemId: "project-1:description",
          previewSectionType: "selected_projects",
          source: "preview-workspace",
        }}
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Workshop project description field" }),
    );

    expect(
      screen.getByRole("button", { name: "Workshop project description field" }),
    ).toHaveAttribute("data-preview-active", "true");
    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "project-1:description",
        previewSectionType: "selected_projects",
        source: "preview-workspace",
      }),
    );
  });

  it("routes contact and notes aliases to the profile editor surface from panel clicks", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Contact alias" }));
    fireEvent.click(screen.getByRole("button", { name: "Notes alias" }));

    expect(onLinkIntent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        requestId: expect.any(String),
        sectionType: "profile",
        previewSectionType: "contact",
        source: "preview-panel",
        shouldOpenModal: true,
        sectionId: "profile-1",
      }),
    );
    expect(onLinkIntent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        requestId: expect.any(String),
        sectionType: "profile",
        previewSectionType: "notes",
        source: "preview-panel",
        shouldOpenModal: true,
        sectionId: "profile-1",
      }),
    );
  });

  it("routes selected_projects aliases to the projects editor surface with item targeting", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Selected project alias" }),
    );

    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        sectionType: "projects",
        itemId: "project-1",
        previewSectionType: "selected_projects",
        source: "preview-panel",
        shouldOpenModal: true,
        sectionId: "projects-1",
      }),
    );
  });

  it("preserves selected_projects field targeting for focused preview clicks", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Selected project description field" }),
    );

    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        sectionType: "projects",
        itemId: "project-1:description",
        previewSectionType: "selected_projects",
        source: "preview-panel",
        shouldOpenModal: true,
        sectionId: "projects-1",
      }),
    );
  });

  it("preserves profile field targeting for contact item clicks", () => {
    const onLinkIntent = vi.fn();

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
        onLinkIntent={onLinkIntent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Contact email field" }));

    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        sectionType: "profile",
        previewSectionType: "contact",
        itemId: "email",
        source: "preview-panel",
        shouldOpenModal: true,
        sectionId: "profile-1",
      }),
    );
  });

  it("scrolls the preview viewport while hovering the page in workspace fit mode", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;
    const page = document.querySelector(
      "[data-document-page='true']",
    ) as HTMLDivElement | null;

    expect(viewport).not.toBeNull();
    expect(page).not.toBeNull();

    Object.defineProperty(viewport!, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport!, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(viewport!, "clientWidth", {
      configurable: true,
      value: 794,
    });
    Object.defineProperty(viewport!, "scrollWidth", {
      configurable: true,
      value: 794,
    });
    viewport!.scrollTop = 0;

    fireEvent.wheel(page!, { deltaY: 140 });

    expect(viewport!.scrollTop).toBe(140);
  });

  it("keeps workspace wheel scrolling contained to the preview viewport even at the bottom edge", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;
    const page = document.querySelector(
      "[data-document-page='true']",
    ) as HTMLDivElement | null;
    const scrollRoot = document.createElement("div");

    expect(viewport).not.toBeNull();
    expect(page).not.toBeNull();
    Object.defineProperty(document, "scrollingElement", {
      configurable: true,
      value: scrollRoot,
    });

    Object.defineProperty(viewport!, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport!, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(scrollRoot, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scrollRoot, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    viewport!.scrollTop = 600;
    scrollRoot.scrollTop = 0;

    fireEvent.wheel(page!, { deltaY: 120 });

    expect(viewport!.scrollTop).toBe(600);
    expect(scrollRoot.scrollTop).toBe(0);
  });

  it("lets the browser own wheel scrolling after switching to manual zoom", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;
    const page = document.querySelector(
      "[data-document-page='true']",
    ) as HTMLDivElement | null;

    expect(viewport).not.toBeNull();
    expect(page).not.toBeNull();

    Object.defineProperty(viewport!, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport!, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    viewport!.scrollTop = 0;

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.wheel(page!, { deltaY: 140 });

    expect(viewport!.scrollTop).toBe(0);
    expect(useDocumentViewportCenteringMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("keeps workspace fit geometry single-page while exposing stacked scroll height", async () => {
    resumePreviewMetricsRef.current = {
      pageCount: 3,
      pageGapPx: 16,
      stackHeightPx: 3400,
    };

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="workspace"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Page count")).toHaveTextContent("3 pages");
    });

    const canvas = document.querySelector(
      "[data-document-page='true']",
    ) as HTMLDivElement | null;
    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;
    const expectedCanvasHeight = 3400 * (794 / A4_PAGE_WIDTH_PX);

    expect(canvas?.dataset.documentPageCount).toBe("3");
    expect(canvas?.dataset.documentPageStack).toBe("true");
    expect(Number.parseFloat(canvas?.style.height ?? "0")).toBeCloseTo(
      expectedCanvasHeight,
      2,
    );
    expect(viewport?.style.height).toBe("1123px");
    expect(viewport?.dataset.stageMode).toBe("overflow");
    expect(viewport?.dataset.overflowX).toBe("false");
    expect(viewport?.dataset.overflowY).toBe("true");
    expect(useDocumentStageLayoutMock.mock.lastCall?.[0]).not.toHaveProperty(
      "pageHeightPx",
    );
    expect(useDocumentViewportCenteringMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        defaultCenterY: 0,
      }),
    );
  });

  it("keeps the panel viewport fixed and scrolls the stacked resume inside it", async () => {
    resumePreviewMetricsRef.current = {
      pageCount: 2,
      pageGapPx: 13.6,
      stackHeightPx: 2260,
    };

    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
      />,
    );

    await waitFor(() => {
      const canvas = document.querySelector(
        "[data-document-page='true']",
      ) as HTMLDivElement | null;
      const expectedCanvasHeight = 2260 * (794 / A4_PAGE_WIDTH_PX);

      expect(Number.parseFloat(canvas?.style.height ?? "0")).toBeCloseTo(
        expectedCanvasHeight,
        2,
      );
    });

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;

    expect(viewport?.style.height).toBe("1123px");
    expect(viewport?.dataset.stageMode).toBe("overflow");
    expect(viewport?.dataset.overflowX).toBe("false");
    expect(viewport?.dataset.overflowY).toBe("true");
    expect(useDocumentStageLayoutMock.mock.lastCall?.[0]).not.toHaveProperty(
      "pageHeightPx",
    );
  });

  it("clamps the panel viewport back to the last page when stacked content shrinks", async () => {
    resumePreviewMetricsRef.current = {
      pageCount: 3,
      pageGapPx: 16,
      stackHeightPx: 3400,
    };

    const { rerender } = render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
      />,
    );

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;

    expect(viewport).not.toBeNull();

    let viewportScrollHeight = 1800;

    Object.defineProperty(viewport!, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport!, "scrollHeight", {
      configurable: true,
      get: () => viewportScrollHeight,
    });
    Object.defineProperty(viewport!, "clientWidth", {
      configurable: true,
      value: 794,
    });
    Object.defineProperty(viewport!, "scrollWidth", {
      configurable: true,
      value: 794,
    });

    viewport!.scrollTop = 900;

    viewportScrollHeight = 940;
    resumePreviewMetricsRef.current = {
      pageCount: 2,
      pageGapPx: 16,
      stackHeightPx: 1700,
    };

    rerender(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
      />,
    );

    await waitFor(() => {
      expect(viewport!.scrollTop).toBe(340);
    });
  });

  it("keeps panel wheel scrolling owned by the preview viewport even over blank viewport space", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={{
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }}
        hostMode="panel"
      />,
    );

    const viewport = document.querySelector(
      ".dasti-doc-viewport--resume",
    ) as HTMLDivElement | null;
    const scrollRoot = document.createElement("div");

    expect(viewport).not.toBeNull();
    Object.defineProperty(document, "scrollingElement", {
      configurable: true,
      value: scrollRoot,
    });

    Object.defineProperty(viewport!, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport!, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(viewport!, "clientWidth", {
      configurable: true,
      value: 794,
    });
    Object.defineProperty(viewport!, "scrollWidth", {
      configurable: true,
      value: 794,
    });
    Object.defineProperty(scrollRoot, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scrollRoot, "scrollHeight", {
      configurable: true,
      value: 1200,
    });

    viewport!.scrollTop = 600;
    scrollRoot.scrollTop = 0;

    fireEvent.wheel(viewport!, { deltaY: 120 });

    expect(viewport!.scrollTop).toBe(600);
    expect(scrollRoot.scrollTop).toBe(0);
  });
});
