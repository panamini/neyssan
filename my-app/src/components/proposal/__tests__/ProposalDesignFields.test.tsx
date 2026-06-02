import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProposalDesignFields } from "../ProposalDesignFields";
import type { VerbatiStylePreset } from "../../../features/verbati/types";

const stylePreset: VerbatiStylePreset = {
  layout: "swiss",
  typography: "quiet-editorial",
  palette: "terre",
};

describe("ProposalDesignFields", () => {
  it("does not expose content icon insertion controls in the design drawer", () => {
    render(
      <ProposalDesignFields
        stylePreset={stylePreset}
        styleTemplateBundleId="swiss_serif"
        onSelectStyleBundle={vi.fn()}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
      />,
    );

    expect(screen.queryByRole("searchbox", { name: "Search icons" })).toBeNull();
    expect(screen.queryByText("List marker")).toBeNull();
  });
});
