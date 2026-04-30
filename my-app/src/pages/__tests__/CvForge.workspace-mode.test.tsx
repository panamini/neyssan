import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";

const {
  importFileMock,
  useCvLibraryMock,
  transformEditorSelectionMock,
  runCvSectionAiActionMock,
} = vi.hoisted(() => ({
  importFileMock: vi.fn(),
  useCvLibraryMock: vi.fn(),
  transformEditorSelectionMock: vi.fn(),
  runCvSectionAiActionMock: vi.fn(),
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
      <div className="dasti-cv-edit-toolbar">
        <div className="dasti-workbench-top-left-slot--cv">
          <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
        </div>
        <div className="dasti-workbench-top-right-slot--cv">
          {toolbarPrimaryControl}
        </div>
      </div>
      <div>Mock profile editor {cvId ?? "none"}</div>
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
  useAction: vi.fn((reference: string) => {
    if (reference === "functions.runCvSectionAiAction") {
      return runCvSectionAiActionMock;
    }
    return transformEditorSelectionMock;
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalSettings: {
      getPresets: "proposalSettings.getPresets",
    },
    functions: {
      transformEditorSelection: "functions.transformEditorSelection",
      runCvSectionAiAction: "functions.runCvSectionAiAction",
    },
    jobsPublic: {
      getById: "jobsPublic.getById",
      approveReviewItem: "jobsPublic.approveReviewItem",
      updateField: "jobsPublic.updateField",
    },
  },
}));

vi.mock("../../lib/buildCanonicalResumeRenderModel", () => ({
  buildCanonicalResumeRenderModelFromCv: () => ({
    name: "Ada Lovelace",
    title: "Product Designer",
    summary: "Structured resume summary.",
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

vi.mock("../../features/verbati/VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    activeTarget,
    hostMode,
    onLinkIntent,
    stylePreset,
  }: {
    activeTarget?: { sectionId?: string | null } | null;
    hostMode?: "panel" | "workspace";
    onLinkIntent?: (intent: {
      requestId: string;
      sectionType: "experience" | "education";
      sectionId: string;
      source: "preview-panel";
      shouldOpenModal: boolean;
    }) => void;
    stylePreset?: {
      accentHex?: string | null;
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    };
  }) => (
    <div>
      Preview host: {hostMode ?? "panel"}
      <div data-testid="preview-active-section">
        {activeTarget?.sectionId ?? "none"}
      </div>
      <button
        type="button"
        onClick={() =>
          onLinkIntent?.({
            requestId: "paper-experience",
            sectionType: "experience",
            sectionId: "experience-cv_123",
            source: "preview-panel",
            shouldOpenModal: true,
          })
        }
      >
        Paper Experience
      </button>
      <button
        type="button"
        onClick={() =>
          onLinkIntent?.({
            requestId: "paper-education",
            sectionType: "education",
            sectionId: "education-cv_123",
            source: "preview-panel",
            shouldOpenModal: true,
          })
        }
      >
        Paper Education
      </button>
      <div>
        Preview style: {stylePreset?.layout ?? "none"}|
        {stylePreset?.typography ?? "none"}|{stylePreset?.palette ?? "none"}|
        {stylePreset?.accentHex ?? "none"}
      </div>
    </div>
  ),
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
  useStructuredMistralImport: () => ({
    importFile: importFileMock,
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
      {
        id: "summary-cv_123",
        type: "summary",
        title: "Summary",
        blocks: [],
        structuredContent: [{ id: "summary-item-cv_123", summary: "Focused builder." }],
      },
      {
        id: "experience-cv_123",
        type: "experience",
        title: "Experience",
        blocks: [],
        structuredContent: [
          {
            id: "experience-item-cv_123",
            position: "Lead designer",
            company: "Studio",
            startDate: "2022",
            endDate: "2026",
            responsibilities: "Led product design.",
          },
        ],
      },
      {
        id: "education-cv_123",
        type: "education",
        title: "Education",
        blocks: [],
        structuredContent: [
          {
            id: "education-item-cv_123",
            degree: "MFA",
            institution: "Design School",
            fieldOfStudy: "Interaction design",
          },
        ],
      },
      {
        id: "skills-cv_123",
        type: "skills",
        title: "Skills",
        blocks: [],
        structuredContent: [{ id: "skill-cv_123", name: "TypeScript" }],
      },
      {
        id: "languages-cv_123",
        type: "languages",
        title: "Languages",
        blocks: [],
        structuredContent: [{ id: "language-cv_123", name: "English" }],
      },
      {
        id: "certifications-cv_123",
        type: "certifications",
        title: "Certifications",
        blocks: [],
        structuredContent: [{ id: "cert-cv_123", certificationName: "UX cert" }],
      },
      {
        id: "achievements-cv_123",
        type: "achievements",
        title: "Achievements",
        blocks: [],
        structuredContent: [{ id: "achievement-cv_123", text: "Shipped PR4." }],
      },
      {
        id: "additional-cv_123",
        type: "text",
        title: "Additional information",
        blocks: [{ id: "additional-block-cv_123", type: "text", plainText: "Open to remote." }],
        structuredContent: null,
      },
      {
        id: "hobbies-cv_123",
        type: "text",
        title: "Hobbies",
        blocks: [],
        structuredContent: [{ id: "hobby-cv_123", name: "Photography" }],
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
    transformEditorSelectionMock.mockReset();
    runCvSectionAiActionMock.mockReset();
    runCvSectionAiActionMock.mockResolvedValue({
      kind: "list",
      items: ["Design systems", "Interaction design"],
    });
    transformEditorSelectionMock.mockResolvedValue({
      kind: "text",
      actionId: "custom",
      text: "Sharper AI section text.",
      applyMode: "preview_required",
      outputMode: "single_text",
    });
    importFileMock.mockReset();
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

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(container.querySelector(".dasti-cv-active-toolbar-pill")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Switch CV\. Active CV:/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".dasti-cv-edit-workbench-shell"),
    ).toBeNull();
    expect(container.querySelector(".dasti-cv-preview-panel-slot")).toBeNull();
    expect(container.querySelector(".dasti-preview-toolbar")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Page preview" }),
    );

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(container.querySelector(".dasti-cv-active-toolbar-pill")).toBeNull();
    expect(
      container.querySelector(".dasti-cv-skeleton-forge"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-cv-page-preview-stage"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-cv-preview-workbench"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-cv-edit-workbench-shell"),
    ).toBeFalsy();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv-preview"),
    ).toBeFalsy();
    expect(
      screen.queryByRole("button", { name: "Back to resume editing" }),
    ).not.toBeInTheDocument();
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
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-inline")).toBe(
      "var(--space-4)",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-inline-mobile"),
    ).toBe("var(--space-4)");
    expect(
      window.localStorage.getItem("dasti:cv-forge-workspace-mode:v1"),
    ).toBe("preview");
    expect(
      screen.getByRole("complementary", { name: "CV forge rail" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".dasti-preview-toolbar")).toBeNull();
  });

  it("renders the PR4 skeleton stage and section-scoped CV rail tabs", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("complementary", { name: "CV forge rail" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sections" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("button", { name: /Structuring sections/i })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Ask" }));

    expect(screen.getByText("Profile fields use direct field editing.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask section" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Ask Profile" })).not.toBeInTheDocument();
    expect(screen.queryByText(/whole CV/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByText("Document style. Applies to the full CV page.")).toBeInTheDocument();
  });

  it("opens a non-empty section editor from the paper and highlights the rail row", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Paper Experience" }));

    expect(screen.getByRole("dialog", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lead designer")).toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "experience-cv_123",
    );
    expect(
      container.querySelector('.dasti-cv-org-row[data-active="true"] .dasti-cv-org-row__title'),
    ).toHaveTextContent("Experience");
  });

  it("opens a non-empty section editor from the rail and focuses the preview section", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Education$/i }));

    expect(screen.getByRole("dialog", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("MFA")).toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "education-cv_123",
    );
  });

  it("adds education entries inside the focused section sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Education$/i }));
    await user.click(screen.getByRole("button", { name: "Add education entry" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const educationSection = importCv.mock.lastCall?.[0].sections.find(
      (section: { id: string }) => section.id === "education-cv_123",
    );
    expect(educationSection.structuredContent).toHaveLength(2);
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "education-cv_123",
    );
  });

  it("writes common section fields back to draft state", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Grace Hopper");
    expect(importCv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(importCv.mock.lastCall?.[0].sections[0].structuredContent[0].name).toBe(
      "Grace Hopper",
    );
  });

  it("discards section sheet edits when canceling", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Unsaved Name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(importCv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });

  it("keeps section focus after saving the section sheet", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(screen.queryByLabelText("Section title")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "skills-cv_123",
    );

    await user.click(within(skillsDialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "skills-cv_123",
    );
  });

  it("preserves spaces while editing summary text in the section sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    const summaryInput = screen.getByLabelText("Body");
    await user.clear(summaryInput);
    await user.type(summaryInput, "Alpha Beta ");

    expect(summaryInput).toHaveValue("Alpha Beta ");
    expect(importCv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.find(
        (section: { id: string }) => section.id === "summary-cv_123",
      ).structuredContent[0].summary,
    ).toBe("Alpha Beta ");
  });

  it("keeps long typed section edits in the draft before save", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Experience$/i }));
    const roleInput = screen.getByLabelText("Role 1");
    await user.clear(roleInput);
    await user.type(roleInput, "Senior product designer");

    expect(roleInput).toHaveValue("Senior product designer");
    expect(importCv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.find(
        (section: { id: string }) => section.id === "experience-cv_123",
      ).structuredContent[0].position,
    ).toBe("Senior product designer");
  });

  it("rewrites summary from the section drawer wand with CV evidence", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Evidence-backed summary.",
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    await user.click(screen.getByRole("button", { name: "Rewrite summary" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          skills: expect.arrayContaining(["TypeScript"]),
          experiences: expect.any(Array),
          educations: expect.any(Array),
          languages: expect.any(Array),
        }),
      ),
    );
    expect(screen.getByText("Evidence-backed summary.")).toBeInTheDocument();
  });

  it("shows applied undo after accepting a summary wand edit", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Evidence-backed summary.",
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    await user.click(screen.getByRole("button", { name: "Rewrite summary" }));
    await screen.findByText("Evidence-backed summary.");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByRole("status", { name: "Applied. Undo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toHaveValue("Evidence-backed summary.");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Body")).toHaveValue("Focused builder.");
  });

  it("launches structured skill suggestions directly from the skills wand", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));

    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(skillsDialog).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByText(/whole CV/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Tighten the second bullet, drop the buzzwords."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Warm" })).not.toBeInTheDocument();
    expect(document.body.querySelector(".dasti-cv-section-sheet-overlay")).toBeInTheDocument();

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_skills_suggestions",
          existingItems: ["TypeScript"],
          maxItems: 6,
        }),
      ),
    );
    expect(
      within(skillsDialog).getByRole("region", { name: "Suggested items for Skills" }),
    ).toBeInTheDocument();
    expect(within(skillsDialog).getByText("Design systems")).toBeInTheDocument();
  });

  it("launches language suggestions directly from the languages wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["French", "Spanish"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Languages" }));

    const languagesDialog = screen.getByRole("dialog", { name: "Languages" });
    expect(languagesDialog).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_language_suggestions",
          existingItems: ["English"],
          maxItems: 5,
        }),
      ),
    );
    expect(
      within(languagesDialog).getByRole("region", { name: "Suggested items for Languages" }),
    ).toBeInTheDocument();
    expect(within(languagesDialog).getByText("French")).toBeInTheDocument();
  });

  it("launches hobby suggestions directly from the hobbies wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["TypeScript", "Photography", "Chess"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Hobbies" }));

    const hobbiesDialog = screen.getByRole("dialog", { name: "Hobbies" });
    expect(
      await within(hobbiesDialog).findByRole("region", { name: "Suggested items for Hobbies" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_hobby_suggestions",
          existingItems: ["Photography"],
          excludeItems: expect.arrayContaining(["TypeScript"]),
          maxItems: 6,
        }),
      ),
    );
    expect(
      within(hobbiesDialog).getAllByRole("button", { name: /Add suggested item/i }).length,
    ).toBeGreaterThan(0);
    expect(within(hobbiesDialog).queryByText("TypeScript")).not.toBeInTheDocument();
    expect(within(hobbiesDialog).getByText("Chess")).toBeInTheDocument();
  });

  it("accepts structured section AI suggestions into the active CV state", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    const baseState = buildCvLibraryState({ importCv });
    const currentCv = {
      ...baseState.currentCv,
      sections: baseState.currentCv.sections.map((section: any) =>
        section.id === "skills-cv_123"
          ? {
              ...section,
              structuredContent: [
                { id: "empty-skill", name: "" },
                ...section.structuredContent,
              ],
            }
          : section,
      ),
    };
    useCvLibraryMock.mockReturnValue({
      ...baseState,
      currentCv,
      cvs: [currentCv],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    await user.click(
      await screen.findByRole("button", { name: "Add suggested item Design systems" }),
    );

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const savedSections = importCv.mock.lastCall?.[0].sections;
    expect(
      savedSections.find((section: { id: string }) => section.id === "skills-cv_123")
        .structuredContent,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "TypeScript" }),
        expect.objectContaining({ name: "Design systems", level: "Intermediate" }),
      ]),
    );
    expect(
      savedSections
        .find((section: { id: string }) => section.id === "skills-cv_123")
        .structuredContent.some((item: { name?: string }) => !String(item.name ?? "").trim()),
    ).toBe(false);
  });

  it("shows skills as editable pills and hydrates accepted AI chips into the open sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });

    expect(screen.getByDisplayValue("TypeScript")).toBeInTheDocument();
    expect(
      skillsDialog.querySelector(".dasti-cv-section-card"),
    ).not.toBeInTheDocument();
    expect(
      skillsDialog.querySelector(".dasti-cv-pill-editor__chip"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    await user.click(
      await screen.findByRole("button", { name: "Add suggested item Design systems" }),
    );

    expect(screen.getByDisplayValue("Design systems")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Skills" }).querySelector(".dasti-cv-pill-editor__chip"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Design systems" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(screen.queryByDisplayValue("Design systems")).not.toBeInTheDocument();
  });

  it("runs the summary row wand directly in the Ask rail", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Sharper profile-aware summary.",
    });
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));

    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          existingText: "Focused builder.",
        }),
      ),
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Accept" }));
    expect(
      screen.getByRole("status", { name: "Applied. Undo Summary" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      JSON.stringify(
        importCv.mock.lastCall?.[0].sections.find(
          (section: { id: string }) => section.id === "summary-cv_123",
        ).structuredContent[0].summary,
      ),
    ).toContain("Sharper profile-aware summary.");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(2));
    expect(
      JSON.stringify(
        importCv.mock.lastCall?.[0].sections.find(
          (section: { id: string }) => section.id === "summary-cv_123",
        ).structuredContent[0].summary,
      ),
    ).toContain("Focused builder.");
  });

  it("opens languages and auto-loads structured suggestions from the row wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["French"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Languages" }));

    expect(screen.getByRole("dialog", { name: "Languages" })).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_language_suggestions",
          existingItems: ["English"],
        }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Add suggested item French" }),
    ).toBeInTheDocument();
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("keeps the add-skill field focused after adding a manual chip", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const addSkillInput = screen.getByLabelText("Skill");
    await user.type(addSkillInput, "Design systems");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(addSkillInput).toHaveFocus());
    expect(screen.getByDisplayValue("Design systems")).toBeInTheDocument();
  });

  it("clears stale rail AI suggestions when switching section scope", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(await within(skillsDialog).findByText("Design systems")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Sections" }));
    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));

    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
    expect(screen.queryByText("Design systems")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Suggested items for Skills" })).toBeNull();
  });

  it("routes project wands to the typed drawer instead of prose Ask AI", async () => {
    const user = userEvent.setup();
    const state = buildCvLibraryState();
    useCvLibraryMock.mockReturnValue({
      ...state,
      currentCv: {
        ...state.currentCv,
        sections: [
          ...state.currentCv.sections,
          {
            id: "projects-cv_123",
            type: "projects",
            title: "Projects",
            blocks: [
              {
                id: "project-block-cv_123",
                type: "text",
                plainText: "Built a reusable CV forge.",
              },
            ],
            structuredContent: [
              {
                id: "project-item-cv_123",
                title: "CV Forge",
                meta: "React",
                description: "Built a reusable CV forge.",
              },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open Projects item editor" }));

    expect(screen.getByRole("dialog", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("CV Forge")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ask" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("rewrites only the project description body from the project wand", async () => {
    const user = userEvent.setup();
    const state = buildCvLibraryState();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text:
        "**Project:** CV Forge\n**Stack:** React\n**Description:** Built a sharper CV forge.",
    });
    useCvLibraryMock.mockReturnValue({
      ...state,
      currentCv: {
        ...state.currentCv,
        sections: [
          ...state.currentCv.sections,
          {
            id: "projects-cv_123",
            type: "projects",
            title: "Projects",
            blocks: [
              {
                id: "project-block-cv_123",
                type: "text",
                plainText: "Built a reusable CV forge.",
              },
            ],
            structuredContent: [
              {
                id: "project-item-cv_123",
                title: "CV Forge",
                meta: "React",
                description: "Built a reusable CV forge.",
              },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open Projects item editor" }));
    await user.click(screen.getByRole("button", { name: "Improve description" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_project_description",
          existingText: "Built a reusable CV forge.",
        }),
      ),
    );

    expect(screen.queryByText(/\*\*Project:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*Stack:/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByLabelText("Description 1")).toHaveValue(
      "Built a sharper CV forge.",
    );
  });

  it("persists section delete with an undo action instead of warning-only stubbing", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Delete Certifications" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      importCv.mock.lastCall?.[0].sections.some(
        (section: { id: string }) => section.id === "certifications-cv_123",
      ),
    ).toBe(false);
  });

  it("persists keyboard reorder from the rail handle", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: "Reorder Skills" }).focus();
    await user.keyboard("{ArrowUp}");

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.map((section: { id: string }) => section.id),
    ).toEqual([
      "profile-cv_123",
      "summary-cv_123",
      "experience-cv_123",
      "skills-cv_123",
      "education-cv_123",
      "languages-cv_123",
      "certifications-cv_123",
      "achievements-cv_123",
      "additional-cv_123",
      "hobbies-cv_123",
    ]);
  });

  it("keeps tone selection local and sends freeform summary Ask with CV context", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Sharper profile-aware summary.",
    });
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));
    await user.click(screen.getByRole("button", { name: "Warm" }));
    expect(importCv).not.toHaveBeenCalled();
    expect(screen.getByText("Warm tone")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Tighten the second bullet, drop the buzzwords."),
      "Make this warmer.",
    );
    await user.click(screen.getByRole("button", { name: "Ask Summary" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          instruction: expect.stringContaining("User request: Make this warmer."),
          existingText: "Focused builder.",
        }),
      ),
    );
    expect(runCvSectionAiActionMock.mock.lastCall?.[0].instruction).toContain(
      "CV context, use only when relevant:",
    );
    expect(runCvSectionAiActionMock.mock.lastCall?.[0].instruction).toContain(
      "TypeScript",
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("adds PR4 section menu choices to draft state", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Add section" }));
    expect(document.body.querySelector(".dasti-cv-add-section-menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Projects" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Achievements" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Certifications" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Languages" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Hobbies" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Custom section" })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: "Publications" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Awards" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Volunteer" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "References" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Additional information" })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Projects" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      importCv.mock.lastCall?.[0].sections.some(
        (section: { title?: string }) => section.title === "Projects",
      ),
    ).toBe(true);
    expect(screen.getByRole("dialog", { name: "Projects" })).toBeInTheDocument();
  });

  it("routes rail import pdf through the hidden file input", async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Import PDF" }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows an honest pending import state while PDF parsing is unresolved", async () => {
    const user = userEvent.setup();
    let resolveImport: (value: unknown) => void = () => {};
    importFileMock.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, {
      target: {
        files: [new File(["%PDF"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Importing PDF").length).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole("button", { name: /Structuring sections/i }));
    expect(screen.getByText("Parsing imported résumé")).toBeInTheDocument();
    expect(screen.getAllByText("Structuring sections").length).toBeGreaterThan(1);
    expect(screen.getByText("Final pass")).toBeInTheDocument();
    expect(screen.getByText(/Parser errors will stay visible/i)).toBeInTheDocument();

    resolveImport({ status: "rejected", message: "Parser URL is not configured." });
    await waitFor(() => expect(importFileMock).toHaveBeenCalled());
  });

  it("clears the parsing pending state after parser returns sections even while save continues", async () => {
    const importCv = vi.fn(() => new Promise(() => undefined));
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));
    importFileMock.mockResolvedValue({
      status: "accepted",
      sections: buildCvLibraryState().currentCv.sections,
      authoritativeResume: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [new File(["%PDF"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Importing PDF").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Parsing is still pending/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Structuring sections/i })).toBeNull();
    expect(importCv).toHaveBeenCalled();
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

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
  });

  it("uses the PR4 style tab controls without the old icon cluster", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge|none"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByRole("button", { name: /Fraunces Bold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workshop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open saved resume styles" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open text styles" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Use Cobalt accent" }));

    await waitFor(() =>
      expect(
        screen.getByText("Preview style: swiss|quiet-editorial|custom|#2a78d6"),
      ).toBeInTheDocument(),
    );
  });

  it("applies template and font edits to the cv preview", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge|none"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(screen.getByRole("button", { name: /Fraunces Bold/i }));
    await user.click(screen.getByRole("menuitemradio", { name: "Ledger Sans" }));
    await user.click(screen.getByRole("button", { name: "Workshop" }));

    await waitFor(() =>
      expect(
        screen.getByText("Preview style: workshop|ledger-sans|sauge|none"),
      ).toBeInTheDocument(),
    );
  });

  it("shows a compact job-context chip instead of an embedded brief card and can clear it", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123&jobId=job_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("For: Senior Product Designer @ Acme"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Switch CV\. Active CV:/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to job" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading saved job brief…"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Saved job context is unavailable for this resume session."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear job context" }));

    expect(
      screen.queryByText("For: Senior Product Designer @ Acme"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
  });

  it("shows only the saved cv library when the picker is loaded", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: null,
        currentCvId: null,
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.getByText("Open a saved CV.")).toBeInTheDocument();
    expect(
      screen.queryByText("Open a saved CV, import a new one, or start from scratch."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import new" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start from scratch" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open selected CV" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-doc-card--chooser.dasti-doc-card--selected"),
    ).toBeTruthy();
  });

  it("opens the loaded workspace cv instead of reopening the picker when no id param is present", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Choose your CV")).not.toBeInTheDocument();
  });
});
