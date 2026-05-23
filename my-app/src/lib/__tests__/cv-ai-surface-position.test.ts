import { describe, expect, it } from "vitest";
import {
  computeCvAiSurfacePlacement,
  type CvAiSurfaceRect,
} from "../cv-ai-surface-position";
import type { EditorSelectionAnchor } from "../editor-ai-selection";

const viewport: CvAiSurfaceRect = {
  left: 0,
  top: 0,
  right: 1280,
  bottom: 720,
  width: 1280,
  height: 720,
};

const stage: CvAiSurfaceRect = {
  left: 120,
  top: 96,
  right: 1080,
  bottom: 680,
  width: 960,
  height: 584,
};

const anchor: EditorSelectionAnchor = {
  left: 520,
  top: 430,
  bottom: 450,
  leftEdge: 420,
  rightEdge: 620,
  aboveCenter: 520,
  aboveLeft: 420,
  aboveRight: 620,
  belowCenter: 520,
  belowLeft: 420,
  belowRight: 620,
  containerLeft: stage.left,
  containerRight: stage.right,
  containerTop: stage.top,
  containerBottom: stage.bottom,
};

describe("computeCvAiSurfacePlacement", () => {
  it("keeps toolbar, loading, and result on the same anchor while result prioritizes below", () => {
    const toolbar = computeCvAiSurfacePlacement({
      anchor,
      visibleStageRect: stage,
      viewportRect: viewport,
      desiredSurfaceSize: { width: 220, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
    });
    const loading = computeCvAiSurfacePlacement({
      anchor,
      visibleStageRect: stage,
      viewportRect: viewport,
      desiredSurfaceSize: { width: 420, height: 160, minHeight: 120 },
      mode: "loading",
      breakpoint: "desktop",
      preferredPlacement: toolbar.placement,
    });
    const result = computeCvAiSurfacePlacement({
      anchor,
      visibleStageRect: stage,
      viewportRect: viewport,
      desiredSurfaceSize: { width: 420, height: 320, minHeight: 156 },
      mode: "result",
      breakpoint: "desktop",
      preferredPlacement: toolbar.placement,
    });

    expect(toolbar.placement).toBe("above");
    expect(loading.placement).toBe("below");
    expect(result.placement).toBe("below");
    expect(result.top).toBe(anchor.bottom + 8);
  });

  it("prioritizes below then above before side placement for result surfaces", () => {
    const result = computeCvAiSurfacePlacement({
      anchor,
      visibleStageRect: stage,
      viewportRect: viewport,
      desiredSurfaceSize: { width: 420, height: 240, minHeight: 156 },
      mode: "result",
      breakpoint: "desktop",
    });

    expect(result.placement).toBe("below");
    expect(result.left).toBeGreaterThanOrEqual(stage.left);
    expect(result.left + result.maxWidth).toBeLessThanOrEqual(stage.right);
  });

  it("keeps the surface out from under the left CV library drawer", () => {
    const drawer: CvAiSurfaceRect = {
      left: 88,
      top: 0,
      right: 360,
      bottom: 720,
      width: 272,
      height: 720,
    };
    const nearDrawerAnchor: EditorSelectionAnchor = {
      ...anchor,
      left: 300,
      leftEdge: 250,
      rightEdge: 330,
      aboveCenter: 300,
      aboveLeft: 250,
      aboveRight: 330,
    };
    const toolbar = computeCvAiSurfacePlacement({
      anchor: nearDrawerAnchor,
      visibleStageRect: { ...stage, left: 88 },
      leftDrawerRect: drawer,
      viewportRect: viewport,
      desiredSurfaceSize: { width: 220, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
    });

    expect(toolbar.left).toBeGreaterThanOrEqual(drawer.right + 12);
  });

  it("keeps toolbar horizontal position anchored to selected text bounds instead of the drag focus caret", () => {
    const selectionAnchor: EditorSelectionAnchor = {
      left: 680,
      top: 200,
      bottom: 216,
      leftEdge: 620,
      rightEdge: 740,
      width: 120,
      aboveCenter: 680,
      aboveLeft: 620,
      aboveRight: 740,
      aboveLineHeight: 20,
      belowCenter: 680,
      belowLeft: 620,
      belowRight: 740,
      belowLineHeight: 20,
      containerLeft: 100,
      containerRight: 800,
      containerTop: 0,
      containerBottom: 500,
    };
    const leftFocus = computeCvAiSurfacePlacement({
      anchor: {
        ...selectionAnchor,
        focusCenter: 620,
        focusLeft: 620,
        focusRight: 620,
        focusTop: 200,
        focusBottom: 216,
        focusLineHeight: 20,
      },
      visibleStageRect: {
        left: 100,
        top: 0,
        right: 800,
        bottom: 500,
        width: 700,
        height: 500,
      },
      viewportRect: viewport,
      desiredSurfaceSize: { width: 220, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
    });
    const rightFocus = computeCvAiSurfacePlacement({
      anchor: {
        ...selectionAnchor,
        focusCenter: 740,
        focusLeft: 740,
        focusRight: 740,
        focusTop: 200,
        focusBottom: 216,
        focusLineHeight: 20,
      },
      visibleStageRect: {
        left: 100,
        top: 0,
        right: 800,
        bottom: 500,
        width: 700,
        height: 500,
      },
      viewportRect: viewport,
      desiredSurfaceSize: { width: 220, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
    });

    expect(leftFocus.left).toBe(570);
    expect(rightFocus.left).toBe(leftFocus.left);
  });

  it("keeps toolbar horizontal position stable when placement flips above or below a multiline selection", () => {
    const multilineAnchor: EditorSelectionAnchor = {
      left: 330,
      top: 120,
      bottom: 190,
      leftEdge: 120,
      rightEdge: 540,
      width: 420,
      height: 70,
      lineCount: 3,
      aboveCenter: 340,
      aboveLeft: 220,
      aboveRight: 460,
      aboveLineHeight: 20,
      belowCenter: 200,
      belowLeft: 120,
      belowRight: 280,
      belowLineHeight: 20,
      containerLeft: 100,
      containerRight: 800,
      containerTop: 0,
      containerBottom: 500,
    };

    const above = computeCvAiSurfacePlacement({
      anchor: multilineAnchor,
      visibleStageRect: {
        left: 100,
        top: 0,
        right: 800,
        bottom: 500,
        width: 700,
        height: 500,
      },
      viewportRect: viewport,
      desiredSurfaceSize: { width: 260, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
      preferredPlacement: "above",
    });
    const below = computeCvAiSurfacePlacement({
      anchor: multilineAnchor,
      visibleStageRect: {
        left: 100,
        top: 0,
        right: 800,
        bottom: 500,
        width: 700,
        height: 500,
      },
      viewportRect: viewport,
      desiredSurfaceSize: { width: 260, height: 48, minHeight: 36 },
      mode: "toolbar",
      breakpoint: "desktop",
      preferredPlacement: "below",
    });

    expect(above.placement).toBe("above");
    expect(below.placement).toBe("below");
    expect(above.left).toBe(200);
    expect(below.left).toBe(above.left);
  });

  it("allows AI chrome to overflow the paper horizontally within viewport safe margins", () => {
    const result = computeCvAiSurfacePlacement({
      anchor: {
        left: 145,
        top: 220,
        bottom: 240,
        leftEdge: 130,
        rightEdge: 180,
        containerLeft: 120,
        containerRight: 520,
        containerTop: 96,
        containerBottom: 680,
      },
      visibleStageRect: {
        left: 120,
        top: 96,
        right: 520,
        bottom: 680,
        width: 400,
        height: 584,
      },
      viewportRect: viewport,
      desiredSurfaceSize: { width: 420, height: 178, minHeight: 156 },
      mode: "result",
      breakpoint: "desktop",
      preferredSurfaceCenterX: 250,
    });

    expect(result.placement).toBe("below");
    expect(result.left).toBeLessThan(120);
    expect(result.left).toBeGreaterThanOrEqual(12);
  });

  it("uses sheet mode on narrow screens", () => {
    const narrowViewport: CvAiSurfaceRect = {
      left: 0,
      top: 0,
      right: 390,
      bottom: 760,
      width: 390,
      height: 760,
    };
    const result = computeCvAiSurfacePlacement({
      anchor,
      viewportRect: narrowViewport,
      desiredSurfaceSize: { width: 420, height: 320, minHeight: 156 },
      mode: "result",
      breakpoint: "narrow",
    });

    expect(result.mode).toBe("sheet");
    expect(result.placement).toBe("sheet");
    expect(result.left).toBe(12);
    expect(result.maxWidth).toBe(366);
  });

  it("centers result surfaces on the full selected text bounds, not the focus line", () => {
    const result = computeCvAiSurfacePlacement({
      anchor: {
        left: 430,
        top: 120,
        bottom: 176,
        leftEdge: 250,
        rightEdge: 610,
        width: 360,
        height: 56,
        lineCount: 3,
        focusCenter: 278,
        focusLeft: 270,
        focusRight: 286,
        focusTop: 120,
        focusBottom: 138,
        containerLeft: 20,
        containerRight: 640,
        containerTop: 0,
        containerBottom: 720,
      },
      visibleStageRect: {
        left: 20,
        top: 0,
        right: 640,
        bottom: 720,
        width: 620,
        height: 720,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 648,
        bottom: 380,
        width: 648,
        height: 380,
      },
      desiredSurfaceSize: { width: 420, height: 178, minHeight: 156 },
      mode: "result",
      breakpoint: "desktop",
      preferredPlacement: "below",
    });

    expect(result.placement).toBe("below");
    expect(result.left).toBeGreaterThanOrEqual(210);
  });

  it("aligns above and below result surfaces to the previous toolbar center", () => {
    const result = computeCvAiSurfacePlacement({
      anchor: {
        left: 430,
        top: 120,
        bottom: 176,
        leftEdge: 250,
        rightEdge: 610,
        width: 360,
        height: 56,
        lineCount: 3,
        focusCenter: 278,
        focusLeft: 270,
        focusRight: 286,
        focusTop: 120,
        focusBottom: 138,
        containerLeft: 20,
        containerRight: 840,
        containerTop: 0,
        containerBottom: 720,
      },
      visibleStageRect: {
        left: 20,
        top: 0,
        right: 840,
        bottom: 720,
        width: 820,
        height: 720,
      },
      viewportRect: {
        left: 0,
        top: 0,
        right: 900,
        bottom: 520,
        width: 900,
        height: 520,
      },
      desiredSurfaceSize: { width: 420, height: 178, minHeight: 156 },
      mode: "result",
      breakpoint: "desktop",
      preferredSurfaceCenterX: 456,
    });

    expect(result.placement).toBe("below");
    expect(result.left + result.maxWidth / 2).toBe(456);
  });
});
