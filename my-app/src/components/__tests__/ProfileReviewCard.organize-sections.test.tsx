import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";
import { applyHiddenSectionsToCvDocument } from "../../lib/cv-section-organization";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import type { CvDocument, CvSection } from "../../types/cvDocument";

const {
  libraryStore,
  reorderSectionsMock,
  importCvMock,
} = vi.hoisted(() => ({
  libraryStore: {
    currentCv: null as CvDocument | null,
    listeners: new Set<() => void>(),
  },
  reorderSectionsMock: vi.fn(),
  importCvMock: vi.fn(),
}));

function emitLibraryChange() {
  libraryStore.listeners.forEach((listener) => listener());
}

function setCurrentCv(document: CvDocument | null) {
  libraryStore.currentCv = document;
  emitLibraryChange();
}

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../contexts/CvLibraryContext", async () => {
  const ReactModule = await import("react");

  return {
    useCvLibrary: () => {
      const currentCv = ReactModule.useSyncExternalStore(
        (listener) => {
          libraryStore.listeners.add(listener);
          return () => {
            libraryStore.listeners.delete(listener);
          };
        },
        () => libraryStore.currentCv,
        () => libraryStore.currentCv,
      );

      return {
        currentCv,
        currentCvId: currentCv?.id ?? null,
        loadCv: vi.fn(),
        isLoading: false,
        isLibraryHydrated: true,
        reorderSections: (sections: CvSection[]) => {
          reorderSectionsMock(sections);
          if (!currentCv) {
            return;
          }
          setCurrentCv({
            ...currentCv,
            sections,
          });
        },
        addSection: vi.fn(),
        createNewCv: vi.fn(async () => {}),
        importCv: async (document: CvDocument) => {
          importCvMock(document);
          setCurrentCv(document);
        },
        closeInspector: vi.fn(),
        renameCv: vi.fn(),
        registerBlockFlushCallback: () => () => {},
        isV1Active: true,
      };
    },
  };
});

vi.mock("../cv-editor/Section", () => ({
  default: ({
    section,
  }: {
    section: CvSection;
  }) => (
    <section data-testid={`editor-section-${String(section.id ?? "")}`}>
      Editor section: {section.title}
    </section>
  ),
}));

vi.mock("../SelectedBlockInspector", () => ({
  default: () => null,
}));

vi.mock("../StructuredUploadButton", () => ({
  default: () => <button type="button">Import resume</button>,
}));

vi.mock("../ImportWarningBanner", () => ({
  default: () => null,
}));

vi.mock("../CvRenameDialog", () => ({
  default: () => null,
}));

vi.mock("../ImportRecoveryPanel", () => ({
  default: () => null,
}));

vi.mock("../ResumeExportControl", () => ({
  default: () => null,
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragCancel,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragStart?: (event: { active: { id: string } }) => void;
    onDragCancel?: () => void;
    onDragEnd?: (event: { active: { id: string }; over: { id: string } }) => void;
  }) => (
    <div data-testid="mock-dnd-context">
      <button
        type="button"
        onClick={() =>
          onDragStart?.({
            active: { id: "skills-section" },
          })
        }
      >
        Trigger drag start
      </button>
      <button type="button" onClick={() => onDragCancel?.()}>
        Trigger drag cancel
      </button>
      <button
        type="button"
        onClick={() =>
          onDragEnd?.({
            active: { id: "skills-section" },
            over: { id: "experience-section" },
          })
        }
      >
        Trigger drag reorder
      </button>
      {children}
    </div>
  ),
  DragOverlay: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-drag-overlay">{children}</div>
  ),
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: (items: unknown[], from: number, to: number) => {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(from, 1);
    nextItems.splice(to, 0, movedItem);
    return nextItems;
  },
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => undefined,
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

