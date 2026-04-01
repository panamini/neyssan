import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerbatiCvPreviewPanel } from "../VerbatiCvPreviewPanel";

const mockImportCv = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: {
      id: "cv-1",
      metadata: {},
    },
    importCv: mockImportCv,
  }),
}));

vi.mock("../cvDocumentToResumeData", () => ({
  hasRenderableResumeData: () => true,
  mapCvDocumentToResumeData: () => ({
    name: "Robert Cooper",
    title: "Protection Guard",
    summary: "Experienced security profile.",
    experience: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
    achievements: [],
  }),
}));

vi.mock("../VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    stylePreset,
    railLeadControl,
    railStartAddon,
  }: {
    stylePreset: { layout: string };
    railLeadControl?: React.ReactNode;
    railStartAddon?: React.ReactNode;
  }) => (
    <div>
      <div>Preview layout: {stylePreset.layout}</div>
      {railLeadControl}
      {railStartAddon}
    </div>
  ),
}));

describe("VerbatiCvPreviewPanel", () => {
  it("keeps the small live render on the selected style without layout slideshow arrows", () => {
    mockImportCv.mockClear();

    render(<VerbatiCvPreviewPanel />);

    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show next resume layout:/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show previous resume layout:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the proposal-like appearance toolbar in workspace mode", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(
      screen.queryByRole("group", { name: "Resume layout slideshow" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Resume appearance controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open style presets" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open palette controls" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Open layout and typography controls",
      }),
    ).not.toBeInTheDocument();
  });

  it("uses shared style and color drawers in cv workspace preview mode", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open style presets" }),
    );

    const styleButtons = [
      screen.getByRole("button", { name: "Clean" }),
      screen.getByRole("button", { name: "Soft" }),
      screen.getByRole("button", { name: "Editorial" }),
      screen.getByRole("button", { name: "Bold" }),
    ];

    styleButtons.forEach((button) => {
      expect(button).toHaveClass(
        "dasti-artifact-inspector__action",
        "dasti-artifact-inspector__action--drawer",
      );
      expect(button).not.toHaveClass("dasti-proposal-chrome-option");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open palette controls",
      }),
    );

    expect(
      screen.getByRole("button", { name: "Use Sage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use Ochre" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Robial split layout with the accent rail sidebar."),
    ).not.toBeInTheDocument();
  });
});
