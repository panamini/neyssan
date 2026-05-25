import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/ds-v2.css", "utf8");

describe("DS-9 Sheet CSS contracts", () => {
  it("defines the right sheet and frost overlay classes", () => {
    expect(css).toContain(".ds-sheet-root");
    expect(css).toContain(".ds-sheet__overlay");
    expect(css).toContain(".ds-sheet {");
    expect(css).toContain(".ds-sheet[data-state=\"closed\"]");
    expect(css).toContain("transform: translateX(100%);");
  });

  it("defines the bottom sheet variant and reduced-motion fallback", () => {
    expect(css).toContain(".ds-bottom-sheet {");
    expect(css).toContain(".ds-bottom-sheet__handle");
    expect(css).toContain(".ds-bottom-sheet[data-state=\"closed\"]");
    expect(css).toContain("transform: translateY(100%);");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps island panel header outside and above the scroll body", () => {
    expect(css).toContain(".ds-island-panel__header {");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("pointer-events: auto;");
    expect(css).toContain("position: relative;");
    expect(css).toContain("z-index: 1;");
    expect(css).toContain("flex: 0 0 auto;");
    expect(css).toContain("background: inherit;");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain(".ds-island-panel__body {");
    expect(css).toContain("flex: 1 1 auto;");
    expect(css).toContain("min-block-size: 0;");
    expect(css).toContain("max-block-size: calc(");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("overscroll-behavior: contain;");
    expect(css).toContain("-webkit-overflow-scrolling: touch;");
    expect(css).toContain("padding: var(--space-2) var(--space-3) var(--space-3);");
  });
});
