import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("JobsPage CSS contracts", () => {
  it("anchors the resume picker drawer to the resume control with the shared surface gap token", () => {
    expect(productCss).toMatch(
      /\.dasti-jobs-command-bar__resume-picker\s*\{[\s\S]*inline-size:\s*min\(100%,\s*var\(--card-rail-xs\)\);[\s\S]*justify-self:\s*start;/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__resume-picker\s*\{[\s\S]*--toolbar-attached-surface-gap:\s*var\(--anchored-surface-gap,\s*2px\);[\s\S]*--dasti-toolbar-attached-surface-offset:\s*var\(--toolbar-attached-surface-gap\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-jobs-detail__resume-popover\s*\{[\s\S]*inset-inline-start:\s*0;[\s\S]*inset-inline-end:\s*auto;/,
    );
  });
});
