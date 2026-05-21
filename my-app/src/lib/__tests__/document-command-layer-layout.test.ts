import { describe, expect, it } from "vitest";
import {
  computeDocumentCommandLayerLayout,
  getCommandLayerToolbarDensity,
  type CommandLayerRect,
} from "../document-command-layer-layout";

const VIEWPORT_WIDTHS = [390, 480, 768, 1024, 1280, 1440] as const;
const ZOOMS = [0.3, 0.5, 0.75, 1, 1.25, 1.3, 1.5, 2] as const;
const HARD_INVARIANT_ZOOMS = [0.3, 0.5, 1, 1.3] as const;
const THEMES = ["light", "dark"] as const;
const SURFACES = [
  { name: "Proposal Forge", toolbarNaturalWidth: 680 },
  { name: "CV Forge", toolbarNaturalWidth: 520 },
] as const;
const BASE_PAPER_WIDTH = 794;
const BASE_PAPER_HEIGHT = 1123;
const TOOLBAR_MIN_WIDTH = 300;
const TOOLBAR_HEIGHT = 44;
const SAFE_MARGIN = 12;
const GAP = 12;
const STICKY_TOP = 78;
const ASK_OFFSET_FROM_PAPER_TOP = 16;
const ASK_ICON_WIDTH = 32;
const ASK_HEIGHT = 32;
const PAPER_TOP = STICKY_TOP + TOOLBAR_HEIGHT + GAP;

function right(rect: CommandLayerRect) {
  return rect.left + rect.width;
}

function bottom(rect: CommandLayerRect) {
  return rect.top + rect.height;
}

function centerX(rect: CommandLayerRect) {
  return rect.left + rect.width / 2;
}

function intersects(a: CommandLayerRect, b: CommandLayerRect) {
  return (
    a.left < right(b) &&
    right(a) > b.left &&
    a.top < bottom(b) &&
    bottom(a) > b.top
  );
}

function makePaperRect(viewportWidth: number, zoom: number): CommandLayerRect {
  const width = Math.round(BASE_PAPER_WIDTH * zoom * 100) / 100;
  const height = Math.round(BASE_PAPER_HEIGHT * zoom * 100) / 100;
  return {
    left: Math.round(((viewportWidth - width) / 2) * 100) / 100,
    top: PAPER_TOP,
    width,
    height,
  };
}

function makeDraftRect(
  toolbarRect: CommandLayerRect,
  draftWidth: number,
): CommandLayerRect {
  return {
    left: right(toolbarRect) - draftWidth - 8,
    top: toolbarRect.top + 5,
    width: draftWidth,
    height: 34,
  };
}

