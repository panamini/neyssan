import React from "react";
import { render, screen } from "@testing-library/react";
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
});
