import React from "react";

type ShellSize = {
  inlineSize: number;
  blockSize: number;
};

type FluidResizeShellProps = {
  children: React.ReactElement<{ className?: string }>;
  animationKey?: React.Key;
  className?: string;
  durationMs?: number;
  disabled?: boolean;
};

const DEFAULT_DURATION_MS = 220;
const SIZE_EPSILON = 0.5;
const VIEWPORT_RESIZE_SETTLE_MS = 96;
const ANIMATION_SETTLE_BUFFER_MS = 120;

function getShellSize(element: HTMLElement): ShellSize {
  const rect = element.getBoundingClientRect();
  return {
    inlineSize: rect.width,
    blockSize: rect.height,
  };
}

function isUsableSize(size: ShellSize): boolean {
  return size.inlineSize > 0 && size.blockSize > 0;
}

function sizesMatch(a: ShellSize, b: ShellSize): boolean {
  return (
    Math.abs(a.inlineSize - b.inlineSize) <= SIZE_EPSILON &&
    Math.abs(a.blockSize - b.blockSize) <= SIZE_EPSILON
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(value);
        return;
      }
      (ref as React.MutableRefObject<T | null>).current = value;
    });
  };
}

export function FluidResizeShell({
  children,
  animationKey,
  className,
  durationMs = DEFAULT_DURATION_MS,
  disabled = false,
}: FluidResizeShellProps): JSX.Element {
  const shellRef = React.useRef<HTMLElement | null>(null);
  const previousSizeRef = React.useRef<ShellSize | null>(null);
  const previousAnimationKeyRef = React.useRef<React.Key | undefined>(
    animationKey,
  );
  const cleanupRef = React.useRef<(() => void) | null>(null);
  const viewportResizeTimeoutRef = React.useRef<number | null>(null);
  const isViewportResizingRef = React.useRef(false);

  const clearAnimation = React.useCallback((remeasure = true) => {
    const shell = shellRef.current;
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!shell) return;
    shell.removeAttribute("data-fluid-resize-state");
    shell.style.inlineSize = "";
    shell.style.blockSize = "";
    shell.style.maxInlineSize = "";
    shell.style.transition = "";
    if (remeasure) {
      previousSizeRef.current = getShellSize(shell);
    }
  }, []);

  React.useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    cleanupRef.current?.();
    cleanupRef.current = null;

    shell.style.inlineSize = "";
    shell.style.blockSize = "";
    shell.style.maxInlineSize = "";
    shell.style.transition = "";

    const nextSize = getShellSize(shell);
    const previousSize = previousSizeRef.current;
    const animationKeyChanged =
      animationKey !== previousAnimationKeyRef.current;

    const shouldSuppressViewportResize =
      isViewportResizingRef.current && animationKeyChanged;

    if (
      disabled ||
      shouldSuppressViewportResize ||
      prefersReducedMotion() ||
      !animationKeyChanged ||
      !previousSize ||
      !isUsableSize(previousSize) ||
      !isUsableSize(nextSize) ||
      sizesMatch(previousSize, nextSize)
    ) {
      shell.removeAttribute("data-fluid-resize-state");
      previousSizeRef.current = nextSize;
      previousAnimationKeyRef.current = animationKey;
      return undefined;
    }

    previousAnimationKeyRef.current = animationKey;

    shell.setAttribute("data-fluid-resize-state", "animating");
    shell.style.transition = "none";
    shell.style.inlineSize = `${previousSize.inlineSize}px`;
    shell.style.blockSize = `${previousSize.blockSize}px`;
    shell.style.maxInlineSize = `${Math.max(
      previousSize.inlineSize,
      nextSize.inlineSize,
    )}px`;

    void shell.offsetWidth;

    const animationFrameId = window.requestAnimationFrame(() => {
      shell.style.transition = "";
      shell.style.inlineSize = `${nextSize.inlineSize}px`;
      shell.style.blockSize = `${nextSize.blockSize}px`;
      shell.style.maxInlineSize = `${Math.max(
        previousSize.inlineSize,
        nextSize.inlineSize,
      )}px`;
    });

    const timeoutId = window.setTimeout(
      clearAnimation,
      durationMs + ANIMATION_SETTLE_BUFFER_MS,
    );
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target === shell &&
        (event.propertyName === "inline-size" ||
          event.propertyName === "block-size" ||
          event.propertyName === "width" ||
          event.propertyName === "height")
      ) {
        clearAnimation();
      }
    };

    shell.addEventListener("transitionend", handleTransitionEnd);
    cleanupRef.current = () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      shell.removeEventListener("transitionend", handleTransitionEnd);
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  });

  React.useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(() => {
      if (shell.getAttribute("data-fluid-resize-state") === "animating") {
        return;
      }
      previousSizeRef.current = getShellSize(shell);
    });
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleViewportResize = () => {
      isViewportResizingRef.current = true;
      if (viewportResizeTimeoutRef.current !== null) {
        window.clearTimeout(viewportResizeTimeoutRef.current);
      }
      clearAnimation();
      viewportResizeTimeoutRef.current = window.setTimeout(() => {
        isViewportResizingRef.current = false;
        viewportResizeTimeoutRef.current = null;
        const shell = shellRef.current;
        if (shell) {
          previousSizeRef.current = getShellSize(shell);
        }
      }, VIEWPORT_RESIZE_SETTLE_MS);
    };

    window.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("resize", handleViewportResize);
      if (viewportResizeTimeoutRef.current !== null) {
        window.clearTimeout(viewportResizeTimeoutRef.current);
        viewportResizeTimeoutRef.current = null;
      }
      isViewportResizingRef.current = false;
    };
  }, [clearAnimation]);

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (viewportResizeTimeoutRef.current !== null) {
        window.clearTimeout(viewportResizeTimeoutRef.current);
        viewportResizeTimeoutRef.current = null;
      }
    };
  }, []);

  return React.cloneElement(children, {
    className: [children.props.className, "dasti-fluid-resize-shell", className]
      .filter(Boolean)
      .join(" "),
    ref: mergeRefs(
      (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref,
      shellRef,
    ),
  } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> });
}

export default FluidResizeShell;
