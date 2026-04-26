import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("uses the shared proposal rail shell for the anchored CV edit toolbar", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-edit-workbench-shell\s+\.dasti-grid-split\s*\{[\s\S]*position:\s*relative;[\s\S]*container:\s*dasti-cv-edit-workbench\s*\/\s*inline-size;[\s\S]*padding-top:\s*calc\(var\(--document-viewer-toolbar-block-size\)\s*\+\s*var\(--space-2\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-edit-toolbar\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-block-start:\s*0;[\s\S]*inset-inline-start:\s*0;[\s\S]*justify-content:\s*flex-start;[\s\S]*inline-size:\s*fit-content;[\s\S]*max-inline-size:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-edit-toolbar__group\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*flex-wrap:\s*nowrap;/,
    );
  });

  it("collapses lower-priority CV toolbar controls before they overflow", () => {
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1280px\)\s*\{[\s\S]*\.dasti-cv-edit-toolbar\s+\.dasti-import-review-trigger\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-cv-edit-toolbar\s+\.dasti-resume-export-control\s+\.dasti-pill,[\s\S]*\.dasti-cv-workbench-bar--cv-workspace\s+\.dasti-resume-export-control\s+\.dasti-pill\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).toMatch(
      /@container\s+dasti-cv-edit-workbench\s+\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-cv-edit-toolbar\s+\.dasti-import-review-trigger\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).toMatch(
      /@container\s+dasti-cv-edit-workbench\s+\(max-width:\s*720px\)\s*\{[\s\S]*\.dasti-cv-edit-toolbar\s+\.dasti-import-button\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).not.toContain(
      ".dasti-resume-export-control__primary:nth-of-type(2)",
    );
  });

  it("keeps Manage sections on the same small label token as the toolbar buttons", () => {
    expect(productCss).toMatch(
      /\.dasti-add-section-trigger\s*\{[\s\S]*font-size:\s*var\(--text-caption-size\);[\s\S]*line-height:\s*1;[\s\S]*font-weight:\s*var\(--font-label-weight\);/,
    );
  });

  it("anchors the resume export drawer to the menu cell instead of the whole toolbar group", () => {
    expect(productCss).toMatch(
      /\.dasti-resume-export-control\s*\{[\s\S]*--dasti-resume-export-menu-inline-size:\s*min\([\s\S]*var\(--control-md\)[\s\S]*var\(--space-4\)[\s\S]*\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-resume-export-control__menu-cell\s*\{[\s\S]*position:\s*relative;[\s\S]*display:\s*inline-flex;/,
    );
    expect(productCss).toMatch(
      /\.dasti-resume-export-control__menu\s*\{[\s\S]*left:\s*auto;[\s\S]*right:\s*0;[\s\S]*inline-size:\s*var\(--dasti-resume-export-menu-inline-size\);[\s\S]*min-inline-size:\s*var\(--dasti-resume-export-menu-inline-size\);/,
    );
  });
});
