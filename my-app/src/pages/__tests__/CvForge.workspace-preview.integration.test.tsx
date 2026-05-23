import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";

const { authMock, mutationMock, transformSelectionMock, importCvMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(() => ({
      isAuthenticated: true,
      isLoading: false,
    })),
    mutationMock: vi.fn(async () => undefined),
    transformSelectionMock: vi.fn(async () => ({ text: "Built better." })),
    importCvMock: vi.fn(async () => undefined),
  }),
);

function getImportedSummary(call: unknown[]): unknown {
  const doc = call[0] as any;
  const readText = (value: any): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
    if (value && typeof value === "object") {
      return (
        readText(value.text) ||
        readText(value.content) ||
        readText(value.plainText)
      );
    }
    return "";
  };
  const value = doc?.sections?.find((section: any) => section?.id === "summary-1")
    ?.structuredContent?.[0]?.summary;
  return readText(value);
}

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => authMock()),
  useMutation: vi.fn(() => mutationMock),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    if (reference === "proposalsPublic.default") {
      return [];
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

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      getPresets: "proposalSettings.getPresets",
    },
    proposalsPublic: {
      default: "proposalsPublic.default",
    },
    functions: {
      transformEditorSelection: "functions.transformEditorSelection",
    },
  },
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
  buildCanonicalResumeRenderModelFromCv: (cv: any) => {
    const readPlainText = (value: any): string => {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) {
        return value.map(readPlainText).filter(Boolean).join("\n");
      }
      if (value && typeof value === "object") {
        if (typeof value.content === "string") return value.content;
        if (Array.isArray(value.content)) return readPlainText(value.content);
        if (typeof value.plainText === "string") return value.plainText;
        if (typeof value.text === "string") return value.text;
      }
      return "";
    };
    const summarySection = cv?.sections?.find(
      (section: any) => section?.type === "summary",
    );
    return {
      name: "Ada Lovelace",
      title: "Product Designer",
      summary:
        readPlainText(summarySection?.structuredContent?.[0]?.summary) ||
        readPlainText(summarySection?.blocks?.[0]?.plainText) ||
        "Builder.",
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
    };
  },
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
    data,
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
    data?: { summary?: string } | null;
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
              {data?.summary ?? "Builder."}
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
    vi.useRealTimers();
    window.getSelection()?.removeAllRanges();
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
    authMock.mockReset();
    authMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    transformSelectionMock.mockClear();
    transformSelectionMock.mockResolvedValue({ text: "Built better." });
    importCvMock.mockClear();
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  it("routes floating toolbar summary results through the contextual AI review overlay", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/CvForge.tsx"),
      "utf8",
    );

    expect(source).toContain("setCvAiReview({");
    expect(source).toContain("target: {");
    expect(source).toContain("beforeText: context.selectedText");
    expect(source).toContain('state: "ready"');
    expect(source).toContain('applyMode: "preview_required"');
    expect(source).toContain("applyInlineAiTextToSectionField");
    expect(source).toContain("flushPendingInlineFieldChange()");
  });

  it("does not start Shorten generation when the user is signed out", async () => {
    authMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 220
          : 0;
      });
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 48
          : 0;
      });

    try {
      render(
        <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
          <CvForge />
        </MemoryRouter>,
      );

      await act(async () => {
        const editableSummary = screen.getByTestId("mock-rich-summary");
        editableSummary.focus();
        const textNode = editableSummary.firstChild;
        expect(textNode).toBeTruthy();
        const range = document.createRange();
        range.selectNodeContents(textNode as Node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });

      const shortenButton = await screen.findByRole("button", {
        name: "Shorten",
      });
      act(() => {
        fireEvent.click(shortenButton);
      });

      expect(transformSelectionMock).not.toHaveBeenCalled();
      expect(
        screen.getByRole("dialog", { name: "AI review for Summary" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sign in to use AI writing.",
      );
    } finally {
      offsetWidthSpy.mockRestore();
      offsetHeightSpy.mockRestore();
    }
  });

  it("opens contextual overlay for selected paper text AI output", async () => {
    const user = userEvent.setup();
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 220
          : 0;
      });
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 48
          : 0;
      });

    try {
      render(
        <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
          <CvForge />
        </MemoryRouter>,
      );

      await act(async () => {
        const editableSummary = screen.getByTestId("mock-rich-summary");
        editableSummary.focus();
        const textNode = editableSummary.firstChild;
        expect(textNode).toBeTruthy();
        const range = document.createRange();
        range.selectNodeContents(textNode as Node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });

      await user.click(await screen.findByRole("button", { name: "Rewrite" }));

      expect(transformSelectionMock).toHaveBeenCalledWith({
        mode: "rewrite",
        instruction: expect.any(String),
        selectedText: "Builder.",
      });
      expect(
        await screen.findByRole("dialog", { name: "AI review for Summary" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Built better.")).toBeInTheDocument();
      expect(
        screen.queryByText("Review before applying."),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector("[data-cv-ai-review-surface='true']"),
      ).toBeTruthy();
      expect(
        document.querySelector("[data-cv-ai-review-toolbar='true']"),
      ).toBeTruthy();
      expect(
        document.querySelector("[data-inline-ai-toolbar='true']"),
      ).toBeNull();
      expect(
        screen.getByTestId("mock-rich-summary"),
      ).toHaveAttribute("data-inline-ai-selection-active", "true");
      expect(
        document.querySelector(
          ".dasti-cv-paper-stage [data-cv-ai-review-surface='true']",
        ),
      ).toBeNull();
    } finally {
      offsetWidthSpy.mockRestore();
      offsetHeightSpy.mockRestore();
    }
  });

  it("undoes an accepted selected-text AI replacement back to the previous CV text", async () => {
    const user = userEvent.setup();
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 220
          : 0;
      });
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 48
          : 0;
      });

    try {
      render(
        <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
          <CvForge />
        </MemoryRouter>,
      );

      await act(async () => {
        const editableSummary = screen.getByTestId("mock-rich-summary");
        editableSummary.focus();
        const textNode = editableSummary.firstChild;
        expect(textNode).toBeTruthy();
        const range = document.createRange();
        range.selectNodeContents(textNode as Node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });

      await user.click(await screen.findByRole("button", { name: "Rewrite" }));
      expect(await screen.findByText("Built better.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Replace" }));
      expect(await screen.findByText("Applied.")).toBeInTheDocument();
      expect(screen.getByTestId("mock-rich-summary")).toHaveTextContent(
        "Built better.",
      );
      await waitFor(() => {
        expect(
          importCvMock.mock.calls.some(
            (call) => getImportedSummary(call) === "Built better.",
          ),
        ).toBe(true);
      });

      await user.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(getImportedSummary(importCvMock.mock.calls.at(-1) ?? [])).toBe(
          "Builder.",
        );
      });
      expect(screen.getByTestId("mock-rich-summary")).toHaveTextContent(
        "Builder.",
      );
      expect(screen.getByTestId("mock-rich-summary")).not.toHaveTextContent(
        "Built better.",
      );
      expect(
        screen.queryByRole("dialog", { name: "AI review for Summary" }),
      ).not.toBeInTheDocument();
    } finally {
      offsetWidthSpy.mockRestore();
      offsetHeightSpy.mockRestore();
    }
  });

  it("unblocks a stalled Shorten generation with a readable overlay error", async () => {
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 220
          : 0;
      });
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 48
          : 0;
      });

    try {
      render(
        <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
          <CvForge />
        </MemoryRouter>,
      );

      await act(async () => {
        const editableSummary = screen.getByTestId("mock-rich-summary");
        editableSummary.focus();
        const textNode = editableSummary.firstChild;
        expect(textNode).toBeTruthy();
        const range = document.createRange();
        range.selectNodeContents(textNode as Node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      });

      const shortenButton = await screen.findByRole("button", {
        name: "Shorten",
      });

      transformSelectionMock.mockImplementationOnce(
        () => new Promise(() => undefined),
      );
      vi.useFakeTimers();

      act(() => {
        fireEvent.click(shortenButton);
      });

      expect(transformSelectionMock).toHaveBeenCalledWith({
        mode: "shorten",
        instruction: expect.any(String),
        selectedText: "Builder.",
      });
      expect(
        screen.getByRole("dialog", { name: "AI review for Summary" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Generating suggestion",
      );

      await act(async () => {
        vi.advanceTimersByTime(30_000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Generation is taking too long. Try again.",
      );
      expect(
        screen.getByTestId("mock-rich-summary"),
      ).toHaveAttribute("data-inline-ai-selection-active", "true");
    } finally {
      offsetWidthSpy.mockRestore();
      offsetHeightSpy.mockRestore();
    }
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
    expect(
      container.querySelector(".dasti-cv-page-preview-stage"),
    ).toBeTruthy();
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

    await user.click(screen.getByRole("button", { name: "Design" }));

    expect(
      screen.getByRole("button", { name: /Geist Bold Baskervville/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use Terre accent" }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByTestId("verbati-preview-active-panel"),
    ).toHaveTextContent("experience:exp-1");
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
    expect(
      screen.getByTestId("verbati-preview-active-panel"),
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

    expect(screen.getByTestId("verbati-preview-panel")).toBeInTheDocument();
    expect(
      screen.getByTestId("verbati-preview-active-panel"),
    ).toHaveTextContent("experience:exp-1");
    expect(
      screen.queryByText("Mock profile editor cv_123"),
    ).not.toBeInTheDocument();
  });
});
