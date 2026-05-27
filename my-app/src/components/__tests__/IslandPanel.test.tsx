import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IslandPanel } from "../ui/island-panel";

function renderIslandPanel(onOpenChange = vi.fn()) {
  render(
    <IslandPanel open onOpenChange={onOpenChange} title="Assistant">
      <button type="button">Focusable action</button>
    </IslandPanel>,
  );
  return { onOpenChange };
}

describe("IslandPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("localizes the close panel label from UI language only", async () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    renderIslandPanel();
    expect(
      await screen.findByRole("button", { name: "Close panel" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");

    window.localStorage.setItem("twoweeks:ui-language", "fr");
    renderIslandPanel();
    expect(
      await screen.findByRole("button", { name: "Fermer le panneau" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");

    window.localStorage.setItem("twoweeks:ui-language", "es");
    renderIslandPanel();
    expect(
      await screen.findByRole("button", { name: "Cerrar panel" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
  });

  it("keeps the close button behavior", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderIslandPanel();

    await user.click(await screen.findByRole("button", { name: "Close panel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
