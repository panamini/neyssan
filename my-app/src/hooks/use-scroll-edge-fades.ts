import { useCallback, useEffect, useRef, useState } from "react";

type ScrollEdgeState = {
  showTop: boolean;
  showBottom: boolean;
  topStrength: number;
  bottomStrength: number;
};

const SCROLL_EDGE_EPSILON = 1;
const SCROLL_EDGE_FADE_DISTANCE = 28;

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function getScrollEdgeState(
  node: Pick<HTMLElement, "scrollHeight" | "clientHeight" | "scrollTop"> | null,
): ScrollEdgeState {
  if (!node) {
    return {
      showTop: false,
      showBottom: false,
      topStrength: 0,
      bottomStrength: 0,
    };
  }

  const scrollableDistance = node.scrollHeight - node.clientHeight;

  if (scrollableDistance <= SCROLL_EDGE_EPSILON) {
    return {
      showTop: false,
      showBottom: false,
      topStrength: 0,
      bottomStrength: 0,
    };
  }

  const topStrength = clamp01(node.scrollTop / SCROLL_EDGE_FADE_DISTANCE);
  const bottomStrength = clamp01(
    (scrollableDistance - node.scrollTop) / SCROLL_EDGE_FADE_DISTANCE,
  );

  return {
    showTop: topStrength > 0,
    showBottom: bottomStrength > 0,
    topStrength,
    bottomStrength,
  };
}

export function useScrollEdgeFades<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [state, setState] = useState<ScrollEdgeState>({
    showTop: false,
    showBottom: false,
    topStrength: 0,
    bottomStrength: 0,
  });
  const frameRef = useRef<number | null>(null);

  const commitState = useCallback((targetNode: T | null) => {
    setState((previous) => {
      const next = getScrollEdgeState(targetNode);
      if (
        previous.showTop === next.showTop &&
        previous.showBottom === next.showBottom &&
        previous.topStrength === next.topStrength &&
        previous.bottomStrength === next.bottomStrength
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const update = useCallback(() => {
    if (typeof window === "undefined") {
      commitState(node);
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      commitState(node);
    });
  }, [commitState, node]);

  const attach = useCallback((nextNode: T | null) => {
    setNode((previousNode) =>
      Object.is(previousNode, nextNode) ? previousNode : nextNode,
    );
  }, []);

  useEffect(() => {
    if (!node) {
      setState({
        showTop: false,
        showBottom: false,
        topStrength: 0,
        bottomStrength: 0,
      });
      return undefined;
    }

    update();

    const handleScroll = () => {
      update();
    };

    node.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            update();
          })
        : null;

    resizeObserver?.observe(node);

    const frame = window.requestAnimationFrame(() => {
      update();
    });

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      node.removeEventListener("scroll", handleScroll);
    };
  }, [node, update]);

  return {
    attach,
    showTop: state.showTop,
    showBottom: state.showBottom,
    topStrength: state.topStrength,
    bottomStrength: state.bottomStrength,
    update,
  };
}
