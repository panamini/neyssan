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
    data,
    stylePreset,
    railLeadControl,
    railStartAddon,
  }: {
    data: { title: string };
    stylePreset: { layout: string };
    railLeadControl?: React.ReactNode;
    railStartAddon?: React.ReactNode;
  }) => (
    <div>
      <div>Preview layout: {stylePreset.layout}</div>
      <div>Preview title: {data.title}</div>
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
    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show next resume layout:/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show previous resume layout:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the proposal-like appearance toolbar in workspace mode", () => {
    const { container } = render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(
      container.querySelector(".dasti-resume-preview-panel--workspace"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-resume-preview-panel--workspace"),
    ).not.toHaveClass("dasti-panel--spacious");

    expect(
      screen.queryByRole("group", { name: "Resume layout slideshow" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Resume appearance controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open layout controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open palette controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to sample preview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Open layout and typography controls",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open style presets" }),
    ).not.toBeInTheDocument();
  });

  it("uses direct text, layout, and color drawers in cv workspace preview mode", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(screen.getByRole("button", { name: "Open text styles" }));

    expect(
      screen.getByRole("button", { name: "Civic Correspondence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quiet Editorial" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open layout controls" }),
    );

    expect(screen.getByRole("button", { name: "Volk Register" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Swiss Minima" })).toBeInTheDocument();

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

  it("lets the workspace toolbar switch between the active CV and the sample preview", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to sample preview" }),
    );

    expect(
      screen.getByRole("button", { name: "Switch to active CV preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preview title: Senior Product Designer"),
    ).toBeInTheDocument();
  });
});
