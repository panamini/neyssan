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
  it("disables draft-only style controls while keeping saved layout selection available", () => {
    const onSelectStyleBundle = vi.fn();
    const onSelectProposalLayout = vi.fn();

    const { container } = render(
      <ProposalDesignFields
        proposalTemplateId="modernist_signal"
        onSelectProposalLayout={onSelectProposalLayout}
        stylePreset={stylePreset}
        styleTemplateBundleId={null}
        styleControlsDisabled
        onSelectStyleBundle={onSelectStyleBundle}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Style 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use Terre accent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Bullets:/ })).toBeDisabled();
    expect(
      container.querySelector(".dasti-proposal-font-menu-trigger"),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Style 1" }));
    expect(onSelectStyleBundle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Minimal layout" }));
    expect(onSelectProposalLayout).toHaveBeenCalledWith(
      "workshop_proposal_margin",
    );
  });

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
          sizePt: 8,
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
      expect.objectContaining({ sizePt: 10 }),
    );
  });

  it("delegates decoration image files to the forge upload boundary", () => {
    const onDocumentDecorationUpload = vi.fn();
    const currentDecoration = {
      visible: false,
      source: "upload" as const,
      sizePreset: 52 as const,
      fit: "cover" as const,
      placementMode: "custom" as const,
      xMm: 21,
      yMm: 39,
    };

    render(
      <ProposalDesignFields
        stylePreset={stylePreset}
        styleTemplateBundleId="swiss_serif"
        onSelectStyleBundle={vi.fn()}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
        documentDecoration={currentDecoration}
        onDocumentDecorationChange={vi.fn()}
        onDocumentDecorationUpload={onDocumentDecorationUpload}
      />,
    );

    const file = new File(["image"], "proposal-mark.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Upload decoration image"), {
      target: { files: [file] },
    });

    expect(onDocumentDecorationUpload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        sizePreset: 52,
        fit: "cover",
        placementMode: "custom",
        xMm: 21,
        yMm: 39,
      }),
    );
  });

  it("disables decoration image edits when the document is read-only", () => {
    const onDocumentDecorationUpload = vi.fn();

    render(
      <ProposalDesignFields
        documentDecorationControlsDisabled
        stylePreset={stylePreset}
        styleTemplateBundleId="swiss_serif"
        onSelectStyleBundle={vi.fn()}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
        onDocumentDecorationChange={vi.fn()}
        onDocumentDecorationUpload={onDocumentDecorationUpload}
      />,
    );

    const uploadInput = screen.getByLabelText("Upload decoration image");
    expect(uploadInput).toBeDisabled();

    fireEvent.change(uploadInput, {
      target: {
        files: [new File(["image"], "proposal-mark.png", { type: "image/png" })],
      },
    });
    expect(onDocumentDecorationUpload).not.toHaveBeenCalled();
  });

  it("marks drawer image removal as an explicit user suppression", () => {
    const onDocumentDecorationChange = vi.fn();

    render(
      <ProposalDesignFields
        proposalTemplateId="editorial_wide"
        stylePreset={stylePreset}
        styleTemplateBundleId="magazine_editorial"
        onSelectStyleBundle={vi.fn()}
        onSelectStyleTypography={vi.fn()}
        onSelectStylePalette={vi.fn()}
        onSelectStyleCustomAccent={vi.fn()}
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "mark.png",
          mimeType: "image/png",
          alt: "Company mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        }}
        onDocumentDecorationChange={onDocumentDecorationChange}
        onDocumentDecorationUpload={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));

    expect(onDocumentDecorationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: false,
        suppressed: true,
        dataUrl: undefined,
        fileName: undefined,
      }),
    );
  });
});
