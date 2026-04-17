import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("resume preview interaction token contract", () => {
  it("uses only the dedicated --resume-preview-interaction-* variables for interactive preview styling", () => {
    const cssPath = path.resolve(
      __dirname,
      "../../../styles/product.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");
    const previewInteractionSlice = css.slice(
      css.indexOf(
        ".dasti-document-stage__canvas[data-interactive=\"true\"] [data-preview-section]",
      ),
      css.indexOf("@keyframes dasti-section-focus-pulse"),
    );

    expect(previewInteractionSlice).toContain(
      "--resume-preview-interaction-ring",
    );
    expect(previewInteractionSlice).toContain(
      "--resume-preview-interaction-fill",
    );
    expect(previewInteractionSlice).toContain(
      "--resume-preview-interaction-shadow",
    );
    expect(previewInteractionSlice).not.toContain("--color-accent");
    expect(previewInteractionSlice).not.toContain("var(--accent");
  });
});
