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
const jobMatchPanelSource = readFileSync(
  resolve(process.cwd(), "src/components/jobs/JobMatchPanel.tsx"),
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
      /\.dasti-jobs-chrome\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/,
    );
    expect(jobsListSource).not.toContain("Paste URL");
    expect(jobsListSource).not.toContain("Capture with extension");
    expect(jobsListSource).toContain("+ Add job");
    expect(jobsListSource).toContain('align="start"');
    expect(jobsListSource).toContain("dasti-jobs-filter-chip--icon");
    expect(jobsListSource).toContain('aria-label="Favorites"');
    expect(jobsListSource).toContain("aria-pressed={favoritesOnly}");
    expect(jobsListSource).toContain("PROPOSAL_EXTENSION_INSTALL_LINK");
    expect(jobsListSource).toContain("getProposalExtensionSourceLinks");
    expect(jobsListSource).toContain("openExternalJobCaptureLink");
    expect(jobsListSource).not.toContain("onClick={onImportFirstJob}");
    expect(jobsListSource).toContain("+ Filters");
    expect(jobsListSource).toContain("Worth a shot");
    expect(jobsListSource).toContain("New");
    expect(jobsListSource).toContain("Favorites");
    expect(jobsListSource).toContain("Remote");
    expect(jobsListSource).toContain("Senior");
    expect(jobsListSource).toContain("Has docs");
    expect(jobsListSource).toContain("No docs");
    expect(jobsListSource).toContain("Match quality");
    expect(jobsListSource).toContain("Job traits");
    expect(jobDetailSource).toContain("Generate proposal");
  });

  it("keeps selected job detail in the right pane for non-collapsed widths", () => {
    expect(jobsWorkspaceSource).not.toContain(
      "JOBS_TWO_PANE_MIN_VIEWPORT_WIDTH",
    );
    expect(jobsWorkspaceSource).not.toContain("shouldRenderInlineDetailPane");
    expect(jobsListSource).not.toContain("dasti-jobs-inline-detail");
    expect(jobsWorkspaceSource).toContain(
      "JOBS_SPLIT_VIEW_COLLAPSE_WIDTH = 1024",
    );
    expect(jobsWorkspaceSource).toContain(
      "viewportWidth < JOBS_SPLIT_VIEW_COLLAPSE_WIDTH",
    );
    expect(jobsWorkspaceSource).toContain("dasti-jobs-detail-pane");
    expect(jobsWorkspaceSource).toContain('aria-label="Job detail"');
  });

  it("exposes APP skeleton aliases on the active split-view surfaces", () => {
    expect(jobsWorkspaceSource).toMatch(
      /className=\{\[[\s\S]*"dasti-jobs-layout",[\s\S]*"jobs",/,
    );
    expect(jobsListSource).toContain("dasti-jobs-list-pane jobs__list");
    expect(jobsWorkspaceSource).toContain("dasti-jobs-detail-pane jobs__detail");
    expect(jobMatchPanelSource).toContain(
      "dasti-proposal-sheet dasti-match-read dasti-job-match-panel jobs__match",
    );
  });

  it("keeps jobs controls compact and left-anchored inside the list pane", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*360px\s+minmax\(0,\s*1fr\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-page\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);[\s\S]*height:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-layout\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-list-pane\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-list\s*\{[\s\S]*display:\s*flex;[\s\S]*flex:\s*1 1 auto;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail-pane\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex:\s*1 1 auto;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__body\s*\{[\s\S]*display:\s*grid;[\s\S]*flex:\s*1 1 auto;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*320px\);[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/,
    );
    expect(productCss).not.toMatch(
      /@media\s*\(max-width:\s*1439px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*min\(100%,\s*560px\)\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*\.dasti-jobs-layout\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
    expect(productCss).not.toMatch(
      /@media\s*\(max-width:\s*1120px\)[\s\S]*\.dasti-jobs-detail__body\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-sort-control\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*1 1 auto;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-view-toggle\s*\{[\s\S]*width:\s*100%;[\s\S]*flex-wrap:\s*nowrap;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-view-toggle \.dasti-jobs-view-toggle__button\s*\{[\s\S]*flex:\s*1 1 50%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__rail\s*\{[\s\S]*display:\s*grid;[\s\S]*justify-items:\s*end;[\s\S]*min-width:\s*max-content;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__footer\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*flex-start;[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__controls\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*flex-end;[\s\S]*justify-self:\s*end;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-row__favorite-slot\s*\{[\s\S]*justify-content:\s*center;[\s\S]*color:\s*var\(--ac\);/,
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
