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
      /\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{[\s\S]*padding:\s*var\(--document-viewer-bleed-block\)\s+var\(--document-viewer-bleed-inline\);[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-character-badge-wrap\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-inline-start:[\s\S]*inset-block-end:/,
    );
  });
});
