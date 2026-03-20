import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

// Mock heavy/editor deps to keep tests lightweight and deterministic
vi.mock("@remirror/react", () => {
  const Remirror = ({ children }: { children?: React.ReactNode }) => <div data-testid="remirror">{children}</div>;
  const EditorComponent = () => <div data-testid="editor" />;
  const useRemirror = () => ({
    manager: { view: { state: { doc: { toJSON: () => ({ type: "doc", content: [] }) } }, hasFocus: () => false, focus: () => {}, dispatch: () => {} } },
    state: { type: "doc", content: [] },
    onChange: () => {},
  });
  return { Remirror, EditorComponent, useRemirror };
});

vi.mock("prosemirror-state", () => ({
  TextSelection: { atEnd: () => ({}) },
}));

// Avoid runtime dependency on icons
vi.mock("lucide-react", () => {
  const Stub = () => null;
  return {
    X: Stub,
    Pen: Stub,
    Pencil: Stub,
    PenLine: Stub,
    Mail: Stub,
    Phone: Stub,
    Linkedin: Stub,
    Globe: Stub,
    MapPin: Stub,
    UserRound: Stub,
    Briefcase: Stub,
    Plus: Stub,
    Trash: Stub,
    Trash2: Stub,
  };
});

// Mock internal editor UI not relevant for this test
vi.mock("../components/remirror-editor/components/EditorToolbar.tsx", () => ({ EditorToolbar: () => null }));
vi.mock("../hooks/use-flush-subscription.ts", () => ({ useSectionFlushSubscription: (_opts: unknown) => { /* noop */ } }));
vi.mock("../components/cv-editor/BlockRenderer.tsx", () => ({ default: () => null }));
// Mock CvLibraryContext since SectionEditor(summary) calls useCvLibrary even when collapsed
vi.mock("../contexts/CvLibraryContext", async () => {
  const actual: any = await vi.importActual("../contexts/CvLibraryContext");
  return {
    ...actual,
    useCvLibrary: () => ({
      updateStructuredItem: vi.fn(),
      // minimal API surface for safety; rest are no-ops
      cvs: [],
      currentCv: null,
      isLoading: false,
      isDirty: false,
      loadCv: async () => {},
      saveCurrentCv: async () => {},
      createCvFromState: () => {},
      createNewCv: () => {},
      importCv: async () => {},
      updateSectionTitle: () => {},
      updateBlockTitle: () => {},
      updateBlockContent: () => {},
      addBlock: () => {},
      deleteBlock: () => {},
      reorderBlocks: () => {},
      reorderSections: () => {},
      addSection: () => {},
      registerFlushCallback: () => () => {},
      registerBlockFlushCallback: () => () => {},
      flushPendingEdits: () => {},
      selectedInspector: null,
      openInspector: () => {},
      closeInspector: () => {},
      activeEditorBlockId: null,
      setActiveEditorBlockId: () => {},
    }),
  };
});

// Under test
import SectionEditor from "../components/SectionEditor";
import type { CvSection, ISummaryItem } from "../types/cvDocument";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function queryButtonByText(text: string): HTMLButtonElement | null {
  const btns = Array.from(document.querySelectorAll("button"));
  return (btns.find((b) => (b.textContent ?? "").trim() === text) as HTMLButtonElement) ?? null;
}

function queryButtonByAriaLabel(label: string): HTMLButtonElement | null {
  return document.querySelector(`button[aria-label="${label}"]`);
}

describe("Summary section - collapsed preview and modal open", () => {
  it("renders collapsed preview text and opens Summary modal", () => {
    const summaryDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Experienced frontend developer with focus on DX." }] },
      ],
    };

    const item: ISummaryItem = {
      id: "sum-1",
      summary: summaryDoc as unknown as any, // allow plain JSON shape in test
    };

    const section: CvSection = {
      id: "sec-summary",
      title: "Summary",
      type: "summary",
      blocks: [],
      structuredContent: [item],
    };

    const onChange = vi.fn();

    const { unmount } = renderIntoDocument(
      <SectionEditor
        section={section}
        index={0}
        onChange={onChange}
        onTitleChange={() => {}}
        onContentChange={() => {}}
        collapsed={true}
      />
    );

    const bodyTxt = (document.body.textContent ?? "").replace(/\s+/g, " ");
    expect(bodyTxt).toContain("Experienced frontend developer with focus on DX.");

    const editBtn = queryButtonByAriaLabel("Edit summary") ?? queryButtonByText("Edit");
    expect(editBtn).toBeTruthy();

    act(() => {
      editBtn?.click();
    });

    // Verify a modal dialog appears (robust against internal markup)
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement | null;
    expect(dialog).toBeTruthy();

    unmount();
  });
});
it("shows Clear summary button and clears structuredContent on confirm", () => {
  const summaryDoc = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Some summary text" }] }],
  };

  const item: ISummaryItem = {
    id: "sum-1",
    summary: summaryDoc as unknown as any,
  };

  const section: CvSection = {
    id: "sec-summary",
    title: "Summary",
    type: "summary",
    blocks: [],
    structuredContent: [item],
  };

  let changedSection: CvSection | null = null;
  const onChange = vi.fn((idx: number, updated: CvSection) => {
    expect(idx).toBe(0);
    changedSection = updated;
  });

  // Ensure confirm returns true in test env
  (globalThis as any).confirm = vi.fn(() => true);

  const { unmount } = renderIntoDocument(
    <SectionEditor
      section={section}
      index={0}
      onChange={onChange}
      onTitleChange={() => {}}
      onContentChange={() => {}}
      collapsed={true}
    />
  );

  const clearBtn = queryButtonByAriaLabel("Clear summary") ?? queryButtonByText("Clear");
  expect(clearBtn).toBeTruthy();

  act(() => {
    clearBtn?.click();
  });

  expect(onChange).toHaveBeenCalled();
  if (!changedSection) {
    throw new Error("Expected changedSection to be set");
  }
  const cs = changedSection as CvSection;
  expect(Array.isArray(cs.structuredContent as unknown[])).toBe(true);
  expect((cs.structuredContent as unknown[]).length).toBe(0);

  unmount();
});
