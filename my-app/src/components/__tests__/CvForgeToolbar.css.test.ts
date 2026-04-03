import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("keeps the CV eye toggle floating inside the workbench scroll area", () => {
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv\s*\{[\s\S]*position:\s*relative;[\s\S]*inset-block-start:\s*auto;[\s\S]*width:\s*max-content;[\s\S]*pointer-events:\s*none;[\s\S]*z-index:\s*26;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv\s*>\s*\*\s*\{[\s\S]*pointer-events:\s*auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv-preview\s*\{[\s\S]*margin-bottom:\s*var\(--space-2\);[\s\S]*overflow:\s*visible;[\s\S]*pointer-events:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv-toggle\s*\{[\s\S]*inset-block-start:\s*var\(--space-2\);[\s\S]*inset-inline-start:\s*var\(--space-4\);/,
    );
  });
});
