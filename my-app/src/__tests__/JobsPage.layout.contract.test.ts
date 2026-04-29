import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const jobsPageSource = readFileSync(
  resolve(process.cwd(), "src/pages/JobsPage.tsx"),
  "utf8",
);
const jobsWorkspaceSource = readFileSync(
  resolve(process.cwd(), "src/components/jobs/JobsWorkspace.tsx"),
  "utf8",
);
const jobsListSource = readFileSync(
  resolve(process.cwd(), "src/components/jobs/JobsList.tsx"),
  "utf8",
);
const jobDetailSource = readFileSync(
  resolve(process.cwd(), "src/components/jobs/JobDetail.tsx"),
  "utf8",
);
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

describe("JobsPage collapsed layout contract", () => {
  it("keeps the PR3 jobs workspace on the skeleton split-view contract", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*360px\s+minmax\(0,\s*1fr\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-toolbar\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/,
    );
    expect(jobsListSource).toContain("Paste URL");
    expect(jobsListSource).toContain("Capture with extension");
    expect(jobsListSource).toContain("Remote");
    expect(jobsListSource).toContain("Senior");
    expect(jobDetailSource).toContain("Generate proposal");
  });

  it("renders selected job detail inline after the active row at the collapsed breakpoint", () => {
    expect(jobsWorkspaceSource).toContain(
      "const JOBS_TWO_PANE_MIN_VIEWPORT_WIDTH = 1440;",
    );
    expect(jobsWorkspaceSource).toContain(
      "viewportWidth < JOBS_TWO_PANE_MIN_VIEWPORT_WIDTH",
    );
    expect(jobsWorkspaceSource).toContain("shouldRenderInlineDetailPane");
    expect(jobsListSource).toContain('className="dasti-jobs-list-item"');
    expect(jobsListSource).toContain('className="dasti-jobs-inline-detail"');
    expect(jobsWorkspaceSource).toContain("!shouldRenderInlineDetailPane");
  });

  it("keeps jobs controls compact and left-anchored inside the list pane", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*360px\s+minmax\(0,\s*1fr\);/,
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
    expect(jobsListSource).toContain("ListMagnifyingGlass");
    expect(productCss).toContain(".dasti-jobs-toolbar__search-icon");
  });

  it("keeps JobsPage as the extracted route shell", () => {
    expect(jobsPageSource.split("\n").length).toBeLessThan(400);
    expect(jobsPageSource).toContain("JobsWorkspacePage");
  });
});
