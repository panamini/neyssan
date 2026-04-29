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

describe("shared chrome drawer CSS contracts", () => {
  it("keeps legacy drawer surfaces on the same chrome surface tokens", () => {
    expect(productCss).toMatch(
      /\.dasti-toolbar-drawer-surface\s*\{[\s\S]*border:\s*1px solid var\(--proposal-chrome-toolbar-border\);[\s\S]*background:\s*var\(--proposal-chrome-toolbar-bg\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-floating-menu\s*\{[\s\S]*gap:\s*var\(--proposal-chrome-tight-gap\);[\s\S]*border:\s*1px solid var\(--proposal-chrome-toolbar-border\);[\s\S]*background:\s*var\(--proposal-chrome-toolbar-bg\);/,
    );
  });

  it("uses the same option border, hover, and active states in CV and proposal drawers", () => {
    expect(productCss).toMatch(
      /\.dasti-cv-style-presets__option\s*\{[\s\S]*border:\s*1px solid var\(--proposal-chrome-control-border\);[\s\S]*background:\s*var\(--proposal-chrome-control-bg\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-cv-style-presets__option\[aria-checked="true"\]\s*\{[\s\S]*background:\s*var\(--proposal-chrome-control-active-bg\);[\s\S]*border-color:\s*var\(--proposal-chrome-control-active-border\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-resume-style-inspector__layout-option--active\s*\{[\s\S]*background:\s*var\(--proposal-chrome-control-active-bg\);[\s\S]*border-color:\s*var\(--proposal-chrome-control-active-border\);/,
    );
  });
});
