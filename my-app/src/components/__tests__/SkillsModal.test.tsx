import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillsModal } from "../structured-blocks/SkillsModal";

describe("SkillsModal", () => {
  it("saves categories on the section side and skills with categoryId only", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <SkillsModal
        open
        items={[{ id: "skill-1", name: "React", level: "Advanced" }]}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("New category"), {
      target: { value: "Frontend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill category" }));

    const row = screen.getByDisplayValue("React").closest(".group");
    expect(row).toBeTruthy();
    const categorySelect = within(row as HTMLElement).getByRole("combobox", {
      name: "Category for React",
    });
    fireEvent.change(categorySelect, { target: { value: "skill-cat-" } });

    const frontendOption = within(categorySelect).getByRole("option", {
      name: "Frontend",
    }) as HTMLOptionElement;
    fireEvent.change(categorySelect, {
      target: { value: frontendOption.value },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [items, categories] = onSave.mock.calls[0]!;
    expect(categories).toEqual([
      expect.objectContaining({ label: "Frontend", source: "user" }),
    ]);
    expect(items).toEqual([
      expect.objectContaining({
        id: "skill-1",
        name: "React",
        level: "Advanced",
        categoryId: categories[0].id,
      }),
    ]);
    expect(items[0]).not.toHaveProperty("category");
    expect(items[0]).not.toHaveProperty("categoryLabel");
  });
});
