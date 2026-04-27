import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");
const primitivesCssPath = resolve(process.cwd(), "src/styles/primitives.css");
const primitivesCss = readFileSync(primitivesCssPath, "utf8");
const foundationCssPath = resolve(process.cwd(), "src/styles/foundation.css");
const foundationCss = readFileSync(foundationCssPath, "utf8");

describe("ProposalBriefCard CSS contracts", () => {
  it("defines a compact workbench capsule aligned with the detached compose toolbar column", () => {
    expect(productCss).toContain(".dasti-brief-card,");
    expect(productCss).toContain(".dasti-proposal-workbench-left-stack {");
    expect(productCss).toContain("justify-items: stretch;");
    expect(productCss).toContain(
      "var(--proposal-compose-column-inline-size, var(--container-xs))",
    );
    expect(productCss).toContain(".dasti-brief-card--compact {");
    expect(productCss).toContain(
      "border-radius: var(--document-viewer-radius);",
    );
    expect(productCss).toContain("var(--document-viewer-frame-border)");
    expect(productCss).toContain(
      "background: var(--document-viewer-frame-surface);",
    );
    expect(productCss).toContain(
      "box-shadow: var(--document-viewer-frame-shadow);",
    );
    expect(productCss).toContain(
      ".dasti-proposal-sheet__header--brief-compact {",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__header--brief,\s*\.dasti-proposal-sheet__header--composer\s*\{[\s\S]*background:\s*var\(--document-viewer-frame-surface\);[\s\S]*background-clip:\s*padding-box;/,
    );
    expect(productCss).toContain(".dasti-brief-card--compact {");
    expect(productCss).toContain("gap: 0;");
    expect(productCss).toContain(
      ".dasti-brief-card--compact .dasti-brief-card__summary {",
    );
    expect(productCss).toContain(
      ".dasti-forge-compose-toolbar-slot .dasti-compose-toolbar--collapsed,",
    );
    expect(productCss).toContain("justify-content: space-between;");
    expect(productCss).toContain(
      ".dasti-cv-workbench-bar--proposal-workspace {",
    );
    expect(productCss).toContain(
      "var(--proposal-compose-column-inline-size, var(--container-xs))",
    );
    expect(productCss).toContain("--proposal-sheet-margin-block-start: 0px;");
    expect(productCss).toContain("--proposal-sheet-margin-block-end: 0px;");
    expect(productCss).toContain("--proposal-sheet-content-bottom-inset: 0px;");
    expect(productCss).toContain("--proposal-sheet-edge-fade-height: 22px;");
    expect(productCss).toContain(
      "box-shadow: var(--proposal-sheet-top-shadow, none);",
    );
    expect(productCss).toMatch(
      /\.dasti-brief-card__dismiss,\s*\.dasti-proposal-compose-shell__toggle\s*\{[\s\S]*border:\s*1px solid var\(--proposal-chrome-control-border\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__header--brief\s+\.dasti-proposal-compose-shell__header-row\s*\{[\s\S]*align-items:\s*flex-start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-shell__toggle\s*\{[\s\S]*align-self:\s*flex-start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-brief-card__dismiss:hover,[\s\S]*\.dasti-proposal-compose-shell__toggle:focus-visible\s*\{[\s\S]*background:\s*var\(--proposal-chrome-control-hover-bg\);[\s\S]*border-color:\s*var\(--proposal-chrome-control-active-border\);/,
    );
    expect(productCss).toContain(".dasti-proposal-sheet--composer {");
    expect(productCss).toContain(
      ".dasti-proposal-sheet__body--composer::before,",
    );
    expect(productCss).toContain("content: none;");
    expect(productCss).toContain(
      ".dasti-proposal-sheet__body--composer .dasti-proposal-source-scroll-region {",
    );
    expect(productCss).toContain("-webkit-mask-image: linear-gradient(");
    expect(productCss).toContain("var(--proposal-compose-edge-fade-height) *");
  });

  it("defines calm motion states for brief swaps and compose collapse", () => {
    expect(productCss).toContain(".dasti-proposal-brief-stage--entering {");
    expect(productCss).toContain(
      ".dasti-proposal-compose-panel-stage--entering {",
    );
    expect(productCss).toContain("@keyframes dasti-proposal-brief-enter {");
    expect(productCss).toContain(
      "@keyframes dasti-proposal-compose-stage-enter {",
    );
    expect(productCss).toContain("@keyframes dasti-compose-toolbar-enter {");
    expect(productCss).toContain("var(--proposal-motion-toolbar-enter-shift)");
    expect(productCss).toContain("var(--proposal-motion-toolbar-enter-scale)");
    expect(productCss).toContain("var(--proposal-motion-enter-blur)");
    expect(productCss).toContain("var(--proposal-motion-brief-enter-shift)");
    expect(productCss).toContain("overflow-anchor: none;");
    expect(productCss).toContain("var(--proposal-motion-compose-enter-shift)");
    expect(productCss).toContain("var(--proposal-motion-compose-exit-shift)");
  });

  it("uses semantic review states instead of accent-tinting every review card", () => {
    expect(productCss).toContain(
      '.dasti-brief-card__review-item[data-state="warning"] {',
    );
    expect(productCss).toContain(
      '.dasti-brief-card__review-item[data-state="success"] {',
    );
    expect(productCss).toContain("background: var(--color-surface-raised);");
    expect(productCss).toContain("border: 1px solid var(--color-border);");
    expect(productCss).toContain("gap: var(--space-2);");
    expect(productCss).not.toContain(".dasti-brief-card__action {");
    expect(productCss).not.toContain(".dasti-brief-card__action--secondary");
    expect(productCss).not.toContain("--brief-review");
    expect(productCss).not.toContain("border-inline-start: 3px solid");
  });

  it("keeps local status pills aligned with the dasti brand canon", () => {
    expect(primitivesCss).toContain(".dasti-pill {");
    expect(primitivesCss).toContain(
      "gap: calc((var(--space-1) + var(--space-2)) / 2);",
    );
    expect(primitivesCss).toContain("padding: 0 var(--space-3);");
    expect(primitivesCss).toContain("background: var(--color-surface-muted);");
    expect(primitivesCss).toContain("background: var(--color-accent-pale);");
    expect(primitivesCss).toContain("color: var(--color-accent-hover);");
    expect(primitivesCss).toContain("background: var(--color-success-soft);");
    expect(primitivesCss).toContain("color: var(--color-success-ink);");
    expect(primitivesCss).toContain("background: var(--color-warning-soft);");
    expect(primitivesCss).toContain("color: var(--color-warning-ink);");
    expect(foundationCss).toContain("--okb: hsl(150, 16%, 92%);");
    expect(foundationCss).toContain("--wab: hsl(32, 32%, 93%);");
    expect(foundationCss).toContain("--okb: hsl(150, 14%, 14%);");
    expect(foundationCss).toContain("--wab: hsl(34, 14%, 14%);");
  });
});
