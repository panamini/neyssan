import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = resolve(
  process.cwd(),
  "src/features/verbati/resume/resume-preview.css",
);
const resumePreviewCss = readFileSync(cssPath, "utf8");
const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("resume preview workspace anchoring", () => {
  it("keeps the workspace canvas stage top-anchored", () => {
    expect(resumePreviewCss).toMatch(
      /\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-doc-viewport--resume\s+\.resume-page-stage(?:,|\s)/,
    );
    expect(resumePreviewCss).toMatch(/place-items:\s*start start;/);
    expect(productCss).not.toContain("dasti-doc-viewer-shell--resume-workspace-page");
    expect(productCss).not.toContain(
      "dasti-resume-preview-panel__surface--workspace-page",
    );
    const workspaceStageOverride = productCss.match(
      /\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-doc-viewport--resume\[data-document-stage="true"\]\[data-stage-mode="fit"\],\s*\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-doc-viewport--resume\[data-document-stage="true"\]\[data-stage-mode="overflow"\]\s*\{[^}]*\}/,
    )?.[0];

    expect(workspaceStageOverride).toContain("scrollbar-gutter: auto;");
    expect(workspaceStageOverride).not.toContain("overflow: visible;");
    expect(productCss).toContain(
      '.dasti-doc-viewport[data-document-stage="true"][data-overflow-x="false"] {',
    );
    expect(productCss).toContain("overflow-x: hidden;");
    expect(productCss).toContain(
      '.dasti-doc-viewer-shell--resume-workspace\n  .dasti-doc-viewport--resume[data-document-stage="true"][data-overflow-x="true"] {',
    );
    expect(productCss).toContain("scrollbar-gutter: auto;");
    expect(resumePreviewCss).toContain(
      "min-height: var(--preview-page-height, auto);",
    );
    expect(resumePreviewCss).toContain(
      "height: var(--preview-stack-height, var(--preview-page-height, auto));",
    );
    expect(resumePreviewCss).toContain(".resume-page-stack__page-shell {");
    expect(resumePreviewCss).toContain("justify-items: start;");
    expect(resumePreviewCss).toContain("transform-origin: top left;");
    expect(resumePreviewCss).not.toContain(
      '.resume-page-stage--stacked .resume-page-stack {\n  transform: scale(var(--preview-scale, 1));',
    );

    const workspaceRailRule = productCss.match(
      /\.dasti-document-rail--resume-workspace\s*\{[^}]*\}/,
    )?.[0];

    expect(workspaceRailRule).toContain("position: relative;");
    expect(workspaceRailRule).toContain("width: 100%;");
    expect(workspaceRailRule).toContain(
      "margin-block-end: var(--resume-preview-toolbar-gap, var(--space-1));",
    );
  });

  it("clamps embedded resume frames to the viewport width outside workspace mode", () => {
    const embeddedFrameClamp = productCss.match(
      /\.dasti-doc-viewer-shell:not\(.dasti-doc-viewer-shell--resume-workspace\)\s+\.dasti-doc-viewport--resume\s+\.resume-page-frame\s*\{[^}]*\}/,
    )?.[0];

    expect(embeddedFrameClamp).toContain(
      "width: min(100%, var(--preview-stage-width, 100%));",
    );
    expect(embeddedFrameClamp).toContain("max-width: 100%;");
    expect(embeddedFrameClamp).toContain("min-width: 0;");
  });

  it("keeps the CV Forge workspace preview on a narrow shell and stage margin", () => {
    const workspaceShellRule = productCss.match(
      /\.dasti-doc-viewer-shell--resume-workspace\s*\{[^}]*\}/,
    )?.[0];
    const workspacePanelRule = productCss.match(
      /\.dasti-resume-preview-panel--workspace\s*\{[^}]*\}/,
    )?.[0];
    const workspaceSurfaceRule = productCss.match(
      /\.dasti-resume-preview-panel__surface--workspace\s*\{[^}]*\}/,
    )?.[0];
    const workspaceFrameRule = productCss.match(
      /\.dasti-proposal-sheet-frame--resume-workspace\s*\{[^}]*\}/,
    )?.[0];
    const workspaceStagePaddingRule = productCss.match(
      /\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-proposal-sheet__body--document-viewer\s+\.dasti-document-stage-chassis\s*\{[^}]*\}/,
    )?.[0];

    expect(workspaceShellRule).toContain(
      "--document-viewer-bleed-inline: 0px;",
    );
    expect(workspaceShellRule).toContain(
      "--document-viewer-bleed-block: 0px;",
    );
    expect(workspaceShellRule).toContain("--resume-preview-toolbar-gap: 0px;");
    expect(workspaceShellRule).toContain("--resume-preview-shell-padding: 0px;");
    expect(workspaceShellRule).toContain(
      "grid-template-rows: auto minmax(0, 1fr);",
    );
    expect(workspaceShellRule).toContain("width: 100%;");
    expect(workspaceShellRule).toContain("max-width: none;");
    expect(workspaceShellRule).toContain("margin-inline: 0;");
    expect(workspaceShellRule).toContain(
      "height: var(--cv-preview-shell-block-size);",
    );
    expect(workspacePanelRule).toContain("padding: 0;");
    expect(workspacePanelRule).toContain("gap: 0;");
    expect(workspacePanelRule).toContain("border: none;");
    expect(workspaceSurfaceRule).toContain(
      "block-size: var(--cv-preview-shell-block-size);",
    );
    expect(workspaceSurfaceRule).toContain("justify-content: flex-start;");
    expect(productCss).toContain(
      ".dasti-resume-workspace-stage .dasti-document-stage__canvas,\n.dasti-resume-workspace-stage .resume-preview-shell--single,\n.dasti-resume-workspace-stage .resume-preview-grid {\n  justify-items: start;",
    );
    expect(workspaceFrameRule).toContain("width: 100%;");
    expect(workspaceFrameRule).toContain("max-width: none;");
    expect(workspaceFrameRule).toContain("margin-inline: 0;");
    expect(workspaceFrameRule).toContain("height: auto;");
    expect(workspaceFrameRule).toContain("display: flex;");
    expect(workspaceFrameRule).toContain("padding-block-start: 0;");
    expect(workspaceFrameRule).not.toContain(
      "var(--cv-preview-toolbar-inset, 0px)",
    );
    expect(workspaceStagePaddingRule).toContain(
      "padding: var(--resume-preview-shell-padding, var(--space-1));",
    );
    expect(productCss).toContain(
      ".dasti-resume-workspace-stage\n  .dasti-document-stage__canvas[data-document-page=\"true\"] {\n  overflow: hidden;",
    );
    expect(productCss).toContain(
      ".dasti-doc-viewer-shell--resume-workspace .dasti-doc-viewport--resume {",
    );
  });

  it("keeps Robial heading/body selectors tied to the shared font vars", () => {
    expect(resumePreviewCss).toContain(
      '.name {\n  margin: 0;\n  font-family: var(--font-editorial-family);',
    );
    expect(resumePreviewCss).toContain(
      '.summary {\n  margin: 0;\n  max-width: var(--header-summary-width);\n  font-family: var(--font-body-family);',
    );
    expect(resumePreviewCss).toContain(
      '.entry-title {\n  margin: 0;\n  font-family: var(--font-heading-family);',
    );
    expect(resumePreviewCss).toContain(
      '.entry-subtitle {\n  margin: var(--experience-org-margin) 0 0;\n  font-family: var(--font-body-family);',
    );
    expect(resumePreviewCss).toContain(
      '.bullet-list li,\n.project-copy {\n  font-family: var(--font-body-family);',
    );
  });
});
