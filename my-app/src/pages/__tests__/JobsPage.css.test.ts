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
const foundationCss = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);

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
      /\.dasti-jobs-row__menu-surface\s*\{[\s\S]*inline-size:\s*max-content;[\s\S]*min-inline-size:\s*100%;[\s\S]*max-inline-size:\s*min\(188px,\s*calc\(100vw - \(var\(--space-4\) \* 2\)\)\);[\s\S]*z-index:\s*calc\(var\(--z-popover\)\s*\+\s*2\);/,
    );
  });

  it("keeps Jobs list rows and match panel visually light for the skeleton surface", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-list\s*\{[\s\S]*gap:\s*2px;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row\s*\{[\s\S]*border:\s*1px solid transparent;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row:hover,\s*\.dasti-jobs-row:focus-visible\s*\{[\s\S]*background:\s*var\(--sf2\);[\s\S]*box-shadow:\s*none;[\s\S]*transform:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row--active\s*\{[\s\S]*border-color:\s*var\(--border-strong\);[\s\S]*background:\s*var\(--sfr\);[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel\s*\{[\s\S]*border:\s*1px solid var\(--border-soft\);[\s\S]*background:\s*var\(--sf1\);[\s\S]*box-shadow:\s*none;[\s\S]*padding:\s*var\(--space-4\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail \.dasti-brief-card--card\s*\{[\s\S]*padding:\s*0;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail \.dasti-proposal-sheet__header--brief\s*\{[\s\S]*padding:\s*0;[\s\S]*background:\s*transparent;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail \.dasti-brief-card__summary\s*\{[\s\S]*gap:\s*var\(--space-3\);[\s\S]*padding:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail \.dasti-brief-card__review-item\s*\{[\s\S]*border-color:\s*var\(--border-soft\);[\s\S]*background:\s*var\(--sfr\);[\s\S]*box-shadow:\s*var\(--sha\);/,
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

  it("reuses toolbar chrome for job row menu controls", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-row__menu-trigger\s*\{[\s\S]*border-color:\s*var\(--proposal-chrome-control-border\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);[\s\S]*color:\s*var\(--tm2\);/,
    );
  });

  it("aligns job pills with DS v2 pill tokens instead of legacy uppercase chips", () => {
    expect(foundationCss).toContain("--am-soft: #EBBCAF;");
    expect(foundationCss).toContain("--am-soft: rgba(212, 117, 84, 0.20);");
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chip\s*\{[\s\S]*background:\s*var\(--sf2\);[\s\S]*color:\s*var\(--tg3\);[\s\S]*font-size:\s*var\(--tx\);[\s\S]*line-height:\s*1;[\s\S]*letter-spacing:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chip--active\s*\{[\s\S]*background:\s*var\(--am-soft\);[\s\S]*color:\s*var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-sample-badge\s*\{[\s\S]*min-height:\s*28px;[\s\S]*background:\s*var\(--am-soft\);[\s\S]*line-height:\s*1;[\s\S]*text-transform:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__title\s*\{[\s\S]*justify-content:\s*space-between;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__company\s*\{[\s\S]*width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-match-chip\s*\{[\s\S]*margin-inline-start:\s*auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__footer\s*\{[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*space-between;[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__favorite-slot\s*\{[\s\S]*justify-content:\s*center;[\s\S]*color:\s*var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__meta-favorite-action\s*\{[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__action-row\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-start;[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__header-action--proposal\s*\{[\s\S]*background:\s*var\(--ac\);[\s\S]*color:\s*var\(--color-on-accent\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel \.ds-card__eyebrow\s*\{[\s\S]*color:\s*var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel__verdict\s*\{[\s\S]*width:\s*100%;[\s\S]*padding:\s*8px var\(--s3\);[\s\S]*font-size:\s*var\(--ts\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel \.dasti-match-read__header\s*\{[\s\S]*border-bottom:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel__refresh\s*\{[\s\S]*justify-self:\s*end;[\s\S]*margin-inline-start:\s*auto;[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--tg2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel__explanation\s*\{[\s\S]*color:\s*var\(--tm2\);[\s\S]*line-height:\s*var\(--lb\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel__breakdown\s*\{[\s\S]*width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-job-match-panel \.dasti-match-read__details\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-self:\s*stretch;[\s\S]*padding:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-match-chip,\s*\.dasti-jobs-row__meta-pill\s*\{[\s\S]*min-height:\s*28px;[\s\S]*background:\s*var\(--sf2\);[\s\S]*line-height:\s*1;[\s\S]*letter-spacing:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-match-read__stat\s*\{[\s\S]*min-height:\s*28px;[\s\S]*padding:\s*0 var\(--s3\);[\s\S]*background:\s*var\(--sf2\);[\s\S]*color:\s*var\(--tg3\);[\s\S]*font-size:\s*var\(--tx\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-match-read__stat--warning\s*\{[\s\S]*background:\s*var\(--wab\);[\s\S]*color:\s*var\(--wat\);/,
    );
  });
});
