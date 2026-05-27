import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "../ui/sheet";

function getSheetHeaderCloseButton(name: string): HTMLButtonElement {
  const closeButton = screen
    .getAllByRole("button", { name })
    .find((button) => button.classList.contains("ds-sheet__close"));
  if (!(closeButton instanceof HTMLButtonElement)) {
    throw new Error(`Missing sheet header close button: ${name}`);
  }
  return closeButton;
}

describe("Sheet", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

    await userEvent.click(getSheetHeaderCloseButton("Close panel"));
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

    const close = getSheetHeaderCloseButton("Close panel");
    const languages = screen.getByRole("button", { name: "Languages" });
    await waitFor(() => expect(dialog).toHaveFocus());

    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(languages).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
  });

  it("does not steal focus from a field when the parent rerenders with a new close handler", async () => {
    const { rerender } = render(
      <Sheet open onOpenChange={() => {}} title="Edit section">
        <label>
          Role
          <input aria-label="Role" />
        </label>
      </Sheet>,
    );

    const input = await screen.findByLabelText("Role");
    const dialog = screen.getByRole("dialog", { name: "Edit section" });
    await waitFor(() => expect(dialog).toHaveFocus());
    input.focus();
    expect(input).toHaveFocus();

    rerender(
      <Sheet open onOpenChange={() => {}} title="Edit section">
        <label>
          Role
          <input aria-label="Role" />
        </label>
      </Sheet>,
    );

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(input).toHaveFocus();
  });

  it("supports non-modal sheets that do not close from background clicks", async () => {
    const onOpenChange = vi.fn();

    render(
      <>
        <button type="button">Page action</button>
        <Sheet open modal={false} onOpenChange={onOpenChange} title="Ask">
          <button type="button">Ask Summary</button>
        </Sheet>
      </>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Ask" });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(screen.getAllByRole("button", { name: "Close panel" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Page action" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("localizes close panel labels from UI language only", async () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    const firstRender = render(
      <Sheet open onOpenChange={vi.fn()} title="Manage skills">
        <button type="button">First action</button>
      </Sheet>,
    );

    await screen.findByRole("dialog", { name: "Manage skills" });
    expect(getSheetHeaderCloseButton("Close panel")).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
    firstRender.unmount();

    window.localStorage.setItem("twoweeks:ui-language", "fr");
    const secondRender = render(
      <Sheet open onOpenChange={vi.fn()} title="Manage skills">
        <button type="button">First action</button>
      </Sheet>,
    );
    await screen.findByRole("dialog", { name: "Manage skills" });
    expect(getSheetHeaderCloseButton("Fermer le panneau")).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
    secondRender.unmount();

    window.localStorage.setItem("twoweeks:ui-language", "es");
    render(
      <Sheet open onOpenChange={vi.fn()} title="Manage skills">
        <button type="button">First action</button>
      </Sheet>,
    );
    await screen.findByRole("dialog", { name: "Manage skills" });
    expect(getSheetHeaderCloseButton("Cerrar panel")).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
  });
});
