import { describe, expect, it } from "vitest";
import {
  computeDocumentCommandLayerLayout,
  type CommandLayerRect,
} from "../document-command-layer-layout";

const VIEWPORT_WIDTHS = [390, 480, 768, 1024, 1280, 1440] as const;
const ZOOMS = [0.3, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const BASE_PAPER_WIDTH = 794;
const BASE_PAPER_HEIGHT = 1123;
const TOOLBAR_MIN_WIDTH = 300;
const TOOLBAR_HEIGHT = 44;
const SAFE_MARGIN = 12;
const GAP = 12;
const ASK_ICON_WIDTH = 32;
const ASK_LABEL_WIDTH = 76;
const ASK_HEIGHT = 32;
const PAPER_TOP = 80;

function right(rect: CommandLayerRect) {
  return rect.left + rect.width;
}

function bottom(rect: CommandLayerRect) {
  return rect.top + rect.height;
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

function makeDraftRect(toolbarRect: CommandLayerRect, draftWidth: number): CommandLayerRect {
  return {
    left: right(toolbarRect) - draftWidth - 8,
    top: toolbarRect.top + 5,
    width: draftWidth,
    height: 34,
  };
}

describe("computeDocumentCommandLayerLayout", () => {
  it.each(VIEWPORT_WIDTHS.flatMap((width) => ZOOMS.map((zoom) => [width, zoom] as const)))(
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
        askHandle: {
          labeledWidth: ASK_LABEL_WIDTH,
          iconWidth: ASK_ICON_WIDTH,
          height: ASK_HEIGHT,
        },
        safeMargin: SAFE_MARGIN,
        gap: GAP,
        topOffset: 16,
        viewportWidth,
      });

      expect(layout.toolbarRect.width).toBeGreaterThanOrEqual(TOOLBAR_MIN_WIDTH);
      expect(layout.toolbarRect.top).toBeLessThanOrEqual(paperRect.top);
      expect(layout.askRect.top).toBeLessThanOrEqual(paperRect.top + 40);
      expect(intersects(layout.askRect, layout.toolbarRect)).toBe(false);

      const draftWidth =
        layout.draftLabelMode === "full"
          ? 124
          : layout.draftLabelMode === "short"
            ? 82
            : 34;
      expect(intersects(layout.askRect, makeDraftRect(layout.toolbarRect, draftWidth))).toBe(false);

      const safeRight = right(canvasRect) - SAFE_MARGIN;
      const outsideLabeledFits = right(paperRect) + GAP + ASK_LABEL_WIDTH <= safeRight;
      const outsideIconFits = right(paperRect) + GAP + ASK_ICON_WIDTH <= safeRight;
      if (outsideLabeledFits) {
        expect(layout.askMode).toBe("labeled");
        expect(layout.askOutsidePaper).toBe(true);
        expect(layout.askRect.left).toBeGreaterThanOrEqual(right(paperRect) + GAP - 0.5);
      } else if (outsideIconFits) {
        expect(layout.askMode).toBe("iconOnly");
        expect(layout.askOutsidePaper).toBe(true);
        expect(layout.askRect.left).toBeGreaterThanOrEqual(right(paperRect) + GAP - 0.5);
      } else {
        expect(layout.askMode).toBe("edgeTab");
        expect(layout.askConstrained).toBe(true);
        expect(layout.askRect.left).toBeGreaterThanOrEqual(canvasRect.left + SAFE_MARGIN - 0.5);
        expect(right(layout.askRect)).toBeLessThanOrEqual(safeRight + 0.5);
      }

      if (!layout.toolbarClamped) {
        const paperCenter = paperRect.left + paperRect.width / 2;
        const toolbarCenter = layout.toolbarRect.left + layout.toolbarRect.width / 2;
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

  it("anchors constrained Ask to the viewport edge in the narrow collapsed window", () => {
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
      askHandle: {
        labeledWidth: ASK_LABEL_WIDTH,
        iconWidth: ASK_ICON_WIDTH,
        height: ASK_HEIGHT,
      },
      safeMargin: SAFE_MARGIN,
      gap: GAP,
      topOffset: 16,
      viewportWidth: 390,
    });

    expect(layout.askMode).toBe("edgeTab");
    expect(right(layout.askRect)).toBe(right(canvasRect) - SAFE_MARGIN);
  });
});
