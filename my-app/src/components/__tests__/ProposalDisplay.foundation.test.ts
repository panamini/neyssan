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

  it("defines subtle compose edge shadows for both light and dark themes", () => {
    expect(foundationCss).toContain(
      "--proposal-sheet-top-shadow: 0 12px 18px -16px",
    );
    expect(foundationCss).toContain(
      "--proposal-sheet-bottom-shadow: 0 -12px 18px -16px",
    );
    expect(foundationCss).toContain(
      ".dark {\n  color-scheme: dark;",
    );
    expect(foundationCss).toContain(
      "--proposal-sheet-top-shadow: 0 12px 18px -16px hsla(0, 0%, 0%, 0.14);",
    );
    expect(foundationCss).toContain(
      "--proposal-sheet-bottom-shadow: 0 -12px 18px -16px hsla(0, 0%, 0%, 0.16);",
    );
  });

  it("defines workspace motion, compact submit, and output editor tokens in foundation", () => {
    expect(foundationCss).toContain(
      "--proposal-motion-toolbar-enter-duration: 320ms;",
    );
    expect(foundationCss).toContain(
      "--proposal-motion-brief-swap-duration: 160ms;",
    );
    expect(foundationCss).toContain(
      "--proposal-motion-compose-enter-shift: 12px;",
    );
    expect(foundationCss).toContain("--proposal-submit-size-sm: 30px;");
    expect(foundationCss).toContain("--proposal-submit-radius-sm: 11px;");
    expect(foundationCss).toContain(
      "--proposal-submit-stroke-width-sm: 1.6;",
    );
    expect(foundationCss).toContain(
      "--proposal-output-editor-inline-padding: clamp(24px, 4vw, 40px);",
    );
    expect(foundationCss).toContain(
      "--proposal-output-editor-block-start: clamp(28px, 4vh, 44px);",
    );
    expect(foundationCss).toContain(
      "--proposal-output-editor-fade-height: 18px;",
    );
  });
});
