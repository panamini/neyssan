import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalArtifactInspector } from "../ProposalArtifactInspector";

describe("ProposalArtifactInspector", () => {
  it("opens the style drawer as a downward menu and suppresses trigger tooltips while open", async () => {
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

    expect(screen.getByText("Open layout styles.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Style" }));

    expect(
      screen.getByRole("dialog", { name: "Style options" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Open layout styles.")).not.toBeInTheDocument();
    expect(screen.getByText("Calm grid. Easy to read.")).toBeInTheDocument();
    expect(screen.queryByText("Palettes and custom accent.")).not.toBeInTheDocument();
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
});
