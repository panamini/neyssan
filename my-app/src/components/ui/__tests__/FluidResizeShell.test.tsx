import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluidResizeShell } from "../FluidResizeShell";

const sizeByKey: Record<string, { width: number; height: number }> = {
  compact: { width: 120, height: 40 },
  expanded: { width: 240, height: 52 },
};

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function Probe({ size }: { size: keyof typeof sizeByKey }) {
  return (
    <FluidResizeShell animationKey={size} durationMs={20}>
      <div data-testid="shell" data-size={size} />
    </FluidResizeShell>
  );
}

function FixedKeyProbe({ size }: { size: keyof typeof sizeByKey }) {
  return (
    <FluidResizeShell animationKey="toolbar-state" durationMs={20}>
      <div data-testid="shell" data-size={size} />
    </FluidResizeShell>
  );
}

function BranchProbe({ collapsed }: { collapsed: boolean }) {
  return (
    <FluidResizeShell animationKey={collapsed ? "collapsed" : "expanded"}>
      {collapsed ? (
        <div data-testid="shell" data-size="compact" />
      ) : (
        <section data-testid="shell" data-size="expanded" />
      )}
    </FluidResizeShell>
  );
}

describe("FluidResizeShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock(this: HTMLElement) {
        const key = this.dataset.size ?? "compact";
        const size = sizeByKey[key] ?? sizeByKey.compact;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: size.width,
          bottom: size.height,
          width: size.width,
          height: size.height,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("animates shell dimensions and clears back to natural sizing", () => {
    const { getByTestId, rerender } = render(<Probe size="compact" />);
    const shell = getByTestId("shell");

    expect(shell).toHaveClass("dasti-fluid-resize-shell");
    expect(shell).not.toHaveAttribute("data-fluid-resize-state");

    rerender(<Probe size="expanded" />);

    expect(shell).toHaveAttribute("data-fluid-resize-state", "animating");
    expect(shell.style.inlineSize).toBe("120px");
    expect(shell.style.blockSize).toBe("40px");

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(shell.style.inlineSize).toBe("240px");
    expect(shell.style.blockSize).toBe("52px");
    expect(shell.style.maxInlineSize).toBe("240px");

    act(() => {
      vi.advanceTimersByTime(140);
    });

    expect(shell).not.toHaveAttribute("data-fluid-resize-state");
    expect(shell.style.inlineSize).toBe("");
    expect(shell.style.blockSize).toBe("");
    expect(shell.style.maxInlineSize).toBe("");
  });

  it("respects reduced motion by measuring without freezing dimensions", () => {
    mockReducedMotion(true);

    const { getByTestId, rerender } = render(<Probe size="compact" />);
    const shell = getByTestId("shell");

    rerender(<Probe size="expanded" />);

    expect(shell).not.toHaveAttribute("data-fluid-resize-state");
    expect(shell.style.inlineSize).toBe("");
    expect(shell.style.blockSize).toBe("");
    expect(shell.style.maxInlineSize).toBe("");
  });

  it("does not animate layout-only size changes when the semantic key is stable", () => {
    const { getByTestId, rerender } = render(<FixedKeyProbe size="compact" />);
    const shell = getByTestId("shell");

    rerender(<FixedKeyProbe size="expanded" />);

    expect(shell).not.toHaveAttribute("data-fluid-resize-state");
    expect(shell.style.inlineSize).toBe("");
    expect(shell.style.blockSize).toBe("");
    expect(shell.style.maxInlineSize).toBe("");
  });

  it("animates when the wrapped toolbar shell branch changes", () => {
    const { getByTestId, rerender } = render(<BranchProbe collapsed={false} />);

    rerender(<BranchProbe collapsed />);

    const shell = getByTestId("shell");
    expect(shell.tagName.toLowerCase()).toBe("div");
    expect(shell).toHaveAttribute("data-fluid-resize-state", "animating");

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(shell.style.inlineSize).toBe("120px");
    expect(shell.style.blockSize).toBe("40px");
  });

  it("suppresses shell animation while the viewport is actively resizing", () => {
    const { getByTestId, rerender } = render(<Probe size="compact" />);
    const shell = getByTestId("shell");

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    rerender(<Probe size="expanded" />);

    expect(shell).not.toHaveAttribute("data-fluid-resize-state");
    expect(shell.style.inlineSize).toBe("");
    expect(shell.style.blockSize).toBe("");

    act(() => {
      vi.advanceTimersByTime(220);
    });

    rerender(<Probe size="compact" />);

    expect(shell).toHaveAttribute("data-fluid-resize-state", "animating");

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(shell.style.inlineSize).toBe("120px");
    expect(shell.style.blockSize).toBe("40px");
  });

  it("does not let viewport resize suppression leak into later state changes", () => {
    const { getByTestId, rerender } = render(<Probe size="compact" />);
    const shell = getByTestId("shell");

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    rerender(<Probe size="expanded" />);

    expect(shell).not.toHaveAttribute("data-fluid-resize-state");

    act(() => {
      vi.advanceTimersByTime(120);
    });

    rerender(<Probe size="compact" />);

    expect(shell).toHaveAttribute("data-fluid-resize-state", "animating");

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(shell.style.inlineSize).toBe("120px");
    expect(shell.style.blockSize).toBe("40px");
  });
});
