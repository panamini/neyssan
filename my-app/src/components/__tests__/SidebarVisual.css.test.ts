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
  it("uses permanent rail tokens and icon-tile active state", () => {
    expect(productCss).toMatch(
      /\.sb\s*\{[\s\S]*width:\s*var\(--app-nav-rail-width\);[\s\S]*flex:\s*0 0 var\(--app-nav-rail-width\);/,
    );
    expect(productCss).toMatch(
      /\.sb__nav\s*\{[\s\S]*padding:\s*var\(--app-nav-rail-pad-block\) var\(--app-nav-rail-pad-inline\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button\s*\{[\s\S]*width:\s*100%;[\s\S]*min-height:\s*var\(--app-nav-item-block-size\);[\s\S]*border-radius:\s*var\(--app-nav-item-radius\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button__label\s*\{[\s\S]*font-size:\s*var\(--app-nav-label-size\);[\s\S]*line-height:\s*var\(--app-nav-label-line\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button:hover\s*\{[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--tm2\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button:hover \.sb-rail-button__icon\s*\{[\s\S]*background:\s*var\(--sidebar-hover-bg\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button:focus-visible\s*\{[\s\S]*outline:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button:focus-visible \.sb-rail-button__icon\s*\{[\s\S]*background:\s*var\(--sidebar-hover-bg\);[\s\S]*box-shadow:[\s\S]*var\(--color-border-strong\)[\s\S]*var\(--ti\)/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--route-active,\s*\.sb-rail-button--active\s*\{[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--route-active \.sb-rail-button__icon,\s*\.sb-rail-button--active \.sb-rail-button__icon\s*\{[\s\S]*background:\s*var\(--sf2\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--route-active::before,\s*\.sb-rail-button--active::before\s*\{[\s\S]*content:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--route-active \.sb-rail-button__glyph--regular,\s*\.sb-rail-button--active \.sb-rail-button__glyph--regular\s*\{[\s\S]*opacity:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--route-active \.sb-rail-button__glyph--fill,\s*\.sb-rail-button--active \.sb-rail-button__glyph--fill\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(productCss).not.toMatch(
      /\.sb-rail-button--panel-open \.sb-rail-button__glyph--regular\s*\{[\s\S]*opacity:\s*0;/,
    );
    expect(productCss).not.toMatch(
      /\.sb-rail-button--panel-open \.sb-rail-button__glyph--fill\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(productCss).not.toMatch(
      /\.sb-rail-button:hover[^{]*\.sb-rail-button__glyph--fill/,
    );
  });

  it("docks pinned forge drawers as a shell column without changing peek overlay behavior", () => {
    expect(productCss).toMatch(
      /\.app-shell\[data-forge-panel-docked="true"\]\s*\{[\s\S]*grid-template-columns:\s*auto[\s\S]*var\(--app-nav-panel-width-wide\)[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(productCss).toMatch(
      /\.app-shell\[data-forge-panel-docked="true"\] \.forge-template-panel\s*\{[\s\S]*position:\s*relative;[\s\S]*grid-column:\s*2;[\s\S]*width:\s*var\(--app-nav-panel-width-wide\);/,
    );
    expect(productCss).toMatch(
      /\.forge-template-panel\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset-inline-start:\s*var\(--app-nav-rail-width\);/,
    );
    expect(productCss).toContain(".forge-template-panel__collapse");
    expect(productCss).toMatch(
      /\.forge-template-panel__collapse\s*\{[\s\S]*inset-inline-end:\s*0;[\s\S]*transform:\s*translate\(50%,\s*-50%\);/,
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

  it("defines a reusable responsive forge document identity contract", () => {
    expect(productCss).toContain(".app-topbar__doc-identity");
    expect(productCss).toContain(".app-topbar__doc-state");
    expect(productCss).toContain(".app-topbar__doc-title");
    expect(productCss).toContain(".app-topbar__doc-title-main");
    expect(productCss).toContain(".app-topbar__doc-title-suffix");
    expect(productCss).toContain(".app-topbar__doc-meta");
    expect(productCss).toContain(".app-topbar__doc-health");
    expect(productCss).toContain(".app-topbar__actions");
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*\.app-topbar__doc-title-suffix\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.app-topbar__doc-title,[\s\S]*\.app-topbar__doc-meta\s*\{[\s\S]*display:\s*none;/,
    );
  });

  it("wraps the collapsed sidebar logo in a rounded surface shell", () => {
    expect(productCss).toMatch(
      /\.sb-toggle__collapsed-logo-shell\s*\{[\s\S]*width:\s*36px;[\s\S]*height:\s*36px;[\s\S]*border-radius:\s*var\(--radius-card\);[\s\S]*background:\s*color-mix\(in srgb,\s*var\(--color-surface\)\s*86%,\s*transparent\);/,
    );
    expect(productCss).toMatch(
      /\.sb-toggle__collapsed-logo\s*\{[\s\S]*width:\s*30px;[\s\S]*height:\s*30px;[\s\S]*object-fit:\s*contain;/,
    );
    expect(productCss).toMatch(
      /\.sb-toggle__collapsed-logo--dark\s*\{[\s\S]*filter:\s*brightness\(0\.92\);/,
    );
  });

  it("keeps the topbar divider optically aligned with the sidebar divider", () => {
    expect(productCss).toMatch(
      /\.sb\s*\{[\s\S]*border-right:\s*1px solid\s*color-mix\(in srgb,\s*var\(--color-border\) 76%,\s*transparent\);/,
    );
    expect(productCss).toMatch(
      /\.app-topbar\s*\{[\s\S]*border-bottom:\s*1px solid\s*color-mix\(in srgb,\s*var\(--color-border\) 76%,\s*transparent\);[\s\S]*box-shadow:\s*none;/,
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
