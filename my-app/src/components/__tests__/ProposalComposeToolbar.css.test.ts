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

function getCssRuleBlock(selector: string): string {
  const start = productCss.indexOf(selector);
  if (start === -1) return "";
  const end = productCss.indexOf("}", start);
  return end === -1 ? "" : productCss.slice(start, end + 1);
}

describe("ProposalComposeToolbar CSS contracts", () => {
  it("keeps the tone group right-anchored even when the collapse control is absent", () => {
    expect(productCss).toContain(
      ".dasti-compose-toolbar--no-collapse-anchor .dasti-compose-toolbar__group--tone",
    );
    expect(productCss).toContain("margin-inline-start: auto;");
  });

  it("keeps save status in the trailing action group with tokenized spacing", () => {
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__group--actions\s*\{[\s\S]*margin-inline-start:\s*auto;[\s\S]*gap:\s*var\(--proposal-chrome-tight-gap\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__context-slot--save\s*\{[\s\S]*flex:\s*0 0 auto;/,
    );
  });

  it("keeps selected tone icons in a neutral pressed state across proposal toolbars", () => {
    const activeToneRule = getCssRuleBlock(
      ".dasti-compose-toolbar__tone-option--active",
    );

    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__tone-option--active,\s*[\s\S]*\.dasti-saved-proposal-forge-toolbar-preview\s+\.dasti-compose-toolbar__tone-option--active\s*\{[\s\S]*background:\s*var\(--proposal-chrome-control-hover-bg\);[\s\S]*box-shadow:\s*inset 0 1px 2px/,
    );
    expect(activeToneRule).not.toContain("background: var(--ac)");
  });

  it("constrains the toolbar slot and bar to the compose shell width", () => {
    expect(productCss).toContain(".dasti-forge-compose-toolbar-slot");
    expect(productCss).toContain("width: 100%;");
    expect(productCss).toContain("justify-content: flex-start;");
    expect(productCss).toContain(".dasti-compose-toolbar__bar");
    expect(productCss).toContain(
      ".dasti-forge-compose-toolbar-slot .dasti-compose-toolbar",
    );
    expect(productCss).toContain("max-inline-size: 100%;");
    expect(productCss).toContain("max-width: 100%;");
  });

  it("uses the same outer shell height for collapsed and expanded states", () => {
    expect(productCss).toContain(
      "--dasti-compose-toolbar-shell-min-block-size",
    );
    expect(productCss).toContain(
      "min-block-size: var(--dasti-compose-toolbar-shell-min-block-size);",
    );
    expect(productCss).toContain(
      "--dasti-compose-toolbar-control-block-size: var(--control-sm);",
    );
  });

  it("keeps the collapsed toolbar as a compact icon cluster sized to its own controls", () => {
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__collapsed-shell\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*justify-content:\s*flex-start;[\s\S]*width:\s*max-content;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__collapsed-actions\s*\{[\s\S]*justify-content:\s*flex-start;[\s\S]*margin-inline-start:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-forge-compose-toolbar-slot\s+\.dasti-compose-toolbar--collapsed,[\s\S]*\.dasti-forge-compose-toolbar-slot[\s\S]*\.dasti-compose-toolbar__collapsed-shell\s*\{[\s\S]*width:\s*max-content;[\s\S]*max-width:\s*100%;/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__tone-popover--collapsed\s*\{[\s\S]*inset-inline-start:\s*50%;[\s\S]*inset-inline-end:\s*auto;[\s\S]*transform:\s*translateX\(-50%\);[\s\S]*transform-origin:\s*center top;/,
    );
    expect(productCss).not.toContain(
      "--dasti-proposal-submit-stroke-width: var(--proposal-submit-stroke-width-sm);",
    );
  });

  it("keeps the proposal workspace toolbar stack above the compose shell without blocking output controls", () => {
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--proposal\s*\{[\s\S]*position:\s*sticky;[\s\S]*inset-block-start:\s*var\(--space-2\);[\s\S]*pointer-events:\s*none;[\s\S]*z-index:\s*26;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--proposal\s*>\s*\*\s*\{[\s\S]*pointer-events:\s*auto;/,
    );
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*1439px\)\s*\{[\s\S]*\.dasti-workbench-top-left-slot--proposal\s*\{[\s\S]*position:\s*static;[\s\S]*inset-block-start:\s*auto;[\s\S]*z-index:\s*1;/,
    );
  });
});
