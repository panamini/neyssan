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
});
