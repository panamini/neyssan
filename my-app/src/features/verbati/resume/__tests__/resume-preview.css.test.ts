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
    expect(resumePreviewCss).toMatch(/place-items:\s*start;/);
    expect(productCss).not.toContain("dasti-doc-viewer-shell--resume-workspace-page");
    expect(productCss).not.toContain(
      "dasti-resume-preview-panel__surface--workspace-page",
    );
    const workspaceStageOverride = productCss.match(
      /\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-doc-viewport--resume\[data-document-stage="true"\]\[data-stage-mode="fit"\],\s*\.dasti-doc-viewer-shell--resume-workspace\s+\.dasti-doc-viewport--resume\[data-document-stage="true"\]\[data-stage-mode="overflow"\]\s*\{[^}]*\}/,
    )?.[0];

    expect(workspaceStageOverride).toContain(
      "scrollbar-gutter: stable both-edges;",
    );
    expect(workspaceStageOverride).not.toContain("overflow: visible;");
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
});
