import { describe, expect, it } from "vitest";

import {
  computeDocumentAiSurfacePlacement,
  type DocumentAiSurfaceRect,
} from "../document-ai-surface-position";
import { computeCvAiSurfacePlacement } from "../cv-ai-surface-position";
import type { EditorSelectionAnchor } from "../editor-ai-selection";

const viewport: DocumentAiSurfaceRect = {
  left: 0,
  top: 0,
  right: 1200,
  bottom: 900,
  width: 1200,
  height: 900,
};

const stage: DocumentAiSurfaceRect = {
  left: 260,
  top: 120,
  right: 940,
  bottom: 820,
  width: 680,
  height: 700,
};

const anchor: EditorSelectionAnchor = {
  left: 520,
  top: 340,
  bottom: 360,
  leftEdge: 460,
  rightEdge: 580,
  width: 120,
  height: 20,
  containerLeft: stage.left,
  containerRight: stage.right,
  containerTop: stage.top,
  containerBottom: stage.bottom,
};

describe("document-ai-surface-position compatibility", () => {
  it("keeps CV compatibility exports aligned with the shared engine", () => {
    const input = {
      anchor,
      visibleStageRect: stage,
      paperRect: stage,
      topIslandRect: null,
      leftDrawerRect: null,
      viewportRect: viewport,
      desiredSurfaceSize: {
        width: 420,
        height: 156,
        minWidth: 320,
        minHeight: 156,
      },
      mode: "result" as const,
      breakpoint: "desktop" as const,
    };

    expect(computeCvAiSurfacePlacement(input)).toEqual(
      computeDocumentAiSurfacePlacement(input),
    );
  });

  it("keeps normal toolbar placement anchored to the selection in short viewports", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 480,
        top: 260,
        bottom: 280,
        leftEdge: 450,
        rightEdge: 510,
        containerLeft: 76,
        containerRight: 964,
        containerTop: 56,
        containerBottom: 579,
      },
      visibleStageRect: {
        left: 76,
        top: 56,
        right: 964,
        bottom: 579,
        width: 888,
        height: 523,
      },
      paperRect: {
        left: 129,
        top: 56,
        right: 873,
        bottom: 579,
        width: 744,
        height: 523,
      },
      leftDrawerRect: {
        left: 0,
        top: 0,
        right: 76,
        bottom: 579,
        width: 76,
        height: 579,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 964,
        bottom: 579,
        width: 964,
        height: 579,
      },
      desiredSurfaceSize: { width: 520, height: 48, minWidth: 520, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "desktop",
    });

    expect(result.placement).toBe("above");
    expect(result.top).toBe(204);
    expect(result.left).not.toBe(241);
    expect(result.top).not.toBe(519);
  });

  it("keeps normal toolbar placement anchored to the selection at narrow breakpoints", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 320,
        top: 260,
        bottom: 280,
        leftEdge: 290,
        rightEdge: 350,
        containerLeft: 40,
        containerRight: 600,
        containerTop: 56,
        containerBottom: 720,
      },
      visibleStageRect: {
        left: 40,
        top: 56,
        right: 600,
        bottom: 720,
        width: 560,
        height: 664,
      },
      paperRect: {
        left: 80,
        top: 56,
        right: 560,
        bottom: 720,
        width: 480,
        height: 664,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 640,
        bottom: 720,
        width: 640,
        height: 720,
      },
      desiredSurfaceSize: { width: 220, height: 48, minWidth: 220, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "narrow",
      placementStrategy: "selectionAnchor",
    });

    expect(result.mode).toBe("popover");
    expect(result.placement).toBe("above");
    expect(result.left).toBe(210);
    expect(result.top).toBe(204);
  });

  it("uses a page-window bottom center strategy for collapsed toolbar placement", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 480,
        top: 90,
        bottom: 550,
        leftEdge: 450,
        rightEdge: 510,
        containerLeft: 76,
        containerRight: 964,
        containerTop: 56,
        containerBottom: 579,
      },
      visibleStageRect: {
        left: 76,
        top: 56,
        right: 964,
        bottom: 579,
        width: 888,
        height: 523,
      },
      paperRect: {
        left: 129,
        top: 56,
        right: 873,
        bottom: 579,
        width: 744,
        height: 523,
      },
      leftDrawerRect: {
        left: 0,
        top: 0,
        right: 76,
        bottom: 579,
        width: 76,
        height: 579,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 964,
        bottom: 579,
        width: 964,
        height: 579,
      },
      desiredSurfaceSize: { width: 520, height: 48, minWidth: 520, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "desktop",
      placementStrategy: "documentBottomCenter",
    });

    expect(result.placement).toBe("center");
    expect(result.left).toBe(241);
    expect(result.top).toBe(519);
    expect(result.left).toBeGreaterThan(76);
  });

  it("keeps collapsed toolbar centered at the page bottom even when below placement has room", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 480,
        top: 260,
        bottom: 280,
        leftEdge: 450,
        rightEdge: 510,
        containerLeft: 76,
        containerRight: 964,
        containerTop: 56,
        containerBottom: 579,
      },
      visibleStageRect: {
        left: 76,
        top: 56,
        right: 964,
        bottom: 579,
        width: 888,
        height: 523,
      },
      paperRect: {
        left: 129,
        top: 56,
        right: 873,
        bottom: 579,
        width: 744,
        height: 523,
      },
      leftDrawerRect: {
        left: 0,
        top: 0,
        right: 76,
        bottom: 579,
        width: 76,
        height: 579,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 964,
        bottom: 579,
        width: 964,
        height: 579,
      },
      desiredSurfaceSize: { width: 520, height: 48, minWidth: 520, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "desktop",
      placementStrategy: "documentBottomCenter",
    });

    expect(result.placement).toBe("center");
    expect(result.left).toBe(241);
    expect(result.top).toBe(519);
  });

  it("uses collapsed bottom center at narrow breakpoints instead of the sheet branch", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 320,
        top: 260,
        bottom: 280,
        leftEdge: 290,
        rightEdge: 350,
        containerLeft: 40,
        containerRight: 600,
        containerTop: 56,
        containerBottom: 720,
      },
      visibleStageRect: {
        left: 40,
        top: 56,
        right: 600,
        bottom: 720,
        width: 560,
        height: 664,
      },
      paperRect: {
        left: 80,
        top: 56,
        right: 560,
        bottom: 720,
        width: 480,
        height: 664,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 640,
        bottom: 720,
        width: 640,
        height: 720,
      },
      desiredSurfaceSize: { width: 220, height: 48, minWidth: 36, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "narrow",
      placementStrategy: "documentBottomCenter",
    });

    expect(result.mode).toBe("popover");
    expect(result.placement).toBe("center");
    expect(result.left).toBe(210);
    expect(result.top).toBe(660);
  });

  it("falls back to window bottom center for collapsed toolbar placement without a document rect", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 480,
        top: 260,
        bottom: 280,
        leftEdge: 450,
        rightEdge: 510,
        containerLeft: 0,
        containerRight: 964,
        containerTop: 0,
        containerBottom: 579,
      },
      leftDrawerRect: null,
      viewportRect: {
        left: 0,
        top: 0,
        right: 964,
        bottom: 579,
        width: 964,
        height: 579,
      },
      desiredSurfaceSize: { width: 520, height: 48, minWidth: 520, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "desktop",
      placementStrategy: "documentBottomCenter",
    });

    expect(result.placement).toBe("center");
    expect(result.left).toBe(222);
    expect(result.top).toBe(519);
  });

  it("keeps the large-window toolbar fallback centered in the page window", () => {
    const result = computeDocumentAiSurfacePlacement({
      anchor: {
        left: 480,
        top: 20,
        bottom: 880,
        leftEdge: 450,
        rightEdge: 510,
        containerLeft: 76,
        containerRight: 964,
        containerTop: 0,
        containerBottom: 900,
      },
      visibleStageRect: {
        left: 76,
        top: 0,
        right: 964,
        bottom: 900,
        width: 888,
        height: 900,
      },
      paperRect: {
        left: 129,
        top: 0,
        right: 873,
        bottom: 900,
        width: 744,
        height: 900,
      },
      leftDrawerRect: {
        left: 0,
        top: 0,
        right: 76,
        bottom: 900,
        width: 76,
        height: 900,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 964,
        bottom: 900,
        width: 964,
        height: 900,
      },
      desiredSurfaceSize: { width: 520, height: 48, minWidth: 520, minHeight: 48 },
      mode: "toolbar",
      breakpoint: "desktop",
    });

    expect(result.placement).toBe("center");
    expect(result.left).toBe(260);
    expect(result.top).toBe(426);
  });
});
