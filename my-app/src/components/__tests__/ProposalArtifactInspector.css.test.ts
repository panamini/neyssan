import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalArtifactInspector CSS contracts", () => {
  it("keeps the header color drawer aligned to the custom picker width and right edge", () => {
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector--header\s+\.dasti-artifact-inspector__style-drawer,\s*\.dasti-artifact-inspector--header\s+\.dasti-artifact-inspector__palette-drawer\s*\{[\s\S]*width:\s*min\(160px,\s*calc\(100vw - 24px\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector__palette-drawer\s+\.dasti-artifact-inspector__palette,\s*\.dasti-resume-style-inspector__drawer--palette\s+\.dasti-artifact-inspector__palette\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-content:\s*flex-end;[\s\S]*gap:\s*6px;/,
    );
  });
});
