import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionEditorSheet } from "../SectionEditorSheet";
import type { CvSection } from "../../../types/cvDocument";

function buildProfileSection(name: string, desiredPosition: string): CvSection {
  return {
    id: "profile",
    type: "profile",
    title: "Profile",
    blocks: [],
    structuredContent: [
      {
        id: "profile-item",
        name,
        desiredPosition,
      },
    ],
  } as CvSection;
}

describe("SectionEditorSheet", () => {
  it("refreshes profile fields when the selected CV changes but section ids are reused", () => {
    const { rerender } = render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Target Role")).toHaveValue("Product Designer");

    rerender(
      <SectionEditorSheet
        open
        section={buildProfileSection("Grace Hopper", "Engineering Manager")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Grace Hopper");
    expect(screen.getByLabelText("Target Role")).toHaveValue("Engineering Manager");
  });

  it("keeps Done as save-and-close for edited fields", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Byron" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        structuredContent: [
          expect.objectContaining({
            name: "Ada Byron",
            desiredPosition: "Product Designer",
          }),
        ],
      }),
    );
  });

  it("keeps overlay close as save-and-close for edited fields", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Byron" },
    });
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        structuredContent: [
          expect.objectContaining({
            name: "Ada Byron",
            desiredPosition: "Product Designer",
          }),
        ],
      }),
    );
  });

  it("keeps Escape close as save-and-close for edited fields", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Byron" },
    });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        structuredContent: [
          expect.objectContaining({
            name: "Ada Byron",
            desiredPosition: "Product Designer",
          }),
        ],
      }),
    );
  });

  it("does not render Save or the visible X close action", () => {
    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Close panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("keeps compact Done as save-and-close for edited fields", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Byron" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        structuredContent: [
          expect.objectContaining({
            name: "Ada Byron",
            desiredPosition: "Product Designer",
          }),
        ],
      }),
    );
  });

  it("keeps the 350ms autosave-on-field-edit behavior", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    try {
      render(
        <SectionEditorSheet
          open
          section={buildProfileSection("Ada Lovelace", "Product Designer")}
          onOpenChange={vi.fn()}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "Ada Byron" },
      });

      act(() => {
        vi.advanceTimersByTime(349);
      });
      expect(onSave).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: [
            expect.objectContaining({
              name: "Ada Byron",
              desiredPosition: "Product Designer",
            }),
          ],
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps revert behavior as a compact affordance without closing", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Byron" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Revert this section to when it was opened",
      }),
    );

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        structuredContent: [
          expect.objectContaining({
            name: "Ada Lovelace",
            desiredPosition: "Product Designer",
          }),
        ],
      }),
    );
  });

  it("uses island chrome without the old footer Cancel action", () => {
    render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(document.body.querySelector(".ds-island-panel")).toBeInTheDocument();
    const header = document.body.querySelector(".ds-island-panel__header");
    const body = document.body.querySelector(".ds-island-panel__body");
    expect(header).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(header?.parentElement).toBe(body?.parentElement);
    expect(header?.compareDocumentPosition(body!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(body?.contains(header)).toBe(false);
    expect(document.body.querySelector(".ds-sheet__footer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByText("Revert changes")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Revert this section to when it was opened",
      }),
    ).toHaveAttribute("title", "Revert changes");
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(
      document.body.querySelector(
        ".ds-island-panel__actions .ds-island-panel__action--discard",
      ),
    ).toBeInTheDocument();
    expect(
      document.body.querySelector(
        ".ds-island-panel__body > .ds-island-panel__action--discard",
      ),
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      "profile",
      buildProfileSection("Ada Lovelace", "Product Designer"),
      "Target Role",
    ],
    [
      "contact",
      {
        ...buildProfileSection("Ada Lovelace", "Product Designer"),
        id: "contact",
        type: "contact",
        title: "Contact",
      } as CvSection,
      "Email",
    ],
    [
      "summary",
      {
        id: "summary",
        type: "summary",
        title: "Summary",
        blocks: [{ id: "summary-block", type: "text", title: "Summary", content: "Builder." }],
        structuredContent: [{ id: "summary-item", summary: "Builder." }],
      } as CvSection,
      "Summary body",
    ],
    [
      "experience",
      {
        id: "experience",
        type: "experience",
        title: "Experience",
        blocks: [],
        structuredContent: [
          {
            id: "experience-1",
            company: "Analytical Engines",
            position: "Engineer",
            responsibilities: "Built useful machines.",
          },
        ],
      } as CvSection,
      "Role 1",
    ],
    [
      "education",
      {
        id: "education",
        type: "education",
        title: "Education",
        blocks: [],
        structuredContent: [
          {
            id: "education-1",
            degree: "MSc",
            institution: "London",
            fieldOfStudy: "Math",
          },
        ],
      } as CvSection,
      "Degree 1",
    ],
    [
      "projects",
      {
        id: "projects",
        type: "projects",
        title: "Projects",
        blocks: [],
        structuredContent: [
          {
            id: "project-1",
            title: "Compiler",
            meta: "TypeScript",
            description: "Built a compiler.",
          },
        ],
      } as CvSection,
      "Name 1",
    ],
    [
      "languages",
      {
        id: "languages",
        type: "languages",
        title: "Languages",
        blocks: [],
        structuredContent: [{ id: "language-1", name: "English", level: "Native" }],
      } as CvSection,
      "Language",
    ],
    [
      "hobbies",
      {
        id: "hobbies",
        type: "custom",
        title: "Hobbies",
        blocks: [],
        structuredContent: [{ id: "hobby-1", name: "Chess" }],
      } as CvSection,
      "Hobby",
    ],
    [
      "achievements",
      {
        id: "achievements",
        type: "achievements",
        title: "Achievements",
        blocks: [],
        structuredContent: [{ id: "achievement-1", text: "Shipped the system." }],
      } as CvSection,
      "Line 1",
    ],
    [
      "certifications",
      {
        id: "certifications",
        type: "certifications",
        title: "Certifications",
        blocks: [],
        structuredContent: [
          {
            id: "certification-1",
            certificationName: "AWS",
            issuingOrganization: "Amazon",
          },
        ],
      } as CvSection,
      "Name 1",
    ],
    [
      "custom text",
      {
        id: "custom",
        type: "custom",
        title: "Additional Information",
        blocks: [
          {
            id: "custom-block",
            type: "text",
            title: "Additional Information",
            content: "Open source work.",
            plainText: "Open source work.",
          },
        ],
        structuredContent: [],
      } as CvSection,
      "Body",
    ],
  ])("renders the %s editor body through the shared island shell", (_name, section, label) => {
    render(
      <SectionEditorSheet
        open
        section={section}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(document.body.querySelector(".ds-island-panel")).toBeInTheDocument();
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it("renders Skills through the unified skills and categories drawer", () => {
    render(
      <SectionEditorSheet
        open
        section={{
          id: "skills",
          type: "skills",
          title: "Skills",
          blocks: [],
          skillCategories: [{ id: "cat-product", label: "Product" }],
          structuredContent: [
            { id: "skill-1", name: "TypeScript", categoryId: "cat-product" },
          ],
        } as CvSection}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Manage skills & categories" }),
    ).toBeInTheDocument();
    expect(document.body.querySelector(".ds-island-panel")).toBeInTheDocument();
    expect(document.body.querySelector(".ds-sheet__footer")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rename Product" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Other Skills" })).toBeInTheDocument();
  });

  it("renders education AI fixing as a quiet entry helper", () => {
    render(
      <SectionEditorSheet
        open
        section={{
          id: "education",
          type: "education",
          title: "Education",
          blocks: [],
          structuredContent: [
            {
              id: "education-1",
              degree: "MSc",
              institution: "London",
              fieldOfStudy: "Math",
            },
          ],
        } as CvSection}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const fix = screen.getByRole("button", { name: "Fix education" });
    expect(fix).toHaveClass("dasti-cv-ai-helper-action");
    expect(screen.queryByText("Fix wording")).not.toBeInTheDocument();
  });

  it("keeps drawer list suggestions compact with one-click chips and clear all", () => {
    const onAcceptListAiSuggestion = vi.fn();
    const onDismissListAiSuggestion = vi.fn();
    const onClearListAiSuggestions = vi.fn();

    render(
      <SectionEditorSheet
        open
        section={{
          id: "skills",
          type: "skills",
          title: "Skills",
          blocks: [],
          structuredContent: [{ id: "skill-1", name: "TypeScript" }],
        } as CvSection}
        aiSuggestion={{
          kind: "list",
          sectionId: "skills",
          sectionLabel: "Skills",
          state: "ready",
          items: ["SIOP training", "Curriculum alignment"],
        }}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onRunListAiSuggestion={vi.fn()}
        onAcceptListAiSuggestion={onAcceptListAiSuggestion}
        onDismissListAiSuggestion={onDismissListAiSuggestion}
        onClearListAiSuggestions={onClearListAiSuggestions}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Manage skills & categories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh suggestions" })).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Add to Other Skills" })[0]!,
    );
    expect(onAcceptListAiSuggestion).toHaveBeenCalledWith("SIOP training", {
      persist: false,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
    expect(onDismissListAiSuggestion).toHaveBeenCalledWith("SIOP training");
    expect(onClearListAiSuggestions).not.toHaveBeenCalled();
  });
});
