import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CvDesignFields } from "../CvDesignFields";
import type { VerbatiStylePreset } from "../../../features/verbati/types";

const stylePreset: VerbatiStylePreset = {
  layout: "workshop",
  typography: "quiet-editorial",
  palette: "terre",
};

describe("CvDesignFields", () => {
  it("lets the user choose custom section heading icons from the shared picker", () => {
    const onDocumentIconSettingsChange = vi.fn();

    const { rerender } = render(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
        sectionIconTargets={[
          { id: "experience", title: "Experience", type: "experience" },
        ]}
        documentIconSettings={{
          defaultListMarkerKey: "dot",
          sectionHeadingIconMode: "none",
          sectionIconMap: {},
          color: "accent",
          sizePt: 10,
        }}
        onDocumentIconSettingsChange={onDocumentIconSettingsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(onDocumentIconSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sectionHeadingIconMode: "custom" }),
    );

    rerender(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
        sectionIconTargets={[
          { id: "experience", title: "Experience", type: "experience" },
        ]}
        documentIconSettings={{
          defaultListMarkerKey: "dot",
          sectionHeadingIconMode: "custom",
          sectionIconMap: {},
          color: "accent",
          sizePt: 10,
        }}
        onDocumentIconSettingsChange={onDocumentIconSettingsChange}
      />,
    );

    const sectionIconMap = screen.getByLabelText("Custom section icons");
    fireEvent.click(
      within(sectionIconMap).getByRole("tab", { name: "Work and admin" }),
    );
    fireEvent.click(
      within(sectionIconMap).getByRole("button", { name: "Use Briefcase icon" }),
    );

    expect(onDocumentIconSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sectionHeadingIconMode: "custom",
        sectionIconMap: { experience: "briefcase" },
      }),
    );
  });

  it("offers the editorial sidebar template option", () => {
    const onSelectTemplate = vi.fn();

    render(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={onSelectTemplate}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editorial Sidebar" }));
    expect(onSelectTemplate).toHaveBeenCalledWith("editorial-sidebar");
  });
});
