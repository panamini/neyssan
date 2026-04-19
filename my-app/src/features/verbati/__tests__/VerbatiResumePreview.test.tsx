import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";

vi.mock("../../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: () => ({
    availableWidth: 794,
    availableHeight: 1123,
    stageWidth: 794,
    stageHeight: 1123,
    pageWidth: 794,
    pageHeight: 1123,
    isFit: true,
  }),
}));

vi.mock("../../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: () => ({
    attachViewport: () => undefined,
  }),
}));

vi.mock("../../../lib/document-export-debug", () => ({
  readDocumentExportDebugConfig: () => false,
  setResumePreviewDebugCapture: vi.fn(),
}));

vi.mock("../../../lib/resume-font-debug", () => ({
  collectResumeFontDebugSnapshot: vi.fn(() => ({})),
}));

const resumePagePropsSpy = vi.fn();

vi.mock("../resume/ResumePage", () => ({
  default: ({
    mode,
    activeTarget,
  }: {
    mode: string;
    activeTarget?: {
      sectionType?: string;
      itemId?: string;
      source?: string;
    } | null;
  }) => {
    resumePagePropsSpy({ mode, activeTarget });

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

describe("VerbatiResumePreview", () => {
  it("keeps workshop on the legacy panel preview path with link intents and active highlighting intact", () => {
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
      screen.getByRole("button", { name: "Selected project description field" }),
    );

    expect(screen.getByTestId("resume-page")).toHaveAttribute(
      "data-mode",
      "swissminima",
    );
    expect(
      document.querySelector(".dasti-doc-viewer-shell--resume-panel"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Selected project description field" }),
    ).toHaveAttribute("data-preview-active", "true");
    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "project-1:description",
        previewSectionType: "selected_projects",
        source: "preview-panel",
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

  it("falls back to the document scroll root when the page viewport itself cannot scroll", () => {
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
      value: 600,
    });
    Object.defineProperty(scrollRoot, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scrollRoot, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    viewport!.scrollTop = 0;
    scrollRoot.scrollTop = 0;

    fireEvent.wheel(page!, { deltaY: 120 });

    expect(viewport!.scrollTop).toBe(0);
    expect(scrollRoot.scrollTop).toBe(120);
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
  });
});
