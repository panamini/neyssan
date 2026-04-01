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
  });

  it("pads the document stage inside the proposal shell and anchors the character badge to the shell corner", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{[\s\S]*padding-block-start:\s*var\(--document-viewer-bleed-block\);[\s\S]*padding-inline:\s*var\(--document-viewer-bleed-inline\);[\s\S]*padding-block-end:\s*calc\(var\(--document-viewer-bleed-block\)\s*\+\s*var\(--space-2\)\);[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge-wrap\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-inline-start:[\s\S]*inset-block-end:/,
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
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell\s*\{[\s\S]*--document-shell-padding-inline:\s*8px;[\s\S]*--document-shell-padding-block:\s*8px;[\s\S]*--proposal-output-stage-frame-padding:\s*8px;[\s\S]*--proposal-output-rail-inline-inset:\s*var\(--document-shell-padding-inline\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s*\{[\s\S]*--document-shell-padding-inline:\s*0px;[\s\S]*--document-shell-padding-block:\s*0px;[\s\S]*--proposal-output-stage-frame-padding:\s*4px;[\s\S]*--proposal-output-rail-inline-inset:\s*4px;/,
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
    expect(productCss).toMatch(
      /@media \(max-width: 1439px\)\s*\{[\s\S]*\.dasti-proposal-output-shell\s*\{[\s\S]*--proposal-output-toolbar-lift:\s*0px;[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail\s*\{[\s\S]*position:\s*static;[\s\S]*margin-block-end:\s*var\(--document-rail-gap\);/,
    );
    expect(productCss).toMatch(
      /@media \(max-width: 520px\)\s*\{[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail\s*\{[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-document-rail__section\s*\{[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-proposal-rail-cluster,\s*[\s\S]*\.dasti-proposal-output-shell\s+\.dasti-proposal-sheet__controls\s*\{[\s\S]*padding:\s*4px;/,
    );
  });

  it("lets the desktop Proposal Forge compose shell match the live output shell block size instead of shrinking by A4 ratio", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-compose-column--workspace\s*\{[\s\S]*--document-shell-padding-inline:\s*4px;[\s\S]*--proposal-sheet-margin-inline-inner:\s*4px;[\s\S]*--proposal-sheet-margin-inline-outer:\s*4px;[\s\S]*--proposal-sheet-margin-block-start:\s*4px;[\s\S]*--proposal-sheet-margin-block-end:\s*12px;[\s\S]*--proposal-sheet-content-bottom-inset:\s*12px;[\s\S]*--proposal-sheet-edge-fade-height:\s*18px;[\s\S]*--proposal-live-shell-block-size:\s*var\(--proposal-workspace-shell-block-size\);/,
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
});
