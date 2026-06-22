import {
  AlignmentType,
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import {
  DEFAULT_VERBATI_STYLE,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { buildResumeEducationDisplay } from "../features/verbati/resume/resumeEducation";
import type {
  ResumeExperienceItem,
  WorkshopResponsibilitiesRichContent,
  WorkshopResponsibilityTextRun,
} from "../features/verbati/resume/resume.types";
import {
  isProposalLetterheadTemplateId,
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import type {
  ProposalPrintBlock,
  ProposalPrintSource,
  ResumePrintItem,
  ResumePrintSource,
} from "./document-export-models";
import {
  getExportHtmlLang,
  getExportHtmlDir,
  getLocalizedExportLabel,
  localizeStructuredLabel,
  normalizeLocaleTypography,
} from "./export-locale";
import { getLocalFontFaceCss } from "../features/verbati/fontCatalog";
import {
  resolveProposalExportProfile,
  resolveResumeExportProfile,
} from "./layout/exportProfiles";
import {
  resolveProposalDocxSurfaceTokens,
  resolveResumeDocxSurfaceTokens,
} from "./layout/documentTokenSerializers";
import {
  EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID,
  isWorkshopResumeTemplateId,
  isWorkshopTwoColumnResumeTemplateId,
} from "./layout/resumeTemplates";
import { resolveWorkshopTwoColumnFragmentLane } from "./resume/resumePagination";
import {
  resolveDocxSafeColorHex,
  resolvePrimaryFontFamily,
} from "./layout/documentAppearance";
import { formatProposalSignatureName } from "./proposal-closing";
import { resolveProposalSignatureRender } from "./proposal-signature-settings";
import {
  getProposalRecipientExtraLines,
  parseProposalRecipientDetails,
  resolveProposalLetterheadShortTitle,
  type ProposalRecipientFields,
} from "./proposal-header";
import {
  buildProposalContactLineFromParts,
  parseProposalContactLine,
} from "./proposal-heading-state";
import {
  resolveDocumentPageSize,
  type DocumentPageSize,
} from "./document-page-size";
import {
  getDocumentDecorationPlacementMm,
  getRenderableDocumentDecoration,
  resolveTemplateDocumentDecoration,
  type DocumentDecoration,
} from "./document-decoration";
import {
  getDocumentIcon,
  normalizeDocumentIconSettings,
  parseDocumentIconTextSegments,
  renderDocumentIconHtml,
  resolveDefaultListMarkerIconKey,
  resolveSectionHeadingIconKey,
  type DocumentIconSettings,
} from "./document-icons";
import {
  resolveDocumentListItemIconOverride,
  type DocumentIconOverrides,
  type DocumentListItemIconOverrideTarget,
} from "./document-icon-overrides";

type ExportMode = "ats" | "styled";

type DocxParagraphOptions = {
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean;
  color?: string;
  font?: string;
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  keepLines?: boolean;
  keepNext?: boolean;
  line?: number;
  spacingAfter?: number;
  spacingBefore?: number;
  size?: number;
};

type DocxParagraphDefaults = {
  bodySizeHalfPt: number;
  bodyLineTwip: number;
  bodyGapTwip: number;
  colorHex: string;
  locale: DocxLocaleMetadata;
};

type DocxLocaleMetadata = {
  language: {
    value: string;
    bidirectional?: string;
  };
  rightToLeft?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function joinClassNames(
  values: Array<string | false | null | undefined>,
): string {
  return values.filter(Boolean).join(" ");
}

function formatTemplateClassName(value?: string | null): string | null {
  return value ? String(value).replaceAll("_", "-") : null;
}

function uniqueNonEmptyLines(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const value of values) {
    const line = value?.trim();
    if (!line || seen.has(line)) {
      continue;
    }

    seen.add(line);
    lines.push(line);
  }

  return lines;
}

function nonEmptyTextValues(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeStylePreset(
  stylePreset?: VerbatiStylePreset | null,
): VerbatiStylePreset {
  return resolveVerbatiStyle(stylePreset ?? DEFAULT_VERBATI_STYLE);
}

function resolveDocxLocaleMetadata(
  locale: string | null | undefined,
): DocxLocaleMetadata {
  const language = getExportHtmlLang(locale);
  const isRightToLeft = getExportHtmlDir(locale) === "rtl";

  return {
    language: {
      value: language,
      ...(isRightToLeft ? { bidirectional: language } : null),
    },
    ...(isRightToLeft ? { rightToLeft: true } : null),
  };
}

function buildDocxTextRun(args: {
  text: string;
  defaults: DocxParagraphDefaults;
  bold?: boolean;
  color?: string;
  font?: string;
  size?: number;
}): TextRun {
  return new TextRun({
    text: args.text,
    bold: args.bold,
    color: args.color ?? args.defaults.colorHex,
    font: args.font,
    size: args.size ?? args.defaults.bodySizeHalfPt,
    language: args.defaults.locale.language,
    rightToLeft: args.defaults.locale.rightToLeft,
  });
}

function buildCssVarBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `      ${name}: ${value};`)
    .join("\n");
}

function buildStyledResumeAppearanceCss(): string {
  return `
    body.resume-export.resume--styled .export-page {
      background: var(--decor-page-background, var(--paper));
    }

    body.resume-export.resume--styled .resume-styled-page {
      display: grid;
      gap: var(--flow-header-gap);
      align-content: start;
    }

    body.resume-export.resume--styled .resume-styled-header,
    body.resume-export.resume--styled .resume-styled-columns,
    body.resume-export.resume--styled .resume-styled-main,
    body.resume-export.resume--styled .resume-styled-support,
    body.resume-export.resume--styled .resume-styled-header__identity,
    body.resume-export.resume--styled .resume-styled-header__summary {
      min-width: 0;
    }

    body.resume-export.resume--styled .resume-styled-columns {
      align-items: start;
    }

    body.resume-export.resume--styled .resume-styled-page--workshop-twocol {
      gap: var(--flow-section-gap);
    }

    body.resume-export.resume--styled .resume-workshop-twocol-header,
    body.resume-export.resume--styled .resume-workshop-twocol-sidebar,
    body.resume-export.resume--styled .resume-workshop-twocol-main {
      display: grid;
      gap: var(--flow-stack-gap);
      align-content: start;
      min-width: 0;
    }

    body.resume-export.resume--styled .resume-workshop-twocol-grid {
      display: grid;
      grid-template-columns: var(--page-sidebar) var(--page-main);
      column-gap: var(--page-gutter);
      align-items: start;
      min-width: 0;
    }

    body.resume-export.resume--styled .resume-workshop-twocol-sidebar .entry-title {
      font-size: var(--flow-body-size);
    }

    body.resume-export.resume--styled .resume-workshop-twocol-sidebar .section {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    body.resume-export.resume--styled .resume-styled-contact-lines {
      display: grid;
      gap: calc(var(--flow-list-gap) + 0.25mm);
      min-width: 0;
    }

    body.resume-export.resume--styled .resume-styled-contact-line {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-size: calc(var(--flow-body-sm-size) - 0.35mm);
      line-height: calc(var(--flow-body-sm-line) - 0.12);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    body.resume-export.resume--styled .resume-styled-support__avatar {
      display: grid;
      justify-items: center;
      padding-bottom: calc(var(--flow-stack-gap) + 0.6mm);
    }

    body.resume-export.resume--styled .resume-styled-support__avatar-badge {
      width: calc(var(--page-sidebar) - 8mm);
      height: calc(var(--page-sidebar) - 8mm);
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: var(--decor-tag-border-width) solid var(--decor-tag-border-color, var(--line));
      background: color-mix(
        in srgb,
        var(--decor-tag-background, var(--tag-fill)) 78%,
        var(--paper)
      );
      box-shadow: var(--decor-tag-shadow, none);
      font-family: var(--heading-font);
      font-size: calc(var(--flow-title-size) - 1.9mm);
      line-height: 1;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--ink);
      text-transform: uppercase;
    }

    body.resume-export.resume--styled .robial-header__full {
      background: var(--decor-header-background, transparent);
      border-bottom-color: var(--decor-header-border-color, var(--header-rule));
      box-shadow: var(--decor-header-shadow, none);
    }

    body.resume-export.resume--styled .robial-sidebar {
      background: var(--decor-sidebar-background, var(--sidebar-fill));
      box-shadow: var(--decor-sidebar-shadow, none);
    }

    body.resume-export.resume--styled .section--ruled {
      border-top-color: var(--decor-section-rule-border-color, var(--line));
      box-shadow: var(--decor-section-rule-shadow, none);
    }

    body.resume-export.resume--styled .section-title {
      color: var(--decor-section-title-color, var(--accent));
    }

    body.resume-export.resume--styled .meta-label {
      color: var(--decor-meta-label-color, var(--muted));
    }

    body.resume-export.resume--styled .tag {
      border-color: var(--decor-tag-border-color, var(--line));
      border-radius: var(--decor-tag-border-radius);
      background: var(--decor-tag-background, var(--tag-fill));
      box-shadow: var(--decor-tag-shadow, none);
    }

    body.resume-export.resume--styled .doc-name {
      color: var(--decor-doc-name-color, var(--accent));
    }

    body.resume-export.resume--styled .doc-title {
      color: var(--decor-doc-title-color, var(--muted));
    }

    body.resume-export.resume--styled .doc-summary {
      color: var(--decor-doc-summary-color, var(--ink));
    }

    body.resume-export.resume--styled .entry-title {
      color: var(--decor-entry-title-color, var(--ink));
    }

    body.resume-export.resume--styled .entry-meta {
      color: var(--decor-entry-meta-color, var(--muted));
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar {
      gap: calc(var(--flow-header-gap) + 0.4mm);
      min-height: calc(
        var(--page-height) - var(--page-margin-top) - var(--page-margin-bottom)
      );
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-header--editorial-sidebar {
      display: grid;
      grid-template-columns:
        minmax(0, calc(var(--page-sidebar) + var(--page-gutter)))
        minmax(0, var(--page-main));
      column-gap: 0;
      row-gap: calc(var(--flow-stack-gap) + 0.6mm);
      align-items: end;
      padding-bottom: calc(var(--flow-rule-pad-top) + 0.8mm);
      border-bottom: var(--decor-header-border-width) solid var(--decor-header-border-color, var(--header-rule));
      background: var(--decor-header-background, transparent);
      box-shadow: var(--decor-header-shadow, none);
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-header__identity--editorial-sidebar,
    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-header__summary--editorial-sidebar {
      display: grid;
      gap: calc(var(--flow-list-gap) + 0.45mm);
      min-width: 0;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-header__summary--editorial-sidebar {
      align-self: end;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .doc-name {
      color: var(--decor-doc-name-color, var(--ink));
      font-size: calc(var(--flow-display-size) + 3.2mm);
      line-height: 0.9;
      letter-spacing: -0.055em;
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .doc-title {
      color: var(--decor-doc-title-color, var(--accent));
      font-size: calc(var(--flow-body-size) + 0.2mm);
      line-height: 1.22;
      font-style: normal;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-header__summary--editorial-sidebar .doc-summary {
      max-width: min(var(--flow-summary-measure), var(--page-main));
      color: var(--decor-doc-summary-color, var(--ink));
      font-size: calc(var(--flow-body-size) + 0.05mm);
      line-height: 1.5;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-columns--editorial-sidebar {
      display: grid;
      grid-template-columns:
        minmax(0, var(--page-sidebar))
        minmax(0, var(--page-main));
      column-gap: var(--page-gutter);
      align-items: start;
      min-width: 0;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-support--editorial-sidebar {
      display: grid;
      gap: calc(var(--flow-section-gap) - 0.7mm);
      align-content: start;
      min-width: 0;
      padding-top: var(--flow-sidebar-pad-top);
      padding-right: calc(var(--page-gutter) - 5.8mm);
      border-right: var(--decor-sidebar-rule-width) solid var(--decor-section-rule-border-color, var(--line));
      background: var(--decor-sidebar-background, transparent);
      box-shadow: var(--decor-sidebar-shadow, none);
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-main--editorial-sidebar {
      display: grid;
      gap: calc(var(--flow-section-gap) - 0.3mm);
      align-content: start;
      min-width: 0;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-support--editorial-sidebar .resume-sidebar-stack,
    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-main--editorial-sidebar .resume-main-stack {
      gap: calc(var(--flow-section-gap) - 0.45mm);
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .section-title {
      color: var(--decor-section-title-color, var(--accent));
      font-size: calc(var(--flow-label-size) + 0.45mm);
      letter-spacing: 0.18em;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-title--editorial-sidebar {
      font-weight: 400;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-company {
      font-weight: 800;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-role,
    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-title-separator {
      font-weight: 400;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-head {
      grid-template-columns:
        minmax(0, 1fr)
        fit-content(var(--flow-entry-meta-width));
      column-gap: var(--flow-entry-gap);
      align-items: baseline;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .entry-meta {
      text-align: right;
      white-space: pre-wrap;
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-support--editorial-sidebar .entry-head,
    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .section--education .entry-head {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--flow-entry-head-gap);
    }

    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-support--editorial-sidebar .entry-meta,
    body.resume-export.resume-template--editorial-sidebar.resume--styled .resume-styled-page--editorial-sidebar .section--education .entry-meta {
      text-align: left;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial {
      gap: calc(var(--flow-header-gap) + 0.8mm);
      height: var(--page-height);
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-header--editorial {
      display: grid;
      gap: calc(var(--flow-stack-gap) + 1.1mm);
      border-bottom: var(--decor-header-border-width) solid var(--header-rule);
      padding-bottom: calc(var(--flow-rule-pad-top) + 0.5mm);
      box-shadow: var(--decor-header-aux-shadow, none);
      min-width: 0;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-header__identity--editorial {
      display: grid;
      gap: calc(var(--flow-list-gap) + 0.35mm);
      min-width: 0;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .doc-name {
      max-width: none;
      font-size: calc(var(--flow-display-size) + 6.5mm);
      line-height: 0.92;
      letter-spacing: -0.055em;
      color: var(--ink);
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .doc-title {
      max-width: calc(var(--page-main) + var(--page-sidebar) + var(--page-gutter) - 4mm);
      font-size: calc(var(--flow-body-size) + 0.45mm);
      line-height: 1.22;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-style: normal;
      font-weight: 700;
      color: var(--accent);
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .doc-summary {
      max-width: calc(var(--page-main) + 4mm);
      font-size: calc(var(--flow-body-size) + 0.05mm);
      line-height: 1.54;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-columns--editorial {
      display: grid;
      grid-template-columns:
        minmax(0, var(--page-main))
        minmax(0, var(--page-gutter))
        minmax(0, var(--page-sidebar));
      gap: 0;
      align-items: start;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-main--editorial {
      grid-column: 1;
      display: grid;
      gap: calc(var(--flow-section-gap) - 0.5mm);
      min-width: 0;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-main--editorial .section,
    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-support--editorial .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-support--editorial {
      grid-column: 3;
      display: grid;
      gap: calc(var(--flow-stack-gap) + 0.45mm);
      padding-left: calc(var(--page-gutter) - 4.5mm);
      min-width: 0;
      border-left: 0.24mm solid var(--decor-section-rule-border-color, var(--line));
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .entry-head {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--flow-entry-head-gap);
    }

    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .entry-meta,
    body.resume-export.resume-layout--editorial.resume--styled .resume-styled-page--editorial .section--education .entry-meta {
      text-align: left;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-page--quire {
      gap: 0;
      padding: 0;
      min-height: var(--page-height);
      height: var(--page-height);
      overflow: hidden;
      background: var(--paper);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-columns--quire {
      display: grid;
      grid-template-columns: minmax(0, var(--page-sidebar)) minmax(0, 1fr);
      gap: 0;
      min-height: var(--page-height);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire {
      display: grid;
      align-content: start;
      gap: calc(var(--flow-section-gap) - 0.2mm);
      min-height: var(--page-height);
      padding:
        calc(var(--page-margin-top) + 2mm)
        calc(var(--page-margin-left) - 1.5mm)
        calc(var(--page-margin-bottom) + 1mm)
        var(--page-margin-left);
      background: var(--decor-sidebar-background, var(--sidebar-fill));
      box-shadow: var(--decor-sidebar-shadow, none);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header--quire {
      display: grid;
      gap: calc(var(--flow-stack-gap) + 0.55mm);
      padding-bottom: calc(var(--flow-header-gap) + 0.25mm);
      border-bottom: 0.28mm solid var(--decor-support-rule-color, transparent);
      min-width: 0;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-page--quire .resume-styled-support--quire .doc-name {
      max-width: none;
      font-family: var(--body-font);
      font-size: calc(var(--flow-display-size) + 1.35mm);
      line-height: 0.95;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--decor-support-text-primary, var(--paper));
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-page--quire .resume-styled-support--quire .doc-title {
      font-family: var(--body-font);
      font-size: calc(var(--flow-body-size) - 0.45mm);
      line-height: calc(var(--flow-body-line) - 0.32);
      font-style: normal;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--decor-support-accent, var(--paper));
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire {
      display: grid;
      align-content: start;
      gap: calc(var(--flow-section-gap) - 0.2mm);
      min-width: 0;
      padding:
        var(--page-margin-top)
        var(--page-margin-right)
        calc(var(--page-margin-bottom) - 9mm)
        calc(var(--page-gutter) + 6mm);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire {
      display: grid;
      gap: calc(var(--flow-stack-gap) + 0.1mm);
      justify-items: end;
      min-width: 0;
      padding-bottom: calc(var(--flow-header-gap) - 0.3mm);
      border-bottom: 0.28mm solid color-mix(in srgb, var(--ink) 18%, transparent);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .resume-styled-contact-lines {
      justify-items: end;
      max-width: calc(var(--page-main) - 4mm);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .section--ruled {
      border-top: 0;
      padding-top: 0;
      box-shadow: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .section-title {
      display: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .meta-list {
      justify-items: end;
      gap: calc(var(--flow-list-gap) + 0.2mm);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .meta-value {
      text-align: right;
      color: var(--muted);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-header__meta--quire .doc-summary {
      max-width: calc(var(--page-main) - 6mm);
      text-align: right;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .resume-main-stack {
      gap: calc(var(--flow-section-gap) - 0.25mm);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .section,
    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .section-title {
      color: var(--accent);
      padding-bottom: calc(var(--flow-list-gap) + 0.5mm);
      border-bottom: 0.28mm solid color-mix(in srgb, var(--ink) 18%, transparent);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .entry-title {
      font-family: var(--heading-font);
      font-size: calc(var(--flow-title-size) - 0.55mm);
      line-height: 0.98;
      font-weight: 800;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .entry-head {
      grid-template-columns:
        minmax(0, 1fr)
        fit-content(calc(var(--flow-entry-meta-width) + 4mm));
      gap: calc(var(--flow-entry-gap) - 0.1mm);
      align-items: start;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .entry-meta {
      padding-left: calc(var(--flow-entry-gap) - 0.8mm);
      border-left: 0.24mm solid color-mix(in srgb, var(--ink) 16%, transparent);
      text-align: right;
      white-space: normal;
      line-height: 1.46;
      color: color-mix(in srgb, var(--ink) 76%, transparent);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .section--education .entry-head {
      grid-template-columns: minmax(0, 1fr);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-main--quire .section--education .entry-meta {
      padding-left: 0;
      border-left: 0;
      text-align: left;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .section--ruled,
    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .section--ruled .section-title {
      box-shadow: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .section--ruled {
      border-top: 0;
      padding-top: 0;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .section-title {
      margin: 0 0 var(--flow-stack-gap);
      font-size: calc(var(--flow-label-size) - 0.15mm);
      letter-spacing: 0.28em;
      color: var(--decor-support-accent, var(--paper));
      padding-bottom: calc(var(--flow-list-gap) + 0.45mm);
      border-bottom: 0.24mm solid var(--decor-support-rule-color, transparent);
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .meta-label {
      display: none;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .meta-value,
    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .entry-summary,
    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .entry-meta {
      font-size: calc(var(--flow-body-sm-size) - 0.4mm);
      line-height: 1.4;
      color: var(--decor-support-text-secondary, var(--paper));
      text-align: left;
    }

    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .entry-title,
    body.resume-export.resume-layout--quire.resume--styled .resume-styled-support--quire .tag {
      color: var(--decor-support-text-primary, var(--paper));
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-page--modernist {
      gap: 0;
      padding: 0;
      min-height: var(--page-height);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-columns--modernist {
      display: grid;
      grid-template-columns: minmax(0, calc(var(--page-sidebar) + 4mm)) minmax(0, 1fr);
      gap: 0;
      min-height: var(--page-height);
      align-items: stretch;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist {
      display: grid;
      align-content: start;
      gap: calc(var(--flow-section-gap) - 0.25mm);
      min-height: var(--page-height);
      padding:
        calc(var(--page-margin-top) + 2mm)
        calc(var(--flow-stack-gap) + 0.9mm)
        calc(var(--page-margin-bottom) + 1mm)
        var(--page-margin-left);
      background: var(--decor-sidebar-background, var(--sidebar-fill));
      border-right: 0.28mm solid var(--decor-section-rule-border-color, var(--line));
      border-radius: 0 9mm 18mm 0;
      box-shadow: var(--decor-sidebar-shadow, none);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist {
      padding-bottom: calc(var(--flow-stack-gap) + 0.4mm);
      border-bottom: 0.24mm solid color-mix(
        in srgb,
        var(--decor-section-rule-border-color, var(--line)) 76%,
        transparent
      );
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist .section--ruled {
      border-top: 0;
      padding-top: 0;
      box-shadow: none;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist .section-title {
      display: none;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist .meta-list {
      gap: calc(var(--flow-list-gap) + 0.2mm);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support__lead--modernist .meta-value {
      color: color-mix(in srgb, var(--ink) 78%, white 22%);
      font-size: calc(var(--flow-body-sm-size) - 0.1mm);
      line-height: 1.36;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .section--ruled {
      border-top: 0;
      padding-top: 0;
      box-shadow: none;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .section-title {
      margin: 0 0 calc(var(--flow-stack-gap) - 0.4mm);
      font-size: calc(var(--flow-label-size) - 0.15mm);
      letter-spacing: 0.22em;
      color: var(--muted);
      border: 0;
      padding-bottom: 0;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .meta-label {
      display: none;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .meta-value,
    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .entry-summary {
      color: var(--muted);
      font-size: calc(var(--flow-body-sm-size) - 0.05mm);
      line-height: 1.34;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-main--modernist {
      display: grid;
      align-content: start;
      gap: calc(var(--flow-section-gap) - 0.25mm);
      min-width: 0;
      padding:
        calc(var(--page-margin-top) + 2mm)
        var(--page-margin-right)
        calc(var(--page-margin-bottom) + 1mm)
        calc(var(--page-gutter) + 4.5mm);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-main--modernist .section,
    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-support--modernist .section {
      margin-bottom: 0;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-header--modernist {
      display: grid;
      gap: calc(var(--flow-stack-gap) + 0.7mm);
      padding-bottom: calc(var(--flow-rule-pad-top) + 0.35mm);
      border-bottom: 0.24mm solid color-mix(
        in srgb,
        var(--decor-section-rule-border-color, var(--line)) 76%,
        transparent
      );
      min-width: 0;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-page--modernist .doc-name {
      max-width: none;
      font-size: calc(var(--flow-display-size) + 7mm);
      line-height: 0.88;
      letter-spacing: 0.05em;
      font-weight: 900;
      text-transform: uppercase;
      color: var(--ink);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-page--modernist .doc-title {
      font-size: calc(var(--flow-body-size) + 0.1mm);
      line-height: 1.28;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-style: normal;
      font-weight: 700;
      color: var(--accent);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-page--modernist .doc-summary {
      max-width: calc(var(--page-main) - 10mm);
      padding-top: calc(var(--flow-list-gap) + 1mm);
      border-top: 0.24mm solid color-mix(in srgb, var(--line) 78%, transparent);
      font-size: calc(var(--flow-body-size) + 0.05mm);
      line-height: 1.56;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-main--modernist .section-title {
      font-size: calc(var(--flow-label-size) - 0.05mm);
      letter-spacing: 0.24em;
      color: var(--accent);
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-main--modernist .entry-head {
      grid-template-columns: minmax(0, var(--flow-entry-meta-width)) minmax(0, 1fr);
      gap: var(--flow-entry-gap);
      align-items: start;
    }

    body.resume-export.resume-layout--modernist.resume--styled .resume-styled-main--modernist .entry-meta {
      order: -1;
      text-align: left;
      white-space: normal;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--muted);
    }

    body.resume-export.resume-layout--modernist.resume--styled .section--projects .entry--project {
      padding: var(--flow-tag-pad-block) var(--flow-tag-pad-inline);
      border: var(--decor-tag-border-width) solid var(--decor-tag-border-color, var(--line));
      border-radius: var(--decor-tag-border-radius);
      background: color-mix(
        in srgb,
        var(--decor-tag-background, var(--tag-fill)) 72%,
        var(--paper)
      );
      box-shadow: var(--decor-tag-shadow, none);
    }

    body.resume-export.resume-layout--modernist.resume--styled .section--projects .entry--project .entry-head,
    body.resume-export.resume-layout--modernist.resume--styled .section--education .entry--education .entry-head {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--flow-entry-head-gap);
    }

    body.resume-export.resume-layout--modernist.resume--styled .section--projects .entry--project .entry-meta,
    body.resume-export.resume-layout--modernist.resume--styled .section--education .entry--education .entry-meta {
      text-align: left;
    }
  `;
}

function buildStyledProposalAppearanceCss(): string {
  return `
    body.proposal-export.proposal--styled .export-page {
      background: var(--decor-page-background, var(--paper));
    }

    body.proposal-export.proposal--styled .robial-header__full {
      background: var(--decor-header-background, transparent);
      border-bottom-color: var(--decor-header-border-color, var(--header-rule));
      box-shadow: var(--decor-header-shadow, none);
    }

    body.proposal-export.proposal--styled .robial-sidebar {
      background: var(--decor-sidebar-background, var(--sidebar-fill));
      box-shadow: var(--decor-sidebar-shadow, none);
    }

    body.proposal-export.proposal--styled .section--ruled {
      border-top-color: var(--decor-section-rule-border-color, var(--line));
      box-shadow: var(--decor-section-rule-shadow, none);
    }

    body.proposal-export.proposal--styled .proposal-title {
      color: var(--decor-proposal-title-color, var(--accent));
    }

    body.proposal-export.proposal--styled .proposal-meta {
      color: var(--decor-proposal-meta-color, var(--muted));
    }

    body.proposal-export.proposal--styled .meta-label {
      color: var(--decor-meta-label-color, var(--muted));
    }

    body.proposal-export.proposal--styled .meta-value {
      color: var(--decor-meta-value-color, var(--ink));
    }

    body.proposal-export.proposal--styled .proposal-block--subject {
      background: var(--decor-subject-background, transparent);
      box-shadow: var(--decor-subject-shadow, none);
    }

    body.proposal-export.proposal--styled .proposal-signoff {
      color: var(--decor-signoff-color, var(--ink));
    }

    body.proposal-export.proposal--styled .proposal-signature {
      font-family: var(--proposal-signature-font-family, var(--body-font));
      color: var(--decor-signature-color, var(--ink));
      text-transform: var(--decor-signature-text-transform, none);
      font-variant-caps: var(--decor-signature-font-variant-caps, normal);
      letter-spacing: var(--decor-signature-letter-spacing, normal);
    }

    .proposal-cover-letter--editorial.export-page {
      --proposal-editorial-paper: var(--proposal-document-paper, #eef4fb);
      --proposal-editorial-ink: var(--proposal-document-ink, #171511);
      --proposal-editorial-meta-ink: var(--proposal-document-ink, #171511);
      --proposal-editorial-accent: var(--proposal-document-accent-ink, #d59a18);
      --proposal-editorial-heading-font: var(
        --heading-font,
        var(--font-heading-family, "Helvetica Neue", Helvetica, Arial, sans-serif)
      );
      --proposal-editorial-body-font: var(
        --proposal-document-font-family,
        var(--body-font, var(--font-body-family, Georgia, "Times New Roman", Times, serif))
      );
      --proposal-editorial-meta-font: var(
        --body-font,
        var(--font-body-family, Arial, Helvetica, sans-serif)
      );
      position: relative;
      width: var(--page-width);
      min-height: var(--page-height);
      height: var(--page-height);
      max-height: var(--page-height);
      padding: 0;
      overflow: hidden;
      background-color: var(--proposal-editorial-paper);
      background:
        linear-gradient(
          color-mix(in srgb, var(--proposal-editorial-paper, #f7fbff) 62%, white 38%),
          color-mix(in srgb, var(--proposal-editorial-paper, #f7fbff) 62%, white 38%)
        ),
        var(--proposal-editorial-paper) !important;
      color: var(--proposal-editorial-ink);
      page-break-after: always;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-top-ribbon,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-header-rule,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-wordmark,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subtitle,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-rail-rule,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-body-rule,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subject,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date-rule,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-recipient,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-sender,
    .proposal-cover-letter--editorial .proposal-cover-letter__body {
      position: absolute;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-top-ribbon {
      left: -1mm;
      top: -1mm;
      width: calc(100% + 2mm);
      height: 2.85mm;
      background: var(--proposal-editorial-accent, #d59a18);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-header-rule {
      left: 11.7mm;
      top: 49.85mm;
      width: 183mm;
      border-top: 0.18mm solid var(--proposal-editorial-ink, #171511);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-wordmark,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subtitle,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subject,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-label {
      margin: 0;
      font-family: var(--proposal-editorial-heading-font);
      color: var(--proposal-editorial-ink);
      text-rendering: geometricPrecision;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-wordmark {
      left: 14mm;
      top: 17mm;
      width: 92mm;
      font-size: 21pt;
      line-height: 22pt;
      font-weight: 500;
      letter-spacing: 3pt;
      color: var(--proposal-editorial-accent);
      white-space: nowrap;
      overflow: hidden;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subtitle {
      left: 14mm;
      top: 27mm;
      font-size: 14pt;
      line-height: 15pt;
      font-style: italic;
      font-weight: 450;
      letter-spacing: 0;
      color: var(--proposal-editorial-meta-ink);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-label {
      font-size: 10pt;
      line-height: 12.5pt;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-subject {
      left: 72.4mm;
      top: 62.4mm;
      width: 113.8mm;
      font-size: 11pt;
      line-height: 13pt;
      font-weight: 700;
      letter-spacing: 0;
      color: var(--proposal-editorial-ink);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date {
      left: 17.4mm;
      top: 62.4mm;
      width: 38mm;
      font-weight: 700;
      white-space: nowrap;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-label {
      font-weight: 400;
      color: var(--proposal-editorial-meta-ink);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-rail-rule {
      left: 64.35mm;
      top: 62.3mm;
      height: calc(297mm - 62.3mm - 18mm);
      border-left: 0.125mm solid var(--proposal-editorial-ink, #171511);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-body-rule {
      left: 72.4mm;
      top: 70.25mm;
      width: 113.8mm;
      border-top: 0.18mm solid var(--proposal-editorial-ink, #171511);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-date-rule {
      left: 17.4mm;
      top: 70.35mm;
      width: 22.76mm;
      border-top: 0.18mm solid var(--proposal-editorial-ink, #171511);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-recipient {
      left: 17.4mm;
      top: 77.7mm;
      width: 41.4mm;
      max-height: 78mm;
      overflow: hidden;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-sender {
      left: 17.4mm;
      top: 160mm;
      width: 41.4mm;
      max-height: calc(297mm - 160mm - 18mm);
      overflow: hidden;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-recipient .proposal-cover-letter__editorial-label,
    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-sender .proposal-cover-letter__editorial-label {
      position: static;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-label-rule {
      display: block;
      width: 5.69mm;
      margin-top: 1.1mm;
      border-top: 0.18mm solid var(--proposal-editorial-ink, #171511);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-label-rule--sender {
      width: 7.59mm;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-contact-copy {
      margin: 4.8mm 0 0;
      font-family: var(--proposal-editorial-meta-font);
      font-size: 10pt;
      line-height: 12.5pt;
      color: var(--proposal-editorial-meta-ink);
      text-rendering: geometricPrecision;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-contact-copy p {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-contact-copy p + p {
      margin-top: 7.2pt;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-contact-copy b {
      font-weight: 700;
      letter-spacing: 0;
      color: var(--proposal-editorial-ink);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-body-flow {
      left: 72.4mm;
      top: 78.6mm;
      width: 113.8mm;
      max-height: 128mm;
      margin: 0;
      min-width: 0;
      color: var(--proposal-editorial-ink);
      text-rendering: geometricPrecision;
    }

    .proposal-cover-letter--editorial
      .proposal-cover-letter__editorial-body-flow:not(
        :has(.proposal-block--salutation)
      ) {
      padding-top: 0;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__editorial-body-flow--subject-heading {
      padding-top: 0;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-signoff {
      margin: 0;
      font-family: var(--proposal-editorial-body-font);
      font-size: 11pt;
      line-height: 15pt;
      font-weight: 400;
      letter-spacing: 0;
      color: var(--proposal-editorial-ink);
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-block--salutation {
      position: relative;
      margin: 0 0 11pt;
      padding-bottom: 0;
      border-bottom: 0;
      font-family: var(--proposal-editorial-heading-font);
      font-weight: 400;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-block + .proposal-block:not(.proposal-block--closing) {
      margin-top: 11pt;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-block--salutation + .proposal-block:not(.proposal-block--closing) {
      margin-top: 0;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-block--closing {
      display: grid;
      gap: 0;
      margin-top: 14pt;
      padding-top: 0;
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-signoff {
      margin: 0 0 4pt;
      font-family: var(--proposal-editorial-body-font);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-signature {
      margin: 0;
      font-family: var(--proposal-signature-font-family, var(--proposal-editorial-meta-font)) !important;
      font-size: 10pt;
      line-height: 12.5pt;
      font-weight: 400;
      letter-spacing: 1pt;
      text-transform: uppercase;
      color: var(--proposal-editorial-ink);
    }

    .proposal-cover-letter--editorial .proposal-cover-letter__body .proposal-signature-image {
      margin: 0 0 6pt;
      max-width: 42mm;
      max-height: 13.75mm;
    }

    .proposal-cover-letter--twoweeks.export-page {
      position: relative;
      width: var(--page-width);
      min-height: var(--page-height);
      height: var(--page-height);
      max-height: var(--page-height);
      padding: 0;
      overflow: hidden;
      background-color: var(--paper);
      background-image: none;
      color: var(--ink);
      page-break-after: always;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-rail,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-date,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient-label,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__body {
      position: absolute;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-label,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-name,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-identity,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact {
      font-family: Arial, Helvetica, sans-serif;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-date,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient-label,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject {
      font-family: Georgia, "Times New Roman", Times, serif;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-label,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-name p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-identity p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-date,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient-label,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject {
      margin: 0;
      min-width: 0;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-rail {
      left: 17mm;
      top: 22mm;
      width: 52mm;
      height: 224mm;
      display: block;
      color: var(--accent, #385f8a);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-label {
      width: 52mm;
      margin-bottom: 6mm;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 500;
      letter-spacing: 1pt;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-name {
      width: 52mm;
      display: grid;
      gap: 0;
      margin-bottom: 7mm;
      color: var(--accent, #385f8a);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-name p {
      font-size: 10pt;
      line-height: 12pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-name .proposal-cover-letter__twoweeks-role {
      font-size: 8pt;
      line-height: 10pt;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: capitalize;
      color: color-mix(in srgb, var(--accent, #385f8a) 70%, var(--ink) 30%);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-identity {
      width: 52mm;
      display: grid;
      gap: 0;
      margin-bottom: 6mm;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-identity p,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact p {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      line-height: 11pt;
      font-weight: 500;
      letter-spacing: 0.05em;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-identity p {
      text-transform: uppercase;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact p {
      letter-spacing: 0;
      font-weight: 400;
      text-transform: none;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact {
      width: 52mm;
      max-height: 120mm;
      display: grid;
      row-gap: 11pt;
      overflow: hidden;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-contact-group {
      display: grid;
      gap: 0;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-date {
      left: 87mm;
      top: 22mm;
      width: 105mm;
      font-size: 10pt;
      line-height: 13pt;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient-label {
      left: 87mm;
      top: 27mm;
      width: 105mm;
      font-size: 8pt;
      line-height: 10pt;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient {
      left: 87mm;
      top: 31mm;
      width: 105mm;
      display: grid;
      gap: 0;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient p {
      font-size: 10pt;
      line-height: 13pt;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-recipient p:first-child {
      font-weight: 700;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject {
      left: 87mm;
      top: 66mm;
      width: 105mm;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 2mm;
      align-items: baseline;
      font-size: 10pt;
      line-height: 13pt;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject-label {
      font-weight: 700;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__twoweeks-subject-value {
      min-width: 0;
      font-weight: 400;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__body {
      left: 87mm;
      top: 83mm;
      width: min(105mm, 64ch);
      max-width: min(105mm, 64ch);
      display: grid;
      align-content: start;
      min-width: 0;
      padding: 0;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-signature {
      font-family: Georgia, "Times New Roman", Times, serif;
      font-size: 11pt;
      line-height: 15pt;
      color: var(--ink);
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-signature {
      font-family: var(--proposal-signature-font-family, var(--body-font));
      font-weight: var(--decor-signature-font-weight, inherit);
      text-transform: var(--decor-signature-text-transform, none);
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-block + .proposal-block:not(.proposal-block--closing) {
      margin-top: 10pt;
    }

    .proposal-cover-letter--twoweeks .proposal-cover-letter__body .proposal-block--closing {
      gap: 8pt;
      padding-top: 14pt;
    }

    .proposal-cover-letter--director.export-page,
    .proposal-cover-letter--volk.export-page,
    .proposal-cover-letter--film-foto.export-page,
    .proposal-cover-letter--moma-bauhaus.export-page,
    .proposal-cover-letter--joella.export-page,
    .proposal-cover-letter--bayer.export-page {
      position: relative;
      width: var(--page-width);
      min-height: var(--page-height);
      height: var(--page-height);
      padding: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--paper) 58%, white 42%), transparent 30%),
        var(--decor-page-background, var(--paper));
      page-break-after: always;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead,
    .proposal-cover-letter--director .proposal-cover-letter__sender-block,
    .proposal-cover-letter--director .proposal-cover-letter__contact-grid,
    .proposal-cover-letter--director .proposal-cover-letter__meta-row,
    .proposal-cover-letter--director .proposal-cover-letter__recipient-subject-stack,
    .proposal-cover-letter--director .proposal-cover-letter__body,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-header,
    .proposal-cover-letter--volk .proposal-cover-letter__meta-row,
    .proposal-cover-letter--volk .proposal-cover-letter__recipient-subject-stack,
    .proposal-cover-letter--volk .proposal-cover-letter__body,
    .proposal-cover-letter--volk .proposal-cover-letter__dot,
    .proposal-cover-letter--film-foto .proposal-cover-letter__film-header,
    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks,
    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-row,
    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-subject-stack,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body,
    .proposal-cover-letter--film-foto .proposal-cover-letter__film-address-footer,
    .proposal-cover-letter--film-foto .proposal-cover-letter__dot {
      position: absolute;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead-primary,
    .proposal-cover-letter--director .proposal-cover-letter__masthead-secondary,
    .proposal-cover-letter--director .proposal-cover-letter__masthead-role,
    .proposal-cover-letter--director .proposal-cover-letter__contact-mark,
    .proposal-cover-letter--director .proposal-cover-letter__subject-label,
    .proposal-cover-letter--director .proposal-cover-letter__subject-value,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-title,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-subtitle,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-label,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-value,
    .proposal-cover-letter--film-foto .proposal-cover-letter__film-title,
    .proposal-cover-letter--film-foto .proposal-cover-letter__film-heading,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-label,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-value {
      font-family: var(--heading-font, var(--font-heading-family));
    }

    .proposal-cover-letter--director .proposal-cover-letter__sender-label,
    .proposal-cover-letter--director .proposal-cover-letter__sender-lines p,
    .proposal-cover-letter--director .proposal-cover-letter__contact-lines p,
    .proposal-cover-letter--director .proposal-cover-letter__recipient-block p,
    .proposal-cover-letter--director .proposal-cover-letter__meta-item,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-sender,
    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block p,
    .proposal-cover-letter--volk .proposal-cover-letter__meta-item,
    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks p,
    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block p,
    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-item {
      font-family: var(--body-font, var(--font-body-family));
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead {
      left: 25mm;
      top: 22.8mm;
      right: 14mm;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.75fr) auto;
      column-gap: 9mm;
      align-items: baseline;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead--no-secondary {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead--no-secondary
      .proposal-cover-letter__masthead-role {
      grid-column: 2;
      max-width: 106mm;
      white-space: normal;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead-primary,
    .proposal-cover-letter--director .proposal-cover-letter__masthead-secondary {
      margin: 0;
      font-size: 17pt;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead-role {
      margin: 0;
      justify-self: end;
      font-size: 18pt;
      line-height: 1;
      font-weight: 800;
      color: var(--ink);
    }

    .proposal-cover-letter--director .proposal-cover-letter__sender-block {
      left: 25mm;
      top: 43.5mm;
      display: grid;
      grid-template-columns: 16mm minmax(0, 60mm);
      column-gap: 3mm;
      align-items: start;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-grid {
      left: 111mm;
      top: 43.5mm;
      display: grid;
      grid-template-columns: minmax(0, 36.2mm) minmax(0, 46.2mm);
      column-gap: 4mm;
      align-items: center;
      max-width: 86.4mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-group {
      display: grid;
      grid-template-columns: 4mm minmax(0, 1fr);
      column-gap: 2.2mm;
      align-items: center;
      min-width: 0;
      min-height: 6mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-group--telephone {
      column-gap: 1.25mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-group--digital {
      column-gap: 3mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__sender-label,
    .proposal-cover-letter--director .proposal-cover-letter__sender-lines p,
    .proposal-cover-letter--director .proposal-cover-letter__contact-lines p,
    .proposal-cover-letter--director .proposal-cover-letter__recipient-block p {
      margin: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 700;
      overflow-wrap: normal;
      white-space: nowrap;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-lines {
      display: grid;
      gap: 0.2mm;
      min-width: 0;
    }

    .proposal-cover-letter--director
      .proposal-cover-letter__contact-group--telephone.proposal-cover-letter__contact-group--single-line
      .proposal-cover-letter__contact-lines {
      align-self: end;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-lines p {
      min-width: 0;
      overflow: visible;
      text-overflow: clip;
    }

    .proposal-cover-letter--director .proposal-cover-letter__contact-mark {
      margin: 0;
      inline-size: 4mm;
      text-align: center;
      font-size: 17pt !important;
      line-height: 1;
      font-weight: 800 !important;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-row {
      left: 25mm;
      right: 14mm;
      top: 87.8mm;
      display: grid;
      grid-template-columns: 38mm 42mm 34mm minmax(30mm, max-content);
      column-gap: 8mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-item:last-child {
      justify-self: end;
      text-align: right;
      white-space: nowrap;
      overflow-wrap: normal;
    }

    .proposal-cover-letter--director .proposal-cover-letter__recipient-subject-stack {
      left: 25mm;
      top: 98.2mm;
      right: 25mm;
      display: grid;
      gap: 3mm;
      align-content: start;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 3mm;
      align-items: baseline;
    }

    .proposal-cover-letter--director .proposal-cover-letter__recipient-block {
      width: min(112mm, 100%);
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__recipient-block p {
      color: var(--ink);
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 600;
    }

    .proposal-cover-letter--director .proposal-cover-letter__body {
      left: 25mm;
      top: 118mm;
      width: min(96mm, 58ch);
    }

    .proposal-cover-letter--director.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__body {
      top: 131mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-header {
      left: 24mm;
      top: 30.7mm;
      right: 18mm;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
      column-gap: 10mm;
      row-gap: 1mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-title {
      margin: 0;
      font-size: 17pt;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-title--right {
      grid-column: 2;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-subtitle {
      grid-column: 1 / -1;
      margin: 0;
      font-size: 12pt;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-sender {
      grid-column: 1 / -1;
      margin: 3.2mm 0 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__meta-row {
      left: 24mm;
      right: 18mm;
      top: 91.7mm;
      display: grid;
      grid-template-columns: 38mm 38mm 32mm minmax(36mm, max-content);
      column-gap: 8mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__meta-item:last-child {
      justify-self: end;
      text-align: right;
      white-space: nowrap;
      overflow-wrap: normal;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__recipient-subject-stack {
      left: 24mm;
      top: 101.7mm;
      right: 24mm;
      display: grid;
      gap: 3mm;
      align-content: start;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__subject-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 3mm;
      align-items: baseline;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block {
      width: min(112mm, 100%);
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block p {
      margin: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 700;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__body {
      left: 24mm;
      top: 122mm;
      width: min(96mm, 58ch);
    }

    .proposal-cover-letter--volk.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__body {
      top: 134mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__dot {
      left: 24mm;
      top: 260mm;
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 50%;
      background: var(--accent);
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-header {
      left: 20mm;
      top: 23.1mm;
      right: 3mm;
      display: grid;
      grid-template-columns: minmax(0, 105mm) minmax(0, 1fr);
      column-gap: 5mm;
      align-items: end;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-heading {
      margin: 0;
      min-width: 0;
      font-size: 10pt;
      line-height: 1;
      font-weight: 500;
      color: var(--accent);
      text-transform: uppercase;
      overflow-wrap: normal;
      white-space: nowrap;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-title {
      margin: 0;
      font-size: 22pt;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      text-transform: lowercase;
      overflow-wrap: normal;
      grid-column: 2;
      justify-self: end;
      max-width: none;
      text-align: right;
      white-space: nowrap;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead-primary,
    .proposal-cover-letter--director .proposal-cover-letter__masthead-secondary,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-title {
      min-width: 0;
      overflow: hidden;
      overflow-wrap: normal;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-rule {
      grid-column: 1 / -1;
      margin-top: 1.7mm;
      height: 0.8pt;
      background: var(--accent);
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks {
      left: 20mm;
      right: 8mm;
      top: 42mm;
      display: grid;
      grid-template-columns: 45mm 31mm 26mm 30mm minmax(0, 1fr);
      column-gap: 4mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-row {
      left: 20mm;
      right: 8mm;
      top: 90mm;
      display: grid;
      grid-template-columns: 45mm 42mm 34mm minmax(36mm, max-content);
      column-gap: 8mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-item:last-child {
      justify-self: end;
      text-align: right;
      white-space: nowrap;
      overflow-wrap: normal;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-subject-stack {
      left: 20mm;
      top: calc(var(--page-height) / 3);
      right: 22mm;
      display: grid;
      gap: 3mm;
      align-content: start;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 2mm;
      align-items: baseline;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block {
      width: min(112mm, 100%);
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block p {
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 400;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__body {
      left: 20mm;
      top: calc((var(--page-height) / 3) + 11mm);
      width: min(96mm, 58ch);
    }

    .proposal-cover-letter--film-foto.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__body {
      top: calc((var(--page-height) / 3) + 24mm);
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__dot {
      left: 20mm;
      bottom: 38.8mm;
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 50%;
      background: var(--accent);
    }

    .proposal-cover-letter--volk .proposal-cover-letter__meta-item {
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 600;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-item {
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 400;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks p {
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 400;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-address-footer {
      left: 20mm;
      right: 20mm;
      bottom: 18mm;
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 1.25;
      font-weight: 400;
      color: var(--accent);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .proposal-cover-letter--film-foto
      .proposal-cover-letter__info-block--phone
      p:not(.proposal-cover-letter__info-label) {
      overflow-wrap: normal;
      white-space: nowrap;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-item,
    .proposal-cover-letter--director .proposal-cover-letter__subject-label,
    .proposal-cover-letter--director .proposal-cover-letter__subject-value,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-label,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-value,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-label,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-value {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-item {
      font-size: 7pt;
      line-height: 1.2;
      font-weight: 800;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-label,
    .proposal-cover-letter--director .proposal-cover-letter__subject-value {
      color: var(--ink);
      font-size: 9pt;
      line-height: 1.16;
      font-weight: 700;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-label,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-value {
      color: var(--accent);
      font-size: 9pt;
      line-height: 1.16;
      font-weight: 400;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-label {
      color: var(--accent);
      font-size: 9pt;
      text-transform: uppercase;
      font-weight: 800;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__subject-label,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-value {
      color: var(--accent);
      font-size: 9pt;
      line-height: 1.16;
      font-weight: 800;
      text-transform: lowercase;
    }

    .proposal-cover-letter--director .proposal-cover-letter__body,
    .proposal-cover-letter--volk .proposal-cover-letter__body,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body {
      display: grid;
      align-content: start;
      gap: 0;
      max-width: min(96mm, 58ch);
      color: var(--ink);
    }

    .proposal-cover-letter--director .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--director .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--director .proposal-cover-letter__body .proposal-signature,
    .proposal-cover-letter--volk .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--volk .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--volk .proposal-cover-letter__body .proposal-signature,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body .proposal-signature {
      margin: 0;
      font-family: var(--body-font, var(--font-body-family));
      font-size: 9pt;
      line-height: 1.48;
      color: var(--ink);
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--director .proposal-cover-letter__body .proposal-block + .proposal-block,
    .proposal-cover-letter--volk .proposal-cover-letter__body .proposal-block + .proposal-block,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body .proposal-block + .proposal-block {
      margin-top: 4mm;
    }

    .proposal-cover-letter--moma-bauhaus.export-page {
      --moma-bauhaus-frame-left-mm: 5;
      --moma-bauhaus-frame-top-mm: 94;
      --moma-bauhaus-frame-width-mm: calc(var(--proposal-page-width-mm) - 13);
      --moma-bauhaus-frame-height-mm: calc(var(--proposal-page-height-mm) - 101);
      --moma-bauhaus-body-width-mm: min(
        132,
        calc(var(--proposal-page-width-mm) - 65)
      );
      --moma-bauhaus-footer-top-mm: calc(var(--proposal-page-height-mm) - 13);
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--paper) 94%, white 6%),
          color-mix(in srgb, var(--paper) 96%, var(--accent) 4%)
        );
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-header,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-frame,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body {
      position: absolute;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer {
      font-family: var(--body-font, var(--font-body-family));
      color: var(--accent);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-header,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-logo,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-subtitle {
      font-family: var(--heading-font, var(--font-heading-family));
      color: var(--accent);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender {
      left: 32mm;
      top: 11mm;
      bottom: auto;
      width: 58mm;
      display: grid;
      gap: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient {
      left: 32mm;
      top: 42mm;
      width: 58mm;
      display: grid;
      gap: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender p,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient p,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta-item,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer {
      margin: 0;
      min-width: 0;
      font-size: 7pt;
      line-height: 9pt;
      font-weight: 400;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender p,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient p {
      font-size: 9pt;
      line-height: 13pt;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender p:first-child,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient p:first-child {
      font-weight: 800;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-header {
      left: 102mm;
      top: 10mm;
      right: 8mm;
      display: grid;
      align-content: start;
      justify-items: start;
      min-width: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-logo {
      margin: 0;
      max-width: 100%;
      font-size: 54pt;
      line-height: 48pt;
      font-weight: 900;
      letter-spacing: 0;
      overflow: visible;
      white-space: nowrap;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-subtitle {
      position: absolute;
      left: 1mm;
      top: 18mm;
      margin: 0;
      max-width: 94mm;
      font-size: 7pt;
      line-height: 9pt;
      font-weight: 800;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta {
      left: 32mm;
      top: 121mm;
      right: 18mm;
      display: grid;
      gap: 1mm;
      align-items: start;
      min-width: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta-item {
      font-size: 10pt;
      line-height: 14pt;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta-item--subject {
      font-weight: 800;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-frame {
      left: calc(var(--moma-bauhaus-frame-left-mm) * 1mm);
      top: calc(var(--moma-bauhaus-frame-top-mm) * 1mm);
      width: calc(var(--moma-bauhaus-frame-width-mm) * 1mm);
      height: calc(var(--moma-bauhaus-frame-height-mm) * 1mm);
      border: 1mm solid var(--accent);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body {
      left: 32mm;
      top: 141mm;
      width: min(calc(var(--moma-bauhaus-body-width-mm) * 1mm), 70ch);
      max-width: min(calc(var(--moma-bauhaus-body-width-mm) * 1mm), 70ch);
      display: grid;
      align-content: start;
      min-width: 0;
      padding: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-signature {
      margin: 0;
      font-family: var(--body-font, var(--font-body-family));
      font-size: 10pt;
      line-height: 14pt;
      color: var(--ink);
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-block + .proposal-block:not(.proposal-block--closing) {
      margin-top: 6pt;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-block--closing {
      display: grid;
      gap: 6pt;
      padding-top: 10pt;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-signature {
      font-family: var(--proposal-signature-font-family, var(--body-font));
      font-weight: var(--decor-signature-font-weight, inherit);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer {
      top: calc(var(--moma-bauhaus-footer-top-mm) * 1mm);
      max-width: 72mm;
      color: var(--accent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer--left {
      left: 32mm;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer--right {
      left: 102mm;
    }

    .proposal-cover-letter--bayer.export-page {
      background: var(--paper) !important;
      background-image: none !important;
      color: var(--ink);
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-header,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-date,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-footer,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow {
      position: absolute;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-header {
      left: 35mm;
      top: 35mm;
      width: 157mm;
      height: 29mm;
      color: var(--ink);
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-header--has-company {
      height: 35mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-name,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-role,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-company,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-email,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-label,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient p,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-date-value,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-subject-value,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-footer {
      margin: 0;
      letter-spacing: 0;
      min-width: 0;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-name,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-role,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-company,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-email,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient p:not(.proposal-cover-letter__bayer-label),
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-date-value,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-subject-value,
    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-signature {
      font-family: var(--body-font, var(--font-body-family));
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-name {
      width: 157mm;
      font-family: var(--heading-font, var(--font-heading-family));
      font-size: 16pt;
      line-height: 16pt;
      font-weight: 850;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-rule {
      position: absolute;
      left: 0;
      top: 8mm;
      width: 157mm;
      height: 2pt;
      background-color: var(--accent, var(--ink));
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-role,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-company,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-email {
      position: absolute;
      left: 0;
      width: 157mm;
      font-size: 12pt;
      line-height: 6mm;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-role {
      top: 17mm;
      font-weight: 720;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-company,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-email {
      top: 23mm;
      font-weight: 400;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-header--has-company .proposal-cover-letter__bayer-email {
      top: 29mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient {
      left: 35mm;
      top: 76mm;
      width: 87mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-date {
      left: 140mm;
      top: 76mm;
      width: 52mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-label {
      font-family: var(--body-font, var(--font-body-family));
      font-size: 7pt;
      line-height: 6mm;
      font-weight: 720;
      text-transform: uppercase;
      color: color-mix(
        in srgb,
        var(--ink) 62%,
        var(--paper) 38%
      );
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient p:not(.proposal-cover-letter__bayer-label),
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-date-value,
    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-subject-value {
      font-size: 12pt;
      line-height: 6mm;
      font-weight: 400;
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-recipient-name {
      font-weight: 720;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow {
      left: 35mm;
      width: 157mm;
      overflow: hidden;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow--with-subject {
      top: 116mm;
      max-height: 158mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow--no-subject {
      top: 135mm;
      max-height: 139mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-subject {
      position: static;
      width: 157mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-subject-value {
      max-width: 157mm;
      font-weight: 400;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__body {
      position: static;
      width: 157mm;
      max-width: 157mm;
      display: grid;
      align-content: start;
      min-width: 0;
      padding: 0;
      overflow: visible;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow--with-subject .proposal-cover-letter__body {
      margin-top: 6mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-flow--no-subject .proposal-cover-letter__body {
      margin-top: 0;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-signature {
      margin: 0;
      font-size: 12pt;
      line-height: 6mm;
      color: var(--ink);
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-block + .proposal-block:not(.proposal-block--closing) {
      margin-top: 6mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-block--closing {
      display: grid;
      gap: 6mm;
      padding-top: 6mm;
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__body .proposal-signature {
      font-family: var(--proposal-signature-font-family, var(--body-font));
      font-weight: var(--decor-signature-font-weight, inherit);
    }

    .proposal-cover-letter--bayer .proposal-cover-letter__bayer-footer {
      left: 35mm;
      top: 280mm;
      max-width: 157mm;
      font-family: var(--body-font, var(--font-body-family));
      font-size: 8.5pt;
      line-height: 3mm;
      font-weight: 680;
      color: color-mix(
        in srgb,
        var(--ink) 62%,
        var(--paper) 38%
      );
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proposal-cover-letter--bayer .dasti-proposal-document__page--continuation .proposal-cover-letter__bayer-flow {
      top: 35mm;
      max-height: 227mm;
    }

    .proposal-cover-letter--joella.export-page {
      --joella-frame-left-mm: 5.5;
      --joella-frame-top-mm: 6.8;
      --joella-frame-width-mm: calc(var(--proposal-page-width-mm) - 11.5);
      --joella-frame-height-mm: calc(var(--proposal-page-height-mm) - 14.2);
      --joella-body-width-mm: calc(var(--proposal-page-width-mm) - 70);
      --joella-footer-top-mm: calc(var(--proposal-page-height-mm) - 11.25);
      background: var(--paper) !important;
      background-image: none !important;
      color: var(--ink);
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-frame,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-divider,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-wordmark,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-recipient,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-meta,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-footer,
    .proposal-cover-letter--joella .proposal-cover-letter__body {
      position: absolute;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-frame {
      left: calc(var(--joella-frame-left-mm) * 1mm);
      top: calc(var(--joella-frame-top-mm) * 1mm);
      width: calc(var(--joella-frame-width-mm) * 1mm);
      height: calc(var(--joella-frame-height-mm) * 1mm);
      border: 1.32mm solid var(--proposal-joella-structure-color);
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-divider {
      left: 5.5mm;
      right: 6mm;
      top: 19.65mm;
      height: 0;
      border-top: 1.32mm solid var(--proposal-joella-structure-color);
      background: transparent;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-wordmark,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-recipient,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-meta,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-footer {
      margin: 0;
      min-width: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-wordmark {
      left: 9.8mm;
      top: 6.8mm;
      height: 12.85mm;
      max-width: 88mm;
      box-sizing: border-box;
      padding-top: 2mm;
      transform: none;
      display: flex;
      align-items: center;
      font-size: 23pt;
      line-height: 1;
      font-weight: 700;
      letter-spacing: -0.035em;
      color: var(--proposal-joella-mark-color);
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-recipient {
      left: 35mm;
      top: 45mm;
      width: 70mm;
      display: grid;
      gap: 0;
      color: var(--proposal-joella-structure-color);
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-meta {
      right: 34mm;
      top: 86.7mm;
      width: 76mm;
      display: grid;
      gap: 0;
      color: var(--proposal-joella-structure-color);
      text-align: right;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-recipient p,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-meta p {
      margin: 0;
      min-width: 0;
      font-size: 10pt;
      line-height: 4.65mm;
      font-weight: 600;
      letter-spacing: 0.01em;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-meta p:first-child {
      white-space: nowrap;
      overflow-wrap: normal;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body {
      left: 35mm;
      top: 35mm;
      width: min(calc(var(--joella-body-width-mm) * 1mm), 70ch);
      max-width: min(calc(var(--joella-body-width-mm) * 1mm), 70ch);
      display: grid;
      align-content: start;
      min-width: 0;
      padding: 0;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block {
      display: grid;
      gap: 0;
      margin: 0;
      margin-bottom: 9.3mm;
      min-width: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 4.65mm;
      font-weight: 400;
      color: var(--ink);
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block-group {
      display: grid;
      gap: 0;
      min-width: 0;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block-group + .proposal-cover-letter__joella-letter-block-group {
      margin-top: 3.7mm;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block p {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block-line--strong,
    .proposal-cover-letter--joella .proposal-cover-letter__joella-recipient p:first-child {
      font-weight: 700;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-letter-block-subject-value {
      text-decoration: underline;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-block,
    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-signoff,
    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-signature {
      margin: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 4.65mm;
      font-weight: 400;
      color: var(--ink);
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-block--salutation {
      font-weight: 400;
      margin-bottom: 4.65mm;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-block--salutation + .proposal-block {
      margin-top: 0;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-block + .proposal-block:not(.proposal-block--closing):not(.proposal-block--salutation) {
      margin-top: 4.65mm;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-block--closing {
      display: grid;
      gap: 4.65mm;
      padding-top: 9.3mm;
    }

    .proposal-cover-letter--joella .proposal-cover-letter__body .proposal-signature {
      font-family: var(--proposal-signature-font-family, Arial, "Helvetica Neue", Helvetica, sans-serif);
      font-weight: var(--decor-signature-font-weight, inherit);
    }

    .proposal-cover-letter--joella .proposal-cover-letter__joella-footer {
      left: 10.4mm;
      top: calc(var(--joella-footer-top-mm) * 1mm);
      max-width: 150mm;
      transform: translateY(-100%);
      font-size: 7pt;
      line-height: 1;
      font-weight: 700;
      letter-spacing: 0.018em;
      color: var(--proposal-joella-structure-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}

const LATIN_EXPORT_FALLBACK_LOCALES = new Set([
  "en",
  "fr",
  "es",
  "pt",
  "it",
  "de",
  "nl",
  "ga",
  "pl",
  "hu",
  "lt",
  "et",
]);

const CYRILLIC_GREEK_EXPORT_FALLBACK_LOCALES = new Set(["ru", "el"]);

const LATIN_EXPORT_FALLBACK_STACK = '"Noto Sans", system-ui, sans-serif';
const CYRILLIC_GREEK_EXPORT_FALLBACK_STACK =
  '"Noto Sans", "Segoe UI", Tahoma, Arial, sans-serif';
const ARABIC_EXPORT_FONT_STACK =
  '"Noto Kufi Arabic", "Noto Sans Arabic", "Noto Naskh Arabic", "Geeza Pro", Tahoma, Arial, sans-serif';

function resolveExportFontFallbackStack(locale?: string | null): string | null {
  const htmlLang = getExportHtmlLang(locale);
  if (LATIN_EXPORT_FALLBACK_LOCALES.has(htmlLang)) {
    return LATIN_EXPORT_FALLBACK_STACK;
  }
  if (CYRILLIC_GREEK_EXPORT_FALLBACK_LOCALES.has(htmlLang)) {
    return CYRILLIC_GREEK_EXPORT_FALLBACK_STACK;
  }
  return null;
}

function appendExportFontFallback(
  fontStack: string | undefined,
  fallbackStack: string | null,
): string | undefined {
  if (!fontStack || !fallbackStack || fontStack.includes('"Noto Sans"')) {
    return fontStack;
  }
  return `${fontStack}, ${fallbackStack}`;
}

function buildLocaleTypographyVars(
  vars: Record<string, string>,
  locale?: string | null,
): Record<string, string> {
  const htmlLang = getExportHtmlLang(locale);
  if (htmlLang === "ar") {
    return {
      ...vars,
      "--heading-font": ARABIC_EXPORT_FONT_STACK,
      "--body-font": ARABIC_EXPORT_FONT_STACK,
    };
  }

  const fallbackStack = resolveExportFontFallbackStack(locale);
  if (!fallbackStack) {
    return vars;
  }

  return {
    ...vars,
    "--heading-font":
      appendExportFontFallback(vars["--heading-font"], fallbackStack) ??
      fallbackStack,
    "--body-font":
      appendExportFontFallback(vars["--body-font"], fallbackStack) ??
      fallbackStack,
  };
}

function buildLocaleTypographyCss(locale?: string | null): string {
  const htmlLang = getExportHtmlLang(locale);
  if (htmlLang !== "ar") {
    return "";
  }

  return `
    html[lang="ar"],
    html[dir="rtl"] {
      text-align: right;
    }
  `;
}

function buildPageCss(args: {
  documentKind: "proposal" | "resume";
  lang?: string | null;
  mode: ExportMode;
  pageSize?: DocumentPageSize | null;
  proposalTemplateId?: ProposalTemplateId | null;
  resumeTemplateId?: ResumePrintSource["resumeTemplateId"] | null;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const pageSize = resolveDocumentPageSize({ pageSize: args.pageSize });
  const resumeProfile =
    args.documentKind === "resume"
      ? resolveResumeExportProfile({
          mode: args.mode,
          pageSize,
          resumeTemplateId: args.resumeTemplateId,
          stylePreset: args.stylePreset,
        })
      : null;
  const proposalProfile =
    args.documentKind === "proposal"
      ? resolveProposalExportProfile({
          mode: args.mode,
          pageSize,
          proposalTemplateId: args.proposalTemplateId,
          stylePreset: args.stylePreset,
        })
      : null;
  const layoutProfileVars = resumeProfile?.vars ?? proposalProfile?.vars ?? {};
  const appearanceOnlyCss =
    args.mode !== "styled"
      ? ""
      : args.documentKind === "resume"
        ? buildStyledResumeAppearanceCss()
        : buildStyledProposalAppearanceCss();

  return `
    :root {
${buildCssVarBlock(buildLocaleTypographyVars(layoutProfileVars, args.lang))}
    }
${buildLocaleTypographyCss(args.lang)}

    @page {
      size: ${pageSize.cssSize};
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--body-font);
      font-size: var(--flow-body-size);
      line-height: var(--flow-body-line);
      font-kerning: normal;
      font-variant-ligatures: common-ligatures;
      text-rendering: optimizeLegibility;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      background: var(--paper);
    }

    .export-page {
      position: relative;
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

    .dasti-proposal-document-decoration {
      position: absolute;
      z-index: 30;
      display: block;
      box-sizing: border-box;
      pointer-events: none;
    }

    .dasti-proposal-document-decoration img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: var(--proposal-decoration-object-fit, contain);
    }

    .export-page:last-child {
      page-break-after: auto;
    }

    .robial-header {
      display: grid;
      grid-template-columns: var(--page-sidebar) var(--page-gutter) var(--page-main);
      gap: 0;
      margin-bottom: var(--flow-header-gap);
      align-items: start;
    }

    .robial-header__full {
      grid-column: 1 / -1;
      display: grid;
      gap: var(--flow-stack-gap);
      border-bottom: var(--decor-header-border-width) solid var(--header-rule);
      padding-bottom: var(--flow-sidebar-pad-top);
      min-width: 0;
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
      padding-top: var(--flow-sidebar-pad-top);
      border-top: var(--decor-sidebar-rule-width) solid var(--rule-strong);
      background: var(--sidebar-fill);
    }

    .robial-main {
      grid-column: 3;
      min-width: 0;
    }

    .resume-main-stack,
    .resume-sidebar-stack,
    .proposal-support-stack {
      display: grid;
      gap: var(--flow-section-gap);
      min-width: 0;
    }

    .resume-main-stack > :last-child,
    .resume-sidebar-stack > :last-child,
    .proposal-support-stack > :last-child {
      margin-bottom: 0;
    }

    .resume-shell--onecol .resume-main-stack,
    .proposal-shell--onecol .proposal-main-stack,
    .proposal-shell--onecol .proposal-support-stack {
      max-width: var(--flow-reading-measure);
    }

    .resume-inline-meta {
      display: grid;
      gap: var(--flow-entry-head-gap);
      max-width: var(--flow-reading-measure);
      min-width: 0;
    }

    .resume-inline-meta__line,
    .proposal-inline-meta__line {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-meta-size);
      line-height: var(--flow-meta-line);
      color: var(--muted);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .proposal-inline-meta {
      display: grid;
      gap: var(--flow-stack-gap);
      max-width: var(--flow-reading-measure);
      min-width: 0;
    }

    .doc-name {
      margin: 0;
      font-family: var(--heading-font);
      font-size: var(--flow-title-size);
      line-height: var(--flow-title-line);
      font-weight: var(--decor-doc-name-font-weight, 700);
      letter-spacing: var(--decor-doc-name-letter-spacing, -0.015em);
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-title {
      margin: 0;
      font-family: var(--heading-font);
      font-size: var(--proposal-title-size, var(--flow-title-size));
      line-height: var(--proposal-title-line, var(--flow-title-line));
      font-weight: var(--decor-proposal-title-font-weight, 700);
      letter-spacing: var(--decor-proposal-title-letter-spacing, -0.015em);
      font-style: var(--decor-proposal-title-font-style, normal);
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .doc-title {
      margin: 0;
      font-size: var(--flow-subtitle-size);
      line-height: var(--flow-subtitle-line);
      font-style: var(--decor-doc-title-font-style, normal);
      color: var(--muted);
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .doc-summary {
      margin: 0;
      max-width: var(--flow-summary-measure);
      min-width: 0;
      font-size: var(--flow-summary-size);
      line-height: var(--flow-summary-line);
      overflow-wrap: anywhere;
    }

    .section {
      margin-bottom: var(--flow-section-gap);
      break-inside: auto;
      page-break-inside: auto;
    }

    .section:last-child,
    .entry:last-child,
    .proposal-block:last-child {
      margin-bottom: 0;
    }

    .section[data-keep="compact"],
    .entry-lead,
    .proposal-block--closing,
    .proposal-block--salutation {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-title {
      margin: 0 0 var(--flow-stack-gap);
      display: inline-flex;
      align-items: center;
      gap: 1.15mm;
      font-family: var(--decor-section-title-font-family, var(--heading-font));
      font-size: var(--flow-label-size);
      line-height: var(--flow-label-line);
      font-weight: var(--decor-section-title-font-weight, 700);
      text-transform: var(--decor-section-title-text-transform, uppercase);
      letter-spacing: var(--decor-section-title-letter-spacing, 0.14em);
      color: var(--accent);
    }

    .section-title-icon {
      flex: 0 0 auto;
    }

    .section-title-icon svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .section--ruled {
      border-top: var(--decor-section-rule-width) solid var(--line);
      padding-top: var(--flow-rule-pad-top);
    }

    .meta-list {
      display: grid;
      gap: var(--flow-list-gap);
      margin: 0;
      padding: 0;
      list-style: none;
      min-width: 0;
      max-width: 100%;
    }

    .meta-item {
      min-width: 0;
    }

    .meta-label {
      display: block;
      margin-bottom: var(--flow-list-gap);
      font-family: var(--decor-meta-label-font-family, var(--heading-font));
      font-size: var(--flow-label-size);
      line-height: var(--flow-label-line);
      text-transform: var(--decor-meta-label-text-transform, uppercase);
      letter-spacing: var(--decor-meta-label-letter-spacing, 0.12em);
      color: var(--muted);
    }

    .meta-value {
      display: block;
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-meta-size);
      line-height: var(--flow-meta-line);
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--flow-tag-row-gap) var(--flow-tag-gap);
      margin: 0;
      padding: 0;
      list-style: none;
      min-width: 0;
      max-width: 100%;
      align-content: flex-start;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      max-width: 100%;
      border: var(--decor-tag-border-width) solid var(--line);
      border-radius: var(--decor-tag-border-radius);
      padding: var(--flow-tag-pad-block) var(--flow-tag-pad-inline);
      font-size: var(--flow-label-size);
      line-height: var(--flow-label-line);
      background: var(--tag-fill);
      overflow-wrap: anywhere;
      text-align: left;
    }

    .compact-list {
      display: grid;
      gap: var(--flow-list-gap);
      margin: 0;
      padding: 0 0 0 var(--flow-list-indent);
    }

    .compact-list li {
      font-size: var(--flow-body-sm-size);
      line-height: var(--flow-body-sm-line);
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .entry {
      margin-bottom: var(--flow-entry-gap);
    }

    .entry-lead {
      display: grid;
      gap: var(--flow-entry-head-gap);
    }

    .entry-head {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        fit-content(var(--flow-entry-meta-width));
      gap: var(--flow-entry-gap);
      align-items: start;
    }

    .entry-head > * {
      min-width: 0;
    }

    .entry-headline {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: var(--flow-entry-head-gap);
      min-width: 0;
    }

    .entry-continuation {
      font-family: var(--decor-meta-label-font-family, var(--heading-font));
      font-size: var(--flow-label-size);
      line-height: var(--flow-label-line);
      font-weight: 700;
      letter-spacing: var(--decor-meta-label-letter-spacing, 0.12em);
      text-transform: var(--decor-meta-label-text-transform, uppercase);
      color: var(--muted);
      white-space: nowrap;
    }

    .entry-title {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-family: var(--decor-entry-title-font-family, var(--body-font));
      font-size: var(--flow-body-size);
      line-height: var(--flow-meta-line);
      font-weight: var(--decor-entry-title-font-weight, 700);
      overflow-wrap: anywhere;
    }

    .entry-meta {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-meta-size);
      line-height: var(--flow-meta-line);
      font-style: var(--decor-entry-meta-font-style, normal);
      color: var(--muted);
      text-align: right;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .entry-summary,
    .proposal-block {
      margin: 0 0 var(--flow-entry-head-gap);
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-body-size);
      line-height: var(--flow-body-line);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .bullet-list {
      display: grid;
      gap: var(--flow-list-gap);
      margin: 0;
      padding: 0 0 0 var(--flow-list-indent);
    }

    .bullet-list li {
      line-height: var(--flow-body-line);
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .bullet-list--document-icons {
      padding-left: 0;
      list-style: none;
    }

    .compact-list--document-icons {
      padding-left: 0;
      list-style: none;
    }

    .bullet-list--document-icons li,
    .compact-list--document-icons li {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      column-gap: 0.72em;
      align-items: start;
    }

    .bullet-list-marker {
      transform: translateY(0.14em);
      flex: 0 0 auto;
    }

    .bullet-list-marker svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .proposal-topline {
      display: grid;
      grid-template-columns: minmax(0, 1fr) fit-content(var(--flow-proposal-meta-width));
      gap: var(--flow-header-gap);
      align-items: start;
    }

    .proposal-topline > * {
      min-width: 0;
    }

    .proposal-meta {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-meta-size);
      line-height: var(--flow-meta-line);
      font-style: var(--decor-proposal-meta-font-style, normal);
      color: var(--muted);
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .proposal-main-stack {
      display: grid;
      gap: var(--flow-proposal-gap);
      max-width: var(--flow-reading-measure);
      min-width: 0;
    }

    .proposal-list {
      display: grid;
      gap: calc(var(--flow-list-gap) * 0.92);
      margin: 0 0 var(--flow-entry-head-gap);
      padding: 0;
      list-style: none;
      min-width: 0;
      max-width: 100%;
      font-size: var(--flow-body-size);
      line-height: var(--flow-body-line);
      overflow-wrap: anywhere;
    }

    .proposal-list li {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      column-gap: 0.72em;
      align-items: start;
      min-width: 0;
    }

    .proposal-list-marker {
      transform: translateY(0.14em);
    }

    .proposal-list-marker svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .proposal-inline-icon {
      display: inline-flex;
      width: 1em;
      height: 1em;
      margin-inline: 0.16em;
      vertical-align: -0.14em;
    }

    .proposal-inline-icon svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .proposal-block--subject {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      font-family: var(--heading-font);
      font-size: var(--flow-subtitle-size);
      line-height: var(--flow-meta-line);
      font-weight: 700;
      color: var(--ink);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .proposal-block--closing {
      margin-top: var(--flow-closing-gap);
      display: grid;
      gap: 0;
      min-width: 0;
    }

    .proposal-signoff,
    .proposal-signature {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .proposal-signoff {
      break-after: avoid;
      page-break-after: avoid;
      font-style: var(--decor-signoff-font-style, normal);
    }

    .proposal-signature {
      margin-top: var(--flow-closing-name-gap);
      font-family: var(--proposal-signature-font-family, var(--body-font));
      font-weight: var(--decor-signature-font-weight, 700);
      text-transform: var(--decor-signature-text-transform, none);
      font-variant-caps: var(--decor-signature-font-variant-caps, normal);
      letter-spacing: var(--decor-signature-letter-spacing, normal);
    }

    .proposal-signature-image {
      display: block;
      max-width: min(42mm, 64%);
      max-height: 13.75mm;
      width: auto;
      height: auto;
      object-fit: contain;
      opacity: 1;
      filter: contrast(1.35) saturate(0.15) brightness(0.75);
      mix-blend-mode: multiply;
      margin-top: var(--flow-closing-name-gap);
    }

    .resume-shell--onecol .export-page,
    .proposal-shell--onecol .export-page {
      display: grid;
      gap: var(--flow-header-gap);
      align-content: start;
    }

    .resume-shell--onecol .export-header,
    .proposal-shell--onecol .export-header {
      display: grid;
      gap: var(--flow-stack-gap);
      min-width: 0;
      border-bottom: var(--decor-header-border-width) solid var(--header-rule);
      padding-bottom: var(--flow-rule-pad-top);
    }

    .resume-shell--onecol .section--ruled,
    .proposal-shell--onecol .section--ruled {
      border-top-color: var(--line);
    }

    .proposal-shell--onecol .proposal-main-stack {
      gap: var(--flow-proposal-gap);
    }

    body.resume-export.resume-layout--editorial.resume--styled .export-header,
    body.resume-export.resume-layout--quire.resume--styled .export-header,
    body.proposal-export.proposal-template--editorial-wide.proposal--styled .export-header,
    body.proposal-export.proposal-template--quire-margin.proposal--styled .export-header {
      box-shadow: var(--decor-header-aux-shadow, none);
    }
${appearanceOnlyCss}
  `;
}

function buildHtmlDocument(args: {
  bodyClassName: string;
  bodyMarkup: string;
  documentKind: "proposal" | "resume";
  lang?: string | null;
  mode: ExportMode;
  pageSize?: DocumentPageSize | null;
  proposalTemplateId?: ProposalTemplateId | null;
  resumeTemplateId?: ResumePrintSource["resumeTemplateId"] | null;
  stylePreset?: VerbatiStylePreset | null;
  title: string;
}): string {
  return `<!doctype html>
<html lang="${escapeHtml(getExportHtmlLang(args.lang))}" dir="${escapeHtml(getExportHtmlDir(args.lang))}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(args.title)}</title>
    <style>${getLocalFontFaceCss()}</style>
    <style>${buildPageCss({
      documentKind: args.documentKind,
      lang: args.lang,
      mode: args.mode,
      pageSize: args.pageSize,
      proposalTemplateId: args.proposalTemplateId,
      resumeTemplateId: args.resumeTemplateId,
      stylePreset: args.stylePreset,
    })}</style>
  </head>
  <body class="${escapeHtml(args.bodyClassName)}" data-export-mode="${escapeHtml(args.mode)}">
    ${args.bodyMarkup}
  </body>
</html>`;
}

function renderResumeItems(args: {
  items: ResumePrintItem[];
  locale?: string | null;
}): string {
  if (args.items.length === 0) {
    return "";
  }

  return `<ul class="meta-list">${args.items
    .map(
      (item) => `<li class="meta-item">
        <span class="meta-label">${escapeHtml(localizeStructuredLabel(item.label, args.locale))}</span>
        <span class="meta-value">${escapeHtml(item.value)}</span>
      </li>`,
    )
    .join("")}</ul>`;
}

function renderResumeTagList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  return `<ul class="tag-list">${values
    .map((value) => `<li class="tag">${escapeHtml(value)}</li>`)
    .join("")}</ul>`;
}

function renderResumeDocumentListMarkerHtml(
  settings: DocumentIconSettings | null | undefined,
  overrides?: DocumentIconOverrides | null,
  target?: DocumentListItemIconOverrideTarget | null,
): string {
  if (!settings) return "";
  const documentIconSettings = normalizeDocumentIconSettings(settings);
  const overrideIconKey = resolveDocumentListItemIconOverride(overrides, target);
  return renderDocumentIconHtml({
    iconKey: overrideIconKey ?? resolveDefaultListMarkerIconKey(documentIconSettings),
    color: documentIconSettings.color,
    sizePt: documentIconSettings.sizePt,
    className: "bullet-list-marker",
  });
}

function renderResumeListItem(args: {
  content: string;
  id?: string | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
  markerTarget?: DocumentListItemIconOverrideTarget | null;
}): string {
  const markerMarkup = renderResumeDocumentListMarkerHtml(
    args.documentIconSettings,
    args.documentIconOverrides,
    args.markerTarget,
  );
  const idAttr = args.id ? ` data-export-item-id="${escapeHtml(args.id)}"` : "";
  if (!markerMarkup) {
    return `<li${idAttr}>${args.content}</li>`;
  }
  return `<li${idAttr}>${markerMarkup}<span>${args.content}</span></li>`;
}

function getDocumentListClassName(args: {
  baseClassName: "bullet-list" | "compact-list";
  documentIconSettings?: DocumentIconSettings | null;
}): string {
  return args.documentIconSettings
    ? `${args.baseClassName} ${args.baseClassName}--document-icons`
    : args.baseClassName;
}

function renderResumeCompactList(args: {
  items: Array<{ text: string; id?: string }>;
  sectionId?: string | null;
  sectionType?: string | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
}): string {
  if (args.items.length === 0) {
    return "";
  }

  return `<ul class="${getDocumentListClassName({
    baseClassName: "compact-list",
    documentIconSettings: args.documentIconSettings,
  })}">${args.items
    .map((item) =>
      renderResumeListItem({
        id: item.id,
        content: escapeHtml(item.text),
        documentIconSettings: args.documentIconSettings,
        documentIconOverrides: args.documentIconOverrides,
        markerTarget: {
          sectionId: args.sectionId,
          sectionType: args.sectionType,
          itemId: item.id,
          field: "item",
        },
      }),
    )
    .join("")}</ul>`;
}

function renderSection(args: {
  block: string;
  content: string;
  locale?: string | null;
  ruled?: boolean;
  keep?: boolean;
  titleKey: string;
  documentIconSettings?: DocumentIconSettings | null;
}) {
  if (!args.content) {
    return "";
  }

  const title = getLocalizedExportLabel(args.titleKey, args.locale);
  const documentIconSettings = normalizeDocumentIconSettings(
    args.documentIconSettings,
  );
  const iconKey = resolveSectionHeadingIconKey({
    settings: documentIconSettings,
    sectionType: args.block,
    sectionTitle: title,
  });
  const iconMarkup = renderDocumentIconHtml({
    iconKey,
    color: documentIconSettings.color,
    sizePt: documentIconSettings.sizePt,
    className: "section-title-icon",
  });

  return `<section class="${joinClassNames([
    "section",
    `section--${args.block}`,
    args.ruled ? "section--ruled" : "",
  ])}" data-block="${escapeHtml(args.block)}"${args.keep ? ' data-keep="compact"' : ""}>
    <h2 class="section-title">${iconMarkup}${escapeHtml(title)}</h2>
    ${args.content}
  </section>`;
}

function getCommittedWorkshopPagesOrThrow(
  data: ResumePrintSource,
): NonNullable<ResumePrintSource["committedPages"]> {
  if (!isWorkshopResumeTemplateId(data.resumeTemplateId)) {
    return [];
  }

  if (!data.committedPages || data.committedPages.length === 0) {
    throw new Error(
      "Committed workshop export pages are required for workshop export rendering.",
    );
  }

  return data.committedPages;
}

function renderWorkshopProfileFragment(args: {
  fragment: Extract<
    NonNullable<ResumePrintSource["committedPages"]>[number]["fragments"][number],
    { kind: "profile" }
  >;
  locale?: string | null;
}): string {
  const contactMarkup = renderResumeItems({
    items: args.fragment.contact,
    locale: args.locale,
  });
  const metadataMarkup = renderResumeItems({
    items: args.fragment.metadata,
    locale: args.locale,
  });

  return `<header class="export-header" data-block="header" data-export-fragment-id="${escapeHtml(args.fragment.fragmentId)}">
    <div>
      <h1 class="doc-name">${escapeHtml(args.fragment.profile.name)}</h1>
      ${
        args.fragment.profile.title
          ? `<p class="doc-title">${escapeHtml(args.fragment.profile.title)}</p>`
          : ""
      }
    </div>
    ${
      contactMarkup
        ? `<div>${contactMarkup}</div>`
        : ""
    }
    ${
      metadataMarkup
        ? `<div>${metadataMarkup}</div>`
        : ""
    }
  </header>`;
}

type WorkshopCommittedExperienceFragment = Extract<
  NonNullable<ResumePrintSource["committedPages"]>[number]["fragments"][number],
  { kind: "experience" }
>;

type WorkshopCommittedExperienceItem =
  WorkshopCommittedExperienceFragment["items"][number];

function renderWorkshopResponsibilityRun(
  run: WorkshopResponsibilityTextRun,
): string {
  let content = escapeHtml(run.text);

  if (run.underline) {
    content = `<u>${content}</u>`;
  }

  if (run.italic) {
    content = `<em>${content}</em>`;
  }

  if (run.bold) {
    content = `<strong>${content}</strong>`;
  }

  return content;
}

function workshopResponsibilitiesRichHasPartialContent(
  rich: NonNullable<WorkshopCommittedExperienceItem["responsibilitiesRich"]>,
): boolean {
  return rich.blocks.some((block) => {
    if (block.kind === "paragraph") {
      return block.partial === true;
    }

    return block.items.some((item) => item.partial === true);
  });
}

function renderWorkshopExperienceBlocksFallback(
  blocks: WorkshopCommittedExperienceItem["blocks"],
  documentIconSettings?: DocumentIconSettings | null,
  documentIconOverrides?: DocumentIconOverrides | null,
  markerTargetBase?: DocumentListItemIconOverrideTarget | null,
): string {
  const blockMarkup: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) {
      return;
    }

    blockMarkup.push(
      `<ul class="${getDocumentListClassName({
        baseClassName: "bullet-list",
        documentIconSettings,
      })}">${bulletBuffer
        .map((bullet, bulletIndex) =>
          renderResumeListItem({
            content: escapeHtml(bullet),
            documentIconSettings,
            documentIconOverrides,
            markerTarget: {
              ...markerTargetBase,
              field: markerTargetBase?.field ?? "responsibilities",
              itemIndex: bulletIndex,
            },
          }),
        )
        .join("")}</ul>`,
    );
    bulletBuffer = [];
  };

  blocks.forEach((block) => {
    if (block.kind === "bullet") {
      bulletBuffer.push(block.text);
      return;
    }

    flushBullets();
    blockMarkup.push(
      `<p class="entry-summary">${escapeHtml(block.text)}</p>`,
    );
  });
  flushBullets();

  return blockMarkup.join("");
}

function renderWorkshopRichContent(
  rich:
    | WorkshopResponsibilitiesRichContent
    | NonNullable<WorkshopCommittedExperienceItem["responsibilitiesRich"]>,
  documentIconSettings?: DocumentIconSettings | null,
  documentIconOverrides?: DocumentIconOverrides | null,
  markerTargetBase?: DocumentListItemIconOverrideTarget | null,
): string {
  return rich.blocks
    .map((block, blockIndex) => {
      if (block.kind === "paragraph") {
        return `<p class="entry-summary">${block.runs
          .map((run) => renderWorkshopResponsibilityRun(run))
          .join("")}</p>`;
      }

      return `<ul class="${getDocumentListClassName({
        baseClassName: "bullet-list",
        documentIconSettings,
      })}">${block.items
        .map(
          (item) =>
            renderResumeListItem({
              content: item.runs
                .map((run) => renderWorkshopResponsibilityRun(run))
                .join(""),
              documentIconSettings,
              documentIconOverrides,
              markerTarget: {
                ...markerTargetBase,
                field: markerTargetBase?.field ?? "responsibilities",
                blockIndex,
                itemIndex:
                  "sourceItemIndex" in item ? item.sourceItemIndex : undefined,
              },
            }),
        )
        .join("")}</ul>`;
    })
    .join("");
}

function renderWorkshopExperienceContent(
  item: WorkshopCommittedExperienceItem,
  sectionId?: string | null,
  sectionType?: string | null,
  documentIconSettings?: DocumentIconSettings | null,
  documentIconOverrides?: DocumentIconOverrides | null,
): string {
  const markerTargetBase: DocumentListItemIconOverrideTarget = {
    sectionId,
    sectionType: sectionType ?? "experience",
    itemId: item.id,
    field: "responsibilities",
  };
  const rich = item.responsibilitiesRich;
  if (
    !rich ||
    rich.blocks.length === 0 ||
    item.continued ||
    item.blocks.some((block) => block.partial === true) ||
    workshopResponsibilitiesRichHasPartialContent(rich)
  ) {
    return renderWorkshopExperienceBlocksFallback(
      item.blocks,
      documentIconSettings,
      documentIconOverrides,
      markerTargetBase,
    );
  }

  return renderWorkshopRichContent(
    rich,
    documentIconSettings,
    documentIconOverrides,
    markerTargetBase,
  );
}

function renderWorkshopFragment(args: {
  fragment: NonNullable<ResumePrintSource["committedPages"]>[number]["fragments"][number];
  locale?: string | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
}): string {
  const { fragment, locale, documentIconSettings, documentIconOverrides } = args;

  switch (fragment.kind) {
    case "profile":
      return renderWorkshopProfileFragment({ fragment, locale });
    case "summary":
      return renderSection({
        block: "summary",
        content: fragment.summaryRich
          ? renderWorkshopRichContent(
              fragment.summaryRich,
              documentIconSettings,
              documentIconOverrides,
              {
                sectionId: fragment.sectionId,
                sectionType: fragment.sectionType,
                itemId: fragment.sectionId ?? "summary",
                field: "summary",
              },
            )
          : `<p class="entry-summary">${escapeHtml(fragment.text)}</p>`,
        locale,
        titleKey: "summary",
        documentIconSettings,
      });
    case "experience":
      return renderSection({
        block: "experience",
        content: fragment.items
          .map(
            (item) => {
              return `<article class="entry entry--experience" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                <div class="entry-head">
                  <div class="entry-headline">
                    <h3 class="entry-title">${escapeHtml(item.role)}</h3>
                    ${item.continued ? '<span class="entry-continuation">Continued</span>' : ""}
                  </div>
                  <p class="entry-meta">${escapeHtml(
                    [item.company, item.location, item.period].filter(Boolean).join(" · "),
                  )}</p>
                </div>
              </div>
              ${renderWorkshopExperienceContent(
                item,
                fragment.sectionId,
                fragment.sectionType,
                documentIconSettings,
                documentIconOverrides,
              )}
            </article>`;
            },
          )
          .join(""),
        locale,
        titleKey: "experience",
        documentIconSettings,
      });
    case "education":
      return renderSection({
        block: "education",
        content: fragment.items
          .map((item) => {
            const educationDisplay = buildResumeEducationDisplay(item);
            return `<article class="entry entry--education" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(educationDisplay.title)}</h3>
                  <p class="entry-meta">${escapeHtml(educationDisplay.period)}</p>
                </div>
                <p class="entry-summary">${escapeHtml(educationDisplay.subtitle)}</p>
              </div>
            </article>`;
          })
          .join(""),
        locale,
        titleKey: "education",
        documentIconSettings,
      });
    case "skills":
      return renderSection({
        block: "skills",
        content: renderResumeTagList(
          fragment.items.map((item) =>
            item.level ? `${item.name} (${item.level})` : item.name,
          ),
        ),
        keep: true,
        locale,
        ruled: true,
        titleKey: "skills",
        documentIconSettings,
      });
    case "selected_projects":
      return renderSection({
        block: "projects",
        content: fragment.items
          .map(
            (item) => `<article class="entry entry--project" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(item.name)}</h3>
                  <p class="entry-meta">${escapeHtml(item.meta)}</p>
                </div>
                ${item.descriptionRich
                  ? renderWorkshopRichContent(
                      item.descriptionRich,
                      documentIconSettings,
                      documentIconOverrides,
                      {
                        sectionId: fragment.sectionId,
                        sectionType: fragment.sectionType,
                        itemId: item.id,
                        field: "description",
                      },
                    )
                  : `<p class="entry-summary">${escapeHtml(item.description)}</p>`}
              </div>
            </article>`,
          )
          .join(""),
        locale,
        titleKey: "projects",
        documentIconSettings,
      });
    case "languages":
      return renderSection({
        block: "languages",
        content: renderResumeCompactList({
          items: fragment.items.map((item) => ({
            id: item.id,
            text: [
              item.name,
              item.level || localizeStructuredLabel("Working proficiency", locale),
            ]
              .filter(Boolean)
              .join(" · "),
          })),
          sectionId: fragment.sectionId,
          sectionType: "languages",
          documentIconSettings,
          documentIconOverrides,
        }),
        keep: true,
        locale,
        ruled: true,
        titleKey: "languages",
        documentIconSettings,
      });
    case "certifications":
      return renderSection({
        block: "certifications",
        content: fragment.items
          .map(
            (item) => `<article class="entry entry--certification" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(item.name)}</h3>
                  <p class="entry-meta">${escapeHtml(
                    [item.issuer, item.meta].filter(Boolean).join(" · "),
                  )}</p>
                </div>
              </div>
            </article>`,
          )
          .join(""),
        locale,
        titleKey: "certifications",
        documentIconSettings,
      });
    case "achievements":
      return renderSection({
        block: "achievements",
        content: `<ul class="${getDocumentListClassName({
          baseClassName: "bullet-list",
          documentIconSettings,
        })}">${fragment.items
          .map((item) =>
            renderResumeListItem({
              id: item.id,
              content: escapeHtml(item.text),
              documentIconSettings,
              documentIconOverrides,
              markerTarget: {
                sectionId: fragment.sectionId,
                sectionType: "achievements",
                itemId: item.id,
                field: "item",
              },
            }),
          )
          .join("")}</ul>`,
        locale,
        titleKey: "achievements",
        documentIconSettings,
      });
    case "affiliations":
      return renderSection({
        block: "affiliations",
        content: fragment.items
          .map(
            (item) => `<article class="entry entry--affiliation" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                <div class="entry-head">
                  <h3 class="entry-title">${escapeHtml(item.organizationName)}</h3>
                  <p class="entry-meta">${escapeHtml(
                    [item.roleOrMembershipType, item.dateRange].filter(Boolean).join(" · "),
                  )}</p>
                </div>
                ${item.notes ? `<p class="entry-summary">${escapeHtml(item.notes)}</p>` : ""}
              </div>
            </article>`,
          )
          .join(""),
        locale,
        titleKey: "affiliations",
        documentIconSettings,
      });
    case "hobbies":
      return renderSection({
        block: "interests",
        content: renderResumeCompactList({
          items: fragment.items.map((item) => ({
            id: item.id,
            text: item.name,
          })),
          sectionId: fragment.sectionId,
          sectionType: "hobbies",
          documentIconSettings,
          documentIconOverrides,
        }),
        keep: true,
        locale,
        ruled: true,
        titleKey: "interests",
        documentIconSettings,
      });
    case "additional_information":
      return renderSection({
        block: "additional_information",
        content: fragment.items
          .map(
            (item) => `<article class="entry entry--text-section" data-export-item-id="${escapeHtml(item.id)}">
              <div class="entry-lead">
                ${
                  item.sectionTitle
                    ? `<div class="entry-head"><h3 class="entry-title">${escapeHtml(item.sectionTitle)}</h3></div>`
                    : ""
                }
                <p class="entry-summary">${escapeHtml(item.text)}</p>
              </div>
            </article>`,
          )
          .join(""),
        locale,
        titleKey: fragment.title || "additional_information",
        documentIconSettings,
      });
  }
}

function renderWorkshopTwoColumnPage(args: {
  page: NonNullable<ResumePrintSource["committedPages"]>[number];
  locale?: string | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
}): string {
  const header: string[] = [];
  const sidebar: string[] = [];
  const main: string[] = [];

  args.page.fragments.forEach((fragment) => {
    const markup = renderWorkshopFragment({
      fragment,
      locale: args.locale,
      documentIconSettings: args.documentIconSettings,
      documentIconOverrides: args.documentIconOverrides,
    });
    const lane = resolveWorkshopTwoColumnFragmentLane(fragment);
    if (lane === "header") {
      header.push(markup);
    } else if (lane === "sidebar") {
      sidebar.push(markup);
    } else {
      main.push(markup);
    }
  });

  const headerMarkup = header.length > 0
    ? `<div class="resume-workshop-twocol-header">${header.join("")}</div>`
    : "";

  return `<article class="resume-styled-page resume-styled-page--workshop-twocol" data-export-page-id="${escapeHtml(args.page.pageId)}">
    ${headerMarkup}
    <div class="resume-workshop-twocol-grid">
      <aside class="resume-workshop-twocol-sidebar">${sidebar.join("")}</aside>
      <main class="resume-workshop-twocol-main">${main.join("")}</main>
    </div>
  </article>`;
}

function renderResumeHtml(args: {
  data: ResumePrintSource;
  mode: ExportMode;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const locale = args.data.locale;
  const normalizedStylePreset = normalizeStylePreset(args.stylePreset);
  const resumeTemplateClassName = formatTemplateClassName(
    args.data.resumeTemplateId,
  );
  const profile = resolveResumeExportProfile({
    mode: args.mode,
    pageSize: args.data.pageSize,
    resumeTemplateId: args.data.resumeTemplateId,
    stylePreset: args.stylePreset,
  });
  if (
    isWorkshopResumeTemplateId(args.data.resumeTemplateId) &&
    !(isWorkshopTwoColumnResumeTemplateId(args.data.resumeTemplateId) && args.mode === "ats")
  ) {
    const committedPages = getCommittedWorkshopPagesOrThrow(args.data);
    const workshopBodyMarkup = committedPages
      .map((page) => {
        const pageMarkup = isWorkshopTwoColumnResumeTemplateId(
          args.data.resumeTemplateId,
        )
          ? renderWorkshopTwoColumnPage({
              page,
              locale,
              documentIconSettings:
                args.mode === "styled" ? args.data.documentIconSettings : null,
              documentIconOverrides:
                args.mode === "styled" ? args.data.documentIconOverrides : null,
            })
          : `<article class="resume-styled-page" data-export-page-id="${escapeHtml(page.pageId)}">
            ${page.fragments
              .map((fragment) =>
                renderWorkshopFragment({
                  fragment,
                  locale,
                  documentIconSettings:
                    args.mode === "styled"
                      ? args.data.documentIconSettings
                      : null,
                  documentIconOverrides:
                    args.mode === "styled"
                      ? args.data.documentIconOverrides
                      : null,
                }),
              )
              .join("")}
          </article>`;

        return `<main class="export-page" data-export-doc="resume" data-export-page-index="${page.index + 1}" data-resume-template="${escapeHtml(args.data.resumeTemplateId)}">
          ${pageMarkup}
        </main>`;
      })
      .join("");

    return buildHtmlDocument({
      bodyClassName: joinClassNames([
        "resume-export",
        `resume--${args.mode}`,
        `resume-layout--${normalizedStylePreset.layout}`,
        resumeTemplateClassName
          ? `resume-template--${resumeTemplateClassName}`
          : null,
        `resume-shell--${profile.shell}`,
      ]),
      bodyMarkup: workshopBodyMarkup,
      documentKind: "resume",
      lang: args.data.locale,
      mode: args.mode,
      pageSize: args.data.pageSize,
      resumeTemplateId: args.data.resumeTemplateId,
      stylePreset: args.stylePreset,
      title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
    });
  }
  const contactSection = renderSection({
    block: "contact",
    content: renderResumeItems({ items: args.data.contact, locale }),
    keep: true,
    locale,
    ruled: true,
    titleKey: "contact",
  });
  const detailsSection = renderSection({
    block: "details",
    content: renderResumeItems({ items: args.data.metadata, locale }),
    keep: true,
    locale,
    ruled: true,
    titleKey: "details",
  });
  const skillsSection = renderSection({
    block: "skills",
    content: renderResumeTagList(args.data.skills),
    keep: true,
    locale,
    ruled: true,
    titleKey: "skills",
  });
  const languagesSection = renderSection({
    block: "languages",
    content: renderResumeItems({
      items: args.data.languages.map((item) => ({
        label: item.name,
        value:
          item.level || localizeStructuredLabel("Working proficiency", locale),
      })),
      locale,
    }),
    keep: true,
    locale,
    ruled: true,
    titleKey: "languages",
  });

  const isEditorialSidebarResume =
    args.data.resumeTemplateId === EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID;
  const renderExperienceTitle = (item: {
    role: string;
    company: string;
  }): string => {
    if (!isEditorialSidebarResume) {
      return `<h3 class="entry-title">${escapeHtml(
        [item.role, item.company].filter(Boolean).join(" · "),
      )}</h3>`;
    }

    const companyMarkup = item.company
      ? `<span class="entry-company">${escapeHtml(item.company)}</span>`
      : "";
    const separatorMarkup = item.company && item.role
      ? `<span class="entry-title-separator">, </span>`
      : "";
    const roleMarkup = item.role
      ? `<span class="entry-role">${escapeHtml(item.role)}</span>`
      : "";

    return `<h3 class="entry-title entry-title--editorial-sidebar">${companyMarkup}${separatorMarkup}${roleMarkup}</h3>`;
  };

  const experienceContent = args.data.experience
    .map(
      (item) => `<article class="entry entry--experience">
        <div class="entry-lead">
          <div class="entry-head">
            ${renderExperienceTitle(item)}
            <p class="entry-meta">${escapeHtml(
              [item.period, item.location].filter(Boolean).join("\n"),
            )}</p>
          </div>
          ${item.summary ? `<p class="entry-summary">${escapeHtml(item.summary)}</p>` : ""}
        </div>
        ${
          nonEmptyTextValues(item.bullets).length > 0
            ? `<ul class="bullet-list">${nonEmptyTextValues(item.bullets)
                .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
                .join("")}</ul>`
            : ""
        }
      </article>`,
    )
    .join("");

  const projectContent = args.data.projects
    .map(
      (item) => `<article class="entry entry--project">
        <div class="entry-lead">
          <div class="entry-head">
            <h3 class="entry-title">${escapeHtml(item.name)}</h3>
            <p class="entry-meta">${escapeHtml(item.meta)}</p>
          </div>
          <p class="entry-summary">${escapeHtml(item.description)}</p>
        </div>
      </article>`,
    )
    .join("");

  const educationContent = args.data.education
    .map((item) => {
      const educationDisplay = buildResumeEducationDisplay(item);
      return `<article class="entry entry--education">
        <div class="entry-lead">
          <div class="entry-head">
            <h3 class="entry-title">${escapeHtml(educationDisplay.title)}</h3>
            <p class="entry-meta">${escapeHtml(educationDisplay.period)}</p>
          </div>
          <p class="entry-summary">${escapeHtml(educationDisplay.subtitle)}</p>
        </div>
      </article>`;
    })
    .join("");

  const experienceSection = renderSection({
    block: "experience",
    content: experienceContent,
    locale,
    titleKey: "experience",
  });
  const projectSection = renderSection({
    block: "projects",
    content: projectContent,
    locale,
    titleKey: "projects",
  });
  const educationSection = renderSection({
    block: "education",
    content: educationContent,
    locale,
    titleKey: "education",
  });
  const achievementsSection = renderSection({
    block: "achievements",
    content:
      nonEmptyTextValues(args.data.achievements).length > 0
        ? `<ul class="bullet-list">${nonEmptyTextValues(args.data.achievements)
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "",
    locale,
    titleKey: "achievements",
  });
  const interestsSection = renderSection({
    block: "interests",
    content:
      args.data.hobbies.length > 0
        ? `<p class="entry-summary">${escapeHtml(args.data.hobbies.join(" · "))}</p>`
        : "",
    locale,
    titleKey: "interests",
  });
  const nameMarkup = `<h1 class="doc-name">${escapeHtml(args.data.profile.name)}</h1>`;
  const titleMarkup = args.data.profile.title
    ? `<p class="doc-title">${escapeHtml(args.data.profile.title)}</p>`
    : "";
  const summaryMarkup = args.data.profile.summary
    ? `<p class="doc-summary" data-block="summary">${escapeHtml(args.data.profile.summary)}</p>`
    : "";
  const identityMarkup = [nameMarkup, titleMarkup].filter(Boolean).join("\n");
  const headerMarkup = [identityMarkup, summaryMarkup].filter(Boolean).join("\n");
  const splitSidebarSections = [
    contactSection,
    detailsSection,
    skillsSection,
    languagesSection,
  ]
    .filter(Boolean)
    .join("");
  const splitMainSections = [
    experienceSection,
    projectSection,
    educationSection,
    achievementsSection,
    interestsSection,
  ]
    .filter(Boolean)
    .join("");
  const oneColumnSections = [
    contactSection,
    detailsSection,
    experienceSection,
    projectSection,
    educationSection,
    skillsSection,
    languagesSection,
    achievementsSection,
    interestsSection,
  ]
    .filter(Boolean)
    .join("");
  const editorialSidebarBodyMarkup =
    args.mode === "styled" &&
    args.data.resumeTemplateId === EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID &&
    profile.shell === "split"
      ? `<main class="export-page resume-export-page--editorial-sidebar" data-export-doc="resume" data-resume-template="${escapeHtml(EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID)}">
      <article class="resume-styled-page resume-styled-page--editorial-sidebar">
        <header class="resume-styled-header resume-styled-header--editorial-sidebar" data-block="header">
          <div class="resume-styled-header__identity resume-styled-header__identity--editorial-sidebar">
            ${identityMarkup}
          </div>
          ${
            summaryMarkup
              ? `<div class="resume-styled-header__summary resume-styled-header__summary--editorial-sidebar">${summaryMarkup}</div>`
              : ""
          }
        </header>
        <section class="resume-styled-columns resume-styled-columns--editorial-sidebar">
          <aside class="resume-styled-support resume-styled-support--editorial-sidebar">
            <div class="resume-sidebar-stack">${splitSidebarSections}</div>
          </aside>
          <section class="resume-styled-main resume-styled-main--editorial-sidebar">
            <div class="resume-main-stack">${splitMainSections}</div>
          </section>
        </section>
      </article>
    </main>`
      : null;
  const baselineBodyMarkup =
    editorialSidebarBodyMarkup ??
    (profile.shell === "onecol"
      ? `<main class="export-page" data-export-doc="resume">
      <header class="export-header" data-block="header">
        ${headerMarkup}
      </header>
      <section class="resume-main-stack">
        ${oneColumnSections}
      </section>
    </main>`
      : `<main class="export-page" data-export-doc="resume">
      <header class="robial-header" data-block="header">
        <div class="robial-header__full">
          ${headerMarkup}
        </div>
      </header>
      <section class="robial-body">
        <aside class="robial-sidebar">
          <div class="resume-sidebar-stack">${splitSidebarSections}</div>
        </aside>
        <section class="robial-main">
          <div class="resume-main-stack">${splitMainSections}</div>
        </section>
      </section>
    </main>`);
  return buildHtmlDocument({
    bodyClassName: joinClassNames([
      "resume-export",
      `resume--${args.mode}`,
      `resume-layout--${normalizedStylePreset.layout}`,
      resumeTemplateClassName
        ? `resume-template--${resumeTemplateClassName}`
        : null,
      `resume-shell--${profile.shell}`,
    ]),
    bodyMarkup: baselineBodyMarkup,
    documentKind: "resume",
    lang: args.data.locale,
    mode: args.mode,
    pageSize: args.data.pageSize,
    resumeTemplateId: args.data.resumeTemplateId,
    stylePreset: args.stylePreset,
    title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
  });
}