describe("computeDocumentCommandLayerLayout", () => {
  it.each(
    VIEWPORT_WIDTHS.flatMap((width) =>
      ZOOMS.map((zoom) => [width, zoom] as const),
    ),
  )(
    "keeps command geometry deterministic at %ipx and %sx zoom",
    (viewportWidth, zoom) => {
      const canvasRect = {
        left: 0,
        top: 0,
        width: viewportWidth,
        height: 900,
      };
      const paperRect = makePaperRect(viewportWidth, zoom);
      const layout = computeDocumentCommandLayerLayout({
        canvasRect,
        paperRect,
        zoom,
        toolbarNaturalWidth: 680,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth,
      });

      expect(layout.toolbarRect.width).toBeGreaterThanOrEqual(
        TOOLBAR_MIN_WIDTH,
      );
      expect(layout.toolbarRect.top).toBeLessThanOrEqual(paperRect.top);
      expect(layout.toolbarRect.top).toBeGreaterThanOrEqual(
        Math.min(STICKY_TOP, paperRect.top - GAP - TOOLBAR_HEIGHT),
      );
      expect(layout.toolbarSticky).toBe(false);
      expect(bottom(layout.toolbarRect) + GAP).toBeLessThanOrEqual(
        paperRect.top + 0.5,
      );
      expect(layout.askRect.top).toBe(layout.commandLayerY);
      expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);

      const draftWidth =
        layout.draftLabelMode === "full"
          ? 124
          : layout.draftLabelMode === "short"
            ? 82
            : 34;
      expect(
        intersects(
          layout.askRect,
          makeDraftRect(layout.toolbarRect, draftWidth),
        ),
      ).toBe(false);

      const safeRight = right(canvasRect) - SAFE_MARGIN;
      if (layout.askMode === "iconOnly") {
        expect(layout.askRect.left).toBeGreaterThanOrEqual(
          Math.min(right(paperRect) + GAP, right(layout.toolbarRect) + GAP) -
            0.5,
        );
      } else {
        expect(layout.askConstrained).toBe(true);
        expect(layout.askRect.left).toBeGreaterThanOrEqual(
          canvasRect.left + SAFE_MARGIN - 0.5,
        );
        expect(right(layout.askRect)).toBeLessThanOrEqual(safeRight + 0.5);
      }

      if (!layout.toolbarClamped) {
        const paperCenter = paperRect.left + paperRect.width / 2;
        const toolbarCenter =
          layout.toolbarRect.left + layout.toolbarRect.width / 2;
        expect(Math.abs(toolbarCenter - paperCenter)).toBeLessThanOrEqual(0.5);
      }

      if (layout.toolbarRect.width >= 640) {
        expect(layout.toolbarMode).toBe("wide");
      } else if (layout.toolbarRect.width >= 520) {
        expect(layout.toolbarMode).toBe("medium");
      } else if (layout.toolbarRect.width >= 360) {
        expect(layout.toolbarMode).toBe("compact");
      } else {
        expect(layout.toolbarMode).toBe("ultraCompact");
      }

      if (layout.toolbarMode === "ultraCompact" || viewportWidth < 520) {
        expect(layout.draftLabelMode).toBe("iconOnly");
      } else if (layout.toolbarRect.width >= 520 && paperRect.width >= 640) {
        expect(layout.draftLabelMode).toBe("full");
      } else if (layout.toolbarRect.width >= 360) {
        expect(layout.draftLabelMode).toBe("short");
      } else {
        expect(layout.draftLabelMode).toBe("iconOnly");
      }
    },
  );

  it.each(
    SURFACES.flatMap((surface) =>
      THEMES.flatMap((theme) =>
        HARD_INVARIANT_ZOOMS.map(
          (zoom) =>
            [surface.name, theme, zoom, surface.toolbarNaturalWidth] as const,
        ),
      ),
    ),
  )(
    "keeps %s toolbar above paper at rest in %s mode at %sx zoom",
    (_surfaceName, _theme, zoom, toolbarNaturalWidth) => {
      const viewportWidth = 1280;
      const canvasRect = {
        left: 0,
        top: 0,
        width: viewportWidth,
        height: 900,
      };
      const paperRect = makePaperRect(viewportWidth, zoom);
      const layout = computeDocumentCommandLayerLayout({
        canvasRect,
        paperRect,
        zoom,
        toolbarNaturalWidth,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth,
      });

      expect(layout.toolbarSticky).toBe(false);
      expect(layout.commandLayerY).toBe(paperRect.top - TOOLBAR_HEIGHT - GAP);
      expect(bottom(layout.toolbarRect) + GAP).toBeLessThanOrEqual(
        paperRect.top + 0.5,
      );
      expect(intersects(layout.toolbarRect, paperRect)).toBe(false);
      expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);
      expect(layout.toolbarRect.width).toBeGreaterThanOrEqual(
        TOOLBAR_MIN_WIDTH,
      );

      if (!layout.toolbarClamped) {
        const paperCenter = paperRect.left + paperRect.width / 2;
        const toolbarCenter =
          layout.toolbarRect.left + layout.toolbarRect.width / 2;
        expect(Math.abs(toolbarCenter - paperCenter)).toBeLessThanOrEqual(0.5);
      }
    },
  );

  it("keeps constrained Ask inside the viewport edge without toolbar overlap", () => {
    const canvasRect = {
      left: 0,
      top: 0,
      width: 390,
      height: 720,
    };
    const layout = computeDocumentCommandLayerLayout({
      canvasRect,
      paperRect: {
        left: 98,
        top: 80,
        width: 330,
        height: 467,
      },
      zoom: 1,
      toolbarNaturalWidth: 680,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 390,
    });

    expect(right(layout.askRect)).toBeLessThanOrEqual(
      right(canvasRect) - SAFE_MARGIN + 0.5,
    );
    expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);
  });

  it("keeps Ask on the paper side while the paper-side placement fits outside the toolbar", () => {
    const paperRect = {
      left: 320,
      top: 80,
      width: 640,
      height: 382,
    };
    const layout = computeDocumentCommandLayerLayout({
      canvasRect: {
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
      },
      paperRect,
      zoom: 0.34,
      toolbarNaturalWidth: 520,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 1280,
    });

    expect(layout.askMode).toBe("iconOnly");
    expect(layout.askOutsidePaper).toBe(true);
    expect(layout.askRect.left).toBe(right(paperRect) + GAP);
  });

  it("clamps Ask near the visible paper edge instead of jumping back to the toolbar side", () => {
    const paperRect = {
      left: 129.6,
      top: PAPER_TOP,
      width: 1111.2,
      height: 1572.2,
    };
    const layout = computeDocumentCommandLayerLayout({
      canvasRect: {
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
      },
      paperRect,
      zoom: 1.4,
      toolbarNaturalWidth: 520,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 1280,
    });

    expect(layout.askMode).toBe("edgeTab");
    expect(layout.askRect.left).toBeGreaterThanOrEqual(
      right(paperRect) - ASK_ICON_WIDTH - GAP - 0.5,
    );
    expect(layout.askRect.left).toBeGreaterThan(
      right(layout.toolbarRect) + GAP,
    );
    expect(right(layout.askRect)).toBeLessThanOrEqual(
      1280 - SAFE_MARGIN + 0.5,
    );
    expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);
  });

  it("centers the toolbar over a low-zoom paper before placing Ask", () => {
    const paperRect = {
      left: 521,
      top: PAPER_TOP,
      width: 238.2,
      height: 336.9,
    };
    const layout = computeDocumentCommandLayerLayout({
      canvasRect: {
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
      },
      paperRect,
      zoom: 0.3,
      toolbarNaturalWidth: 680,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 1280,
    });

    expect(centerX(layout.toolbarRect)).toBeCloseTo(centerX(paperRect), 1);
    expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);
  });

  it("pins the toolbar to the sticky top while the paper remains visible", () => {
    const layout = computeDocumentCommandLayerLayout({
      canvasRect: {
        left: 0,
        top: -240,
        width: 1024,
        height: 900,
      },
      paperRect: {
        left: 115,
        top: -120,
        width: BASE_PAPER_WIDTH,
        height: BASE_PAPER_HEIGHT,
      },
      zoom: 1,
      toolbarNaturalWidth: 680,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 1024,
    });

    expect(layout.toolbarSticky).toBe(true);
    expect(layout.commandLayerY).toBe(STICKY_TOP);
    expect(layout.toolbarRect.top).toBe(STICKY_TOP);
    expect(layout.askRect.top).toBe(STICKY_TOP);
  });

  it("keeps the command layer pinned to the same sticky top near the paper bottom", () => {
    const layout = computeDocumentCommandLayerLayout({
      canvasRect: {
        left: 0,
        top: -1200,
        width: 1024,
        height: 900,
      },
      paperRect: {
        left: 115,
        top: -1080,
        width: BASE_PAPER_WIDTH,
        height: BASE_PAPER_HEIGHT,
      },
      zoom: 1,
      toolbarNaturalWidth: 680,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth: 1024,
    });

    expect(layout.toolbarSticky).toBe(true);
    expect(layout.commandLayerY).toBe(STICKY_TOP);
    expect(layout.toolbarRect.top).toBe(STICKY_TOP);
    expect(layout.askRect.top).toBe(STICKY_TOP);
  });

  it.each([
    [700, "wide", undefined],
    [640, "wide", undefined],
    [639, "medium", undefined],
    [520, "medium", undefined],
    [519, "compact", "compact"],
    [360, "compact", "compact"],
    [359, "ultraCompact", "ultra"],
    [300, "ultraCompact", "ultra"],
  ] as const)(
    "uses one toolbar density mapping at %ipx",
    (paperWidth, toolbarMode, density) => {
      const layout = computeDocumentCommandLayerLayout({
        canvasRect: {
          left: 0,
          top: 0,
          width: 1280,
          height: 720,
        },
        paperRect: {
          left: 100,
          top: PAPER_TOP,
          width: paperWidth,
          height: BASE_PAPER_HEIGHT,
        },
        zoom: paperWidth / BASE_PAPER_WIDTH,
        toolbarNaturalWidth: 680,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth: 1280,
      });

      expect(layout.toolbarMode).toBe(toolbarMode);
      expect(getCommandLayerToolbarDensity(layout.toolbarMode)).toBe(density);
    },
  );

  it.each([390, 480, 768, 1024, 1280].flatMap((viewportWidth) =>
    [0.3, 0.5, 0.75, 1, 1.5, 2].map((zoom) => [viewportWidth, zoom] as const),
  ))(
    "uses the same Ask y baseline for CV and Proposal at %ipx and %sx zoom",
    (viewportWidth, zoom) => {
      const canvasRect = {
        left: 0,
        top: 0,
        width: viewportWidth,
        height: 900,
      };
      const paperRect = makePaperRect(viewportWidth, zoom);
      const common = {
        canvasRect,
        paperRect,
        zoom,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth,
      };
      const proposal = computeDocumentCommandLayerLayout({
        ...common,
        toolbarNaturalWidth: 680,
      });
      const cv = computeDocumentCommandLayerLayout({
        ...common,
        toolbarNaturalWidth: 520,
      });

      expect(proposal.askRect.top).toBe(proposal.commandLayerY);
      expect(cv.askRect.top).toBe(cv.commandLayerY);
      expect(cv.askRect.top).toBe(proposal.askRect.top);
      expect(intersects(proposal.askRect, proposal.toolbarRect)).toBe(false);
      expect(intersects(cv.askRect, cv.toolbarRect)).toBe(false);
    },
  );

  it("keeps CV and Proposal Ask at the same visible-edge clamp at max zoom", () => {
    const viewportWidth = 1280;
    const zoom = 2;
    const canvasRect = {
      left: 0,
      top: 0,
      width: viewportWidth,
      height: 900,
    };
    const paperRect = makePaperRect(viewportWidth, zoom);
    const common = {
      canvasRect,
      paperRect,
      zoom,
      toolbarMinWidth: TOOLBAR_MIN_WIDTH,
      toolbarHeight: TOOLBAR_HEIGHT,
      stickyTop: STICKY_TOP,
      askHandle: {
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
      viewportWidth,
    };
    const proposal = computeDocumentCommandLayerLayout({
      ...common,
      toolbarNaturalWidth: 680,
    });
    const cv = computeDocumentCommandLayerLayout({
      ...common,
      toolbarNaturalWidth: 520,
    });

    expect(cv.askMode).toBe("edgeTab");
    expect(proposal.askMode).toBe("edgeTab");
    expect(cv.askRect.left).toBe(proposal.askRect.left);
    expect(right(cv.askRect)).toBe(viewportWidth - SAFE_MARGIN - GAP);
    expect(right(proposal.askRect)).toBe(viewportWidth - SAFE_MARGIN - GAP);
    expect(intersects(cv.askRect, cv.toolbarRect)).toBe(false);
    expect(intersects(proposal.askRect, proposal.toolbarRect)).toBe(false);
  });

  it("does not jump Ask down across adjacent constrained widths", () => {
    const askTops = [520, 540, 560].map((viewportWidth) => {
      const layout = computeDocumentCommandLayerLayout({
        canvasRect: {
          left: 0,
          top: 0,
          width: viewportWidth,
          height: 900,
        },
        paperRect: makePaperRect(viewportWidth, 0.3),
        zoom: 0.3,
        toolbarNaturalWidth: 520,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth,
      });
      return layout.askRect.top;
    });

    expect(Math.max(...askTops) - Math.min(...askTops)).toBeLessThanOrEqual(0);
  });

  it("keeps constrained Ask x anchored to the same visible edge across the old width threshold", () => {
    const askLefts = [500, 520, 540].map((viewportWidth) => {
      const layout = computeDocumentCommandLayerLayout({
        canvasRect: {
          left: 0,
          top: 0,
          width: viewportWidth,
          height: 900,
        },
        paperRect: {
          left: 180,
          top: PAPER_TOP,
          width: 520,
          height: 735,
        },
        zoom: 0.65,
        toolbarNaturalWidth: 520,
        toolbarMinWidth: TOOLBAR_MIN_WIDTH,
        toolbarHeight: TOOLBAR_HEIGHT,
        stickyTop: STICKY_TOP,
        askHandle: {
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
        viewportWidth,
      });

      expect(layout.askMode).toBe("edgeTab");
      expect(right(layout.askRect)).toBeLessThanOrEqual(
        viewportWidth - SAFE_MARGIN + 0.5,
      );
      return layout.askRect.left;
    });

    expect(askLefts).toEqual([444, 464, 484]);
  });
});