function buildTestCv(): CvDocument {
  return {
    id: "cv-organize",
    title: "Organize CV",
    metadata: {
      createdAt: "2026-04-22T09:00:00.000Z",
      updatedAt: "2026-04-22T09:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "profile-section",
        title: "Profile",
        type: "profile",
        blocks: [],
        structuredContent: [
          {
            id: "profile-item",
            name: "Jane Doe",
            email: "jane@example.com",
          },
        ],
      },
      {
        id: "summary-section",
        title: "Summary",
        type: "summary",
        blocks: [],
        structuredContent: [
          {
            id: "summary-item",
            summary: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Concise summary" }],
                },
              ],
            },
          },
        ],
      },
      {
        id: "experience-section",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            id: "experience-item",
            company: "Acme",
            position: "Product Manager",
            startDate: "2022-01-01T00:00:00.000Z",
            endDate: null,
            isCurrent: true,
            responsibilities: "Owned roadmap delivery.",
            achievements: [],
          },
        ],
      },
      {
        id: "skills-section",
        title: "Skills",
        type: "skills",
        blocks: [],
        structuredContent: [
          {
            id: "skill-item",
            name: "Strategy",
            level: "Advanced",
          },
        ],
      },
      {
        id: "languages-section",
        title: "Languages",
        type: "languages",
        blocks: [],
        structuredContent: [
          {
            id: "language-item",
            name: "French",
            level: "Fluent",
          },
        ],
      },
      {
        id: "additional-info-section",
        title: "Additional Information",
        type: "text",
        blocks: [
          {
            id: "additional-info-block",
            type: "text",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Available to relocate." }],
                },
              ],
            },
            plainText: "Available to relocate.",
          },
        ],
        structuredContent: null,
      },
    ],
  };
}

function PreviewMirror({
  hiddenSectionIds,
}: {
  hiddenSectionIds: string[];
}) {
  const { currentCv } = useCvLibrary();
  const previewDocument = applyHiddenSectionsToCvDocument(
    currentCv as CvDocument | null,
    hiddenSectionIds,
  );

  const orderedTitles = (previewDocument?.sections ?? [])
    .map((section) => String(section.title ?? ""))
    .join(" > ");
  const additionalInformationText = String(
    previewDocument?.sections.find(
      (section) => String(section.id ?? "") === "additional-info-section",
    )?.blocks?.[0]?.plainText ?? "",
  );
  const summaryText = String(
    previewDocument?.sections.find(
      (section) => String(section.id ?? "") === "summary-section",
    )?.structuredContent?.[0]?.summary?.content?.[0]?.content?.[0]?.text ?? "",
  );

  return (
    <div>
      <div data-testid="preview-order">{orderedTitles}</div>
      <div data-testid="preview-has-languages">
        {orderedTitles.includes("Languages") ? "visible" : "hidden"}
      </div>
      <div data-testid="preview-additional-info">{additionalInformationText}</div>
      <div data-testid="preview-summary">{summaryText}</div>
    </div>
  );
}

function OrganizeSectionsHarness() {
  const [hiddenSectionIds, setHiddenSectionIds] = React.useState<string[]>([]);

  return (
    <>
      <ProfileReviewCard
        hiddenSectionIds={hiddenSectionIds}
        onHiddenSectionIdsChange={setHiddenSectionIds}
      />
      <PreviewMirror hiddenSectionIds={hiddenSectionIds} />
    </>
  );
}

function getActionLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button"), (button) =>
    button.getAttribute("aria-label"),
  );
}

