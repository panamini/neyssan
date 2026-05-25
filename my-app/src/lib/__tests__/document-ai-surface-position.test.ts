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
});