function renderProposalBlocks(
  blocks: ProposalPrintBlock[],
  locale?: string | null,
  signatureRender?: ReturnType<typeof resolveProposalSignatureRender>,
  documentIconSettings?: DocumentIconSettings | null,
): string {
  const resolvedDocumentIconSettings = normalizeDocumentIconSettings(
    documentIconSettings,
  );
  const listMarkerIconKey = resolveDefaultListMarkerIconKey(
    resolvedDocumentIconSettings,
  );
  const listMarkerType = resolvedDocumentIconSettings.listMarkerType ?? "dot";
  const renderInlineIconText = (text: string) =>
    parseDocumentIconTextSegments(text)
      .map((segment) => {
        if (segment.type === "text") return escapeHtml(segment.text);
        return renderDocumentIconHtml({
          iconKey: segment.iconKey,
          color: resolvedDocumentIconSettings.color,
          sizePt: resolvedDocumentIconSettings.sizePt,
          className: "proposal-inline-icon",
        });
      })
      .join("");

  return blocks
    .map((block) => {
      if (block.type === "list") {
        const blockMarkerType =
          block.marker?.type === "icon" ? "icon" : listMarkerType;
        const blockMarkerIconKey =
          block.marker?.type === "icon" ? block.marker.iconKey : listMarkerIconKey;
        const markerMarkup =
          blockMarkerType === "icon"
            ? renderDocumentIconHtml({
                iconKey: blockMarkerIconKey,
                color: resolvedDocumentIconSettings.color,
                sizePt: resolvedDocumentIconSettings.sizePt,
                className: "proposal-list-marker",
              })
            : `<span class="proposal-list-marker" aria-hidden="true">${
                blockMarkerType === "dash" ? "-" : "•"
              }</span>`;

        const hasItemIconOverride = block.items.some(
          (item) => typeof item !== "string" && Boolean(getDocumentIcon(item.iconKey)),
        );

        return `<ul class="proposal-block proposal-list proposal-list--${blockMarkerType}${
          blockMarkerType === "icon" || hasItemIconOverride
            ? " proposal-list--document-icons"
            : ""
        }" data-block="list">
          ${block.items
            .map((item) => {
              const itemText = typeof item === "string" ? item : item.text;
              const itemIconKey =
                typeof item === "string" || !getDocumentIcon(item.iconKey)
                  ? null
                  : item.iconKey;
              const itemMarker =
                typeof item === "string" ? block.marker ?? null : item.marker ?? block.marker ?? null;
              const itemMarkerType =
                itemMarker?.type === "icon" || blockMarkerType === "icon"
                  ? "icon"
                  : itemMarker?.type ?? blockMarkerType;
              const itemMarkerMarkup = itemIconKey
                ? renderDocumentIconHtml({
                    iconKey: itemIconKey,
                    color: resolvedDocumentIconSettings.color,
                    sizePt: resolvedDocumentIconSettings.sizePt,
                    className: "proposal-list-marker",
                  })
                : itemMarker
                ? itemMarkerType === "icon"
                  ? renderDocumentIconHtml({
                      iconKey: itemMarker.type === "icon"
                        ? itemMarker.iconKey
                        : blockMarkerIconKey,
                      color: resolvedDocumentIconSettings.color,
                      sizePt: resolvedDocumentIconSettings.sizePt,
                      className: "proposal-list-marker",
                    })
                  : `<span class="proposal-list-marker" aria-hidden="true">${
                      itemMarkerType === "dash" ? "-" : "•"
                    }</span>`
                : markerMarkup;
              return `<li>${itemMarkerMarkup}<span>${renderInlineIconText(itemText)}</span></li>`;
            })
            .join("")}
        </ul>`;
      }

      if (block.type === "closing") {
        const signatureName = block.signatureName
          ? formatProposalSignatureName(block.signatureName)
          : "";
        const signatureImageDataUrl =
          signatureRender?.kind === "image"
            ? signatureRender.imageDataUrl
            : signatureRender?.imageDataUrl;
        const handwrittenSignatureMarkup =
          signatureName &&
          block.handwrittenSignatureEnabled &&
          signatureImageDataUrl
            ? `<img class="proposal-signature-image" src="${escapeHtml(signatureImageDataUrl)}" alt="${escapeHtml(signatureName)}" />`
            : "";
        const typedSignatureMarkup = signatureName
          ? `<p class="proposal-signature" style="${escapeHtml(`--proposal-signature-font-family: ${
              signatureRender?.kind === "text"
                ? signatureRender.fontFamily
                : "var(--body-font)"
            };`)}">${escapeHtml(signatureName)}</p>`
          : "";
        const signatureMarkup = `${handwrittenSignatureMarkup}${typedSignatureMarkup}`;

        return `<div class="proposal-block proposal-block--closing" data-block="closing">
          ${
            block.signOff
              ? `<p class="proposal-signoff">${escapeHtml(block.signOff)}</p>`
              : ""
          }
          ${signatureMarkup}
        </div>`;
      }

      return `<p class="${joinClassNames([
        "proposal-block",
        block.type === "salutation" ? "proposal-block--salutation" : "",
      ])}">${renderInlineIconText(block.text)}</p>`;
    })
    .join("");
}