describe("ProfileReviewCard organize sections", () => {
  beforeEach(() => {
    reorderSectionsMock.mockReset();
    importCvMock.mockReset();
    libraryStore.listeners.clear();
    libraryStore.currentCv = buildTestCv();
    window.sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("min-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("toggles organize mode on and off and restores the normal editor presentation", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    expect(screen.getByText("Editor section: Experience")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    expect(
      screen.getByRole("region", { name: "Organize top-level sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Organize sections" }),
    ).toHaveAttribute("data-toolbar-tooltip", "MOVE. HIDE.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Editor section: Experience")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    expect(screen.getByText("Editor section: Experience")).toBeInTheDocument();
  });

  it("renders inline organize rows with the normal section-header title contract and keeps hidden sections listed", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    expect(
      screen.getByTestId("organize-section-row-profile-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("organize-section-row-languages-section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("organize-sections-region")).toHaveClass(
      "cv-organize-sections-region",
    );
    expect(screen.getByTestId("organize-sections-region")).not.toHaveClass(
      "cv-organize-sections",
    );
    expect(document.querySelector(".cv-organize-sections__header")).toBeNull();
    expect(
      screen.queryByText(/Reorder and hide top-level sections here/i),
    ).toBeNull();

    expect(
      screen.queryByTestId("organize-section-drag-handle-profile-section"),
    ).toBeNull();
    const profileActions = screen.getByTestId(
      "organize-section-actions-profile-section",
    );
    expect(profileActions).toBeInTheDocument();
    expect(getActionLabels(profileActions)).toEqual([]);
    expect(
      within(
        screen.getByTestId("organize-section-row-profile-section"),
      ).queryByRole("button", {
        name: "Hide Profile section",
      }),
    ).toBeNull();
    expect(
      within(
        screen.getByTestId("organize-section-row-profile-section"),
      ).queryByRole("button", {
        name: "Show Profile section",
      }),
    ).toBeNull();
    expect(
      within(
        screen.getByTestId("organize-section-row-profile-section"),
      ).queryByRole("button", {
        name: "Move Profile section up",
      }),
    ).toBeNull();
    expect(
      within(
        screen.getByTestId("organize-section-row-profile-section"),
      ).queryByRole("button", {
        name: "Move Profile section down",
      }),
    ).toBeNull();
    expect(
      within(
        screen.getByTestId("organize-section-row-profile-section"),
      ).queryByRole("button", {
        name: "Delete Profile section",
      }),
    ).toBeNull();
    expect(
      screen.queryByTestId("organize-section-drag-handle-summary-section"),
    ).toBeNull();
    const summaryRow = screen.getByTestId("organize-section-row-summary-section");
    const summaryActions = within(summaryRow).getByTestId(
      "organize-section-actions-summary-section",
    );
    expect(getActionLabels(summaryActions)).toEqual(["Hide Summary section"]);
    expect(
      within(summaryActions).getByRole("button", {
        name: "Hide Summary section",
      }),
    ).toHaveAttribute("data-visibility-state", "shown");
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Move Summary section up",
      }),
    ).toBeNull();
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Move Summary section down",
      }),
    ).toBeNull();
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Delete Summary section",
      }),
    ).toBeNull();
    expect(
      screen.getByTestId("organize-section-drag-handle-experience-section"),
    ).toBeInTheDocument();

    const languagesRow = screen.getByTestId(
      "organize-section-row-languages-section",
    );
    const languagesTitle = within(languagesRow).getByTestId(
      "organize-section-title-languages-section",
    );
    const languagesMetaRow = within(languagesRow).getByTestId(
      "organize-section-meta-languages-section",
    );
    const languagesActions = within(languagesRow).getByTestId(
      "organize-section-actions-languages-section",
    );
    expect(Array.from(languagesRow.children)).toHaveLength(4);
    expect(languagesRow.children[2]).toBe(languagesMetaRow);
    expect(languagesRow.children[3]).toBe(languagesActions);
    expect(languagesRow).toHaveClass("section-container-header");
    expect(languagesTitle).toHaveClass("cv-section-heading");
    expect(
      within(languagesRow).getByTestId("organize-section-primary-languages-section"),
    ).toContainElement(languagesTitle);
    expect(languagesRow.closest(".section-container")).not.toBeNull();
    expect(languagesMetaRow).toBeInTheDocument();
    expect(within(languagesRow).getAllByText("Languages")).toHaveLength(1);
    expect(
      languagesRow.querySelector(".cv-organize-section-card__controls"),
    ).toBeNull();
    expect(
      languagesRow.querySelector(".cv-organize-section-card__subtitle"),
    ).toBeNull();
    expect(languagesRow.querySelector(".cv-organize-section-row__body")).toBeNull();
    expect(languagesRow.querySelector(".cv-organize-section-row__footer")).toBeNull();
    expect(languagesActions).toBeInTheDocument();
    expect(languagesRow.children[0]).toContainElement(
      screen.getByTestId("organize-section-drag-handle-languages-section"),
    );
    expect(getActionLabels(languagesActions)).toEqual([
      "Move Languages section up",
      "Move Languages section down",
      "Hide Languages section",
    ]);

    await user.click(
      within(languagesRow).getByRole("button", {
        name: "Hide Languages section",
      }),
    );

    expect(languagesRow).toHaveAttribute("data-section-hidden", "true");
    expect(within(languagesRow).queryByText("Hidden")).not.toBeInTheDocument();
    expect(getActionLabels(languagesActions)).toEqual([
      "Delete Languages section",
      "Show Languages section",
    ]);
    expect(
      within(languagesActions).getByRole("button", {
        name: "Show Languages section",
      }),
    ).toHaveAttribute("data-visibility-state", "hidden");
    expect(
      within(languagesRow).queryByRole("button", {
        name: "Drag Languages section",
      }),
    ).toBeNull();
    expect(
      within(languagesRow).queryByRole("button", {
        name: "Move Languages section up",
      }),
    ).toBeNull();
    expect(
      within(languagesRow).queryByRole("button", {
        name: "Move Languages section down",
      }),
    ).toBeNull();
  });

  it("keeps metadata deterministic and does not add a hidden capsule", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const profileMetaRow = screen.getByTestId(
      "organize-section-meta-profile-section",
    );
    expect(
      Array.from(profileMetaRow.querySelectorAll(".dasti-pill"), (pill) =>
        pill.textContent?.trim(),
      ),
    ).toEqual(["Always shown"]);

    const summaryRow = screen.getByTestId("organize-section-row-summary-section");
    const summaryMetaRow = within(summaryRow).getByTestId(
      "organize-section-meta-summary-section",
    );

    await user.click(
      within(summaryRow).getByRole("button", {
        name: "Hide Summary section",
      }),
    );

    expect(
      Array.from(summaryMetaRow.querySelectorAll(".dasti-pill"), (pill) =>
        pill.textContent?.trim(),
      ),
    ).toEqual([]);
    expect(
      getActionLabels(
        within(summaryRow).getByTestId("organize-section-actions-summary-section"),
      ),
    ).toEqual(["Show Summary section"]);
    expect(within(summaryRow).queryByText("Hidden")).not.toBeInTheDocument();
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Delete Summary section",
      }),
    ).toBeNull();
  });

  it("supports move up, move down, boundary no-op behavior, and desktop drag reorder for top-level sections only", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const experienceRow = screen.getByTestId(
      "organize-section-row-experience-section",
    );
    expect(
      within(experienceRow).getByRole("button", {
        name: "Move Experience section up",
      }),
    ).toBeDisabled();

    const additionalInformationRow = screen.getByTestId(
      "organize-section-row-additional-info-section",
    );
    expect(
      within(additionalInformationRow).getByRole("button", {
        name: "Move Additional information section down",
      }),
    ).toBeDisabled();

    const skillsRow = screen.getByTestId("organize-section-row-skills-section");
    await user.click(
      within(skillsRow).getByRole("button", {
        name: "Move Skills section up",
      }),
    );

    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Summary > Skills > Experience",
    );
    expect(reorderSectionsMock).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Trigger drag reorder" }));

    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Summary > Experience > Skills",
    );
  });

  it("keeps drag inline and does not render the old duplicate floating overlay artifact", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));
    await user.click(screen.getByRole("button", { name: "Trigger drag start" }));

    expect(screen.getByTestId("organize-sections-region")).toHaveAttribute(
      "data-organize-drag-active",
      "true",
    );
    expect(
      screen.getByTestId("organize-section-item-skills-section"),
    ).toHaveAttribute("data-section-dragging", "true");
    expect(
      screen.getByTestId("organize-section-row-skills-section"),
    ).toHaveAttribute("data-section-dragging", "true");
    expect(screen.queryByTestId("mock-drag-overlay")).toBeNull();
    expect(
      screen.getAllByTestId("organize-section-row-skills-section"),
    ).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Trigger drag cancel" }));

    expect(screen.getByTestId("organize-sections-region")).toHaveAttribute(
      "data-organize-drag-active",
      "false",
    );
  });

  it("hides and shows sections non-destructively, updates the preview immediately, and preserves content across the toggle", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const additionalInformationRow = screen.getByTestId(
      "organize-section-row-additional-info-section",
    );
    await user.click(
      within(additionalInformationRow).getByRole("button", {
        name: "Hide Additional information section",
      }),
    );

    expect(screen.getByTestId("preview-order").textContent).not.toContain(
      "Additional Information",
    );
    expect(screen.getByTestId("preview-additional-info")).toHaveTextContent("");

    await user.click(
      within(additionalInformationRow).getByRole("button", {
        name: "Show Additional information section",
      }),
    );

    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Additional Information",
    );
    expect(screen.getByTestId("preview-additional-info")).toHaveTextContent(
      "Available to relocate.",
    );
  });

  it("renders summary preview content fully when visible and removes it entirely when hidden", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    expect(screen.getByTestId("preview-summary")).toHaveTextContent(
      "Concise summary",
    );

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const summaryRow = screen.getByTestId("organize-section-row-summary-section");
    await user.click(
      within(summaryRow).getByRole("button", {
        name: "Hide Summary section",
      }),
    );

    expect(screen.getByTestId("preview-summary")).toHaveTextContent("");
    expect(screen.getByTestId("preview-order").textContent).not.toContain(
      "Summary",
    );

    await user.click(
      within(summaryRow).getByRole("button", {
        name: "Show Summary section",
      }),
    );

    expect(screen.getByTestId("preview-summary")).toHaveTextContent(
      "Concise summary",
    );
  });

  it("keeps hidden sections recoverable across reorder, preserves hidden state when moved, and restores them at the new order position", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const languagesRow = screen.getByTestId(
      "organize-section-row-languages-section",
    );
    await user.click(
      within(languagesRow).getByRole("button", {
        name: "Hide Languages section",
      }),
    );

    expect(screen.getByTestId("preview-has-languages")).toHaveTextContent(
      "hidden",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Move Additional information section up",
      }),
    );

    expect(languagesRow).toHaveAttribute("data-section-hidden", "true");
    expect(screen.getByTestId("preview-has-languages")).toHaveTextContent(
      "hidden",
    );

    await user.click(
      within(languagesRow).getByRole("button", {
        name: "Show Languages section",
      }),
    );

    const previewOrder = screen.getByTestId("preview-order").textContent ?? "";
    expect(previewOrder).toContain(
      "Experience > Skills > Additional Information > Languages",
    );
  });

  it("does not expose delete on visible rows and only exposes it for hidden removable sections while keeping core rows non-deletable", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const languagesRow = screen.getByTestId(
      "organize-section-row-languages-section",
    );
    expect(
      within(languagesRow).queryByRole("button", {
        name: "Delete Languages section",
      }),
    ).toBeNull();

    await user.click(
      within(languagesRow).getByRole("button", {
        name: "Hide Languages section",
      }),
    );

    expect(
      within(languagesRow).getByRole("button", {
        name: "Delete Languages section",
      }),
    ).toBeInTheDocument();

    const summaryRow = screen.getByTestId("organize-section-row-summary-section");
    await user.click(
      within(summaryRow).getByRole("button", {
        name: "Hide Summary section",
      }),
    );
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Delete Summary section",
      }),
    ).toBeNull();
    expect(
      within(summaryRow).queryByRole("button", {
        name: "Move Summary section up",
      }),
    ).toBeNull();

    await user.click(
      within(languagesRow).getByRole("button", {
        name: "Delete Languages section",
      }),
    );

    expect(
      screen.queryByTestId("organize-section-row-languages-section"),
    ).toBeNull();
    expect(screen.getByTestId("preview-has-languages")).toHaveTextContent(
      "hidden",
    );
  });

  it("shows explicit non-drag controls without mobile drag handles when desktop drag is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    expect(
      screen.queryByTestId("organize-section-drag-handle-skills-section"),
    ).toBeNull();
    expect(
      screen.getByTestId("organize-section-actions-skills-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move Skills section up" }),
    ).toBeInTheDocument();
  });

  it("supports keyboard-first shortcuts for move, hide/show, and escape", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const resetButton = screen.getByRole("button", {
      name: "Reset order",
    });
    expect(
      resetButton.closest('[aria-label="Organize top-level sections"]'),
    ).toBeNull();
    await act(async () => {
      resetButton.focus();
    });
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Summary > Experience > Skills",
    );
    expect(screen.getByTestId("organize-sections-region")).toHaveAttribute(
      "data-active-section-id",
      "",
    );

    let skillsRow = screen.getByTestId("organize-section-row-skills-section");
    const hideSkillsButton = within(skillsRow).getByRole("button", {
      name: "Hide Skills section",
    });
    await act(async () => {
      hideSkillsButton.focus();
    });
    await waitFor(() => {
      expect(skillsRow).toHaveAttribute("data-section-active", "true");
      expect(screen.getByTestId("organize-sections-region")).toHaveAttribute(
        "data-active-section-id",
        "skills-section",
      );
    });

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Summary > Skills > Experience",
    );

    skillsRow = screen.getByTestId("organize-section-row-skills-section");
    await act(async () => {
      within(skillsRow)
        .getByRole("button", {
          name: "Move Skills section down",
        })
        .focus();
    });
    await waitFor(() => {
      expect(skillsRow).toHaveAttribute("data-section-active", "true");
    });
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(screen.getByTestId("preview-order").textContent).toContain(
      "Summary > Experience > Skills",
    );

    skillsRow = screen.getByTestId("organize-section-row-skills-section");
    await act(async () => {
      within(skillsRow)
        .getByRole("button", {
          name: "Hide Skills section",
        })
        .focus();
    });
    await user.keyboard("{Alt>}h{/Alt}");
    expect(skillsRow).toHaveAttribute("data-section-hidden", "true");
    expect(skillsRow).toHaveAttribute("data-section-active", "true");
    expect(screen.getByTestId("preview-order").textContent).not.toContain(
      "Skills",
    );

    skillsRow = screen.getByTestId("organize-section-row-skills-section");
    await act(async () => {
      within(skillsRow)
        .getByRole("button", {
          name: "Show Skills section",
        })
        .focus();
    });
    await waitFor(() => {
      expect(skillsRow).toHaveAttribute("data-section-active", "true");
    });
    await user.keyboard("{Alt>}h{/Alt}");
    expect(skillsRow).toHaveAttribute("data-section-hidden", "false");
    expect(screen.getByTestId("preview-order").textContent).toContain("Skills");

    await act(async () => {
      skillsRow.focus();
    });
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("region", { name: "Organize top-level sections" }),
    ).toBeNull();
    expect(screen.getByText("Editor section: Experience")).toBeInTheDocument();
  });

  it("normalizes all-caps organize titles to the normal editor title casing", async () => {
    const user = userEvent.setup();
    const document = buildTestCv();
    const additionalInformationSection = document.sections.find(
      (section) => String(section.id ?? "") === "additional-info-section",
    );
    if (additionalInformationSection) {
      additionalInformationSection.title = "ADDITIONAL INFORMATION";
    }
    setCurrentCv(document);

    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const title = screen.getByTestId(
      "organize-section-title-additional-info-section",
    );
    expect(title).toHaveTextContent("Additional information");
    expect(
      screen.getByRole("button", {
        name: "Hide Additional information section",
      }),
    ).toBeInTheDocument();
  });

  it("targets keyboard shortcuts only to the currently active organize row", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const languagesRow = screen.getByTestId(
      "organize-section-row-languages-section",
    );
    const skillsRow = screen.getByTestId("organize-section-row-skills-section");

    await act(async () => {
      within(languagesRow)
        .getByRole("button", {
          name: "Hide Languages section",
        })
        .focus();
    });
    await waitFor(() => {
      expect(languagesRow).toHaveAttribute("data-section-active", "true");
      expect(skillsRow).toHaveAttribute("data-section-active", "false");
    });

    await user.keyboard("{Alt>}h{/Alt}");
    expect(languagesRow).toHaveAttribute("data-section-hidden", "true");
    expect(skillsRow).toHaveAttribute("data-section-hidden", "false");
    expect(screen.getByTestId("preview-order").textContent).toContain("Skills");
  });

  it("resets to the recommended/default top-level order without unhiding sections", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));

    const achievementsFreePreviewOrder = screen.getByTestId("preview-order");
    const additionalInformationRow = screen.getByTestId(
      "organize-section-row-additional-info-section",
    );
    const skillsRow = screen.getByTestId("organize-section-row-skills-section");

    await user.click(
      within(additionalInformationRow).getByRole("button", {
        name: "Hide Additional information section",
      }),
    );
    await user.click(
      within(skillsRow).getByRole("button", {
        name: "Move Skills section up",
      }),
    );

    expect(achievementsFreePreviewOrder.textContent).toContain(
      "Summary > Skills > Experience",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reset order",
      }),
    );

    expect(achievementsFreePreviewOrder.textContent).toContain(
      "Summary > Experience > Skills > Languages",
    );
    expect(achievementsFreePreviewOrder.textContent).not.toContain(
      "Additional Information",
    );
  });

  it("resets to the shared canonical order used by organize mode recommendations", async () => {
    const user = userEvent.setup();
    const document = buildTestCv();
    document.sections = [
      document.sections[0]!,
      document.sections[1]!,
      {
        id: "skills-section-2",
        title: "Skills",
        type: "skills",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      {
        id: "projects-section-1",
        title: "Projects",
        type: "projects",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      document.sections[2]!,
      {
        id: "languages-section-2",
        title: "Languages",
        type: "languages",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      {
        id: "education-section-1",
        title: "Education",
        type: "education",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      {
        id: "certifications-section-1",
        title: "Certifications",
        type: "certifications",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      {
        id: "achievements-section-1",
        title: "Achievements",
        type: "achievements",
        blocks: [],
        structuredContent: [],
      } as CvSection,
      document.sections[5]!,
    ];
    setCurrentCv(document);

    render(<OrganizeSectionsHarness />);

    await user.click(screen.getByRole("button", { name: "Organize sections" }));
    await user.click(
      screen.getByRole("button", {
        name: "Reset order",
      }),
    );

    expect(screen.getByTestId("preview-order")).toHaveTextContent(
      "Profile > Summary > Experience > Achievements > Projects > Certifications > Skills > Education > Languages > Additional Information",
    );
  });

  it("uses the existing toolbar tooltip contract for the organize helper copy only while organize mode is active", async () => {
    const user = userEvent.setup();
    render(<OrganizeSectionsHarness />);

    const organizeButton = screen.getByRole("button", {
      name: "Organize sections",
    });
    expect(organizeButton).not.toHaveAttribute("data-toolbar-tooltip");

    await user.click(organizeButton);

    expect(organizeButton).toHaveAttribute("data-toolbar-tooltip", "MOVE. HIDE.");
    expect(organizeButton).not.toHaveClass("dasti-toolbar-tooltip-trigger--above");
    expect(
      organizeButton.closest(".dasti-toolbar--surface-tooltips"),
    ).not.toBeNull();

    await user.click(organizeButton);

    expect(organizeButton).not.toHaveAttribute("data-toolbar-tooltip");
  });
});
