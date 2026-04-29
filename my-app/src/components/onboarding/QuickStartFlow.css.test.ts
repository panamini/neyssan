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

function readCssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = productCss.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return block?.[0] ?? "";
}

describe("Quick Start layout CSS contracts", () => {
  it("uses the shared container token for the Quick Start sheet width", () => {
    const paneBlock = readCssBlock(".dasti-quick-start-pane");
    const frameBlock = readCssBlock(".dasti-quick-start-pane__frame");

    expect(paneBlock).toContain(
      "--quick-start-sheet-inline-size: var(--container-xs, 480px);",
    );
    expect(frameBlock).toContain(
      "width: min(100%, var(--quick-start-sheet-inline-size));",
    );
  });

  it("keeps card rows and sheet height stable between entry slides", () => {
    const paneBlock = readCssBlock(".dasti-quick-start-pane");
    const frameBlock = readCssBlock(".dasti-quick-start-pane__frame");
    const sheetBlock = readCssBlock(".dasti-quick-start-sheet");
    const choiceButtonBlock = readCssBlock(".dasti-quick-start-choice__button");

    expect(paneBlock).toContain("--quick-start-choice-block-size: calc(");
    expect(paneBlock).toContain("var(--control-lg)");
    expect(paneBlock).toContain("var(--space-2)");
    expect(paneBlock).toContain("--quick-start-sheet-min-block-size: calc(");
    expect(paneBlock).toContain("--quick-start-frame-closed-block-size: calc(");
    expect(frameBlock).toContain(
      "block-size: var(--quick-start-frame-closed-block-size);",
    );
    expect(frameBlock).toContain("align-content: start;");
    expect(frameBlock).toContain("overflow: visible;");
    expect(sheetBlock).toContain(
      "min-block-size: var(--quick-start-sheet-min-block-size);",
    );
    expect(sheetBlock).toContain("align-content: start;");
    expect(choiceButtonBlock).toContain(
      "min-block-size: var(--quick-start-choice-block-size);",
    );
  });

  it("keeps compact Quick Start surfaces on the same viewport-height contract", () => {
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\.dasti-quick-start-pane\s*\{[\s\S]*min-height:\s*calc\(100dvh\s*-\s*var\(--hdr,\s*0px\)\);/,
    );
  });
});