function joinExportNonEmpty(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function uniqueExportNonEmptyLines(
  parts: Array<string | null | undefined>,
  excludedParts: Array<string | null | undefined> = [],
): string[] {
  const excluded = new Set(
    excludedParts
      .map((part) => part?.trim().toLowerCase() ?? "")
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const lines: string[] = [];

  parts.forEach((part) => {
    const line = part?.trim() ?? "";
    const key = line.toLowerCase();
    if (!line || excluded.has(key) || seen.has(key)) {
      return;
    }
    seen.add(key);
    lines.push(line);
  });

  return lines;
}

function buildDirectorExportDigitalContactLines(
  parts: ReturnType<typeof parseProposalContactLine>,
): string[] {
  const values = uniqueExportNonEmptyLines([
    parts.email,
    parts.website,
    parts.linkedin,
    parts.other,
  ]);

  if (values.length <= 2) {
    return values;
  }

  return [values[0], values.slice(1).join(" · ")];
}

function renderExportParagraph(value: string, className: string): string {
  if (!value) {
    return "";
  }

  const classAttribute = className ? ` class="${className}"` : "";
  return `<p${classAttribute}>${escapeHtml(value)}</p>`;
}

function renderProposalDocumentDecoration(
  decoration: DocumentDecoration | null | undefined,
  pageSize?: DocumentPageSize,
  templateId?: ProposalTemplateId | null,
): string {
  const resolvedDecoration = getRenderableDocumentDecoration(
    resolveTemplateDocumentDecoration(decoration, templateId),
  );
  if (!resolvedDecoration) {
    return "";
  }
  const resolvedPageSize = resolveDocumentPageSize({ pageSize });
  const { xMm, yMm, sizeMm } = getDocumentDecorationPlacementMm(
    resolvedDecoration,
    {
      pageWidthMm: resolvedPageSize.widthMm,
      pageHeightMm: resolvedPageSize.heightMm,
    },
  );

  return `<div class="dasti-proposal-document-decoration" data-design-mode="false" data-decoration-size-mm="${sizeMm}" style="left: ${xMm}mm; top: ${yMm}mm; width: ${sizeMm}mm; height: ${sizeMm}mm; --proposal-decoration-object-fit: ${resolvedDecoration.fit};"><img src="${escapeHtml(resolvedDecoration.dataUrl ?? resolvedDecoration.resolvedUrl ?? "")}" alt="${escapeHtml(resolvedDecoration.alt ?? "")}" /></div>`;
}

function appendProposalDocumentDecoration(
  markup: string,
  decorationMarkup: string,
): string {
  if (!decorationMarkup) {
    return markup;
  }
  return markup.replace(/\s*<\/main>\s*$/, `\n      ${decorationMarkup}\n    </main>`);
}

const BAUHAUS_WORDMARK_MAX_COMPACT_CHARS = 8;

function countExportCompactWordmarkChars(value: string): number {
  return Array.from(value.replace(/\s+/g, "")).length;
}

function firstExportWordmarkToken(value: string): string {
  return value.trim().split(/\s+/u)[0] ?? "";
}

function resolveExportBauhausWordmark(args: {
  candidateCompany: string;
  candidateName: string;
  recipientCompany: string;
}): string {
  const fullTitle =
    args.candidateCompany || args.candidateName || args.recipientCompany;

  if (
    !fullTitle ||
    countExportCompactWordmarkChars(fullTitle) <= BAUHAUS_WORDMARK_MAX_COMPACT_CHARS
  ) {
    return fullTitle;
  }

  if (args.candidateCompany && args.candidateName) {
    return firstExportWordmarkToken(args.candidateName);
  }

  return firstExportWordmarkToken(fullTitle);
}

function normalizeExportJoellaDisplayText(
  value: string | null | undefined,
): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function lowercaseExportEnglishMonthNames(value: string): string {
  return value.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    (month) => month.toLowerCase(),
  );
}

function splitExportJoellaSubjectLine(value: string): {
  label: string;
  subject: string;
} {
  const index = value.indexOf(":");
  if (index === -1) {
    return { label: "", subject: value };
  }

  return {
    label: value.slice(0, index + 1),
    subject: value.slice(index + 1),
  };
}

function resolveExportJoellaWordmark(args: {
  candidateCompany: string;
  candidateName: string;
}): string {
  return normalizeExportJoellaDisplayText(
    args.candidateCompany || args.candidateName,
  );
}

function buildExportJoellaFooterLine(args: {
  location: string;
  email: string;
  phone: string;
}): string {
  return uniqueExportNonEmptyLines([args.location, args.email, args.phone])
    .map(normalizeExportJoellaDisplayText)
    .filter(Boolean)
    .join(" · ");
}

function buildExportBayerFooterLine(args: {
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueExportNonEmptyLines([
    args.phone,
    args.location,
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function splitExportTwoweeksNameLines(value: string): string[] {
  const line = value.trim();
  return line ? [line] : [];
}

function buildExportTwoweeksDigitalLine(args: {
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueExportNonEmptyLines([
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function normalizeExportTwoweeksDigitalIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function buildExportTwoweeksContactLines(args: {
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  website: string;
  other: string;
}): string[] {
  return uniqueExportNonEmptyLines([
    args.phone,
    normalizeExportTwoweeksDigitalIdentifier(args.email),
    normalizeExportTwoweeksDigitalIdentifier(args.linkedin),
    normalizeExportTwoweeksDigitalIdentifier(args.website),
    normalizeExportTwoweeksDigitalIdentifier(args.other),
    args.location,
  ]);
}

function buildExportJoellaHeaderContactLine(args: {
  phone: string;
  email: string;
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueExportNonEmptyLines([
    args.email,
    args.phone,
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function buildExportJoellaSubjectLine(args: {
  subject: string;
  candidateRole: string;
}): string {
  const subject = args.subject.trim();
  if (subject) {
    return `Subject: ${subject}`;
  }

  const role = args.candidateRole.trim();
  return role ? `Subject: Application for ${role}` : "";
}

const EXPORT_JOELLA_RECIPIENT_KNOWN_LABELS = new Set([
  "recipient",
  "name",
  "contact",
  "role",
  "title",
  "company",
  "organization",
  "address",
  "email",
  "mail",
  "city",
  "location",
  "phone",
  "telephone",
  "website",
  "portfolio",
]);

function normalizeExportJoellaRecipientLineKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeExportJoellaRecipientRawLine(line: string): string {
  const match = line.match(/^([A-Za-z][A-Za-z -]{0,32})\s*:\s*(.+)$/);
  if (!match) {
    return line;
  }

  return EXPORT_JOELLA_RECIPIENT_KNOWN_LABELS.has(match[1].toLowerCase())
    ? match[2].trim()
    : line;
}

function buildExportJoellaRecipientBlockLines(args: {
  recipientDetails?: string | null;
  recipientFields: ProposalRecipientFields;
  showDetails: boolean;
}): string[] {
  const primaryLines = [
    args.recipientFields.name,
    args.recipientFields.role,
    args.recipientFields.company,
  ];

  if (!args.showDetails) {
    return uniqueExportNonEmptyLines(primaryLines);
  }

  const fieldValues = [
    args.recipientFields.name,
    args.recipientFields.role,
    args.recipientFields.company,
    args.recipientFields.address,
    args.recipientFields.city,
    args.recipientFields.email,
  ];
  const fieldKeys = new Set(
    fieldValues
      .map((value) => normalizeExportJoellaRecipientLineKey(value))
      .filter(Boolean),
  );
  const extraLines = String(args.recipientDetails ?? "")
    .split("\n")
    .map((line) => normalizeExportJoellaRecipientRawLine(line.trim()))
    .filter((line) => {
      if (!line) {
        return false;
      }
      return !fieldKeys.has(normalizeExportJoellaRecipientLineKey(line));
    });

  return uniqueExportNonEmptyLines([
    ...primaryLines,
    args.recipientFields.email,
    args.recipientFields.address,
    args.recipientFields.city,
    ...extraLines,
  ]);
}

function renderExportJoellaLetterBlock(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
): string {
  const groups = [
    { kind: "sender", lines: viewModel.joellaLetterBlock.senderLines },
    viewModel.joellaLetterBlock.dateLine
      ? { kind: "date", lines: [viewModel.joellaLetterBlock.dateLine] }
      : null,
    { kind: "recipient", lines: viewModel.joellaLetterBlock.recipientLines },
    viewModel.joellaLetterBlock.subjectLine
      ? { kind: "subject", lines: [viewModel.joellaLetterBlock.subjectLine] }
      : null,
  ].filter(
    (group): group is { kind: string; lines: string[] } =>
      Boolean(group && group.lines.length > 0),
  );

  if (groups.length === 0) {
    return "";
  }

  return `<section class="proposal-cover-letter__joella-letter-block" aria-label="Letter details">${groups
    .map(
      (group) =>
        `<div class="proposal-cover-letter__joella-letter-block-group">${group.lines
          .map((line, lineIndex) => {
            const className = [
                lineIndex === 0 &&
                (group.kind === "sender" || group.kind === "recipient")
                  ? "proposal-cover-letter__joella-letter-block-line--strong"
                  : "",
                group.kind === "subject"
                  ? "proposal-cover-letter__joella-letter-block-line--subject"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
            if (group.kind !== "subject") {
              return renderExportParagraph(line, className);
            }

            const subjectLine = splitExportJoellaSubjectLine(line);
            return `<p class="${escapeHtml(className)}">${escapeHtml(
              subjectLine.label,
            )}<span class="proposal-cover-letter__joella-letter-block-subject-value">${escapeHtml(
              subjectLine.subject,
            )}</span></p>`;
          })
          .join("")}</div>`,
    )
    .join("")}</section>`;
}

function buildProposalLetterheadExportViewModel(
  data: ProposalPrintSource,
  locale?: string | null,
) {
  const recipientFields = parseProposalRecipientDetails(data.recipientDetails);
  const candidateName = data.applicantHeader.name.trim();
  const candidateRole = data.applicantHeader.role.trim() || data.documentMeta.trim();
  const candidateCompany = (data.applicantHeader.company ?? "").trim();
  const candidatePhone = data.applicantHeader.phone.trim();
  const candidateEmail = data.applicantHeader.email.trim();
  const candidateWebsite = data.applicantHeader.website.trim();
  const candidateLinkedin = data.applicantHeader.linkedin.trim();
  const candidateLocationLine = data.applicantHeader.location.trim();
  const explicitContactParts = parseProposalContactLine(data.contactLine);
  const resolvedContactParts = {
    email: candidateEmail || explicitContactParts.email,
    phone: candidatePhone || explicitContactParts.phone,
    location: candidateLocationLine || explicitContactParts.location,
    linkedin: candidateLinkedin || explicitContactParts.linkedin,
    website: candidateWebsite || explicitContactParts.website,
    other: explicitContactParts.other,
  };
  const contactLine =
    buildProposalContactLineFromParts(resolvedContactParts) ||
    data.contactLine.trim();
  const directorContactLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const digitalContactLines =
    buildDirectorExportDigitalContactLines(resolvedContactParts);
  const directorContactMark = resolvedContactParts.phone ? "T" : "@";
  const directorContactLines = resolvedContactParts.phone
    ? [resolvedContactParts.phone]
    : digitalContactLines.slice(0, 2);
  const directorContactGroups = [
    resolvedContactParts.phone
      ? { mark: "T" as const, lines: [resolvedContactParts.phone] }
      : null,
    digitalContactLines.length
      ? { mark: "@" as const, lines: digitalContactLines }
      : null,
  ].filter(
    (group): group is { mark: "T" | "@"; lines: string[] } => Boolean(group),
  );
  const shortLocationLine = resolveProposalLetterheadShortTitle({
    recipientFields,
    candidateLocation: resolvedContactParts.location,
    showRecipient: false,
  });
  const volkSenderLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
    phone: resolvedContactParts.phone,
    location: shortLocationLine,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
  });
  const filmSenderLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
  });
  const filmAddressLine = resolvedContactParts.location;
  const joellaWordmark = resolveExportJoellaWordmark({
    candidateCompany,
    candidateName,
  });
  const joellaFooterLine = buildExportJoellaFooterLine({
    location: resolvedContactParts.location,
    email: resolvedContactParts.email,
    phone: resolvedContactParts.phone,
  });
  const bayerFooterLine = buildExportBayerFooterLine({
    phone: resolvedContactParts.phone,
    location: resolvedContactParts.location,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const twoweeksNameLines = splitExportTwoweeksNameLines(candidateName);
  const twoweeksIdentityLines = uniqueExportNonEmptyLines([
    candidateRole,
    candidateCompany,
  ]);
  const twoweeksFooterLine = buildExportTwoweeksDigitalLine({
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const twoweeksContactLines = buildExportTwoweeksContactLines({
    phone: resolvedContactParts.phone,
    email: resolvedContactParts.email,
    location: resolvedContactParts.location,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const subject = data.headerVisibility.showSubject
    ? normalizeLocaleTypography(data.documentTitle, locale).trim()
    : "";
  const recipientName = data.headerVisibility.showRecipient
    ? recipientFields.name?.trim() ?? ""
    : "";
  const recipientCompany = data.headerVisibility.showRecipient
    ? recipientFields.company?.trim() ?? ""
    : "";
  const recipientRole = data.headerVisibility.showRecipient
    ? recipientFields.role?.trim() ?? ""
    : "";
  const recipientAddress =
    data.headerVisibility.showRecipient &&
    data.headerVisibility.showRecipientDetails
      ? recipientFields.address?.trim() ?? ""
      : "";
  const recipientEmail =
    data.headerVisibility.showRecipient &&
    data.headerVisibility.showRecipientDetails
      ? recipientFields.email?.trim() ?? ""
      : "";
  const recipientCity =
    data.headerVisibility.showRecipient &&
    data.headerVisibility.showRecipientDetails
      ? recipientFields.city?.trim() ?? ""
      : "";
  const recipientExtraLines =
    data.headerVisibility.showRecipient &&
    data.headerVisibility.showRecipientDetails
      ? getProposalRecipientExtraLines(data.recipientDetails, recipientFields)
      : [];
  const recipientEditorialName = recipientFields.name?.trim() ?? "";
  const recipientEditorialCompany = recipientFields.company?.trim() ?? "";
  const recipientEditorialRole = recipientFields.role?.trim() ?? "";
  const recipientEditorialAddress = recipientFields.address?.trim() ?? "";
  const recipientEditorialEmail = recipientFields.email?.trim() ?? "";
  const recipientEditorialCity = recipientFields.city?.trim() ?? "";
  const recipientEditorialExtraLines = getProposalRecipientExtraLines(
    data.recipientDetails,
    recipientFields,
  );
  const recipientContactLines = uniqueExportNonEmptyLines(
    [recipientEmail, recipientAddress, recipientCity, ...recipientExtraLines],
    [recipientName, recipientCompany, recipientRole],
  );
  const recipientHeadingLines = data.headerVisibility.showRecipient
    ? uniqueExportNonEmptyLines([
        recipientFields.name,
        recipientFields.role,
        recipientFields.company,
        recipientFields.email,
        recipientFields.address,
        recipientFields.city,
        ...recipientExtraLines,
      ])
    : [];
  const date =
    data.headerVisibility.showDate && data.letterDate
      ? normalizeLocaleTypography(data.letterDate, locale).trim()
      : "";
  const joellaLetterBlock = {
    senderLines: data.headerVisibility.showSender
      ? uniqueExportNonEmptyLines([
          candidateName,
          candidateRole,
          candidateCompany,
          buildExportJoellaHeaderContactLine({
            phone: resolvedContactParts.phone,
            email: resolvedContactParts.email,
            linkedin: resolvedContactParts.linkedin,
            website: resolvedContactParts.website,
            other: resolvedContactParts.other,
          }),
          resolvedContactParts.location,
        ])
      : [],
    dateLine: lowercaseExportEnglishMonthNames(date),
    recipientLines: data.headerVisibility.showRecipient
      ? buildExportJoellaRecipientBlockLines({
          recipientDetails: data.recipientDetails,
          recipientFields,
          showDetails: true,
        })
      : [],
    subjectLine: data.headerVisibility.showSubject
      ? buildExportJoellaSubjectLine({
          subject,
          candidateRole,
        })
      : "",
  };
  const secondaryTitle = candidateCompany;
  const metaRole = recipientRole;
  const shortRoleTitle = candidateRole || recipientRole;

  return {
    candidateName,
    candidateRole,
    candidateCompany,
    candidatePhone: resolvedContactParts.phone,
    candidateEmail: resolvedContactParts.email,
    candidateWebsite: joinExportNonEmpty([
      resolvedContactParts.linkedin,
      resolvedContactParts.website,
    ]),
    candidateSocialLines: uniqueExportNonEmptyLines([
      resolvedContactParts.linkedin,
      resolvedContactParts.other,
    ]),
    candidateWebsiteLines: uniqueExportNonEmptyLines([
      resolvedContactParts.website,
    ]),
    candidateLocationLine: resolvedContactParts.location,
    contactLine,
    directorContactLine,
    directorContactMark,
    directorContactLines,
    directorContactGroups,
    volkSenderLine,
    filmSenderLine,
    filmAddressLine,
    joellaWordmark,
    joellaFooterLine,
    bayerFooterLine,
    twoweeksNameLines,
    twoweeksIdentityLines,
    twoweeksFooterLine,
    twoweeksContactLines,
    joellaLetterBlock,
    recipientName,
    recipientCompany,
    recipientRole,
    recipientAddress,
    recipientEmail,
    recipientCity,
    recipientExtraLines,
    recipientEditorialName,
    recipientEditorialCompany,
    recipientEditorialRole,
    recipientEditorialAddress,
    recipientEditorialEmail,
    recipientEditorialCity,
    recipientEditorialExtraLines,
    recipientContactLines,
    recipientHeadingLines,
    date,
    subject,
    secondaryTitle,
    metaRole,
    shortRoleTitle,
    showSender: data.headerVisibility.showSender,
  };
}

function renderProposalLetterheadMetaRow(viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>): string {
  const roleOrCompany = viewModel.metaRole || viewModel.recipientCompany;
  return `<div class="proposal-cover-letter__meta-row" aria-label="Letter metadata">
    ${[
      viewModel.recipientName,
      roleOrCompany,
      viewModel.metaRole ? viewModel.recipientCompany : "",
      viewModel.date,
    ]
      .map((value) => `<p class="proposal-cover-letter__meta-item">${escapeHtml(value)}</p>`)
      .join("")}
  </div>`;
}

function renderProposalLetterheadSubjectRow(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
  prefix = "Subject:",
): string {
  if (!viewModel.subject) {
    return "";
  }

  return `<div class="proposal-cover-letter__subject-row">
    <span class="proposal-cover-letter__subject-label">${escapeHtml(prefix)}</span>
    <span class="proposal-cover-letter__subject-value">${escapeHtml(viewModel.subject)}</span>
  </div>`;
}

function renderProposalLetterheadRecipientBlock(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
): string {
  if (viewModel.recipientContactLines.length === 0) {
    return "";
  }

  return `<section class="proposal-cover-letter__recipient-block" aria-label="Recipient contact details">
    ${viewModel.recipientContactLines
      .map((line) => renderExportParagraph(line, ""))
      .join("")}
  </section>`;
}

function renderProposalLetterheadRecipientSubjectStack(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
  prefix?: string,
): string {
  if (viewModel.recipientContactLines.length === 0 && !viewModel.subject) {
    return "";
  }

  return `<div class="proposal-cover-letter__recipient-subject-stack" aria-label="Recipient and subject details">
    ${renderProposalLetterheadRecipientBlock(viewModel)}
    ${renderProposalLetterheadSubjectRow(viewModel, prefix)}
  </div>`;
}

function renderProposalDirectorContactGrid(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
): string {
  if (viewModel.directorContactGroups.length === 0) {
    return "";
  }

  return `<section class="proposal-cover-letter__contact-grid" aria-label="Sender contact details">
    ${viewModel.directorContactGroups
      .map(
        (group) => {
          const groupClasses = [
            "proposal-cover-letter__contact-group",
            group.mark === "T"
              ? "proposal-cover-letter__contact-group--telephone"
              : "",
            group.mark === "@"
              ? "proposal-cover-letter__contact-group--digital"
              : "",
            group.lines.length === 1
              ? "proposal-cover-letter__contact-group--single-line"
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<div class="${groupClasses}"><p class="proposal-cover-letter__contact-mark">${escapeHtml(
            group.mark,
          )}</p><div class="proposal-cover-letter__contact-lines">${group.lines
            .map((line) => renderExportParagraph(line, ""))
            .join("")}</div></div>`;
        },
      )
      .join("")}
  </section>`;
}

type ExportEditorialContactGroup = {
  label: string;
  lines: string[];
};

function normalizeExportEditorialWordmark(
  value: string | null | undefined,
): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function buildExportEditorialSenderGroups(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
): ExportEditorialContactGroup[] {
  return [
    viewModel.candidateName
      ? {
          label: viewModel.candidateName,
          lines: uniqueExportNonEmptyLines([viewModel.candidateRole]),
        }
      : null,
    viewModel.candidateCompany
      ? { label: "Company", lines: [viewModel.candidateCompany] }
      : null,
    viewModel.candidateLocationLine
      ? { label: "Location", lines: [viewModel.candidateLocationLine] }
      : null,
    viewModel.candidatePhone
      ? { label: "Phone", lines: [viewModel.candidatePhone] }
      : null,
    viewModel.candidateEmail
      ? { label: "Email", lines: [viewModel.candidateEmail] }
      : null,
    viewModel.candidateSocialLines.length > 0
      ? { label: "Social", lines: viewModel.candidateSocialLines }
      : null,
    viewModel.candidateWebsiteLines.length > 0
      ? { label: "WWW", lines: viewModel.candidateWebsiteLines }
      : null,
  ].filter(
    (group): group is ExportEditorialContactGroup =>
      Boolean(group && (group.label || group.lines.length > 0)),
  );
}

function buildExportEditorialRecipientGroups(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
): ExportEditorialContactGroup[] {
  return [
    viewModel.recipientEditorialName
      ? { label: "Name", lines: [viewModel.recipientEditorialName] }
      : null,
    viewModel.recipientEditorialRole
      ? { label: "Role", lines: [viewModel.recipientEditorialRole] }
      : null,
    viewModel.recipientEditorialCompany
      ? { label: "Company", lines: [viewModel.recipientEditorialCompany] }
      : null,
    viewModel.recipientEditorialEmail
      ? { label: "Email", lines: [viewModel.recipientEditorialEmail] }
      : null,
    viewModel.recipientEditorialAddress
      ? { label: "Address", lines: [viewModel.recipientEditorialAddress] }
      : null,
    viewModel.recipientEditorialCity
      ? { label: "City", lines: [viewModel.recipientEditorialCity] }
      : null,
    viewModel.recipientEditorialExtraLines.length > 0
      ? { label: "Details", lines: viewModel.recipientEditorialExtraLines }
      : null,
  ].filter(
    (group): group is ExportEditorialContactGroup =>
      Boolean(group && (group.label || group.lines.length > 0)),
  );
}

function renderExportEditorialContactGroups(
  groups: ExportEditorialContactGroup[],
): string {
  if (groups.length === 0) {
    return "";
  }

  return `<div class="proposal-cover-letter__editorial-contact-copy">${groups
    .map(
      (group) =>
        `<p>${group.label ? `<b>${escapeHtml(group.label)}</b>` : ""}${group.lines
          .map((line) => `<br>${escapeHtml(line)}`)
          .join("")}</p>`,
    )
    .join("")}</div>`;
}

function renderProposalLetterheadExportPage(args: {
  data: ProposalPrintSource;
  locale?: string | null;
  signatureRender?: ReturnType<typeof resolveProposalSignatureRender>;
  templateId: Extract<
    ProposalTemplateId,
    | "editorial_wide"
    | "twoweeks-letterhead"
    | "director-letterhead"
    | "volk-letterhead"
    | "film-foto-letterhead"
    | "moma-bauhaus-letterhead"
    | "joella-frame-letterhead"
    | "bayer-letterhead"
  >;
}): string {
  const viewModel = buildProposalLetterheadExportViewModel(
    args.data,
    args.locale,
  );
  const bodyMarkup = renderProposalBlocks(
    args.data.body,
    args.locale,
    args.signatureRender,
    args.data.documentIconSettings,
  );
  const scopeClass =
    args.templateId === "editorial_wide"
      ? "proposal-cover-letter--editorial"
      : args.templateId === "twoweeks-letterhead"
      ? "proposal-cover-letter--twoweeks"
      : args.templateId === "director-letterhead"
      ? "proposal-cover-letter--director"
      : args.templateId === "volk-letterhead"
        ? "proposal-cover-letter--volk"
        : args.templateId === "film-foto-letterhead"
          ? "proposal-cover-letter--film-foto"
          : args.templateId === "moma-bauhaus-letterhead"
            ? "proposal-cover-letter--moma-bauhaus"
            : args.templateId === "joella-frame-letterhead"
              ? "proposal-cover-letter--joella"
              : "proposal-cover-letter--bayer";
  const recipientBlockClass = viewModel.recipientContactLines.length
    ? " proposal-cover-letter--has-recipient-block"
    : "";

  if (args.templateId === "editorial_wide") {
    const wordmark = normalizeExportEditorialWordmark(
      viewModel.candidateCompany || viewModel.candidateName,
    );
    const subtitle = viewModel.candidateRole || viewModel.shortRoleTitle;
    const recipientGroups = buildExportEditorialRecipientGroups(viewModel);
    const senderGroups = buildExportEditorialSenderGroups(viewModel);

    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal" aria-label="Editorial cover letter">
      <span class="proposal-cover-letter__editorial-top-ribbon" aria-hidden="true"></span>
      <span class="proposal-cover-letter__editorial-header-rule" aria-hidden="true"></span>
      ${
        wordmark
          ? `<p class="proposal-cover-letter__editorial-wordmark">${escapeHtml(wordmark)}</p>`
          : ""
      }
      ${
        subtitle
          ? `<p class="proposal-cover-letter__editorial-subtitle">${escapeHtml(subtitle)}</p>`
          : ""
      }
      <span class="proposal-cover-letter__editorial-rail-rule" aria-hidden="true"></span>
      <span class="proposal-cover-letter__editorial-body-rule" aria-hidden="true"></span>
      ${
        viewModel.subject
          ? `<p class="proposal-cover-letter__editorial-subject">${escapeHtml(viewModel.subject)}</p>`
          : ""
      }
      ${
        viewModel.date
          ? `<p class="proposal-cover-letter__editorial-date">${escapeHtml(viewModel.date)}</p><span class="proposal-cover-letter__editorial-date-rule" aria-hidden="true"></span>`
          : ""
      }
      ${
        recipientGroups.length
          ? `<section class="proposal-cover-letter__editorial-recipient"><p class="proposal-cover-letter__editorial-label">To</p><span class="proposal-cover-letter__editorial-label-rule" aria-hidden="true"></span>${renderExportEditorialContactGroups(recipientGroups)}</section>`
          : ""
      }
      ${
        senderGroups.length
          ? `<section class="proposal-cover-letter__editorial-sender"><p class="proposal-cover-letter__editorial-label">From</p><span class="proposal-cover-letter__editorial-label-rule proposal-cover-letter__editorial-label-rule--sender" aria-hidden="true"></span>${renderExportEditorialContactGroups(senderGroups)}</section>`
          : ""
      }
      <section class="proposal-cover-letter__editorial-body-flow proposal-cover-letter__body${viewModel.subject ? " proposal-cover-letter__editorial-body-flow--subject-heading" : ""}" data-block="body">${bodyMarkup}</section>
    </main>`;
  }

  if (args.templateId === "twoweeks-letterhead") {
    const twoweeksContactGroups = [
      uniqueExportNonEmptyLines([
        viewModel.candidatePhone,
        normalizeExportTwoweeksDigitalIdentifier(viewModel.candidateEmail),
        ...viewModel.candidateSocialLines.map(
          normalizeExportTwoweeksDigitalIdentifier,
        ),
      ]),
      uniqueExportNonEmptyLines(
        viewModel.candidateWebsiteLines.map(
          normalizeExportTwoweeksDigitalIdentifier,
        ),
      ),
      uniqueExportNonEmptyLines([viewModel.candidateLocationLine]),
    ].filter((group) => group.length > 0);
    const twoweeksRoleLine = viewModel.twoweeksIdentityLines[0] ?? "";
    const twoweeksCompanyLines = viewModel.twoweeksIdentityLines.slice(1);
    const twoweeksNameLine = viewModel.twoweeksNameLines.join(" ");
    const twoweeksNameRoleMarkup =
      twoweeksNameLine || twoweeksRoleLine
        ? `${
            twoweeksNameLine
              ? `<p class="proposal-cover-letter__twoweeks-name-value">${escapeHtml(twoweeksNameLine)}</p>`
              : ""
          }${
            twoweeksRoleLine
              ? `<p class="proposal-cover-letter__twoweeks-role">${escapeHtml(twoweeksRoleLine)}</p>`
              : ""
          }`
        : "";
    const showSenderRail =
      viewModel.showSender &&
      Boolean(
        viewModel.twoweeksNameLines.length ||
          viewModel.twoweeksIdentityLines.length ||
          twoweeksContactGroups.length,
      );

    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      ${
        showSenderRail
          ? `<aside class="proposal-cover-letter__twoweeks-rail" aria-label="Sender details">
              ${
                twoweeksNameRoleMarkup
                  ? `<div class="proposal-cover-letter__twoweeks-name">${twoweeksNameRoleMarkup}</div>`
                  : ""
              }
              ${
                twoweeksCompanyLines.length
                  ? `<div class="proposal-cover-letter__twoweeks-identity">${twoweeksCompanyLines.map((line) => renderExportParagraph(line, "")).join(" ")}</div>`
                  : ""
              }
              ${
                twoweeksContactGroups.length
                  ? `<div class="proposal-cover-letter__twoweeks-contact">${twoweeksContactGroups
                      .map(
                        (group, groupIndex) =>
                          `<div class="proposal-cover-letter__twoweeks-contact-group" data-contact-group="${groupIndex}">${group.map((line) => renderExportParagraph(line, "")).join("")}</div>`,
                      )
                      .join("")}</div>`
                  : ""
              }
            </aside>`
          : ""
      }
      ${renderExportParagraph(viewModel.date, "proposal-cover-letter__twoweeks-date")}
      ${
        viewModel.recipientHeadingLines.length
          ? `<section class="proposal-cover-letter__twoweeks-recipient" aria-label="Recipient details">${viewModel.recipientHeadingLines.map((line) => renderExportParagraph(line, "")).join("")}</section>`
          : ""
      }
      ${
        viewModel.subject
          ? `<p class="proposal-cover-letter__twoweeks-subject"><span class="proposal-cover-letter__twoweeks-subject-label">Subject:</span> <span class="proposal-cover-letter__twoweeks-subject-value">${escapeHtml(viewModel.subject)}</span></p>`
          : ""
      }
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
    </main>`;
  }

  if (args.templateId === "director-letterhead") {
    const mastheadClass = viewModel.secondaryTitle
      ? "proposal-cover-letter__masthead"
      : "proposal-cover-letter__masthead proposal-cover-letter__masthead--no-secondary";
    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      <header class="${mastheadClass}">
        ${renderExportParagraph(viewModel.candidateName, "proposal-cover-letter__masthead-primary")}
        ${renderExportParagraph(viewModel.secondaryTitle, "proposal-cover-letter__masthead-secondary")}
        ${renderExportParagraph(viewModel.candidateRole, "proposal-cover-letter__masthead-role")}
      </header>
      <section class="proposal-cover-letter__sender-block">
        <p class="proposal-cover-letter__sender-label">Sender</p>
        <div class="proposal-cover-letter__sender-lines">
          ${renderExportParagraph(viewModel.candidateName, "")}
          ${renderExportParagraph(viewModel.candidateLocationLine, "")}
        </div>
      </section>
      ${renderProposalDirectorContactGrid(viewModel)}
      ${renderProposalLetterheadMetaRow(viewModel)}
      ${renderProposalLetterheadRecipientSubjectStack(viewModel)}
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
    </main>`;
  }

  if (args.templateId === "volk-letterhead") {
    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      <header class="proposal-cover-letter__volk-header">
        ${renderExportParagraph(viewModel.candidateName, "proposal-cover-letter__volk-title")}
        ${renderExportParagraph(viewModel.secondaryTitle, "proposal-cover-letter__volk-title proposal-cover-letter__volk-title--right")}
      ${renderExportParagraph(viewModel.candidateRole, "proposal-cover-letter__volk-subtitle")}
      ${renderExportParagraph(viewModel.volkSenderLine ? `sender: ${viewModel.volkSenderLine}` : "", "proposal-cover-letter__volk-sender")}
    </header>
      ${renderProposalLetterheadMetaRow(viewModel)}
      ${renderProposalLetterheadRecipientSubjectStack(viewModel)}
      <span class="proposal-cover-letter__dot" aria-hidden="true"></span>
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
  </main>`;
  }

  if (args.templateId === "moma-bauhaus-letterhead") {
    const senderLines = uniqueExportNonEmptyLines([
      viewModel.candidateName,
      viewModel.candidateCompany,
      viewModel.candidateRole,
      viewModel.candidateLocationLine,
    ]);
    const recipientLines = viewModel.recipientHeadingLines;
    const displayTitle = resolveExportBauhausWordmark({
      candidateCompany: viewModel.candidateCompany,
      candidateName: viewModel.candidateName,
      recipientCompany: viewModel.recipientCompany,
    });
    const subtitle = viewModel.candidateRole || viewModel.shortRoleTitle;
    const footerLeft = joinExportNonEmpty([
      viewModel.candidateEmail,
      viewModel.candidatePhone,
    ]);
    const footerRight = viewModel.candidateWebsite;

    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      ${
        senderLines.length
          ? `<section class="proposal-cover-letter__bauhaus-sender" aria-label="Sender details">${senderLines.map((line) => renderExportParagraph(line, "")).join("")}</section>`
          : ""
      }
      ${
        recipientLines.length
          ? `<section class="proposal-cover-letter__bauhaus-recipient" aria-label="Recipient details">${recipientLines.map((line) => renderExportParagraph(line, "")).join("")}</section>`
          : ""
      }
      ${
        displayTitle || subtitle
          ? `<header class="proposal-cover-letter__bauhaus-header">${renderExportParagraph(displayTitle, "proposal-cover-letter__bauhaus-logo")}${renderExportParagraph(subtitle, "proposal-cover-letter__bauhaus-subtitle")}</header>`
          : ""
      }
      ${
        viewModel.date || viewModel.subject
          ? `<div class="proposal-cover-letter__bauhaus-meta">${viewModel.date ? renderExportParagraph(viewModel.date, "proposal-cover-letter__bauhaus-meta-item") : ""}${viewModel.subject ? renderExportParagraph(`Subject: ${viewModel.subject}`, "proposal-cover-letter__bauhaus-meta-item proposal-cover-letter__bauhaus-meta-item--subject") : ""}</div>`
          : ""
      }
      <span class="proposal-cover-letter__bauhaus-frame" aria-hidden="true"></span>
      ${renderExportParagraph(footerLeft, "proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--left")}
      ${renderExportParagraph(footerRight, "proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--right")}
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
    </main>`;
  }

  if (args.templateId === "joella-frame-letterhead") {
    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      <span class="proposal-cover-letter__joella-frame" aria-hidden="true"></span>
      <span class="proposal-cover-letter__joella-divider" aria-hidden="true"></span>
      ${renderExportParagraph(viewModel.joellaWordmark, "proposal-cover-letter__joella-wordmark")}
      ${renderExportParagraph(viewModel.joellaFooterLine, "proposal-cover-letter__joella-footer")}
      <section class="proposal-cover-letter__body" data-block="body">${renderExportJoellaLetterBlock(viewModel)}${bodyMarkup}</section>
    </main>`;
  }

  if (args.templateId === "bayer-letterhead") {
    const bayerName =
      viewModel.candidateName === viewModel.subject
        ? ""
        : viewModel.candidateName;
    const recipientAddressLine = joinExportNonEmpty([
      viewModel.recipientAddress,
      viewModel.recipientCity,
    ]);
    const recipientLines = [
      { className: "proposal-cover-letter__bayer-recipient-name", value: viewModel.recipientName },
      { className: "", value: viewModel.recipientRole },
      { className: "", value: viewModel.recipientCompany },
      { className: "", value: viewModel.recipientEmail },
      { className: "", value: recipientAddressLine },
      ...viewModel.recipientExtraLines.map((line) => ({
        className: "",
        value: line,
      })),
    ].filter((line) => line.value);
    const showSender =
      viewModel.showSender &&
      Boolean(
        bayerName ||
          viewModel.candidateRole ||
          viewModel.candidateCompany ||
          viewModel.candidateEmail,
      );
    const flowClass = viewModel.subject
      ? "proposal-cover-letter__bayer-flow proposal-cover-letter__bayer-flow--with-subject"
      : "proposal-cover-letter__bayer-flow proposal-cover-letter__bayer-flow--no-subject";
    const headerClass = viewModel.candidateCompany
      ? "proposal-cover-letter__bayer-header proposal-cover-letter__bayer-header--has-company"
      : "proposal-cover-letter__bayer-header";

    return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
      ${
        showSender
          ? `<header class="${headerClass}" aria-label="Sender details">${renderExportParagraph(bayerName, "proposal-cover-letter__bayer-name")}<span class="proposal-cover-letter__bayer-rule" aria-hidden="true"></span>${renderExportParagraph(viewModel.candidateRole, "proposal-cover-letter__bayer-role")}${renderExportParagraph(viewModel.candidateCompany, "proposal-cover-letter__bayer-company")}${renderExportParagraph(viewModel.candidateEmail, "proposal-cover-letter__bayer-email")}</header>`
          : ""
      }
      ${
        recipientLines.length
          ? `<section class="proposal-cover-letter__bayer-recipient" aria-label="Recipient details"><p class="proposal-cover-letter__bayer-label">TO</p>${recipientLines.map((line) => renderExportParagraph(line.value, line.className)).join("")}</section>`
          : ""
      }
      ${
        viewModel.date
          ? `<section class="proposal-cover-letter__bayer-date" aria-label="Letter date"><p class="proposal-cover-letter__bayer-label">DATE</p>${renderExportParagraph(viewModel.date, "proposal-cover-letter__bayer-date-value")}</section>`
          : ""
      }
      ${renderExportParagraph(viewModel.bayerFooterLine, "proposal-cover-letter__bayer-footer")}
      <section class="${flowClass}">
        ${
          viewModel.subject
            ? `<section class="proposal-cover-letter__bayer-subject" aria-label="Letter subject"><p class="proposal-cover-letter__bayer-label">SUBJECT</p>${renderExportParagraph(viewModel.subject, "proposal-cover-letter__bayer-subject-value")}</section>`
            : ""
        }
        <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
      </section>
    </main>`;
  }

  const filmKicker = viewModel.candidateRole || viewModel.secondaryTitle;
  const filmTitle = viewModel.candidateName || viewModel.secondaryTitle;

  return `<main class="export-page ${scopeClass}${recipientBlockClass}" data-export-doc="proposal">
    <header class="proposal-cover-letter__film-header">
      ${renderExportParagraph(filmKicker, "proposal-cover-letter__film-heading")}
      ${renderExportParagraph(filmTitle, "proposal-cover-letter__film-title")}
      <span class="proposal-cover-letter__film-rule"></span>
    </header>
    <section class="proposal-cover-letter__info-blocks">
      ${viewModel.filmSenderLine ? `<div><p class="proposal-cover-letter__info-label">sender</p>${renderExportParagraph(viewModel.filmSenderLine, "")}</div>` : ""}
      ${viewModel.recipientCompany ? `<div><p class="proposal-cover-letter__info-label">company</p>${renderExportParagraph(viewModel.recipientCompany, "")}</div>` : ""}
      ${viewModel.candidatePhone ? `<div class="proposal-cover-letter__info-block proposal-cover-letter__info-block--phone"><p class="proposal-cover-letter__info-label">phone</p>${renderExportParagraph(viewModel.candidatePhone, "")}</div>` : ""}
      ${viewModel.candidateSocialLines.length ? `<div><p class="proposal-cover-letter__info-label">social</p>${viewModel.candidateSocialLines.map((line) => renderExportParagraph(line, "")).join("")}</div>` : ""}
      ${viewModel.candidateWebsiteLines.length ? `<div><p class="proposal-cover-letter__info-label">www</p>${viewModel.candidateWebsiteLines.map((line) => renderExportParagraph(line, "")).join("")}</div>` : ""}
    </section>
    ${renderProposalLetterheadMetaRow(viewModel)}
    ${renderProposalLetterheadRecipientSubjectStack(viewModel, "subject:")}
    ${viewModel.filmAddressLine ? renderExportParagraph(viewModel.filmAddressLine, "proposal-cover-letter__film-address-footer") : ""}
    <span class="proposal-cover-letter__dot" aria-hidden="true"></span>
    <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
  </main>`;
}

function renderProposalHtml(args: {
  data: ProposalPrintSource;
  mode: ExportMode;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const locale = args.data.locale;
  const profile = resolveProposalExportProfile({
    mode: args.mode,
    pageSize: args.data.pageSize,
    proposalTemplateId: args.data.templateId,
    stylePreset: args.stylePreset,
  });
  const bodyFontFamily =
    profile.canonical.appearance.font.body.family ?? "var(--body-font)";
  const signatureRender = resolveProposalSignatureRender({
    settings: args.data.signatureSettings,
    bodyFontFamily,
  });
  const letterheadTemplateId =
    args.mode === "styled" && isProposalLetterheadTemplateId(args.data.templateId)
      ? args.data.templateId
      : null;
  const decorationMarkup = renderProposalDocumentDecoration(
    args.data.documentDecoration,
    args.data.pageSize,
    args.data.templateId,
  );
  if (letterheadTemplateId) {
    return buildHtmlDocument({
      bodyClassName: joinClassNames([
        "proposal-export",
        `proposal--${args.mode}`,
        `proposal-template--${String(profile.id).replaceAll("_", "-")}`,
        `proposal-shell--${profile.shell}`,
      ]),
      bodyMarkup: appendProposalDocumentDecoration(
        renderProposalLetterheadExportPage({
          data: args.data,
          locale,
          signatureRender,
          templateId: letterheadTemplateId,
        }),
        decorationMarkup,
      ),
      documentKind: "proposal",
      lang: args.data.locale,
      mode: args.mode,
      pageSize: args.data.pageSize,
      proposalTemplateId: args.data.templateId,
      stylePreset: args.stylePreset,
      title: `${args.data.title} - Styled`,
    });
  }
  const recipientLines = args.data.recipientDetails
    ? normalizeLocaleTypography(args.data.recipientDetails, locale)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const senderLines = [
    args.data.applicantHeader.name,
    args.data.applicantHeader.role,
    args.data.contactLine
      ? normalizeLocaleTypography(args.data.contactLine, locale)
      : "",
  ].filter(Boolean);
  const senderSection = renderSection({
    block: "sender",
    content:
      senderLines.length > 0
        ? `<ul class="meta-list">${senderLines
            .map(
              (line) =>
                `<li class="meta-item"><span class="meta-value">${escapeHtml(line)}</span></li>`,
            )
            .join("")}</ul>`
        : "",
    keep: true,
    locale,
    ruled: true,
    titleKey: "sender",
  });
  const recipientSection = renderSection({
    block: "recipient",
    content:
      recipientLines.length > 0
        ? `<ul class="meta-list">${recipientLines
            .map(
              (line) =>
                `<li class="meta-item"><span class="meta-value">${escapeHtml(line)}</span></li>`,
            )
            .join("")}</ul>`
        : "",
    keep: true,
    locale,
    ruled: true,
    titleKey: "recipient",
  });
  const subjectSection = args.data.headerVisibility.showSubject
    ? renderSection({
        block: "subject",
        content: `<p class="proposal-block proposal-block--subject">${escapeHtml(
          normalizeLocaleTypography(args.data.documentTitle, locale),
        )}</p>`,
        keep: true,
        locale,
        titleKey: "subject",
      })
    : "";
  const headerMarkup =
    profile.shell === "onecol"
      ? `<h1 class="proposal-title">${escapeHtml(
          normalizeLocaleTypography(args.data.documentTitle, locale),
        )}</h1>
      ${
        args.data.documentMeta
          ? `<p class="proposal-meta">${escapeHtml(
              normalizeLocaleTypography(args.data.documentMeta, locale),
            )}</p>`
          : ""
      }
      ${
        args.data.headerVisibility.showDate && args.data.letterDate
          ? `<p class="proposal-meta">${escapeHtml(
              normalizeLocaleTypography(args.data.letterDate, locale),
            )}</p>`
          : ""
      }`
      : `<div class="proposal-topline">
        <div>
          <h1 class="proposal-title">${escapeHtml(
            normalizeLocaleTypography(args.data.documentTitle, locale),
          )}</h1>
          ${
            args.data.documentMeta
              ? `<p class="proposal-meta">${escapeHtml(
                  normalizeLocaleTypography(args.data.documentMeta, locale),
                )}</p>`
              : ""
          }
        </div>
        ${
          args.data.headerVisibility.showDate && args.data.letterDate
            ? `<p class="proposal-meta">${escapeHtml(
                normalizeLocaleTypography(args.data.letterDate, locale),
              )}</p>`
            : ""
        }
      </div>`;

  return buildHtmlDocument({
    bodyClassName: joinClassNames([
      "proposal-export",
      `proposal--${args.mode}`,
      `proposal-template--${String(profile.id).replaceAll("_", "-")}`,
      `proposal-shell--${profile.shell}`,
    ]),
    bodyMarkup: appendProposalDocumentDecoration(
      profile.shell === "onecol"
        ? `<main class="export-page" data-export-doc="proposal">
      <header class="export-header" data-block="header">
        ${headerMarkup}
      </header>
      <section class="proposal-support-stack">
        ${senderSection}
        ${recipientSection}
        ${subjectSection}
      </section>
      <section class="section" data-block="body">
        <div class="proposal-main-stack">
          ${renderProposalBlocks(
            args.data.body,
            locale,
            signatureRender,
            args.data.documentIconSettings,
          )}
        </div>
      </section>
    </main>`
        : `<main class="export-page" data-export-doc="proposal">
      <header class="robial-header" data-block="header">
        <div class="robial-header__full">
          ${headerMarkup}
        </div>
      </header>
      <section class="robial-body">
        <aside class="robial-sidebar">
          <div class="proposal-support-stack">
            ${senderSection}
            ${recipientSection}
          </div>
        </aside>
        <section class="robial-main">
          ${subjectSection}
          <section class="section" data-block="body">
            <div class="proposal-main-stack">
              ${renderProposalBlocks(
                args.data.body,
                locale,
                signatureRender,
                args.data.documentIconSettings,
              )}
            </div>
          </section>
        </section>
      </section>
    </main>`,
      decorationMarkup,
    ),
    documentKind: "proposal",
    lang: args.data.locale,
    mode: args.mode,
    pageSize: args.data.pageSize,
    proposalTemplateId: args.data.templateId,
    stylePreset: args.stylePreset,
    title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
  });
}

export function renderResumeAtsExportDocument(
  data: ResumePrintSource,
  stylePreset?: VerbatiStylePreset | null,
): string {
  return renderResumeHtml({ data, mode: "ats", stylePreset });
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
  stylePreset?: VerbatiStylePreset | null,
): string {
  return renderProposalHtml({ data, mode: "ats", stylePreset });
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
  defaults: DocxParagraphDefaults,
  options: DocxParagraphOptions = {},
): Paragraph {
  return new Paragraph({
    alignment: options.alignment,
    bidirectional: defaults.locale.rightToLeft,
    heading: options.heading,
    keepLines: options.keepLines ?? true,
    keepNext: options.keepNext ?? false,
    spacing: {
      before: options.spacingBefore ?? 0,
      after: options.spacingAfter ?? defaults.bodyGapTwip,
      line: options.line ?? defaults.bodyLineTwip,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      buildDocxTextRun({
        text,
        defaults,
        bold: options.bold,
        color: options.color ?? defaults.colorHex,
        font: options.font,
        size: options.size ?? defaults.bodySizeHalfPt,
      }),
    ],
  });
}

export async function buildResumeDocxBuffer(args: {
  data: ResumePrintSource;
  stylePreset?: VerbatiStylePreset | null;
}): Promise<Buffer> {
  const resolvedStyle = normalizeStylePreset(args.stylePreset);
  const locale = args.data.locale;
  const profile = resolveResumeExportProfile({
    mode: "styled",
    resumeTemplateId: args.data.resumeTemplateId,
    stylePreset: args.stylePreset,
  });
  const headingFont = resolvePrimaryFontFamily(
    profile.canonical.appearance.font.heading.family,
    "Times New Roman",
  );
  const bodyFont = resolvePrimaryFontFamily(
    profile.canonical.appearance.font.body.family,
    "Helvetica Neue",
  );
  const docxInk = resolveDocxSafeColorHex(
    profile.canonical.appearance.theme.ink,
  );
  const docxTokens = resolveResumeDocxSurfaceTokens(profile.canonical);
  const docxDefaults = {
    bodySizeHalfPt: docxTokens.bodySizeHalfPt,
    bodyLineTwip: docxTokens.bodyLineTwip,
    bodyGapTwip: docxTokens.bodyGapTwip,
    colorHex: docxInk,
    locale: resolveDocxLocaleMetadata(locale),
  };
  const bodyParagraphs: Paragraph[] = [
    buildDocxParagraph(args.data.profile.name, docxDefaults, {
      bold: true,
      font: headingFont,
      keepNext: true,
      line: docxTokens.compactLineTwip,
      size: docxTokens.titleSizeHalfPt,
      spacingAfter: docxTokens.compactGapTwip,
    }),
  ];

  const pushSectionHeading = (key: string) => {
    bodyParagraphs.push(
      buildDocxParagraph(getLocalizedExportLabel(key, locale), docxDefaults, {
        bold: true,
        font: headingFont,
        keepNext: true,
        line: docxTokens.compactLineTwip,
        size: docxTokens.labelSizeHalfPt,
        spacingAfter: docxTokens.compactGapTwip,
        spacingBefore: docxTokens.sectionGapTwip,
      }),
    );
  };

  const buildCompactLine = (items: ResumePrintItem[]) =>
    items
      .map((item) =>
        [localizeStructuredLabel(item.label, locale), item.value]
          .filter(Boolean)
          .join(": "),
      )
      .filter(Boolean)
      .join(" · ");

  if (args.data.profile.title) {
    bodyParagraphs.push(
      buildDocxParagraph(args.data.profile.title, docxDefaults, {
        font: bodyFont,
        line: docxTokens.compactLineTwip,
        size: docxTokens.bodySizeHalfPt,
        spacingAfter: docxTokens.compactGapTwip,
      }),
    );
  }

  const headerMetaLine = buildCompactLine([
    ...args.data.contact,
    ...args.data.metadata,
  ]);
  if (headerMetaLine) {
    bodyParagraphs.push(
      buildDocxParagraph(headerMetaLine, docxDefaults, {
        font: bodyFont,
        line: docxTokens.compactLineTwip,
        size: docxTokens.metaSizeHalfPt,
        spacingAfter: docxTokens.sectionGapTwip,
      }),
    );
  }

  if (args.data.profile.summary) {
    pushSectionHeading("summary");
    bodyParagraphs.push(
      buildDocxParagraph(args.data.profile.summary, docxDefaults, {
        font: bodyFont,
        line: docxTokens.bodyLineTwip,
        spacingAfter: docxTokens.bodyGapTwip,
      }),
    );
  }

  if (args.data.experience.length > 0) {
    pushSectionHeading("experience");
    args.data.experience.forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(
          [item.role, item.company].filter(Boolean).join(" · ") || "Experience",
          docxDefaults,
          {
            bold: true,
            font: headingFont,
            keepNext: true,
            line: docxTokens.compactLineTwip,
            size: docxTokens.bodySizeHalfPt,
            spacingAfter: docxTokens.compactGapTwip,
          },
        ),
      );

      const meta = [item.period, item.location].filter(Boolean).join(" · ");
      if (meta) {
        bodyParagraphs.push(
          buildDocxParagraph(meta, docxDefaults, {
            font: bodyFont,
            line: docxTokens.compactLineTwip,
            size: docxTokens.metaSizeHalfPt,
            spacingAfter: docxTokens.compactGapTwip,
          }),
        );
      }

      if (item.summary) {
        bodyParagraphs.push(
          buildDocxParagraph(item.summary, docxDefaults, {
            font: bodyFont,
            line: docxTokens.bodyLineTwip,
            spacingAfter:
              item.bullets.length > 0
                ? docxTokens.compactGapTwip
                : docxTokens.bodyGapTwip,
          }),
        );
      }

      item.bullets.forEach((bullet, index) => {
        bodyParagraphs.push(
          new Paragraph({
            bidirectional: docxDefaults.locale.rightToLeft,
            keepLines: true,
            spacing: {
              after:
                index === item.bullets.length - 1
                  ? docxTokens.bodyGapTwip
                  : docxTokens.bulletGapTwip,
              line: docxTokens.bodyLineTwip,
              lineRule: LineRuleType.AUTO,
            },
            bullet: { level: 0 },
            children: [
              buildDocxTextRun({
                text: bullet,
                defaults: docxDefaults,
                font: bodyFont,
                size: docxTokens.bodySizeHalfPt,
                color: docxInk,
              }),
            ],
          }),
        );
      });
    });
  }

  if (args.data.projects.length > 0) {
    pushSectionHeading("projects");
    args.data.projects.forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(item.name || "Project", docxDefaults, {
          bold: true,
          font: headingFont,
          keepNext: true,
          line: docxTokens.compactLineTwip,
          size: docxTokens.bodySizeHalfPt,
          spacingAfter: docxTokens.compactGapTwip,
        }),
      );
      if (item.meta) {
        bodyParagraphs.push(
          buildDocxParagraph(item.meta, docxDefaults, {
            font: bodyFont,
            line: docxTokens.compactLineTwip,
            size: docxTokens.metaSizeHalfPt,
            spacingAfter: docxTokens.compactGapTwip,
          }),
        );
      }
      bodyParagraphs.push(
        buildDocxParagraph(item.description, docxDefaults, {
          font: bodyFont,
          line: docxTokens.bodyLineTwip,
          spacingAfter: docxTokens.bodyGapTwip,
        }),
      );
    });
  }

  if (args.data.education.length > 0) {
    pushSectionHeading("education");
    args.data.education.forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(item.degree || "Education", docxDefaults, {
          bold: true,
          font: headingFont,
          keepNext: true,
          line: docxTokens.compactLineTwip,
          size: docxTokens.bodySizeHalfPt,
          spacingAfter: docxTokens.compactGapTwip,
        }),
      );

      const meta = [item.school, item.period].filter(Boolean).join(" · ");
      if (meta) {
        bodyParagraphs.push(
          buildDocxParagraph(meta, docxDefaults, {
            font: bodyFont,
            line: docxTokens.compactLineTwip,
            size: docxTokens.metaSizeHalfPt,
            spacingAfter: docxTokens.bodyGapTwip,
          }),
        );
      }
    });
  }

  if (args.data.skills.length > 0) {
    pushSectionHeading("skills");
    bodyParagraphs.push(
      buildDocxParagraph(args.data.skills.join(" · "), docxDefaults, {
        font: bodyFont,
        line: docxTokens.bodyLineTwip,
        spacingAfter: docxTokens.bodyGapTwip,
      }),
    );
  }

  if (args.data.languages.length > 0) {
    pushSectionHeading("languages");
    bodyParagraphs.push(
      buildDocxParagraph(
        args.data.languages
          .map((item) =>
            item.level ? `${item.name} (${item.level})` : item.name,
          )
          .join(" · "),
        docxDefaults,
        {
          font: bodyFont,
          line: docxTokens.bodyLineTwip,
          spacingAfter: docxTokens.bodyGapTwip,
        },
      ),
    );
  }

  if (args.data.achievements.length > 0) {
    pushSectionHeading("achievements");
    args.data.achievements.forEach((item, index) => {
      bodyParagraphs.push(
        new Paragraph({
          bidirectional: docxDefaults.locale.rightToLeft,
          keepLines: true,
          spacing: {
            after:
              index === args.data.achievements.length - 1
                ? docxTokens.bodyGapTwip
                : docxTokens.bulletGapTwip,
            line: docxTokens.bodyLineTwip,
            lineRule: LineRuleType.AUTO,
          },
          bullet: { level: 0 },
          children: [
            buildDocxTextRun({
              text: item,
              defaults: docxDefaults,
              font: bodyFont,
              size: docxTokens.bodySizeHalfPt,
              color: docxInk,
            }),
          ],
        }),
      );
    });
  }

  if ((args.data.certifications ?? []).length > 0) {
    pushSectionHeading("certifications");
    (args.data.certifications ?? []).forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(
          [item.label, item.value].filter(Boolean).join(" — "),
          docxDefaults,
          {
            font: bodyFont,
            line: docxTokens.bodyLineTwip,
            spacingAfter: docxTokens.compactGapTwip,
          },
        ),
      );
    });
  }

  if ((args.data.affiliations ?? []).length > 0) {
    pushSectionHeading("affiliations");
    (args.data.affiliations ?? []).forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(
          [item.label, item.value].filter(Boolean).join(" — "),
          docxDefaults,
          {
            font: bodyFont,
            line: docxTokens.bodyLineTwip,
            spacingAfter: docxTokens.compactGapTwip,
          },
        ),
      );
    });
  }

  if ((args.data.additionalInformation ?? []).length > 0) {
    pushSectionHeading("additional_information");
    (args.data.additionalInformation ?? []).forEach((item) => {
      bodyParagraphs.push(
        buildDocxParagraph(item, docxDefaults, {
          font: bodyFont,
          line: docxTokens.bodyLineTwip,
          spacingAfter: docxTokens.bodyGapTwip,
        }),
      );
    });
  }

  if (args.data.hobbies.length > 0) {
    pushSectionHeading("interests");
    bodyParagraphs.push(
      buildDocxParagraph(args.data.hobbies.join(" · "), docxDefaults, {
        font: bodyFont,
        line: docxTokens.bodyLineTwip,
        spacingAfter: docxTokens.bodyGapTwip,
      }),
    );
  }

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            color: docxInk,
            font: bodyFont,
            size: docxTokens.bodySizeHalfPt,
            language: docxDefaults.locale.language,
            rightToLeft: docxDefaults.locale.rightToLeft,
          },
          paragraph: {
            spacing: {
              after: docxTokens.bodyGapTwip,
              line: docxTokens.bodyLineTwip,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: docxTokens.pageMarginsTwip,
          },
        },
        children: bodyParagraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

