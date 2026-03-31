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
  pageWidthPx?: number;
  pageHeightPx?: number;
  initialAvailableWidthPx?: number;
  initialAvailableHeightPx?: number;
};

type StageMeasurement = {
  availableWidth: number;
  availableHeight: number;
};

export type DocumentStageLayout = {
  fitScale: number;
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
      const styles = window.getComputedStyle(node);
      const availableWidth =
        node.clientWidth -
        Number.parseFloat(styles.paddingLeft || "0") -
        Number.parseFloat(styles.paddingRight || "0");
      const availableHeight =
        node.clientHeight -
        Number.parseFloat(styles.paddingTop || "0") -
        Number.parseFloat(styles.paddingBottom || "0");

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
  }, [enabled, measurementRef]);

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
    stageWidth,
    stageHeight,
    pageWidth,
    pageHeight,
    overflowX,
    overflowY,
    isFit,
  } satisfies DocumentStageLayout;
}
