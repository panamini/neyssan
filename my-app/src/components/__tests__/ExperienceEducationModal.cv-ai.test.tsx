import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  EducationModal,
  ExperienceModal,
  normalizeResponsibilityAiResultForSource,
} from "../structured-blocks/ExperienceEducationModal";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import type { RemirrorJSON } from "remirror";

function bulletListDoc(items: string[]): RemirrorJSON {
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((item) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: item }],
            },
          ],
        })),
      },
    ],
  } as RemirrorJSON;
}

function getBulletListTexts(doc: any): string[] {
  const list = doc?.content?.[0];
  if (list?.type !== "bulletList") return [];
  return (list.content ?? []).map(
    (item: any) => item?.content?.[0]?.content?.[0]?.text,
  );
}

const {
  mockRunCvSectionAiAction,
  mockTransformEditorSelection,
  mockConvexQuery,
  mockGeneratedApiModule,
  mockDomSelectionState,
  mockEditorSelectionState,
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
  mockDomSelectionState: {
    current: null as null | {
      text: string;
      anchor: {
        left: number;
        top: number;
        bottom: number;
        containerLeft?: number;
        containerRight?: number;
      };
    },
  },
  mockEditorSelectionState: {
    current: { empty: true, from: 1, to: 1 },
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

vi.mock("../../lib/editor-ai-selection", () => ({
  getDomSelectionState: () => mockDomSelectionState.current,
  isInlineAiToolbarActiveElement: () => false,
  isPrimaryPointerPressed: () => false,
}));

vi.mock("../FloatingAiToolbar", () => ({
  default: ({
    open,
    onRunAction,
  }: {
    open: boolean;
    onRunAction: (actionId: string, instruction: string) => void;
  }) =>
    open ? (
      <div role="toolbar" aria-label="Selected text actions">
        <button type="button" onClick={() => onRunAction("rewrite", "")}>
          Rewrite
        </button>
        <button type="button" onClick={() => onRunAction("shorten", "")}>
          Shorten
        </button>
      </div>
    ) : null,
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
            get selection() {
              return mockEditorSelectionState.current;
            },
            tr: {
              insertText: () => ({}),
            },
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
          hasFocus: () => false,
          updateState: vi.fn((nextState: { content?: RemirrorJSON }) => {
            if (nextState?.content) {
              docRef.current = nextState.content;
            }
          }),
        };
      }

      return {
        manager: {
          view: viewRef.current,
          createState: vi.fn((args?: { content?: RemirrorJSON }) => ({
            content: args?.content,
          })),
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
  useEditorFormattingActions: () => [],
}));

describe("ExperienceModal CV AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDomSelectionState.current = null;
    mockEditorSelectionState.current = { empty: true, from: 1, to: 1 };
  });

  it("does not save stale cached bullets when responsibilities are empty", async () => {
    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-stale",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(undefined),
            responsibilityBullets: ["Stale cached bullet"],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "exp-stale",
          responsibilities: undefined,
          responsibilityBullets: undefined,
        }),
      ]),
    );
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
            responsibilities: {
              type: "doc",
              content: [
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Old responsibility" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
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

  it("uses visible paragraph responsibilities as the current AI source", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["Coordinated executive protection coverage."],
    });

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-paragraph",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );

    await screen.findByText("Entry 1 suggestion");

    expect(mockRunCvSectionAiAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "improve_experience_responsibilities",
        outputShape: "paragraph",
        existingText: expect.stringContaining(
          "Protected VIP visitors during overnight events.",
        ),
      }),
    );
    expect(mockRunCvSectionAiAction.mock.calls[0]?.[0]?.existingText).not.toContain(
      "- Protected VIP visitors during overnight events.",
    );
    expect(screen.queryByText("No existing content.")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Protected VIP visitors during overnight events\./),
    ).toBeInTheDocument();
  });

  it("preserves paragraph shape when accepting the responsibilities wand", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["Protected VIP visitors during executive events."],
    });
    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-paragraph-wand",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
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

    const saved = onSave.mock.calls[0]?.[0][0];
    expect(saved?.responsibilityBullets).toBeUndefined();
    expect(saved?.responsibilities?.content?.map((node: any) => node.type)).toEqual([
      "paragraph",
    ]);
    expect(JSON.stringify(saved?.responsibilities)).toContain(
      "Protected VIP visitors during executive events.",
    );
  });

  it("preserves mixed paragraph and list shape when accepting the responsibilities wand", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Led safer operations.\n\n- Reduced incidents.\n- Standardized handoffs.",
    });
    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-mixed-wand",
            company: "Acme",
            position: "Operations Lead",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Led operations." }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            { type: "text", text: "Reduced incidents." },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            responsibilityBullets: ["Reduced incidents."],
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

    const saved = onSave.mock.calls[0]?.[0][0];
    expect(saved?.responsibilities?.content?.map((node: any) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect(saved?.responsibilityBullets).toEqual([
      "Reduced incidents.",
      "Standardized handoffs.",
    ]);
  });

  it("normalizes JSON-stringified responsibilities for AI source and save", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: ["Reduced incident volume further."],
    });

    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-json",
            company: "Acme",
            position: "Operations Lead",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: JSON.stringify([
              "Reduced incident volume.",
              "Standardized handoffs.",
            ]) as any,
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );

    await screen.findByText("Entry 1 suggestion");

    expect(mockRunCvSectionAiAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "improve_experience_responsibilities",
        existingText: expect.stringContaining("Reduced incident volume."),
      }),
    );
    expect(mockRunCvSectionAiAction.mock.calls[0]?.[0]?.existingText).not.toContain(
      '["Reduced incident volume.',
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const saved = onSave.mock.calls[0]?.[0][0];
    expect(saved?.responsibilityBullets).toEqual([
      "Reduced incident volume.",
      "Standardized handoffs.",
    ]);
    expect(JSON.stringify(saved?.responsibilities)).not.toContain(
      '["Reduced incident volume.',
    );
  });

  it("sanitizes paragraph Rewrite JSON arrays without rendering JSON syntax or changing shape", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Protected VIP visitors during events."),
      rawText: JSON.stringify([
        "Protected VIP visitors during executive events.",
      ]),
      requestedActionId: "rewrite",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected normalized result");
    expect(result.displayText).toBe(
      "Protected VIP visitors during executive events.",
    );
    expect(result.displayText).not.toMatch(/[\[\]",]/);
    expect(result.doc?.content?.map((node: any) => node.type)).toEqual([
      "paragraph",
    ]);
    expect(JSON.stringify(result.doc)).not.toContain(
      '["Protected VIP visitors',
    );
  });

  it("keeps paragraph responsibility wand output as a paragraph", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Protected VIP visitors during events."),
      rawItems: ["Protected VIP visitors during executive events."],
      requestedActionId: "improve_experience_responsibilities",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected normalized result");
    expect(result.doc?.content?.map((node: any) => node.type)).toEqual([
      "paragraph",
    ]);
    expect(JSON.stringify(result.doc)).toContain(
      "Protected VIP visitors during executive events.",
    );
  });

  it("keeps list Shorten output as separate list items", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First long point." }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Second long point." }],
                  },
                ],
              },
            ],
          },
        ],
      },
      rawText: "First short point.\nSecond short point.",
      requestedActionId: "shorten",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected normalized result");
    const list = result.doc?.content?.[0] as any;
    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(2);
    expect(list?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe(
      "First short point.",
    );
    expect(list?.content?.[1]?.content?.[0]?.content?.[0]?.text).toBe(
      "Second short point.",
    );
  });

  it("sanitizes list-backed wand JSON array fragments before display and apply", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "list",
      items: [
        '["Reduced incident response times.",',
        '"Standardized patrol logs."]',
      ],
    });
    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-list-json-wand",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: {
              type: "doc",
              content: [
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Old patrol work." }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            responsibilityBullets: ["Old patrol work."],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );

    const suggestion = await screen.findByRole("region", {
      name: "Entry 1 suggestion",
    });
    expect(within(suggestion).getByText(/Reduced incident response times\./)).toBeInTheDocument();
    expect(within(suggestion).getByText(/Standardized patrol logs\./)).toBeInTheDocument();
    expect(suggestion).not.toHaveTextContent(/\[/);
    expect(suggestion).not.toHaveTextContent(/\]/);
    expect(suggestion).not.toHaveTextContent(/"Reduced incident/);
    expect(suggestion).not.toHaveTextContent(/",/);

    fireEvent.click(within(suggestion).getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const saved = onSave.mock.calls[0]?.[0][0];
    const list = saved?.responsibilities?.content?.[0] as any;
    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(2);
    expect(list?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe(
      "Reduced incident response times.",
    );
    expect(list?.content?.[1]?.content?.[0]?.content?.[0]?.text).toBe(
      "Standardized patrol logs.",
    );
  });

  it("keeps list-backed toolbar Shorten in review flow and saves separate list items", async () => {
    const initialItems = [
      "Reduced incident volume across multiple sites.",
      "Standardized team handoffs for every shift.",
      "Coordinated lobby coverage during peak arrivals.",
      "Escalated access-control issues to site leadership.",
      "Maintained detailed patrol logs for compliance reviews.",
    ];
    const shortenedItems = [
      "Reduced incidents across sites.",
      "Standardized shift handoffs.",
      "Coordinated peak lobby coverage.",
      "Escalated access-control issues.",
      "Maintained compliance patrol logs.",
    ];
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      text: JSON.stringify(shortenedItems),
    });
    const onSave = vi.fn();

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        items={[
          {
            id: "exp-list-toolbar-shorten",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: bulletListDoc(initialItems),
            responsibilityBullets: initialItems,
            achievements: [],
          },
        ]}
      />,
    );

    mockDomSelectionState.current = {
      text: initialItems.map((item) => `- ${item}`).join("\n"),
      anchor: { left: 100, top: 100, bottom: 120 },
    };
    mockEditorSelectionState.current = { empty: false, from: 2, to: 90 };
    document.dispatchEvent(new Event("selectionchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Shorten" }));

    const suggestion = await screen.findByRole("region", {
      name: "Shorten suggestion",
    });
    expect(suggestion).toHaveTextContent("Reduced incidents across sites.");
    expect(screen.queryByRole("status", { name: "Applied. Undo" })).not.toBeInTheDocument();
    fireEvent.click(within(suggestion).getByRole("button", { name: "Accept" }));

    await screen.findByRole("status", { name: "Applied. Undo" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const saved = onSave.mock.calls[0]?.[0][0];
    expect(getBulletListTexts(saved?.responsibilities)).toEqual(shortenedItems);
    expect(saved?.responsibilityBullets).toEqual(shortenedItems);
    expect(saved?.responsibilities?.content?.map((node: any) => node.type)).not.toEqual([
      "paragraph",
    ]);
  });

  it("preserves mixed paragraph and list blocks when AI returns mixed text", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Led operations." }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Reduced incidents." }],
                  },
                ],
              },
            ],
          },
        ],
      },
      rawText: "Led safer operations.\n\n- Reduced incidents.\n- Standardized handoffs.",
      requestedActionId: "rewrite",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected normalized result");
    expect(result.doc?.content?.map((node: any) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect((result.doc?.content?.[1] as any)?.content).toHaveLength(2);
  });

  it("stores bullet-looking AI responsibility output as a durable Remirror list", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Led operations for the team."),
      rawText:
        "• Coordinated shift handoffs across three teams\n• Reduced reporting delays with a shared incident log",
      requestedActionId: "rewrite",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected normalized result");
    expect(result.doc?.content?.[0]?.type).toBe("bulletList");
    expect(result.responsibilityBullets).toEqual([
      "Coordinated shift handoffs across three teams",
      "Reduced reporting delays with a shared incident log",
    ]);
  });

  it("does not auto-apply truncated responsibility output", () => {
    const result = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Led targeted support for executives."),
      rawText: "Led targeted supports for E",
      requestedActionId: "shorten",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejected result");
    expect(result.reason).toBe("incomplete_output");
    expect(result.autoApply).toBe(false);
  });

  it("rejects incomplete prose before it can be marked applied", () => {
    const dangling = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Adapted lessons for student needs."),
      rawText: "Adapted lessons for",
      requestedActionId: "rewrite",
    });
    const midPhrase = normalizeResponsibilityAiResultForSource({
      source: ensureRemirrorDoc("Adapted classroom support for students."),
      rawText: "Adapted classroom support and adapted the general education",
      requestedActionId: "rewrite",
    });

    expect(dangling.ok).toBe(false);
    if (dangling.ok) throw new Error("expected dangling output rejection");
    expect(dangling.reason).toBe("incomplete_output");
    expect(dangling.autoApply).toBe(false);

    expect(midPhrase.ok).toBe(false);
    if (midPhrase.ok) throw new Error("expected mid-phrase output rejection");
    expect(midPhrase.reason).toBe("incomplete_output");
    expect(midPhrase.autoApply).toBe(false);
  });

  it("replaces a pending responsibilities wand card when toolbar Rewrite starts for the same entry", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Protected executives during overnight events.",
    });
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      text: "Protected executives during overnight events with clear handoffs.",
    });

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-stack",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );
    await screen.findByText("Entry 1 suggestion");

    mockDomSelectionState.current = {
      text: "Protected VIP visitors during overnight events.",
      anchor: { left: 100, top: 100, bottom: 120 },
    };
    mockEditorSelectionState.current = { empty: false, from: 1, to: 48 };
    document.dispatchEvent(new Event("selectionchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Rewrite" }));

    await screen.findByText("Rewrite suggestion");
    expect(screen.queryByText("Entry 1 suggestion")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /suggestion/i })).toHaveLength(1);
  });

  it("replaces a pending toolbar Rewrite card when the responsibilities wand starts", async () => {
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      text: "Protected executives during overnight events with clear handoffs.",
    });
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Protected executives and coordinated overnight handoffs.",
    });

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-wand-after-rewrite",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    mockDomSelectionState.current = {
      text: "Protected VIP visitors during overnight events.",
      anchor: { left: 100, top: 100, bottom: 120 },
    };
    mockEditorSelectionState.current = { empty: false, from: 1, to: 48 };
    document.dispatchEvent(new Event("selectionchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Rewrite" }));

    await screen.findByText("Rewrite suggestion");
    fireEvent.click(
      screen.getByRole("button", { name: /Improve responsibilities with AI/i }),
    );

    await screen.findByText("Entry 1 suggestion");
    expect(screen.queryByText("Rewrite suggestion")).not.toBeInTheDocument();
    expect(mockRunCvSectionAiAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("region", { name: /suggestion/i })).toHaveLength(1);
  });

  it("collapses accepted inline Shorten state to compact undo instead of a full Applied card", async () => {
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      text: "Protected executives.",
    });

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-compact-applied",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    mockDomSelectionState.current = {
      text: "Protected VIP visitors during overnight events.",
      anchor: { left: 100, top: 100, bottom: 120 },
    };
    mockEditorSelectionState.current = { empty: false, from: 1, to: 48 };
    document.dispatchEvent(new Event("selectionchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Shorten" }));

    const suggestion = await screen.findByRole("region", {
      name: "Shorten suggestion",
    });
    expect(screen.queryByRole("status", { name: "Applied. Undo" })).not.toBeInTheDocument();
    fireEvent.click(within(suggestion).getByRole("button", { name: "Accept" }));

    await screen.findByRole("status", { name: "Applied. Undo" });
    expect(screen.queryByRole("region", { name: "Shorten suggestion" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Applied. Undo" }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps responsibility suggestions scoped per entry", async () => {
    mockRunCvSectionAiAction
      .mockResolvedValueOnce({
        kind: "text",
        text: "Protected executives during overnight events.",
      })
      .mockResolvedValueOnce({
        kind: "text",
        text: "Coordinated lobby coverage during peak arrivals.",
      });

    render(
      <ExperienceModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-entry-one",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Protected VIP visitors during overnight events.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
          {
            id: "exp-entry-two",
            company: "Northline",
            position: "Front Desk Lead",
            startDate: "2024-01-01",
            endDate: null,
            responsibilities: ensureRemirrorDoc(
              "Coordinated lobby coverage during arrivals.",
            ),
            responsibilityBullets: [],
            achievements: [],
          },
        ]}
      />,
    );

    const entries = document.querySelectorAll("[data-entry-id]");
    fireEvent.click(
      within(entries[0] as HTMLElement).getByRole("button", {
        name: /Improve responsibilities with AI/i,
      }),
    );
    await screen.findByText("Entry 1 suggestion");

    fireEvent.click(
      within(entries[1] as HTMLElement).getByRole("button", {
        name: /Improve responsibilities with AI/i,
      }),
    );
    await screen.findByText("Entry 2 suggestion");

    expect(screen.getByText("Entry 1 suggestion")).toBeInTheDocument();
    expect(screen.getByText("Entry 2 suggestion")).toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /Entry \d suggestion/i })).toHaveLength(2);
  });

  it("keeps the targeted experience field focused while typing after preview open", async () => {
    vi.useFakeTimers();

    render(
      <ExperienceModal
        open
        initialItemId="exp-2"
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "exp-1",
            company: "Acme",
            position: "Security Officer",
            startDate: "2023-01-01",
            endDate: null,
            location: "Paris",
            responsibilities: ensureRemirrorDoc("Old responsibility"),
            responsibilityBullets: ["Old responsibility"],
            achievements: [],
          },
          {
            id: "exp-2",
            company: "Northline",
            position: "Lead",
            startDate: "2024-01-01",
            endDate: null,
            location: "Lille",
            responsibilities: ensureRemirrorDoc("Led operations"),
            responsibilityBullets: ["Led operations"],
            achievements: [],
          },
        ]}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    const row = document.querySelector('[data-entry-id="exp-2"]') as HTMLElement;
    const locationInput = within(row).getByLabelText("Location");

    locationInput.focus();
    expect(locationInput).toHaveFocus();
    fireEvent.change(locationInput, { target: { value: "Lyon" } });

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    expect(locationInput).toHaveFocus();
    vi.useRealTimers();
  });

  it("keeps the targeted education field focused while typing after preview open", async () => {
    vi.useFakeTimers();

    render(
      <EducationModal
        open
        initialItemId="edu-2"
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "edu-1",
            institution: "Sorbonne",
            degree: "BA",
            startDate: "2019-01-01",
            endDate: "2022-01-01",
          },
          {
            id: "edu-2",
            institution: "Sciences Po",
            degree: "MA",
            startDate: "2022-01-01",
            endDate: null,
            fieldOfStudy: "Policy",
          },
        ]}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    const row = document.querySelector('[data-entry-id="edu-2"]') as HTMLElement;
    const degreeInput = within(row).getByLabelText("Degree");

    degreeInput.focus();
    expect(degreeInput).toHaveFocus();
    fireEvent.change(degreeInput, { target: { value: "MBA" } });

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    expect(degreeInput).toHaveFocus();
    vi.useRealTimers();
  });
});
