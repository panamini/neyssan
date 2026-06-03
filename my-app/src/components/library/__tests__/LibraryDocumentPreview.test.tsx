import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DrawerDocumentTile } from "../LibraryDocumentPreview";
import type { LibraryItem } from "../../../lib/application-library";
import type { CvDocument } from "../../../types/cvDocument";

const { buildStyledResumePrintSourceMock } = vi.hoisted(() => ({
  buildStyledResumePrintSourceMock: vi.fn(() => ({
    resumeData: { basics: { name: "Porphyre" } },
    stylePreset: { familyId: "workshop", typography: "geist", palette: "sauge" },
    resumeTemplateId: "workshop_resume_twocol_ats",
    rendererVariantId: "swissminima",
    committedPages: [{ id: "page-1" }, { id: "page-2" }],
  })),
}));

vi.mock("../../proposal-render/ProposalDocumentRenderer", () => ({
  ProposalDocumentRenderer: ({ content }: { content: string }) => (
    <div data-testid="proposal-document-renderer">{content}</div>
  ),
}));

vi.mock("../../../features/verbati/resume/ResumePage", () => ({
  default: ({ mode }: { mode: string }) => (
    <div data-testid="resume-page">{mode}</div>
  ),
}));

vi.mock("../../../features/verbati/resume/ResumeTemplateRenderer", () => ({
  default: ({ committedPages }: { committedPages?: unknown[] }) => (
    <div data-testid="resume-template-renderer">
      {committedPages?.length ?? 0}
    </div>
  ),
}));

vi.mock("../../../lib/document-export-models", () => ({
  buildStyledResumePrintSource: () => buildStyledResumePrintSourceMock(),
}));

describe("DrawerDocumentTile", () => {
  it("renders proposal content in the dense drawer tile", () => {
    const item: LibraryItem = {
      id: "proposal:one",
      type: "proposal",
      title: "Letter",
      content: "Real proposal text",
      updatedAt: 1,
      routeTarget: { kind: "route", to: "/proposal?draftId=one" },
      source: "convex",
    };

    const { container } = render(<DrawerDocumentTile item={item} />);

    expect(screen.getByTestId("proposal-document-renderer")).toHaveTextContent(
      "Real proposal text",
    );
    expect(screen.getByText("Letter")).toBeInTheDocument();
    const tile = container.querySelector(".forge-rail-document-tile");
    const preview = container.querySelector(".forge-rail-document-tile__preview");
    const caption = container.querySelector(".forge-rail-document-tile__caption");
    expect(tile?.children[0]).toBe(preview);
    expect(tile?.children[1]).toBe(caption);
    expect(preview?.contains(caption)).toBe(false);
  });

  it("renders a hydrated CV through the live resume renderer with only page one", () => {
    buildStyledResumePrintSourceMock.mockReturnValueOnce({
      resumeData: { basics: { name: "Porphyre" } },
      stylePreset: {
        familyId: "workshop",
        typography: "geist",
        palette: "sauge",
      },
      resumeTemplateId: "workshop_resume_twocol_ats",
      rendererVariantId: "swissminima",
      committedPages: [{ id: "page-1" }, { id: "page-2" }],
    });
    const cvDocument = {
      id: "cv-one",
      title: "Porphyre",
      sections: [],
      metadata: {},
    } as unknown as CvDocument;
    const item: LibraryItem = {
      id: "cv:cv-one",
      type: "cv",
      title: "Porphyre",
      updatedAt: 1,
      routeTarget: { kind: "route", to: "/cv?id=cv-one" },
      source: "cv-library",
      cvDocument,
    };

    render(<DrawerDocumentTile item={item} cvDocument={cvDocument} />);

    expect(screen.getByTestId("resume-template-renderer")).toHaveTextContent("1");
    expect(screen.getByText("Porphyre")).toBeInTheDocument();
  });

  it("renders editorial sidebar CV thumbnails through the shared ResumePage path", () => {
    buildStyledResumePrintSourceMock.mockReturnValueOnce({
      resumeData: { basics: { name: "Porphyre" } },
      stylePreset: {
        familyId: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
        resumeTemplateId: "editorial-sidebar",
      },
      resumeTemplateId: "editorial-sidebar",
      rendererVariantId: "editorialsidebar",
      pageSize: { id: "a4", widthMm: 210, heightMm: 297 },
      committedPages: undefined,
    });
    const cvDocument = {
      id: "cv-one",
      title: "Porphyre",
      sections: [],
      metadata: {},
    } as unknown as CvDocument;
    const item: LibraryItem = {
      id: "cv:cv-one",
      type: "cv",
      title: "Porphyre",
      updatedAt: 1,
      routeTarget: { kind: "route", to: "/cv?id=cv-one" },
      source: "cv-library",
      cvDocument,
    };

    render(<DrawerDocumentTile item={item} cvDocument={cvDocument} />);

    expect(screen.getByTestId("resume-page")).toHaveTextContent(
      "editorialsidebar",
    );
    expect(screen.queryByTestId("resume-template-renderer")).not.toBeInTheDocument();
  });

  it("renders visible state badges through the shared drawer tile badge", () => {
    const item: LibraryItem = {
      id: "proposal:one",
      type: "proposal",
      title: "Letter",
      content: "Real proposal text",
      updatedAt: 1,
      routeTarget: { kind: "route", to: "/proposal?draftId=one" },
      source: "convex",
    };

    render(<DrawerDocumentTile item={item} badge="Current" />);

    expect(screen.getByText("Current")).toHaveClass(
      "forge-rail-document-tile__badge",
    );
  });
});
