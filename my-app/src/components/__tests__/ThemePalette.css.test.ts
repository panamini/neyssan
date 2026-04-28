import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const themesCssPath = resolve(process.cwd(), "src/styles/themes.css");
const themesCss = readFileSync(themesCssPath, "utf8");
const appPath = resolve(process.cwd(), "src/App.tsx");
const appSource = readFileSync(appPath, "utf8");
const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

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
});
