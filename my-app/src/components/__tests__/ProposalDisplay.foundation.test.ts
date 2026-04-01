import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundationCssPath = resolve(process.cwd(), "src/styles/foundation.css");
const foundationCss = readFileSync(foundationCssPath, "utf8");

describe("ProposalDisplay foundation tokens", () => {
  it("budgets document viewer shell size for bleed, shell padding, and toolbar chrome", () => {
    expect(foundationCss).toMatch(
      /--document-viewer-toolbar-block-size:\s*calc\(\s*var\(--hs\)\s*\+\s*\(2 \* \(var\(--space-2\) - 2px\)\)\s*\+\s*2px\s*\);/,
    );
    expect(foundationCss).toMatch(
      /--document-viewer-shell-inline-size:\s*min\([\s\S]*var\(--document-sheet-inline-size\)\s*\+\s*\(var\(--document-viewer-bleed-inline\) \* 2\)\s*\+\s*\(var\(--document-shell-padding-inline\) \* 2\)\s*\+\s*2px[\s\S]*\);/,
    );
    expect(foundationCss).toMatch(
      /--document-viewer-shell-max-block:\s*calc\([\s\S]*var\(--document-viewer-paper-max-block\)[\s\S]*var\(--document-viewer-bleed-block\) \* 2[\s\S]*var\(--document-shell-padding-block\) \* 2[\s\S]*var\(--document-rail-gap\)\s*\+\s*var\(--document-viewer-toolbar-block-size\)[\s\S]*\);/,
    );
  });
});
