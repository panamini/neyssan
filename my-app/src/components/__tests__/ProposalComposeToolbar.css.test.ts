import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProposalComposeToolbar CSS contracts", () => {
  it("keeps the tone group right-anchored even when the collapse control is absent", () => {
    expect(productCss).toContain(
      ".dasti-compose-toolbar--no-collapse-anchor .dasti-compose-toolbar__group--tone",
    );
    expect(productCss).toContain("margin-inline-start: auto;");
  });

  it("constrains the toolbar slot and bar to the compose shell width", () => {
    expect(productCss).toContain(".dasti-forge-compose-toolbar-slot");
    expect(productCss).toContain("width: 100%;");
    expect(productCss).toContain("justify-content: flex-start;");
    expect(productCss).toContain(".dasti-compose-toolbar__bar");
    expect(productCss).toContain(".dasti-forge-compose-toolbar-slot .dasti-compose-toolbar");
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
      "--dasti-compose-toolbar-control-block-size: 30px;",
    );
  });

  it("keeps the collapsed toolbar as a compact left-anchored shell", () => {
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__collapsed-shell\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*justify-content:\s*flex-start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__collapsed-meta\s*\{[\s\S]*min-width:\s*0;/,
    );
    expect(productCss).toMatch(
      /\.dasti-compose-toolbar__tone-popover--collapsed\s*\{[\s\S]*inset-inline-start:\s*auto;[\s\S]*inset-inline-end:\s*0;[\s\S]*transform:\s*none;[\s\S]*transform-origin:\s*right top;/,
    );
  });

  it("keeps the proposal workspace toolbar stack above the compose shell without blocking output controls", () => {
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--proposal\s*\{[\s\S]*position:\s*relative;[\s\S]*pointer-events:\s*none;[\s\S]*z-index:\s*26;/,
    );
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--proposal\s*>\s*\*\s*\{[\s\S]*pointer-events:\s*auto;/,
    );
  });
});
