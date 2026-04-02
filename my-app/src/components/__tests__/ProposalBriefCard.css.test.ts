import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalBriefCard CSS contracts", () => {
  it("defines a compact workbench capsule aligned with the detached compose toolbar column", () => {
    expect(productCss).toContain(".dasti-proposal-workbench-left-stack {");
    expect(productCss).toContain("justify-items: stretch;");
    expect(productCss).toContain(".dasti-brief-card--compact {");
    expect(productCss).toContain("border-radius: var(--document-viewer-radius);");
    expect(productCss).toContain("var(--document-viewer-frame-border)");
    expect(productCss).toContain("background: var(--document-viewer-frame-surface);");
    expect(productCss).toContain("box-shadow: var(--document-viewer-frame-shadow);");
    expect(productCss).toContain(".dasti-proposal-sheet__header--brief-compact {");
    expect(productCss).toContain(".dasti-brief-card--compact .dasti-brief-card__summary {");
  });
});
