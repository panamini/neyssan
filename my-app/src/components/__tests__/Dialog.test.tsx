import React from "react";
import { render, screen } from "@testing-library/react";
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
});
