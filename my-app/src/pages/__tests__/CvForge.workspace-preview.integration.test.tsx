import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";

const { mutationMock, transformSelectionMock, importCvMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(async () => undefined),
  transformSelectionMock: vi.fn(async () => ({ text: "Built better." })),
  importCvMock: vi.fn(async () => undefined),
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
  useAction: vi.fn(() => transformSelectionMock),
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

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: {
      id: "cv_123",
      title: "Test CV",
      metadata: {
        createdAt: "2026-04-17T12:00:00.000Z",
        updatedAt: "2026-04-17T12:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Ada Lovelace" }],
        },
        {
          id: "summary-1",
          type: "summary",
          title: "Summary",
          blocks: [],
          structuredContent: [{ id: "summary-item-1", summary: "Builder." }],
        },
      ],
    },
    currentCvId: "cv_123",
    createNewCv: vi.fn(async () => undefined),
    importCv: importCvMock,
    cvs: [],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    loadCv: vi.fn(() => true),
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

vi.mock("../../lib/buildCanonicalResumeRenderModel", () => ({
  buildCanonicalResumeRenderModelFromCv: () => ({
    name: "Ada Lovelace",
    title: "Product Designer",
    summary: "Builder.",
    contact: [],
    metadata: [],
    experience: [],
    education: [],
    skills: [{ label: "TypeScript" }],
    projects: [],
    certifications: [],
    languages: [],
    affiliations: [],
    textSections: [],
  }),
}));

vi.mock("../../features/verbati/cvDocumentToResumeData", () => ({
  hasRenderableResumeData: (data: unknown) => Boolean(data),
}));

vi.mock("../../lib/editor-ai-selection", () => ({
  getDomSelectionState: () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    return {
      text: selection.toString().trim() || "Builder",
      anchor: {
        left: 140,
        top: 80,
        bottom: 100,
        leftEdge: 100,
        rightEdge: 180,
        width: 80,
        height: 20,
        lineCount: 1,
        aboveCenter: 140,
        aboveLeft: 100,
        aboveRight: 180,
        aboveLineHeight: 20,
        belowCenter: 140,
        belowLeft: 100,
        belowRight: 180,
        belowLineHeight: 20,
      },
    };
  },
  isInlineAiToolbarActiveElement: () => false,
  isPrimaryPointerPressed: () => false,
}));

vi.mock("../../features/verbati/VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    hostMode = "panel",
    onLinkIntent,
    activeTarget,
    inlineEditing,
  }: {
    hostMode?: "panel" | "workspace";
    inlineEditing?: {
      enabled: boolean;
      onActivate?: (target: any) => void;
    } | null;
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
    <div className="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-panel">
      <div
        className="dasti-doc-viewport dasti-doc-viewport--resume"
        data-document-stage="true"
        data-stage-mode="fit"
      >
        <div data-testid={`verbati-preview-${hostMode}`}>
          {inlineEditing?.enabled ? (
            <div
              role="textbox"
              tabIndex={0}
              data-testid="mock-rich-summary"
              data-inline-paper-editable="true"
              data-paper-section-id="summary-1"
              data-paper-section-type="summary"
              data-paper-field-path="structuredContent.0.summary"
              data-paper-field-kind="paragraph"
              onFocus={() =>
                inlineEditing.onActivate?.({
                  sectionId: "summary-1",
                  sectionType: "summary",
                  fieldPath: "structuredContent.0.summary",
                  fieldKind: "paragraph",
                })
              }
            >
              Builder.
            </div>
          ) : null}
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
      </div>
    </div>
  ),
}));

describe("CvForge workspace preview integration", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
    transformSelectionMock.mockClear();
    transformSelectionMock.mockResolvedValue({ text: "Built better." });
    importCvMock.mockClear();
  });

  it("routes floating toolbar summary results through the Ask suggestion flow", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/CvForge.tsx"), "utf8");

    expect(source).toContain("setCvRailTab(\"ai\")");
    expect(source).toContain("inlineTarget:");
    expect(source).toContain("beforeText: inlinePaperSelectionState.text");
    expect(source).toContain("state: \"ready\"");
    expect(source).toContain("applyMode: \"preview_required\"");
    expect(source).toContain("applyInlineAiTextToSectionField");
    expect(source).toContain("pendingInlineFieldChangeRef.current = null");
  });

  it("routes page preview through the PR4 forge shell and live resume canvas stage", async () => {
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

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-panel"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-workspace"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-document-rail--resume-workspace"),
    ).toBeNull();
    expect(container.querySelector(".dasti-cv-skeleton-forge")).toBeTruthy();
    expect(container.querySelector(".dasti-cv-page-preview-stage")).toBeTruthy();
    expect(container.querySelector(".dasti-cv-preview-workbench")).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "CV forge rail" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '.dasti-doc-viewport--resume[data-document-stage="true"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-doc-viewer-shell--resume-workspace-page"),
    ).toBeNull();
  });

  it("opens PR4 skeleton style controls instead of the old style inspector", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(
      screen.getByRole("button", { name: /Geist Bold Baskervville/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Terre accent" })).toBeInTheDocument();
    expect(screen.queryByTestId("embedded-style-inspector")).toBeNull();
  });

  it("keeps workspace preview mode for modal-canonical preview intents", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    await user.click(
      screen.getByRole("button", { name: "Trigger modal preview link" }),
    );

    expect(
      container.querySelector(".dasti-cv-page-preview-stage"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Back to resume editing" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("verbati-preview-active-panel")).toHaveTextContent(
      "experience:exp-1",
    );
  });

  it("keeps page preview mode for inline preview intents while updating the active target", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    await user.click(
      screen.getByRole("button", { name: "Trigger inline preview link" }),
    );

    expect(
      container.querySelector(".dasti-cv-page-preview-stage"),
    ).toBeTruthy();
    expect(screen.getByTestId("verbati-preview-active-panel")).toHaveTextContent(
      "custom:section",
    );
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

    expect(screen.getByTestId("verbati-preview-panel")).toBeInTheDocument();
    expect(screen.getByTestId("verbati-preview-active-panel")).toHaveTextContent(
      "experience:exp-1",
    );
    expect(
      screen.queryByText("Mock profile editor cv_123"),
    ).not.toBeInTheDocument();
  });
});
