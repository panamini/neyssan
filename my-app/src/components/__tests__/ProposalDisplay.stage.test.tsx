import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewportCenteringSpy = vi.fn();
const stageLayoutSpy = vi.fn();

vi.mock("../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: (options: Record<string, unknown>) => {
    stageLayoutSpy(options);
    return {
      fitScale: 1,
      stageWidth: 794,
      stageHeight: 1123,
      pageWidth: 794,
      pageHeight: 1123,
      overflowX: false,
      overflowY: false,
      isFit: true,
    };
  },
}));

vi.mock("../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: (options: Record<string, unknown>) => {
    viewportCenteringSpy(options);
    return {
      attachViewport: () => undefined,
    };
  },
}));

vi.mock("../proposal-render/ProposalDocumentRenderer", () => ({
  ProposalDocumentRenderer: ({
    content,
    onPageCountChange,
  }: {
    content: string;
    onPageCountChange?: (count: number) => void;
  }) => {
    const explicitPageCount = content.match(/\[PAGES=(\d+)\]/)?.[1];
    const pageCount = explicitPageCount
      ? Number(explicitPageCount)
      : content.includes("[PAGE_BREAK]")
        ? 2
        : 1;
    React.useEffect(() => {
      onPageCountChange?.(pageCount);
    }, [onPageCountChange, pageCount]);

    return (
      <div data-testid="proposal-document-renderer">
        {Array.from({ length: pageCount }, (_, index) => (
          <div
            key={index}
            className="dasti-proposal-document__page"
            data-page-index={index}
          />
        ))}
      </div>
    );
  },
}));

import ProposalDisplay from "../ProposalDisplay";

describe("ProposalDisplay stage behavior", () => {
  beforeEach(() => {
    viewportCenteringSpy.mockClear();
    stageLayoutSpy.mockClear();
  });

  it("top-anchors the live workspace preview path", () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nSingle-page proposal.\n\nAlex"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        previewAnchor="top"
      />,
    );

    const lastCall =
      viewportCenteringSpy.mock.calls[viewportCenteringSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ defaultCenterX: 0, defaultCenterY: 0 });
    expect(
      container.querySelector(".dasti-document-stage-chassis"),
    ).toHaveStyle({
      justifyContent: "center",
      alignItems: "flex-start",
    });
  });

  it("keeps a single-page preview on the non-stacked A4 shell", () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nSingle-page proposal.\n\nAlex"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
      />,
    );

    expect(
      container.querySelector(".dasti-proposal-sheet__preview-page--stacked"),
    ).toBeNull();
    expect(
      container.querySelectorAll(".dasti-proposal-document__page"),
    ).toHaveLength(1);
    expect(
      container.querySelector(".dasti-proposal-sheet__preview-scale-shell"),
    ).toBeTruthy();
    const lastCall =
      stageLayoutSpy.mock.calls[stageLayoutSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      fitMode: "contain",
      fillAvailableOnZoom: true,
      includeParentMeasurement: true,
    });
  });

  it("uses width-fit stage sizing in edit mode for document proposals", () => {
    render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nSingle-page proposal.\n\nAlex"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    const lastCall =
      stageLayoutSpy.mock.calls[stageLayoutSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      fitMode: "width",
      fillAvailableOnZoom: false,
      includeParentMeasurement: false,
    });
  });

  it("can width-fit document previews when the host shell owns the frame size", () => {
    render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nSingle-page proposal.\n\nAlex"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        previewFitMode="width"
        showZoomControls
      />,
    );

    const lastCall =
      stageLayoutSpy.mock.calls[stageLayoutSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      fitMode: "width",
      fillAvailableOnZoom: false,
    });
  });

  it("shows the rendered page count as the preview chrome badge", async () => {
    render(
      <ProposalDisplay
        proposalContent={"Page one[PAGE_BREAK]Page two"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("two pages")).toBeInTheDocument();
    });
    expect(
      document.querySelector(".dasti-proposal-page-count-badge"),
    ).toBeTruthy();
  });

  it("hides the rendered page count for single-page previews", async () => {
    render(
      <ProposalDisplay
        proposalContent={"Single-page proposal"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions={false}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll(".dasti-proposal-document__page"),
      ).toHaveLength(1);
    });
    expect(screen.queryByText("one page")).not.toBeInTheDocument();
    expect(screen.queryByText("1 page")).not.toBeInTheDocument();
    expect(
      document.querySelector(".dasti-proposal-page-count-badge"),
    ).toBeNull();
  });

  it("allows secondary proposal previews to opt out of the page count badge", async () => {
    render(
      <ProposalDisplay
        proposalContent={"Page one[PAGE_BREAK]Page two"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions={false}
        showPageCountBadge={false}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll(".dasti-proposal-document__page"),
      ).toHaveLength(2);
    });
    expect(screen.queryByText("two pages")).not.toBeInTheDocument();
    expect(
      document.querySelector(".dasti-proposal-page-count-badge"),
    ).toBeNull();
  });

  it("formats preview page counts in words through six and numbers after six", async () => {
    const { rerender } = render(
      <ProposalDisplay
        proposalContent={"[PAGES=6]"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("six pages")).toBeInTheDocument();
    });

    rerender(
      <ProposalDisplay
        proposalContent={"[PAGES=7]"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("7 pages")).toBeInTheDocument();
    });
  });

  it("keeps the rendered page count out of the paragraph-actions footer path", async () => {
    render(
      <ProposalDisplay
        proposalContent={"Page one[PAGE_BREAK]Page two"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showPreviewParagraphActions
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll(".dasti-proposal-document__page"),
      ).toHaveLength(2);
    });
    expect(screen.queryByText("two pages")).not.toBeInTheDocument();
    expect(
      document.querySelector(".dasti-proposal-page-count-badge"),
    ).toBeNull();
    expect(screen.getByText("Paragraph actions")).toBeInTheDocument();
  });

  it("switches multipage previews to stacked inner A4 pages without re-skinning the outer shell", () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={"Page one[PAGE_BREAK]Page two"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
      />,
    );

    expect(
      container.querySelector(".dasti-proposal-sheet__preview-page--stacked"),
    ).toBeTruthy();
    expect(
      container.querySelector(
        ".dasti-proposal-sheet__preview-page-positioner--stacked",
      ),
    ).toBeTruthy();
    expect(
      container.querySelectorAll(".dasti-proposal-document__page"),
    ).toHaveLength(2);
    expect(
      container.querySelector(".dasti-proposal-sheet__preview-stage"),
    ).toHaveAttribute("data-stage-mode", "overflow");
  });

  it("uses the same fixed A4 stage policy for volk register previews", () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nSingle-page proposal.\n\nAlex"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        templateId="volk_register"
        showZoomControls
      />,
    );

    expect(
      container.querySelector(".dasti-proposal-sheet__preview-scale-shell"),
    ).toBeTruthy();
    const lastCall =
      stageLayoutSpy.mock.calls[stageLayoutSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      fitMode: "contain",
      fillAvailableOnZoom: true,
      includeParentMeasurement: true,
    });
  });
});
