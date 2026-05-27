import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-proposal.css"),
  "utf8",
);

describe("proposal letterhead CSS", () => {
  it("keeps the letterhead templates scoped with stable A4 document geometry", () => {
    [
      ".proposal-cover-letter--director",
      ".proposal-cover-letter--volk",
      ".proposal-cover-letter--film-foto",
    ].forEach((scope) => {
      expect(proposalCss).toContain(`${scope} .dasti-proposal-document__page`);
      expect(proposalCss).toContain(`${scope} .proposal-cover-letter__body`);
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.dasti-proposal-document__page,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.dasti-proposal-document__page\s*\{[\s\S]*width:\s*210mm;[\s\S]*min-height:\s*297mm;[\s\S]*height:\s*297mm;/,
    );
    expect(proposalCss).not.toContain("director-letterhead html");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--director");
  });

  it("keeps letterhead display roles on heading fonts and metadata roles on body fonts", () => {
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__masthead-primary,[\s\S]*?\.proposal-cover-letter--director\s+\.proposal-cover-letter__subject-value\s*\{[\s\S]*font-family:\s*var\(--heading-font,\s*var\(--font-heading-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--volk\s+\.proposal-cover-letter__volk-title,[\s\S]*?\.proposal-cover-letter--volk\s+\.proposal-cover-letter__subject-value\s*\{[\s\S]*font-family:\s*var\(--heading-font,\s*var\(--font-heading-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__subject-value\s*\{[\s\S]*font-family:\s*var\(--heading-font,\s*var\(--font-heading-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__sender-label,[\s\S]*?\.proposal-cover-letter--director\s+\.proposal-cover-letter__meta-item\s*\{[\s\S]*font-family:\s*var\(--body-font,\s*var\(--font-body-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--volk\s+\.proposal-cover-letter__volk-sender,[\s\S]*?\.proposal-cover-letter--volk\s+\.proposal-cover-letter__meta-item\s*\{[\s\S]*font-family:\s*var\(--body-font,\s*var\(--font-body-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__info-blocks p,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__meta-item\s*\{[\s\S]*font-family:\s*var\(--body-font,\s*var\(--font-body-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--(?:director|volk|film-foto)[^{]+(?:masthead-primary|volk-title|film-title)[^{]*\{[^}]*font-family:\s*var\(--font-body-family\)/,
    );
  });

  it("caps cover letter body measure to the 50-70 character reading range", () => {
    [
      ".proposal-cover-letter--director",
      ".proposal-cover-letter--volk",
      ".proposal-cover-letter--film-foto",
    ].forEach((scope) => {
      expect(proposalCss).toMatch(
        new RegExp(
          `${scope.replace(".", "\\.")}\\s+\\.proposal-cover-letter__body\\s*\\{[\\s\\S]*width:\\s*min\\(112mm,\\s*66ch\\);`,
        ),
      );
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__body,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__body\s*\{[\s\S]*max-width:\s*min\(112mm,\s*66ch\);[\s\S]*\}/,
    );
    expect(proposalCss).toContain("overflow-wrap: break-word;");
    expect(proposalCss).not.toContain("width: 158mm;");
    expect(proposalCss).not.toContain("width: 160mm;");
    expect(proposalCss).not.toContain("width: 168mm;");
  });

  it("truncates optional top title slots without ellipsizing the role", () => {
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__masthead-primary,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-company\s*\{[\s\S]*white-space:\s*nowrap;[\s\S]*text-overflow:\s*ellipsis;[\s\S]*\}/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title\s*\{[^}]*text-overflow:\s*ellipsis;/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__masthead-role\s*\{[^}]*text-overflow:\s*ellipsis;/,
    );
  });

  it("keeps Film und Foto role and phone fields from arbitrary wrapping", () => {
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto[\s\S]*?\.proposal-cover-letter__film-header--role-priority\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*70mm\)\s+minmax\(0,\s*1fr\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title\s*\{[\s\S]*overflow-wrap:\s*normal;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto[\s\S]*?\.proposal-cover-letter__info-block--phone[\s\S]*?\{[\s\S]*overflow-wrap:\s*normal;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
    );
  });
});
