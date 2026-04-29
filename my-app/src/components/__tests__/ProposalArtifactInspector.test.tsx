import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalArtifactInspector } from "../ProposalArtifactInspector";

describe("ProposalArtifactInspector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens style options through the shared menu primitive", async () => {
    const user = userEvent.setup();

    render(
      <ProposalArtifactInspector
        variant="header"
        styleBundleId="swiss_serif"
        onStyleBundleChange={vi.fn()}
        paletteOverride="sauge"
        onPaletteOverrideChange={vi.fn()}
        customAccentHex={null}
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId="sauge"
        hasGenerated
      />,
    );

    const styleTrigger = screen.getByRole("button", { name: "Style" });
    const colorTrigger = screen.getByRole("button", { name: "Color" });

    expect(styleTrigger).toHaveAttribute("data-toolbar-tooltip", "Style");
    expect(colorTrigger).toHaveAttribute("data-toolbar-tooltip", "Colors");

    await user.click(styleTrigger);

    expect(
      screen.getByRole("menu", { name: "Style options" }),
    ).toBeInTheDocument();
    expect(styleTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(styleTrigger).toHaveAttribute("aria-expanded", "true");
    expect(colorTrigger).toHaveAttribute("data-toolbar-tooltip", "Colors");
    expect(
      screen.getByRole("menuitemradio", { name: "Swiss" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("reopens the custom color picker directly when a custom accent is active", async () => {
    const user = userEvent.setup();

    render(
      <ProposalArtifactInspector
        variant="header"
        styleBundleId="swiss_serif"
        onStyleBundleChange={vi.fn()}
        paletteOverride={null}
        onPaletteOverrideChange={vi.fn()}
        customAccentHex="#556D60"
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId={null}
        hasGenerated
      />,
    );

    await user.click(screen.getByRole("button", { name: "Color" }));

    expect(
      screen.getByRole("dialog", { name: "Custom accent color" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Accent color field" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Accent hue" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Gradient" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Color options" }),
    ).not.toBeInTheDocument();
  });

  it("opens the compact palette drawer when a preset palette is active", async () => {
    const user = userEvent.setup();

    render(
      <ProposalArtifactInspector
        variant="header"
        styleBundleId="swiss_serif"
        onStyleBundleChange={vi.fn()}
        paletteOverride="sauge"
        onPaletteOverrideChange={vi.fn()}
        customAccentHex={null}
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId="sauge"
        hasGenerated
      />,
    );

    await user.click(screen.getByRole("button", { name: "Color" }));

    expect(
      screen.getByRole("dialog", { name: "Color options" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Custom accent color" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom accent color" })).toBeInTheDocument();
  });

  it("anchors the custom picker below the color drawer surface", async () => {
    const user = userEvent.setup();

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockRect() {
        const element = this as HTMLElement;
        if (element.getAttribute("aria-label") === "Color") {
          return {
            x: 480,
            y: 80,
            width: 34,
            height: 34,
            top: 80,
            right: 514,
            bottom: 114,
            left: 480,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (element.getAttribute("aria-label") === "Color options") {
          return {
            x: 448,
            y: 118,
            width: 132,
            height: 42,
            top: 118,
            right: 580,
            bottom: 160,
            left: 448,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(164);

    render(
      <ProposalArtifactInspector
        variant="header"
        styleBundleId="swiss_serif"
        onStyleBundleChange={vi.fn()}
        paletteOverride="sauge"
        onPaletteOverrideChange={vi.fn()}
        customAccentHex={null}
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId="sauge"
        hasGenerated
      />,
    );

    await user.click(screen.getByRole("button", { name: "Color" }));
    await user.click(screen.getByRole("button", { name: "Custom accent color" }));

    const picker = screen.getByRole("dialog", { name: "Custom accent color" });
    expect(screen.getByRole("dialog", { name: "Color options" })).toBeInTheDocument();
    expect(picker).toHaveStyle({ left: "448px", top: "162px" });
  });
});
