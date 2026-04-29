import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundationCss = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);
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

describe("CV editor reading measure", () => {
  it("defines the CV reading measure token at 70ch", () => {
    expect(foundationCss).toContain("--cv-editor-reading-measure-max: 70ch;");
  });

  it("applies the reading measure to preview and modal/editor text lanes", () => {
    expect(productCss).toContain(".cv-preview-stack {");
    expect(productCss).toContain(".cv-entry-summary__main {");
    expect(productCss).toContain(".cv-reading-measure {");
    expect(productCss).toContain(".dasti-rich--cv-reading-measure .ProseMirror,");
    expect(productCss).toContain(".rich-content--cv-reading-measure .ProseMirror {");
    expect(productCss).toContain(
      "max-inline-size: min(100%, var(--cv-editor-reading-measure-max));",
    );
  });
});
