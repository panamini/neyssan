import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("resume preview interaction token contract", () => {
  it("uses only the dedicated --resume-preview-interaction-* variables for interactive preview styling", () => {
    const cssPath = path.resolve(
      __dirname,
      "../../../styles/product-proposal.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");
    const previewInteractionStart = css.indexOf(
      ".dasti-document-stage__canvas[data-interactive=\"true\"] [data-preview-section]",
    );
    const previewInteractionEnd = css.indexOf(
      ".dasti-proposal-editor-page__drawer-card.ds-card",
    );
    const previewInteractionSlice = css.slice(
      previewInteractionStart,
      previewInteractionEnd,
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
