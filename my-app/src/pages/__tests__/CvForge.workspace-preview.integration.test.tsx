import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";

const { mutationMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(async () => undefined),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn(() => mutationMock),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    return {
      preset1: null,
      preset2: null,
      preset3: null,
      activeSlot: null,
    };
  }),
  useAction: vi.fn(() => undefined),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    toolbarLeadControl,
    toolbarPrimaryControl,
    resumeLinkIntent,
    activeTarget,
  }: {
    cvId?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
    resumeLinkIntent?: {
      requestId: string;
      sectionType: string;
      itemId?: string;
    } | null;
    activeTarget?: {
      sectionType: string;
      itemId?: string;
    } | null;
  }) => (
    <div data-testid="profile-review-root">
      <div className="dasti-workbench-top-left-slot--cv">
        <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
      </div>
      <div>Mock profile editor {cvId ?? "none"}</div>
      <div data-testid="profile-review-link-intent">
        {resumeLinkIntent
          ? `${resumeLinkIntent.sectionType}:${resumeLinkIntent.itemId ?? "section"}`
          : "none"}
      </div>
      <div data-testid="profile-review-active-target">
        {activeTarget
          ? `${activeTarget.sectionType}:${activeTarget.itemId ?? "section"}`
          : "none"}
      </div>
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

vi.mock("../../features/verbati/VerbatiCvPreviewPanel", () => ({
  VerbatiCvPreviewPanel: ({
    hostMode = "panel",
    railLeadControl,
    onLinkIntent,
    activeTarget,
  }: {
    hostMode?: "panel" | "workspace";
    railLeadControl?: React.ReactNode;
    onLinkIntent?: (intent: {
      requestId: string;
      sectionType: "experience";
      itemId?: string;
      source: "preview-panel" | "preview-workspace";
      shouldOpenModal: boolean;
      sectionId?: string;
      sectionTitle?: string;
    }) => void;
    activeTarget?: { sectionType: string; itemId?: string } | null;
  }) => (
    <>
      {hostMode === "workspace" ? (
        <div className="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-workspace">
          <div className="dasti-proposal-sheet__body--document-viewer">
            <div
              className="dasti-doc-viewport dasti-doc-viewport--resume"
              data-document-stage="true"
              data-stage-mode="fit"
            >
              {railLeadControl}
              <div data-testid="embedded-style-inspector" />
              <div data-testid="verbati-preview-workspace">
                <button
                  type="button"
                  onClick={() =>
                    onLinkIntent?.({
                      requestId: `${hostMode}-intent-1`,
                      sectionType: "experience",
                      itemId: "exp-1",
                      source: "preview-workspace",
                      shouldOpenModal: true,
                      sectionId: "experience-1",
                      sectionTitle: "Experience",
                    })
                  }
                >
                  Trigger modal preview link
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLinkIntent?.({
                      requestId: `${hostMode}-intent-inline`,
                      sectionType: "custom",
                      source: "preview-workspace",
                      shouldOpenModal: false,
                      sectionId: "custom-text-1",
                      sectionTitle: "Community",
                    } as any)
                  }
                >
                  Trigger inline preview link
                </button>
                <div data-testid="verbati-preview-active-workspace">
                  {activeTarget
                    ? `${activeTarget.sectionType}:${activeTarget.itemId ?? "section"}`
                    : "none"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div data-testid={`verbati-preview-${hostMode}`}>
          <button
            type="button"
            onClick={() =>
              onLinkIntent?.({
                requestId: `${hostMode}-intent-1`,
                sectionType: "experience",
                itemId: "exp-1",
                source: "preview-panel",
                shouldOpenModal: true,
                sectionId: "experience-1",
                sectionTitle: "Experience",
              })
            }
          >
            Trigger modal preview link
          </button>
          <button
            type="button"
            onClick={() =>
              onLinkIntent?.({
                requestId: `${hostMode}-intent-inline`,
                sectionType: "custom",
                source: "preview-panel",
                shouldOpenModal: false,
                sectionId: "custom-text-1",
                sectionTitle: "Community",
              } as any)
            }
          >
            Trigger inline preview link
          </button>
          <div data-testid={`verbati-preview-active-${hostMode}`}>
            {activeTarget
              ? `${activeTarget.sectionType}:${activeTarget.itemId ?? "section"}`
              : "none"}
          </div>
        </div>
      )}
    </>
  ),
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

  it("keeps workspace preview mode for modal-canonical preview intents", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Trigger modal preview link" }),
    );

    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-workspace"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Back to resume editing" }),
    ).toBeVisible();
    expect(screen.getByTestId("verbati-preview-active-workspace")).toHaveTextContent(
      "experience:exp-1",
    );
  });

  it("switches back to edit only for inline preview intents", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Trigger inline preview link" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Mock profile editor cv_123")).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: "Open resume preview" }),
    ).toBeVisible();
    expect(screen.getByTestId("profile-review-link-intent")).toHaveTextContent(
      "custom:section",
    );
    expect(
      screen.getByTestId("profile-review-active-target"),
    ).toHaveTextContent("custom:section");
  });

  it("routes panel preview clicks while staying in edit mode", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "Trigger modal preview link" })[0],
    );

    expect(screen.getByText("Mock profile editor cv_123")).toBeVisible();
    expect(screen.getByTestId("profile-review-link-intent")).toHaveTextContent(
      "experience:exp-1",
    );
    expect(
      screen.getByTestId("profile-review-active-target"),
    ).toHaveTextContent("experience:exp-1");
  });
});
