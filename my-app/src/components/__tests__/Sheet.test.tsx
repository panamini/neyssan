import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "../ui/sheet";

describe("Sheet", () => {
  it("portals a right sheet and closes from overlay and escape", async () => {
    const onOpenChange = vi.fn();

    render(
      <Sheet
        open
        onOpenChange={onOpenChange}
        title="Manage skills"
        footer={<button type="button">Save</button>}
      >
        <button type="button">First action</button>
      </Sheet>,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Manage skills",
    });
    expect(dialog.parentElement).toBe(document.body.querySelector(".ds-sheet-root"));
    expect(dialog).toHaveClass("ds-sheet");
    expect(dialog).toHaveAttribute("data-state", "open");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the bottom-sheet variant with handle and traps tab focus", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open onOpenChange={vi.fn()} side="bottom" title="Add section">
        <button type="button">Achievements</button>
        <button type="button">Languages</button>
      </Sheet>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Add section" });
    expect(dialog).toHaveClass("ds-bottom-sheet");
    expect(
      dialog.querySelector(".ds-bottom-sheet__handle"),
    ).toBeInTheDocument();

    const close = screen.getByRole("button", { name: "Close panel." });
    const languages = screen.getByRole("button", { name: "Languages" });
    await waitFor(() => expect(close).toHaveFocus());

    await user.tab({ shift: true });
    expect(languages).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
  });
});
