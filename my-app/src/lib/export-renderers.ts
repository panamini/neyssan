import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

import {
  DEFAULT_VERBATI_STYLE,
  getVerbatiTypographyFamilies,
  resolveVerbatiAccentHex,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import type {
  ProposalPrintBlock,
  ProposalPrintSource,
  ResumePrintItem,
  ResumePrintSource,
} from "./document-export-models";
import { ROBIAL_EXPORT_GRID } from "./layout/robialGrid";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function joinClassNames(values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function normalizeStylePreset(
  stylePreset?: VerbatiStylePreset | null,
): VerbatiStylePreset {
  return resolveVerbatiStyle(stylePreset ?? DEFAULT_VERBATI_STYLE);
}

function buildPageCss(stylePreset?: VerbatiStylePreset | null): string {
  const resolvedStyle = normalizeStylePreset(stylePreset);
  const accent = resolveVerbatiAccentHex(resolvedStyle);
  const fonts = getVerbatiTypographyFamilies(resolvedStyle);

  return `
    :root {
      --page-width: ${ROBIAL_EXPORT_GRID.page.size.width};
      --page-height: ${ROBIAL_EXPORT_GRID.page.size.height};
      --page-margin-top: ${ROBIAL_EXPORT_GRID.page.margins.top};
      --page-margin-right: ${ROBIAL_EXPORT_GRID.page.margins.right};
      --page-margin-bottom: ${ROBIAL_EXPORT_GRID.page.margins.bottom};
      --page-margin-left: ${ROBIAL_EXPORT_GRID.page.margins.left};
      --page-sidebar: ${ROBIAL_EXPORT_GRID.page.columns.sidebar};
      --page-gutter: ${ROBIAL_EXPORT_GRID.page.columns.gutter};
      --page-main: ${ROBIAL_EXPORT_GRID.page.columns.main};
      --accent: ${accent};
      --ink: #1f1d1a;
      --muted: #5f594f;
      --line: rgba(31, 29, 26, 0.16);
      --soft: rgba(31, 29, 26, 0.06);
      --paper: #fffdfa;
      --sidebar-soft: rgba(31, 29, 26, 0.03);
      --heading-font: ${fonts.headingFamily}, "Times New Roman", Georgia, serif;
      --body-font: ${fonts.bodyFamily}, "Helvetica Neue", Arial, sans-serif;
    }

    @page {
      size: A4;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: white;
      color: var(--ink);
      font-family: var(--body-font);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 10pt;
      line-height: 1.45;
    }

    .export-page {
      width: var(--page-width);
      min-height: var(--page-height);
      padding:
        var(--page-margin-top)
        var(--page-margin-right)
        var(--page-margin-bottom)
        var(--page-margin-left);
      background: var(--paper);
      page-break-after: always;
    }

    .export-page:last-child {
      page-break-after: auto;
    }

    .robial-header {
      display: grid;
      grid-template-columns: var(--page-sidebar) var(--page-gutter) var(--page-main);
      gap: 0;
      margin-bottom: 17mm;
      align-items: start;
    }

    .robial-header__full {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }

    .robial-body {
      display: grid;
      grid-template-columns: var(--page-sidebar) var(--page-gutter) var(--page-main);
      gap: 0;
      align-items: start;
    }

    .robial-sidebar {
      grid-column: 1;
      min-width: 0;
    }

    .robial-main {
      grid-column: 3;
      min-width: 0;
    }

    .doc-name {
      font-family: var(--heading-font);
      font-size: 22pt;
      line-height: 1.06;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .doc-title {
      margin: 0;
      font-size: 11pt;
      line-height: 1.25;
      color: var(--muted);
    }

    .doc-summary {
      margin: 0;
      max-width: 105mm;
      font-size: 10pt;
      line-height: 1.5;
    }

    .section {
      margin-bottom: 8.5mm;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      margin: 0 0 3mm;
      font-family: var(--heading-font);
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--muted);
    }

    .rule {
      border-top: 0.4mm solid var(--line);
      padding-top: 2.4mm;
    }

    .meta-list,
    .tag-list {
      display: flex;
      flex-direction: column;
      gap: 1.8mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .meta-label {
      display: block;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 0.8mm;
    }

    .meta-value {
      font-size: 9pt;
      line-height: 1.35;
    }

    .tag {
      display: inline-block;
      padding: 1.1mm 1.8mm;
      border: 0.3mm solid var(--line);
      border-radius: 999px;
      font-size: 8pt;
      line-height: 1.2;
      margin: 0 1.2mm 1.2mm 0;
    }

    .entry {
      margin-bottom: 4.8mm;
    }

    .entry:last-child {
      margin-bottom: 0;
    }

    .entry-head {
      display: flex;
      justify-content: space-between;
      gap: 4mm;
      align-items: baseline;
      margin-bottom: 1.2mm;
    }

    .entry-title {
      margin: 0;
      font-size: 10.5pt;
      line-height: 1.3;
      font-weight: 700;
    }

    .entry-meta {
      margin: 0;
      font-size: 8.5pt;
      line-height: 1.25;
      color: var(--muted);
      text-align: right;
      white-space: pre-wrap;
    }

    .entry-summary {
      margin: 0 0 1.4mm;
      font-size: 9.3pt;
      line-height: 1.45;
    }

    .bullet-list {
      margin: 0;
      padding-left: 4mm;
    }

    .bullet-list li {
      margin: 0 0 1.1mm;
    }

    .bullet-list li:last-child {
      margin-bottom: 0;
    }

    .proposal-topline {
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      align-items: flex-start;
    }

    .proposal-title {
      margin: 0;
      font-family: var(--heading-font);
      font-size: 17pt;
      line-height: 1.14;
      font-weight: 700;
    }

    .proposal-meta {
      margin: 0;
      font-size: 9pt;
      color: var(--muted);
    }

    .proposal-block {
      margin: 0 0 4.4mm;
      font-size: 10pt;
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .proposal-block:last-child {
      margin-bottom: 0;
    }

    .proposal-closing {
      margin-top: 7mm;
    }

    .proposal-signoff,
    .proposal-signature {
      margin: 0;
      white-space: pre-wrap;
    }

    .resume--styled .robial-sidebar,
    .proposal--styled .robial-sidebar {
      padding: 4mm 3mm 4mm 0;
      border-top: 0.7mm solid var(--accent);
    }

    .resume--styled .section-title,
    .proposal--styled .section-title {
      color: var(--accent);
    }

    .resume--styled .doc-name,
    .proposal--styled .proposal-title {
      color: var(--accent);
    }

    .resume--styled.layout-editorial .robial-main,
    .proposal--styled.layout-editorial .robial-main {
      border-left: 0.6mm solid var(--soft);
      padding-left: 5mm;
    }

    .resume--styled.layout-modernist .robial-sidebar,
    .proposal--styled.layout-modernist .robial-sidebar {
      background: linear-gradient(
        180deg,
        rgba(31, 29, 26, 0.05),
        rgba(31, 29, 26, 0)
      );
      padding: 4mm 3mm 5mm 2.5mm;
    }

    .resume--styled.layout-volk-register .robial-header__full,
    .proposal--styled.layout-volk-register .robial-header__full {
      border-bottom: 0.35mm solid var(--line);
      padding-bottom: 4mm;
    }

    .resume--styled.layout-two-column .tag,
    .proposal--styled.layout-two-column .tag {
      background: rgba(31, 29, 26, 0.03);
    }
  `;
}

function buildHtmlDocument(args: {
  title: string;
  bodyClassName: string;
  bodyMarkup: string;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(args.title)}</title>
    <style>${buildPageCss(args.stylePreset)}</style>
  </head>
  <body class="${escapeHtml(args.bodyClassName)}">
    ${args.bodyMarkup}
  </body>
</html>`;
}

function renderResumeItems(items: ResumePrintItem[]): string {
  if (items.length === 0) {
    return "";
  }

  return `<ul class="meta-list">${items
    .map(
      (item) => `<li>
        <span class="meta-label">${escapeHtml(item.label)}</span>
        <span class="meta-value">${escapeHtml(item.value)}</span>
      </li>`,
    )
    .join("")}</ul>`;
}

function renderResumeTagList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  return `<div class="tag-list">${values
    .map((value) => `<span class="tag">${escapeHtml(value)}</span>`)
    .join("")}</div>`;
}

function renderResumeHtml(args: {
  data: ResumePrintSource;
  mode: "ats" | "styled";
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const stylePreset = normalizeStylePreset(args.stylePreset);
  const sidebarSections = [
    args.data.contact.length > 0
      ? `<section class="section rule">
          <h2 class="section-title">Contact</h2>
          ${renderResumeItems(args.data.contact)}
        </section>`
      : "",
    args.data.metadata.length > 0
      ? `<section class="section rule">
          <h2 class="section-title">Details</h2>
          ${renderResumeItems(args.data.metadata)}
        </section>`
      : "",
    args.data.skills.length > 0
      ? `<section class="section rule">
          <h2 class="section-title">Skills</h2>
          ${renderResumeTagList(args.data.skills)}
        </section>`
      : "",
    args.data.languages.length > 0
      ? `<section class="section rule">
          <h2 class="section-title">Languages</h2>
          ${renderResumeItems(
            args.data.languages.map((item) => ({
              label: item.name,
              value: item.level || "Working proficiency",
            })),
          )}
        </section>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const mainSections = [
    args.data.experience.length > 0
      ? `<section class="section">
          <h2 class="section-title">Experience</h2>
          ${args.data.experience
            .map(
              (item) => `<article class="entry">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(
                    [item.role, item.company].filter(Boolean).join(" · "),
                  )}</h3>
                  <p class="entry-meta">${escapeHtml(
                    [item.period, item.location].filter(Boolean).join("\n"),
                  )}</p>
                </div>
                ${item.summary ? `<p class="entry-summary">${escapeHtml(item.summary)}</p>` : ""}
                ${
                  item.bullets.length > 0
                    ? `<ul class="bullet-list">${item.bullets
                        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
                        .join("")}</ul>`
                    : ""
                }
              </article>`,
            )
            .join("")}
        </section>`
      : "",
    args.data.projects.length > 0
      ? `<section class="section">
          <h2 class="section-title">Projects</h2>
          ${args.data.projects
            .map(
              (item) => `<article class="entry">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(item.name)}</h3>
                  <p class="entry-meta">${escapeHtml(item.meta)}</p>
                </div>
                <p class="entry-summary">${escapeHtml(item.description)}</p>
              </article>`,
            )
            .join("")}
        </section>`
      : "",
    args.data.education.length > 0
      ? `<section class="section">
          <h2 class="section-title">Education</h2>
          ${args.data.education
            .map(
              (item) => `<article class="entry">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(item.degree)}</h3>
                  <p class="entry-meta">${escapeHtml(item.period)}</p>
                </div>
                <p class="entry-summary">${escapeHtml(item.school)}</p>
              </article>`,
            )
            .join("")}
        </section>`
      : "",
    args.data.achievements.length > 0
      ? `<section class="section">
          <h2 class="section-title">Achievements</h2>
          <ul class="bullet-list">${args.data.achievements
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>
        </section>`
      : "",
    args.data.hobbies.length > 0
      ? `<section class="section">
          <h2 class="section-title">Interests</h2>
          <p class="entry-summary">${escapeHtml(args.data.hobbies.join(" · "))}</p>
        </section>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return buildHtmlDocument({
    title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
    bodyClassName: joinClassNames([
      "resume-export",
      `resume--${args.mode}`,
      args.mode === "styled" ? `layout-${stylePreset.layout}` : "",
    ]),
    stylePreset: args.mode === "styled" ? stylePreset : undefined,
    bodyMarkup: `<main class="export-page">
      <header class="robial-header">
        <div class="robial-header__full">
          <h1 class="doc-name">${escapeHtml(args.data.profile.name)}</h1>
          ${
            args.data.profile.title
              ? `<p class="doc-title">${escapeHtml(args.data.profile.title)}</p>`
              : ""
          }
          ${
            args.data.profile.summary
              ? `<p class="doc-summary">${escapeHtml(args.data.profile.summary)}</p>`
              : ""
          }
        </div>
      </header>
      <section class="robial-body">
        <aside class="robial-sidebar">${sidebarSections}</aside>
        <section class="robial-main">${mainSections}</section>
      </section>
    </main>`,
  });
}

function renderProposalBlocks(blocks: ProposalPrintBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "closing") {
        return `<div class="proposal-block proposal-closing">
          ${block.signOff ? `<p class="proposal-signoff">${escapeHtml(block.signOff)}</p>` : ""}
          ${
            block.signatureName
              ? `<p class="proposal-signature">${escapeHtml(block.signatureName)}</p>`
              : ""
          }
        </div>`;
      }

      return `<p class="proposal-block">${escapeHtml(block.text)}</p>`;
    })
    .join("");
}

function renderProposalHeader(source: ProposalPrintSource): string {
  const recipientLines = source.recipientDetails
    ? source.recipientDetails
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return `
    <header class="robial-header">
      <div class="robial-header__full">
        <div class="proposal-topline">
          <div>
            <h1 class="proposal-title">${escapeHtml(source.documentTitle)}</h1>
            ${
              source.documentMeta
                ? `<p class="proposal-meta">${escapeHtml(source.documentMeta)}</p>`
                : ""
            }
          </div>
          ${
            source.headerVisibility.showDate && source.letterDate
              ? `<p class="proposal-meta">${escapeHtml(source.letterDate)}</p>`
              : ""
          }
        </div>
      </div>
    </header>
    <section class="robial-body">
      <aside class="robial-sidebar">
        ${
          source.headerVisibility.showSender
            ? `<section class="section rule">
                <h2 class="section-title">Sender</h2>
                <ul class="meta-list">
                  ${
                    source.applicantHeader.name
                      ? `<li><span class="meta-value">${escapeHtml(source.applicantHeader.name)}</span></li>`
                      : ""
                  }
                  ${
                    source.applicantHeader.role
                      ? `<li><span class="meta-value">${escapeHtml(source.applicantHeader.role)}</span></li>`
                      : ""
                  }
                  ${
                    source.contactLine
                      ? `<li><span class="meta-value">${escapeHtml(source.contactLine)}</span></li>`
                      : ""
                  }
                </ul>
              </section>`
            : ""
        }
        ${
          source.headerVisibility.showRecipient && recipientLines.length > 0
            ? `<section class="section rule">
                <h2 class="section-title">Recipient</h2>
                <ul class="meta-list">
                  ${recipientLines
                    .map((line) => `<li><span class="meta-value">${escapeHtml(line)}</span></li>`)
                    .join("")}
                </ul>
              </section>`
            : ""
        }
      </aside>
      <section class="robial-main">
        ${
          source.headerVisibility.showSubject
            ? `<section class="section">
                <h2 class="section-title">Subject</h2>
                <p class="proposal-block">${escapeHtml(source.documentTitle)}</p>
              </section>`
            : ""
        }
        <section class="section">
          ${renderProposalBlocks(source.body)}
        </section>
      </section>
    </section>
  `;
}

function renderProposalHtml(args: {
  data: ProposalPrintSource;
  mode: "ats" | "styled";
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const stylePreset = normalizeStylePreset(args.stylePreset);

  return buildHtmlDocument({
    title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
    bodyClassName: joinClassNames([
      "proposal-export",
      `proposal--${args.mode}`,
      args.mode === "styled" ? `layout-${stylePreset.layout}` : "",
    ]),
    stylePreset: args.mode === "styled" ? stylePreset : undefined,
    bodyMarkup: `<main class="export-page">${renderProposalHeader(args.data)}</main>`,
  });
}

export function renderResumeAtsExportDocument(
  data: ResumePrintSource,
): string {
  return renderResumeHtml({ data, mode: "ats" });
}

export function renderResumeStyledExportDocument(args: {
  data: ResumePrintSource;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  return renderResumeHtml({
    data: args.data,
    mode: "styled",
    stylePreset: args.stylePreset,
  });
}

export function renderProposalAtsExportDocument(
  data: ProposalPrintSource,
): string {
  return renderProposalHtml({ data, mode: "ats" });
}

export function renderProposalStyledExportDocument(args: {
  data: ProposalPrintSource;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  return renderProposalHtml({
    data: args.data,
    mode: "styled",
    stylePreset: args.stylePreset,
  });
}

function buildDocxParagraph(
  text: string,
  options?: {
    heading?: HeadingLevel;
    spacingAfter?: number;
    spacingBefore?: number;
    bold?: boolean;
    italics?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
): Paragraph {
  return new Paragraph({
    heading: options?.heading,
    alignment: options?.alignment,
    spacing: {
      before: options?.spacingBefore ?? 0,
      after: options?.spacingAfter ?? 160,
    },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italics,
      }),
    ],
  });
}

export async function buildProposalDocxBuffer(args: {
  data: ProposalPrintSource;
  stylePreset?: VerbatiStylePreset | null;
}): Promise<Buffer> {
  const resolvedStyle = normalizeStylePreset(args.stylePreset);
  const fonts = getVerbatiTypographyFamilies(resolvedStyle);
  const bodyParagraphs: Paragraph[] = [];

  if (args.data.headerVisibility.showSender) {
    [args.data.applicantHeader.name, args.data.applicantHeader.role, args.data.contactLine]
      .filter(Boolean)
      .forEach((line, index) => {
        bodyParagraphs.push(
          buildDocxParagraph(line, {
            bold: index === 0,
            spacingAfter: 70,
          }),
        );
      });
    bodyParagraphs.push(buildDocxParagraph("", { spacingAfter: 80 }));
  }

  if (args.data.headerVisibility.showDate && args.data.letterDate) {
    bodyParagraphs.push(buildDocxParagraph(args.data.letterDate, { spacingAfter: 180 }));
  }

  if (args.data.headerVisibility.showRecipient && args.data.recipientDetails) {
    args.data.recipientDetails
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        bodyParagraphs.push(buildDocxParagraph(line, { spacingAfter: 60 }));
      });
    bodyParagraphs.push(buildDocxParagraph("", { spacingAfter: 120 }));
  }

  if (args.data.headerVisibility.showSubject) {
    bodyParagraphs.push(
      buildDocxParagraph(args.data.documentTitle, {
        heading: HeadingLevel.HEADING_2,
        spacingAfter: 220,
      }),
    );
  }

  args.data.body.forEach((block) => {
    if (block.type === "closing") {
      if (block.signOff) {
        bodyParagraphs.push(
          buildDocxParagraph(block.signOff, { spacingBefore: 200, spacingAfter: 80 }),
        );
      }
      if (block.signatureName) {
        bodyParagraphs.push(
          buildDocxParagraph(block.signatureName, { bold: true, spacingAfter: 120 }),
        );
      }
      return;
    }

    bodyParagraphs.push(
      buildDocxParagraph(block.text, {
        spacingAfter: block.type === "salutation" ? 180 : 190,
      }),
    );
  });

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: fonts.bodyFamily,
            size: 21,
            color: "1F1D1A",
          },
          paragraph: {
            spacing: {
              after: 160,
              line: 320,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: ROBIAL_EXPORT_GRID.docx.marginsTwip,
          },
        },
        children: bodyParagraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
