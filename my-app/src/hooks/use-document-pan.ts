import React from "react";

type UseDocumentPanOptions = {
  enabled: boolean;
  onPan?: () => void;
};

type UseDocumentPanResult = {
  attachViewport: (node: HTMLDivElement | null) => void;
  viewportPanProps: Record<string, string | undefined>;
};

function isInteractivePanTarget(target: EventTarget | null): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  return (
    element instanceof Element &&
    Boolean(
      element.closest(
        [
          "button",
          "input",
          "textarea",
          "select",
          "option",
          "a",
          "[role='button']",
          "[data-no-pan='true']",
        ].join(", "),
      ),
    )
  );
}

export function useDocumentPan({
  enabled,
  onPan,
}: UseDocumentPanOptions): UseDocumentPanResult {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const attachViewport = React.useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
  }, []);

  React.useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return undefined;
    }

    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const canPan = () =>
      enabled &&
      (node.scrollWidth > node.clientWidth + 1 ||
        node.scrollHeight > node.clientHeight + 1);

    const releasePointer = () => {
      if (activePointerId !== null && node.hasPointerCapture?.(activePointerId)) {
        node.releasePointerCapture(activePointerId);
      }
      activePointerId = null;
      setIsDragging(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !canPan() ||
        isInteractivePanTarget(event.target)
      ) {
        return;
      }

      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = node.scrollLeft;
      startTop = node.scrollTop;
      setIsDragging(true);
      node.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      node.scrollLeft = startLeft - (event.clientX - startX);
      node.scrollTop = startTop - (event.clientY - startY);
      event.preventDefault();
      onPan?.();
    };

    node.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    node.addEventListener("lostpointercapture", releasePointer);

    return () => {
      node.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      node.removeEventListener("lostpointercapture", releasePointer);
      releasePointer();
    };
  }, [enabled, onPan]);

  return {
    attachViewport,
    viewportPanProps: {
      "data-pannable": enabled ? "true" : undefined,
      "data-dragging": isDragging ? "true" : undefined,
    },
  };
}
