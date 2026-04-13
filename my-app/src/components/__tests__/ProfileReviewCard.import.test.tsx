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
    window.sessionStorage.clear();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("Imported CV text"),
    });
  });

  it("imports into a fresh CV when the workspace is empty", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        profile: {
          name: "Jane Doe",
          email: "jane@example.com",
          title: "Product Manager",
        },
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
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
    await user.click(
      screen.getByRole("button", { name: /Import text PDF or TXT/i }),
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const file = new File(["Imported CV text"], "resume.txt", {
      type: "text/plain",
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

  it("keeps the import drawer compact with one icon per route and no subtitles", async () => {
    const user = userEvent.setup();

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));

    const menu = container.querySelector(".dasti-import-dropdown__menu");

    expect(
      screen.getByRole("button", { name: /Import text PDF or TXT/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Import scanned PDF or image/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Selectable PDF or plain text resume/i),
    ).toBeNull();
    expect(
      screen.queryByText(/Image-based PDF, screenshot, or photo/i),
    ).toBeNull();
    expect(menu).toHaveClass("dasti-import-dropdown__menu--compact");
    expect(container.querySelectorAll(".dasti-menu-option__icon")).toHaveLength(2);
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

    await user.click(screen.getByRole("button", { name: "Export CV as PDF" }));

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

  it("holds low-confidence imports behind the recovery gate and caps the visible review list", async () => {
    const user = userEvent.setup();

    const recoveryItems = Array.from({ length: 13 }, (_, index) => ({
      blockId: `recovery-${index + 1}`,
      rawText: `Low confidence section ${index + 1}`,
      cleanedText: `Low confidence section ${index + 1}`,
      displayTextSource: "cleaned",
      predictedSection: "summary",
      selectedSection: "summary",
      confidenceScore: "low",
      confidenceValue: 0.42,
      issueFlags: ["weakSectionMatch"],
      reviewStatus: "pending",
      sourceSectionTitle: `Section ${index + 1}`,
      sourceFieldKey: "summary",
      fragmentAssignments: [],
    }));

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: recoveryItems,
        totalItems: 13,
        overflowCount: 1,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await waitFor(() => {
      expect(importCvMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(
      screen.getByText(/Showing the first 12/i),
    ).toBeInTheDocument();
  });

  it("accepts a low-confidence item into its predicted section before import", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      authoritativeResume: {
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
        normalized: {
          profile: {
            name: "Jane Doe",
          },
        },
      },
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-1",
            rawText: "Bachelor of Science, State University\n2018 - 2022",
            cleanedText: "Bachelor of Science, State University\n2018 - 2022",
            displayTextSource: "cleaned",
            predictedSection: "experience",
            selectedSection: "experience",
            confidenceScore: "low",
            confidenceValue: 0.31,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Career section",
            sourceFieldKey: "experience",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    const acceptButton = await screen.findByRole("button", { name: "Accept block" });
    await user.click(acceptButton);
    await user.click(screen.getByRole("button", { name: "Save reviewed work" }));

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    const importedDoc = importCvMock.mock.calls[0][0];
    expect(importedDoc.sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "experience" })]),
    );
    expect(importedDoc.metadata.authoritativeResume).toEqual(
      expect.objectContaining({
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
      }),
    );
    expect(JSON.stringify(importedDoc.sections)).toContain("importRecovery");
    expect(screen.getByText("Saved 1 accepted block")).toBeInTheDocument();
  });

  it("keeps the chosen remaining action visibly active and exposes expanded recovery targets in the drawer", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-1",
            rawText: "Mixed content block",
            cleanedText: "Mixed content block",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "summary",
            confidenceScore: "low",
            confidenceValue: 0.28,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Mixed block",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    const acceptButton = await screen.findByRole("button", { name: "Accept block" });
    await user.click(acceptButton);

    expect(screen.getByRole("button", { name: "Accept block" })).toBeInTheDocument();
    expect(screen.getByText("Reviewing 1 / 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open recovery drawer" }));
    const drawer = screen.getByLabelText("Recovery drawer for section 1");
    expect(within(drawer).getByRole("option", { name: "Certifications" })).toBeInTheDocument();
    expect(within(drawer).getByRole("option", { name: "Additional Information" })).toBeInTheDocument();
    expect(within(drawer).getByRole("option", { name: "Affiliations" })).toBeInTheDocument();
    expect(within(drawer).getByRole("option", { name: "Hobbies" })).toBeInTheDocument();
    expect(within(drawer).getByRole("option", { name: "Add your own" })).toBeInTheDocument();
    expect(within(drawer).queryByRole("option", { name: "Contact" })).toBeNull();
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

  it("replaces an already open recovery workspace with the new import cycle", async () => {
    const user = userEvent.setup();
    importCvMock.mockImplementation(async (doc) => {
      cvLibraryState.currentCv = doc;
    });

    cvLibraryState.currentCv = {
      id: "cv_replace_open_recovery",
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

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-fresh-open-1",
            rawText: "Fresh import block",
            cleanedText: "Fresh import block",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "summary",
            selectedSectionTitle: null,
            confidenceScore: "low",
            confidenceValue: 0.28,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Fresh block",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getAllByRole("button", { name: "Reopen recovery workspace" })[0]);
    expect(screen.getByText("Old recovery block")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await waitFor(() => expect(screen.getByText("Fresh import block")).toBeInTheDocument());
    expect(screen.queryByText("Old recovery block")).toBeNull();
    expect(screen.getByLabelText("Import recovery review")).toBeInTheDocument();
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

  it("starts a new import with a fresh recovery cycle instead of reusing the old one", async () => {
    const user = userEvent.setup();
    importCvMock.mockImplementation(async (doc) => {
      cvLibraryState.currentCv = doc;
    });

    cvLibraryState.currentCv = {
      id: "cv_same_resume",
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

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-fresh-1",
            rawText: "Fresh import block",
            cleanedText: "Fresh import block",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "summary",
            selectedSectionTitle: null,
            confidenceScore: "low",
            confidenceValue: 0.28,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Fresh block",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container, rerender } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    rerender(<ProfileReviewCard />);

    expect(screen.getByText("Fresh import block")).toBeInTheDocument();
    expect(screen.queryByText("Old recovery block")).toBeNull();
  });

  it("persists reviewed additional information into a plain text section on save", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-additional-information",
            rawText: "Available for travel and relocation",
            cleanedText: "Available for travel and relocation",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "additional_information",
            selectedSectionTitle: null,
            confidenceScore: "low",
            confidenceValue: 0.28,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "reassigned",
            sourceSectionTitle: "Additional details",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await user.click(await screen.findByRole("button", { name: "Save reviewed work" }));

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    const importedDoc = importCvMock.mock.calls[0][0];
    expect(importedDoc.metadata.importRecoverySession).toEqual(
      expect.objectContaining({
        status: "completed",
        items: expect.arrayContaining([
          expect.objectContaining({
            reviewStatus: "reassigned",
            selectedSection: "additional_information",
          }),
        ]),
      }),
    );
    expect(importedDoc.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          title: "Additional Information",
          blocks: expect.any(Array),
        }),
      ]),
    );
    expect(JSON.stringify(importedDoc.sections)).toContain(
      "Available for travel and relocation",
    );
  });

  it("preserves a completed recovery session when importing as-is", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-summary-1",
            rawText: "Recovered summary line",
            cleanedText: "Recovered summary line",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "summary",
            selectedSectionTitle: null,
            confidenceScore: "low",
            confidenceValue: 0.31,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Summary",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await user.click(await screen.findByRole("button", { name: "Import as-is" }));

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    const importedDoc = importCvMock.mock.calls[0][0];
    expect(importedDoc.metadata.importRecoverySession).toEqual(
      expect.objectContaining({
        status: "completed",
        items: expect.arrayContaining([
          expect.objectContaining({ blockId: "recovery-summary-1" }),
        ]),
        baseSectionsSnapshot: expect.any(Array),
      }),
    );
  });

  it("persists reviewed hobbies into a structured hobbies section on save", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-hobbies",
            rawText: "Chess, Hiking",
            cleanedText: "Chess, Hiking",
            displayTextSource: "cleaned",
            predictedSection: "summary",
            selectedSection: "hobbies",
            selectedSectionTitle: null,
            confidenceScore: "low",
            confidenceValue: 0.28,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "reassigned",
            sourceSectionTitle: "Additional details",
            sourceFieldKey: "summary",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Summary text",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));
    await user.click(screen.getByRole("button", { name: /Import text PDF or TXT/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["Imported CV text"], "resume.txt", { type: "text/plain" })] },
    });

    await user.click(await screen.findByRole("button", { name: "Save reviewed work" }));

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    const importedDoc = importCvMock.mock.calls[0][0];
    expect(importedDoc.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          title: "Hobbies",
          structuredContent: expect.arrayContaining([
            expect.objectContaining({ name: "Chess" }),
            expect.objectContaining({ name: "Hiking" }),
          ]),
          collapsed: false,
        }),
      ]),
    );
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
      actionGroup?.querySelector('[aria-label="Export CV as PDF"]'),
    ).not.toBeNull();
    expect(
      actionGroup?.querySelector('[aria-label="Review import changes"]'),
    ).not.toBeNull();
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
