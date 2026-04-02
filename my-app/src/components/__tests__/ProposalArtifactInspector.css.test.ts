import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalArtifactInspector CSS contracts", () => {
  it("keeps the saved-view header controls spaced with the regular chrome gap token", () => {
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector--header\.dasti-artifact-inspector--collapsed,\s*\.dasti-artifact-inspector--header\.dasti-artifact-inspector--expanded\s*\{[\s\S]*gap:\s*var\(--proposal-chrome-group-gap\);/,
    );
  });

  it("keeps the header color drawer aligned to the custom picker width and right edge", () => {
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector--header\s+\.dasti-artifact-inspector__palette-drawer\s*\{[\s\S]*width:\s*min\(160px,\s*calc\(100vw - 24px\)\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector--header\s+\.dasti-artifact-inspector__group--color\s*\{[\s\S]*position:\s*relative;/,
    );
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector--header[\s\S]*?\.dasti-artifact-inspector__group--color[\s\S]*?\.dasti-artifact-inspector__palette-drawer[\s\S]*?inset-inline-start:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-artifact-inspector__palette-drawer\s+\.dasti-artifact-inspector__palette,\s*\.dasti-resume-style-inspector__drawer--palette\s+\.dasti-artifact-inspector__palette\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-content:\s*flex-end;[\s\S]*gap:\s*6px;/,
    );
  });

  it("uses the shared toolbar tooltip pipeline for saved-view inspector buttons", () => {
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__bar \[data-toolbar-tooltip\],[\s\S]*\.dasti-artifact-inspector \[data-toolbar-tooltip\],[\s\S]*\.dasti-proposal-rail-cluster \[data-toolbar-tooltip\]/,
    );
  });
});
