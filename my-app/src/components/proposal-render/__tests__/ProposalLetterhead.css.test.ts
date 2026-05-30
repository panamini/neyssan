import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-proposal.css"),
  "utf8",
);
const exportRendererSource = readFileSync(
  resolve(process.cwd(), "src/lib/export-renderers.ts"),
  "utf8",
);

describe("proposal letterhead CSS", () => {
  it("keeps the letterhead templates scoped with stable A4 document geometry", () => {
    [
      ".proposal-cover-letter--director",
      ".proposal-cover-letter--volk",
      ".proposal-cover-letter--film-foto",
      ".proposal-cover-letter--moma-bauhaus",
    ].forEach((scope) => {
      expect(proposalCss).toContain(`${scope} .dasti-proposal-document__page`);
      expect(proposalCss).toContain(`${scope} .proposal-cover-letter__body`);
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.dasti-proposal-document__page,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.dasti-proposal-document__page\s*\{[\s\S]*width:\s*210mm;[\s\S]*min-height:\s*297mm;[\s\S]*height:\s*297mm;/,
    );
    expect(proposalCss).not.toContain("director-letterhead html");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--director");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--moma-bauhaus");
    expect(proposalCss).not.toContain("moma-bauhaus-letterhead html");
    expect(proposalCss).not.toContain("Vorbereitungssekretariat");
    expect(proposalCss).not.toContain("Institut für Auslandsbeziehungen");
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
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-header,[\s\S]*?\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-subtitle\s*\{[\s\S]*font-family:\s*var\(--heading-font,\s*var\(--font-heading-family\)\);[\s\S]*\}/,
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
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-sender,[\s\S]*?\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-footer\s*\{[\s\S]*font-family:\s*var\(--body-font,\s*var\(--font-body-family\)\);[\s\S]*\}/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--(?:director|volk|film-foto)[^{]+(?:masthead-primary|volk-title|film-title)[^{]*\{[^}]*font-family:\s*var\(--font-body-family\)/,
    );
  });

  it("caps cover letter body measure to the 50-70 character reading range", () => {
    [
      [".proposal-cover-letter--director", "25mm"],
      [".proposal-cover-letter--volk", "24mm"],
      [".proposal-cover-letter--film-foto", "20mm"],
      [".proposal-cover-letter--moma-bauhaus", "32mm"],
    ].forEach(([scope, left]) => {
      expect(proposalCss).toMatch(
        new RegExp(
          `${scope.replace(".", "\\.")}\\s+\\.proposal-cover-letter__body\\s*\\{[\\s\\S]*left:\\s*${left};[\\s\\S]*width:\\s*min\\((?:96|112)mm,\\s*(?:58|62)ch\\);`,
        ),
      );
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__body,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__body\s*\{[\s\S]*max-width:\s*min\(96mm,\s*58ch\);[\s\S]*\}/,
    );
    expect(proposalCss).toContain("overflow-wrap: break-word;");
    expect(proposalCss).not.toContain("width: 158mm;");
    expect(proposalCss).not.toContain("width: 160mm;");
    expect(proposalCss).not.toContain("width: 168mm;");
  });

  it("truncates optional top title slots without ellipsizing the role", () => {
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__masthead-primary,[\s\S]*?\.proposal-cover-letter--volk\s+\.proposal-cover-letter__volk-title\s*\{[\s\S]*white-space:\s*nowrap;[\s\S]*text-overflow:\s*ellipsis;[\s\S]*\}/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title\s*\{[^}]*text-overflow:\s*ellipsis;/,
    );
    expect(proposalCss).not.toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__masthead-role\s*\{[^}]*text-overflow:\s*ellipsis;/,
    );
  });

  it("keeps Film und Foto role and phone fields from arbitrary wrapping", () => {
    expect(proposalCss).not.toContain(
      ".proposal-cover-letter__film-header--role-priority",
    );
    expect(proposalCss).toContain(
      ".proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-frame",
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-header\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*105mm\)\s*minmax\(0,\s*1fr\);[\s\S]*align-items:\s*end;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-heading\s*\{[\s\S]*font-weight:\s*500;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title\s*\{[\s\S]*font-weight:\s*800;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-title\s*\{[\s\S]*overflow-wrap:\s*normal;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto[\s\S]*?\.proposal-cover-letter__info-block--phone[\s\S]*?\{[\s\S]*overflow-wrap:\s*normal;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-lines p\s*\{[\s\S]*overflow:\s*visible;[\s\S]*text-overflow:\s*clip;[\s\S]*\}/,
    );
  });

  it("keeps MoMA Bauhaus recipient routing in the top-left block and moves letter flow inside the frame", () => {
    const momaCss = proposalCss.slice(
      proposalCss.indexOf(
        ".proposal-cover-letter--moma-bauhaus .dasti-proposal-document__page",
      ),
      proposalCss.indexOf(".dasti-proposal-document--volk-register"),
    );
    const exportMomaCss = exportRendererSource.slice(
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--moma-bauhaus.export-page",
      ),
      exportRendererSource.indexOf("const LATIN_EXPORT_FALLBACK_LOCALES"),
    );

    expect(momaCss).not.toMatch(/\d+\.\d+mm/);
    expect(exportMomaCss).not.toMatch(/\d+\.\d+mm/);
    [
      "left: 32mm;",
      "top: 11mm;",
      "bottom: auto;",
      "top: 42mm;",
      "font-size: 19mm;",
      "top: 18mm;",
      "line-height: 4mm;",
      "left: 5mm;",
      "top: 94mm;",
      "width: 197mm;",
      "height: 196mm;",
      "top: 121mm;",
      "top: 136mm;",
      "top: 284mm;",
      "left: 102mm;",
    ].forEach((declaration) => {
      expect(momaCss).toContain(declaration);
      expect(exportMomaCss).toContain(declaration);
    });
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-frame\s*\{[\s\S]*left:\s*5mm;[\s\S]*top:\s*94mm;[\s\S]*width:\s*197mm;[\s\S]*height:\s*196mm;[\s\S]*border:\s*1mm solid var\(--proposal-document-accent-ink\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-sender\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*11mm;[\s\S]*bottom:\s*auto;[\s\S]*width:\s*58mm;[\s\S]*gap:\s*0;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-header\s*\{[\s\S]*left:\s*102mm;[\s\S]*top:\s*10mm;[\s\S]*right:\s*8mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-logo\s*\{[\s\S]*font-size:\s*19mm;[\s\S]*overflow:\s*visible;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
    );
    expect(
      momaCss.slice(
        momaCss.indexOf(".proposal-cover-letter__bauhaus-logo"),
        momaCss.indexOf(".proposal-cover-letter__bauhaus-subtitle"),
      ),
    ).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(
      exportMomaCss.slice(
        exportMomaCss.indexOf(".proposal-cover-letter__bauhaus-logo"),
        exportMomaCss.indexOf(".proposal-cover-letter__bauhaus-subtitle"),
      ),
    ).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-subtitle\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*1mm;[\s\S]*top:\s*18mm;[\s\S]*font-size:\s*2mm;[\s\S]*line-height:\s*1\.28;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-recipient\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*42mm;[\s\S]*width:\s*58mm;[\s\S]*gap:\s*0;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-sender p,[\s\S]*?\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-recipient p\s*\{[\s\S]*line-height:\s*4mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*121mm;[\s\S]*right:\s*18mm;[\s\S]*gap:\s*1mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta-item\s*\{[\s\S]*font-size:\s*3mm;[\s\S]*line-height:\s*1\.48;[\s\S]*font-weight:\s*400;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta-item--subject\s*\{[\s\S]*font-weight:\s*800;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*136mm;[\s\S]*width:\s*min\(112mm,\s*62ch\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-footer\s*\{[\s\S]*top:\s*284mm;[\s\S]*\}/,
    );
  });

  it("places recipient overflow details in scoped blocks and shifts the letter flow only when present", () => {
    [
      ".proposal-cover-letter--director",
      ".proposal-cover-letter--volk",
      ".proposal-cover-letter--film-foto",
    ].forEach((scope) => {
      expect(proposalCss).toContain(
        `${scope} .proposal-cover-letter__recipient-block`,
      );
      expect(proposalCss).toContain(
        `${scope}.proposal-cover-letter--has-recipient-block`,
      );
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\.proposal-cover-letter--has-recipient-block[\s\S]*?\.proposal-cover-letter__subject-row\s*\{[\s\S]*top:\s*111mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--volk\.proposal-cover-letter--has-recipient-block[\s\S]*?\.proposal-cover-letter__body\s*\{[\s\S]*top:\s*134mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--film-foto\.proposal-cover-letter--has-recipient-block[\s\S]*?\.proposal-cover-letter__body\s*\{[\s\S]*top:\s*132mm;[\s\S]*\}/,
    );
  });

  it("uses a grid-aligned Director contact strip for separate telephone and digital contacts", () => {
    expect(proposalCss).toContain(
      ".proposal-cover-letter--director .proposal-cover-letter__contact-grid",
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*36\.2mm\) minmax\(0,\s*46\.2mm\);[\s\S]*align-items:\s*center;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-group\s*\{[\s\S]*grid-template-columns:\s*4mm minmax\(0,\s*1fr\);[\s\S]*align-items:\s*center;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-group--telephone\s*\{[\s\S]*column-gap:\s*1\.25mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-group--digital\s*\{[\s\S]*column-gap:\s*3mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__contact-mark\s*\{[\s\S]*inline-size:\s*4mm;[\s\S]*text-align:\s*center;[\s\S]*line-height:\s*1;[\s\S]*\}/,
    );
    expect(proposalCss).not.toContain("padding-block-start: 0.85mm;");
    expect(proposalCss).not.toContain(
      ".proposal-cover-letter--director .proposal-cover-letter__phone-block",
    );
  });

  it("keeps the Director metadata date in one fixed-width grid cell", () => {
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__meta-row\s*\{[\s\S]*grid-template-columns:\s*43mm 48mm 42mm 24mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.proposal-cover-letter__meta-item:last-child\s*\{[\s\S]*white-space:\s*nowrap;[\s\S]*overflow-wrap:\s*normal;[\s\S]*\}/,
    );
  });
});
