import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../style";

const recenterViewport = vi.fn();
const viewportCenteringSpy = vi.fn();

vi.mock("../../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: () => ({
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
  }),
}));

vi.mock("../../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: (options: Record<string, unknown>) => {
    viewportCenteringSpy(options);
    return {
      attachViewport: () => undefined,
      recenterViewport,
      syncViewport: () => undefined,
    };
  },
}));

vi.mock("../resume/ResumePage", () => ({
  default: () => <div data-testid="resume-page" />,
}));

describe("VerbatiResumePreview", () => {
  beforeEach(() => {
    recenterViewport.mockClear();
    viewportCenteringSpy.mockClear();
  });

  it("keeps the workspace shell on the canvas viewer classes", () => {
    const { container } = render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={DEFAULT_VERBATI_STYLE}
        hostMode="workspace"
      />,
    );

    const shell = container.querySelector(
      ".dasti-doc-viewer-shell--resume-workspace",
    );
    const rail = container.querySelector(".dasti-document-rail--resume-workspace");

    expect(shell).toBeTruthy();
    expect(rail).toBeTruthy();
    expect(shell).not.toHaveClass("dasti-doc-viewer-shell--resume-workspace-page");

    const lastCall =
      viewportCenteringSpy.mock.calls[viewportCenteringSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ defaultCenterX: 0.5, defaultCenterY: 0.5 });
  });

  it("renders workspace controls in the shared top-left slot before the resume surface", () => {
    const { container } = render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={DEFAULT_VERBATI_STYLE}
        hostMode="workspace"
        railLeadControl={
          <button type="button" aria-label="Toggle workspace mode">
            Toggle workspace mode
          </button>
        }
      />,
    );

    const shell = container.querySelector(
      ".dasti-doc-viewer-shell--resume-workspace",
    );
    expect(shell).toBeTruthy();

    const slot = shell?.firstElementChild as HTMLElement | null;
    const surface = shell?.children[1] as HTMLElement | undefined;

    expect(slot).toHaveClass(
      "dasti-document-rail",
      "dasti-document-rail--resume-workspace",
    );
    expect(slot).toContainElement(
      screen.getByRole("button", { name: "Toggle workspace mode" }),
    );
    expect(surface).toHaveClass(
      "dasti-proposal-sheet-frame",
      "dasti-proposal-sheet-frame--resume-workspace",
    );
    expect(
      screen.getByRole("button", { name: "Fit page" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fit width" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "100 percent zoom" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Page count")).toHaveTextContent("1 page");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("keeps the explicit fit controls centered on the full page in workspace mode", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={DEFAULT_VERBATI_STYLE}
        hostMode="workspace"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fit page" }));

    const lastCall =
      viewportCenteringSpy.mock.calls[viewportCenteringSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ defaultCenterX: 0.5, defaultCenterY: 0.5 });
  });

  it("renders the edit-preview toggle in the mini render without layout slideshow arrows", () => {
    render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={DEFAULT_VERBATI_STYLE}
        hostMode="panel"
        railLeadControl={
          <button type="button" aria-label="Open resume preview">
            Open resume preview
          </button>
        }
      />,
    );

    expect(
      screen.getByRole("button", { name: "Open resume preview" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show next resume layout:/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show previous resume layout:/ }),
    ).not.toBeInTheDocument();
  });
});
