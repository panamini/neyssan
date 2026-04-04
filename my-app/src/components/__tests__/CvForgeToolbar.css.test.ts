import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("uses the shared proposal rail shell for the anchored CV edit toolbar", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-edit-workbench-shell\s+\.dasti-grid-split\s*\{[\s\S]*position:\s*relative;[\s\S]*padding-top:\s*calc\(var\(--document-viewer-toolbar-block-size\)\s*\+\s*var\(--space-2\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-edit-toolbar\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-block-start:\s*0;[\s\S]*inset-inline-start:\s*0;[\s\S]*justify-content:\s*flex-start;[\s\S]*width:\s*max-content;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-edit-toolbar__group\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*flex-wrap:\s*nowrap;/,
    );
  });
});
