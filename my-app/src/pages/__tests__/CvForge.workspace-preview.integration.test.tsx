import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    preset1: null,
    preset2: null,
    preset3: null,
    activeSlot: null,
  })),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    toolbarLeadControl,
    toolbarPrimaryControl,
  }: {
    cvId?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
  }) => (
    <div>
      <div className="dasti-workbench-top-left-slot--cv">
        <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
      </div>
      <div>Mock profile editor {cvId ?? "none"}</div>
      {toolbarPrimaryControl}
    </div>
  ),
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: () => <div data-testid="embedded-style-inspector" />,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    importCv: vi.fn(),
  }),
}));

vi.mock("../../features/verbati/useBoundVerbatiCvStyle", () => ({
  useBoundVerbatiCvStyle: () => ({
    stylePreset: DEFAULT_VERBATI_STYLE,
    setStylePreset: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-document-stage-layout", () => ({
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

vi.mock("../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: () => ({
    attachViewport: () => undefined,
    recenterViewport: () => undefined,
    syncViewport: () => undefined,
  }),
}));

vi.mock("../../features/verbati/resume/ResumePage", () => ({
  default: () => <div data-testid="resume-page" />,
}));

describe("CvForge workspace preview integration", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
  });

  it("routes preview mode through the live resume workspace canvas stage", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1360,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-workspace"),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '.dasti-doc-viewport--resume[data-document-stage="true"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-workspace-page"),
    ).toBeNull();
  });

  it("opens the live style controls when no saved styles exist", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume style controls" }),
    );

    expect(
      screen.getByTestId("embedded-style-inspector"),
    ).toBeInTheDocument();
  });
});
