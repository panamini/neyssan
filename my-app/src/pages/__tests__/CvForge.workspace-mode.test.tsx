import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";

const { useCvLibraryMock } = vi.hoisted(() => ({
  useCvLibraryMock: vi.fn(),
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
  default: ({
    onSelectLayout,
    onSelectTypography,
    onSelectPalette,
  }: {
    onSelectLayout?: (layout: "editorial") => void;
    onSelectTypography?: (typography: "soft-serif") => void;
    onSelectPalette?: (palette: "encre") => void;
  }) => (
    <div>
      <button
        type="button"
        aria-label="Open text styles"
        onClick={() => onSelectTypography?.("soft-serif")}
      >
        Text
      </button>
      <button
        type="button"
        aria-label="Open layout controls"
        onClick={() => onSelectLayout?.("editorial")}
      >
        Layout
      </button>
      <button
        type="button"
        aria-label="Open palette controls"
        onClick={() => onSelectPalette?.("encre")}
      >
        Color
      </button>
    </div>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn(() => vi.fn(async () => undefined)),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (reference === "proposalSettings.getPresets") {
      return {
        preset1: {
          fontPairId: "quiet-editorial",
          styleChoice: "balanced",
          paletteOverride: "pierre",
          accentHex: null,
          voicePreset: null,
          name: "Stone Swiss",
        },
        preset2: null,
        preset3: null,
        activeSlot: 1,
      };
    }
    if (reference === "jobsPublic.getById") {
      if (args === "skip") {
        return undefined;
      }
      return {
        id: "job_123",
        title: "Senior Product Designer",
        company: "Acme",
      };
    }
    return null;
  }),
  useAction: vi.fn(() => undefined),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalSettings: {
      getPresets: "proposalSettings.getPresets",
    },
    jobsPublic: {
      getById: "jobsPublic.getById",
      approveReviewItem: "jobsPublic.approveReviewItem",
      updateField: "jobsPublic.updateField",
    },
  },
}));

vi.mock("../../features/verbati/VerbatiCvPreviewPanel", () => ({
  VerbatiCvPreviewPanel: ({
    hostMode,
    layoutMode,
    railLeadControl,
    stylePreset,
  }: {
    hostMode?: "panel" | "workspace";
    layoutMode?: "rail" | "stacked";
    railLeadControl?: React.ReactNode;
    stylePreset?: {
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    };
  }) => (
    <div>
      Preview host: {hostMode ?? "panel"} / layout: {layoutMode ?? "stacked"}
      <div>
        Preview style: {stylePreset?.layout ?? "none"}|
        {stylePreset?.typography ?? "none"}|{stylePreset?.palette ?? "none"}
      </div>
      {railLeadControl}
    </div>
  ),
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
  useStructuredMistralImport: () => ({
    importFile: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

function buildCvLibraryState(overrides: Record<string, unknown> = {}) {
  const now = "2026-04-17T12:00:00.000Z";
  const currentCv = {
    id: "cv_123",
    title: "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
      verbatiStyle: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    },
    sections: [
      {
        id: "profile-cv_123",
        type: "profile",
        title: "Profile",
        blocks: [],
        structuredContent: [
          {
            id: "profile-item-cv_123",
            name: "Ada Lovelace",
            desiredPosition: "Product Designer",
          },
        ],
      },
    ],
  };

  return {
    currentCv,
    currentCvId: "cv_123",
    createNewCv: vi.fn(async () => undefined),
    importCv: vi.fn(async () => undefined),
    cvs: [currentCv],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    loadCv: vi.fn(() => true),
    ...overrides,
  };
}

describe("CvForge workspace mode", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
    window.localStorage.setItem("twoweeks:quick-start-completed", "1");
    useCvLibraryMock.mockReset();
    useCvLibraryMock.mockReturnValue(buildCvLibraryState());
  });

  it("switches between edit and preview workbench modes and persists the choice", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor cv_123")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open saved resume styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open layout controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Preview host: panel \/ layout:/),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv"),
    ).toBeTruthy();
    expect(container.querySelector(".dasti-cv-workbench-toggle")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open resume preview" }),
    ).toHaveAttribute("data-toolbar-tooltip", "Switch to preview");

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    expect(
      screen.getByText("Preview host: workspace / layout: stacked"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-cv-preview-workbench"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-cv-edit-workbench-shell"),
    ).toBeFalsy();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv-preview"),
    ).toBeFalsy();
    expect(
      screen.getByRole("button", { name: "Back to resume editing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to resume editing" }),
    ).toHaveAttribute("data-toolbar-tooltip", "Back to edit");
    const pageShell = container.querySelector(
      ".dasti-page-shell--cv-forge",
    ) as HTMLElement | null;
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top-mobile")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--cv-preview-toolbar-inset")).toBe(
      "0px",
    );
    const previewWorkbench = container.querySelector(
      ".dasti-cv-preview-workbench",
    ) as HTMLElement | null;
    expect(
      previewWorkbench?.style.getPropertyValue("--cv-preview-shell-block-size"),
    ).toContain("100dvh");
    expect(
      previewWorkbench?.style.getPropertyValue(
        "--document-viewer-shell-inline-size",
      ),
    ).toBe("100%");
    expect(previewWorkbench?.style.marginInline).toBe("0");
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-inline")).toBe(
      "var(--space-4)",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-inline-mobile"),
    ).toBe("var(--space-4)");
    expect(
      window.localStorage.getItem("dasti:cv-forge-workspace-mode:v1"),
    ).toBe("preview");
  });

  it("keeps the workspace preview on the same canvas path on narrow viewports", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    expect(
      screen.getByText("Preview host: workspace / layout: stacked"),
    ).toBeInTheDocument();
  });

  it("applies canonical saved settings styles from the selected preset slot", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open saved resume styles" }),
    );

    await user.click(screen.getByRole("menuitemradio", { name: /Stone Swiss/i }));

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|pierre"),
    ).toBeInTheDocument();
  });

  it("applies direct toolbar layout, font, and palette edits to the cv preview", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open text styles" }));
    await user.click(screen.getByRole("button", { name: "Open palette controls" }));
    await user.click(screen.getByRole("button", { name: "Open layout controls" }));

    expect(
      screen.getByText("Preview style: editorial|soft-serif|encre"),
    ).toBeInTheDocument();
  });

  it("shows a compact job-context chip instead of an embedded brief card and can clear it", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123&jobId=job_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", {
        name: "For: Senior Product Designer @ Acme",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading saved job brief…"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Saved job context is unavailable for this resume session."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear job context" }));

    expect(
      screen.queryByRole("button", {
        name: "For: Senior Product Designer @ Acme",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Mock profile editor cv_123")).toBeInTheDocument();
  });
});
