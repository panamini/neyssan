import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../style";

const recenterViewport = vi.fn();

vi.mock("../../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: () => ({
    fitScale: 1,
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
  useDocumentViewportCentering: () => ({
    attachViewport: () => undefined,
    recenterViewport,
    syncViewport: () => undefined,
  }),
}));

vi.mock("../resume/ResumePage", () => ({
  default: () => <div data-testid="resume-page" />,
}));

describe("VerbatiResumePreview", () => {
  beforeEach(() => {
    recenterViewport.mockClear();
  });

  it("keeps the workspace shell on the canvas viewer classes", () => {
    const { container } = render(
      <VerbatiResumePreview
        data={resumeMock}
        stylePreset={DEFAULT_VERBATI_STYLE}
        hostMode="workspace"
      />,
    );

    expect(recenterViewport).toHaveBeenCalledTimes(1);

    const shell = container.querySelector(
      ".dasti-doc-viewer-shell--resume-workspace",
    );
    const surface = container.querySelector(
      ".dasti-doc-viewer-shell__surface--resume-workspace",
    );

    expect(shell).toBeTruthy();
    expect(surface).toBeTruthy();
    expect(shell).not.toHaveClass("dasti-doc-viewer-shell--resume-workspace-page");
    expect(surface).not.toHaveClass(
      "dasti-doc-viewer-shell__surface--resume-workspace-page",
    );
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
      "dasti-workbench-top-left-slot",
      "dasti-cv-workbench-slot",
    );
    expect(slot).toContainElement(
      screen.getByRole("button", { name: "Toggle workspace mode" }),
    );
    expect(surface).toHaveClass(
      "dasti-doc-viewer-shell__surface--resume-workspace",
    );
    expect(surface).not.toHaveClass(
      "dasti-doc-viewer-shell__surface--resume-workspace-page",
    );
  });
});
