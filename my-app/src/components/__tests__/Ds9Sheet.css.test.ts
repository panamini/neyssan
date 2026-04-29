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
});
