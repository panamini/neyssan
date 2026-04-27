import React from "react";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";

type UseDocumentStageLayoutOptions = {
  enabled?: boolean;
  measurementRef: React.RefObject<HTMLElement | null>;
  zoomLevel?: number;
  fitMode?: "width" | "contain";
  fillAvailableOnZoom?: boolean;
  includeParentMeasurement?: boolean;
  pageWidthPx?: number;
  pageHeightPx?: number;
  initialAvailableWidthPx?: number;
  initialAvailableHeightPx?: number;
};

type StageMeasurement = {
  availableWidth: number;
  availableHeight: number;
};

function measureAvailableSize(
  element: HTMLElement,
  dimension: "width" | "height",
) {
  const styles = window.getComputedStyle(element);
  const clientSize =
    dimension === "width" ? element.clientWidth : element.clientHeight;
  const paddingStart = Number.parseFloat(
    dimension === "width" ? styles.paddingLeft || "0" : styles.paddingTop || "0",
  );
  const paddingEnd = Number.parseFloat(
    dimension === "width"
      ? styles.paddingRight || "0"
      : styles.paddingBottom || "0",
  );

  return clientSize - paddingStart - paddingEnd;
}

export type DocumentStageLayout = {
  fitScale: number;
  availableWidth: number;
  availableHeight: number;
  stageWidth: number;
  stageHeight: number;
  pageWidth: number;
  pageHeight: number;
  overflowX: boolean;
  overflowY: boolean;
  isFit: boolean;
};

function roundPx(value: number) {
  return Math.round(value * 100) / 100;
}

export function useDocumentStageLayout({
  enabled = true,
  measurementRef,
  zoomLevel = 1,
  fitMode = "width",
  fillAvailableOnZoom = false,
  includeParentMeasurement = true,
  pageWidthPx = A4_PAGE_WIDTH_PX,
  pageHeightPx = A4_PAGE_HEIGHT_PX,
  initialAvailableWidthPx = 560,
  initialAvailableHeightPx = pageHeightPx,
}: UseDocumentStageLayoutOptions) {
  const [measurement, setMeasurement] = React.useState<StageMeasurement>({
    availableWidth: initialAvailableWidthPx,
    availableHeight: initialAvailableHeightPx,
  });

  React.useLayoutEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const node = measurementRef.current;
    if (!node) {
      return undefined;
    }

    let frameId: number | null = null;

    const measure = () => {
      const availableWidth = Math.max(
        measureAvailableSize(node, "width"),
        includeParentMeasurement && node.parentElement
          ? measureAvailableSize(node.parentElement, "width")
          : 0,
      );
      const availableHeight = Math.max(
        measureAvailableSize(node, "height"),
        includeParentMeasurement && node.parentElement
          ? measureAvailableSize(node.parentElement, "height")
          : 0,
      );

      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }

      setMeasurement((current) =>
        Math.abs(current.availableWidth - availableWidth) > 0.5 ||
        Math.abs(current.availableHeight - availableHeight) > 0.5
          ? { availableWidth, availableHeight }
          : current,
      );
    };

    const scheduleMeasure = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    measure();
    scheduleMeasure();

    const resizeObserver = new ResizeObserver(() => {
      scheduleMeasure();
    });
    resizeObserver.observe(node);
    if (node.parentElement) {
      resizeObserver.observe(node.parentElement);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [enabled, includeParentMeasurement, measurementRef]);

  const widthFitScale = measurement.availableWidth / pageWidthPx;
  const heightFitScale = measurement.availableHeight / pageHeightPx;
  const fitScale = enabled
    ? Math.min(
        1,
        fitMode === "contain"
          ? Math.min(widthFitScale, heightFitScale)
          : widthFitScale,
      )
    : 1;
  const usesFilledOverflowStage =
    enabled && fillAvailableOnZoom && zoomLevel > 1 + 0.001;
  const stageWidth = roundPx(
    usesFilledOverflowStage
      ? measurement.availableWidth
      : pageWidthPx * fitScale,
  );
  const stageHeight = roundPx(
    usesFilledOverflowStage
      ? measurement.availableHeight
      : pageHeightPx * fitScale,
  );
  const overflowFitScale =
    usesFilledOverflowStage && fitMode === "contain"
      ? Math.min(1, widthFitScale)
      : fitScale;
  const fittedPageWidth = pageWidthPx * overflowFitScale;
  const fittedPageHeight = pageHeightPx * overflowFitScale;
  const pageWidth = roundPx(
    (usesFilledOverflowStage ? fittedPageWidth : stageWidth) * zoomLevel,
  );
  const pageHeight = roundPx(
    (usesFilledOverflowStage ? fittedPageHeight : stageHeight) * zoomLevel,
  );
  const overflowX = pageWidth > stageWidth + 1;
  const overflowY = pageHeight > stageHeight + 1;
  const isFit = Math.abs(zoomLevel - 1) < 0.001;

  return {
    fitScale,
    availableWidth: measurement.availableWidth,
    availableHeight: measurement.availableHeight,
    stageWidth,
    stageHeight,
    pageWidth,
    pageHeight,
    overflowX,
    overflowY,
    isFit,
  } satisfies DocumentStageLayout;
}
