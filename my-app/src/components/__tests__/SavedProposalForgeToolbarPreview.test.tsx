import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SavedProposalForgeToolbarPreview } from "../SavedProposalForgeToolbarPreview";

describe("SavedProposalForgeToolbarPreview", () => {
  it("does not render a tone button in the output shell toolbar", () => {
    render(
      <SavedProposalForgeToolbarPreview
        mode="edit"
        onModeChange={vi.fn()}
        showZoomControls={false}
        zoomIndex={1}
        onZoomIndexChange={vi.fn()}
        onRefine={vi.fn()}
        onDelete={vi.fn()}
        onCopy={vi.fn()}
        copyFeedback="idle"
        isRegenerating={false}
        typographyValue="engaging"
        onTypographyChange={vi.fn()}
        paletteOverride={null}
        onPaletteOverrideChange={vi.fn()}
        customAccentHex={null}
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId="bordeaux"
        layoutValue="quire"
        onLayoutChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Tone of voice/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine saved proposal" }),
    ).toBeInTheDocument();
  });

  it("opens layout and text controls through the shared menu primitive", async () => {
    const user = userEvent.setup();
    const onLayoutChange = vi.fn();
    const onTypographyChange = vi.fn();

    render(
      <SavedProposalForgeToolbarPreview
        mode="preview"
        onModeChange={vi.fn()}
        showZoomControls={false}
        zoomIndex={1}
        onZoomIndexChange={vi.fn()}
        onRefine={vi.fn()}
        onDelete={vi.fn()}
        onCopy={vi.fn()}
        copyFeedback="idle"
        isRegenerating={false}
        typographyValue="engaging"
        onTypographyChange={onTypographyChange}
        paletteOverride={null}
        onPaletteOverrideChange={vi.fn()}
        customAccentHex={null}
        onCustomAccentHexChange={vi.fn()}
        resolvedPaletteId="bordeaux"
        layoutValue="quire"
        onLayoutChange={onLayoutChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Layout/i }));
    expect(
      screen.getByRole("menu", { name: "Layout options" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitemradio", { name: "Workshop two-column" }),
    );
    expect(onLayoutChange).toHaveBeenCalledWith("workshop");

    await user.click(screen.getByRole("button", { name: "Open text styles" }));
    expect(
      screen.getByRole("menu", { name: "Text styles" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: "Ledger Sans" }));
    expect(onTypographyChange).toHaveBeenCalledWith("ledger-sans");
  });
});
