import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPaths = [
  "src/styles/product.css",
  "src/styles/product-proposal.css",
  "src/styles/product-libraries.css",
  "src/styles/product-jobs.css",
  "src/styles/product-cv.css",
  "src/styles/product-settings.css",
];
const productCss = productCssPaths
  .map((stylePath) => readFileSync(resolve(process.cwd(), stylePath), "utf8"))
  .join("\n");

function expectCssInOrder(snippets: string[]) {
  let cursor = -1;
  for (const snippet of snippets) {
    const nextIndex = productCss.indexOf(snippet, cursor + 1);
    expect(nextIndex).toBeGreaterThan(cursor);
    cursor = nextIndex;
  }
}

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
    expect(productCss).toContain(
      ".dasti-proposal-sheet__preview-page--stacked",
    );
    expect(productCss).toContain("aspect-ratio: auto;");
    expect(productCss).toContain("overflow: visible;");
    expect(productCss).toContain(
      ".dasti-proposal-sheet__preview-page--stacked .dasti-proposal-document__page {",
    );
    expect(productCss).toContain(
      "border-radius: var(--document-paper-radius);",
    );
    expect(productCss).toContain("box-shadow: var(--document-stage-halo);");
  });

  it("pads the document stage inside the proposal shell and anchors the character badge to the shell corner", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*box-sizing:\s*border-box;[\s\S]*border:\s*1px solid var\(--document-viewer-frame-border\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{[\s\S]*padding-block-start:\s*var\(--document-viewer-bleed-block\);[\s\S]*padding-inline:\s*var\(--document-viewer-bleed-inline\);[\s\S]*padding-block-end:\s*calc\(var\(--document-viewer-bleed-block\)\s*\+\s*var\(--space-2\)\);[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(productCss).toContain(".dasti-proposal-character-badge-wrap {");
    expect(productCss).toContain(".dasti-proposal-page-count-badge {");
    expect(productCss).toContain("position: absolute;");
    expect(productCss).toContain(
      "var(--proposal-output-stage-frame-padding, 0px)",
    );
    expect(productCss).toContain("var(--document-shell-padding-inline)");
    expect(productCss).toContain("var(--document-shell-padding-block)");
    expect(productCss).not.toMatch(
      /\.dasti-proposal-library-card--selected\s+\.dasti-doc-viewer-shell__surface\s*\{[\s\S]*--proposal-document-badge-block-inset:\s*calc\(var\(--space-1\)\s*\+\s*1px\);/,
    );
  });

  it("keeps the focused saved-proposal badge anchored by the shared shell inset", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--selected\s+\.dasti-doc-viewer-shell__surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*box-sizing:\s*border-box;/,
    );
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
    expectCssInOrder([
      ".dasti-proposal-output-shell {",
      "--document-shell-padding-inline: 8px;",
      "--document-shell-padding-block: 8px;",
      "--proposal-output-stage-frame-padding: 8px;",
      "--proposal-output-rail-inline-inset: var(--document-shell-padding-inline);",
      "--proposal-output-toolbar-lift: calc(",
      "var(--document-viewer-toolbar-block-size) + var(--space-2)",
      "--proposal-output-shell-max-block: calc(",
      "100dvh",
      "var(--proposal-output-toolbar-lift)",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell--workspace {",
      "--document-shell-padding-inline: 0px;",
      "--document-shell-padding-block: 0px;",
      "--document-viewer-bleed-inline: var(--s2);",
      "--document-viewer-bleed-block: var(--s2);",
      "--proposal-output-stage-frame-padding: var(--s2);",
      "--proposal-output-rail-inline-inset: 0px;",
      "--document-rail-gap: var(--space-2);",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell .dasti-document-rail {",
      "position: absolute;",
      "inset-block-start: calc(-1 * var(--proposal-output-toolbar-lift));",
      "inset-inline-start: var(--proposal-output-rail-inline-inset);",
      "inset-inline-end: var(--proposal-output-rail-inline-inset);",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell .dasti-document-shell {",
      "height: min(",
      "var(--document-viewer-shell-max-block),",
      "var(--proposal-output-shell-max-block)",
      "max-height: min(",
      "var(--document-viewer-shell-max-block),",
      "var(--proposal-output-shell-max-block)",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell\n  .dasti-proposal-sheet__body--document-viewer\n  .dasti-document-stage-chassis {",
      "justify-content: center;",
      "padding: var(--proposal-output-stage-frame-padding);",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell .dasti-document-rail__section--end {",
      "justify-self: end;",
      "margin-inline-start: auto;",
    ]);
    expectCssInOrder([
      ".dasti-proposal-output-shell\n  .dasti-document-rail__section--end\n  .dasti-artifact-inspector--header {",
      "justify-self: end;",
      "margin-inline-start: auto;",
    ]);
    expect(productCss).toContain(".dasti-proposal-library-card {");
    expect(productCss).toContain("--document-viewer-bleed-inline: var(--s2);");
    expect(productCss).toContain("--document-viewer-bleed-block: var(--s2);");
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card\s+\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{/,
    );
    const genericStagePaddingIndex = productCss.indexOf(
      ".dasti-proposal-sheet__body--document-viewer .dasti-document-stage-chassis",
    );
    const savedStagePaddingIndex = productCss.lastIndexOf(
      ".dasti-proposal-library-card\n  .dasti-proposal-sheet__body--document-viewer\n  .dasti-document-stage-chassis",
    );
    expect(genericStagePaddingIndex).toBeGreaterThanOrEqual(0);
    expect(savedStagePaddingIndex).toBeGreaterThan(genericStagePaddingIndex);
    expect(productCss).toContain("justify-content: center;");
    expect(productCss).toContain(
      "padding: var(--proposal-output-stage-frame-padding);",
    );
    expect(productCss).toMatch(
      /\[data-document-stage="true"\]\[data-stage-mode="overflow"\]\s*\{[\s\S]*scrollbar-gutter:\s*auto;[\s\S]*scrollbar-width:\s*thin;/,
    );
    expect(productCss).toContain(
      '.dasti-doc-viewport[data-document-stage="true"]::-webkit-scrollbar-thumb {',
    );
    expectCssInOrder([
      "@media (max-width: 1439px)",
      ".dasti-proposal-output-shell {",
      "--proposal-output-toolbar-lift: 0px;",
      ".dasti-proposal-output-shell .dasti-document-rail {",
      "position: static;",
      "margin-block-end: var(--document-rail-gap);",
      ".dasti-proposal-output-shell--workspace .dasti-document-shell {",
      "gap: 0;",
      "padding: 0;",
      "border: none;",
      "background: transparent;",
      "box-shadow: none;",
      ".dasti-proposal-output-shell--workspace\n    .dasti-proposal-sheet__body--document-viewer {",
      "border: 1px solid var(--document-viewer-frame-border);",
      "border-radius: var(--document-viewer-radius);",
      "background: var(--document-viewer-frame-surface);",
      "box-shadow:",
    ]);
    expectCssInOrder([
      "@media (max-width: 520px)",
      ".dasti-proposal-output-shell .dasti-document-rail {",
      "gap: var(--space-1);",
      ".dasti-proposal-output-shell .dasti-document-rail__section {",
      "gap: var(--space-1);",
      ".dasti-proposal-output-shell .dasti-proposal-rail-cluster,",
      ".dasti-proposal-output-shell .dasti-proposal-sheet__controls {",
      "padding: 4px;",
    ]);
  });

  it("lets the desktop Proposal Forge compose shell match the live output shell block size instead of shrinking by A4 ratio", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s*\{[\s\S]*--proposal-compose-workspace-inline-inset:\s*calc\(var\(--space-3\)\s*-\s*2px\);[\s\S]*--document-shell-padding-inline:\s*var\([\s\S]*--proposal-compose-workspace-inline-inset[\s\S]*\);[\s\S]*--proposal-sheet-margin-inline-inner:\s*var\([\s\S]*--proposal-compose-workspace-inline-inset[\s\S]*\);[\s\S]*--proposal-sheet-margin-inline-outer:\s*var\([\s\S]*--proposal-compose-workspace-inline-inset[\s\S]*\);[\s\S]*--proposal-sheet-margin-block-start:\s*0px;[\s\S]*--proposal-sheet-margin-block-end:\s*0px;[\s\S]*--proposal-sheet-content-bottom-inset:\s*0px;[\s\S]*--proposal-sheet-edge-fade-height:\s*22px;[\s\S]*--proposal-live-shell-block-size:\s*var\(--proposal-workspace-shell-block-size\);/,
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
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet--composer,\s*[\s\S]*\.dasti-proposal-compose-column--workspace\s+\.dasti-proposal-sheet__header--composer\s*\{[\s\S]*background:\s*var\(--sfr\);/,
    );
  });

  it("gives document edit mode full-width paper, bottom-safe scrolling, and an anchored count pill", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-document-stage-chassis\s*\{[\s\S]*justify-content:\s*center;[\s\S]*padding-block-start:\s*var\(--document-viewer-bleed-block\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-editor-page__inner\s*\{[\s\S]*inline-size:\s*100%;[\s\S]*max-inline-size:\s*min\([\s\S]*var\(--document-sheet-inline-size\)[\s\S]*var\(--proposal-document-reading-measure-max\)[\s\S]*var\(--proposal-output-editor-inline-padding\)[\s\S]*min-width:\s*0;[\s\S]*box-sizing:\s*border-box;[\s\S]*padding-block:\s*0;[\s\S]*padding-inline:\s*var\(--proposal-output-editor-inline-padding\);[\s\S]*margin-inline:\s*auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s*\{[\s\S]*overflow:\s*auto;[\s\S]*scroll-padding-block:\s*var\(--document-viewer-bleed-block\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-sheet__preview-stage\s*\{[\s\S]*max-height:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__textarea\s*\{[\s\S]*padding-block-start:\s*var\(--proposal-output-editor-block-start\);[\s\S]*padding-block-end:\s*var\(--proposal-output-editor-block-end\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-editor-page__textarea\s*\{[\s\S]*-webkit-mask-image:\s*linear-gradient\([\s\S]*var\(--proposal-output-editor-fade-height\)[\s\S]*var\(--proposal-scroll-top-strength\)[\s\S]*var\(--proposal-scroll-bottom-strength\)/,
    );
    expect(productCss).toContain(".dasti-proposal-character-badge-wrap {");
    expect(productCss).toContain("var(--document-shell-padding-inline)");
    expect(productCss).toContain(
      "var(--proposal-output-stage-frame-padding, 0px)",
    );
    expect(productCss).toContain(
      "var(--proposal-output-editor-block-end) + var(--control-sm) +",
    );
    expect(productCss).toContain(
      "scroll-padding-block-end: calc(var(--control-sm) + var(--space-3));",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge-wrap\[data-overlap-hidden="true"\]\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge\s*\{[\s\S]*background:\s*var\([\s\S]*--proposal-chrome-control-bg[\s\S]*--document-viewer-frame-surface/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge\s*\{[\s\S]*font-size:\s*var\(--text-caption-size\);[\s\S]*line-height:\s*var\(--text-caption-line\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-page-count-badge\s*\{[\s\S]*font-size:\s*var\(--text-caption-size\);[\s\S]*line-height:\s*var\(--text-caption-line\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__context-slot\s+\.dasti-pill--success,[\s\S]*\.dasti-proposal-character-badge\.dasti-pill--success\s*\{[\s\S]*var\(--color-success-soft\)[\s\S]*--proposal-chrome-control-bg/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__context-slot\s+\.dasti-pill--warning,[\s\S]*\.dasti-proposal-character-badge\.dasti-pill--warning\s*\{[\s\S]*var\(--color-warning-soft\)[\s\S]*--proposal-chrome-control-bg/,
    );
  });

  it("keeps proposal count pills readable and uses warning orange for semantic length", () => {
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__context-slot\s+\.dasti-pill,[\s\S]*\.dasti-proposal-character-badge\s*\{[\s\S]*font-size:\s*var\(--text-caption-size\);[\s\S]*line-height:\s*var\(--text-caption-line\);[\s\S]*font-weight:\s*var\(--font-label-weight\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge\s*\{[\s\S]*font-size:\s*var\(--text-caption-size\);[\s\S]*line-height:\s*var\(--text-caption-line\);[\s\S]*font-weight:\s*var\(--font-label-weight\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-length-signal\s*\{[\s\S]*background:\s*var\([\s\S]*--proposal-chrome-control-bg[\s\S]*border-color:\s*color-mix\(in srgb,\s*var\(--color-warning\)\s*34%,\s*transparent\);[\s\S]*color:\s*var\(--color-warning-ink\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-length-signal__bar::before\s*\{[\s\S]*background:\s*var\(--color-warning\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-length-signal__marker\s*\{[\s\S]*background:\s*var\(--color-warning\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-length-signal__label\s*\{[\s\S]*font-size:\s*inherit;[\s\S]*line-height:\s*inherit;[\s\S]*font-weight:\s*inherit;[\s\S]*color:\s*var\(--color-warning-ink\);/,
    );
    expect(productCss).not.toMatch(
      /\.dasti-length-signal(?:__bar::before|__marker|--ideal|__label)?[\s\S]{0,220}var\(--ac\)/,
    );
  });

  it("keeps inline AI proofing old text as document text with a strike instead of a filled error block", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-inline-proofing__old\s*\{[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--proposal-document-ink\);[\s\S]*text-decoration:\s*line-through;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-inline-proofing__new\s*\{[\s\S]*background:\s*var\(--ap\);[\s\S]*color:\s*var\(--proposal-document-ink\);/,
    );
  });

  it("keeps inline AI controls out of the mirrored text flow", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__inner\s*>\s*\.dasti-proposal-inline-proofing\s*\{[\s\S]*padding-inline:\s*var\(--proposal-output-editor-inline-padding\);[\s\S]*padding-block-start:\s*var\(--proposal-output-editor-block-start\);[\s\S]*padding-block-end:\s*var\(--proposal-output-editor-block-end\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-proposal-editor-page__inner\s+>\s*\.dasti-proposal-inline-proofing\s*\{[\s\S]*padding-block-end:\s*calc\([\s\S]*var\(--proposal-output-editor-block-end\)\s*\+\s*var\(--control-sm\)\s*\+\s*var\(--space-3\)/,
    );
    expect(productCss).not.toContain(
      ".dasti-proposal-inline-proofing__actions",
    );
    expect(productCss).not.toContain(
      ".dasti-proposal-inline-proofing__action-anchor",
    );
    expect(productCss).toMatch(
      /\.ds-ai-toolbar\s+\.dasti-proposal-inline-proofing__status\s*\{[\s\S]*height:\s*28px;[\s\S]*padding:\s*0\s+var\(--s3\);[\s\S]*background:\s*transparent;/,
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
    expect(productCss).toContain(".dasti-proposal-library-card--selected {");
    expect(productCss).toMatch(
      /--proposal-library-selected-shell-inline-size:\s*calc\([\s\S]*var\(--document-sheet-inline-size\)[\s\S]*var\(--s2\)\s*\*\s*2[\s\S]*2px/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(\s*0,\s*var\(--proposal-library-selected-shell-inline-size\)\s*\);/,
    );
    expect(productCss).toContain(
      ".dasti-proposal-library-selected-shell--with-sidebar {",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell--with-sidebar\s*\{[\s\S]*minmax\(\s*var\(--proposal-library-selected-shell-inline-size\),\s*var\(--proposal-library-selected-shell-inline-size\)\s*\);/,
    );
    expect(productCss).toMatch(
      /@media \(max-width:\s*1160px\)\s*\{[\s\S]*\.dasti-proposal-library-selected-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-info-card\s*\{[\s\S]*min-block-size:\s*216px;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-info-card__title\s*\{[\s\S]*-webkit-line-clamp:\s*4;/,
    );
    expect(productCss).toContain(
      "calc((var(--container-xs) / 2) - var(--space-6))",
    );
    expect(productCss).toContain(
      "calc((var(--container-xs) / 2) - var(--space-3))",
    );
    expect(productCss).toContain(
      "var(--proposal-library-selected-shell-inline-size)",
    );
    expect(productCss).toContain("column-gap: var(--layout-card-grid);");
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-sidebar\s*\{[\s\S]*justify-self:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card--selected\s*\{[\s\S]*justify-self:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card--selected\s*\{[\s\S]*--document-viewer-shell-inline-size:\s*var\([\s\S]*--proposal-library-selected-shell-inline-size[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card--selected\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--secondary\s*\{[\s\S]*--document-viewer-shell-inline-size:\s*calc\([\s\S]*var\(--document-sheet-inline-size\)\s*\+\s*\(var\(--s2\)\s*\*\s*2\)\s*\+\s*2px/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--secondary\s+\.dasti-document-shell\s*\{[\s\S]*height:\s*min\(560px,\s*var\(--document-viewer-shell-max-block\)\);[\s\S]*overflow:\s*hidden;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--secondary\s+\.dasti-proposal-sheet__preview-stage\s*\{[\s\S]*overflow:\s*hidden;/,
    );
    expect(productCss).not.toMatch(
      /\.dasti-proposal-library-selected-shell\s+\.dasti-proposal-library-card--selected\s*\{[\s\S]*--document-viewer-shell-max-block:/,
    );
    expectCssInOrder([
      ".dasti-proposal-output-shell .dasti-doc-viewer-shell__surface {",
      "--proposal-document-frame-inline-size: calc(",
      "var(--document-stage-width, var(--document-viewer-shell-inline-size))",
      "var(--proposal-output-stage-frame-padding)",
      "2px",
    ]);
    expectCssInOrder([
      ".dasti-proposal-library-card--selected .dasti-doc-viewer-shell__surface,",
      ".dasti-proposal-library-card--secondary .dasti-doc-viewer-shell__surface {",
      "--proposal-document-frame-inline-size: var(",
      "--document-viewer-shell-inline-size",
    ]);
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-proposal-sheet__footer\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--proposal-document-frame-inline-size\)\);[\s\S]*max-width:\s*min\(100%,\s*var\(--proposal-document-frame-inline-size\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-proposal-sheet-frame\s*\{[\s\S]*width:\s*min\([\s\S]*var\(--proposal-document-frame-inline-size\)[\s\S]*max-width:\s*min\(/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--secondary\s+\.dasti-proposal-sheet-frame\s*\{[\s\S]*width:\s*min\([\s\S]*var\(--proposal-document-frame-inline-size\)[\s\S]*max-width:\s*min\(/,
    );
    expectCssInOrder([
      ".dasti-proposal-library-card--selected .dasti-doc-viewer-shell,",
      ".dasti-proposal-library-card--selected .dasti-doc-viewer-shell__surface {",
      "height: var(--proposal-workspace-shell-block-size);",
      "min-height: var(--proposal-workspace-shell-block-size);",
      "max-height: var(--proposal-workspace-shell-block-size);",
    ]);
    expectCssInOrder([
      ".dasti-proposal-library-card--selected .dasti-doc-viewer-shell__surface {",
      "display: flex;",
      "flex-direction: column;",
      "box-sizing: border-box;",
    ]);
    expectCssInOrder([
      ".dasti-proposal-library-card--selected .dasti-proposal-sheet-frame {",
      "display: flex;",
      "flex: 1 1 auto;",
      "min-height: 0;",
      "height: 100%;",
      "max-height: 100%;",
      "width: min(100%, var(--proposal-document-frame-inline-size));",
    ]);
    expectCssInOrder([
      ".dasti-proposal-library-card--selected\n  .dasti-proposal-sheet-frame\n  > .dasti-document-shell {",
      "flex: 1 1 auto;",
      "min-height: 0;",
      "height: 100%;",
      "max-height: 100%;",
    ]);
    expectCssInOrder([
      ".dasti-proposal-library-selected-shell .dasti-proposal-library-card--selected {",
      "--proposal-output-shell-max-block: calc(",
      "var(--document-viewer-toolbar-block-size)",
      "var(--space-2)",
      "--proposal-workspace-shell-block-size: min(",
    ]);
    expect(productCss).toContain(".dasti-page-shell--proposal-saved {");
    expect(productCss).toContain(
      "--proposal-workspace-output-shell-inline-size: calc(",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-card--selected[\s\S]*?\.dasti-proposal-sheet__header--detached[\s\S]*?\.dasti-document-rail\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-tone-popover\s*\{[\s\S]*width:\s*max-content;[\s\S]*inset-inline-start:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar\s+\.dasti-proposal-chrome-drawer,\s*[\s\S]*\.dasti-proposal-saved-view-toolbar\s+\.dasti-doc-zoom-bar--popover\s*\{[\s\S]*border-radius:\s*var\(--radius-toolbar-shell\);[\s\S]*background:\s*color-mix\(/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar\.dasti-toolbar--surface-tooltips\s*\{[\s\S]*--dasti-toolbar-shell-edge-padding:/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar[\s\S]*?\.dasti-doc-zoom-bar--popover,[\s\S]*?\.dasti-artifact-inspector--header[\s\S]*?\.dasti-artifact-inspector__style-drawer,[\s\S]*?\.dasti-artifact-inspector__palette-drawer[\s\S]*?inset-inline-start:\s*0;[\s\S]*transform:\s*none;[\s\S]*transform-origin:\s*left top;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar[\s\S]*?\.dasti-proposal-saved-tone-popover\s*\{[\s\S]*inset-inline-start:\s*auto;[\s\S]*inset-inline-end:\s*0;[\s\S]*transform:\s*none;[\s\S]*transform-origin:\s*right top;/,
    );
    expect(productCss).toMatch(
      /\.dasti-saved-proposal-forge-toolbar-preview\s*\{[\s\S]*--proposal-chrome-shell-padding:\s*calc\(var\(--space-2\)\s*-\s*2px\);[\s\S]*--proposal-chrome-tight-gap:\s*var\(--space-1\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-saved-proposal-forge-toolbar-preview\s*\{[\s\S]*min-block-size:\s*var\(--document-viewer-toolbar-block-size\);[\s\S]*padding:\s*var\(--proposal-chrome-shell-padding\);[\s\S]*border-radius:\s*var\(--radius-toolbar-shell,\s*var\(--radius-card\)\);[\s\S]*background:\s*color-mix\(/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar\.dasti-document-rail--detached\s*\{[\s\S]*min-block-size:\s*var\(--hs\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-saved-view-toolbar\.dasti-document-rail--detached\s+\.dasti-document-rail__section--start:not\(:empty\)\s*\{[\s\S]*border-inline-end:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-saved-proposal-forge-toolbar-preview\[data-mode="preview"\]\s+\.dasti-saved-proposal-forge-toolbar-preview__anchor--layout\s*\{[\s\S]*margin-inline-start:\s*auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-saved-proposal-forge-toolbar-preview__drawer\s*\{[\s\S]*--dasti-toolbar-shell-edge-padding:\s*var\(--proposal-chrome-shell-padding\);[\s\S]*--dasti-toolbar-attached-surface-offset:\s*calc\([\s\S]*var\(--toolbar-attached-surface-gap,\s*2px\)[\s\S]*var\(--dasti-toolbar-shell-edge-padding,\s*0px\)[\s\S]*var\(--dasti-toolbar-surface-border-width,\s*0px\)/,
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
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-editor\s+\.dasti-document-stage-chassis\s*\{[\s\S]*padding-block-start:\s*var\(--document-viewer-bleed-block\);[\s\S]*padding-inline:\s*var\(--document-viewer-bleed-inline\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-hint\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-block-start:\s*var\(--space-2\);[\s\S]*inset-inline-end:\s*var\(--space-2\);[\s\S]*z-index:\s*6;[\s\S]*pointer-events:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__drawer\s*\{[\s\S]*--proposal-editor-page-close-block-inset:\s*clamp\(36px,\s*5vw,\s*56px\);[\s\S]*--proposal-editor-page-close-inline-inset:\s*clamp\(32px,\s*5vw,\s*56px\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__drawer\s*\{[\s\S]*background:\s*var\(--sfr\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__drawer-close\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-block-start:\s*var\(--proposal-editor-page-close-block-inset\);[\s\S]*inset-inline-end:\s*var\(--proposal-editor-page-close-inline-inset\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__field-input\s*\{[\s\S]*border:\s*2px solid transparent;[\s\S]*background:\s*var\(--sf2\);[\s\S]*color:\s*var\(--ti\);[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__field-input:hover:not\(:disabled,\s*:focus\)\s*\{[\s\S]*background:\s*var\(--sf3\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__field-input:focus\s*\{[\s\S]*border-color:\s*var\(--ti\);[\s\S]*background:\s*var\(--sf2\);[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__field-input:focus-visible\s*\{[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-editor-page__drawer-card:last-child\s*\{[\s\S]*border-bottom:\s*0;/,
    );
  });

  it("includes a dedicated Volk register proposal template branch", () => {
    expect(productCss).toContain(
      ".dasti-proposal-document--volk-register .dasti-proposal-document__page {",
    );
    expect(productCss).toContain(
      ".dasti-proposal-document--volk-register .dasti-proposal-document__volk-header {",
    );
    expect(productCss).toContain(
      ".dasti-proposal-document--volk-register .dasti-proposal-document__volk-content {",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-document--volk-register\s+\.dasti-proposal-document__body--volk-register\s*\{/,
    );
  });

  it("adds a structured header block for non-volk proposal templates", () => {
    expect(productCss).toContain(
      ".dasti-proposal-document__structured-header {",
    );
    expect(productCss).toContain(
      ".dasti-proposal-document__structured-header-item--subject {",
    );
    expect(productCss).toContain(
      ".dasti-proposal-document__structured-header-value--multiline {",
    );
  });

  it("adds a fixed-scale shell for volk register preview rendering", () => {
    expect(productCss).toContain(
      ".dasti-proposal-sheet__preview-scale-shell {",
    );
    expect(productCss).toContain("transform-origin: top left;");
  });
});
