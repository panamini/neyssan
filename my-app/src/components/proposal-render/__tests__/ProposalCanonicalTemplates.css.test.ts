import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-proposal.css"),
  "utf8",
);
const canonicalCss = proposalCss.slice(
  proposalCss.indexOf("/* Canonical ATS cover letters"),
  proposalCss.indexOf(".dasti-proposal-document__salutation,"),
);

describe("canonical ATS cover-letter CSS", () => {
  it.each(["workshop-proposal-margin", "modernist-signal"])(
    "keeps %s styling scoped to the active template",
    (templateId) => {
      const scope = `.dasti-proposal-document--${templateId}`;

      expect(canonicalCss).toContain(
        `${scope}\n  .dasti-proposal-document__page::before`,
      );
      expect(canonicalCss).toContain(
        `${scope}\n  .dasti-proposal-document__sender-header`,
      );
      expect(canonicalCss).toContain(
        `${scope}\n  .dasti-proposal-document__structured-header`,
      );
    },
  );

  it("composes both templates from Workshop document tokens", () => {
    [
      "var(--proposal-inline-mm)",
      "var(--proposal-block-mm)",
      "var(--proposal-grid-half-step-inline)",
      "var(--proposal-grid-half-step-block)",
      "var(--proposal-document-reading-measure-max)",
      "var(--proposal-document-accent-ink)",
      "var(--proposal-document-ink)",
      "var(--font-body-family)",
    ].forEach((token) => expect(canonicalCss).toContain(token));

    expect(canonicalCss).not.toContain(
      ".dasti-proposal-document--workshop-proposal-margin {\n  font-family:",
    );
    expect(canonicalCss).not.toContain(
      ".dasti-proposal-document--modernist-signal {\n  font-family:",
    );
  });

  it("derives readable header type from the Workshop body-size token", () => {
    [
      "font-size: 1.42em",
      "font-size: 1.34em",
      "font-size: 0.92em",
      "font-size: 0.76em",
      "font-size: 0.94em",
    ].forEach((declaration) => expect(canonicalCss).toContain(declaration));
    expect(canonicalCss).not.toContain("font-size: 0.84em");
    expect(canonicalCss).not.toContain("font-size: 0.86em");
  });

  it("uses decoration-only pseudo elements so ATS text stays in DOM order", () => {
    expect(canonicalCss).toMatch(
      /\.dasti-proposal-document--workshop-proposal-margin[\s\S]*?\.dasti-proposal-document--modernist-signal[\s\S]*?\.dasti-proposal-document__page::after\s*\{[\s\S]*?content:\s*"";/,
    );
    expect(
      Array.from(canonicalCss.matchAll(/content:\s*([^;]+);/g), (match) =>
        match[1].trim(),
      ),
    ).toEqual(['""']);
  });

  it("gives the US and European correspondence traditions distinct hierarchy", () => {
    expect(canonicalCss).toMatch(
      /workshop-proposal-margin[\s\S]*?__structured-header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(canonicalCss).toMatch(
      /modernist-signal[\s\S]*?__header-stack\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.92fr\) minmax\(0, 1\.08fr\)/,
    );
    expect(canonicalCss).toMatch(
      /modernist-signal[\s\S]*?__structured-header\s*\{\s*display:\s*contents;/,
    );
    expect(canonicalCss).toMatch(
      /modernist-signal[\s\S]*?__structured-header-item--subject\s*\{[\s\S]*?grid-column:\s*1 \/ -1/,
    );
    expect(canonicalCss).toContain(
      ".dasti-proposal-document__structured-header-item--date",
    );
    expect(canonicalCss).toContain(
      ".dasti-proposal-document__structured-header-item--recipient",
    );
  });

  it("separates the French subject rule from the salutation with Workshop rhythm", () => {
    const frenchSubjectStart = canonicalCss.indexOf(
      ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__structured-header-item--subject",
    );
    const frenchSubjectEnd = canonicalCss.indexOf("}", frenchSubjectStart);
    const frenchSubjectRule = canonicalCss.slice(
      frenchSubjectStart,
      frenchSubjectEnd,
    );

    expect(frenchSubjectRule).toContain(
      "margin-block-end: calc(var(--proposal-grid-half-step-block) * 0.5)",
    );
  });

  it("keeps the French date in the left correspondence column", () => {
    const frenchDateStart = canonicalCss.indexOf(
      ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__structured-header-item--date",
    );
    const frenchDateEnd = canonicalCss.indexOf("}", frenchDateStart);
    const frenchDateRule = canonicalCss.slice(frenchDateStart, frenchDateEnd);
    const frenchSenderStart = canonicalCss.indexOf(
      ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__sender-header",
    );
    const frenchSenderRule = canonicalCss.slice(
      frenchSenderStart,
      canonicalCss.indexOf("}", frenchSenderStart),
    );
    const frenchRecipientStart = canonicalCss.indexOf(
      ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__structured-header-item--recipient",
    );
    const frenchRecipientRule = canonicalCss.slice(
      frenchRecipientStart,
      canonicalCss.indexOf("}", frenchRecipientStart),
    );

    expect(frenchSenderRule).toContain("grid-row: 1");
    expect(frenchSenderRule).not.toContain("span 2");
    expect(frenchDateRule).toContain("grid-column: 1");
    expect(frenchDateRule).toContain("grid-row: 2");
    expect(frenchDateRule).toContain("justify-items: start");
    expect(frenchDateRule).toContain("text-align: start");
    expect(frenchRecipientRule).toContain("grid-column: 2");
    expect(frenchRecipientRule).toContain("grid-row: 1 / span 2");
  });

  it("keeps the French closing in the linear ATS reading column", () => {
    const frenchClosing = canonicalCss.slice(
      canonicalCss.indexOf(
        ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__closing",
      ),
      canonicalCss.indexOf(
        ".dasti-proposal-document--workshop-proposal-margin\n  .dasti-proposal-document__signature",
      ),
    );

    expect(frenchClosing).toContain("justify-self: start");
    expect(frenchClosing).toContain("text-align: start");
    expect(frenchClosing).not.toContain("justify-self: end");
  });

  it("keeps the US closing in the linear ATS reading column", () => {
    const usClosing = canonicalCss.slice(
      canonicalCss.indexOf(
        ".dasti-proposal-document--workshop-proposal-margin\n  .dasti-proposal-document__closing",
      ),
      canonicalCss.indexOf(
        ".dasti-proposal-document--modernist-signal\n  .dasti-proposal-document__closing",
      ),
    );

    expect(usClosing).toContain("justify-self: start");
    expect(usClosing).toContain("padding-inline-start: 0");
    expect(usClosing).toContain("text-align: start");
    expect(usClosing).not.toContain("padding-inline-start: 50%");
  });

  it("uses a compact token-derived closing rhythm for both canonical letters", () => {
    ["workshop-proposal-margin", "modernist-signal"].forEach((templateId) => {
      const closingStart = canonicalCss.indexOf(
        `.dasti-proposal-document--${templateId}\n  .dasti-proposal-document__closing`,
      );
      const closingEnd = canonicalCss.indexOf("}", closingStart);
      const closingRule = canonicalCss.slice(closingStart, closingEnd);

      expect(closingRule).toContain(
        "gap: calc(0.25em * var(--proposal-document-computed-line-height))",
      );
      expect(closingRule).toContain(
        "padding-top: calc(0.85em * var(--proposal-document-computed-line-height))",
      );
    });
  });
});
