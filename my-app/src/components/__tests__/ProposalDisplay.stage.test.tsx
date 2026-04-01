import React from "react";
import { render } from "@testing-library/react";
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
    const pageCount = content.includes("[PAGE_BREAK]") ? 2 : 1;
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
    render(
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
    const lastCall =
      stageLayoutSpy.mock.calls[stageLayoutSpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ fitMode: "contain" });
  });

  it("uses the same contain-fit stage sizing in edit mode for document proposals", () => {
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
    expect(lastCall).toMatchObject({ fitMode: "contain" });
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
});
