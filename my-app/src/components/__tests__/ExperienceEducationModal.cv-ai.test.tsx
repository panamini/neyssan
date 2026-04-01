import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExperienceModal } from "../structured-blocks/ExperienceEducationModal";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import type { RemirrorJSON } from "remirror";

const {
  mockRunCvSectionAiAction,
  mockTransformEditorSelection,
  mockConvexQuery,
  mockGeneratedApiModule,
} = vi.hoisted(() => ({
  mockRunCvSectionAiAction: vi.fn(),
  mockTransformEditorSelection: vi.fn(),
  mockConvexQuery: vi.fn().mockResolvedValue({
    version: "test",
    supportedActions: ["improve_experience_responsibilities"],
  }),
  mockGeneratedApiModule: {
    api: {
      functions: {
        runCvSectionAiAction: "runCvSectionAiAction",
        transformEditorSelection: "transformEditorSelection",
        getCvAiCapabilities: "getCvAiCapabilities",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (target: unknown) => {
    if (target === mockGeneratedApiModule.api.functions.runCvSectionAiAction) {
      return mockRunCvSectionAiAction;
    }

    if (
      target === mockGeneratedApiModule.api.functions.transformEditorSelection
    ) {
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
vi.mock("../../hooks/use-cv-ai-capabilities", () => ({
  useCvAiCapabilities: () => ({
    status: "ready",
    version: "test",
    supportedActions: ["improve_experience_responsibilities"],
    isSupported: (actionId: string) =>
      actionId === "improve_experience_responsibilities",
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
    useRemirror: ({
      content,
    }: {
      content?: RemirrorJSON;
    }) => {
      const docRef = ReactModule.useRef<RemirrorJSON>(
        (content as RemirrorJSON | undefined) ??
          ({
            type: "doc",
            content: [],
          } as RemirrorJSON),
      );
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
  };
});

vi.mock("../remirror-editor/components/EditorToolbar", () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}));

describe("ExperienceModal CV AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies an accepted AI responsibilities diff before save", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["Reduced incident response times.", "Standardized patrol logs."],
    });

    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-1",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc("Old responsibility"),
            responsibilityBullets: ["Old responsibility"],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );

    await screen.findByText("Entry 1 suggestion");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "exp-1",
          responsibilityBullets: [
            "Reduced incident response times.",
            "Standardized patrol logs.",
          ],
          achievements: [],
          responsibilities: expect.objectContaining({
            type: "doc",
          }),
        }),
      ]),
    );

    expect(JSON.stringify(onSave.mock.calls[0]?.[0][0]?.responsibilities)).toContain(
      "Reduced incident response times.",
    );
  });
});
