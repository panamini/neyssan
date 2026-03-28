import React from "react";

type UseDocumentViewportCenteringOptions = {
  enabled?: boolean;
  layoutKey?: string | number;
  recenterKey?: string | number;
  defaultCenterX?: number;
  defaultCenterY?: number;
  onSync?: () => void;
};

type ViewportSnapshot = {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readSnapshot(node: HTMLDivElement): ViewportSnapshot {
  return {
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    scrollLeft: node.scrollLeft,
    scrollTop: node.scrollTop,
  };
}

export function useDocumentViewportCentering({
  enabled = true,
  layoutKey,
  recenterKey,
  defaultCenterX = 0.5,
  defaultCenterY = 0.5,
  onSync,
}: UseDocumentViewportCenteringOptions) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const snapshotRef = React.useRef<ViewportSnapshot | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const recenterRequestedRef = React.useRef(false);

  const syncViewport = React.useCallback(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const previous = snapshotRef.current;
    const next = readSnapshot(node);
    const maxLeft = Math.max(0, next.scrollWidth - next.clientWidth);
    const maxTop = Math.max(0, next.scrollHeight - next.clientHeight);
    const shouldRecenter = recenterRequestedRef.current;
    const previousMaxLeft = previous
      ? Math.max(0, previous.scrollWidth - previous.clientWidth)
      : 0;
    const previousMaxTop = previous
      ? Math.max(0, previous.scrollHeight - previous.clientHeight)
      : 0;

    // Keep Fit as the only deliberate recenter. When the previous layout was
    // already fully fitted, treat the next zoom step as originating from the
    // centered view instead of anchoring to the top-left corner.
    const centerX =
      shouldRecenter
        ? defaultCenterX
        : !previous || previousMaxLeft <= 1
          ? defaultCenterX
          : clamp(
              (previous.scrollLeft + previous.clientWidth * defaultCenterX) /
                previous.scrollWidth,
              0,
              1,
            );
    const centerY =
      shouldRecenter
        ? defaultCenterY
        : !previous || previousMaxTop <= 1
          ? defaultCenterY
          : clamp(
              (previous.scrollTop + previous.clientHeight * defaultCenterY) /
                previous.scrollHeight,
              0,
              1,
            );

    node.scrollLeft =
      enabled && maxLeft > 0
        ? clamp(centerX * next.scrollWidth - next.clientWidth * defaultCenterX, 0, maxLeft)
        : 0;
    node.scrollTop =
      enabled && maxTop > 0
        ? clamp(centerY * next.scrollHeight - next.clientHeight * defaultCenterY, 0, maxTop)
        : 0;

    recenterRequestedRef.current = false;
    snapshotRef.current = readSnapshot(node);
    onSync?.();
  }, [defaultCenterX, defaultCenterY, enabled, onSync]);

  const scheduleSync = React.useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      syncViewport();
    });
  }, [syncViewport]);

  const attachViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      snapshotRef.current = node ? readSnapshot(node) : null;

      if (node) {
        scheduleSync();
      }
    },
    [scheduleSync],
  );

  React.useLayoutEffect(() => {
    scheduleSync();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [layoutKey, scheduleSync]);

  React.useLayoutEffect(() => {
    if (recenterKey === undefined) {
      return;
    }

    recenterRequestedRef.current = true;
    scheduleSync();
  }, [recenterKey, scheduleSync]);

  React.useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return undefined;
    }

    const handleScroll = () => {
      snapshotRef.current = readSnapshot(node);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    resizeObserver.observe(node);
    const contentTargets = Array.from(
      node.querySelectorAll<HTMLElement>(
        [
          ".dasti-proposal-sheet__preview-stage",
          ".dasti-proposal-sheet__preview-page-positioner",
          ".dasti-proposal-sheet__scroll-content",
          ".dasti-document-stage__canvas",
          ".resume-page-stage",
        ].join(", "),
      ),
    );

    if (contentTargets.length > 0) {
      contentTargets.forEach((target) => resizeObserver.observe(target));
    } else if (node.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(node.firstElementChild);
    }

    node.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      resizeObserver.disconnect();
      node.removeEventListener("scroll", handleScroll);
    };
  }, [scheduleSync]);

  return {
    attachViewport,
    syncViewport: scheduleSync,
    recenterViewport: React.useCallback(() => {
      recenterRequestedRef.current = true;
      scheduleSync();
    }, [scheduleSync]),
  };
}
