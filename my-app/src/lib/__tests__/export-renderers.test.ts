import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { generateCvTemplate } from "../cv-template";
import type {
  ProposalPrintSource,
  ResumePrintSource,
} from "../document-export-models";
import { buildResumeExportSource } from "../document-export-models";
import {
  buildProposalDocxBuffer,
  buildResumeDocxBuffer,
  renderProposalAtsExportDocument,
  renderProposalStyledExportDocument,
  renderResumeAtsExportDocument,
  renderResumeStyledExportDocument,
} from "../export-renderers";
import { planWorkshopResumePages } from "../resume/resumePagination";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { resumeMock } from "../../features/verbati/resume/resume.mock";

function parseExportHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function countTextOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

function getDataBlockOrder(document: Document): string[] {
  return Array.from(document.querySelectorAll("[data-block]"))
    .map((node) => node.getAttribute("data-block"))
    .filter((value): value is string => Boolean(value));
}

function getInlineStyles(document: Document): string {
  return Array.from(document.querySelectorAll("style"))
    .map((styleTag) => styleTag.textContent ?? "")
    .join("\n");
}

async function readDocxMainXml(buffer: Buffer): Promise<{
  documentXml: string;
  stylesXml: string;
}> {
  const archive = await JSZip.loadAsync(buffer);

  return {
    documentXml: (await archive.file("word/document.xml")?.async("string")) ?? "",
    stylesXml: (await archive.file("word/styles.xml")?.async("string")) ?? "",
  };
}

function expectDocxLanguageMetadata(args: {
  documentXml: string;
  stylesXml: string;
  locale: string;
  rtl: boolean;
}): void {
  const combinedXml = `${args.documentXml}\n${args.stylesXml}`;

  expect(combinedXml).toContain("w:lang");
  expect(combinedXml).toContain(`w:val="${args.locale}"`);

  if (args.rtl) {
    expect(args.documentXml).toContain("w:bidi");
    expect(args.documentXml).toContain("w:rtl");
    expect(combinedXml).toContain(`w:bidi="${args.locale}"`);
    return;
  }

  expect(args.documentXml).not.toContain("w:bidi");
  expect(args.documentXml).not.toContain("w:rtl");
  expect(combinedXml).not.toContain(`w:bidi="${args.locale}"`);
}

const resumeFixture: ResumePrintSource = {
  schemaVersion: 1,
  kind: "resume",
  locale: "en",
  title: "Alex Mercer Resume",
  exportSource: "standard",
  profile: {
    name: "Alexandria Mercer-Delacroix",
    title: "Senior Product Design Systems and Content Operations Lead",
    summary:
      "Builds resilient document systems, export flows, and design language across product, content, and operations teams.",
  },
  contact: [
    { label: "Email", value: "alexandria.mercer.delacroix@example.com" },
    {
      label: "Website",
      value: "https://portfolio.example.com/alexandria-mercer-delacroix",
    },
  ],
  metadata: [{ label: "Location", value: "Paris, France" }],
  skills: [
    "Design systems governance",
    "Structured export quality",
    "Editorial workflow operations",
  ],
  languages: [{ name: "French", level: "Native" }],
  experience: [
    {
      role: "Lead Design Systems and Documentation Operations Partner",
      company: "North Atlantic Product Infrastructure Studio",
      period: "2021 - Present",
      location: "Paris / Remote",
      summary:
        "Owns export quality, shared tokens, and release documentation across multiple client-facing systems.",
      bullets: [
        "Built shared tokens for document rendering, structured export, and ATS-safe output.",
        "Reduced document QA churn by formalizing print-specific hierarchy and spacing rules.",
      ],
    },
  ],
  projects: [
    {
      name: "Cross-language export typography",
      meta: "2025",
      description:
        "Defined locale-safe punctuation and formatting rules for French and English exports.",
    },
  ],
  education: [
    {
      degree: "Master of Information Design",
      school: "École Supérieure des Arts Visuels",
      period: "2017 - 2019",
    },
  ],
  achievements: [
    "Created a shared export contract used across ATS and styled outputs.",
  ],
  hobbies: ["Book design", "Editorial systems"],
};

const proposalFixture: ProposalPrintSource = {
  schemaVersion: 1,
  kind: "proposal",
  locale: "fr",
  title: "Candidature",
  proposalType: "cover_letter",
  documentTitle: 'Candidature "Produit" 1.5 mm',
  documentMeta: "Paris : interface ; systèmes !",
  contactLine: "alex@example.com : +33 6 00 00 00 00",
  letterDate: "15 avril 2026 !",
  recipientDetails: 'Studio Nord : Paris\n"Équipe produit"',
  applicantHeader: {
    name: "Alex Mercer",
    role: "Designer de systèmes",
    email: "alex@example.com",
    phone: "+33 6 00 00 00 00",
    linkedin: "",
    website: "portfolio.example.com",
    location: "Paris",
    tag: "",
  },
  headerVisibility: {
    showSender: true,
    showDate: true,
    showRecipient: true,
    showRecipientDetails: true,
    showSubject: true,
  },
  templateId: "swiss_margin",
  body: [
    {
      type: "salutation",
      text: "Bonjour !",
    },
    {
      type: "paragraph",
      text: 'Je construis des systèmes "éditoriaux" robustes pour des exports fiables.',
    },
    {
      type: "closing",
      signOff: "Cordialement !",
      signatureName: "Alex Mercer",
    },
  ],
};

