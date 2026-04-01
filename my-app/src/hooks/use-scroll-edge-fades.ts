import { useCallback, useEffect, useRef, useState } from "react";

type ScrollEdgeState = {
  showTop: boolean;
  showBottom: boolean;
};

const SCROLL_EDGE_EPSILON = 1;

function getScrollEdgeState(node: HTMLElement | null): ScrollEdgeState {
  if (!node) {
    return { showTop: false, showBottom: false };
  }

  const scrollableDistance = node.scrollHeight - node.clientHeight;

  if (scrollableDistance <= SCROLL_EDGE_EPSILON) {
    return { showTop: false, showBottom: false };
  }

  return {
    showTop: node.scrollTop > SCROLL_EDGE_EPSILON,
    showBottom: scrollableDistance - node.scrollTop > SCROLL_EDGE_EPSILON,
  };
}

export function useScrollEdgeFades<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [state, setState] = useState<ScrollEdgeState>({
    showTop: false,
    showBottom: false,
  });
  const frameRef = useRef<number | null>(null);

  const commitState = useCallback((targetNode: T | null) => {
    setState((previous) => {
      const next = getScrollEdgeState(targetNode);
      if (
        previous.showTop === next.showTop &&
        previous.showBottom === next.showBottom
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
    setNode(nextNode);
  }, []);

  useEffect(() => {
    if (!node) {
      setState({ showTop: false, showBottom: false });
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
    update,
  };
}
