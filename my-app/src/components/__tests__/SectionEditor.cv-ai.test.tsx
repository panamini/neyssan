import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SectionEditor from "../SectionEditor";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import type { RemirrorJSON } from "remirror";
import type { CvDocument, CvSection } from "../../types/cvDocument";

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
  },
) {
  mockCvLibraryValue.currentCv =
    options?.currentCv ?? buildCvDocument([section]);

  const onChange = options?.onChange ?? vi.fn();
  const onContentChange = options?.onContentChange ?? vi.fn();

  render(
    <SectionEditor
      section={section}
      index={0}
      onChange={onChange}
      onContentChange={onContentChange}
      collapsed={options?.collapsed}
    />,
  );

  return { onChange, onContentChange };
}

describe("SectionEditor CV AI flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCvLibraryValue.currentCv = null;
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
});
