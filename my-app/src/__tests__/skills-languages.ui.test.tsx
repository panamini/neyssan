import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Mock heavy/editor deps before importing the component under test
vi.mock("@remirror/react", () => {
  const Remirror = ({ children }: { children?: React.ReactNode }) => <div data-testid="remirror">{children}</div>;
  const EditorComponent = () => <div data-testid="editor" />;
  const useRemirror = () => ({
    manager: {
      view: {
        state: { doc: { toJSON: () => ({ type: "doc", content: [] }) } },
        hasFocus: () => false,
        focus: () => {},
        dispatch: () => {},
      },
      createState: ({ content }: { content: unknown }) => content,
    },
    state: { type: "doc", content: [] },
    onChange: () => {},
  });
  return { Remirror, EditorComponent, useRemirror };
});

// Avoid importing real ProseMirror state
vi.mock("prosemirror-state", () => ({
  TextSelection: { atEnd: () => ({}) },
}));

// Avoid runtime dependency on icons
vi.mock("lucide-react", () => {
  const Stub = () => null;
  return {
    X: Stub,
    Plus: Stub,
    Pen: Stub,
    Trash: Stub,
    Trash2: Stub,
    Pencil: Stub,
    PenLine: Stub,
    Pin: Stub,
    PinOff: Stub,
    Mail: Stub,
    Phone: Stub,
    Linkedin: Stub,
    Globe: Stub,
    MapPin: Stub,
    UserRound: Stub,
    Briefcase: Stub,
  };
});

// Mock internal editor UI that isn't relevant for these tests
vi.mock("../components/remirror-editor/components/EditorToolbar.tsx", () => ({ EditorToolbar: () => null }));
vi.mock("../hooks/use-flush-subscription.ts", () => ({ useSectionFlushSubscription: (_opts: unknown) => { /* noop */ } }));
vi.mock("../components/cv-editor/BlockRenderer.tsx", () => ({ default: () => null }));

// Now import the component under test
import SectionEditor from "../components/SectionEditor";
import type { CvSection, ISkillItem, ILanguageItem } from "../types/cvDocument";

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

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const { set } = Object.getOwnPropertyDescriptor(element, "value") || {};
  const prototype = Object.getPrototypeOf(element);
  const prototypeSet = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (prototypeSet) {
    prototypeSet.call(element, value);
  } else if (set) {
    set.call(element, value);
  } else {
    element.value = value;
  }
}

function queryButtonByAriaLabel(label: string): HTMLButtonElement | null {
  return document.querySelector(`button[aria-label="${label}"]`);
}

describe("SectionEditor - Skills and Languages inline editing", () => {
  // UPDATED: inline-edit flow.
  it("allows inline editing of skills and persists changes", async () => {
    const skills: ISkillItem[] = [
      { id: "s1", name: "React", level: "Intermediate" },
      { id: "s2", name: "TypeScript", level: "Advanced" },
    ];

    const section: CvSection = {
      id: "sec-sk",
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: skills,
    };

    let changedSection: CvSection | null = null;
    const handleChange = vi.fn((idx: number, updated: CvSection) => {
      expect(idx).toBe(0);
      changedSection = updated;
    });

    const { unmount } = renderIntoDocument(
      <SectionEditor
        section={section}
        index={0}
        onChange={handleChange}
        onTitleChange={() => {}}
        onContentChange={() => {}}
        collapsed={false}
      />
    );

    const inlineInput = document.getElementById("skill-name-inline-0") as HTMLInputElement | null;
    expect(inlineInput).toBeTruthy();
    if (inlineInput) {
      await act(() => {
        inlineInput.focus();
      });
      await act(() => {
        setNativeValue(inlineInput, "React Native");
        inlineInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await flushMicrotasks();
      await act(() => {
        inlineInput.blur();
      });
      await flushMicrotasks();
    }

    expect(handleChange).toHaveBeenCalled();
    expect(changedSection).not.toBeNull();
    const sc = (changedSection!).structuredContent as ISkillItem[];
    expect(Array.isArray(sc)).toBe(true);
    expect(sc[0]?.name).toBe("React Native");

    unmount();
  });

  it("allows inline editing of languages and persists changes", async () => {
    const languages: ILanguageItem[] = [
      { id: "l1", name: "English", level: "Fluent" },
      { id: "l2", name: "French", level: "Advanced" },
    ];

    const section: CvSection = {
      id: "sec-lang",
      title: "Languages",
      type: "languages",
      blocks: [],
      structuredContent: languages,
    };

    let changedSection: CvSection | null = null;
    const handleChange = vi.fn((idx: number, updated: CvSection) => {
      expect(idx).toBe(0);
      changedSection = updated;
    });

    const { unmount } = renderIntoDocument(
      <SectionEditor
        section={section}
        index={0}
        onChange={handleChange}
        onTitleChange={() => {}}
        onContentChange={() => {}}
        collapsed={false}
      />
    );

    const languageInput = document.getElementById("language-name-inline-0") as HTMLInputElement | null;
    expect(languageInput).toBeTruthy();
    if (languageInput) {
      await act(() => {
        languageInput.focus();
      });
      await act(() => {
        setNativeValue(languageInput, "Spanish");
        languageInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await flushMicrotasks();
      await act(() => {
        languageInput.blur();
      });
      await flushMicrotasks();
    }

    expect(handleChange).toHaveBeenCalled();
    expect(changedSection).not.toBeNull();
    const sc = (changedSection!).structuredContent as ILanguageItem[];
    expect(Array.isArray(sc)).toBe(true);
    expect(sc[0]?.name).toBe("Spanish");

    unmount();
  });
  it("allows removing a skill inline in collapsed view", async () => {
    const skills: ISkillItem[] = [
      { id: "s1", name: "React", level: "Intermediate" },
      { id: "s2", name: "TypeScript", level: "Advanced" },
    ];

    const section: CvSection = {
      id: "sec-sk",
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: skills,
    };

    let changedSection: CvSection | null = null;
    const handleChange = vi.fn((idx: number, updated: CvSection) => {
      expect(idx).toBe(0);
      changedSection = updated;
    });

    const { unmount } = renderIntoDocument(
      <SectionEditor
        section={section}
        index={0}
        onChange={handleChange}
        onTitleChange={() => {}}
        onContentChange={() => {}}
        collapsed={false}
      />
    );

    // Click inline remove on first inline row
    const removeBtn = queryButtonByAriaLabel("Remove React");
    expect(removeBtn).toBeTruthy();

    await act(() => {
      removeBtn?.click();
    });
    await flushMicrotasks();
    expect(handleChange).toHaveBeenCalled();
    expect(changedSection).not.toBeNull();
    const sc = (changedSection!).structuredContent as ISkillItem[];
    expect(sc.length).toBe(1);
    expect(sc[0]?.name).toBe("TypeScript");

    unmount();
  });
});
