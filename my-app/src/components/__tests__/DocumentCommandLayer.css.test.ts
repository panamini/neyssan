import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productProposalCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-proposal.css"),
  "utf8",
);
const productCvCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-cv.css"),
  "utf8",
);

function getCssRuleBlock(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector} {`);
  if (start === -1) return "";
  const end = source.indexOf("}", start);
  return end === -1 ? "" : source.slice(start, end + 1);
}

function getCssSlice(source: string, startSelector: string, endSelector: string): string {
  const start = source.indexOf(`\n${startSelector} {`);
  const end = source.indexOf(`\n${endSelector} {`, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe("Document command layer CSS", () => {
  it("reserves the same top gutter above the first page in Proposal and CV", () => {
    const proposalStage = getCssRuleBlock(
      productProposalCss,
      ".dasti-proposal-skeleton-stage",
    );
    const cvStage = getCssRuleBlock(
      productCvCss,
      ".dasti-cv-skeleton-forge__stage",
    );

    for (const stageRule of [proposalStage, cvStage]) {
      expect(stageRule).toContain("--document-command-layer-rest-gutter");
      expect(stageRule).toContain("var(--space-4)");
      expect(stageRule).toContain("var(--space-2)");
      expect(stageRule).toContain(
        "padding-block-start: var(--document-command-layer-rest-gutter);",
      );
    }
  });

  it("keeps the generated Job & CV source action icon-only in the proposal toolbar", () => {
    expect(productProposalCss).toMatch(
      /\.dasti-proposal-skeleton-stage__primary-action--draft\[data-source-context="true"\]\s*\{[\s\S]*width:\s*var\(--editor-toolbar-icon-control-block-size\);[\s\S]*padding-inline:\s*0;[\s\S]*border-radius:\s*var\(--radius-toolbar-control,\s*var\(--radius-control\)\);/,
    );
    expect(productProposalCss).toMatch(
      /\.dasti-proposal-skeleton-stage__primary-action--draft\[data-source-context="true"\][\s\S]*\.dasti-proposal-skeleton-stage__action-label\s*\{[\s\S]*display:\s*none;/,
    );
  });

  it("keeps CV and Proposal image-control chrome off document paper surfaces", () => {
    const cvImageControls = getCssSlice(
      productCvCss,
      ".dasti-cv-design-image",
      ".dasti-cv-rail-secondary-action",
    );
    const proposalImageControls = getCssSlice(
      productProposalCss,
      ".dasti-proposal-design-image",
      ".dasti-proposal-design-fields__decorations",
    );

    expect(cvImageControls).toMatch(
      /--cv-design-image-control-surface:\s*var\(--sf2\);/,
    );
    expect(cvImageControls).toMatch(
      /--cv-design-image-control-track:\s*var\(--sf2\);/,
    );
    expect(cvImageControls).toMatch(
      /--cv-design-image-control-selected:\s*var\(--sf1\);/,
    );
    expect(proposalImageControls).toMatch(
      /--proposal-design-image-control-surface:\s*var\(--sf2\);/,
    );
    expect(proposalImageControls).toMatch(
      /--proposal-design-image-control-track:\s*var\(--sf2\);/,
    );
    expect(proposalImageControls).toMatch(
      /--proposal-design-image-control-selected:\s*var\(--sf1\);/,
    );
    expect(cvImageControls).not.toMatch(/background:\s*var\(--paper\)/);
    expect(proposalImageControls).not.toMatch(/background:\s*var\(--paper\)/);
  });
});
