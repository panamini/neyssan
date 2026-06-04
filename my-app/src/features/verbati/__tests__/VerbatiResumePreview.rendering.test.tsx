import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../style";

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
    overflowX: false,
    overflowY: false,
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

const ROBIAL_STYLE_PRESET = {
  ...DEFAULT_VERBATI_STYLE,
  layout: "two-column",
} as const;

const RESUME_WITHOUT_PROJECTS = {
  ...resumeMock,
  projects: [],
};

describe("VerbatiResumePreview rendering", () => {
  it("renders the CV document image as a free decoration layer in design mode", () => {
    const { container } = render(
      <VerbatiResumePreview
        data={RESUME_WITHOUT_PROJECTS}
        stylePreset={ROBIAL_STYLE_PRESET}
        hostMode="workspace"
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "portrait.png",
          mimeType: "image/png",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 42,
          yMm: 56,
        }}
        documentDecorationDesignMode
      />,
    );

    const decoration = container.querySelector(".dasti-cv-document-decoration");
    expect(decoration).toBeTruthy();
    expect(decoration).toHaveAttribute("data-design-mode", "true");
    expect(decoration?.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
    expect(
      screen.getByRole("button", { name: "Hide CV image" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload CV image" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove CV image" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-cv-document-decoration__resize-handle"),
    ).toBeTruthy();
  });

  it("moves the CV document image on the rendered page in design mode", () => {
    const onDocumentDecorationChange = vi.fn();
    const onDocumentDecorationCommit = vi.fn();
    const { container } = render(
      <VerbatiResumePreview
        data={RESUME_WITHOUT_PROJECTS}
        stylePreset={ROBIAL_STYLE_PRESET}
        hostMode="workspace"
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "portrait.png",
          mimeType: "image/png",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        }}
        documentDecorationDesignMode
        onDocumentDecorationChange={onDocumentDecorationChange}
        onDocumentDecorationCommit={onDocumentDecorationCommit}
      />,
    );
    const page = container.querySelector(
      ".dasti-document-stage__canvas[data-document-page='true']",
    ) as HTMLElement;
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 2100,
      bottom: 2970,
      width: 2100,
      height: 2970,
      toJSON: () => ({}),
    } as DOMRect);
    const decoration = container.querySelector(
      ".dasti-cv-document-decoration",
    ) as HTMLElement;

    fireEvent(
      decoration,
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 170,
        clientY: 350,
      }),
    );
    fireEvent(
      decoration,
      new MouseEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: 270,
        clientY: 450,
      }),
    );
    fireEvent(
      decoration,
      new MouseEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: 270,
        clientY: 450,
      }),
    );

    expect(onDocumentDecorationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        placementMode: "custom",
        xMm: 27,
        yMm: 45,
      }),
    );
    expect(onDocumentDecorationCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        placementMode: "custom",
        xMm: 27,
        yMm: 45,
      }),
    );
  });

  it.each(["panel", "workspace"] as const)(
    "does not render a ghost projects heading in %s mode when projects are empty",
    (hostMode) => {
      const { container } = render(
        <VerbatiResumePreview
          data={RESUME_WITHOUT_PROJECTS}
          stylePreset={ROBIAL_STYLE_PRESET}
          hostMode={hostMode}
        />,
      );

      expect(
        screen.queryByText(/^Selected projects$/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete Selected projects" }),
      ).not.toBeInTheDocument();
      expect(
        container.querySelectorAll('[data-live-resume-preview="true"]'),
      ).toHaveLength(1);
    },
  );
});
