import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SectionEditor from "../SectionEditor";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import type { RemirrorJSON } from "remirror";
import type { CvDocument, CvSection } from "../../types/cvDocument";
import { applyImportRecoveryItems } from "../../lib/import-recovery";
import type {
  ResumeActiveTarget,
  SectionOpenRequest,
} from "../../features/verbati/resumeLinking";

const {
  mockRunCvSectionAiAction,
  mockTransformEditorSelection,
  mockConvexQuery,
  mockUpdateStructuredItem,
  mockReorderSections,
  mockRegisterBlockFlushCallback,
  mockCloseInspector,
  mockGeneratedApiModule,
  mockCvLibraryValue,
} = vi.hoisted(() => ({
  mockRunCvSectionAiAction: vi.fn(),
  mockTransformEditorSelection: vi.fn(),
  mockConvexQuery: vi.fn().mockResolvedValue({
    version: "test",
    supportedActions: [
      "generate_skills_suggestions",
      "generate_language_suggestions",
      "rewrite_summary_from_profile",
      "improve_summary_text",
      "improve_experience_bullets",
      "improve_experience_responsibilities",
    ],
  }),
  mockUpdateStructuredItem: vi.fn(),
  mockReorderSections: vi.fn(),
  mockRegisterBlockFlushCallback: vi.fn(() => vi.fn()),
  mockCloseInspector: vi.fn(),
  mockGeneratedApiModule: {
    api: {
      functions: {
        runCvSectionAiAction: "runCvSectionAiAction",
        transformEditorSelection: "transformEditorSelection",
        getCvAiCapabilities: "getCvAiCapabilities",
      },
    },
  },
  mockCvLibraryValue: {
    cvs: [],
    currentCv: null as CvDocument | null,
    currentCvId: "cv-test",
    isLoading: false,
    isDirty: false,
    isV1Active: true,
    loadCv: vi.fn(() => true),
    saveCurrentCv: vi.fn(),
    createCvFromState: vi.fn(),
    createNewCv: vi.fn(async () => {}),
    importCv: vi.fn(),
    updateSectionTitle: vi.fn(),
    updateBlockTitle: vi.fn(),
    updateBlockContent: vi.fn(),
    addBlock: vi.fn(),
    deleteBlock: vi.fn(),
    reorderBlocks: vi.fn(),
    reorderSections: (...args: unknown[]) => mockReorderSections(...args),
    addSection: vi.fn(),
    updateStructuredItem: (...args: unknown[]) => mockUpdateStructuredItem(...args),
    updateCurrentCv: vi.fn(),
    deleteCv: vi.fn(),
    renameCv: vi.fn(),
    registerFlushCallback: vi.fn(() => vi.fn()),
    registerBlockFlushCallback: (...args: any[]) =>
      mockRegisterBlockFlushCallback(...args),
    flushPendingEdits: vi.fn(),
    selectedInspector: null,
    openInspector: vi.fn(),
    closeInspector: (...args: unknown[]) => mockCloseInspector(...args),
    activeEditorBlockId: null,
    setActiveEditorBlockId: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  },
}));

vi.mock("convex/react", () => ({
  useAction: (target: unknown) => {
    if (target === mockGeneratedApiModule.api.functions.runCvSectionAiAction) {
      return mockRunCvSectionAiAction;
    }

    if (target === mockGeneratedApiModule.api.functions.transformEditorSelection) {
      return mockTransformEditorSelection;
    }

    return vi.fn();
  },
  useConvex: () => ({
    query: mockConvexQuery,
  }),
}));

vi.mock("../../../convex/_generated/api", () => mockGeneratedApiModule);
vi.mock("../../../convex/_generated/api.js", () => mockGeneratedApiModule);

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => mockCvLibraryValue,
}));
vi.mock("../../hooks/use-cv-ai-capabilities", () => ({
  useCvAiCapabilities: () => ({
    status: "ready",
    version: "test",
    supportedActions: [
      "generate_skills_suggestions",
      "generate_language_suggestions",
      "rewrite_summary_from_profile",
      "improve_summary_text",
      "improve_experience_bullets",
      "improve_experience_responsibilities",
    ],
    isSupported: (actionId: string) =>
      [
        "generate_skills_suggestions",
        "generate_language_suggestions",
        "rewrite_summary_from_profile",
        "improve_summary_text",
        "improve_experience_bullets",
        "improve_experience_responsibilities",
      ].includes(actionId),
    staleMessage: "stale",
  }),
}));

vi.mock("@remirror/react", async () => {
  const ReactModule = await import("react");

  return {
    Remirror: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="remirror-root">{children}</div>
    ),
    EditorComponent: () => <div data-testid="editor-component" />,
    useRemirror: () => {
      const docRef = ReactModule.useRef<RemirrorJSON>({
        type: "doc",
        content: [],
      } as RemirrorJSON);
      const domRef = ReactModule.useRef<HTMLElement | null>(null);
      const viewRef = ReactModule.useRef<any>(null);

      if (!domRef.current) {
        domRef.current = document.createElement("div");
      }

      if (!viewRef.current) {
        viewRef.current = {
          dom: domRef.current,
          state: {
            doc: {
              toJSON: () => docRef.current,
            },
            selection: {
              empty: true,
              from: 1,
              to: 1,
            },
            tr: {
              insertText: () => ({}),
              setSelection: () => ({}),
            },
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
          hasFocus: () => false,
          updateState: vi.fn(),
        };
      }

      return {
        manager: {
          view: viewRef.current,
          createState: vi.fn(() => ({})),
        },
        state: {},
        onChange: vi.fn(),
      };
    },
  };
});

