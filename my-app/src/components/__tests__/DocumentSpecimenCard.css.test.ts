import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productLibrariesCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-libraries.css"),
  "utf8",
);

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = productLibrariesCss.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  expect(match, `${selector} block should exist`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("DocumentSpecimenCard CSS contract", () => {
  it("uses one shared footer spacing token for Today and Projects specimen cards", () => {
    const sharedCard = cssBlock(".document-specimen-card.ds-card");
    const caption = cssBlock(".document-specimen-card__caption");
    const todayPrimary = cssBlock(
      '.today-preview-card.document-specimen-card[data-variant="primary"]',
    );
    const todaySecondary = cssBlock(
      `.today-preview-card.document-specimen-card[data-variant="secondary"],
.today-preview-card.document-specimen-card[data-variant="compact"]`,
    );
    const projectsCard = cssBlock(".projects-card.document-specimen-card");
    const specimenMenu = cssBlock(
      `.document-specimen-card
  .document-specimen-card__actions
  .dasti-documents-card__menu`,
    );

    expect(sharedCard).toContain("--specimen-caption-gap: var(--space-1);");
    expect(sharedCard).toContain(
      "--specimen-stage-bg: color-mix(in srgb, var(--sf2) 82%, var(--sf1));",
    );
    expect(sharedCard).toContain(
      "--specimen-mount-bg: color-mix(in srgb, var(--sf1) 76%, var(--bg));",
    );
    expect(sharedCard).toContain("--specimen-title-gap: var(--specimen-caption-gap);");
    expect(sharedCard).toContain("--specimen-rule-gap: var(--specimen-caption-gap);");
    expect(sharedCard).toContain("gap: var(--specimen-title-gap);");

    expect(caption).toContain("margin-block-start: 0;");
    expect(caption).toContain("padding-inline: 0 calc(var(--control-xs) + var(--space-1));");
    expect(caption).toContain("padding-block-end: var(--specimen-rule-gap);");
    expect(caption).toContain("position: relative;");

    for (const pageOverride of [todayPrimary, todaySecondary, projectsCard]) {
      expect(pageOverride).not.toMatch(/--specimen-title-gap\s*:/);
      expect(pageOverride).not.toMatch(/--specimen-rule-gap\s*:/);
      expect(pageOverride).not.toMatch(/gap:\s*var\(--specimen-title-gap\)/);
    }

    expect(specimenMenu).toContain("inline-size: var(--control-xs);");
    expect(specimenMenu).toContain("block-size: var(--control-xs);");
    expect(specimenMenu).toContain("min-inline-size: var(--control-xs);");

    const actions = cssBlock(".document-specimen-card__actions");
    expect(actions).toContain("position: absolute;");
    expect(actions).toContain("inset-inline-end: 0;");

    const previewStage = cssBlock(".document-specimen-card__preview-stage");
    expect(previewStage).toContain("background: var(--specimen-stage-bg);");
  });

  it("keeps the Today Continue hero card centered above the two secondary cards", () => {
    const board = cssBlock(".today-preview-board");
    const primary = cssBlock(
      '.today-preview-card.document-specimen-card[data-variant="primary"]',
    );

    expect(board).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(board).toContain("justify-items: center;");
    expect(board).toContain("align-items: start;");
    expect(primary).not.toMatch(/--specimen-stage-bg\s*:/);
  });
});
