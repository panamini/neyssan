import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SkillsDrawer } from "../structured-blocks/SkillsDrawer";

describe("SkillsDrawer", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders the unified skills and categories right sheet", () => {
    const onClose = vi.fn();

    render(
      <SkillsDrawer
        open
        onClose={onClose}
        items={[
          {
            id: "react",
            name: "React",
            level: "Advanced",
            categoryId: "cat-product",
          },
          {
            id: "postgres",
            name: "Postgres",
            level: "Intermediate",
            categoryId: "missing",
          },
        ]}
        categories={[{ id: "cat-product", label: "Product", source: "user" }]}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Manage skills & categories",
    });
    expect(dialog).toHaveClass("ds-island-panel");
    expect(
      document.body.querySelector(".ds-sheet__header"),
    ).not.toBeInTheDocument();
    expect(
      document.body.querySelector(".ds-sheet__footer"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add category" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Suggest skills" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Rename Product" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Other Skills" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag Product" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag React" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag Postgres" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Level for React" }).parentElement,
    ).toHaveClass("select-level");
    expect(screen.getByText("React")).toHaveClass(
      "dasti-skills-drawer__skill-name",
      "flex-grow",
      "w-auto",
      "overflow-hidden",
      "text-ellipsis",
    );
    expect(
      screen.getByText("React").closest(".dasti-skills-drawer__skill-row"),
    ).toHaveClass("justify-between");
    expect(
      screen
        .getByText("React")
        .closest(".dasti-skills-drawer__skill-row")
        ?.querySelector(".dasti-skills-drawer__actions-right"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("React")
        .closest(".dasti-skills-drawer__skill-row")
        ?.querySelector(".dasti-skills-drawer__action-spacer"),
    ).toBeInTheDocument();
    expect(
      document.body.querySelector('[data-skill-drop-group-id="cat-product"]'),
    ).toBeInTheDocument();
    expect(
      document.body.querySelector(
        '[data-skill-drop-group-id="__other_skills__"]',
      ),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds, focuses, renames, reorders, and deletes categories from the category header", async () => {
    const onApply = vi.fn();

    render(
      <SkillsDrawer
        open
        onClose={vi.fn()}
        onApply={onApply}
        categories={[
          { id: "cat-design", label: "Design", source: "user" },
          { id: "cat-data", label: "Data", source: "import" },
        ]}
        items={[
          {
            id: "react",
            name: "React",
            level: "Advanced",
            categoryId: "cat-design",
          },
          {
            id: "postgres",
            name: "Postgres",
            level: "Intermediate",
            categoryId: "cat-data",
          },
        ]}
      />,
    );

    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("New category")).toHaveFocus();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        categories: expect.arrayContaining([
          expect.objectContaining({ label: "New category", source: "user" }),
        ]),
      }),
      expect.any(Array),
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Rename Design" }), {
      target: { value: "Product Design" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Rename Design" }));
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        categories: expect.arrayContaining([
          expect.objectContaining({
            id: "cat-design",
            label: "Product Design",
          }),
        ]),
      }),
      expect.any(Array),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Down" })[0]!);
    const reorderPayload = onApply.mock.calls.at(-1)?.[0] as any;
    expect(reorderPayload.categories[0].id).toBe("cat-data");
    expect(reorderPayload.categories[1].id).toBe("cat-design");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!);
    const deletePayload = onApply.mock.calls.at(-1)?.[0] as any;
    expect(
      deletePayload.items.find((item: any) => item.id === "react"),
    ).not.toHaveProperty("categoryId");
    expect(
      deletePayload.items.find((item: any) => item.id === "postgres"),
    ).toEqual(expect.objectContaining({ categoryId: "cat-data" }));
    expect(
      deletePayload.categories.map((category: any) => category.id),
    ).not.toContain("cat-design");
    expect(screen.queryByText("Categories")).not.toBeInTheDocument();
  });

  it("moves skills between categories, Other Skills, and levels through row controls", () => {
    const onApply = vi.fn();

    render(
      <SkillsDrawer
        open
        onClose={vi.fn()}
        onApply={onApply}
        categories={[{ id: "cat-design", label: "Design", source: "user" }]}
        items={[
          {
            id: "react",
            name: "React",
            level: "Intermediate",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move React" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Design" }));
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ id: "react", categoryId: "cat-design" }),
        ],
      }),
      expect.any(Array),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move React" }));
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Other Skills" }),
    );
    const otherPayload = onApply.mock.calls.at(-1)?.[0] as any;
    expect(otherPayload.items[0]).not.toHaveProperty("categoryId");

    fireEvent.change(
      screen.getByRole("combobox", { name: "Level for React" }),
      {
        target: { value: "Advanced" },
      },
    );
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "react", level: "Advanced" })],
      }),
      expect.any(Array),
    );
  });

  it("accepts AI suggestions through one category dropdown per suggestion", () => {
    const onApply = vi.fn();
    const onAcceptAiSuggestion = vi.fn();

    render(
      <SkillsDrawer
        open
        onClose={vi.fn()}
        onApply={onApply}
        categories={[{ id: "cat-design", label: "Design", source: "user" }]}
        items={[]}
        aiSuggestions={["Research ops", "Figma"]}
        aiSuggestionsRequested
        onAcceptAiSuggestion={onAcceptAiSuggestion}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Add Research ops to category" }),
      { target: { value: "__other_skills__" } },
    );
    const otherPayload = onApply.mock.calls.at(-1)?.[0] as any;
    const otherSkill = otherPayload.items.find(
      (item: any) => item.name === "Research ops",
    );
    expect(otherSkill).toBeTruthy();
    expect(otherSkill).not.toHaveProperty("categoryId");
    expect(onAcceptAiSuggestion).toHaveBeenCalledWith("Research ops", null);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Add Figma to category" }),
      { target: { value: "cat-design" } },
    );
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Figma", categoryId: "cat-design" }),
        ]),
      }),
      expect.any(Array),
    );
    expect(onAcceptAiSuggestion).toHaveBeenLastCalledWith(
      "Figma",
      "cat-design",
    );
  });

  it("keeps level controls hidden unless a show-levels parent is active", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/product-cv.css"),
      "utf8",
    );

    expect(css).toContain(".dasti-skills-drawer .select-level");
    expect(css).toContain(".dasti-skills-drawer.show-levels .select-level");
    expect(css).toContain(".show-levels .dasti-skills-drawer .select-level");
    expect(css).toMatch(
      /\.dasti-skills-drawer\s+\.select-level\s*\{[\s\S]*display:\s*none;/,
    );
    expect(css).toMatch(
      /\.show-levels\s+\.dasti-skills-drawer\s+\.select-level\s*\{[\s\S]*display:\s*inline-flex;/,
    );
    expect(css).toContain(".dasti-skills-drawer__actions-right");
    expect(css).toContain(".dasti-skills-drawer__action-cell");
    expect(css).toContain(".dasti-skills-drawer__category-move-pair");
    expect(css).toContain(".dasti-skills-drawer__drag-overlay");
    expect(css).toContain("--dasti-skills-insert-gap");
    expect(css).toContain('[data-drop-indicator="before"]');
    expect(css).toContain('[data-drop-indicator="after"]');
    expect(css).toContain('[data-skill-drop-group-id][data-drop-slot="true"]');
    expect(css).toContain('[data-just-dropped="true"]');
    expect(css).toContain("@keyframes dasti-skills-drop-confirm");
    expect(css).toMatch(
      /\.dasti-skills-drawer__drag-overlay\s*\{[\s\S]*background:\s*var\(--sf2\);[\s\S]*opacity:\s*1;/,
    );
    expect(css).toMatch(
      /\.dasti-skills-drawer__actions-right\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(3,\s*var\(--dasti-skills-action-size\)\);/,
    );
    expect(css).toMatch(
      /\.dasti-skills-drawer__category-move-pair\s*\{[\s\S]*display:\s*inline-grid;[\s\S]*grid-column:\s*span 2;[\s\S]*grid-template-columns:\s*repeat\(2,\s*var\(--dasti-skills-action-size\)\);/,
    );
    expect(css).toContain(
      '.dasti-skills-drawer__skill-row[data-dragging="true"]',
    );
    expect(css).toContain(
      '.dasti-skills-drawer [data-skill-category-id][data-dragging="true"]',
    );
    expect(css).toContain(
      '.dasti-skills-drawer [data-skill-category-id][data-over="true"]',
    );
    expect(css).toContain(
      '.dasti-skills-drawer [data-skill-drop-group-id][data-over="true"]',
    );
    expect(css).toContain(".dasti-skills-drawer__move-menu .ds-menu__item");
    expect(css).toContain("z-index: calc(var(--z-modal) + 2);");
    expect(css).toContain("var(--dasti-skills-action-size)");
  });
});