vi.mock("remirror/extensions", () => {
  class StubExtension {}

  return {
    BoldExtension: StubExtension,
    ItalicExtension: StubExtension,
    UnderlineExtension: StubExtension,
    ParagraphExtension: StubExtension,
    BulletListExtension: StubExtension,
    OrderedListExtension: StubExtension,
    ListItemExtension: StubExtension,
    HistoryExtension: StubExtension,
    HardBreakExtension: StubExtension,
    PlaceholderExtension: StubExtension,
  };
});

vi.mock("prosemirror-state", () => ({
  TextSelection: {
    atEnd: vi.fn(() => ({})),
  },
}));

vi.mock("../cv-editor/BlockRenderer", () => ({
  default: () => <div data-testid="block-renderer" />,
}));

vi.mock("../remirror-editor/components/EditorToolbar", () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}));

function buildCvDocument(sections: CvSection[]): CvDocument {
  return {
    id: "cv-test",
    title: "Test CV",
    metadata: {
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
      version: 1,
    },
    sections,
  };
}

function renderSectionEditor(
  section: CvSection,
  options?: {
    currentCv?: CvDocument | null;
    onChange?: ReturnType<typeof vi.fn>;
    onContentChange?: ReturnType<typeof vi.fn>;
    collapsed?: boolean;
    openRequest?: SectionOpenRequest | null;
    onOpenRequestHandled?: ReturnType<typeof vi.fn>;
    activeTarget?: ResumeActiveTarget | null;
    onActiveTargetChange?: ReturnType<typeof vi.fn>;
  },
) {
  mockCvLibraryValue.currentCv =
    options?.currentCv ?? buildCvDocument([section]);

  const onChange = options?.onChange ?? vi.fn();
  const onContentChange = options?.onContentChange ?? vi.fn();
  const onOpenRequestHandled = options?.onOpenRequestHandled ?? vi.fn();
  const onActiveTargetChange = options?.onActiveTargetChange ?? vi.fn();

  render(
    <SectionEditor
      section={section}
      index={0}
      onChange={onChange}
      onContentChange={onContentChange}
      collapsed={options?.collapsed}
      openRequest={options?.openRequest}
      onOpenRequestHandled={onOpenRequestHandled}
      activeTarget={options?.activeTarget}
      onActiveTargetChange={onActiveTargetChange}
    />,
  );

  return {
    onChange,
    onContentChange,
    onOpenRequestHandled,
    onActiveTargetChange,
  };
}

function buildRecoverySection(
  section:
    | "hobbies"
    | "certifications"
    | "affiliations"
    | "additional_information",
) {
  return applyImportRecoveryItems([], [
    {
      blockId: `recovery-${section}`,
      rawText:
        section === "hobbies"
          ? "Chess, Hiking"
          : section === "certifications"
            ? "AWS Certified Developer\nAmazon Web Services"
            : section === "additional_information"
              ? "Available for travel and relocation"
              : "IEEE\nMember",
      cleanedText:
        section === "hobbies"
          ? "Chess, Hiking"
          : section === "certifications"
            ? "AWS Certified Developer\nAmazon Web Services"
            : section === "additional_information"
              ? "Available for travel and relocation"
              : "IEEE\nMember",
      displayTextSource: "cleaned",
      predictedSection: section,
      selectedSection: section,
      confidenceScore: "low",
      confidenceValue: 0.41,
      issueFlags: ["weakSectionMatch"],
      reviewStatus: "accepted",
      sourceSectionTitle:
        section === "hobbies"
          ? "Hobbies"
          : section === "certifications"
            ? "Certifications"
            : section === "additional_information"
              ? "Additional Information"
            : "Affiliations",
      sourceFieldKey: section,
      fragmentAssignments: [],
    },
  ]).find((entry) =>
    section === "certifications"
      ? String(entry.type) === "certifications"
      : section === "additional_information"
        ? String(entry.title) === "Additional Information"
        : String(entry.title).toLowerCase() === section,
  ) as CvSection;
}

