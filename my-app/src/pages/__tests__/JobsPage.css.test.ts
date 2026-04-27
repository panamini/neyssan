import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("JobsPage CSS contracts", () => {
  it("keeps Jobs filter drawers clear of the toolbar and above the list", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chips\s*\{[\s\S]*overflow:\s*visible;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chips\s+\.dasti-proposal-library-filter-menu\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*2;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chips\s+\.dasti-proposal-library-filter-menu__drawer\s*\{[\s\S]*inset-block-start:\s*calc\(100%\s*\+\s*var\(--space-2\)\);[\s\S]*z-index:\s*calc\(var\(--z-popover\)\s*\+\s*1\);/,
    );
  });

  it("raises open job row menus above neighboring cards and keeps the menu compact", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-row\s*\{[\s\S]*position:\s*relative;[\s\S]*overflow:\s*visible;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row--menu-open\s*\{[\s\S]*z-index:\s*calc\(var\(--z-popover\)\s*\+\s*1\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__menu-surface\s*\{[\s\S]*inline-size:\s*min\(188px,\s*calc\(100vw - \(var\(--space-4\) \* 2\)\)\);[\s\S]*min-inline-size:\s*min\(160px,\s*calc\(100vw - \(var\(--space-4\) \* 2\)\)\);[\s\S]*z-index:\s*calc\(var\(--z-popover\)\s*\+\s*2\);/,
    );
  });

  it("anchors the resume picker drawer to the resume control with the shared surface gap token", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__header-actions\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*var\(--space-1\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__header-action\s*\{[\s\S]*border:\s*1px solid var\(--proposal-chrome-control-border\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);[\s\S]*color:\s*var\(--tm2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__header-resume\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*min-width:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__resume-picker\s*\{[\s\S]*--toolbar-attached-surface-gap:\s*var\(--anchored-surface-gap,\s*2px\);[\s\S]*--dasti-toolbar-attached-surface-offset:\s*var\(--toolbar-attached-surface-gap\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__resume-popover\s*\{[\s\S]*inset-inline-start:\s*0;[\s\S]*inset-inline-end:\s*auto;/,
    );
  });

  it("reuses the detail favorite chrome for job row favorite and menu controls", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__favorite-action,\s*[\s\S]*\.dasti-jobs-row__favorite,\s*[\s\S]*\.dasti-jobs-row__menu-trigger\s*\{[\s\S]*border-color:\s*var\(--proposal-chrome-control-border\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);[\s\S]*color:\s*var\(--tm2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__favorite-action\[aria-pressed="true"\],\s*[\s\S]*\.dasti-jobs-row__favorite\[aria-pressed="true"\]\s*\{[\s\S]*background:\s*var\(--proposal-chrome-control-active-bg\);/,
    );
  });
});
