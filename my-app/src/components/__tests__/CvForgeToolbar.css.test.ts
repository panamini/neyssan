import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("keeps the CV eye toggle floating inside the workbench scroll area", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-workbench-toggle\s*\{[\s\S]*min-block-size:\s*var\(--dasti-toolbar-shell-block-size\);[\s\S]*padding:\s*var\(--proposal-chrome-shell-padding,\s*calc\(var\(--space-2\)\s*-\s*2px\)\);[\s\S]*width:\s*fit-content;/,
    );
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
      /\.dasti-doc-viewer-shell--resume-workspace\s*\{[\s\S]*--cv-edit-toggle-shell-inline-size:\s*calc\([\s\S]*--cv-edit-toolbar-inline-offset:\s*0px;[\s\S]*\}/,
    );
    expect(productCss).toMatch(
      /\.dasti-document-rail--resume-workspace\s*\{[\s\S]*inset-inline-start:\s*var\(--space-4\);[\s\S]*inset-inline-end:\s*auto;[\s\S]*width:\s*max-content;[\s\S]*max-width:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv-toggle\s*\{[\s\S]*inset-block-start:\s*var\(--space-2\);[\s\S]*inset-inline-start:\s*var\(--space-4\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-edit-toolbar\s*\{[\s\S]*width:\s*100%;[\s\S]*min-block-size:\s*var\(--document-viewer-toolbar-block-size\);[\s\S]*padding-inline-start:\s*var\(--cv-edit-toolbar-inline-offset,\s*0px\);/,
    );
    expect(productCss).toMatch(
      /@media \(min-width:\s*768px\)\s*\{[\s\S]*\.dasti-doc-viewer-shell--resume-workspace,\s*\.dasti-cv-edit-workbench-shell\s*\{[\s\S]*--cv-edit-toolbar-inline-offset:\s*calc\(\s*var\(--cv-edit-toggle-shell-inline-size\)\s*\+\s*var\(--space-2\)\s*\);/,
    );
  });
});