describe("SectionEditor CV AI flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCvLibraryValue.currentCv = null;
    mockCvLibraryValue.isV1Active = true;
  });

  it("renders a summary diff and applies the accepted AI rewrite", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Clearer product designer summary.",
    });

    const summarySection: CvSection = {
      id: "summary-sec",
      title: "Summary",
      type: "summary",
      blocks: [],
      structuredContent: [
        {
          id: "sum-1",
          summary: ensureRemirrorDoc("Existing summary text."),
        },
      ],
    };

    const { onContentChange } = renderSectionEditor(summarySection);

    fireEvent.click(
      screen.getByRole("button", { name: "Summary AI actions" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Improve existing text" }),
    );

    await screen.findByText("Summary suggestion");
    expect(screen.getByText("Clearer product designer summary.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockUpdateStructuredItem).toHaveBeenCalledWith(
        "summary-sec",
        "sum-1",
        expect.objectContaining({
          summary: expect.objectContaining({
            type: "doc",
          }),
        }),
      );
      expect(onContentChange).toHaveBeenCalledWith(
        "summary-sec",
        expect.objectContaining({
          type: "doc",
        }),
      );
    });
  });

  it("dismisses a summary suggestion without applying it", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Discarded summary rewrite.",
    });

    const summarySection: CvSection = {
      id: "summary-sec",
      title: "Summary",
      type: "summary",
      blocks: [],
      structuredContent: [
        {
          id: "sum-1",
          summary: ensureRemirrorDoc("Existing summary text."),
        },
      ],
    };

    renderSectionEditor(summarySection);

    fireEvent.click(
      screen.getByRole("button", { name: "Summary AI actions" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Improve existing text" }),
    );

    await screen.findByText("Summary suggestion");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.queryByText("Summary suggestion")).not.toBeInTheDocument();
      expect(mockUpdateStructuredItem).not.toHaveBeenCalled();
    });
  });

  it("renders inline skill suggestions and applies an accepted suggestion", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["React", "TypeScript"],
    });

    const skillsSection: CvSection = {
      id: "skills-sec",
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: [
        {
          id: "skill-react",
          name: "React",
          level: "Advanced",
        },
      ],
    };

    const experienceSection: CvSection = {
      id: "exp-sec",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          id: "exp-1",
          company: "Acme",
          position: "Frontend Engineer",
          startDate: "2023-01-01",
          endDate: null,
          responsibilityBullets: ["Built React product flows"],
          responsibilities: ensureRemirrorDoc("Built React product flows"),
          achievements: [],
        },
      ],
    };

    const currentCv = buildCvDocument([skillsSection, experienceSection]);
    const { onChange } = renderSectionEditor(skillsSection, { currentCv });

    expect(
      screen.queryByRole("button", { name: "Edit skills" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Skills AI actions" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Suggest skills" }),
    );

    await screen.findByText("Suggested from experience and education");
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Edit skills" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add suggested item TypeScript" }),
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const updatedSection = onChange.mock.calls[0]?.[1] as CvSection;
    expect(updatedSection.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "skill-react",
          name: "React",
          level: "Advanced",
        }),
        expect.objectContaining({
          name: "TypeScript",
          level: "Intermediate",
        }),
      ]),
    );
  });

  it("renders inline language suggestions and applies an accepted suggestion", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["French", "English"],
    });

    const languageSection: CvSection = {
      id: "lang-sec",
      title: "Languages",
      type: "languages",
      blocks: [],
      structuredContent: [],
    };

    const summarySection: CvSection = {
      id: "summary-sec",
      title: "Summary",
      type: "summary",
      blocks: [],
      structuredContent: [
        {
          id: "sum-1",
          summary: ensureRemirrorDoc(
            "Bilingual English/French operations profile.",
          ),
        },
      ],
    };

    const currentCv = buildCvDocument([summarySection, languageSection]);
    const { onChange } = renderSectionEditor(languageSection, { currentCv });

    fireEvent.click(
      screen.getByRole("button", { name: "Languages AI actions" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Suggest languages" }),
    );

    await screen.findByText("Suggested from profile, experience, and education");
    expect(screen.getByText("French")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add suggested item French" }),
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const updatedSection = onChange.mock.calls[0]?.[1] as CvSection;
    expect(updatedSection.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "French",
          level: "Intermediate",
        }),
      ]),
    );
  });

  it("applies improved experience bullets to the structured item and linked block", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: [
        "Led redesign across billing flows.",
        "Improved lifecycle messaging clarity.",
      ],
    });

    const experienceSection: CvSection = {
      id: "exp-sec",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          id: "exp-1",
          company: "Acme",
          position: "Senior Designer",
          startDate: "2023-01-01",
          endDate: null,
          responsibilities: ensureRemirrorDoc("Old bullet"),
          responsibilityBullets: ["Old bullet"],
          achievements: [],
        },
      ],
    };

    const currentCv = buildCvDocument([experienceSection]);
    renderSectionEditor(experienceSection, { currentCv });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Experience AI actions for Senior Designer",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Improve bullet points" }),
    );

    await screen.findByText("Senior Designer suggestion");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockReorderSections).toHaveBeenCalledTimes(1);
    });

    const nextSections = mockReorderSections.mock.calls[0]?.[0] as CvSection[];
    const updatedSection = nextSections.find(
      (candidate) => candidate.id === "exp-sec",
    );

    expect(updatedSection?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "exp-1",
          responsibilityBullets: [
            "Led redesign across billing flows.",
            "Improved lifecycle messaging clarity.",
          ],
          achievements: [],
        }),
      ]),
    );
    expect(updatedSection?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributes: expect.objectContaining({
            linkedStructuredId: "exp-1",
          }),
          content: expect.objectContaining({
            type: "doc",
          }),
        }),
      ]),
    );
  });

  it("shows fresh-cv placeholder guidance for empty experience sections", () => {
    const experienceSection: CvSection = {
      id: "exp-empty",
      title: "Experience",
      type: "experience",
      blocks: [
        {
          id: "exp-block-1",
          type: "text",
          content: ensureRemirrorDoc(undefined),
          attributes: { linkedStructuredId: "exp-1" },
        } as any,
      ],
      structuredContent: [
        {
          id: "exp-1",
          company: "",
          position: "",
          startDate: "1970-01-01T00:00:00.000Z",
          endDate: null,
          responsibilities: ensureRemirrorDoc(undefined),
          achievements: [],
        },
      ],
    };

    renderSectionEditor(experienceSection, { collapsed: true });

    expect(
      screen.getByText("Add role, company, dates, and bullet points"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Entries stored in rich text. Expand to view.")).not.toBeInTheDocument();
    expect(screen.queryByText("No entries")).not.toBeInTheDocument();
  });

  it("shows fresh-cv placeholder guidance for empty education sections", () => {
    const educationSection: CvSection = {
      id: "edu-empty",
      title: "Education",
      type: "education",
      blocks: [
        {
          id: "edu-block-1",
          type: "text",
          content: ensureRemirrorDoc(undefined),
          attributes: { linkedStructuredId: "edu-1" },
        } as any,
      ],
      structuredContent: [
        {
          id: "edu-1",
          institution: "",
          degree: "",
          fieldOfStudy: "",
          startDate: undefined,
          endDate: undefined,
          description: ensureRemirrorDoc(undefined),
        },
      ],
    };

    renderSectionEditor(educationSection);

    expect(
      screen.getByText("Add degree, school, and dates"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No entries")).not.toBeInTheDocument();
  });

  it("shows fresh-cv placeholder guidance for empty achievements sections", () => {
    const achievementsSection: CvSection = {
      id: "ach-empty",
      title: "Achievements",
      type: "achievements",
      blocks: [],
      structuredContent: [],
    };

    renderSectionEditor(achievementsSection);

    expect(
      screen.getByText("Add key wins, awards, or standout results"),
    ).toBeInTheDocument();
  });

  it("opens the typed experience modal even when the document includes extra sections", () => {
    mockCvLibraryValue.isV1Active = false;

    const experienceSection: CvSection = {
      id: "exp-modal",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          id: "exp-1",
          company: "Acme",
          position: "Designer",
          startDate: "2024-01-01",
          endDate: null,
          responsibilities: ensureRemirrorDoc("Shipped onboarding redesigns"),
          achievements: [],
        },
      ],
    };
    const currentCv = buildCvDocument([
      experienceSection,
      {
        id: "text-hobbies",
        title: "Hobbies",
        type: "text",
        blocks: [],
        structuredContent: [{ id: "hob-1", name: "Chess" }],
      } as any,
    ]);

    renderSectionEditor(experienceSection, { currentCv });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit experience" })[0]);

    expect(screen.getByRole("dialog", { name: "Edit experience" })).toBeInTheDocument();
  });

  it("opens the typed education modal even when the document includes extra sections", () => {
    mockCvLibraryValue.isV1Active = false;

    const educationSection: CvSection = {
      id: "edu-modal",
      title: "Education",
      type: "education",
      blocks: [],
      structuredContent: [
        {
          id: "edu-1",
          institution: "State University",
          degree: "BSc",
          fieldOfStudy: "Design",
          startDate: "2020-01-01",
          endDate: "2024-01-01",
          description: ensureRemirrorDoc("Graduated with honors"),
        },
      ],
    };
    const currentCv = buildCvDocument([
      educationSection,
      {
        id: "text-affiliations",
        title: "Affiliations",
        type: "text",
        blocks: [],
        structuredContent: [{ id: "aff-1", organizationName: "IEEE" }],
      } as any,
    ]);

    renderSectionEditor(educationSection, { currentCv });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit education" })[0]);

    expect(screen.getByRole("dialog", { name: "Edit education" })).toBeInTheDocument();
  });

  it("renders hobbies as name-only tags and opens the hobbies modal", () => {
    const hobbiesSection: CvSection = {
      id: "hobbies-sec",
      title: "Hobbies",
      type: "text",
      blocks: [],
      structuredContent: [
        {
          id: "hob-1",
          name: "Chess",
        },
      ],
    } as any;

    renderSectionEditor(hobbiesSection);

    expect(screen.getByRole("button", { name: "Edit hobby Chess" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit hobbies" }));
    expect(screen.getByRole("dialog", { name: "Edit hobbies" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Chess")).toBeInTheDocument();
    expect(screen.queryByLabelText("Skill level")).toBeNull();
    expect(screen.queryByText("Mid")).toBeNull();
  });

  it("routes recovery-created hobbies through the hobbies modal", () => {
    const hobbiesSection = buildRecoverySection("hobbies");

    renderSectionEditor(hobbiesSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit hobbies" }));

    expect(screen.getByRole("dialog", { name: "Edit hobbies" })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Chess").length).toBeGreaterThan(0);
  });

  it("surfaces recovery notes in the skills preview", () => {
    const skillsSection: CvSection = {
      id: "skills-recovery-notes",
      title: "Skills",
      type: "skills",
      blocks: [
        {
          id: "skills-recovery-1",
          title: "Skills",
          type: "text",
          content: ensureRemirrorDoc("First aid\nCrowd control"),
          attributes: {
            importRecovery: {
              blockId: "recovery-skills-1",
              predictedSection: "skills",
              resolvedSection: "skills",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "skill-1",
          name: "First aid",
          level: "Advanced",
        },
      ],
    } as any;

    renderSectionEditor(skillsSection);

    expect(screen.getByText("Crowd control")).toBeInTheDocument();
  });

  it("filters separator-only recovery leftovers out of compact skills notes", () => {
    const skillsSection: CvSection = {
      id: "skills-recovery-punctuation",
      title: "Skills",
      type: "skills",
      blocks: [
        {
          id: "skills-recovery-2",
          title: "Skills",
          type: "text",
          content: ensureRemirrorDoc("First aid, , ."),
          attributes: {
            importRecovery: {
              blockId: "recovery-skills-2",
              predictedSection: "skills",
              resolvedSection: "skills",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "skill-1",
          name: "First aid",
          level: "Advanced",
        },
      ],
    } as any;

    renderSectionEditor(skillsSection);

    expect(screen.queryByText("Recovered")).toBeNull();
    expect(screen.queryByText(",")).toBeNull();
  });

  it("routes recovery-created additional information through the section modal surface", () => {
    const additionalInformationSection = buildRecoverySection(
      "additional_information",
    );

    renderSectionEditor(additionalInformationSection);

    expect(screen.getByText("Additional Information")).toBeInTheDocument();
    expect(
      screen.getByText("Available for travel and relocation"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("block-renderer")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Edit Additional Information" }),
    ).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Additional Information" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Edit Additional Information" }),
    ).toBeInTheDocument();
  });

  it("canonicalizes block-backed projects onto the projects modal surface", () => {
    const projectsSection = applyImportRecoveryItems([], [
      {
        blockId: "recovery-project-1",
        rawText: "Cv Forge redesign shipped for internal beta",
        cleanedText: "Cv Forge redesign shipped for internal beta",
        displayTextSource: "cleaned",
        predictedSection: "projects",
        selectedSection: "projects",
        confidenceScore: "low",
        confidenceValue: 0.33,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Projects",
        sourceFieldKey: "projects",
        fragmentAssignments: [],
      },
    ]).find((entry) => String(entry.type) === "projects") as CvSection;

    renderSectionEditor(projectsSection);

    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cv Forge redesign shipped for internal beta"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("block-renderer")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit projects" })[0]!);
    expect(
      screen.getByRole("dialog", { name: "Edit projects" }),
    ).toBeInTheDocument();
  });

  it("renders structured projects through the section-level editor path", () => {
    const projectsSection: CvSection = {
      id: "projects-structured",
      title: "Projects",
      type: "projects",
      collapsed: false,
      blocks: [
        {
          id: "project-block-1",
          title: "Gitlytics",
          type: "text",
          content: ensureRemirrorDoc(
            "Python, Flask, React, PostgreSQL, Docker | June 2020 – Present\nBuilt a full-stack app with GitHub OAuth.",
          ),
          attributes: { linkedStructuredId: "project-1" },
        },
      ],
      structuredContent: [
        {
          id: "project-1",
          title: "Gitlytics",
          meta: "Python, Flask, React, PostgreSQL, Docker | June 2020 – Present",
          description: "Built a full-stack app with GitHub OAuth.",
        },
      ] as any,
    };

    renderSectionEditor(projectsSection);

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Gitlytics")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Python, Flask, React, PostgreSQL, Docker | June 2020 – Present",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("block-renderer")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Edit projects" }).length,
    ).toBeGreaterThan(0);
  });

  it("routes recovery-created custom sections through the modern section modal surface", async () => {
    const customSection = applyImportRecoveryItems([], [
      {
        blockId: "recovery-custom-1",
        rawText: "Available for overnight support coverage",
        cleanedText: "Available for overnight support coverage",
        displayTextSource: "cleaned",
        predictedSection: "custom",
        selectedSection: "custom",
        selectedSectionTitle: "My own",
        confidenceScore: "low",
        confidenceValue: 0.31,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "reassigned",
        sourceSectionTitle: "My own",
        sourceFieldKey: "custom",
        fragmentAssignments: [],
      },
    ]).find((entry) => String(entry.title) === "My own") as CvSection;

    const { onChange } = renderSectionEditor(customSection);

    expect(screen.getByText("My own")).toBeInTheDocument();
    expect(screen.queryByTestId("block-renderer")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit My own" })[0]!);

    expect(
      screen.getByRole("dialog", { name: "Edit My own" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          id: String(customSection.id),
          title: "My own",
          type: "text",
          blocks: expect.arrayContaining([
            expect.objectContaining({
              title: "My own",
              type: "text",
            }),
          ]),
        }),
      ),
    );
  });

  it("surfaces recovery fallback notes in summary and its modal", () => {
    const summarySection: CvSection = {
      id: "summary-sec-notes",
      title: "Summary",
      type: "summary",
      blocks: [
        {
          id: "summary-block-1",
          title: "Summary",
          type: "text",
          content: ensureRemirrorDoc("Operations leader with after-hours availability"),
          attributes: {
            linkedStructuredId: "summary-item-1",
            importRecovery: {
              blockId: "recovery-summary-1",
              predictedSection: "summary",
              resolvedSection: "summary",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "summary-item-1",
          summary: ensureRemirrorDoc("Operations leader with after-hours availability"),
        },
      ],
    } as any;

    renderSectionEditor(summarySection);

    expect(screen.getByText("Recovered note")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit summary" })[0]);
    expect(screen.getByRole("dialog", { name: "Edit summary" })).toBeInTheDocument();
    expect(
      screen.getAllByText("Operations leader with after-hours availability").length,
    ).toBeGreaterThan(0);
  });

  it("surfaces recovery fallback notes in the profile section", () => {
    const profileSection: CvSection = {
      id: "profile-sec",
      title: "Profile",
      type: "profile",
      blocks: [
        {
          id: "profile-recovery-1",
          title: "Recovered profile note",
          type: "text",
          content: ensureRemirrorDoc(
            "Clearance eligible and available for night shifts",
          ),
          attributes: {
            importRecovery: {
              blockId: "recovery-profile-1",
              predictedSection: "profile",
              resolvedSection: "profile",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "profile-item-1",
          name: "Jane Doe",
          email: "jane@example.com",
          desiredPosition: "Security Officer",
        },
      ],
    } as any;

    renderSectionEditor(profileSection);

    expect(screen.getByText("Recovered note")).toBeInTheDocument();
    expect(
      screen.getByText("Clearance eligible and available for night shifts"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit profile" })[0]);

    expect(screen.getByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();
    expect(
      screen.getAllByText("Clearance eligible and available for night shifts").length,
    ).toBeGreaterThan(0);
  });

  it("keeps recovery metadata blocks out of the hobbies editing surface", () => {
    const hobbiesSection: CvSection = {
      id: "hobbies-sec",
      title: "Hobbies",
      type: "text",
      blocks: [
        {
          id: "hob-block-1",
          title: "Recovered hobby block",
          type: "text",
          content: ensureRemirrorDoc("Chess, Hiking"),
          attributes: {
            importRecovery: {
              blockId: "recovery-1",
              predictedSection: "summary",
              resolvedSection: "hobbies",
            },
          },
        },
          ],
      structuredContent: [
        {
          id: "hob-1",
          name: "Chess",
        },
      ],
    } as any;

    renderSectionEditor(hobbiesSection);

    expect(
      screen.getByRole("button", { name: "Edit hobby Chess" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recovered hobby block")).toBeNull();
  });

  it("surfaces recovery fallback notes in experience and its modal", () => {
    const experienceSection: CvSection = {
      id: "experience-notes",
      title: "Experience",
      type: "experience",
      blocks: [
        {
          id: "experience-recovery-1",
          title: "Recovered experience",
          type: "text",
          content: ensureRemirrorDoc("Handled late-shift escalation coverage"),
          attributes: {
            linkedStructuredId: "exp-1",
            importRecovery: {
              blockId: "recovery-exp-1",
              predictedSection: "experience",
              resolvedSection: "experience",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "exp-1",
          company: "Acme Corp",
          position: "Support Lead",
          startDate: "2024-01-01",
          responsibilities: ensureRemirrorDoc("Managed a support team"),
        },
      ],
    } as any;

    renderSectionEditor(experienceSection);

    expect(screen.getByText("Handled late-shift escalation coverage")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit experience" })[0]);
    expect(screen.getByRole("dialog", { name: "Edit experience" })).toBeInTheDocument();
    expect(screen.getAllByText("Handled late-shift escalation coverage").length).toBeGreaterThan(0);
  });

  it("surfaces recovery fallback notes in education and its modal", () => {
    const educationSection: CvSection = {
      id: "education-notes",
      title: "Education",
      type: "education",
      blocks: [
        {
          id: "education-recovery-1",
          title: "Recovered education",
          type: "text",
          content: ensureRemirrorDoc("Evening specialization in logistics systems"),
          attributes: {
            linkedStructuredId: "edu-1",
            importRecovery: {
              blockId: "recovery-edu-1",
              predictedSection: "education",
              resolvedSection: "education",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "edu-1",
          institution: "State University",
          degree: "BSc Logistics",
          description: ensureRemirrorDoc("Studied transport operations"),
        },
      ],
    } as any;

    renderSectionEditor(educationSection);

    expect(screen.getByText("Evening specialization in logistics systems")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit education" })[0]);
    expect(screen.getByRole("dialog", { name: "Edit education" })).toBeInTheDocument();
    expect(screen.getAllByText("Evening specialization in logistics systems").length).toBeGreaterThan(0);
  });

  it("surfaces recovery notes in the languages section preview", () => {
    const languagesSection: CvSection = {
      id: "languages-notes",
      title: "Languages",
      type: "languages",
      blocks: [
        {
          id: "languages-recovery-1",
          title: "Languages",
          type: "text",
          content: ensureRemirrorDoc("English\nSpanish"),
          attributes: {
            importRecovery: {
              blockId: "recovery-lang-1",
              predictedSection: "languages",
              resolvedSection: "languages",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "lang-1",
          name: "English",
          level: "Fluent",
        },
      ],
    } as any;

    renderSectionEditor(languagesSection);

    expect(screen.getByText("Spanish")).toBeInTheDocument();
  });

  it("filters separator-only recovery leftovers out of compact language notes", () => {
    const languagesSection: CvSection = {
      id: "languages-notes-punctuation",
      title: "Languages",
      type: "languages",
      blocks: [
        {
          id: "languages-recovery-2",
          title: "Languages",
          type: "text",
          content: ensureRemirrorDoc("English, , ."),
          attributes: {
            importRecovery: {
              blockId: "recovery-lang-2",
              predictedSection: "languages",
              resolvedSection: "languages",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "lang-1",
          name: "English",
          level: "Fluent",
        },
      ],
    } as any;

    renderSectionEditor(languagesSection);

    expect(screen.queryByText("Recovered")).toBeNull();
  });

  it("shows recovery-created achievements directly in the final achievements surface", () => {
    const achievementsSection = applyImportRecoveryItems([], [
      {
        blockId: "recovery-achievement-1",
        rawText: "Reduced theft incidents by 28%",
        cleanedText: "Reduced theft incidents by 28%",
        displayTextSource: "cleaned",
        predictedSection: "achievements",
        selectedSection: "achievements",
        confidenceScore: "low",
        confidenceValue: 0.34,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Achievements",
        sourceFieldKey: "achievements",
        fragmentAssignments: [],
      },
    ]).find((entry) => String(entry.type) === "achievements") as CvSection;

    renderSectionEditor(achievementsSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit achievements" }));
    expect(screen.getByRole("dialog", { name: "Edit achievements" })).toBeInTheDocument();
    expect(screen.getAllByText("Reduced theft incidents by 28%").length).toBeGreaterThan(0);
  });

  it("does not duplicate achievements when structured content and recovery blocks match", () => {
    const achievementsSection: CvSection = {
      id: "achievements-dedupe",
      title: "Achievements",
      type: "achievements",
      blocks: [
        {
          id: "achievement-block-1",
          title: "Recovered achievement",
          type: "text",
          content: ensureRemirrorDoc("Reduced theft incidents by 28%"),
          attributes: {
            linkedStructuredId: "ach-1",
            importRecovery: {
              blockId: "recovery-achievement-duplicate",
              predictedSection: "achievements",
              resolvedSection: "achievements",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "ach-1",
          text: "Reduced theft incidents by 28%",
        },
      ],
    } as any;

    renderSectionEditor(achievementsSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit achievements" }));
    expect(screen.getAllByDisplayValue("Reduced theft incidents by 28%").length).toBe(1);
  });

  it("opens certification modal with certification-specific fields", () => {
    const certificationSection: CvSection = {
      id: "cert-sec",
      title: "Certifications",
      type: "certifications",
      blocks: [],
      structuredContent: [
        {
          id: "cert-1",
          certificationName: "AWS Certified Developer",
          issuingOrganization: "Amazon Web Services",
          issueDate: "2024-01-01T00:00:00.000Z",
          expirationDate: null,
          credentialId: "AWS-123",
        },
      ],
    } as any;

    renderSectionEditor(certificationSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit certifications" }));

    expect(screen.getByRole("dialog", { name: "Edit certifications" })).toBeInTheDocument();
    expect(screen.getByText("Certification Name")).toBeInTheDocument();
    expect(screen.getByText("Issuing Organization")).toBeInTheDocument();
    expect(screen.getByText("Credential ID")).toBeInTheDocument();
  });

  it("routes recovery-created certifications through the certification modal", () => {
    const certificationSection = buildRecoverySection("certifications");

    renderSectionEditor(certificationSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit certifications" }));

    expect(screen.getByRole("dialog", { name: "Edit certifications" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("AWS Certified Developer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Amazon Web Services")).toBeInTheDocument();
  });

  it("opens the certification modal from an openRequest and focuses the targeted item", async () => {
    const certificationSection: CvSection = {
      id: "cert-open-request",
      title: "Certifications",
      type: "certifications",
      blocks: [],
      structuredContent: [
        {
          id: "cert-1",
          certificationName: "AWS Certified Developer",
          issuingOrganization: "Amazon Web Services",
          credentialId: "AWS-123",
        },
        {
          id: "cert-2",
          certificationName: "CKA",
          issuingOrganization: "CNCF",
          credentialId: "CKA-456",
        },
      ],
    } as any;

    renderSectionEditor(certificationSection, {
      openRequest: {
        requestId: "resume-link-cert-2",
        shouldOpenModal: true,
        itemId: "cert-2",
        sectionType: "certifications",
        sectionId: "cert-open-request",
      },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Edit certifications" }),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("CKA")).toHaveFocus(),
    );
  });

  it("keeps the targeted skills input focused while typing after a preview openRequest", async () => {
    const skillsSection: CvSection = {
      id: "skills-open-request",
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: [
        {
          id: "skill-1",
          name: "React",
          level: "Advanced",
        },
        {
          id: "skill-2",
          name: "TypeScript",
          level: "Advanced",
        },
      ],
    } as any;

    renderSectionEditor(skillsSection, {
      openRequest: {
        requestId: "resume-link-skill-2",
        shouldOpenModal: true,
        itemId: "skill-2",
        sectionType: "skills",
        sectionId: "skills-open-request",
      },
    });

    const dialog = await screen.findByRole("dialog", { name: "Edit skills" });
    const targetedInput = within(dialog).getByDisplayValue("TypeScript");

    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(targetedInput).toHaveFocus();
    });

    fireEvent.change(targetedInput, {
      target: { value: "TypeScript systems" },
    });

    await waitFor(() => {
      expect(targetedInput).toHaveFocus();
    });
  });

  it("surfaces recovery fallback notes in certifications", () => {
    const certificationSection: CvSection = {
      id: "cert-sec-notes",
      title: "Certifications",
      type: "certifications",
      blocks: [
        {
          id: "cert-block-1",
          title: "AWS Certified Developer",
          type: "text",
          content: ensureRemirrorDoc(
            "AWS Certified Developer\nAmazon Web Services\nValid through 2027",
          ),
          attributes: {
            linkedStructuredId: "cert-1",
            importRecovery: {
              blockId: "recovery-cert-1",
              predictedSection: "certifications",
              resolvedSection: "certifications",
            },
          },
        },
      ],
      structuredContent: [
        {
          id: "cert-1",
          certificationName: "AWS Certified Developer",
          issuingOrganization: "Amazon Web Services",
          credentialId: "",
        },
      ],
    } as any;

    renderSectionEditor(certificationSection);

    expect(screen.getByText("Recovered note")).toBeInTheDocument();
    expect(screen.getByText("Valid through 2027")).toBeInTheDocument();
  });

  it("opens affiliation modal with membership-specific fields", () => {
    const affiliationSection: CvSection = {
      id: "aff-sec",
      title: "Affiliations",
      type: "text",
      blocks: [],
      structuredContent: [
        {
          id: "aff-1",
          organizationName: "IEEE",
          roleOrMembershipType: "Member",
          startDate: "2022-01-01T00:00:00.000Z",
          endDate: null,
          isCurrent: true,
          notes: "Professional chapter member",
        },
      ],
    } as any;

    renderSectionEditor(affiliationSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit affiliations" }));

    expect(screen.getByRole("dialog", { name: "Edit affiliations" })).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Membership / Role")).toBeInTheDocument();
    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByText("Job Title")).toBeNull();
  });

  it("routes recovery-created affiliations through the affiliation modal", () => {
    const affiliationSection = buildRecoverySection("affiliations");

    renderSectionEditor(affiliationSection);

    fireEvent.click(screen.getByRole("button", { name: "Edit affiliations" }));

    expect(screen.getByRole("dialog", { name: "Edit affiliations" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("IEEE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Member")).toBeInTheDocument();
  });

  it("opens the affiliation modal when the section heading is clicked", () => {
    const affiliationSection: CvSection = {
      id: "aff-sec-click",
      title: "Affiliations",
      type: "text",
      blocks: [],
      structuredContent: [
        {
          id: "aff-1",
          organizationName: "IEEE",
          roleOrMembershipType: "Member",
        },
      ],
    } as any;

    renderSectionEditor(affiliationSection);

    fireEvent.click(screen.getByText("Affiliations"));

    expect(
      screen.getByRole("dialog", { name: "Edit affiliations" }),
    ).toBeInTheDocument();
  });

  it("opens the additional information modal from the section surface and saves back to a canonical text block", async () => {
    const additionalInformationSection: CvSection = {
      id: "additional-info-sec",
      title: "Additional Information",
      type: "text",
      blocks: [],
      structuredContent: null,
    } as any;

    const { onChange } = renderSectionEditor(additionalInformationSection);

    fireEvent.click(screen.getByText("Add supporting details, references, or availability notes."));

    expect(
      screen.getByRole("dialog", { name: "Edit Additional Information" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save additional information",
      }),
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          id: "additional-info-sec",
          type: "text",
          blocks: expect.arrayContaining([
            expect.objectContaining({
              title: "Additional Information",
              type: "text",
            }),
          ]),
        }),
      ),
    );
  });

  it("opens the additional information modal from an openRequest", async () => {
    const additionalInformationSection: CvSection = {
      id: "additional-info-open-request",
      title: "Additional Information",
      type: "text",
      blocks: [
        {
          id: "additional-info-block-1",
          title: "Additional Information",
          type: "text",
          content: ensureRemirrorDoc("Available for relocation."),
        },
      ],
      structuredContent: null,
    } as any;

    renderSectionEditor(additionalInformationSection, {
      openRequest: {
        requestId: "resume-link-additional-info",
        shouldOpenModal: true,
        sectionType: "additional_information",
        sectionId: "additional-info-open-request",
      },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Edit Additional Information" }),
      ).toBeInTheDocument(),
    );
  });

  it("notifies the parent when an additional information openRequest is consumed", async () => {
    const additionalInformationSection: CvSection = {
      id: "additional-info-handled",
      title: "Additional Information",
      type: "text",
      blocks: [
        {
          id: "additional-info-handled-block-1",
          title: "Additional Information",
          type: "text",
          content: ensureRemirrorDoc("Available for relocation."),
        },
      ],
      structuredContent: null,
    } as any;

    const { onOpenRequestHandled } = renderSectionEditor(
      additionalInformationSection,
      {
        onOpenRequestHandled: vi.fn(),
        openRequest: {
          requestId: "resume-link-additional-info-handled",
          shouldOpenModal: true,
          sectionType: "additional_information",
          sectionId: "additional-info-handled",
        },
      },
    );

    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Edit Additional Information" }),
      ).toBeInTheDocument(),
    );

    expect(onOpenRequestHandled).toHaveBeenCalledWith(
      "resume-link-additional-info-handled",
    );
    expect(onOpenRequestHandled).toHaveBeenCalledTimes(1);
  });

  it("focuses the targeted profile field when a preview-linked profile modal opens", async () => {
    const profileSection: CvSection = {
      id: "profile-focus-sec",
      title: "Profile",
      type: "profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile-item-1",
          name: "Jane Doe",
          desiredPosition: "Security Officer",
          email: "jane@example.com",
          phone: "+33 6 12 34 56 78",
          linkedin: "linkedin.com/in/janedoe",
          website: "https://janedoe.dev",
          location: "Paris",
        },
      ],
    } as any;

    renderSectionEditor(profileSection, {
      openRequest: {
        requestId: "resume-link-profile-email",
        shouldOpenModal: true,
        sectionType: "profile",
        itemId: "email",
        sectionId: "profile-focus-sec",
        sectionTitle: "Profile",
      },
    });

    const emailInput = await screen.findByLabelText("Email", {
      selector: "input",
    });
    expect(screen.getByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();
    expect(emailInput).toHaveFocus();
  });

  it("opens a custom text section modal from an openRequest", async () => {
    const customSection: CvSection = {
      id: "custom-open-request",
      title: "Community",
      type: "text",
      blocks: [
        {
          id: "custom-open-request-block",
          title: "Community",
          type: "text",
          content: ensureRemirrorDoc("Volunteer organizer"),
        },
      ],
      structuredContent: null,
    } as any;

    renderSectionEditor(customSection, {
      openRequest: {
        requestId: "resume-link-custom",
        shouldOpenModal: true,
        sectionType: "custom",
        sectionId: "custom-open-request",
        sectionTitle: "Community",
      },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Edit Community" }),
      ).toBeInTheDocument(),
    );
  });
});
