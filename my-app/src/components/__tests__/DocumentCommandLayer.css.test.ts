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
});
