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
  it("uses the shared bullet style control instead of the direct list icon picker", () => {
    const onDocumentIconSettingsChange = vi.fn();

    render(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
        documentIconSettings={{
          listMarkerType: "icon",
          defaultListMarkerKey: "plus",
          sectionHeadingIconMode: "none",
          sectionIconMap: {},
          color: "accent",
          sizePt: 8,
        }}
        onDocumentIconSettingsChange={onDocumentIconSettingsChange}
      />,
    );

    expect(screen.getByText("Bullets")).toBeInTheDocument();
    expect(screen.getByText("Editorial Plus")).toBeInTheDocument();
    expect(screen.queryByText("List marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("document-icon-picker")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Bullets: Editorial Plus/i }));
    fireEvent.click(screen.getByRole("button", { name: "Classic Dot" }));

    expect(onDocumentIconSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        listMarkerType: "dot",
        defaultListMarkerKey: "dot",
        color: "ink",
        sizePt: 8,
      }),
    );
  });

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

  it("offers all active resume template options", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Sanat" }));
    fireEvent.click(screen.getByRole("button", { name: "Maggie" }));
    fireEvent.click(screen.getByRole("button", { name: "Editorial Sidebar" }));
    expect(onSelectTemplate).toHaveBeenCalledWith("sanat-asymmetric");
    expect(onSelectTemplate).toHaveBeenCalledWith("maggie-letter");
    expect(onSelectTemplate).toHaveBeenCalledWith("editorial-sidebar");
  });

  it("renders the calm no-image cell and uploads from the drawer", () => {
    const onImageUpload = vi.fn();

    render(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
        image={{
          visible: false,
          source: "upload",
          sizePreset: 35,
          fit: "cover",
          placementMode: "default",
          xMm: 17,
          yMm: 35,
        }}
        onImageUpload={onImageUpload}
      />,
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Add image")).toBeInTheDocument();
    expect(screen.getByText("PNG, JPEG or SVG")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspect" })).toBeNull();

    const input = screen.getByLabelText("Upload CV image");
    const file = new File(["image"], "portrait.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onImageUpload).toHaveBeenCalledWith(file);
  });

  it("opens image controls in a floating inspect popover", () => {
    const onImageChange = vi.fn();

    render(
      <CvDesignFields
        stylePreset={stylePreset}
        selectedStyleSlot={1}
        onSelectStyleSlot={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSelectFontPair={vi.fn()}
        onSelectAccent={vi.fn()}
        onSelectCustomAccent={vi.fn()}
        image={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "portrait.png",
          mimeType: "image/png",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        }}
        onImageChange={onImageChange}
      />,
    );

    expect(screen.getByText("portrait.png")).toBeInTheDocument();
    expect(screen.getByText("Contain • Medium • Visible")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Image controls" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const popover = screen.getByRole("dialog", { name: "Image controls" });

    fireEvent.click(within(popover).getByRole("button", { name: "Large" }));
    expect(onImageChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sizePreset: 52,
        fit: "contain",
        visible: true,
      }),
    );

    fireEvent.click(within(popover).getByRole("button", { name: "Cover" }));
    expect(onImageChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sizePreset: 35,
        fit: "cover",
        visible: true,
      }),
    );

    fireEvent.click(within(popover).getByRole("button", { name: "Hide image" }));
    expect(onImageChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: false,
      }),
    );

    fireEvent.click(within(popover).getByRole("button", { name: "Remove image" }));
    const removedDecoration = onImageChange.mock.calls.at(-1)?.[0];
    expect(removedDecoration).toEqual(
      expect.objectContaining({
        visible: false,
      }),
    );
    expect(removedDecoration).not.toHaveProperty("dataUrl");
    expect(removedDecoration).not.toHaveProperty("fileName");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Image controls" })).toBeNull();
  });
});