describe("export-renderers", () => {
  it("renders ATS as the protected one-column baseline and styled resume export as the Robial split baseline", () => {
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(resumeFixture, {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      }),
    );
    const swissStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );
    const normalizedStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "editorial",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );

    const atsCss = getInlineStyles(atsDocument);
    const swissCss = getInlineStyles(swissStyledDocument);
    const normalizedStyledCss = getInlineStyles(normalizedStyledDocument);

    expect(atsDocument.body.className).toContain("resume-shell--onecol");
    expect(atsDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(atsDocument.querySelector(".export-header")).toBeTruthy();
    expect(atsCss).toContain("--heading-font: Fraunces");
    expect(atsCss).toContain("--body-font: Syne");
    expect(atsCss).toContain("--flow-reading-measure: 112mm;");
    expect(atsCss).not.toContain("body.resume-export.resume--styled .robial-sidebar");

    expect(swissStyledDocument.body.className).toContain("resume-layout--swiss");
    expect(swissStyledDocument.body.className).toContain("resume-shell--split");
    expect(swissStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(swissCss).toContain("--page-sidebar: 35mm;");
    expect(swissCss).toContain("--page-gutter: 18mm;");

    expect(normalizedStyledDocument.body.className).toContain(
      "resume-layout--editorial",
    );
    expect(normalizedStyledDocument.body.className).toContain(
      "resume-shell--split",
    );
    expect(normalizedStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(normalizedStyledDocument.querySelector(".resume-main-stack")).toBeTruthy();
    expect(
      normalizedStyledDocument.querySelector(".resume-styled-page"),
    ).toBeNull();
    expect(normalizedStyledCss).toContain("--flow-reading-measure: 105mm;");
    expect(normalizedStyledCss).toContain("--page-sidebar: 35mm;");
    expect(normalizedStyledCss).toContain("--page-gutter: 18mm;");
  });

  it("normalizes deferred styled layouts onto the protected Robial split export baseline", () => {
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(resumeFixture, {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      }),
    );
    const modernistStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "modernist",
          typography: "quiet-editorial",
          palette: "encre",
        },
      }),
    );
    const quireStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "quire",
          typography: "quiet-editorial",
          palette: "ocre",
        },
      }),
    );
    const editorialStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "editorial",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );
    const swissStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );

    expect(atsDocument.body.className).toContain("resume-shell--onecol");
    expect(atsDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(atsDocument.querySelector(".export-header")).toBeTruthy();

    expect(modernistStyledDocument.body.className).toContain("resume-shell--split");
    expect(modernistStyledDocument.body.className).toContain("resume-layout--modernist");
    expect(modernistStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(modernistStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(
      modernistStyledDocument.querySelector(".section--projects .entry--project"),
    ).toBeTruthy();

    expect(quireStyledDocument.body.className).toContain("resume-shell--split");
    expect(quireStyledDocument.body.className).toContain("resume-layout--quire");
    expect(quireStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(quireStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(quireStyledDocument.querySelector(".resume-main-stack")).toBeTruthy();

    expect(editorialStyledDocument.body.className).toContain("resume-shell--split");
    expect(editorialStyledDocument.body.className).toContain("resume-layout--editorial");
    expect(editorialStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(editorialStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();

    expect(swissStyledDocument.body.className).toContain("resume-shell--split");
    expect(swissStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(swissStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
  });

  it("renders proposal ATS as a one-column export and styled templates as Robial-safe structural variants", () => {
    const atsDocument = parseExportHtml(
      renderProposalAtsExportDocument(proposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );
    const railStyledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "two_column_rail",
        },
        stylePreset: {
          layout: "two-column",
          typography: "ledger-sans",
          palette: "encre",
        },
      }),
    );
    const quireStyledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "quire_margin",
        },
        stylePreset: {
          layout: "quire",
          typography: "quiet-editorial",
          palette: "ocre",
        },
      }),
    );
    const workshopStyledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "workshop_proposal_margin",
        },
        stylePreset: {
          familyId: "workshop",
          layout: "workshop",
          typography: "expert",
          palette: "cobalt",
        },
      }),
    );

    const atsCss = getInlineStyles(atsDocument);
    const railCss = getInlineStyles(railStyledDocument);
    const quireCss = getInlineStyles(quireStyledDocument);
    const workshopCss = getInlineStyles(workshopStyledDocument);

    expect(atsDocument.documentElement.lang).toBe("fr");
    expect(atsDocument.documentElement.dir).toBe("ltr");
    expect(atsDocument.body.className).toContain("proposal-shell--onecol");
    expect(atsDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(atsCss).toContain("--heading-font: Fraunces");
    expect(atsCss).toContain("--body-font: Syne");
    expect(atsDocument.body.innerHTML).toContain("«&nbsp;Produit&nbsp;»");
    expect(atsDocument.body.innerHTML).toContain("1,5&nbsp;mm");
    expect(
      atsDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("alex mercer");

    expect(railStyledDocument.body.className).toContain(
      "proposal-template--two-column-rail",
    );
    expect(railStyledDocument.body.className).toContain("proposal-shell--rail");
    expect(railStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(railCss).toContain('--heading-font: "Special Elite"');
    expect(railCss).toContain('--body-font: "Courier Prime"');
    expect(railCss).toContain("--decor-subject-shadow:");

    expect(quireStyledDocument.body.className).toContain(
      "proposal-template--quire-margin",
    );
    expect(quireStyledDocument.body.className).toContain(
      "proposal-shell--onecol",
    );
    expect(quireStyledDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(quireCss).toContain("--flow-reading-measure:");
    expect(quireCss).toContain(
      ".proposal-signature {\n      margin-top: var(--flow-closing-name-gap);\n      font-family: var(--proposal-signature-font-family, var(--body-font));\n      font-weight: var(--decor-signature-font-weight, 700);\n      text-transform: var(--decor-signature-text-transform, none);\n      font-variant-caps: var(--decor-signature-font-variant-caps, normal);\n      letter-spacing: var(--decor-signature-letter-spacing, normal);",
    );
    expect(quireCss).toContain("--decor-proposal-title-font-style: italic;");
    expect(quireCss).toContain("--decor-proposal-title-letter-spacing: -0.015em;");
    expect(quireCss).toContain("--decor-signature-font-variant-caps: normal;");

    expect(workshopStyledDocument.body.className).toContain(
      "proposal-template--workshop-proposal-margin",
    );
    expect(workshopStyledDocument.body.className).toContain(
      "proposal-shell--onecol",
    );
    expect(workshopStyledDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(workshopCss).toContain("--page-margin-left: 35mm;");
    expect(workshopCss).toContain("--page-margin-right: 18mm;");
    expect(workshopCss).toContain("--robial-step-a: 17mm;");
    expect(workshopCss).toContain("--robial-step-b: 18mm;");
  });

  it.each([
    {
      templateId: "twoweeks-letterhead" as const,
      scope: "proposal-cover-letter--twoweeks",
      label: "Twoweeks Letterhead",
    },
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      label: "Director Letterhead",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      label: "Volk Letterhead",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
      label: "Film und Foto Letterhead",
    },
    {
      templateId: "moma-bauhaus-letterhead" as const,
      scope: "proposal-cover-letter--moma-bauhaus",
      label: "MoMA Bauhaus Letterhead",
    },
    {
      templateId: "joella-frame-letterhead" as const,
      scope: "proposal-cover-letter--joella",
      label: "Joella Frame Letterhead",
    },
    {
      templateId: "bayer-letterhead" as const,
      scope: "proposal-cover-letter--bayer",
      label: "Bayer",
    },
  ])(
    "renders $label through styled proposal HTML export with scoped A4 CSS",
    ({ templateId, scope }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            recipientDetails:
              templateId === "joella-frame-letterhead" ||
              templateId === "bayer-letterhead"
                ? [
                    "recipient: Studio Nord : Paris",
                    'title: "Équipe produit"',
                    "company: Collectif Nord",
                    "address: 10 Rue Bleue",
                    "city: Paris 75010",
                    "France",
                    "email: hiring@studio.example",
                  ].join("\n")
                : proposalFixture.recipientDetails,
            body: [
              { type: "salutation", text: "Dear Hiring Manager," },
              { type: "paragraph", text: "First export paragraph." },
              { type: "paragraph", text: "Second export paragraph." },
              { type: "paragraph", text: "Third export paragraph." },
              {
                type: "closing",
                signOff: "Sincerely,",
                signatureName: "Alex Mercer",
              },
            ],
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const css = getInlineStyles(document);
      const page = document.querySelector(`.${scope}`);
      const blocks = Array.from(
        document.querySelectorAll(`.${scope} .proposal-cover-letter__body .proposal-block`),
      ).map((node) => node.textContent?.trim());

      expect(document.body.className).toContain(
        `proposal-template--${templateId}`,
      );
      expect(page).toBeTruthy();
      expect(
        document.querySelector(`.${scope} .proposal-cover-letter__film-kicker`),
      ).toBeNull();
      expect(css).toContain(`.${scope}.export-page`);
      expect(css).toContain("width: var(--page-width);");
      expect(css).toContain("min-height: var(--page-height);");
      const expectedBodyLeft =
        templateId === "twoweeks-letterhead"
          ? "left: 87mm;"
          : templateId === "director-letterhead"
          ? "left: 25mm;"
          : templateId === "volk-letterhead"
            ? "left: 24mm;"
            : templateId === "film-foto-letterhead"
              ? "left: 20mm;"
              : templateId === "moma-bauhaus-letterhead"
                ? "left: 32mm;"
                : "left: 35mm;";
      expect(css).toContain(expectedBodyLeft);
      expect(css).toContain(
        templateId === "twoweeks-letterhead"
          ? "width: min(105mm, 64ch);"
          : templateId === "moma-bauhaus-letterhead"
          ? "width: min(calc(var(--moma-bauhaus-body-width-mm) * 1mm), 70ch);"
          : templateId === "joella-frame-letterhead"
            ? "width: min(calc(var(--joella-body-width-mm) * 1mm), 70ch);"
            : templateId === "bayer-letterhead"
              ? "width: 157mm;"
          : "width: min(96mm, 58ch);",
      );
      expect(css).toContain(
        templateId === "twoweeks-letterhead"
          ? "max-width: min(105mm, 64ch);"
          : templateId === "moma-bauhaus-letterhead"
          ? "max-width: min(calc(var(--moma-bauhaus-body-width-mm) * 1mm), 70ch);"
          : templateId === "joella-frame-letterhead"
            ? "max-width: min(calc(var(--joella-body-width-mm) * 1mm), 70ch);"
            : templateId === "bayer-letterhead"
              ? "max-width: 157mm;"
          : "max-width: min(96mm, 58ch);",
      );
      expect(css).toContain("overflow-wrap: break-word;");
      if (templateId === "twoweeks-letterhead") {
        expect(css).toContain("font-family: Arial, Helvetica, sans-serif;");
        expect(css).toContain(
          'font-family: Georgia, "Times New Roman", Times, serif;',
        );
      } else {
        expect(css).toContain(
          "font-family: var(--heading-font, var(--font-heading-family));",
        );
        expect(css).toContain(
          "font-family: var(--body-font, var(--font-body-family));",
        );
      }
      expect(document.body.textContent).toMatch(/Alex Mercer|alex mercer/);
      expect(document.body.textContent).toContain("Studio Nord");
      expect(blocks.slice(0, 4)).toEqual([
        "Dear Hiring Manager,",
        "First export paragraph.",
        "Second export paragraph.",
        "Third export paragraph.",
      ]);
      expect(blocks.at(-1)).toContain("Sincerely,");
      expect(blocks.at(-1)).toContain("alex mercer");
      expect(document.body.textContent).not.toContain("undefined");
      expect(document.body.textContent).not.toContain("null");
      expect(document.body.textContent).not.toContain("[object Object]");
      expect(document.body.textContent).not.toMatch(
        /Graphische|Berufsschule|volksverband|Werkbund|Postcheckkonto|Bankkonto|tschichold/i,
      );
      expect(document.body.textContent).not.toContain("Vorbereitungssekretariat");
      expect(document.body.textContent).not.toContain("Institut für Auslandsbeziehungen");
      if (templateId === "twoweeks-letterhead") {
        const twoweeksCss = css.slice(
          css.lastIndexOf(".proposal-cover-letter--twoweeks.export-page"),
          css.lastIndexOf(".proposal-cover-letter--director.export-page"),
        );
        const railText =
          page?.querySelector(".proposal-cover-letter__twoweeks-rail")
            ?.textContent ?? "";
        const senderLines = Array.from(
          page?.querySelectorAll(".proposal-cover-letter__twoweeks-rail p") ??
            [],
        ).map((node) => node.textContent);
        const breakAfterContactLines = Array.from(
          page?.querySelectorAll(
            ".proposal-cover-letter__twoweeks-contact-line--break-after",
          ) ?? [],
        ).map((node) => node.textContent);
        const recipientLines = Array.from(
          page?.querySelectorAll(".proposal-cover-letter__twoweeks-recipient p") ??
            [],
        ).map((node) => node.textContent);
        const subjectText =
          page?.querySelector(".proposal-cover-letter__twoweeks-subject")
            ?.textContent ?? "";

        expect(twoweeksCss).not.toMatch(/\d+\.\d+mm/);
        expect(twoweeksCss).toContain("left: 17mm;");
        expect(twoweeksCss).toContain("top: 22mm;");
        expect(twoweeksCss).toContain("left: 87mm;");
        expect(twoweeksCss).toContain("top: 83mm;");
        expect(twoweeksCss).toContain("display: block;");
        expect(twoweeksCss).toContain("margin-bottom: 7mm;");
        expect(twoweeksCss).toContain("margin-bottom: 6mm;");
        expect(twoweeksCss).toContain("gap: 0;");
        expect(twoweeksCss).toContain("font-size: 10pt;");
        expect(twoweeksCss).toContain("font-size: 8pt;");
        expect(twoweeksCss).toContain("font-size: 11pt;");
        expect(twoweeksCss).toContain("line-height: 12pt;");
        expect(twoweeksCss).toContain("line-height: 10pt;");
        expect(twoweeksCss).toContain("line-height: 11pt;");
        expect(twoweeksCss).toContain("line-height: 13pt;");
        expect(twoweeksCss).toContain("line-height: 15pt;");
        expect(twoweeksCss).toContain("margin-bottom: 11pt;");
        expect(twoweeksCss).toContain("var(--paper");
        expect(twoweeksCss).toContain("var(--ink");
        expect(twoweeksCss).toContain("var(--accent, #385f8a)");
        expect(twoweeksCss).toContain("width: min(105mm, 64ch);");
        expect(railText).toContain("Alex");
        expect(railText).toContain("Mercer");
        expect(railText).toContain("Designer de systèmes");
        expect(railText).toContain("alex@example.com");
        expect(railText).toContain("+33 6 00 00 00 00");
        expect(railText).toContain("Paris");
        expect(railText).toContain("portfolio.example.com");
        expect(railText).not.toContain("FROM");
        expect(railText).not.toContain("TO");
        expect(railText).not.toContain("Candidature");
        expect(senderLines).toEqual([
          "Alex Mercer",
          "Designer de systèmes",
          "+33 6 00 00 00 00",
          "alex@example.com",
          "portfolio.example.com",
          "Paris",
        ]);
        expect(breakAfterContactLines).toEqual([
          "alex@example.com",
          "portfolio.example.com",
        ]);
        expect(
          page?.querySelector(".proposal-cover-letter__twoweeks-recipient-label")
        ).toBeNull();
        expect(
          recipientLines.some((line) => line?.includes("Studio Nord")),
        ).toBe(true);
        expect(subjectText).toBe("Subject: Candidature «\u00a0Produit\u00a0» 1,5\u00a0mm");
      }
      if (templateId === "film-foto-letterhead") {
        const filmCss = css.slice(
          css.lastIndexOf(".proposal-cover-letter--film-foto.export-page"),
          css.lastIndexOf(".proposal-cover-letter--moma-bauhaus.export-page"),
        );

        expect(filmCss).toContain("text-transform: uppercase;");
        expect(filmCss).toContain("height: 0.8pt;");
        expect(filmCss).toContain("top: calc(var(--page-height) / 3);");
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__info-blocks p\s*\{[\s\S]*font-weight:\s*400;[\s\S]*\}/,
        );
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__meta-item\s*\{[\s\S]*font-weight:\s*400;[\s\S]*\}/,
        );
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__recipient-block p\s*\{[\s\S]*font-weight:\s*400;[\s\S]*\}/,
        );
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__subject-label,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__subject-value\s*\{[\s\S]*color:\s*var\(--accent\);[\s\S]*font-weight:\s*400;[\s\S]*\}/,
        );
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__film-address-footer\s*\{[\s\S]*bottom:\s*18mm;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/,
        );
        expect(filmCss).toMatch(
          /\.proposal-cover-letter--film-foto\s+\.proposal-cover-letter__dot\s*\{[\s\S]*bottom:\s*38\.8mm;[\s\S]*width:\s*2\.2mm;[\s\S]*height:\s*2\.2mm;[\s\S]*\}/,
        );
        expect(filmCss).toContain("top: calc((var(--page-height) / 3) + 11mm);");
        expect(filmCss).toContain("top: calc((var(--page-height) / 3) + 24mm);");
      }
      if (templateId === "moma-bauhaus-letterhead") {
        const momaCss = css.slice(
          css.lastIndexOf(".proposal-cover-letter--moma-bauhaus.export-page"),
          css.lastIndexOf(".proposal-cover-letter--joella.export-page"),
        );
        const senderText =
          page?.querySelector(".proposal-cover-letter__bauhaus-sender")
            ?.textContent ?? "";
        const recipientText =
          page?.querySelector(".proposal-cover-letter__bauhaus-recipient")
            ?.textContent ?? "";
        const headerText =
          page?.querySelector(".proposal-cover-letter__bauhaus-header")
            ?.textContent ?? "";
        const footerLeftText =
          page?.querySelector(".proposal-cover-letter__bauhaus-footer--left")
            ?.textContent ?? "";
        const footerRightText =
          page?.querySelector(".proposal-cover-letter__bauhaus-footer--right")
            ?.textContent ?? "";

        expect(momaCss).not.toMatch(/\d+\.\d+mm/);
        expect(page?.querySelector(".proposal-cover-letter__bauhaus-frame")).toBeTruthy();
        expect(senderText).toContain("Alex Mercer");
        expect(senderText).toContain("Designer de systèmes");
        expect(senderText).toContain("Paris");
        expect(senderText).not.toContain("alex@example.com");
        expect(senderText).not.toContain("+33 6 00 00 00 00");
        expect(senderText).not.toContain("portfolio.example.com");
        expect(recipientText).toContain("Studio Nord");
        expect(recipientText).not.toContain("Candidature");
        expect(headerText).not.toContain("Candidature");
        expect(headerText).toContain("Alex");
        expect(headerText).not.toContain("Alex Mercer");
        expect(headerText).toContain("Designer de systèmes");
        expect(
          page?.querySelector(".proposal-cover-letter__bauhaus-meta")
            ?.textContent,
        ).toContain("Subject: Candidature");
        expect(footerLeftText).toContain("alex@example.com");
        expect(footerLeftText).toContain("+33 6 00 00 00 00");
        expect(footerRightText).toContain("portfolio.example.com");
        expect(footerRightText).not.toContain("Paris");
      }
      if (templateId === "joella-frame-letterhead") {
        const joellaCss = css.slice(
          css.lastIndexOf(".proposal-cover-letter--joella.export-page"),
        );
        const wordmarkText =
          page?.querySelector(".proposal-cover-letter__joella-wordmark")
            ?.textContent ?? "";
        const recipientText =
          page?.querySelector(".proposal-cover-letter__joella-recipient")
            ?.textContent ?? "";
        const letterBlockLines = Array.from(
          page?.querySelectorAll(".proposal-cover-letter__joella-letter-block p") ??
            [],
        ).map((node) => node.textContent);
        const metaText =
          page?.querySelector(".proposal-cover-letter__joella-meta")?.textContent ??
          "";
        const footerText =
          page?.querySelector(".proposal-cover-letter__joella-footer")
            ?.textContent ?? "";

        expect(joellaCss).toContain("--joella-frame-left-mm: 5.5;");
        expect(joellaCss).toContain(
          "--joella-frame-width-mm: calc(var(--proposal-page-width-mm) - 11.5);",
        );
        expect(joellaCss).toContain(
          "--joella-frame-height-mm: calc(var(--proposal-page-height-mm) - 14.2);",
        );
        expect(joellaCss).toContain("top: 19.65mm;");
        expect(joellaCss).toContain(
          "border: 1.32mm solid var(--proposal-joella-structure-color);",
        );
        expect(joellaCss).toContain(
          "border-top: 1.32mm solid var(--proposal-joella-structure-color);",
        );
        expect(joellaCss).toContain("top: 35mm;");
        expect(joellaCss).toContain("margin-bottom: 9.3mm;");
        expect(joellaCss).toContain(
          "top: calc(var(--joella-footer-top-mm) * 1mm);",
        );
        expect(page?.querySelector(".proposal-cover-letter__joella-frame")).toBeTruthy();
        expect(page?.querySelector(".proposal-cover-letter__joella-divider")).toBeTruthy();
        expect(wordmarkText).toBe("ALEX MERCER");
        expect(wordmarkText).not.toContain("Candidature");
        expect(page?.querySelector(".proposal-cover-letter__joella-recipient"))
          .toBeNull();
        expect(page?.querySelector(".proposal-cover-letter__joella-meta"))
          .toBeNull();
        expect(recipientText).toBe("");
        expect(metaText).toBe("");
        expect(letterBlockLines).toEqual([
          "Alex Mercer",
          "Designer de systèmes",
          "alex@example.com · +33 6 00 00 00 00 · portfolio.example.com",
          "Paris",
          "15 avril 2026\u00a0!",
          "Studio Nord : Paris",
          '"Équipe produit"',
          "Collectif Nord",
          "hiring@studio.example",
          "10 Rue Bleue",
          "Paris 75010",
          "France",
          "Subject: Candidature «\u00a0Produit\u00a0» 1,5\u00a0mm",
        ]);
        expect(letterBlockLines.join(" ")).not.toContain("Re:");
        expect(letterBlockLines.join(" ")).not.toContain("Date:");
        expect(footerText).toBe("PARIS · ALEX@EXAMPLE.COM · +33 6 00 00 00 00");
        expect(footerText).toContain("PARIS");
        expect(footerText).toContain("ALEX@EXAMPLE.COM");
        expect(footerText).toContain("+33 6 00 00 00 00");
        expect(footerText).not.toContain("portfolio.example.com");
        expect(footerText).not.toContain("Candidature");
      }
      if (templateId === "bayer-letterhead") {
        const bayerCss = css.slice(
          css.lastIndexOf(".proposal-cover-letter--bayer.export-page"),
          css.lastIndexOf(".proposal-cover-letter--joella.export-page"),
        );
        const headerText =
          page?.querySelector(".proposal-cover-letter__bayer-header")
            ?.textContent ?? "";
        const recipientLines = Array.from(
          page?.querySelectorAll(".proposal-cover-letter__bayer-recipient p") ??
            [],
        ).map((node) => node.textContent);
        const footerText =
          page?.querySelector(".proposal-cover-letter__bayer-footer")
            ?.textContent ?? "";

        expect(bayerCss).not.toMatch(/\d+\.\d+mm/);
        expect(bayerCss).toContain("left: 35mm;");
        expect(bayerCss).toContain("top: 35mm;");
        expect(bayerCss).toContain("left: 140mm;");
        expect(bayerCss).toContain("top: 116mm;");
        expect(bayerCss).toContain("top: 135mm;");
        expect(bayerCss).toContain("top: 280mm;");
        expect(bayerCss).toContain("var(--paper");
        expect(bayerCss).toContain("var(--ink");
        expect(bayerCss).toContain("var(--accent");
        expect(headerText).toContain("Alex Mercer");
        expect(headerText).toContain("Designer de systèmes");
        expect(headerText).toContain("alex@example.com");
        expect(headerText).not.toContain("Candidature");
        expect(headerText).not.toContain("+33 6 00 00 00 00");
        expect(recipientLines).toEqual([
          "TO",
          "Studio Nord : Paris",
          '"Équipe produit"',
          "Collectif Nord",
          "hiring@studio.example",
          "10 Rue Bleue · Paris 75010",
          "France",
        ]);
        expect(
          page?.querySelector(".proposal-cover-letter__bayer-date")?.textContent,
        ).toContain("15 avril 2026");
        expect(
          page?.querySelector(".proposal-cover-letter__bayer-date")?.textContent,
        ).not.toContain("Date:");
        expect(
          page?.querySelector(".proposal-cover-letter__bayer-subject")
            ?.textContent,
        ).toBe("SUBJECTCandidature «\u00a0Produit\u00a0» 1,5\u00a0mm");
        expect(footerText).toContain("+33 6 00 00 00 00");
        expect(footerText).toContain("Paris");
        expect(footerText).toContain("portfolio.example.com");
        expect(footerText).not.toContain("alex@example.com");
      }
    },
  );

  it.each([
    {
      templateId: "twoweeks-letterhead" as const,
      scope: "proposal-cover-letter--twoweeks",
      recipientSelector: ".proposal-cover-letter__twoweeks-recipient",
    },
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "moma-bauhaus-letterhead" as const,
      scope: "proposal-cover-letter--moma-bauhaus",
      recipientSelector: ".proposal-cover-letter__bauhaus-recipient",
    },
    {
      templateId: "joella-frame-letterhead" as const,
      scope: "proposal-cover-letter--joella",
      recipientSelector: ".proposal-cover-letter__joella-letter-block",
    },
    {
      templateId: "bayer-letterhead" as const,
      scope: "proposal-cover-letter--bayer",
      recipientSelector: ".proposal-cover-letter__bayer-recipient",
    },
  ])(
    "exports every heading drawer field into $templateId letterhead",
    ({ templateId, scope, recipientSelector }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            locale: "en",
            templateId,
            documentTitle: "Application for Operations Lead",
            letterDate: "May 30, 2026",
            contactLine:
              "avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work",
            recipientDetails:
              "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis\nAdditional address line",
            applicantHeader: {
              ...proposalFixture.applicantHeader,
              name: "Avery Stone",
              role: "Operations Lead",
              company: "Stone Systems",
              email: "avery@example.com",
              phone: "+33 6 01 02 03 04",
              linkedin: "linkedin.com/in/avery",
              website: "avery.work",
              location: "Paris / Remote",
            },
            headerVisibility: {
              showSender: true,
              showDate: true,
              showRecipient: true,
              showRecipientDetails: true,
              showSubject: true,
            },
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);
      const pageText = page?.textContent ?? "";
      const recipientText =
        page?.querySelector(recipientSelector)?.textContent ?? "";

      const expectedPageValues = [
        "Avery Stone",
        "Operations Lead",
        "avery@example.com",
        "+33 6 01 02 03 04",
        "linkedin.com/in/avery",
        "avery.work",
        "Paris / Remote",
      ];
      if (scope !== "proposal-cover-letter--film-foto") {
        expectedPageValues.push("Stone Systems");
      }
      expectedPageValues.forEach((value) => {
        expect(pageText).toContain(value);
      });

      if (recipientSelector === ".proposal-cover-letter__recipient-block") {
        const metaItems = Array.from(
          page?.querySelectorAll(".proposal-cover-letter__meta-item") ?? [],
        ).map((node) => node.textContent);
        const subjectLabel = page?.querySelector(
          ".proposal-cover-letter__subject-label",
        );

        expect(subjectLabel?.textContent).toBe(
          templateId === "film-foto-letterhead" ? "subject:" : "Subject:",
        );
        expect(metaItems).toEqual([
          "Hiring Manager",
          "Head of Talent",
          "Northwind",
          "May 30, 2026",
        ]);
        [
          "hiring@northwind.com",
          "12 Rue de la Paix",
          "Paris",
          "Additional address line",
        ].forEach((value) => {
          expect(recipientText).toContain(value);
        });
        ["Hiring Manager", "Head of Talent", "Northwind"].forEach((value) => {
          expect(recipientText).not.toContain(value);
        });
        if (scope === "proposal-cover-letter--film-foto") {
          const labels = Array.from(
            page?.querySelectorAll(
              ".proposal-cover-letter__info-blocks .proposal-cover-letter__info-label",
            ) ?? [],
          ).map((node) => node.textContent);

          expect(labels).toEqual([
            "sender",
            "company",
            "phone",
            "social",
            "www",
          ]);
          expect(pageText).not.toContain("Stone Systems");
        }
      } else {
        [
          "Hiring Manager",
          "Head of Talent",
          "Northwind",
          "hiring@northwind.com",
          "12 Rue de la Paix",
          "Paris",
          "Additional address line",
        ].forEach((value) => {
          expect(recipientText).toContain(value);
        });
      }
      if (templateId === "joella-frame-letterhead") {
        expect(pageText).toContain("may 30, 2026");
        expect(pageText).not.toContain("May 30, 2026");
        expect(
          Array.from(
            page?.querySelectorAll(
              ".proposal-cover-letter__joella-letter-block-line--strong",
            ) ?? [],
          ).map((node) => node.textContent),
        ).toEqual(["Avery Stone", "Hiring Manager"]);
        expect(
          page?.querySelector(
            ".proposal-cover-letter__joella-letter-block-subject-value",
          )?.textContent,
        ).toBe(" Application for Operations Lead");
      }
    },
  );

  it("renders MoMA Bauhaus profile metadata in the styled export footer from the contact line", () => {
    const document = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "moma-bauhaus-letterhead",
          contactLine:
            "alex@example.com · +33 6 00 00 00 00 · Paris · Upwork: alex profile · Website: portfolio on request",
          recipientDetails:
            "recipient: Recipient Person\ncompany: Recipient Company\ncity: Company City\nrole: Recipient Role\naddress: Recipient Address\nemail: recipient@mail.com",
          headerVisibility: {
            showSender: true,
            showDate: true,
            showRecipient: true,
            showRecipientDetails: false,
            showSubject: true,
          },
          applicantHeader: {
            ...proposalFixture.applicantHeader,
            linkedin: "",
            website: "",
          },
        },
        stylePreset: {
          familyId: "workshop",
          layout: "workshop",
          typography: "expert",
          palette: "terre",
        },
      }),
    );

    const senderText =
      document.querySelector(".proposal-cover-letter__bauhaus-sender")
        ?.textContent ?? "";
    const footerRightText =
      document.querySelector(".proposal-cover-letter__bauhaus-footer--right")
        ?.textContent ?? "";
    const recipientLines = Array.from(
      document.querySelectorAll(".proposal-cover-letter__bauhaus-recipient p"),
    ).map((node) => node.textContent);

    expect(senderText).not.toContain("Upwork: alex profile");
    expect(footerRightText).toContain("Upwork: alex profile");
    expect(footerRightText).toContain("portfolio on request");
    expect(footerRightText).not.toContain("Paris");
    expect(recipientLines).toEqual([
      "Recipient Person",
      "Recipient Role",
      "Recipient Company",
      "recipient@mail.com",
      "Recipient Address",
      "Company City",
    ]);
  });

  it("maps contact-line phone into the director letterhead telephone slot during export", () => {
    const document = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "director-letterhead",
          contactLine: "zoe@loi.com · 09898777 · Paris · @zoe.com",
          applicantHeader: {
            ...proposalFixture.applicantHeader,
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            website: "",
          },
        },
        stylePreset: {
          familyId: "workshop",
          layout: "workshop",
          typography: "expert",
          palette: "terre",
        },
      }),
    );
    const phoneBlock = document.querySelector(
      ".proposal-cover-letter--director .proposal-cover-letter__contact-grid",
    );
    const contactGroups = Array.from(
      phoneBlock?.querySelectorAll(".proposal-cover-letter__contact-group") ??
        [],
    );

    expect(contactGroups).toHaveLength(2);
    expect(contactGroups[0]?.querySelector(".proposal-cover-letter__contact-mark")?.textContent)
      .toBe("T");
    expect(contactGroups[0]?.querySelector(".proposal-cover-letter__contact-lines")?.textContent)
      .toContain("09898777");
    expect(contactGroups[1]?.querySelector(".proposal-cover-letter__contact-mark")?.textContent)
      .toBe("@");
    expect(phoneBlock?.textContent).toContain("T");
    expect(phoneBlock?.textContent).toContain("09898777");
    expect(phoneBlock?.textContent).toContain("@");
    expect(phoneBlock?.textContent).toContain("zoe@loi.com");
    expect(phoneBlock?.textContent).toContain("@zoe.com");
  });

  it("uses a digital @ contact block in the director letterhead export when no phone exists", () => {
    const document = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "director-letterhead",
          contactLine: "zoe@loi.com · Paris · zoe.com",
          applicantHeader: {
            ...proposalFixture.applicantHeader,
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            website: "",
          },
        },
        stylePreset: {
          familyId: "workshop",
          layout: "workshop",
          typography: "expert",
          palette: "terre",
        },
      }),
    );
    const phoneBlock = document.querySelector(
      ".proposal-cover-letter--director .proposal-cover-letter__contact-grid",
    );

    expect(phoneBlock?.textContent).toContain("@");
    expect(phoneBlock?.textContent).toContain("zoe@loi.com");
    expect(phoneBlock?.textContent).toContain("zoe.com");
    expect(phoneBlock?.textContent).not.toContain("T");
  });

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      headerSelector: ".proposal-cover-letter__masthead",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      headerSelector: ".proposal-cover-letter__volk-header",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
      headerSelector: ".proposal-cover-letter__film-header",
    },
  ])(
    "keeps the long generated subject out of short export title regions for $templateId",
    ({ templateId, scope, headerSelector }) => {
      const longSubject =
        "Application for the position of Security Guard Full Time Airport Unarmed at Us Smart Tools";
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            documentTitle: longSubject,
            documentMeta: "Security Guard",
            recipientDetails: "Hiring Manager\nSecurity Guard\nUs Smart Tools",
            applicantHeader: {
              name: "Robert Cooper",
              role: "Security Guard",
              email: "email@email.com",
              phone: "+3586853442",
              linkedin: "",
              website: "",
              location: "CA 90291 United States",
              tag: "",
            },
            body: [
              { type: "salutation", text: "Dear Hiring Manager," },
              { type: "paragraph", text: "I can support the team." },
            ],
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);
      const header = page?.querySelector(headerSelector);
      const metaRow = page?.querySelector(".proposal-cover-letter__meta-row");

      expect(countTextOccurrences(page?.textContent ?? "", longSubject)).toBe(1);
      expect(header?.textContent).not.toContain(longSubject);
      expect(metaRow?.textContent).not.toContain(longSubject);
      expect(page?.textContent).toContain("Security Guard");
      expect(page?.textContent).toContain("Us Smart Tools");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      secondarySelector: ".proposal-cover-letter__masthead-secondary",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      secondarySelector: ".proposal-cover-letter__volk-title--right",
    },
  ])(
    "renders applicant company as the optional exported letterhead title for $templateId",
    ({ templateId, scope, secondarySelector }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            recipientDetails: "Hiring Manager",
            applicantHeader: {
              ...proposalFixture.applicantHeader,
              name: "Robert Cooper",
              role: "Designer",
              company: "Cooper Studio",
              email: "email@email.com",
              phone: "",
              linkedin: "",
              website: "",
              location: "Los Angeles",
              tag: "",
            },
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);

      expect(page?.querySelector(secondarySelector)?.textContent).toBe(
        "Cooper Studio",
      );
      expect(page?.textContent).toContain("Designer");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
    },
  ])(
    "exports recipient postal contact details in the letterhead recipient block for $templateId",
    ({ templateId, scope }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            recipientDetails:
              "Hiring Manager\nTalent Acquisition\nCompany Name\nrecipient@example.com\nStreet address\nCompany City",
            documentTitle: "Subject line",
            applicantHeader: {
              ...proposalFixture.applicantHeader,
              name: "Robert Cooper",
              role: "Security Guard",
              company: "",
              email: "name@email.com",
              phone: "+321 08 98 43 23 43",
              linkedin: "LINKEDIN",
              website: "PORTFOLIO.COM",
              location: "",
              tag: "",
            },
            headerVisibility: {
              showSender: true,
              showDate: true,
              showSubject: true,
              showRecipient: true,
              showRecipientDetails: true,
            },
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);
      const recipientBlock = page?.querySelector(
        ".proposal-cover-letter__recipient-block",
      );
      const recipientSubjectStack = page?.querySelector(
        ".proposal-cover-letter__recipient-subject-stack",
      );
      const subjectRow = page?.querySelector(".proposal-cover-letter__subject-row");
      const subjectLabel = page?.querySelector(
        ".proposal-cover-letter__subject-label",
      );
      const metaItems = Array.from(
        page?.querySelectorAll(".proposal-cover-letter__meta-item") ?? [],
      ).map((node) => node.textContent);

      expect(page?.classList.contains("proposal-cover-letter--has-recipient-block"))
        .toBe(true);
      expect(recipientSubjectStack).toBeTruthy();
      expect(
        recipientSubjectStack?.querySelector(
          ".proposal-cover-letter__recipient-block",
        ),
      ).toBe(recipientBlock);
      expect(
        recipientSubjectStack?.querySelector(".proposal-cover-letter__subject-row"),
      ).toBe(subjectRow);
      expect(recipientBlock?.textContent).toContain("Street address");
      expect(recipientBlock?.textContent).toContain("Company City");
      expect(recipientBlock?.textContent).toContain("recipient@example.com");
      expect(recipientBlock?.textContent).not.toContain("Hiring Manager");
      expect(recipientBlock?.textContent).not.toContain("Company Name");
      expect(recipientBlock?.textContent).not.toContain("Talent Acquisition");
      expect(subjectLabel?.textContent).toBe(
        templateId === "film-foto-letterhead" ? "subject:" : "Subject:",
      );
      expect(metaItems).toEqual([
        "Hiring Manager",
        "Talent Acquisition",
        "Company Name",
        expect.stringContaining("15 avril 2026"),
      ]);
      expect(page?.textContent).not.toContain("undefined");
      expect(page?.textContent).not.toContain("null");
      expect(page?.textContent).not.toContain("[object Object]");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      secondarySelector: ".proposal-cover-letter__masthead-secondary",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      secondarySelector: ".proposal-cover-letter__volk-title--right",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
      secondarySelector: ".proposal-cover-letter__film-company",
    },
  ])(
    "does not export recipient fields as fallback applicant company titles for $templateId",
    ({ templateId, scope, secondarySelector }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            recipientDetails:
              "Hiring Manager\nTalent Acquisition\nUs Smart Tools\nrecipient@example.com\nStreet address\nParis",
            applicantHeader: {
              ...proposalFixture.applicantHeader,
              name: "Robert Cooper",
              role: "Security Guard",
              company: "",
              email: "email@email.com",
              phone: "",
              linkedin: "",
              website: "",
              location: "Los Angeles",
              tag: "",
            },
            headerVisibility: {
              showSender: true,
              showDate: true,
              showSubject: true,
              showRecipient: true,
              showRecipientDetails: true,
            },
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);

      expect(page?.querySelector(secondarySelector)).toBeNull();
      expect(page?.textContent).toContain("Security Guard");
      expect(page?.querySelector(".proposal-cover-letter__recipient-block")?.textContent)
        .toContain("recipient@example.com");
    },
  );

  it("keeps Film und Foto export metadata recipient-only and maps role left with name right", () => {
    const document = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "film-foto-letterhead",
          recipientDetails: "Hiring Manager\n\nUs Smart Tools\n\n\nParis",
          documentTitle: "Application for Security Guard",
          applicantHeader: {
            ...proposalFixture.applicantHeader,
            name: "Robert Cooper",
            role: "Security Guard",
            company: "Acme",
            email: "email@email.com",
            phone: "3868683442",
            linkedin: "linkedin.in",
            website: "portfolio.example.com",
            location: "Los Angeles",
            tag: "",
          },
        },
        stylePreset: {
          familyId: "workshop",
          layout: "workshop",
          typography: "expert",
          palette: "terre",
        },
      }),
    );
    const page = document.querySelector(".proposal-cover-letter--film-foto");
    const header = page?.querySelector(".proposal-cover-letter__film-header");
    const metaItems = Array.from(
      page?.querySelectorAll(".proposal-cover-letter__meta-item") ?? [],
    ).map((node) => node.textContent);

    expect(header?.querySelector(".proposal-cover-letter__film-heading")?.textContent).toBe(
      "Security Guard",
    );
    expect(header?.querySelector(".proposal-cover-letter__film-title")?.textContent).toBe(
      "Robert Cooper",
    );
    expect(header?.querySelector(".proposal-cover-letter__film-company")).toBeNull();
    expect(metaItems).toEqual([
      "Hiring Manager",
      "Us Smart Tools",
      "",
      expect.stringContaining("15 avril 2026"),
    ]);
    expect(
      page?.querySelector(".proposal-cover-letter__film-address-footer")
        ?.textContent,
    ).toBe("Los Angeles");
    const socialBlock = Array.from(
      page?.querySelectorAll(".proposal-cover-letter__info-blocks > div") ??
        [],
    ).find(
      (node) =>
        node.querySelector(".proposal-cover-letter__info-label")?.textContent ===
        "social",
    );
    const portfolioBlock = Array.from(
      page?.querySelectorAll(".proposal-cover-letter__info-blocks > div") ??
        [],
    ).find(
      (node) =>
        node.querySelector(".proposal-cover-letter__info-label")?.textContent ===
        "www",
    );
    expect(
      Array.from(socialBlock?.querySelectorAll("p") ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(["social", "linkedin.in"]);
    expect(
      Array.from(portfolioBlock?.querySelectorAll("p") ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(["www", "portfolio.example.com"]);
    expect(socialBlock?.textContent).not.toContain(" · ");
    expect(portfolioBlock?.textContent).not.toContain(" · ");
  });

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
      headerSelector: ".proposal-cover-letter__masthead",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
      headerSelector: ".proposal-cover-letter__volk-header",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
      headerSelector: ".proposal-cover-letter__film-header",
    },
  ])(
    "keeps full postal addresses out of the exported top title row for $templateId",
    ({ templateId, scope, headerSelector }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            contactLine:
              "email@email.com · 1515 Pacific Ave Los Angeles · CA 90291 United States",
            recipientDetails: "Hiring Manager",
            documentTitle: "Application for Security Guard",
            applicantHeader: {
              ...proposalFixture.applicantHeader,
              name: "Robert Cooper",
              role: "Security Guard",
              email: "",
              phone: "",
              linkedin: "",
              website: "",
              location: "",
              tag: "",
            },
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const page = document.querySelector(`.${scope}`);
      const header = page?.querySelector(headerSelector);

      expect(header?.textContent).not.toContain("1515 Pacific Ave");
      expect(header?.textContent).not.toContain("CA 90291");
      expect(header?.textContent).not.toContain("United States");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: "proposal-cover-letter--director",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: "proposal-cover-letter--volk",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: "proposal-cover-letter--film-foto",
    },
  ])(
    "keeps $templateId sender contacts de-duplicated during export",
    ({ templateId, scope }) => {
      const document = parseExportHtml(
        renderProposalStyledExportDocument({
          data: {
            ...proposalFixture,
            templateId,
            contactLine: "Letter · 09898777 · Paris · zoe.com",
            recipientDetails: "Abel Ferrarra\nCinema\nNew York",
            documentTitle: "Killer job",
            documentMeta: "Letter",
            applicantHeader: {
              name: "Zoe Lund",
              role: "Security Guard",
              email: "zoe@loi.com",
              phone: "09898777",
              linkedin: "",
              website: "zoe.com",
              location: "Paris",
              tag: "",
            },
          },
          stylePreset: {
            familyId: "workshop",
            layout: "workshop",
            typography: "expert",
            palette: "terre",
          },
        }),
      );
      const root = document.querySelector(`.${scope}`);
      const text = root?.textContent ?? "";

      expect(text).toContain("Zoe Lund");
      expect(text).toContain("zoe@loi.com");
      expect(text).toContain("09898777");
      expect(text).toContain("Paris");
      expect(text).toContain("zoe.com");
      expect(text).not.toContain("Letter");
      expect(countTextOccurrences(text, "09898777")).toBe(1);
      expect(countTextOccurrences(text, "Paris")).toBe(1);
      expect(countTextOccurrences(text, "zoe.com")).toBe(1);

      if (templateId === "film-foto-letterhead") {
        expect(
          root?.querySelector(".proposal-cover-letter__film-heading")
            ?.textContent,
        ).toBe("Security Guard");
        expect(
          root?.querySelector(".proposal-cover-letter__film-title")?.textContent,
        ).toBe("Zoe Lund");
      }
    },
  );

  it("scopes Arabic proposal export language direction to the generated document root", () => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";

    const arabicProposalFixture: ProposalPrintSource = {
      ...proposalFixture,
      locale: "ar",
      documentTitle: "طلب توظيف",
      documentMeta: "مهندس واجهة أمامية",
      contactLine: "alex@example.com",
      letterDate: "26 مايو 2026",
      recipientDetails: "فريق التوظيف",
      body: [
        {
          type: "salutation",
          text: "إلى فريق التوظيف،",
        },
        {
          type: "paragraph",
          text:
            "أعمل على بناء واجهات React وTypeScript قابلة للتوسع مع تركيز واضح على أنظمة التصميم وتحسين الأداء.",
        },
        {
          type: "closing",
          signOff: "مع خالص التحية،",
          signatureName: "Alex Martin",
        },
      ],
    };

    const arabicExportDocument = parseExportHtml(
      renderProposalAtsExportDocument(arabicProposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );

    expect(arabicExportDocument.documentElement.lang).toBe("ar");
    expect(arabicExportDocument.documentElement.dir).toBe("rtl");
    expect(getInlineStyles(arabicExportDocument)).toContain(
      'font-family:"Noto Kufi Arabic"',
    );
    expect(getInlineStyles(arabicExportDocument)).toContain(
      '--body-font: "Noto Kufi Arabic", "Noto Sans Arabic", "Noto Naskh Arabic", "Geeza Pro", Tahoma, Arial, sans-serif;',
    );
    expect(arabicExportDocument.body.textContent).toContain("طلب توظيف");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it.each([
    {
      locale: "ru",
      title: "Сопроводительное письмо",
      bodyText:
        "Я создаю масштабируемые интерфейсы React и TypeScript с акцентом на дизайн-системы и производительность.",
      fallbackStack: '"Noto Sans", "Segoe UI", Tahoma, Arial, sans-serif',
    },
    {
      locale: "el",
      title: "Συνοδευτική επιστολή",
      bodyText:
        "Δημιουργώ επεκτάσιμες διεπαφές React και TypeScript με έμφαση στα συστήματα σχεδιασμού.",
      fallbackStack: '"Noto Sans", "Segoe UI", Tahoma, Arial, sans-serif',
    },
    {
      locale: "ga",
      title: "Litir iarratais",
      bodyText:
        "Tógaim córais cháipéise iontaofa do tháirgí agus d'fhoirne oibríochtaí.",
      fallbackStack: '"Noto Sans", system-ui, sans-serif',
    },
    {
      locale: "pl",
      title: "List motywacyjny",
      bodyText:
        "Tworzę skalowalne interfejsy React i TypeScript z naciskiem na systemy projektowe i wydajność.",
      fallbackStack: '"Noto Sans", system-ui, sans-serif',
    },
  ])(
    "appends bundled Noto Sans fallback coverage for $locale proposal exports without exposing app RTL",
    ({ locale, title, bodyText, fallbackStack }) => {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";

      const localizedProposalFixture: ProposalPrintSource = {
        ...proposalFixture,
        locale,
        documentTitle: title,
        body: [
          {
            type: "paragraph",
            text: bodyText,
          },
        ],
      };

      const localizedExportDocument = parseExportHtml(
        renderProposalAtsExportDocument(localizedProposalFixture, {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
      );

      expect(localizedExportDocument.documentElement.lang).toBe(locale);
      expect(localizedExportDocument.documentElement.dir).toBe("ltr");
      expect(getInlineStyles(localizedExportDocument)).toContain(
        'font-family:"Noto Sans"',
      );
      expect(getInlineStyles(localizedExportDocument)).toContain(
        `--heading-font: Fraunces, Georgia, serif, ${fallbackStack};`,
      );
      expect(getInlineStyles(localizedExportDocument)).toContain(
        `--body-font: Syne, "Avenir Next", system-ui, sans-serif, ${fallbackStack};`,
      );
      expect(localizedExportDocument.body.textContent).toContain(title);
      expect(document.documentElement.lang).toBe("en");
      expect(document.documentElement.dir).toBe("ltr");
    },
  );

  it.each([
    { locale: "en" },
    { locale: "fr" },
  ])("preserves selected typography before Latin fallback fonts for $locale exports", ({ locale }) => {
    const localizedProposalFixture: ProposalPrintSource = {
      ...proposalFixture,
      locale,
    };

    const localizedExportDocument = parseExportHtml(
      renderProposalAtsExportDocument(localizedProposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );
    const css = getInlineStyles(localizedExportDocument);

    expect(localizedExportDocument.documentElement.lang).toBe(locale);
    expect(css).toContain('--heading-font: Fraunces, Georgia, serif, "Noto Sans", system-ui, sans-serif;');
    expect(css).toContain('--body-font: Syne, "Avenir Next", system-ui, sans-serif, "Noto Sans", system-ui, sans-serif;');
  });

  it("keeps ATS and styled proposal closing blocks structurally aligned and casing-safe", () => {
    const atsDocument = parseExportHtml(
      renderProposalAtsExportDocument(proposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );
    const styledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: proposalFixture,
        stylePreset: {
          layout: "modernist",
          typography: "quiet-editorial",
          palette: "encre",
        },
      }),
    );

    expect(getDataBlockOrder(styledDocument)).toEqual(getDataBlockOrder(atsDocument));
    expect(
      atsDocument.querySelector('[data-block="closing"] .proposal-signoff')
        ?.textContent,
    ).toBe("Cordialement !");
    expect(
      styledDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("alex mercer");
    expect(getInlineStyles(styledDocument)).toContain(
      "--decor-signature-color: var(--ink);",
    );
  });

  it("renders configured proposal signature fonts and image signatures", () => {
    const fontDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          signatureSettings: {
            mode: "font",
            fontId: "fd-garamond",
            imageDataUrl: null,
          },
        },
        stylePreset: {
          layout: "editorial",
          typography: "fd-garamond-geist",
          palette: "pierre",
        },
      }),
    );
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAHAQGByp7K7wAAAABJRU5ErkJggg==";
    const imageDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          signatureSettings: {
            mode: "image",
            fontId: null,
            imageDataUrl,
          },
        },
        stylePreset: {
          layout: "editorial",
          typography: "fd-garamond-geist",
          palette: "pierre",
        },
      }),
    );

    expect(
      fontDocument
        .querySelector('[data-block="closing"] .proposal-signature')
        ?.getAttribute("style"),
    ).toContain("FD Garamond");
    expect(
      imageDocument.querySelector('[data-block="closing"] .proposal-signature-image'),
    ).toBeNull();
    expect(
      imageDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("alex mercer");

    const stackedImageDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          body: proposalFixture.body.map((block) =>
            block.type === "closing"
              ? { ...block, handwrittenSignatureEnabled: true }
              : block,
          ),
          signatureSettings: {
            mode: "image",
            fontId: null,
            imageDataUrl,
          },
        },
        stylePreset: {
          layout: "editorial",
          typography: "fd-garamond-geist",
          palette: "pierre",
        },
      }),
    );
    expect(
      stackedImageDocument
        .querySelector('[data-block="closing"] .proposal-signature-image')
        ?.getAttribute("src"),
    ).toBe(imageDataUrl);
    expect(
      stackedImageDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("alex mercer");
  });

  it("builds resume and proposal DOCX exports as editable one-column documents with selected fonts", async () => {
    const resumeBuffer = await buildResumeDocxBuffer({
      data: resumeFixture,
      stylePreset: {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      },
    });
    const proposalBuffer = await buildProposalDocxBuffer({
      data: proposalFixture,
      stylePreset: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });

    const resumeArchive = await JSZip.loadAsync(resumeBuffer);
    const proposalArchive = await JSZip.loadAsync(proposalBuffer);
    const resumeDocumentXml =
      (await resumeArchive.file("word/document.xml")?.async("string")) ?? "";
    const resumeStylesXml =
      (await resumeArchive.file("word/styles.xml")?.async("string")) ?? "";
    const proposalDocumentXml =
      (await proposalArchive.file("word/document.xml")?.async("string")) ?? "";
    const proposalStylesXml =
      (await proposalArchive.file("word/styles.xml")?.async("string")) ?? "";

    expect(resumeDocumentXml).toContain("Alexandria Mercer-Delacroix");
    expect(resumeDocumentXml).toContain("Senior Product Design Systems and Content Operations Lead");
    expect(resumeDocumentXml).not.toContain("w:cols");
    expect(resumeDocumentXml).toContain("Fraunces");
    expect(resumeStylesXml).toContain("Syne");

    expect(proposalDocumentXml).toContain("Objet");
    expect(proposalDocumentXml).toContain("Bonjour");
    expect(proposalDocumentXml).toContain("Cordialement");
    expect(proposalDocumentXml).toContain("alex mercer");
    expect(proposalDocumentXml).not.toContain("ALEX MERCER");
    expect(proposalDocumentXml).not.toContain("w:cols");
    expect(proposalDocumentXml).toContain("Fraunces");
    expect(proposalStylesXml).toContain("Syne");
  });

  it("emits Arabic DOCX document language and RTL metadata for resume and proposal exports", async () => {
    const resumeXml = await readDocxMainXml(
      await buildResumeDocxBuffer({
        data: {
          ...resumeFixture,
          locale: "ar",
          profile: {
            ...resumeFixture.profile,
            name: "أحمد مرسي",
            title: "مصمم أنظمة منتجات",
            summary: "يبني أنظمة مستندات قابلة للتصدير.",
          },
        },
      }),
    );
    const proposalXml = await readDocxMainXml(
      await buildProposalDocxBuffer({
        data: {
          ...proposalFixture,
          locale: "ar",
          title: "خطاب تقديم",
          documentTitle: "طلب توظيف",
          body: [
            { type: "salutation", text: "مرحباً،" },
            {
              type: "paragraph",
              text: "أبني أنظمة مستندات دقيقة للتصدير.",
            },
            {
              type: "closing",
              signOff: "مع خالص التحية،",
              signatureName: "أحمد مرسي",
            },
          ],
        },
      }),
    );

    expectDocxLanguageMetadata({
      ...resumeXml,
      locale: "ar",
      rtl: true,
    });
    expectDocxLanguageMetadata({
      ...proposalXml,
      locale: "ar",
      rtl: true,
    });
  });

  it("emits LTR DOCX language metadata without RTL markers for Russian and Irish", async () => {
    for (const locale of ["ru", "ga"] as const) {
      const resumeXml = await readDocxMainXml(
        await buildResumeDocxBuffer({
          data: {
            ...resumeFixture,
            locale,
          },
        }),
      );
      const proposalXml = await readDocxMainXml(
        await buildProposalDocxBuffer({
          data: {
            ...proposalFixture,
            locale,
          },
        }),
      );

      expectDocxLanguageMetadata({
        ...resumeXml,
        locale,
        rtl: false,
      });
      expectDocxLanguageMetadata({
        ...proposalXml,
        locale,
        rtl: false,
      });
    }
  });

  it("preserves supported Styled typography presets and structural hooks across long-content fixtures", () => {
    const baselineResumeOrder = getDataBlockOrder(
      parseExportHtml(
        renderResumeAtsExportDocument(resumeFixture, {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
      ),
    );
    const baselineProposalOrder = getDataBlockOrder(
      parseExportHtml(
        renderProposalAtsExportDocument(proposalFixture, {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
      ),
    );
    const typographyCases = [
      {
        typography: "quiet-editorial" as const,
        headingFont: "Fraunces",
        bodyFont: "Syne",
      },
      {
        typography: "geist-baskervville" as const,
        headingFont: "Geist",
        bodyFont: "Baskervville",
      },
      {
        typography: "civic-correspondence" as const,
        headingFont: "Thestral Neue",
        bodyFont: "BioRhyme",
      },
      {
        typography: "ledger-sans" as const,
        headingFont: "Special Elite",
        bodyFont: "Courier Prime",
      },
    ];
    const longProposalFixture: ProposalPrintSource = {
      ...proposalFixture,
      templateId: "modernist_signal",
      documentTitle:
        "Candidature Senior Product Design Systems and Content Operations Lead",
      documentMeta:
        "Paris : coordination documentaire ; export long-format ; robustesse machine",
      contactLine:
        "alexandria.mercer.delacroix@example.com : +33 6 00 00 00 00 : portfolio.example.com/alexandria",
      recipientDetails:
        "Studio Nord Product Infrastructure and Editorial Systems Group : Paris\nEquipe produit et operations documentaires",
      body: [
        proposalFixture.body[0],
        {
          type: "paragraph",
          text:
            "Je structure des exports longs, des hierarchies documentaires et des parcours de lecture qui restent stables meme sous forte densite de contenu et sous plusieurs presets typographiques.",
        },
        proposalFixture.body[2],
      ],
    };

    typographyCases.forEach((preset) => {
      const styledResumeDocument = parseExportHtml(
        renderResumeStyledExportDocument({
          data: resumeFixture,
          stylePreset: {
            layout: "two-column",
            typography: preset.typography,
            palette: "pierre",
          },
        }),
      );
      const styledProposalDocument = parseExportHtml(
        renderProposalStyledExportDocument({
          data: longProposalFixture,
          stylePreset: {
            layout: "modernist",
            typography: preset.typography,
            palette: "encre",
          },
        }),
      );
      const resumeCss = getInlineStyles(styledResumeDocument);
      const proposalCss = getInlineStyles(styledProposalDocument);

      expect(getDataBlockOrder(styledResumeDocument).slice().sort()).toEqual(
        baselineResumeOrder.slice().sort(),
      );
      expect(getDataBlockOrder(styledProposalDocument)).toEqual(
        baselineProposalOrder,
      );
      expect(styledResumeDocument.body.className).toContain("resume-shell--split");
      expect(styledProposalDocument.body.className).toContain(
        "proposal-shell--rail",
      );
      expect(resumeCss).toContain(preset.headingFont);
      expect(resumeCss).toContain(preset.bodyFont);
      expect(proposalCss).toContain(preset.headingFont);
      expect(proposalCss).toContain(preset.bodyFont);
      expect(
        styledProposalDocument.querySelector('[data-block="closing"] .proposal-signature')
          ?.textContent,
      ).toBe("alex mercer");
      expect(resumeCss).toContain("fit-content(var(--flow-entry-meta-width))");
      expect(proposalCss).toContain(
        "fit-content(var(--flow-proposal-meta-width))",
      );
    });
  });

  it("renders workshop exports from committed planner pages without fresh repagination", () => {
    const currentCv = generateCvTemplate("Workshop export");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    };
    const experienceSection = currentCv.sections.find(
      (section) => section.type === "experience",
    );
    if (experienceSection?.structuredContent && Array.isArray(experienceSection.structuredContent)) {
      experienceSection.structuredContent = Array.from({ length: 7 }, (_, index) => ({
        ...(experienceSection.structuredContent[0] ?? {
          id: `exp-${index + 1}`,
          company: "",
          position: "",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          achievements: [],
        }),
        id: `exp-${index + 1}`,
        company: `Workshop Company ${index + 1}`,
        position: `Workshop Lead ${index + 1}`,
        startDate: "2023-01-01T00:00:00.000Z",
        isCurrent: false,
        currentlyWorking: false,
        responsibilities: Array.from({ length: 5 }, (__, bulletIndex) =>
          `Workshop export responsibility ${index + 1}.${bulletIndex + 1} with enough copy to create multiple committed pages.`,
        ).join("\n"),
        achievements: [],
      }));
    }

    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");

    const styledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: exportSource!,
        stylePreset: currentCv.metadata.verbatiStyle,
      }),
    );
    const styledCss = getInlineStyles(styledDocument);
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(
        exportSource!,
        currentCv.metadata.verbatiStyle,
      ),
    );
    const atsCss = getInlineStyles(atsDocument);
    const workshopTemplate = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const expectedEntryMetaWidthMm =
      workshopTemplate.export.mainMm - workshopTemplate.export.readingWidthMm;
    const expectedBulletsPaddingMm =
      workshopTemplate.preview.experienceBulletsPaddingLeftMm;

    expect(styledDocument.body.className).toContain("resume-layout--workshop");
    expect(styledDocument.querySelectorAll(".export-page")).toHaveLength(
      exportSource?.committedPages?.length ?? 0,
    );
    expect(atsDocument.querySelectorAll(".export-page")).toHaveLength(
      exportSource?.committedPages?.length ?? 0,
    );
    expect(
      styledDocument.querySelector(
        '[data-resume-template="workshop_resume_onecol_ats"]',
      ),
    ).toBeTruthy();
    expect(styledCss).toContain(
      `--flow-entry-meta-width: ${expectedEntryMetaWidthMm}mm;`,
    );
    expect(styledCss).toContain(
      `--flow-list-indent: ${expectedBulletsPaddingMm}mm;`,
    );
    expect(styledCss).toContain(
      `--experience-bullets-padding: ${expectedBulletsPaddingMm}mm;`,
    );
    expect(atsCss).toContain(
      `--flow-entry-meta-width: ${expectedEntryMetaWidthMm}mm;`,
    );
    expect(atsCss).toContain(
      `--flow-list-indent: ${expectedBulletsPaddingMm}mm;`,
    );
    expect(atsCss).toContain(
      `--experience-bullets-padding: ${expectedBulletsPaddingMm}mm;`,
    );
    expect(styledCss).toContain(".entry-headline {");
    expect(styledCss).toContain(".entry-continuation {");
    expect(styledCss).toContain(".bullet-list {");
    expect(styledCss).toContain("padding: 0 0 0 var(--flow-list-indent);");
    expect(atsCss).toContain(".entry-headline {");
    expect(atsCss).toContain(".entry-continuation {");
    expect(atsCss).toContain(".bullet-list {");
    expect(atsCss).toContain("padding: 0 0 0 var(--flow-list-indent);");
    expect(styledDocument.querySelector(".entry-headline")).toBeTruthy();
    expect(atsDocument.querySelector(".entry-headline")).toBeTruthy();
    expect(styledDocument.querySelector(".workshop-export-header")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__identity")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__contact")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__metadata")).toBeNull();
    expect(styledDocument.querySelector(".resume-styled-page--workshop")).toBeNull();
  });

  it("renders the two-column workshop styled PDF shell from committed pages", () => {
    const currentCv = generateCvTemplate("Workshop two-column export");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
      resumeTemplateId: "workshop_resume_twocol_ats",
    };

    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });

    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_twocol_ats");
    const styledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: exportSource!,
        stylePreset: currentCv.metadata.verbatiStyle,
      }),
    );
    const styledCss = getInlineStyles(styledDocument);

    expect(
      styledDocument.querySelector('[data-resume-template="workshop_resume_twocol_ats"]'),
    ).toBeTruthy();
    expect(styledDocument.querySelector(".resume-styled-page--workshop-twocol")).toBeTruthy();
    expect(styledDocument.querySelector(".resume-workshop-twocol-sidebar")).toBeTruthy();
    expect(styledDocument.querySelector(".resume-workshop-twocol-main")).toBeTruthy();
    expect(styledCss).toContain("--page-gutter: 12mm;");
    expect(styledCss).toContain("--page-sidebar: 45mm;");
    expect(styledCss).toContain("--page-main: 100mm;");

    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(exportSource!, currentCv.metadata.verbatiStyle),
    );
    expect(atsDocument.querySelector(".resume-styled-page--workshop-twocol")).toBeNull();
    expect(atsDocument.querySelector(".robial-body")).toBeNull();
    expect(atsDocument.querySelector(".resume-main-stack")).toBeTruthy();
  });

  it("places two-column workshop export fragments by committed lane before kind fallback", () => {
    const currentCv = generateCvTemplate("Workshop two-column export lane");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
      resumeTemplateId: "workshop_resume_twocol_ats",
    };
    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const firstPage = exportSource?.committedPages?.[0];
    expect(firstPage).toBeTruthy();
    const laneForcedSource = {
      ...exportSource!,
      committedPages: [
        {
          ...firstPage!,
          fragments: [
            ...firstPage!.fragments,
            {
              fragmentId: "test-cert-main-lane",
              kind: "certifications" as const,
              lane: "main" as const,
              sectionType: "certifications" as const,
              sectionId: "certifications-test",
              title: "Certifications",
              continued: false,
              items: [
                {
                  id: "cert-main-lane",
                  name: "Detailed Architecture Certification",
                  issuer: "Credential Board",
                  meta: "License ABC-123",
                },
              ],
            },
          ],
        },
        {
          pageId: "test-page-2-no-header",
          index: 1,
          estimatedHeight: 12,
          fragments: [
            {
              fragmentId: "test-skill-sidebar-lane",
              kind: "skills" as const,
              lane: "sidebar" as const,
              sectionType: "skills" as const,
              sectionId: "skills-test",
              title: "Skills",
              continued: false,
              items: [{ id: "skill-sidebar-lane", name: "React" }],
            },
          ],
        },
      ],
    };

    const styledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: laneForcedSource,
        stylePreset: currentCv.metadata.verbatiStyle,
      }),
    );

    expect(
      styledDocument.querySelector(
        '.resume-workshop-twocol-main [data-export-item-id="cert-main-lane"]',
      ),
    ).toBeTruthy();
    expect(
      styledDocument.querySelector(
        '.resume-workshop-twocol-sidebar [data-export-item-id="cert-main-lane"]',
      ),
    ).toBeNull();
    const continuationPage = styledDocument.querySelector(
      '[data-export-page-id="test-page-2-no-header"]',
    );
    expect(continuationPage?.querySelector(".resume-workshop-twocol-header")).toBeNull();
    expect(
      continuationPage?.querySelector(
        ".resume-workshop-twocol-sidebar .section--skills",
      ),
    ).toBeTruthy();
  });

  it("renders the dense first workshop experience entry intact in export output when the committed planner no longer splits it", () => {
    const workshopStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plannerData = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      skillItems: [],
      languages: [],
      education: [],
      achievements: [],
      achievementItems: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      projects: [],
      textSections: [],
      summary: Array.from({ length: 30 }, (_, index) => `summary-${index + 1}`).join(" "),
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-1",
          role: "1",
          description: makeDenseTokenBlock("1", 40),
          bullets: [],
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-2",
          role: "2",
          description: makeDenseTokenBlock("2", 8),
          bullets: [],
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-3",
          role: "3",
          description: makeDenseTokenBlock("3", 8),
          bullets: [],
        },
      ],
    };
    const planner = planWorkshopResumePages({
      data: plannerData,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset: workshopStyle,
    });
    const exportSource: ResumePrintSource = {
      ...resumeFixture,
      title: plannerData.name,
      profile: {
        name: plannerData.name,
        title: plannerData.title,
        summary: plannerData.summary,
      },
      contact: plannerData.contact.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      metadata: plannerData.metadata.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      skills: [],
      languages: [],
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      hobbies: [],
      resumeTemplateId: "workshop_resume_onecol_ats",
      committedPages: planner.committedPages,
    };
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(
        exportSource!,
        workshopStyle,
      ),
    );

    expect(
      exportSource?.committedPages
        ?.flatMap((page) => page.fragments)
        .filter((fragment) => fragment.kind === "experience")
        .flatMap((fragment) => fragment.items)
        .filter((item) => item.id === "exp-dense-1").length,
    ).toBe(1);
    expect(
      atsDocument.querySelectorAll('[data-export-item-id="exp-dense-1"]').length,
    ).toBe(1);
    expect(
      atsDocument.querySelector('[data-export-item-id="exp-dense-1"] .entry-continuation'),
    ).toBeNull();
    expect(
      atsDocument.querySelector('[data-export-item-id="exp-dense-1"] .entry-title')?.textContent,
    ).toBe("1");
    expect(
      atsDocument.querySelectorAll('[data-export-item-id="exp-dense-2"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(atsDocument.body.textContent).toContain("2");
  });

  it("renders workshop experience rich responsibilities from committedPages for paragraph, bullet, and mixed cases", () => {
    const workshopStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plannerData = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      skillItems: [],
      languages: [],
      education: [],
      achievements: [],
      achievementItems: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      projects: [],
      textSections: [],
      summary: "Compact summary.",
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-export-rich-paragraph",
          description: "",
          bullets: [],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [
                  { text: "Directed the " },
                  { text: "migration roadmap", bold: true },
                  { text: " across three squads." },
                ],
              },
            ],
          },
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-export-rich-bullets",
          description: "",
          bullets: [],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "bullet_list" as const,
                items: [
                  {
                    runs: [
                      { text: "Reduced " },
                      { text: "rollback incidents", italic: true },
                      { text: " by 38%." },
                    ],
                  },
                  {
                    runs: [
                      { text: "Formalized " },
                      { text: "launch checklists", underline: true },
                      { text: " across squads." },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-export-rich-mixed",
          description: "",
          bullets: [],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [{ text: "Led the release migration." }],
              },
              {
                kind: "bullet_list" as const,
                items: [
                  {
                    runs: [
                      { text: "Coordinated " },
                      { text: "cross-team launch", bold: true },
                      { text: " execution." },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const committedPages = planWorkshopResumePages({
      data: plannerData,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset: workshopStyle,
    }).committedPages;
    const exportSource: ResumePrintSource = {
      ...resumeFixture,
      title: plannerData.name,
      profile: {
        name: plannerData.name,
        title: plannerData.title,
        summary: plannerData.summary,
      },
      contact: plannerData.contact.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      metadata: plannerData.metadata.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      skills: [],
      languages: [],
      experience: [
        {
          role: "Fallback",
          company: "Should Not Render",
          period: "",
          location: "",
          summary: "Fallback summary should not render.",
          bullets: ["Fallback bullet should not render."],
        },
      ],
      projects: [],
      education: [],
      achievements: [],
      hobbies: [],
      resumeTemplateId: "workshop_resume_onecol_ats",
      committedPages,
    };
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(exportSource, workshopStyle),
    );

    const paragraphItem = atsDocument.querySelector(
      '[data-export-item-id="exp-export-rich-paragraph"]',
    );
    const bulletItem = atsDocument.querySelector(
      '[data-export-item-id="exp-export-rich-bullets"]',
    );
    const mixedItem = atsDocument.querySelector(
      '[data-export-item-id="exp-export-rich-mixed"]',
    );

    expect(paragraphItem?.querySelector("p.entry-summary")?.textContent).toBe(
      "Directed the migration roadmap across three squads.",
    );
    expect(paragraphItem?.querySelector("strong")?.textContent).toBe(
      "migration roadmap",
    );
    expect(bulletItem?.querySelectorAll("li")).toHaveLength(2);
    expect(bulletItem?.querySelector("em")?.textContent).toBe("rollback incidents");
    expect(bulletItem?.querySelector("u")?.textContent).toBe("launch checklists");
    expect(mixedItem?.querySelectorAll("p.entry-summary")).toHaveLength(1);
    expect(mixedItem?.querySelectorAll("li")).toHaveLength(1);
    expect(mixedItem?.querySelector("strong")?.textContent).toBe("cross-team launch");
    expect(atsDocument.body.textContent).not.toContain("Fallback summary should not render.");
    expect(atsDocument.body.textContent).not.toContain("Fallback bullet should not render.");
  });

  it("falls back to committed flat experience blocks for continued workshop fragments", () => {
    const workshopStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const secondSegment = Array.from(
      { length: 160 },
      (_, index) => `continued-export-${index + 1}`,
    ).join(" ");
    const continuedBullet = Array.from(
      { length: 40 },
      (_, index) => `continued-bullet-${index + 1}`,
    ).join(" ");
    const plannerData = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      skillItems: [],
      languages: [],
      education: [],
      achievements: [],
      achievementItems: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      projects: [],
      textSections: [],
      summary: Array.from({ length: 26 }, (_, index) => `summary-${index + 1}`).join(" "),
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-export-continued",
          description: `intro intro intro intro\n\n${secondSegment}`,
          bullets: [continuedBullet],
          responsibilitiesRich: {
            blocks: [
              {
                kind: "paragraph" as const,
                runs: [
                  { text: "intro intro intro intro " },
                  { text: secondSegment, bold: true },
                ],
              },
              {
                kind: "bullet_list" as const,
                items: [
                  {
                    runs: [{ text: continuedBullet, italic: true }],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const committedPages = planWorkshopResumePages({
      data: plannerData,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset: workshopStyle,
    }).committedPages;
    const exportSource: ResumePrintSource = {
      ...resumeFixture,
      title: plannerData.name,
      profile: {
        name: plannerData.name,
        title: plannerData.title,
        summary: plannerData.summary,
      },
      contact: plannerData.contact.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      metadata: plannerData.metadata.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      skills: [],
      languages: [],
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      hobbies: [],
      resumeTemplateId: "workshop_resume_onecol_ats",
      committedPages,
    };
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(exportSource, workshopStyle),
    );
    const continuedItem = Array.from(
      atsDocument.querySelectorAll('[data-export-item-id="exp-export-continued"]'),
    ).find((node) => node.querySelector(".entry-continuation"));

    expect(continuedItem).toBeTruthy();
    expect(continuedItem?.querySelector("strong")).toBeNull();
    expect(continuedItem?.querySelector("em")).toBeNull();
    expect(continuedItem?.textContent).toContain("continued-bullet-1");
    expect(continuedItem?.querySelector("li")).toBeTruthy();
  });

  it("renders workshop languages and hobbies as the same compact list family while keeping skills as tags", () => {
    const workshopStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plannerData = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      achievementItems: [],
      certifications: [],
      affiliations: [],
      textSections: [],
      skillItems: resumeMock.skillItems.slice(0, 2),
      skills: resumeMock.skills.slice(0, 2),
      languages: resumeMock.languages.slice(0, 2),
      hobbyItems: resumeMock.hobbyItems.slice(0, 2),
      hobbies: resumeMock.hobbies.slice(0, 2),
    };
    const planner = planWorkshopResumePages({
      data: plannerData,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset: workshopStyle,
    });
    const exportSource: ResumePrintSource = {
      ...resumeFixture,
      title: plannerData.name,
      profile: {
        name: plannerData.name,
        title: plannerData.title,
        summary: plannerData.summary,
      },
      contact: plannerData.contact.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      metadata: plannerData.metadata.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      skills: plannerData.skills,
      languages: plannerData.languages.map((item) => ({
        name: item.name,
        level: item.level,
      })),
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      hobbies: plannerData.hobbies,
      resumeTemplateId: "workshop_resume_onecol_ats",
      committedPages: planner.committedPages,
    };
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(exportSource, workshopStyle),
    );
    const atsCss = getInlineStyles(atsDocument);

    expect(atsCss).toContain(".compact-list {");
    expect(atsCss).toContain(".compact-list li {");
    expect(atsCss).toContain("font-size: var(--flow-body-sm-size);");
    expect(
      atsDocument.querySelectorAll(".section--skills .tag-list .tag"),
    ).toHaveLength(2);
    expect(
      atsDocument.querySelector(".section--skills .compact-list"),
    ).toBeNull();
    expect(
      atsDocument.querySelectorAll(".section--languages .compact-list li"),
    ).toHaveLength(2);
    expect(
      atsDocument.querySelector(".section--languages .tag-list"),
    ).toBeNull();
    expect(
      atsDocument.querySelectorAll(".section--interests .compact-list li"),
    ).toHaveLength(2);
    expect(
      atsDocument.querySelector(".section--interests .tag-list"),
    ).toBeNull();
  });

  it("renders degree, field of study, grade, school, and period in workshop education export output", () => {
    const currentCv = generateCvTemplate("Workshop education export");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    };
    const educationSection = currentCv.sections.find(
      (section) => section.type === "education",
    );
    if (educationSection?.structuredContent && Array.isArray(educationSection.structuredContent)) {
      educationSection.structuredContent = [
        {
          ...(educationSection.structuredContent[0] ?? {
            id: "edu-export-1",
            institution: "",
            degree: "",
            isCurrent: false,
          }),
          id: "edu-export-1",
          institution: "Northbridge University",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          grade: "3.9 GPA",
          startDate: "2016-01-01T00:00:00.000Z",
          endDate: "2020-01-01T00:00:00.000Z",
          startDatePrecision: "year",
          endDatePrecision: "year",
          isCurrent: false,
        },
      ];
    }

    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });

    expect(exportSource?.education[0]).toEqual({
      degree: "Bachelor of Science",
      fieldOfStudy: "Computer Science",
      grade: "3.9 GPA",
      school: "Northbridge University",
      period: "2016 — 2020",
    });

    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(exportSource!, currentCv.metadata.verbatiStyle!),
    );
    const educationEntry = atsDocument.querySelector(".section--education .entry--education");

    expect(educationEntry?.querySelector(".entry-title")?.textContent).toBe(
      "Bachelor of Science, Computer Science",
    );
    expect(educationEntry?.querySelector(".entry-summary")?.textContent).toBe(
      "Northbridge University · Grade: 3.9 GPA",
    );
    expect(educationEntry?.querySelector(".entry-meta")?.textContent).toBe("2016 — 2020");
  });

  it("fails closed when workshop export pages are missing", () => {
    expect(() =>
      renderResumeStyledExportDocument({
        data: {
          ...resumeFixture,
          resumeTemplateId: "workshop_resume_onecol_ats",
        },
        stylePreset: {
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          familyId: "workshop",
        },
      }),
    ).toThrow(/committed workshop export pages/i);
  });

});
