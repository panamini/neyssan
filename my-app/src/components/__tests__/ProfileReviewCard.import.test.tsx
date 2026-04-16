import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";

const structuredActionMock = vi.fn();
const importCvMock = vi.fn();
const reorderSectionsMock = vi.fn();
const renameCvMock = vi.fn();
const exportCvMock = vi.fn();
const cvLibraryState = {
  currentCv: null as Record<string, unknown> | null,
};

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    actions: {
      structuredUpload: {
        structuredUpload: "structuredUpload",
      },
    },
    functions: {
      transformEditorSelection: "transformEditorSelection",
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "structuredUpload") {
      return structuredActionMock;
    }
    if (ref === "transformEditorSelection") {
      return vi.fn().mockResolvedValue({ text: "" });
    }
    return undefined;
  },
  useConvex: () => ({
    query: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: cvLibraryState.currentCv,
    currentCvId: null,
    loadCv: vi.fn(),
    isLoading: false,
    isDirty: false,
    reorderSections: reorderSectionsMock,
    addSection: vi.fn(),
    createNewCv: vi.fn(async () => {}),
    importCv: importCvMock,
    closeInspector: vi.fn(),
    renameCv: renameCvMock,
    registerBlockFlushCallback: () => () => {},
    isV1Active: true,
  }),
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("ProfileReviewCard import", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    importCvMock.mockReset();
    reorderSectionsMock.mockReset();
    renameCvMock.mockReset();
    exportCvMock.mockReset();
    cvLibraryState.currentCv = null;
    Object.defineProperty(window, "__CV_EDITOR_DEBUG__", {
      configurable: true,
      writable: true,
      value: false,
    });
    window.sessionStorage.clear();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("Imported CV text"),
    });
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    delete (window as Window & { __CV_EDITOR_DEBUG__?: boolean })
      .__CV_EDITOR_DEBUG__;
  });

  it("imports into a fresh CV when the workspace is empty", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Fallback normalized should stay debug-only",
      },
      strict: null,
      authoritativeResume: {
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
        normalized: {
          profile: {
            name: "Jane Doe",
            desiredPosition: "Product Manager",
          },
          summary: {
            text: "Summary text",
          },
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    expect(screen.getByRole("button", { name: "Import CV" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const file = new File(["scanned CV"], "resume.png", {
      type: "image/png",
    });

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock.mock.calls[0][0]).toMatchObject({
      title: "Jane Doe — Product Manager",
      metadata: expect.objectContaining({
        authoritativeResume: expect.objectContaining({
          source: "mistral_v3",
          trusted: true,
          fallbackToLegacy: false,
        }),
      }),
    });
    expect(importCvMock.mock.calls[0][0].sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
        expect.objectContaining({ type: "summary" }),
      ]),
    );
  });

  it("shows trusted Mistral runtime status in local debug mode and keeps it visible after import", async () => {
    const user = userEvent.setup();
    (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__ =
      true;

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Fallback normalized should stay debug-only",
      },
      diagnostics: {
        ocr_request_path: "/mistral-ocr/parse",
        ocr_engine: "mistral",
        mistral_fallback: false,
        mistral_runtime: "mistral",
      },
      authoritativeResume: {
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
        normalized: {
          profile: {
            name: "Jane Doe",
            email: "jane@example.com",
            title: "Product Manager",
          },
          summary: {
            text: "Trusted OCR summary",
          },
        },
      },
    });

    const view = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));

    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["scanned CV"], "resume.png", { type: "image/png" })],
      },
    });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Import runtime debug" }),
      ).toBeInTheDocument(),
    );

    const trustedDebugStatus = screen.getByRole("status", {
      name: "Import runtime debug",
    });
    expect(
      within(trustedDebugStatus).getAllByText(
        /Trusted Mistral import/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(trustedDebugStatus).getByText("/mistral-ocr/parse"),
    ).toBeInTheDocument();
    expect(within(trustedDebugStatus).getAllByText("mistral").length).toBeGreaterThan(0);
    expect(within(trustedDebugStatus).getByText("false")).toBeInTheDocument();
    expect(within(trustedDebugStatus).getByText("true")).toBeInTheDocument();

    cvLibraryState.currentCv = importCvMock.mock.calls[0][0];
    view.rerender(<ProfileReviewCard />);

    expect(
      screen.getByRole("status", { name: "Import runtime debug" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("status", { name: "Import runtime debug" }),
      ).getAllByText(/Trusted Mistral import/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows fallback runtime status when the parse falls back to legacy-style normalized output", async () => {
    const user = userEvent.setup();
    (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__ =
      true;

    structuredActionMock.mockResolvedValue({
      normalized: {
        profile: {
          name: "Fallback Candidate",
        },
        summary: "Fallback summary",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      diagnostics: {
        ocr_request_path: "/mistral-ocr/parse",
        ocr_engine: "mistral",
        mistral_fallback: true,
        mistral_runtime: "local_fallback",
      },
      authoritativeResume: {
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: true,
        normalized: null,
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["scanned CV"], "resume.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Import runtime debug" }),
      ).toBeInTheDocument(),
    );
    const debugStatus = screen.getByRole("status", {
      name: "Import runtime debug",
    });
    expect(
      within(debugStatus).getAllByText(/OCR import rejected \(fallback\/untrusted\)/i)
        .length,
    ).toBeGreaterThan(0);
    expect(within(debugStatus).getByText("local_fallback")).toBeInTheDocument();
    expect(
      within(debugStatus).getByText("/mistral-ocr/parse"),
    ).toBeInTheDocument();
    expect(within(debugStatus).getByText("true")).toBeInTheDocument();
    expect(within(debugStatus).getByText("false")).toBeInTheDocument();
    expect(importCvMock).not.toHaveBeenCalled();
  });

  it("keeps the import action collapsed to a single direct scanned-import trigger", async () => {
    const user = userEvent.setup();

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));

    expect(
      screen.queryByRole("button", { name: /Import text PDF or TXT/i }),
    ).toBeNull();
    expect(container.querySelector(".dasti-import-dropdown__menu")).toBeNull();
    expect(
      screen.queryByText(/Selectable PDF or plain text resume/i),
    ).toBeNull();
    expect(
      screen.queryByText(/Image-based PDF, screenshot, or photo/i),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Import CV" })).toBeInTheDocument();
  });

  it("shows a dismissible import warning banner before the inline review list", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    expect(
      screen.getByRole("status", { name: "Import warning" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review flagged fields" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Import review checks"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(
      screen.queryByRole("status", { name: "Import warning" }),
    ).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem("dasti:cv-import-warning-banner:cv_imported"),
    ).toContain("document-title-generic");
  });

  it("auto-hides the import warning banner after 5 seconds without persisting dismissal", async () => {
    vi.useFakeTimers();

    try {
      cvLibraryState.currentCv = {
        id: "cv_imported",
        title: "Imported CV",
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        sections: [],
      };

      render(<ProfileReviewCard />);

      expect(
        screen.getByRole("status", { name: "Import warning" }),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(
        screen.queryByRole("status", { name: "Import warning" }),
      ).not.toBeInTheDocument();
      expect(
        window.sessionStorage.getItem("dasti:cv-import-warning-banner:cv_imported"),
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-hides the import warning banner on scroll before the timeout", async () => {
    vi.useFakeTimers();

    try {
      cvLibraryState.currentCv = {
        id: "cv_imported",
        title: "Imported CV",
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        sections: [],
      };

      render(<ProfileReviewCard />);

      expect(
        screen.getByRole("status", { name: "Import warning" }),
      ).toBeInTheDocument();

      await act(async () => {
        fireEvent.scroll(window);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(
        screen.queryByRole("status", { name: "Import warning" }),
      ).not.toBeInTheDocument();
      expect(
        window.sessionStorage.getItem("dasti:cv-import-warning-banner:cv_imported"),
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("prompts for a real title when an imported CV keeps a generic name", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    expect(screen.getByText("Name this imported CV")).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("e.g. Jane Doe — Product Manager"));
    await user.type(
      screen.getByPlaceholderText("e.g. Jane Doe — Product Manager"),
      "Jane Doe — Operations Associate",
    );
    await user.click(screen.getByRole("button", { name: "Save title" }));

    expect(renameCvMock).toHaveBeenCalledWith(
      "cv_imported",
      "Jane Doe — Operations Associate",
    );
  });

  it("blocks CV export until flagged import issues are reviewed", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard onRequestExport={exportCvMock} />);

    await user.click(screen.getByRole("button", { name: "Export ATS PDF" }));

    expect(exportCvMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Review flagged fields again" }),
    ).toBeInTheDocument();
  });

  it("opens the inline import review from the warning trigger next to export", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    const reviewToggle = screen.getByRole("button", {
      name: "Review import changes",
    });
    const reviewSection = screen.getByLabelText("Import review checks");

    expect(reviewToggle).toHaveAttribute("aria-expanded", "false");
    expect(reviewSection).toHaveAttribute("data-collapsed", "true");

    await user.click(reviewToggle);

    expect(reviewToggle).toHaveAttribute("aria-expanded", "true");
    expect(reviewToggle).toHaveAccessibleName("Review import changes");
    expect(reviewSection).toHaveAttribute("data-collapsed", "false");
    expect(
      screen.getByText("Clean flagged parser noise here before generating proposals."),
    ).toBeInTheDocument();

    await user.click(reviewToggle);

    expect(reviewToggle).toHaveAttribute("aria-expanded", "true");
    expect(reviewToggle).toHaveAccessibleName("Review import changes");
    expect(reviewSection).toHaveAttribute("data-collapsed", "false");
  });

  it("lets the inline import review be explicitly collapsed from its own close control", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Review import changes" }));
    expect(screen.getByLabelText("Import review checks")).toHaveAttribute(
      "data-collapsed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Close import review" }));

    expect(screen.getByLabelText("Import review checks")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
  });

  it("routes the review trigger to recovery when metadata recovery is pending", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_pending_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "pending",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Pending block",
              cleanedText: "Pending block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "pending",
              selectedSection: "summary",
              selectedSectionTitle: null,
              sourceSectionTitle: "Pending block",
              sourceFieldKey: "summary",
              sourceLabel: null,
              sourceSpan: null,
              fragmentAssignments: [],
            },
          ],
        },
      },
      sections: [],
    } as any;

    const { container } = render(<ProfileReviewCard />);

    expect(
      screen.getAllByRole("button", { name: "Resume recovery review" }).length,
    ).toBeGreaterThan(0);

    await user.click(
      container.querySelector(".dasti-import-review-trigger") as HTMLButtonElement,
    );

    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();
  });

  it("routes the warning banner review action back into recovery when recovery is pending", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_pending_recovery_banner",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "pending",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Pending block",
              cleanedText: "Pending block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "pending",
              selectedSection: "summary",
              selectedSectionTitle: null,
              sourceSectionTitle: "Pending block",
              sourceFieldKey: "summary",
              sourceLabel: null,
              sourceSpan: null,
              fragmentAssignments: [],
            },
          ],
        },
      },
      sections: [],
    } as any;

    render(<ProfileReviewCard />);

    const banner = screen.getByRole("status", { name: "Import warning" });
    expect(
      within(banner).getByRole("button", { name: "Review flagged fields" }),
    ).toBeInTheDocument();
    await user.click(
      within(banner).getByRole("button", { name: "Resume recovery review" }),
    );

    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();
  });

  it("reopens a completed recovery session from the toolbar and resume banner", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_completed_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "completed",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Reviewed block",
              cleanedText: "Reviewed block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "accepted",
              selectedSection: "summary",
              selectedSectionTitle: null,
              sourceSectionTitle: "Reviewed block",
              sourceFieldKey: "summary",
              sourceLabel: null,
              sourceSpan: null,
              fragmentAssignments: [],
            },
          ],
        },
      },
      sections: [],
    } as any;

    const { container } = render(<ProfileReviewCard />);

    expect(
      screen.getAllByRole("button", { name: "Reopen recovery workspace" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Recovery review saved — reopen 1 reviewed item/i),
    ).toBeInTheDocument();

    await user.click(
      container.querySelector(".dasti-import-review-trigger") as HTMLButtonElement,
    );

    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();
  });

  it("toggles the recovery workspace closed when the toolbar entry is pressed again", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_toggle_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "completed",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Reviewed block",
              cleanedText: "Reviewed block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "accepted",
              selectedSection: "summary",
              selectedSectionTitle: null,
              fragmentAssignments: [],
            },
          ],
          baseSectionsSnapshot: [],
        },
      },
      sections: [],
    } as any;

    const { container } = render(<ProfileReviewCard />);

    await user.click(
      container.querySelector(".dasti-import-review-trigger") as HTMLButtonElement,
    );
    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Close recovery workspace" })[0]);

    expect(screen.queryByLabelText("Import recovery review")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reopen recovery workspace" }).length).toBeGreaterThan(0);
  });

  it("clears local recovery UI when switching to a brand-new resume", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_old_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "completed",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-old-1",
              rawText: "Old recovery block",
              cleanedText: "Old recovery block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.4,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "accepted",
              selectedSection: "summary",
              selectedSectionTitle: null,
              fragmentAssignments: [],
            },
          ],
          baseSectionsSnapshot: [],
        },
      },
      sections: [],
    } as any;

    const view = render(<ProfileReviewCard />);

    await user.click(screen.getAllByRole("button", { name: "Reopen recovery workspace" })[0]);
    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();

    cvLibraryState.currentCv = {
      id: "cv_clean_resume",
      title: "Fresh CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    } as any;

    view.rerender(<ProfileReviewCard />);

    expect(screen.queryByLabelText("Import recovery review")).toBeNull();
    expect(screen.queryByText(/Recovery review saved/i)).toBeNull();
  });

  it("discards a preserved recovery session explicitly", async () => {
    const user = userEvent.setup();
    importCvMock.mockImplementation(async (doc) => {
      cvLibraryState.currentCv = doc;
    });

    cvLibraryState.currentCv = {
      id: "cv_discard_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "completed",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-discard-1",
              rawText: "Discard me",
              cleanedText: "Discard me",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.4,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "accepted",
              selectedSection: "summary",
              selectedSectionTitle: null,
              fragmentAssignments: [],
            },
          ],
          baseSectionsSnapshot: [],
        },
      },
      sections: [],
    } as any;

    const view = render(<ProfileReviewCard />);

    await user.click(screen.getAllByRole("button", { name: "Discard recovery" })[0]);

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock.mock.calls[0][0].metadata.importRecoverySession).toBeUndefined();

    view.rerender(<ProfileReviewCard />);

    expect(screen.queryByRole("button", { name: "Reopen recovery workspace" })).toBeNull();
  });

  it("includes the new text-backed sections in the add sections drawer", () => {
    cvLibraryState.currentCv = {
      id: "cv_sections",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "summary-1",
          title: "Summary",
          type: "summary",
          blocks: [
            {
              id: "block-summary-1",
              title: "Summary",
              type: "text",
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Summary" }] }],
              },
              attributes: {},
            },
          ],
          structuredContent: [
            {
              id: "summary-item-1",
              summary: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Summary" }] }],
              },
            },
          ],
          collapsed: false,
        },
        {
          id: "text-1",
          title: "Additional Information",
          type: "text",
          blocks: [
            {
              id: "block-text-1",
              title: "Additional Information",
              type: "text",
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Additional info" }] }],
              },
              attributes: {},
            },
          ],
          structuredContent: null,
          collapsed: false,
        },
      ],
    } as any;

    render(<ProfileReviewCard />);

    const trigger = screen.getByLabelText("Manage sections");
    fireEvent.click(trigger);

    expect(screen.getByText("Affiliations")).toBeInTheDocument();
    expect(screen.getByText("Hobbies")).toBeInTheDocument();
    expect(screen.getByText("Add your own")).toBeInTheDocument();
    expect(screen.queryByText("Contact")).toBeNull();
  });

  it("shows a resume banner when import recovery metadata is pending", () => {
    cvLibraryState.currentCv = {
      id: "cv_pending_recovery",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "pending",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Pending block",
              cleanedText: "Pending block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "pending",
              selectedSection: "summary",
              selectedSectionTitle: null,
              sourceSectionTitle: "Pending block",
              sourceFieldKey: "summary",
              sourceLabel: null,
              sourceSpan: null,
              fragmentAssignments: [],
            },
          ],
        },
      },
      sections: [],
    } as any;

    render(<ProfileReviewCard />);

    expect(
      screen.getByText(/Import review incomplete — 1 item pending/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Resume recovery review" }).length,
    ).toBeGreaterThan(0);
  });

  it("auto-hides the pending recovery banner after 5 seconds while keeping reopen access", async () => {
    vi.useFakeTimers();

    try {
      cvLibraryState.currentCv = {
        id: "cv_pending_recovery_banner",
        title: "Imported CV",
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          importRecoverySession: {
            status: "pending",
            updatedAt: new Date().toISOString(),
            reviewLimit: 12,
            overflowCount: 0,
            items: [
              {
                blockId: "recovery-1",
                rawText: "Pending block",
                cleanedText: "Pending block",
                displayTextSource: "cleaned",
                predictedSection: "summary",
                confidenceScore: "low",
                confidenceValue: 0.42,
                issueFlags: ["weakSectionMatch"],
                reviewStatus: "pending",
                selectedSection: "summary",
                selectedSectionTitle: null,
                fragmentAssignments: [],
              },
            ],
            baseSectionsSnapshot: [],
          },
        },
        sections: [],
      } as any;

      render(<ProfileReviewCard />);

      expect(
        screen.getByText(/Import review incomplete — 1 item pending/i),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(
        screen.queryByText(/Import review incomplete — 1 item pending/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Resume recovery review" }).length,
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses the pending recovery banner without clearing the recovery session", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_pending_recovery_close",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        importRecoverySession: {
          status: "pending",
          updatedAt: new Date().toISOString(),
          reviewLimit: 12,
          overflowCount: 0,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Pending block",
              cleanedText: "Pending block",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.42,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "pending",
              selectedSection: "summary",
              selectedSectionTitle: null,
              fragmentAssignments: [],
            },
          ],
          baseSectionsSnapshot: [],
        },
      },
      sections: [],
    } as any;

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Dismiss recovery banner" }));

    expect(screen.queryByText(/Import review incomplete — 1 item pending/i)).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Resume recovery review" }).length,
    ).toBeGreaterThan(0);
  });

  it("auto-hides the completed recovery banner after 5 seconds while keeping reopen access", async () => {
    vi.useFakeTimers();

    try {
      cvLibraryState.currentCv = {
        id: "cv_completed_recovery_banner",
        title: "Imported CV",
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          importRecoverySession: {
            status: "completed",
            updatedAt: new Date().toISOString(),
            reviewLimit: 12,
            overflowCount: 0,
            items: [
              {
                blockId: "recovery-1",
                rawText: "Reviewed block",
                cleanedText: "Reviewed block",
                displayTextSource: "cleaned",
                predictedSection: "summary",
                confidenceScore: "low",
                confidenceValue: 0.42,
                issueFlags: ["weakSectionMatch"],
                reviewStatus: "accepted",
                selectedSection: "summary",
                selectedSectionTitle: null,
                fragmentAssignments: [],
              },
            ],
            baseSectionsSnapshot: [],
          },
        },
        sections: [],
      } as any;

      render(<ProfileReviewCard />);

      expect(
        screen.getByText(/Recovery review saved — reopen 1 reviewed item/i),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(
        screen.queryByText(/Recovery review saved — reopen 1 reviewed item/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Reopen recovery workspace" }).length,
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the export button and import warning trigger in the same toolbar action group", () => {
    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    const { container } = render(<ProfileReviewCard onRequestExport={exportCvMock} />);

    const actionGroup = container.querySelector(
      ".dasti-cv-edit-toolbar__group--actions",
    );

    expect(actionGroup).not.toBeNull();
    expect(
      actionGroup?.querySelector('[aria-label="Export ATS PDF"]'),
    ).not.toBeNull();
    expect(
      actionGroup?.querySelector('[aria-label="Review import changes"]'),
    ).not.toBeNull();
  });

  it("passes the in-flight export lock state to the inner toolbar export control", () => {
    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(
      <ProfileReviewCard
        exportingFormat="pdf:styled"
        onRequestExport={exportCvMock}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeDisabled();
  });

  it("renders the lead toolbar control inside the anchored CV action rail", () => {
    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    const { container } = render(
      <ProfileReviewCard
        toolbarLeadControl={
          <button type="button" aria-label="Open resume preview">
            Preview
          </button>
        }
      />,
    );

    const leadGroup = container.querySelector(".dasti-cv-edit-toolbar__group--lead");

    expect(leadGroup).not.toBeNull();
    expect(
      leadGroup?.querySelector('[aria-label="Open resume preview"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(".dasti-cv-edit-toolbar.dasti-proposal-rail-cluster"),
    ).not.toBeNull();
  });
});
