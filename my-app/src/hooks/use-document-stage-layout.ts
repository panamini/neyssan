import React from "react";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";

type UseDocumentStageLayoutOptions = {
  enabled?: boolean;
  measurementRef: React.RefObject<HTMLElement | null>;
  zoomLevel?: number;
  pageWidthPx?: number;
  pageHeightPx?: number;
  initialAvailableWidthPx?: number;
};

type StageMeasurement = {
  availableWidth: number;
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
  pageWidthPx = A4_PAGE_WIDTH_PX,
  pageHeightPx = A4_PAGE_HEIGHT_PX,
  initialAvailableWidthPx = 560,
}: UseDocumentStageLayoutOptions) {
  const [measurement, setMeasurement] = React.useState<StageMeasurement>({
    availableWidth: initialAvailableWidthPx,
  });

  React.useLayoutEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const node = measurementRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const styles = window.getComputedStyle(node);
      const availableWidth =
        node.clientWidth -
        Number.parseFloat(styles.paddingLeft || "0") -
        Number.parseFloat(styles.paddingRight || "0");

      if (availableWidth <= 0) {
        return;
      }

      setMeasurement((current) =>
        Math.abs(current.availableWidth - availableWidth) > 0.5
          ? { availableWidth }
          : current,
      );
    };

    measure();
    const frameId = window.requestAnimationFrame(measure);

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(node);
    if (node.parentElement) {
      resizeObserver.observe(node.parentElement);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [enabled, measurementRef]);

  const fitScale = enabled
    ? Math.min(1, measurement.availableWidth / pageWidthPx)
    : 1;
  const stageWidth = roundPx(pageWidthPx * fitScale);
  const stageHeight = roundPx(pageHeightPx * fitScale);
  const pageWidth = roundPx(stageWidth * zoomLevel);
  const pageHeight = roundPx(stageHeight * zoomLevel);
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