export async function buildProposalDocxBuffer(args: {
  data: ProposalPrintSource;
  stylePreset?: VerbatiStylePreset | null;
}): Promise<Buffer> {
  const resolvedStyle = normalizeStylePreset(args.stylePreset);
  const locale = args.data.locale;
  const profile = resolveProposalExportProfile({
    mode: "styled",
    proposalTemplateId: args.data.templateId,
    stylePreset: args.stylePreset,
  });
  const headingFont = resolvePrimaryFontFamily(
    profile.canonical.appearance.font.heading.family,
    "Times New Roman",
  );
  const bodyFont = resolvePrimaryFontFamily(
    profile.canonical.appearance.font.body.family,
    "Helvetica Neue",
  );
  const signatureRender = resolveProposalSignatureRender({
    settings: args.data.signatureSettings,
    bodyFontFamily: bodyFont,
  });
  const signatureFont =
    signatureRender.kind === "text"
      ? resolvePrimaryFontFamily(signatureRender.fontFamily, bodyFont)
      : bodyFont;
  const docxInk = resolveDocxSafeColorHex(
    profile.canonical.appearance.theme.ink,
  );
  const docxTokens = resolveProposalDocxSurfaceTokens(profile.canonical);
  const docxDefaults = {
    bodySizeHalfPt: docxTokens.bodySizeHalfPt,
    bodyLineTwip: docxTokens.bodyLineTwip,
    bodyGapTwip: docxTokens.bodyGapTwip,
    colorHex: docxInk,
    locale: resolveDocxLocaleMetadata(locale),
  };
  const bodyParagraphs: Paragraph[] = [];

  const pushSectionHeading = (key: string) => {
    bodyParagraphs.push(
      buildDocxParagraph(getLocalizedExportLabel(key, locale), docxDefaults, {
        bold: true,
        font: headingFont,
        keepNext: true,
        line: docxTokens.compactLineTwip,
        size: docxTokens.labelSizeHalfPt,
        spacingAfter: docxTokens.compactGapTwip,
      }),
    );
  };

  if (args.data.headerVisibility.showSender) {
    const senderLines = [
      args.data.applicantHeader.name,
      args.data.applicantHeader.role,
      args.data.contactLine
        ? normalizeLocaleTypography(args.data.contactLine, locale)
        : "",
    ].filter(Boolean);

    if (senderLines.length > 0) {
      pushSectionHeading("sender");
      senderLines.forEach((line, index) => {
        bodyParagraphs.push(
          buildDocxParagraph(line, docxDefaults, {
            bold: index === 0,
            font: bodyFont,
            line: docxTokens.compactLineTwip,
            size:
              index === 0
                ? docxTokens.bodySizeHalfPt
                : docxTokens.metaSizeHalfPt,
            spacingAfter:
              index === senderLines.length - 1
                ? docxTokens.sectionGapTwip
                : docxTokens.compactGapTwip,
          }),
        );
      });
    }
  }

  if (args.data.headerVisibility.showDate && args.data.letterDate) {
    bodyParagraphs.push(
      buildDocxParagraph(
        normalizeLocaleTypography(args.data.letterDate, locale),
        docxDefaults,
        {
          alignment: AlignmentType.RIGHT,
          font: bodyFont,
          line: docxTokens.compactLineTwip,
          size: docxTokens.metaSizeHalfPt,
          spacingAfter: docxTokens.sectionGapTwip,
        },
      ),
    );
  }

  if (args.data.headerVisibility.showRecipient && args.data.recipientDetails) {
    const recipientLines = normalizeLocaleTypography(
      args.data.recipientDetails,
      locale,
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (recipientLines.length > 0) {
      pushSectionHeading("recipient");
      recipientLines.forEach((line, index) => {
        bodyParagraphs.push(
          buildDocxParagraph(line, docxDefaults, {
            font: bodyFont,
            line: docxTokens.compactLineTwip,
            size: docxTokens.metaSizeHalfPt,
            spacingAfter:
              index === recipientLines.length - 1
                ? docxTokens.sectionGapTwip
                : docxTokens.compactGapTwip,
          }),
        );
      });
    }
  }

  if (args.data.headerVisibility.showSubject) {
    pushSectionHeading("subject");
    bodyParagraphs.push(
      buildDocxParagraph(
        normalizeLocaleTypography(args.data.documentTitle, locale),
        docxDefaults,
        {
          bold: true,
          font: headingFont,
          line: docxTokens.compactLineTwip,
          size: docxTokens.subjectSizeHalfPt,
          spacingAfter: docxTokens.sectionGapTwip,
        },
      ),
    );
  }

  args.data.body.forEach((block) => {
    if (block.type === "list") {
      block.items.forEach((item, index) => {
        bodyParagraphs.push(
          new Paragraph({
            bidirectional: docxDefaults.locale.rightToLeft,
            keepLines: true,
            spacing: {
              after:
                index === block.items.length - 1
                  ? docxTokens.bodyGapTwip
                  : docxTokens.bodyGapTwip,
              line: docxTokens.bodyLineTwip,
              lineRule: LineRuleType.AUTO,
            },
            bullet: { level: 0 },
            children: [
              buildDocxTextRun({
                text: item.text,
                defaults: docxDefaults,
                font: bodyFont,
                size: docxTokens.bodySizeHalfPt,
                color: docxInk,
              }),
            ],
          }),
        );
      });
      return;
    }

    if (block.type === "closing") {
      if (block.signOff) {
        bodyParagraphs.push(
          buildDocxParagraph(block.signOff, docxDefaults, {
            font: bodyFont,
            keepNext: true,
            line: docxTokens.bodyLineTwip,
            spacingAfter: docxTokens.closingLineGapTwip,
            spacingBefore: docxTokens.closingBeforeTwip,
          }),
        );
      }
      if (block.signatureName) {
        bodyParagraphs.push(
          buildDocxParagraph(formatProposalSignatureName(block.signatureName), docxDefaults, {
            bold: false,
            font: signatureFont,
            line: docxTokens.compactLineTwip,
            spacingAfter: docxTokens.sectionGapTwip,
          }),
        );
      }
      return;
    }

    bodyParagraphs.push(
      buildDocxParagraph(block.text, docxDefaults, {
        font: bodyFont,
        line: docxTokens.bodyLineTwip,
        spacingAfter:
          block.type === "salutation"
            ? docxTokens.salutationGapTwip
            : docxTokens.bodyGapTwip,
      }),
    );
  });

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            color: docxInk,
            font: bodyFont,
            size: docxTokens.bodySizeHalfPt,
            language: docxDefaults.locale.language,
            rightToLeft: docxDefaults.locale.rightToLeft,
          },
          paragraph: {
            spacing: {
              after: docxTokens.bodyGapTwip,
              line: docxTokens.bodyLineTwip,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: docxTokens.pageMarginsTwip,
          },
        },
        children: bodyParagraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
