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
      ".proposal-cover-letter--joella",
      ".proposal-cover-letter--bayer",
    ].forEach((scope) => {
      expect(proposalCss).toContain(`${scope} .dasti-proposal-document__page`);
      expect(proposalCss).toContain(`${scope} .proposal-cover-letter__body`);
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.dasti-proposal-document__page,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.dasti-proposal-document__page\s*\{[\s\S]*width:\s*210mm;[\s\S]*min-height:\s*297mm;[\s\S]*height:\s*297mm;/,
    );
    expect(proposalCss).not.toContain("director-letterhead html");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--director");
    expect(proposalCss).not.toContain(
      "body.proposal-cover-letter--moma-bauhaus",
    );
    expect(proposalCss).not.toContain("body.proposal-cover-letter--joella");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--bayer");
    expect(proposalCss).not.toContain("moma-bauhaus-letterhead html");
    expect(proposalCss).not.toContain("joella-frame-letterhead html");
    expect(proposalCss).not.toContain("bayer-letterhead html");
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
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-recipient,[\s\S]*?\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-footer\s*\{[\s\S]*font-family:\s*Arial,\s*"Helvetica Neue",\s*Helvetica,\s*sans-serif;[\s\S]*\}/,
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
      [".proposal-cover-letter--joella", "35mm"],
    ].forEach(([scope, left]) => {
      expect(proposalCss).toMatch(
        new RegExp(
          `${scope.replace(".", "\\.")}\\s+\\.proposal-cover-letter__body\\s*\\{[\\s\\S]*left:\\s*${left};[\\s\\S]*width:\\s*min\\((?:96|132|140)mm,\\s*(?:58|70)ch\\);`,
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
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-flow\s*\{[\s\S]*left:\s*35mm;[\s\S]*width:\s*157mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__body\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*157mm;[\s\S]*max-width:\s*157mm;[\s\S]*\}/,
    );
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
      proposalCss.indexOf(
        ".proposal-cover-letter--joella .dasti-proposal-document__page",
      ),
    );
    const exportMomaCss = exportRendererSource.slice(
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--moma-bauhaus.export-page",
      ),
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--joella.export-page",
      ),
    );

    expect(momaCss).not.toMatch(/\d+\.\d+mm/);
    expect(exportMomaCss).not.toMatch(/\d+\.\d+mm/);
    [
      "left: 32mm;",
      "top: 11mm;",
      "bottom: auto;",
      "top: 42mm;",
      "font-size: 54pt;",
      "top: 18mm;",
      "font-size: 9pt;",
      "line-height: 13pt;",
      "left: 5mm;",
      "top: 94mm;",
      "width: 197mm;",
      "height: 196mm;",
      "top: 121mm;",
      "top: 141mm;",
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
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-logo\s*\{[\s\S]*font-size:\s*54pt;[\s\S]*overflow:\s*visible;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
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
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-subtitle\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*1mm;[\s\S]*top:\s*18mm;[\s\S]*font-size:\s*7pt;[\s\S]*line-height:\s*9pt;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-recipient\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*42mm;[\s\S]*width:\s*58mm;[\s\S]*gap:\s*0;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-sender p,[\s\S]*?\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-recipient p\s*\{[\s\S]*font-size:\s*9pt;[\s\S]*line-height:\s*13pt;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*121mm;[\s\S]*right:\s*18mm;[\s\S]*gap:\s*1mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta-item\s*\{[\s\S]*font-size:\s*10pt;[\s\S]*line-height:\s*14pt;[\s\S]*font-weight:\s*400;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-meta-item--subject\s*\{[\s\S]*font-weight:\s*800;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s*\{[\s\S]*left:\s*32mm;[\s\S]*top:\s*141mm;[\s\S]*width:\s*min\(132mm,\s*70ch\);[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s+\.dasti-proposal-document__salutation\s*\{[\s\S]*margin-bottom:\s*6pt;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s+\.dasti-proposal-document__paragraph\s+\+\s+\.dasti-proposal-document__paragraph\s*\{[\s\S]*margin-top:\s*6pt;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s+\.dasti-proposal-document__closing\s*\{[\s\S]*gap:\s*6pt;[\s\S]*padding-top:\s*10pt;[\s\S]*\}/,
    );
    expect(exportMomaCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s+\.proposal-block\s+\+\s+\.proposal-block:not\(\.proposal-block--closing\)\s*\{[\s\S]*margin-top:\s*6pt;[\s\S]*\}/,
    );
    expect(exportMomaCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__body\s+\.proposal-block--closing\s*\{[\s\S]*gap:\s*6pt;[\s\S]*padding-top:\s*10pt;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--moma-bauhaus\s+\.proposal-cover-letter__bauhaus-footer\s*\{[\s\S]*top:\s*284mm;[\s\S]*\}/,
    );
  });

  it("keeps Bayer geometry scoped to the Gropius 35 mm A4 grid in preview and export", () => {
    const bayerCss = proposalCss.slice(
      proposalCss.indexOf(
        ".proposal-cover-letter--bayer .dasti-proposal-document__page",
      ),
      proposalCss.indexOf(
        ".proposal-cover-letter--joella .dasti-proposal-document__page",
      ),
    );
    const exportBayerCss = exportRendererSource.slice(
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--bayer.export-page",
      ),
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--joella.export-page",
      ),
    );

    expect(bayerCss).not.toMatch(/\d+\.\d+mm/);
    expect(exportBayerCss).not.toMatch(/\d+\.\d+mm/);
    [
      "left: 35mm;",
      "top: 35mm;",
      "width: 157mm;",
      "top: 8mm;",
      "height: 2pt;",
      "top: 17mm;",
      "top: 23mm;",
      "top: 76mm;",
      "left: 140mm;",
      "top: 116mm;",
      "top: 135mm;",
      "max-height: 158mm;",
      "max-height: 139mm;",
      "top: 280mm;",
      "line-height: 6mm;",
    ].forEach((declaration) => {
      expect(bayerCss).toContain(declaration);
      expect(exportBayerCss).toContain(declaration);
    });
    expect(bayerCss).toContain("max-height: 227mm;");
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-rule\s*\{[\s\S]*left:\s*0;[\s\S]*top:\s*8mm;[\s\S]*width:\s*157mm;[\s\S]*height:\s*2pt;[\s\S]*background-color:\s*var\(--proposal-document-accent-ink,\s*var\(--proposal-document-ink\)\);[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-date\s*\{[\s\S]*left:\s*140mm;[\s\S]*top:\s*76mm;[\s\S]*width:\s*52mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-role\s*\{[\s\S]*top:\s*17mm;[\s\S]*font-weight:\s*720;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-company,[\s\S]*?\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-email\s*\{[\s\S]*top:\s*23mm;[\s\S]*font-weight:\s*400;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-header--has-company\s+\.proposal-cover-letter__bayer-email\s*\{[\s\S]*top:\s*29mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-flow\s*\{[\s\S]*left:\s*35mm;[\s\S]*width:\s*157mm;[\s\S]*overflow:\s*hidden;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-flow--with-subject\s*\{[\s\S]*top:\s*116mm;[\s\S]*max-height:\s*158mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-flow--no-subject\s*\{[\s\S]*top:\s*135mm;[\s\S]*max-height:\s*139mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-subject\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*157mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__body\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*157mm;[\s\S]*max-width:\s*157mm;[\s\S]*overflow:\s*visible;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-flow--with-subject\s+\.proposal-cover-letter__body\s*\{[\s\S]*margin-top:\s*6mm;[\s\S]*\}/,
    );
    expect(bayerCss).toMatch(
      /\.proposal-cover-letter--bayer\s+\.proposal-cover-letter__bayer-footer\s*\{[\s\S]*left:\s*35mm;[\s\S]*top:\s*280mm;[\s\S]*max-width:\s*157mm;[\s\S]*\}/,
    );
    expect(bayerCss).toContain("var(--proposal-document-paper");
    expect(bayerCss).toContain("var(--proposal-document-ink");
    expect(exportBayerCss).toContain("var(--paper");
    expect(exportBayerCss).toContain("var(--ink");
    expect(exportBayerCss).toContain("var(--accent");
  });

  it("keeps Joella geometry scoped to the historical A4 frame in preview and export", () => {
    const joellaCss = proposalCss.slice(
      proposalCss.indexOf(
        ".proposal-cover-letter--joella .dasti-proposal-document__page",
      ),
      proposalCss.indexOf(".dasti-proposal-document--volk-register"),
    );
    const exportJoellaCss = exportRendererSource.slice(
      exportRendererSource.lastIndexOf(
        ".proposal-cover-letter--joella.export-page",
      ),
      exportRendererSource.indexOf("const LATIN_EXPORT_FALLBACK_LOCALES"),
    );

    [
      "left: 5.5mm;",
      "top: 6.8mm;",
      "width: 198.5mm;",
      "height: 282.8mm;",
      "border: 1.32mm solid var(--proposal-joella-structure-color, #74a0c5);",
      "top: 19.65mm;",
      "height: 0;",
      "border-top: 1.32mm solid var(--proposal-joella-structure-color, #74a0c5);",
      "left: 9.8mm;",
      "height: 12.85mm;",
      "padding-top: 2mm;",
      "font-size: 23pt;",
      "letter-spacing: -0.035em;",
      "left: 35mm;",
      "top: 45mm;",
      "right: 34mm;",
      "top: 35mm;",
      "width: min(140mm, 70ch);",
      "margin-bottom: 9.3mm;",
      "font-size: 10pt;",
      "line-height: 4.65mm;",
      "left: 10.4mm;",
      "top: 285.75mm;",
      "font-size: 6pt;",
    ].forEach((declaration) => {
      expect(joellaCss).toContain(declaration);
      expect(exportJoellaCss).toContain(declaration);
    });

    expect(joellaCss).toContain(
      "background-color: var(--proposal-document-paper, var(--paper, #FAF9F5));",
    );
    expect(exportJoellaCss).toContain(
      "background: var(--paper, #FAF9F5) !important;",
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-wordmark\s*\{[\s\S]*transform:\s*none;[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*color:\s*var\(--proposal-joella-mark-color,\s*#8f332f\);[\s\S]*font-weight:\s*700;[\s\S]*text-transform:\s*uppercase;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-recipient p,[\s\S]*?\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-meta p\s*\{[\s\S]*font-size:\s*10pt;[\s\S]*line-height:\s*4.65mm;[\s\S]*font-weight:\s*600;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__body\s+\.dasti-proposal-document__salutation\s*\{[\s\S]*font-weight:\s*400;[\s\S]*margin-bottom:\s*4.65mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-letter-block\s*\{[\s\S]*margin-bottom:\s*9.3mm;[\s\S]*font-size:\s*10pt;[\s\S]*line-height:\s*4.65mm;[\s\S]*font-weight:\s*400;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella[\s\S]*?\.proposal-cover-letter__joella-letter-block-line--strong,[\s\S]*?\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-recipient\s+p:first-child\s*\{[\s\S]*font-weight:\s*700;[\s\S]*\}/,
    );
    expect(joellaCss).not.toMatch(/font-size:\s*\d+(?:\.\d+)?mm;/);
    expect(exportJoellaCss).not.toMatch(/font-size:\s*\d+(?:\.\d+)?mm;/);
    expect(joellaCss).not.toMatch(/font-size:\s*\d+\.\d+pt;/);
    expect(exportJoellaCss).not.toMatch(/font-size:\s*\d+\.\d+pt;/);
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__body\s+\.dasti-proposal-document__paragraph\s+\+\s+\.dasti-proposal-document__paragraph\s*\{[\s\S]*margin-top:\s*4.65mm;[\s\S]*\}/,
    );
    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--joella\s+\.proposal-cover-letter__joella-footer\s*\{[\s\S]*letter-spacing:\s*0.018em;[\s\S]*color:\s*var\(--proposal-joella-structure-color,\s*#74a0c5\);[\s\S]*\}/,
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
