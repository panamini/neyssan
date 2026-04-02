import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalDisplay CSS contracts", () => {
  it("keeps the proposal preview shell and document pages on A4 ratio", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__preview-page,\s*\.dasti-document-stage__canvas\[data-document-page="true"\][\s\S]*?aspect-ratio:\s*210\s*\/\s*297;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-document__page[\s\S]*?aspect-ratio:\s*210\s*\/\s*297;/,
    );
  });

  it("uses a separate stacked outer shell contract for multipage previews", () => {
    expect(productCss).toContain(".dasti-proposal-sheet__preview-page--stacked");
    expect(productCss).toContain("aspect-ratio: auto;");
    expect(productCss).toContain("overflow: visible;");
    expect(productCss).toContain(
      ".dasti-proposal-sheet__preview-page--stacked .dasti-proposal-document__page {",
    );
    expect(productCss).toContain("border-radius: var(--document-stage-radius);");
    expect(productCss).toContain("box-shadow: var(--document-stage-halo);");
  });

  it("pads the document stage inside the proposal shell and anchors the character badge to the shell corner", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{[\s\S]*padding-block-start:\s*var\(--document-viewer-bleed-block\);[\s\S]*padding-inline:\s*var\(--document-viewer-bleed-inline\);[\s\S]*padding-block-end:\s*calc\(var\(--document-viewer-bleed-block\)\s*\+\s*var\(--space-2\)\);[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(productCss).toContain(".dasti-proposal-character-badge-wrap {");
    expect(productCss).toContain("position: absolute;");
    expect(productCss).toContain("var(--proposal-output-stage-frame-padding, 0px)");
    expect(productCss).toContain("var(--document-shell-padding-inline)");
    expect(productCss).toContain("var(--document-shell-padding-block)");
  });

  it("prevents document spill from the focused body slot without forcing the shell to a fixed A4 block size", () => {
    expect(productCss).not.toMatch(
      /\.dasti-document-shell\.dasti-proposal-sheet--focused\s*\{[\s\S]*height:\s*var\(--document-viewer-shell-max-block\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-viewer\s*\{[\s\S]*flex:\s*1 1 0%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/,
    );
  });

  it("lifts the live output toolbar out of the document shell flow so the A4 stage keeps its full block budget", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s*\{[\s\S]*--document-shell-padding-inline:\s*8px;[\s\S]*--document-shell-padding-block:\s*8px;[\s\S]*--proposal-output-stage-frame-padding:\s*8px;[\s\S]*--proposal-output-rail-inline-inset:\s*var\(--document-shell-padding-inline\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s*\{[\s\S]*--document-shell-padding-inline:\s*0px;[\s\S]*--document-shell-padding-block:\s*0px;[\s\S]*--document-viewer-bleed-inline:\s*var\(--s2\);[\s\S]*--document-viewer-bleed-block:\s*var\(--s2\);[\s\S]*--proposal-output-stage-frame-padding:\s*var\(--s2\);[\s\S]*--proposal-output-rail-inline-inset:\s*var\(--s2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s*\{[\s\S]*--proposal-output-toolbar-lift:\s*calc\([\s\S]*var\(--document-viewer-toolbar-block-size\)\s*\+\s*var\(--space-2\)[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s*\{[\s\S]*--proposal-output-shell-max-block:\s*calc\([\s\S]*100dvh[\s\S]*var\(--proposal-output-toolbar-lift\)[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s+\.dasti-document-rail\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-block-start:\s*calc\(-1 \* var\(--proposal-output-toolbar-lift\)\);[\s\S]*inset-inline-start:\s*var\(--proposal-output-rail-inline-inset\);[\s\S]*inset-inline-end:\s*var\(--proposal-output-rail-inline-inset\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s+\.dasti-document-shell\s*\{[\s\S]*height:\s*min\([\s\S]*var\(--document-viewer-shell-max-block\),[\s\S]*var\(--proposal-output-shell-max-block\)[\s\S]*\);[\s\S]*max-height:\s*min\([\s\S]*var\(--document-viewer-shell-max-block\),[\s\S]*var\(--proposal-output-shell-max-block\)[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell[\s\S]*?\.dasti-proposal-sheet__body--document-viewer[\s\S]*?\.dasti-document-stage-chassis\s*\{[\s\S]*justify-content:\s*center;[\s\S]*padding:\s*var\(--proposal-output-stage-frame-padding\);/,
    );
    expect(productCss).toContain(".dasti-proposal-library-card {");
    expect(productCss).toContain("--document-viewer-bleed-inline: var(--s2);");
    expect(productCss).toContain("--document-viewer-bleed-block: var(--s2);");
    expect(productCss).toContain(
      ".dasti-proposal-library-card .dasti-proposal-sheet__body--document-viewer .dasti-document-stage-chassis {",
    );
    expect(productCss).toContain("justify-content: center;");
    expect(productCss).toContain(
      "padding: var(--proposal-output-stage-frame-padding);",
    );
    expect(productCss).toMatch(
      /@media \(max-width: 1439px\)\s*\{[\s\S]*\.dasti-proposal-output-shell\s*\{[\s\S]*--proposal-output-toolbar-lift:\s*0px;[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail\s*\{[\s\S]*position:\s*static;[\s\S]*margin-block-end:\s*var\(--document-rail-gap\);/,
    );
    expect(productCss).toMatch(
      /@media \(max-width: 520px\)\s*\{[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail\s*\{[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail__section\s*\{[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-proposal-rail-cluster,\s*[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-proposal-sheet__controls\s*\{[\s\S]*padding:\s*4px;/,
    );
  });

  it("lets the desktop Proposal Forge compose shell match the live output shell block size instead of shrinking by A4 ratio", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s*\{[\s\S]*--document-shell-padding-inline:\s*4px;[\s\S]*--proposal-sheet-margin-inline-inner:\s*4px;[\s\S]*--proposal-sheet-margin-inline-outer:\s*4px;[\s\S]*--proposal-sheet-margin-block-start:\s*0px;[\s\S]*--proposal-sheet-margin-block-end:\s*0px;[\s\S]*--proposal-sheet-content-bottom-inset:\s*0px;[\s\S]*--proposal-sheet-edge-fade-height:\s*22px;[\s\S]*--proposal-live-shell-block-size:\s*var\(--proposal-workspace-shell-block-size\);/,
    );
    expect(productCss).toMatch(
      /@media \(min-width: 1440px\)\s*\{[\s\S]*\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet--composer\s*\{[\s\S]*aspect-ratio:\s*auto;[\s\S]*min-height:\s*var\(--proposal-live-shell-block-size\);[\s\S]*height:\s*var\(--proposal-live-shell-block-size\);[\s\S]*max-height:\s*var\(--proposal-live-shell-block-size\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet__body::before,\s*[\s\S]*\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet__body::after\s*\{[\s\S]*inset-inline-start:\s*0;[\s\S]*inset-inline-end:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet,\s*[\s\S]*\.dasti-proposal-output-shell--workspace\s+\.dasti-document-shell\s*\{[\s\S]*box-shadow:\s*[\s\S]*var\(--document-viewer-frame-shadow\)/,
    );
  });

  it("gives document edit mode full-width paper, top-and-bottom fade masking, and overlap-aware badge hiding", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-editor-page__inner\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*padding-block:\s*0;[\s\S]*padding-inline:\s*var\(--proposal-output-editor-inline-padding\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__textarea\s*\{[\s\S]*padding-block-start:\s*var\(--proposal-output-editor-block-start\);[\s\S]*padding-block-end:\s*var\(--proposal-output-editor-block-end\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-editor-page__textarea\s*\{[\s\S]*-webkit-mask-image:\s*linear-gradient\([\s\S]*var\(--proposal-output-editor-fade-height\)[\s\S]*var\(--proposal-scroll-top-strength\)[\s\S]*var\(--proposal-scroll-bottom-strength\)/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge-wrap\[data-overlap-hidden="true"\]\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(0,\s*6px,\s*0\);/,
    );
  });

  it("supports a detached saved-proposal header row with tighter library chrome spacing", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__header--detached\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(productCss).toContain(".dasti-proposal-display__detached-layout {");
    expect(productCss).toContain(".dasti-proposal-display__detached-aside {");
    expect(productCss).toMatch(
      /\.dasti-proposal-display__detached-main\s*\{[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(productCss).toContain(".dasti-proposal-sheet__heading--sidecar {");
    expect(productCss).toContain(".dasti-proposal-sheet__header-rail {");
    expect(productCss).toContain(".dasti-document-rail--detached {");
    expect(productCss).toContain(".dasti-proposal-library-selected-shell {");
    expect(productCss).toContain(".dasti-proposal-library-selected-sidebar {");
    expect(productCss).toContain(".dasti-proposal-library-sidebar__heading {");
    expect(productCss).toContain(".dasti-proposal-output-shell--saved {");
    expect(productCss).toContain(
      "--proposal-library-selected-shell-inline-size: var(",
    );
    expect(productCss).toContain(
      "--proposal-workspace-output-shell-inline-size,",
    );
    expect(productCss).toContain(
      "grid-template-columns: minmax(132px, 160px) minmax(",
    );
    expect(productCss).toContain(
      "var(--proposal-library-selected-shell-inline-size)",
    );
    expect(productCss).toContain("column-gap: var(--layout-card-grid);");
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-sidebar\s*\{[\s\S]*justify-self:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card\s*\{[\s\S]*justify-self:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card\s*\{[\s\S]*--document-viewer-shell-inline-size:\s*var\([\s\S]*--proposal-library-selected-shell-inline-size[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--secondary\s*\{[\s\S]*--document-viewer-shell-inline-size:\s*calc\([\s\S]*var\(--document-sheet-inline-size\)\s*-\s*\(var\(--s4\)\s*\*\s*2\)/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--saved\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--document-viewer-shell-inline-size\)\);[\s\S]*--document-viewer-shell-min-block:\s*calc\([\s\S]*--document-sheet-min-block[\s\S]*\);[\s\S]*--document-viewer-shell-max-block:\s*calc\([\s\S]*--document-viewer-paper-max-block[\s\S]*\);/,
    );
    expect(productCss).toContain(".dasti-page-shell--proposal-saved {");
    expect(productCss).toContain(
      "--proposal-workspace-output-shell-inline-size: calc(",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--saved[\s\S]*?\.dasti-proposal-sheet__header--detached[\s\S]*?\.dasti-document-rail\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-tone-popover\s*\{[\s\S]*width:\s*max-content;[\s\S]*inset-inline-start:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar\.dasti-toolbar--surface-tooltips\s*\{[\s\S]*--dasti-toolbar-shell-edge-padding:/,
    );
    expect(productCss).toContain(".dasti-artifact-inspector,");
    expect(productCss).toContain(".dasti-proposal-chrome-drawer {");
    expect(productCss).toContain("--dasti-toolbar-shell-edge-padding:");
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__bar \[data-toolbar-tooltip\],[\s\S]*\.dasti-proposal-saved-view-toolbar \[data-toolbar-tooltip\],[\s\S]*\.dasti-artifact-inspector \[data-toolbar-tooltip\],[\s\S]*\.dasti-proposal-rail-cluster \[data-toolbar-tooltip\],[\s\S]*\.dasti-proposal-sheet__controls \[data-toolbar-tooltip\],[\s\S]*\.dasti-proposal-toolbar \[data-toolbar-tooltip\]\s*\{[\s\S]*--dasti-toolbar-tooltip-inset-block-start:/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card\s*\{[\s\S]*--document-rail-gap:\s*var\(--space-2\);[\s\S]*--proposal-sheet-edge-fade-height:\s*22px;[\s\S]*--proposal-chrome-shell-padding:\s*calc\(var\(--space-2\)\s*-\s*3px\);/,
    );
  });
});
