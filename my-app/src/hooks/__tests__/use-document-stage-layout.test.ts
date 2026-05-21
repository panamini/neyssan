import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStageLayout } from "../use-document-stage-layout";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../../lib/document-stage";

class ResizeObserverMock {
  observe() {}

  disconnect() {}
}

function createMeasurementNode({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const node = document.createElement("div");
  Object.defineProperty(node, "clientWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(node, "clientHeight", {
    configurable: true,
    value: height,
  });
  return node;
}

function attachMeasurementParent(
  node: HTMLDivElement,
  {
    width,
    height,
  }: {
    width: number;
    height: number;
  },
) {
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(parent, "clientHeight", {
    configurable: true,
    value: height,
  });
  parent.appendChild(node);
  document.body.appendChild(parent);
  return parent;
}

describe("useDocumentStageLayout", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves A4 aspect ratio for zoomed overflow stages", async () => {
    const measurementRef = {
      current: createMeasurementNode({ width: 600, height: 800 }),
    } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useDocumentStageLayout({
        measurementRef,
        zoomLevel: 2,
        fillAvailableOnZoom: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.stageWidth).toBe(600);
      expect(result.current.stageHeight).toBe(800);
    });

    const expectedFitScale = 600 / A4_PAGE_WIDTH_PX;
    const expectedPageWidth = A4_PAGE_WIDTH_PX * expectedFitScale * 2;
    const expectedPageHeight = A4_PAGE_HEIGHT_PX * expectedFitScale * 2;

    expect(result.current.pageWidth).toBeCloseTo(expectedPageWidth, 2);
    expect(result.current.pageHeight).toBeCloseTo(expectedPageHeight, 2);
    expect(result.current.pageHeight).toBeGreaterThan(result.current.stageHeight);
    expect(result.current.overflowY).toBe(true);
  });

  it("uses width-fit overflow sizing for contained workspace zoom", async () => {
    const measurementRef = {
      current: createMeasurementNode({ width: 600, height: 800 }),
    } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useDocumentStageLayout({
        measurementRef,
        zoomLevel: 1.25,
        fitMode: "contain",
        fillAvailableOnZoom: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.stageWidth).toBe(600);
      expect(result.current.stageHeight).toBe(800);
    });

    const expectedWidthFitScale = 600 / A4_PAGE_WIDTH_PX;

    expect(result.current.pageWidth).toBeCloseTo(600 * 1.25, 2);
    expect(result.current.pageHeight).toBeCloseTo(
      A4_PAGE_HEIGHT_PX * expectedWidthFitScale * 1.25,
      2,
    );
    expect(result.current.overflowX).toBe(true);
    expect(result.current.overflowY).toBe(true);
  });

  it("keeps the fit-mode stage tight to the fitted page instead of filling the viewport", async () => {
    const measurementRef = {
      current: createMeasurementNode({ width: 600, height: 800 }),
    } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useDocumentStageLayout({
        measurementRef,
        zoomLevel: 1,
        fitMode: "contain",
        fillAvailableOnZoom: true,
      }),
    );

    const expectedFitScale = Math.min(
      600 / A4_PAGE_WIDTH_PX,
      800 / A4_PAGE_HEIGHT_PX,
    );
    const expectedPageWidth = A4_PAGE_WIDTH_PX * expectedFitScale;
    const expectedPageHeight = A4_PAGE_HEIGHT_PX * expectedFitScale;

    await waitFor(() => {
      expect(result.current.stageWidth).toBeCloseTo(expectedPageWidth, 2);
      expect(result.current.stageHeight).toBeCloseTo(expectedPageHeight, 2);
    });

    expect(result.current.pageWidth).toBeCloseTo(expectedPageWidth, 2);
    expect(result.current.pageHeight).toBeCloseTo(expectedPageHeight, 2);
    expect(result.current.pageWidth).toBe(result.current.stageWidth);
    expect(result.current.pageHeight).toBe(result.current.stageHeight);
    expect(result.current.overflowX).toBe(false);
    expect(result.current.overflowY).toBe(false);
  });

  it("falls back to the parent viewport size when the stage node collapses", async () => {
    const collapsedNode = createMeasurementNode({ width: 28, height: 120 });
    const parent = attachMeasurementParent(collapsedNode, {
      width: 640,
      height: 860,
    });
    const measurementRef = {
      current: collapsedNode,
    } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useDocumentStageLayout({
        measurementRef,
        fitMode: "width",
      }),
    );

    await waitFor(() => {
      expect(result.current.availableWidth).toBe(640);
      expect(result.current.availableHeight).toBe(860);
    });

    expect(result.current.stageWidth).toBeCloseTo(640, 2);
    expect(result.current.pageWidth).toBeCloseTo(640, 2);

    parent.remove();
  });

  it("can ignore parent measurement when the stage padding owns the page width", async () => {
    const paddedNode = createMeasurementNode({ width: 576, height: 820 });
    const parent = attachMeasurementParent(paddedNode, {
      width: 576,
      height: 820,
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element: Element) =>
        ({
          paddingLeft: element === paddedNode ? "8px" : "0px",
          paddingRight: element === paddedNode ? "8px" : "0px",
          paddingTop: "0px",
          paddingBottom: "0px",
        }) as CSSStyleDeclaration,
    );
    const measurementRef = {
      current: paddedNode,
    } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useDocumentStageLayout({
        measurementRef,
        fitMode: "width",
        includeParentMeasurement: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.availableWidth).toBe(560);
    });

    expect(result.current.pageWidth).toBeCloseTo(560, 2);

    parent.remove();
  });

  it.each([390, 480, 768, 1024, 1280].flatMap((width) =>
    [0.3, 0.5, 0.9, 1, 1.5, 2].map((zoom) => [width, zoom] as const),
  ))(
    "keeps manual zoom as the page scale at %ipx and %sx",
    async (width, zoom) => {
      const measurementRef = {
        current: createMeasurementNode({ width, height: 820 }),
      } as React.RefObject<HTMLDivElement>;

      const { result } = renderHook(() =>
        useDocumentStageLayout({
          measurementRef,
          zoomLevel: zoom,
          fitMode: "none",
        }),
      );

      await waitFor(() => {
        expect(result.current.availableWidth).toBe(width);
      });

      expect(result.current.fitScale).toBe(1);
      expect(result.current.pageWidth).toBeCloseTo(
        A4_PAGE_WIDTH_PX * zoom,
        2,
      );
      expect(result.current.pageHeight).toBeCloseTo(
        A4_PAGE_HEIGHT_PX * zoom,
        2,
      );
    },
  );
});
