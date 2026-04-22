import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("ProfileReviewCard organize sections CSS contracts", () => {
  it("keeps organize rows on the shared section-header size contract", () => {
    expect(productCss).toMatch(
      /\.section-container-header\s*\{[\s\S]*min-block-size:\s*var\(--section-header-block-size\);[\s\S]*padding:\s*var\(--space-4\);/,
    );
    expect(productCss).toMatch(
      /\.cv-organize-section-row\s*\{[\s\S]*min-block-size:\s*var\(--section-header-block-size\);/,
    );
  });

  it("keeps the active drag row inline with top-layer stacking instead of a detached overlay card", () => {
    expect(productCss).toMatch(
      /\.cv-organize-section-item\s*\{[\s\S]*overflow:\s*visible;[\s\S]*isolation:\s*isolate;/,
    );
    expect(productCss).toMatch(
      /\.cv-organize-section-item\[data-section-dragging="true"\]\s*\{[\s\S]*z-index:\s*6;/,
    );
    expect(productCss).toMatch(
      /\.cv-organize-section-row\[data-section-dragging="true"\]\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 1px var\(--color-border-strong\);[\s\S]*z-index:\s*2;/,
    );
  });

  it("treats hidden rows as ghosted headers instead of painting a gray surface block", () => {
    expect(productCss).toMatch(
      /\.cv-organize-section-row\[data-section-hidden="true"\]\s*\{[\s\S]*opacity:\s*0\.72;/,
    );
    expect(productCss).toMatch(
      /\.cv-organize-section-row__pill--hidden\s*\{[\s\S]*color:\s*var\(--text-ghost\);/,
    );
  });
});
