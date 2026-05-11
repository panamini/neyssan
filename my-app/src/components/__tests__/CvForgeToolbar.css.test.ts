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
const cvForgeSource = readFileSync(
  resolve(process.cwd(), "src/pages/CvForge.tsx"),
  "utf8",
);
const cvRailSource = readFileSync(
  resolve(process.cwd(), "src/components/cv/CvRail.tsx"),
  "utf8",
);
const cvSectionsOrganizerSource = readFileSync(
  resolve(process.cwd(), "src/components/cv/CvSectionsOrganizer.tsx"),
  "utf8",
);
const cvSectionsDrawerSource = readFileSync(
  resolve(process.cwd(), "src/components/cv/CvSectionsDrawer.tsx"),
  "utf8",
);

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
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-cv-edit-toolbar\s+\.dasti-resume-export-control\s+\.dasti-pill,[\s\S]*\.dasti-cv-workbench-bar--cv-workspace[\s\S]*\.dasti-resume-export-control[\s\S]*\.dasti-pill,[\s\S]*\.dasti-document-rail--resume-workspace[\s\S]*\.dasti-resume-export-control[\s\S]*\.dasti-pill\s*\{[\s\S]*display:\s*none;/,
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

  it("keeps the CV organize helper copy short enough for one rail line", () => {
    expect(cvSectionsOrganizerSource).toContain("Open a section row to edit its items.");
    expect(cvSectionsOrganizerSource).toContain("dasti-cv-sections-organizer");
    expect(cvSectionsOrganizerSource).not.toContain('data-rail-pane="sections"');
    expect(cvSectionsOrganizerSource).not.toContain(
      "Each section opens its own editor.",
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

  it("keeps CV page preview inside the PR4 forge shell and resume rail width", () => {
    expect(cvForgeSource).toContain(
      '"dasti-cv-paper-stage dasti-cv-page-preview-stage"',
    );
    expect(cvForgeSource).toContain('hostMode="panel"');
    expect(cvForgeSource).not.toContain('hostMode="workspace"');
    expect(cvForgeSource).not.toContain(
      'className="dasti-cv-preview-workbench"',
    );
    expect(cvForgeSource).not.toContain("<ProfileReviewCard");
    expect(cvForgeSource).not.toContain("<VerbatiCvPreviewPanel");
    expect(productCss).toMatch(
      /\.dasti-cv-skeleton-forge\s*\{[\s\S]*--cv-paper-visual-inline-size:\s*var\(--forge-page-inline-size\);[\s\S]*--cv-workspace-stage-inline-size:\s*var\(--cv-paper-visual-inline-size\);[\s\S]*--cv-workspace-rail-inline-size:\s*360px;[\s\S]*grid-template-columns:[\s\S]*minmax\(0,\s*var\(--cv-workspace-stage-inline-size\)\)[\s\S]*var\(--cv-workspace-rail-inline-size\);[\s\S]*justify-content:\s*center;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-paper-stage\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--cv-paper-visual-inline-size\)\);[\s\S]*margin-inline:\s*auto;[\s\S]*min-width:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-page-preview-stage\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--cv-paper-visual-inline-size\)\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-cv-skeleton-forge\s*\{[\s\S]*--cv-paper-visual-inline-size:\s*var\(--forge-page-inline-size-mobile\);[\s\S]*\.dasti-cv-paper-stage,[\s\S]*\.dasti-cv-page-preview-stage\s*\{[\s\S]*width:\s*var\(--cv-paper-visual-inline-size\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-document-rail--resume-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-document-rail--resume-workspace\s+\.dasti-proposal-rail-cluster\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*max-content;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-document-rail--resume-workspace\s+\.dasti-document-rail__section--start\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/,
    );
  });

  it("matches Proposal paper geometry and material on the CV preview stage", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-skeleton-forge__stage\s*\{[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-page-preview-stage\s+\.dasti-doc-viewer-shell--resume-panel\s*\{[\s\S]*padding:\s*0;[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-paper-stage\s+\.dasti-doc-viewer-shell--resume-panel\s*\{[\s\S]*padding:\s*0;[\s\S]*box-shadow:\s*[\s\S]*var\(--document-viewer-frame-shadow\),[\s\S]*0\s+12px\s+28px\s+-24px\s+color-mix\(in\s+srgb,\s*var\(--shadow-color\)\s+92%,\s*transparent\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-paper-stage\s+\.dasti-document-stage__canvas\[data-document-page="true"\]\s*\{[\s\S]*box-shadow:\s*var\(--document-stage-halo,\s*var\(--sh-paper\)\);/,
    );
  });

  it("uses proposal-like plain actions for the CV stage bar chrome", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-stage-bar\s*\{[\s\S]*overflow:\s*visible;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-stage-bar__plain-action\s*\{[\s\S]*border:\s*1px\s+solid\s+transparent;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-stage-bar__action-divider\s*\{[\s\S]*width:\s*1px;[\s\S]*height:\s*24px;/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1419px\)\s*\{[\s\S]*\.dasti-cv-ats\s*\{[\s\S]*inline-size:\s*48px;[\s\S]*padding-inline:\s*0;[\s\S]*\.dasti-cv-ats\[data-state="ready"\]\s*\{[\s\S]*background:\s*var\(--okb\);[\s\S]*\.dasti-cv-ats__mark\s*\{[\s\S]*display:\s*inline-grid;[\s\S]*background:\s*transparent;[\s\S]*\.dasti-cv-ats__label,[\s\S]*\.dasti-cv-stage-bar__pick-label\s*\{[\s\S]*display:\s*none;/,
    );
  });

  it("keeps CV forge canvas and rail tabs aligned with Proposal forge", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-skeleton-forge\s*\{[\s\S]*background:\s*transparent;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-rail\s*\{[\s\S]*--cv-rail-row-active-bg:\s*var\(--sf1\);[\s\S]*padding:\s*var\(--space-5\);[\s\S]*border:\s*1px\s+solid\s+var\(--border-soft\);[\s\S]*border-radius:\s*var\(--r-surface,\s*var\(--radius-card\)\);[\s\S]*background:\s*var\(--sfr\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1419px\)\s*\{[\s\S]*\.dasti-cv-rail\s*\{[\s\S]*max-height:\s*none;[\s\S]*position:\s*static;[\s\S]*padding:\s*var\(--space-5\);[\s\S]*border:\s*1px\s+solid\s+var\(--border-soft\);[\s\S]*border-radius:\s*var\(--r-surface,\s*var\(--radius-card\)\);[\s\S]*background:\s*var\(--sfr\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-rail-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*padding:\s*var\(--space-1\);[\s\S]*\.dasti-cv-rail-tabs button\s*\{[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*min-block-size:\s*var\(--control-sm\);/,
    );
    expect(cvSectionsDrawerSource).toContain("forge-template-panel");
    expect(cvForgeSource).not.toContain("data-cv-sections-panel-docked");
    expect(productCss).not.toContain("dasti-cv-sections-drawer-backdrop");
    expect(productCss).not.toContain("data-cv-sections-panel-docked");
    expect(productCss).toMatch(
      /\.dasti-cv-rail-tabs button\[data-active="true"\]\s*\{[\s\S]*background:\s*var\(--color-surface-raised\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-org-row\[data-active="true"\]\s*\{[\s\S]*border-color:\s*var\(--proposal-chrome-control-active-border,\s*var\(--ac\)\);[\s\S]*background:\s*var\(--proposal-chrome-control-active-bg,\s*var\(--cv-rail-row-active-bg\)\);[\s\S]*box-shadow:\s*none;/,
    );
    expect(cvForgeSource).toContain("CV_PAPER_VISUAL_INLINE_SIZE");
    expect(cvForgeSource).toContain('"--cv-paper-visual-inline-size"');
  });

  it("uses the shared document loader shimmer for CV PDF import progress", () => {
    expect(cvForgeSource).toContain("dasti-cv-import-progress");
    expect(cvForgeSource).toContain("dasti-loader-caret");
    expect(productCss).toMatch(
      /\.dasti-cv-import-progress\s*\{[\s\S]*--cv-import-loader-shine:\s*color-mix\([\s\S]*position:\s*relative;[\s\S]*isolation:\s*isolate;[\s\S]*overflow:\s*hidden;/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-import-progress::after\s*\{[\s\S]*var\(--cv-import-loader-shine\)\s*50%[\s\S]*animation:\s*tw-document-shimmer\s+1700ms\s+cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)\s+infinite;/,
    );
    expect(productCss).toMatch(
      /\.dark\s+\.dasti-cv-import-progress,[\s\S]*?\[data-theme="dark"\]\s+\.dasti-cv-import-progress\s*\{[\s\S]*--cv-import-loader-shine:\s*rgba\(242,\s*234,\s*219,\s*0\.16\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.dasti-cv-import-progress__dot,[\s\S]*\.dasti-cv-import-progress::after\s*\{[\s\S]*animation:\s*none;/,
    );
    expect(productCss).not.toContain("--cv-import-loader-speckle");
  });

  it("collapses resume workspace export chrome at the tablet toolbar breakpoint", () => {
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-document-rail--resume-workspace[\s\S]*\.dasti-resume-export-control[\s\S]*\.dasti-pill\s*\{[\s\S]*display:\s*none;/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-document-rail--resume-workspace[\s\S]*\.dasti-resume-export-control__primary\s*\{[\s\S]*inline-size:\s*var\(--control-sm\);[\s\S]*min-inline-size:\s*var\(--control-sm\);/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.dasti-document-rail--resume-workspace[\s\S]*\.dasti-resume-export-control__primary-label\s*\{[\s\S]*display:\s*none;/,
    );
  });
});
