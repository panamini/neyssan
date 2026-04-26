import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalDisplay footer CSS contracts", () => {
  it("lets the paragraph actions footer become the true bottom of the output shell", () => {
    expect(productCss).toMatch(
      /\.dasti-doc-viewer-shell__surface:has\(> \.dasti-proposal-sheet__footer\)\s+\.dasti-proposal-sheet\s*\{[\s\S]*border-bottom-left-radius:\s*0;[\s\S]*border-bottom-right-radius:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__footer\s*\{[\s\S]*box-shadow:\s*none;/,
    );
  });

  it("keeps the forge workspace footer inside the same fixed shell height budget", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-doc-viewer-shell,\s*[\s\S]*\.dasti-proposal-output-shell--workspace\s+\.dasti-doc-viewer-shell__surface\s*\{[\s\S]*height:\s*var\(--proposal-workspace-shell-block-size\);[\s\S]*min-height:\s*var\(--proposal-workspace-shell-block-size\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-doc-viewer-shell__surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-proposal-sheet__preview-stage\s*\{[\s\S]*display:\s*grid;[\s\S]*justify-content:\s*center;[\s\S]*align-content:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-output-shell--workspace\s+\.dasti-proposal-sheet-frame\s*\{[\s\S]*display:\s*flex;[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/,
    );
  });
});
