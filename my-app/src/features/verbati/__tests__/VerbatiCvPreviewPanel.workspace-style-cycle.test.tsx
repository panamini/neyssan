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
    railStartAddon,
  }: {
    stylePreset: { layout: string };
    railStartAddon?: React.ReactNode;
  }) => (
    <div>
      <div>Preview layout: {stylePreset.layout}</div>
      {railStartAddon}
    </div>
  ),
}));

describe("VerbatiCvPreviewPanel workspace style cycle", () => {
  it("renders proposal-like style cycle controls in the workspace rail", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(
      screen.getByRole("group", { name: "Switch resume styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show previous resume style: Editorial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show next resume style: Clean" }),
    ).toBeInTheDocument();
  });

  it("cycles bundled resume styles from the workspace toolbar arrows", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show next resume style: Clean",
      }),
    );

    expect(screen.getByText("Preview layout: two-column")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show previous resume style: Bold",
      }),
    );

    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();
  });

  it("supports keyboard style cycling from the workspace toolbar", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    const nextStyleButton = screen.getByRole("button", {
      name: "Show next resume style: Clean",
    });

    nextStyleButton.focus();
    fireEvent.keyDown(nextStyleButton, { key: "ArrowRight" });
    expect(screen.getByText("Preview layout: two-column")).toBeInTheDocument();

    fireEvent.keyDown(nextStyleButton, { key: "ArrowLeft" });
    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();
  });
});
