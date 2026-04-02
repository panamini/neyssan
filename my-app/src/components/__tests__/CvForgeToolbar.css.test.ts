import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPath = resolve(process.cwd(), "src/styles/product.css");
const productCss = readFileSync(productCssPath, "utf8");

describe("CvForge toolbar CSS contracts", () => {
  it("keeps the CV eye toggle in flow instead of sticking to the top edge", () => {
    expect(productCss).toMatch(
      /\.dasti-workbench-top-left-slot--cv\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*24;/,
    );
    expect(productCss).not.toMatch(
      /\.dasti-workbench-top-left-slot--cv\s*\{[\s\S]*position:\s*sticky;/,
    );
  });
});
