import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const themesCssPath = resolve(process.cwd(), "src/styles/themes.css");
const themesCss = readFileSync(themesCssPath, "utf8");
const foundationCssPath = resolve(process.cwd(), "src/styles/foundation.css");
const foundationCss = readFileSync(foundationCssPath, "utf8");
const appPath = resolve(process.cwd(), "src/App.tsx");
const appSource = readFileSync(appPath, "utf8");
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

describe("theme palette CSS contracts", () => {
  it("keeps dark palette tokens active when the palette class is inside the dark root", () => {
    for (const palette of [
      "terre",
      "sauge",
      "ocre",
      "pierre",
      "bordeaux",
      "encre",
    ]) {
      expect(themesCss).toContain(`.dark.pal-${palette},`);
      expect(themesCss).toContain(`.dark .pal-${palette} {`);
    }
  });

  it("uses the DS default terre palette instead of a legacy app-wide sage override", () => {
    expect(appSource).not.toContain('className="pal-sauge"');
  });

  it("keeps proposal document selection text on the document ink in light and dark shells", () => {
    expect(productCss).toMatch(
      /\.dasti-proposal-sheet__body--editable::selection,\s*\.dasti-proposal-document ::selection,\s*\.ProseMirror ::selection\s*\{[\s\S]*background:\s*var\(--selection-highlight-bg\);[\s\S]*color:\s*currentColor;/,
    );
    expect(productCss).not.toMatch(
      /\.dasti-proposal-sheet__body--editable::selection,[\s\S]*color:\s*var\(--selection-highlight-fg\);/,
    );
  });

  it("uses one full-circle custom accent gradient across palette surfaces", () => {
    expect(foundationCss).toMatch(
      /--custom-accent-gradient:\s*conic-gradient\(/,
    );
    for (const selector of [
      ".dasti-artifact-inspector__swatch--custom.dasti-artifact-inspector__swatch--icon",
      ".dasti-proposal-skeleton-rail__style-swatch--custom:not(",
      ".dasti-cv-style-swatch--custom",
      ".dasti-settings-swatch--custom.dasti-settings-swatch--icon",
      ".settings-ui-accent--custom:not([data-selected=\"true\"])",
      ".style-swatch--custom .style-swatch__chip",
    ]) {
      const selectorIndex = productCss.indexOf(selector);
      expect(selectorIndex).toBeGreaterThanOrEqual(0);
      const nextBlock = productCss.slice(selectorIndex, selectorIndex + 500);
      expect(nextBlock).toContain("background: var(--custom-accent-gradient);");
    }
    for (const selector of [
      ".dasti-artifact-inspector__swatch--custom.dasti-artifact-inspector__swatch--icon::before",
      ".dasti-proposal-skeleton-rail__style-swatch--custom:not(",
      ".dasti-cv-style-swatch--custom::before",
      ".dasti-settings-swatch--custom.dasti-settings-swatch--icon::before",
      ".settings-ui-accent--custom:not([data-selected=\"true\"])",
      ".style-swatch--custom .style-swatch__chip::before",
    ]) {
      const selectorIndex = productCss.indexOf(selector);
      expect(selectorIndex).toBeGreaterThanOrEqual(0);
      const nextBlock = productCss.slice(selectorIndex, selectorIndex + 500);
      expect(nextBlock).toContain("inset: -2px;");
      expect(nextBlock).toContain("background: var(--custom-accent-gradient);");
    }
  });
});
