import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Mock heavy/editor deps and icons to keep tests lightweight
vi.mock("@remirror/react", () => {
  const Remirror = ({ children }: { children?: React.ReactNode }) => <div data-testid="remirror">{children}</div>;
  const EditorComponent = () => <div data-testid="editor" />;
  const useRemirror = () => ({
    manager: { view: { state: { doc: { toJSON: () => ({ type: "doc", content: [] }) } } } },
    state: { type: "doc", content: [] },
    onChange: () => {},
  });
  return { Remirror, EditorComponent, useRemirror };
});

vi.mock("prosemirror-state", () => ({
  TextSelection: { atEnd: () => ({}) },
}));

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
    Trash: Stub,
    Trash2: Stub,
  };
});

// Mock internal UI not relevant for this test
vi.mock("../components/remirror-editor/components/EditorToolbar.tsx", () => ({ EditorToolbar: () => null }));
vi.mock("../hooks/use-flush-subscription.ts", () => ({ useSectionFlushSubscription: (_opts: unknown) => { /* noop */ } }));
vi.mock("../components/cv-editor/BlockRenderer.tsx", () => ({ default: () => null }));

// Mock CvLibraryContext for ProfileModal usage
const updateStructuredItemMock = vi.fn();
vi.mock("../contexts/CvLibraryContext", async () => {
  const actual: any = await vi.importActual("../contexts/CvLibraryContext");
  return {
    ...actual,
    useCvLibrary: () => ({
      updateStructuredItem: updateStructuredItemMock,
      // the rest of the API is not used by ProfileModal; provide safe no-ops
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
import type { CvSection, IProfileItem } from "../types/cvDocument";

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

describe("Profile section - collapsed card and modal save", () => {
  it("renders collapsed profile chips and opens modal", async () => {
    const item: IProfileItem = {
      id: "p1",
      name: "Jane Doe",
      desiredPosition: "Frontend Engineer",
      email: "jane@example.com",
      phone: "+12345678",
      linkedin: "https://linkedin.com/in/jane",
      website: "https://jane.dev",
      location: "Paris, FR",
      photoUrl: "",
    };

    const section: CvSection = {
      id: "sec-profile",
      title: "Profile",
      type: "profile",
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
        collapsed={false}
      />
    );

    const bodyTxt = (document.body.textContent ?? "").replace(/\s+/g, " ");
    expect(bodyTxt).toContain("Jane Doe");
    expect(bodyTxt).toContain("Frontend Engineer");
    expect(bodyTxt).toContain("jane@example.com");
    expect(bodyTxt).toContain("+12345678");
    expect(bodyTxt).toContain("linkedin.com");
    expect(bodyTxt).toContain("jane.dev");
    expect(bodyTxt).toContain("Paris, FR");

    const editBtn = queryButtonByAriaLabel("Edit profile") ?? queryButtonByText("Edit");
    expect(editBtn).toBeTruthy();

    await act(async () => {
      editBtn?.click();
      await Promise.resolve();
    });

    // Modal should now be present; fill in fields and save
    const nameInput = document.getElementById("name") as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    if (nameInput) {
      await act(async () => {
        nameInput.value = "Jane A. Doe";
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        nameInput.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
      });
    }

    const desiredInput = document.getElementById("desiredPosition") as HTMLInputElement | null;
    expect(desiredInput).toBeTruthy();
    if (desiredInput) {
      await act(async () => {
        desiredInput.value = "Senior Frontend Engineer";
        desiredInput.dispatchEvent(new Event("input", { bubbles: true }));
        desiredInput.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
      });
    }

    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    expect(emailInput).toBeTruthy();
    if (emailInput) {
      await act(async () => {
        emailInput.value = "jane.a.doe@example.com";
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
      });
    }

    const saveBtn = queryButtonByText("Save");
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn?.click();
      await Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, 0));

    // Ensure context was called (integration wiring)
    expect(updateStructuredItemMock).toHaveBeenCalled();
    const [calledSectionId, calledItemId] = updateStructuredItemMock.mock.calls.at(-1) as [string, string, Partial<IProfileItem>];
    expect(calledSectionId).toBe("sec-profile");
    expect(calledItemId).toBe("p1");

    unmount();
  });
});
