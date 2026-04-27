import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const jobsPageSource = readFileSync(
  resolve(process.cwd(), "src/pages/JobsPage.tsx"),
  "utf8",
);
const productCss = readFileSync(
  resolve(process.cwd(), "src/styles/product.css"),
  "utf8",
);

describe("JobsPage collapsed layout contract", () => {
  it("renders selected job detail inline after the active row at the collapsed breakpoint", () => {
    expect(jobsPageSource).toContain(
      "const JOBS_TWO_PANE_MIN_VIEWPORT_WIDTH = 1440;",
    );
    expect(jobsPageSource).toContain(
      "viewportWidth < JOBS_TWO_PANE_MIN_VIEWPORT_WIDTH",
    );
    expect(jobsPageSource).toContain("shouldRenderInlineDetailPane");
    expect(jobsPageSource).toContain('className="dasti-jobs-list-item"');
    expect(jobsPageSource).toContain('className="dasti-jobs-inline-detail"');
    expect(jobsPageSource).toContain("!shouldRenderInlineDetailPane");
  });

  it("keeps jobs controls compact and left-anchored inside the list pane", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*min\(100%,\s*560px\)\)\s*minmax\(0,\s*1fr\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1439px\)\s*\{[\s\S]*\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*min\(100%,\s*560px\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-filter-chips\s+\.dasti-proposal-library-filter-menu__drawer\s*\{[\s\S]*inset-inline-start:\s*0;[\s\S]*inset-inline-end:\s*auto;[\s\S]*inline-size:\s*max-content;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__controls\s*\{[\s\S]*align-self:\s*stretch;[\s\S]*align-content:\s*space-between;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__favorite-slot\s*\{[\s\S]*justify-content:\s*flex-end;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__menu-surface\s*\{[\s\S]*inline-size:\s*max-content;[\s\S]*min-inline-size:\s*100%;/,
    );
  });

  it("uses the list magnifying glass icon for the jobs search affordance", () => {
    expect(jobsPageSource).toContain("ListMagnifyingGlass");
    expect(productCss).toContain(".dasti-jobs-toolbar__search-icon");
  });
});
