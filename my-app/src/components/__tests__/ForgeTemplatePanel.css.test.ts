import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCss = readFileSync(
  resolve(process.cwd(), "src/styles/product.css"),
  "utf8",
);

function getCssRuleBlock(selector: string): string {
  const start = productCss.indexOf(selector);
  if (start === -1) return "";
  const end = productCss.indexOf("}", start);
  return end === -1 ? "" : productCss.slice(start, end + 1);
}

describe("ForgeTemplatePanel CSS", () => {
  it("allows the proposal heading drawer content to scroll", () => {
    expect(getCssRuleBlock(".forge-template-panel__content")).toContain(
      "overflow: hidden",
    );

    const headingContentRule = getCssRuleBlock(
      ".forge-template-panel--proposal-heading .forge-template-panel__content",
    );

    expect(headingContentRule).toContain("overflow: auto");
    expect(headingContentRule).toContain("overscroll-behavior: contain");
    expect(headingContentRule).toContain("-webkit-overflow-scrolling: touch");
  });
});
