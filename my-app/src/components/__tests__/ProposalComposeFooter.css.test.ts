import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("Proposal compose footer CSS contracts", () => {
  it("lets the compose footer read as the actual bottom of the compose card", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet--composer\s*\{[\s\S]*padding-block-end:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet--composer\s+\.dasti-proposal-toolbar--inside\s*\{[\s\S]*margin-inline:\s*calc\(-1 \* var\(--document-shell-padding-inline\)\);[\s\S]*border-bottom-left-radius:\s*calc\(var\(--document-viewer-radius\)\s*-\s*1px\);[\s\S]*border-bottom-right-radius:\s*calc\(var\(--document-viewer-radius\)\s*-\s*1px\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-submit--composer\s*\{[\s\S]*--dasti-proposal-submit-radius:\s*999px;/,
    );
  });
});
