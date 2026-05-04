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
const dsCss = readFileSync(resolve(process.cwd(), "src/styles/ds-v2.css"), "utf8");

describe("sidebar visual CSS contracts", () => {
  it("uses skeleton-style inline radius and a left accent stripe", () => {
    expect(productCss).toMatch(
      /\.sb-section__action,\s*\.sb-section__document,\s*\.sb-section__all-link\s*\{[\s\S]*border-radius:\s*var\(--radius-inline\);/,
    );
    expect(productCss).toMatch(
      /\.sb-doc\s*\{[\s\S]*border-radius:\s*var\(--radius-inline\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__action--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*color:\s*var\(--sidebar-active-ink\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__action--active::before\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleY\(1\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document::before\s*\{[\s\S]*left:\s*0;[\s\S]*top:\s*6px;[\s\S]*bottom:\s*6px;/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document--active::before\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleY\(1\);/,
    );
    expect(productCss).toMatch(
      /\.sb-doc--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.sb-doc--active::before\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleY\(1\);/,
    );
  });

  it("keeps document row actions hover/focus revealed instead of active-row revealed", () => {
    expect(productCss).toMatch(
      /\.sb-section__document-row:hover\s+\.sb-item-actions,\s*\.sb-section__document-row:focus-within\s+\.sb-item-actions\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(productCss).not.toMatch(
      /\.sb-section__document--active\s*\+\s*\.sb-item-actions/,
    );
  });

  it("keeps the topbar command shortcut as a tokenized pill", () => {
    expect(productCss).toMatch(
      /\.app-topbar__cmdk\s*\{[\s\S]*border-radius:\s*var\(--radius-pill\);[\s\S]*background:\s*var\(--sf1\);/,
    );
    expect(productCss).toMatch(
      /\.app-topbar__kbd\s*\{[\s\S]*border:\s*1px solid var\(--border-soft\);/,
    );
  });

  it("keeps DS sidebar active counts tied to accent tokens", () => {
    expect(dsCss).toMatch(
      /\.ds-sidebar__item--active\s*\{[\s\S]*position:\s*relative;[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(dsCss).toMatch(
      /\.ds-sidebar__item--active::before\s*\{[\s\S]*inset-block:\s*6px;[\s\S]*inset-inline-start:\s*0;[\s\S]*width:\s*2px;[\s\S]*background:\s*var\(--ac\);/,
    );
    expect(dsCss).toMatch(
      /\.ds-sidebar__item--active\s+\.ds-sidebar__count\s*\{[\s\S]*background:\s*var\(--am-soft\);[\s\S]*color:\s*var\(--ac\);/,
    );
  });
});
