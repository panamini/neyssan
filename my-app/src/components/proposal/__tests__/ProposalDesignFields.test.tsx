import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProposalDesignFields } from "../ProposalDesignFields";
import type { VerbatiStylePreset } from "../../../features/verbati/types";

const stylePreset: VerbatiStylePreset = {
  layout: "swiss",
  typography: "quiet-editorial",
  palette: "terre",
};

describe("ProposalDesignFields", () => {
  it("uses the shared bullet style control without the old marker grid at rest", () => {
    const onDocumentIconSettingsChange = vi.fn();

    render(
      <ProposalDesignFields
        stylePreset={stylePreset}
        styleTemplateBundleId="swiss_serif"
        onSelectStyleBundle={vi.fn()}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
        documentIconSettings={{
          listMarkerType: "dot",
          defaultListMarkerKey: "dot",
          sectionHeadingIconMode: "none",
          sectionIconMap: {},
          color: "accent",
          sizePt: 10,
        }}
        onDocumentIconSettingsChange={onDocumentIconSettingsChange}
      />,
    );

    expect(screen.queryByRole("searchbox", { name: "Search icons" })).toBeNull();
    expect(screen.queryByText("List marker")).not.toBeInTheDocument();
    expect(screen.getByText("Bullets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bullets:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check marker" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Bullets:/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Check marker" }));
    expect(onDocumentIconSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        listMarkerType: "icon",
        defaultListMarkerKey: "check",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Muted tone" }));
    expect(onDocumentIconSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ color: "muted" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Large scale" }));
    expect(onDocumentIconSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sizePt: 12 }),
    );
  });
});
