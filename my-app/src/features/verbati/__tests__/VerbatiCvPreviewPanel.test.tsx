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
    panelNavigation,
  }: {
    stylePreset: { layout: string };
    railLeadControl?: React.ReactNode;
    railStartAddon?: React.ReactNode;
    panelNavigation?: {
      onPrevious: () => void;
      onNext: () => void;
      previousLabel: string;
      nextLabel: string;
    } | null;
  }) => (
    <div>
      <div>Preview layout: {stylePreset.layout}</div>
      {panelNavigation ? (
        <div>
          <button type="button" onClick={panelNavigation.onPrevious} aria-label={panelNavigation.previousLabel} />
          <button type="button" onClick={panelNavigation.onNext} aria-label={panelNavigation.nextLabel} />
        </div>
      ) : null}
      {railLeadControl}
      {railStartAddon}
    </div>
  ),
}));

describe("VerbatiCvPreviewPanel", () => {
  it("cycles through the shared resume layouts with previous and next arrows", () => {
    mockImportCv.mockClear();

    render(<VerbatiCvPreviewPanel />);

    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show next resume layout: Two Column",
      }),
    );
    expect(screen.getByText("Preview layout: two-column")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show previous resume layout: Swiss Minima",
      }),
    );
    expect(screen.getByText("Preview layout: swiss")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show previous resume layout: Quire",
      }),
    );
    expect(screen.getByText("Preview layout: quire")).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Open layout controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open palette controls" }),
    ).toBeInTheDocument();
  });

  it("uses simplified layout and text drawers in cv workspace preview mode", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open text styles" }),
    );

    expect(screen.getByText("Signature")).toBeInTheDocument();
    expect(
      screen.queryByText("Fraunces heading with a calm sans body."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Clean")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open layout controls",
      }),
    );

    expect(screen.getByText("Two Column")).toBeInTheDocument();
    expect(screen.queryByText("Expert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Robial split layout with the accent rail sidebar."),
    ).not.toBeInTheDocument();
  });
});
