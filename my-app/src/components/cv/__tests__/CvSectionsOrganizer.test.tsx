import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CvSectionsOrganizer from "../CvSectionsOrganizer";
import type { CvSection } from "../../../types/cvDocument";

const sortableContextMock = vi.hoisted(() => vi.fn());
const dragOverlayMock = vi.hoisted(() => vi.fn());
const useSortableMock = vi.hoisted(() =>
  vi.fn((options: { id: string }) => ({
    attributes: { "data-dnd-attribute": "true" },
    listeners: { "data-dnd-listener": "true" },
    setNodeRef: vi.fn(),
    transform:
      options.id === "experience"
        ? { x: 0, y: 14, scaleX: 1, scaleY: 1 }
        : null,
    transition:
      options.id === "experience"
        ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
        : undefined,
    isDragging: false,
  })),
);

vi.mock("@dnd-kit/core", async () => {
  const ReactModule = await import("react");
  return {
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
    }: {
      children: ReactModule.ReactNode;
      onDragStart: (event: { active: { id: string } }) => void;
      onDragOver: (event: { over: { id: string } | null }) => void;
      onDragEnd: (event: {
        active: { id: string };
        over: { id: string } | null;
      }) => void;
    }) => (
      <div>
        <button
          type="button"
          aria-label="Simulate reorder"
          onClick={() =>
            onDragEnd({
              active: { id: "summary" },
              over: { id: "experience" },
            })
          }
        />
        <button
          type="button"
          aria-label="Simulate active drag"
          onClick={() => {
            onDragStart({ active: { id: "summary" } });
            onDragOver({ over: { id: "experience" } });
          }}
        />
        {children}
      </div>
    ),
    DragOverlay: ({
      children,
      dropAnimation,
    }: {
      children: ReactModule.ReactNode;
      dropAnimation?: unknown;
    }) => {
      dragOverlayMock({ dropAnimation });
      return <>{children}</>;
    },
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    closestCenter: vi.fn(),
    useSensor: vi.fn((sensor, options) => ({ sensor, options })),
    useSensors: vi.fn((...sensors) => sensors),
  };
});

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: string[];
  }) => {
    sortableContextMock(items);
    return <>{children}</>;
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: useSortableMock,
  verticalListSortingStrategy: {},
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: (transform: { x: number; y: number } | null) =>
        transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    },
  },
}));

function makeSection(
  id: string,
  type: string,
  title: string,
  structuredContent: unknown[] = [{}],
): CvSection {
  return {
    id,
    type,
    title,
    blocks: [],
    structuredContent,
  } as CvSection;
}

function renderOrganizer(overrides: Partial<React.ComponentProps<typeof CvSectionsOrganizer>> = {}) {
  const props: React.ComponentProps<typeof CvSectionsOrganizer> = {
    sections: [
      makeSection("summary", "summary", "Summary"),
      makeSection("experience", "experience", "Experience", [{}, {}]),
      makeSection("skills", "skills", "Skills"),
    ],
    hiddenSectionIds: ["skills"],
    activeSectionId: "summary",
    selectedTone: "warm",
    onSelectSection: vi.fn(),
    onToggleHiddenSection: vi.fn(),
    onDeleteSection: vi.fn(),
    onReorderSections: vi.fn(),
    onMoveSection: vi.fn(),
    onAskAiForSection: vi.fn(),
    onRunAskAiForSection: vi.fn(async () => undefined),
    onAddSection: vi.fn(),
    ...overrides,
  };

  render(<CvSectionsOrganizer {...props} />);
  return props;
}

describe("CvSectionsOrganizer", () => {
  beforeEach(() => {
    sortableContextMock.mockClear();
    dragOverlayMock.mockClear();
    useSortableMock.mockClear();
  });

  it("renders section rows with active and hidden state", () => {
    renderOrganizer();

    expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Experience" })).toHaveAttribute(
      "data-dnd-listener",
      "true",
    );
    expect(screen.getByRole("button", { name: "Experience 2 items" })).toHaveAttribute(
      "data-dnd-listener",
      "true",
    );
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skills hidden" })).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });

  it("keeps SortableContext items aligned with rendered section row order", () => {
    renderOrganizer();

    const renderedRows = Array.from(
      document.querySelectorAll(".dasti-cv-org-row"),
    ).map((row) => ({
      title: row.querySelector(".dasti-cv-org-row__title")?.textContent,
      count: row.querySelector(".dasti-cv-org-row__count")?.textContent,
    }));

    expect(renderedRows).toEqual([
      { title: "Summary", count: "" },
      { title: "Experience", count: "2 items" },
      { title: "Skills", count: "hidden" },
    ]);
    expect(sortableContextMock).toHaveBeenLastCalledWith([
      "summary",
      "experience",
      "skills",
    ]);
  });

  it("disables DragOverlay drop animation so release does not return to source", () => {
    renderOrganizer();

    expect(dragOverlayMock).toHaveBeenLastCalledWith({ dropAnimation: null });
  });

  it("suppresses sortable row transforms during active drag to avoid live reflow", async () => {
    const user = userEvent.setup();
    renderOrganizer();

    const experienceRow = screen
      .getByRole("button", { name: "Experience 2 items" })
      .closest(".dasti-cv-org-row");

    expect(experienceRow).toHaveStyle({
      transform: "translate3d(0px, 14px, 0)",
    });

    await user.click(screen.getByRole("button", { name: "Simulate active drag" }));

    expect(experienceRow).not.toHaveAttribute(
      "style",
      expect.stringContaining("translate3d(0px, 14px, 0)"),
    );
    expect(experienceRow).toHaveAttribute("data-drop-indicator", "after");
  });

  it("fires move, toggle, delete, add, ask, and reorder callbacks", async () => {
    const user = userEvent.setup();
    const props = renderOrganizer();

    fireEvent.keyDown(screen.getByRole("button", { name: "Experience 2 items" }), {
      key: "ArrowDown",
    });
    expect(props.onMoveSection).toHaveBeenCalledWith("experience", 1);

    await user.click(screen.getByRole("button", { name: "Hide Summary" }));
    expect(props.onToggleHiddenSection).toHaveBeenCalledWith("summary");

    await user.click(screen.getByRole("button", { name: "Delete Skills" }));
    expect(props.onDeleteSection).toHaveBeenCalledWith("skills");

    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));
    expect(props.onAskAiForSection).toHaveBeenCalledWith("summary");
    expect(props.onRunAskAiForSection).toHaveBeenCalledWith({
      sectionId: "summary",
      prompt: "",
      tone: "warm",
    });

    await user.click(screen.getByRole("button", { name: "Simulate reorder" }));
    expect(props.onReorderSections).toHaveBeenCalledWith("summary", "experience");

    await user.click(screen.getByRole("button", { name: "Add section" }));
    await user.click(await screen.findByRole("menuitem", { name: "Custom section" }));
    await waitFor(() => expect(props.onAddSection).toHaveBeenCalledWith("custom"));
  });
});
