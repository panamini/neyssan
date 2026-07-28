import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "../ui/dialog";

function renderDialog(onClose = vi.fn()) {
  render(
    <Dialog open onClose={onClose} title="Account">
      <button type="button">Focusable action</button>
    </Dialog>,
  );
  return { onClose };
}

describe("Dialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("localizes the close label from UI language only", async () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    renderDialog();
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");

    window.localStorage.setItem("twoweeks:ui-language", "fr");
    renderDialog();
    expect(await screen.findByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");

    window.localStorage.setItem("twoweeks:ui-language", "es");
    renderDialog();
    expect(await screen.findByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
  });

  it("keeps the close button behavior", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(await screen.findByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog, traps tab, and restores the trigger", async () => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Open dialog";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Dialog open onClose={vi.fn()} title="Account">
        <button type="button">Focusable action</button>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Account" });
    const closeButton = within(dialog).getByRole("button", { name: "Close" });
    const actionButton = within(dialog).getByRole("button", {
      name: "Focusable action",
    });

    await waitFor(() => expect(closeButton).toHaveFocus());

    actionButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(actionButton).toHaveFocus();

    rerender(
      <Dialog open={false} onClose={vi.fn()} title="Account">
        <button type="button">Focusable action</button>
      </Dialog>,
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
});
