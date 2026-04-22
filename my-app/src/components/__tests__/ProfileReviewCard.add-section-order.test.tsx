import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";
import type { CvDocument, CvSection } from "../../types/cvDocument";

const { libraryStore, reorderSectionsMock, importCvMock } = vi.hoisted(() => ({
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

function buildDocument(sections: CvSection[]): CvDocument {
  return {
    id: "cv-add-sections",
    title: "Add Sections CV",
    metadata: {
      createdAt: "2026-04-22T09:00:00.000Z",
      updatedAt: "2026-04-22T09:00:00.000Z",
      version: 1,
    },
    sections,
  };
}

function buildSection(id: string, type: string, title: string): CvSection {
  return {
    id,
    type,
    title,
    blocks: [],
    structuredContent: [],
  } as CvSection;
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
  default: ({ section }: { section: CvSection }) => (
    <section data-testid={`editor-section-${String(section.id ?? "")}`}>
      Editor section: {section.title}
    </section>
  ),
}));

vi.mock("../SelectedBlockInspector", () => ({
  default: () => null,
}));

vi.mock("../StructuredUploadButton", () => ({
  default: () => <button type="button">Import CV</button>,
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
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe("ProfileReviewCard add section order", () => {
  beforeEach(() => {
    reorderSectionsMock.mockReset();
    importCvMock.mockReset();
    libraryStore.listeners.clear();
    window.sessionStorage.clear();
  });

  it("lists add-section options in canonical order inside manage sections", async () => {
    const user = userEvent.setup();
    setCurrentCv(buildDocument([buildSection("profile", "profile", "Profile")]));

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Manage sections" }));

    const optionTitles = Array.from(
      document.querySelectorAll(".dasti-add-section-menu .dasti-menu-option__title"),
      (node) => node.textContent?.trim(),
    );

    expect(optionTitles).toEqual([
      "Achievements",
      "Projects",
      "Certifications",
      "Languages",
      "Affiliations",
      "Additional information",
      "Hobbies",
      "Add your own",
    ]);
  });

  it("preserves the existing add-section path for projects while inserting it canonically", async () => {
    const user = userEvent.setup();
    setCurrentCv(
      buildDocument([
        buildSection("profile", "profile", "Profile"),
        buildSection("experience", "experience", "Experience"),
        buildSection("skills", "skills", "Skills"),
      ]),
    );

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Manage sections" }));
    await user.click(screen.getByRole("button", { name: "Projects" }));

    await waitFor(() =>
      expect(reorderSectionsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "projects", title: "Projects" }),
        ]),
      ),
    );
    expect(reorderSectionsMock.mock.lastCall?.[0].map((section: CvSection) => section.title)).toEqual([
      "Profile",
      "Experience",
      "Projects",
      "Skills",
    ]);
  });

  it("inserts achievements directly below experience when added from manage sections", async () => {
    const user = userEvent.setup();
    setCurrentCv(
      buildDocument([
        buildSection("profile", "profile", "Profile"),
        buildSection("summary", "summary", "Summary"),
        buildSection("experience", "experience", "Experience"),
        buildSection("skills", "skills", "Skills"),
      ]),
    );

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Manage sections" }));
    await user.click(screen.getByRole("button", { name: "Achievements" }));

    await waitFor(() =>
      expect(reorderSectionsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: "Achievements", type: "achievements" }),
        ]),
      ),
    );
    expect(reorderSectionsMock.mock.lastCall?.[0].map((section: CvSection) => section.title)).toEqual([
      "Profile",
      "Summary",
      "Experience",
      "Achievements",
      "Skills",
    ]);
  });

  it("inserts additional information before hobbies when added from manage sections", async () => {
    const user = userEvent.setup();
    setCurrentCv(
      buildDocument([
        buildSection("profile", "profile", "Profile"),
        buildSection("summary", "summary", "Summary"),
        buildSection("experience", "experience", "Experience"),
        buildSection("languages", "languages", "Languages"),
        buildSection("hobbies", "text", "Hobbies"),
      ]),
    );

    render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Manage sections" }));
    await user.click(
      screen.getByRole("button", { name: /Additional information/i }),
    );

    await waitFor(() =>
      expect(reorderSectionsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Additional information",
            type: "text",
          }),
        ]),
      ),
    );
    expect(reorderSectionsMock.mock.lastCall?.[0].map((section: CvSection) => section.title)).toEqual([
      "Profile",
      "Summary",
      "Experience",
      "Languages",
      "Additional information",
      "Hobbies",
    ]);
  });
});
