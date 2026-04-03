import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("keeps the CV eye toggle floating inside the workbench scroll area", () => {
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv\s*\{[\s\S]*position:\s*sticky;[\s\S]*inset-block-start:\s*var\(--space-2\);[\s\S]*width:\s*max-content;[\s\S]*z-index:\s*24;/,
    );
  });
});
