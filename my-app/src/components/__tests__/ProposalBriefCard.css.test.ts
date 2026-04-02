import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalBriefCard CSS contracts", () => {
  it("defines a compact workbench capsule aligned with the detached compose toolbar column", () => {
    expect(productCss).toContain(".dasti-proposal-workbench-left-stack {");
    expect(productCss).toContain("justify-items: stretch;");
    expect(productCss).toContain(
      "inline-size: min(100%, var(--proposal-compose-column-inline-size, 480px));",
    );
    expect(productCss).toContain(".dasti-brief-card--compact {");
    expect(productCss).toContain("border-radius: var(--document-viewer-radius);");
    expect(productCss).toContain("var(--document-viewer-frame-border)");
    expect(productCss).toContain("background: var(--document-viewer-frame-surface);");
    expect(productCss).toContain("box-shadow: var(--document-viewer-frame-shadow);");
    expect(productCss).toContain(".dasti-proposal-sheet__header--brief-compact {");
    expect(productCss).toContain(".dasti-brief-card--compact {");
    expect(productCss).toContain("gap: 0;");
    expect(productCss).toContain(".dasti-brief-card--compact .dasti-brief-card__summary {");
    expect(productCss).toContain(
      ".dasti-forge-compose-toolbar-slot .dasti-compose-toolbar--collapsed,",
    );
    expect(productCss).toContain("justify-content: space-between;");
    expect(productCss).toContain(".dasti-cv-workbench-bar--proposal-workspace {");
    expect(productCss).toContain(
      "inline-size: min(100%, var(--proposal-compose-column-inline-size, 480px));",
    );
    expect(productCss).toContain(
      "--proposal-sheet-margin-block-start: 0px;",
    );
    expect(productCss).toContain("--proposal-sheet-margin-block-end: 0px;");
    expect(productCss).toContain("--proposal-sheet-content-bottom-inset: 0px;");
    expect(productCss).toContain("--proposal-sheet-edge-fade-height: 22px;");
    expect(productCss).toContain("box-shadow: var(--proposal-sheet-top-shadow, none);");
    expect(productCss).toContain(".dasti-proposal-sheet--composer {");
  });

  it("defines calm motion states for brief swaps and compose collapse", () => {
    expect(productCss).toContain(".dasti-proposal-brief-stage--entering {");
    expect(productCss).toContain(".dasti-proposal-compose-panel-stage--entering {");
    expect(productCss).toContain("@keyframes dasti-proposal-brief-enter {");
    expect(productCss).toContain("@keyframes dasti-proposal-compose-stage-enter {");
    expect(productCss).toContain("@keyframes dasti-compose-toolbar-enter {");
    expect(productCss).toContain("transform: translate3d(-14px, 0, 0) scale(0.985);");
    expect(productCss).toContain("filter: saturate(0.92) blur(6px);");
    expect(productCss).toContain("overflow-anchor: none;");
    expect(productCss).toContain("transform: translate3d(12px, 0, 0) scale(0.992);");
    expect(productCss).toContain("transform: translate3d(-10px, 0, 0) scale(0.992);");
  });
});
