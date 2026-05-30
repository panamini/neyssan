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
  parseProposalRecipientDetails,
  resolveProposalLetterheadShortTitle,
} from "./proposal-header";
import {
  buildProposalContactLineFromParts,
  parseProposalContactLine,
} from "./proposal-heading-state";

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

    .proposal-cover-letter--director.export-page,
    .proposal-cover-letter--volk.export-page,
    .proposal-cover-letter--film-foto.export-page,
    .proposal-cover-letter--moma-bauhaus.export-page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
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
    .proposal-cover-letter--director .proposal-cover-letter__recipient-block,
    .proposal-cover-letter--director .proposal-cover-letter__subject-row,
    .proposal-cover-letter--director .proposal-cover-letter__body,
    .proposal-cover-letter--volk .proposal-cover-letter__volk-header,
    .proposal-cover-letter--volk .proposal-cover-letter__meta-row,
    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-row,
    .proposal-cover-letter--volk .proposal-cover-letter__body,
    .proposal-cover-letter--volk .proposal-cover-letter__dot,
    .proposal-cover-letter--film-foto .proposal-cover-letter__film-header,
    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks,
    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-row,
    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-row,
    .proposal-cover-letter--film-foto .proposal-cover-letter__body,
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
      font-size: 6.15mm;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--director .proposal-cover-letter__masthead-role {
      margin: 0;
      justify-self: end;
      font-size: 6.2mm;
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
      font-size: 2.15mm;
      line-height: 1.35;
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
      font-size: 6mm !important;
      line-height: 1;
      font-weight: 800 !important;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-row {
      left: 25mm;
      right: 14mm;
      top: 87.8mm;
      display: grid;
      grid-template-columns: 43mm 48mm 42mm 24mm;
      column-gap: 8mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__meta-item:last-child {
      white-space: nowrap;
      overflow-wrap: normal;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-row {
      left: 24mm;
      right: 25mm;
      top: 98.4mm;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 3mm;
      align-items: baseline;
    }

    .proposal-cover-letter--director .proposal-cover-letter__recipient-block {
      left: 25mm;
      top: 98.2mm;
      width: 112mm;
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--director .proposal-cover-letter__recipient-block p {
      color: var(--ink);
      font-size: 2.25mm;
      line-height: 1.25;
      font-weight: 600;
    }

    .proposal-cover-letter--director.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__subject-row {
      top: 111mm;
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
      font-size: 5.95mm;
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
      font-size: 4.1mm;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__volk-sender {
      grid-column: 1 / -1;
      margin: 3.2mm 0 0;
      font-size: 2.55mm;
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
      grid-template-columns: 50mm 46mm 40mm minmax(0, 1fr);
      column-gap: 8mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__subject-row {
      left: 24mm;
      right: 24mm;
      top: 101.9mm;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 3mm;
      align-items: baseline;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block {
      left: 24mm;
      top: 101.7mm;
      width: 112mm;
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__recipient-block p {
      margin: 0;
      font-size: 2.35mm;
      line-height: 1.25;
      font-weight: 700;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--volk.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__subject-row {
      top: 114mm;
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
      font-size: 3.55mm;
      line-height: 1;
      font-weight: 500;
      color: var(--accent);
      text-transform: lowercase;
      overflow-wrap: normal;
      white-space: nowrap;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__film-title {
      margin: 0;
      font-size: 7.6mm;
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
      height: 0.32mm;
      background: var(--accent);
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks {
      left: 20mm;
      right: 8mm;
      top: 42mm;
      display: grid;
      grid-template-columns: 76mm 26mm 34mm minmax(0, 1fr);
      column-gap: 4mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-row {
      left: 20mm;
      right: 8mm;
      top: 90mm;
      display: grid;
      grid-template-columns: 47mm 51mm 39mm minmax(0, 1fr);
      column-gap: 8mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-row {
      left: 20mm;
      right: 22mm;
      top: 102.3mm;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 2mm;
      align-items: baseline;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block {
      left: 20mm;
      top: 102mm;
      width: 112mm;
      display: grid;
      gap: 0.6mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__recipient-block p {
      margin: 0;
      min-width: 0;
      font-size: 2.55mm;
      line-height: 1.25;
      font-weight: 600;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
    }

    .proposal-cover-letter--film-foto.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__subject-row {
      top: 114mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__body {
      left: 20mm;
      top: 120mm;
      width: min(96mm, 58ch);
    }

    .proposal-cover-letter--film-foto.proposal-cover-letter--has-recipient-block
      .proposal-cover-letter__body {
      top: 132mm;
    }

    .proposal-cover-letter--film-foto .proposal-cover-letter__dot {
      left: 20mm;
      top: 256mm;
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 50%;
      background: var(--accent);
    }

    .proposal-cover-letter--volk .proposal-cover-letter__meta-item,
    .proposal-cover-letter--film-foto .proposal-cover-letter__meta-item,
    .proposal-cover-letter--film-foto .proposal-cover-letter__info-blocks p {
      margin: 0;
      min-width: 0;
      font-size: 2.85mm;
      line-height: 1.22;
      font-weight: 600;
      color: var(--accent);
      overflow-wrap: anywhere;
      text-transform: lowercase;
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
      font-size: 2.2mm;
      line-height: 1.25;
      font-weight: 800;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-label,
    .proposal-cover-letter--director .proposal-cover-letter__subject-value,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-label,
    .proposal-cover-letter--film-foto .proposal-cover-letter__subject-value {
      color: var(--ink);
      font-size: 3.35mm;
      line-height: 1.16;
      font-weight: 700;
    }

    .proposal-cover-letter--director .proposal-cover-letter__subject-label {
      color: var(--accent);
      font-size: 2.35mm;
      text-transform: uppercase;
      font-weight: 800;
    }

    .proposal-cover-letter--volk .proposal-cover-letter__subject-label,
    .proposal-cover-letter--volk .proposal-cover-letter__subject-value {
      color: var(--accent);
      font-size: 4.05mm;
      line-height: 1.05;
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
      font-size: 3.15mm;
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
      top: 14mm;
      width: 58mm;
      display: grid;
      gap: 1.05mm;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient {
      left: 32mm;
      top: 44.7mm;
      width: 58mm;
      display: grid;
      gap: 1.05mm;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-sender p,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-recipient p,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta-item,
    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer {
      margin: 0;
      min-width: 0;
      font-size: 2.05mm;
      line-height: 1.28;
      font-weight: 800;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-header {
      left: 102mm;
      top: 16.4mm;
      right: 7.8mm;
      display: grid;
      align-content: start;
      justify-items: start;
      min-width: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-logo {
      margin: 0;
      max-width: 100%;
      font-size: 16.4mm;
      line-height: 0.88;
      font-weight: 900;
      letter-spacing: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-subtitle {
      margin: 1.2mm 0 0 0.5mm;
      max-width: 94mm;
      font-size: 2.35mm;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta {
      left: 32mm;
      top: 86.5mm;
      right: 8mm;
      display: flex;
      gap: 7mm;
      align-items: baseline;
      min-width: 0;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-meta-item {
      color: var(--ink);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-frame {
      left: 5mm;
      top: 94.2mm;
      width: 197.2mm;
      height: 196.3mm;
      border: 1.2mm solid var(--accent);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body {
      left: 32mm;
      top: 116mm;
      width: min(112mm, 62ch);
      max-width: min(112mm, 62ch);
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
      font-size: 3.15mm;
      line-height: 1.48;
      color: var(--ink);
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-block + .proposal-block {
      margin-top: 4mm;
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__body .proposal-signature {
      font-family: var(--proposal-signature-font-family, var(--body-font));
      font-weight: var(--decor-signature-font-weight, inherit);
    }

    .proposal-cover-letter--moma-bauhaus .proposal-cover-letter__bauhaus-footer {
      top: 285.7mm;
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
      left: 101.8mm;
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
  proposalTemplateId?: ProposalTemplateId | null;
  resumeTemplateId?: ResumePrintSource["resumeTemplateId"] | null;
  stylePreset?: VerbatiStylePreset | null;
}): string {
  const resumeProfile =
    args.documentKind === "resume"
      ? resolveResumeExportProfile({
          mode: args.mode,
          resumeTemplateId: args.resumeTemplateId,
          stylePreset: args.stylePreset,
        })
      : null;
  const proposalProfile =
    args.documentKind === "proposal"
      ? resolveProposalExportProfile({
          mode: args.mode,
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
      font-family: var(--decor-section-title-font-family, var(--heading-font));
      font-size: var(--flow-label-size);
      line-height: var(--flow-label-line);
      font-weight: var(--decor-section-title-font-weight, 700);
      text-transform: var(--decor-section-title-text-transform, uppercase);
      letter-spacing: var(--decor-section-title-letter-spacing, 0.14em);
      color: var(--accent);
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
      max-width: min(48mm, 64%);
      max-height: 18mm;
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

function renderResumeCompactList(args: {
  items: Array<{ text: string; id?: string }>;
}): string {
  if (args.items.length === 0) {
    return "";
  }

  return `<ul class="compact-list">${args.items
    .map(
      (item) =>
        `<li${item.id ? ` data-export-item-id="${escapeHtml(item.id)}"` : ""}>${escapeHtml(item.text)}</li>`,
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
}) {
  if (!args.content) {
    return "";
  }

  return `<section class="${joinClassNames([
    "section",
    `section--${args.block}`,
    args.ruled ? "section--ruled" : "",
  ])}" data-block="${escapeHtml(args.block)}"${args.keep ? ' data-keep="compact"' : ""}>
    <h2 class="section-title">${escapeHtml(getLocalizedExportLabel(args.titleKey, args.locale))}</h2>
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
): string {
  const blockMarkup: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) {
      return;
    }

    blockMarkup.push(
      `<ul class="bullet-list">${bulletBuffer
        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
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
): string {
  return rich.blocks
    .map((block) => {
      if (block.kind === "paragraph") {
        return `<p class="entry-summary">${block.runs
          .map((run) => renderWorkshopResponsibilityRun(run))
          .join("")}</p>`;
      }

      return `<ul class="bullet-list">${block.items
        .map(
          (item) =>
            `<li>${item.runs
              .map((run) => renderWorkshopResponsibilityRun(run))
              .join("")}</li>`,
        )
        .join("")}</ul>`;
    })
    .join("");
}

function renderWorkshopExperienceContent(
  item: WorkshopCommittedExperienceItem,
): string {
  const rich = item.responsibilitiesRich;
  if (
    !rich ||
    rich.blocks.length === 0 ||
    item.continued ||
    item.blocks.some((block) => block.partial === true) ||
    workshopResponsibilitiesRichHasPartialContent(rich)
  ) {
    return renderWorkshopExperienceBlocksFallback(item.blocks);
  }

  return renderWorkshopRichContent(rich);
}

function renderWorkshopFragment(args: {
  fragment: NonNullable<ResumePrintSource["committedPages"]>[number]["fragments"][number];
  locale?: string | null;
}): string {
  const { fragment, locale } = args;

  switch (fragment.kind) {
    case "profile":
      return renderWorkshopProfileFragment({ fragment, locale });
    case "summary":
      return renderSection({
        block: "summary",
        content: fragment.summaryRich
          ? renderWorkshopRichContent(fragment.summaryRich)
          : `<p class="entry-summary">${escapeHtml(fragment.text)}</p>`,
        locale,
        titleKey: "summary",
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
              ${renderWorkshopExperienceContent(item)}
            </article>`;
            },
          )
          .join(""),
        locale,
        titleKey: "experience",
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
                  ? renderWorkshopRichContent(item.descriptionRich)
                  : `<p class="entry-summary">${escapeHtml(item.description)}</p>`}
              </div>
            </article>`,
          )
          .join(""),
        locale,
        titleKey: "projects",
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
        }),
        keep: true,
        locale,
        ruled: true,
        titleKey: "languages",
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
      });
    case "achievements":
      return renderSection({
        block: "achievements",
        content: `<ul class="bullet-list">${fragment.items
          .map((item) => `<li data-export-item-id="${escapeHtml(item.id)}">${escapeHtml(item.text)}</li>`)
          .join("")}</ul>`,
        locale,
        titleKey: "achievements",
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
      });
    case "hobbies":
      return renderSection({
        block: "interests",
        content: renderResumeCompactList({
          items: fragment.items.map((item) => ({
            id: item.id,
            text: item.name,
          })),
        }),
        keep: true,
        locale,
        ruled: true,
        titleKey: "interests",
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
      });
  }
}

function renderWorkshopTwoColumnPage(args: {
  page: NonNullable<ResumePrintSource["committedPages"]>[number];
  locale?: string | null;
}): string {
  const header: string[] = [];
  const sidebar: string[] = [];
  const main: string[] = [];

  args.page.fragments.forEach((fragment) => {
    const markup = renderWorkshopFragment({ fragment, locale: args.locale });
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
  const profile = resolveResumeExportProfile({
    mode: args.mode,
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
          ? renderWorkshopTwoColumnPage({ page, locale })
          : `<article class="resume-styled-page" data-export-page-id="${escapeHtml(page.pageId)}">
            ${page.fragments
              .map((fragment) =>
                renderWorkshopFragment({
                  fragment,
                  locale,
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
        `resume-layout--${normalizeStylePreset(args.stylePreset).layout}`,
        `resume-shell--${profile.shell}`,
      ]),
      bodyMarkup: workshopBodyMarkup,
      documentKind: "resume",
      lang: args.data.locale,
      mode: args.mode,
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

  const experienceContent = args.data.experience
    .map(
      (item) => `<article class="entry entry--experience">
        <div class="entry-lead">
          <div class="entry-head">
            <h3 class="entry-title">${escapeHtml(
              [item.role, item.company].filter(Boolean).join(" · "),
            )}</h3>
            <p class="entry-meta">${escapeHtml(
              [item.period, item.location].filter(Boolean).join("\n"),
            )}</p>
          </div>
          ${item.summary ? `<p class="entry-summary">${escapeHtml(item.summary)}</p>` : ""}
        </div>
        ${
          item.bullets.length > 0
            ? `<ul class="bullet-list">${item.bullets
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
      args.data.achievements.length > 0
        ? `<ul class="bullet-list">${args.data.achievements
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
  const baselineBodyMarkup =
    profile.shell === "onecol"
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
    </main>`;
  return buildHtmlDocument({
    bodyClassName: joinClassNames([
      "resume-export",
      `resume--${args.mode}`,
      `resume-layout--${normalizeStylePreset(args.stylePreset).layout}`,
      `resume-shell--${profile.shell}`,
    ]),
    bodyMarkup: baselineBodyMarkup,
    documentKind: "resume",
    lang: args.data.locale,
    mode: args.mode,
    resumeTemplateId: args.data.resumeTemplateId,
    stylePreset: args.stylePreset,
    title: `${args.data.title} - ${args.mode === "ats" ? "ATS" : "Styled"}`,
  });
}

function renderProposalBlocks(
  blocks: ProposalPrintBlock[],
  locale?: string | null,
  signatureRender?: ReturnType<typeof resolveProposalSignatureRender>,
): string {
  return blocks
    .map((block) => {
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
      ])}">${escapeHtml(block.text)}</p>`;
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
    location: shortLocationLine,
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
  const recipientContactLines = uniqueExportNonEmptyLines(
    [recipientAddress, recipientCity, recipientEmail],
    [recipientName, recipientCompany, recipientRole],
  );
  const date =
    data.headerVisibility.showDate && data.letterDate
      ? normalizeLocaleTypography(data.letterDate, locale).trim()
      : "";
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
    candidateLocationLine: resolvedContactParts.location,
    contactLine,
    directorContactLine,
    directorContactMark,
    directorContactLines,
    directorContactGroups,
    volkSenderLine,
    filmSenderLine,
    recipientName,
    recipientCompany,
    recipientRole,
    recipientAddress,
    recipientEmail,
    recipientCity,
    recipientContactLines,
    date,
    subject,
    secondaryTitle,
    metaRole,
    shortRoleTitle,
  };
}

function renderProposalLetterheadMetaRow(viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>): string {
  return `<div class="proposal-cover-letter__meta-row" aria-label="Letter metadata">
    ${[
      viewModel.recipientName,
      viewModel.recipientCompany,
      viewModel.metaRole,
      viewModel.date,
    ]
      .map((value) => `<p class="proposal-cover-letter__meta-item">${escapeHtml(value)}</p>`)
      .join("")}
  </div>`;
}

function renderProposalLetterheadSubjectRow(
  viewModel: ReturnType<typeof buildProposalLetterheadExportViewModel>,
  prefix = "Re:",
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

function renderProposalLetterheadExportPage(args: {
  data: ProposalPrintSource;
  locale?: string | null;
  signatureRender?: ReturnType<typeof resolveProposalSignatureRender>;
  templateId: Extract<
    ProposalTemplateId,
    | "director-letterhead"
    | "volk-letterhead"
    | "film-foto-letterhead"
    | "moma-bauhaus-letterhead"
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
  );
  const scopeClass =
    args.templateId === "director-letterhead"
      ? "proposal-cover-letter--director"
      : args.templateId === "volk-letterhead"
        ? "proposal-cover-letter--volk"
        : args.templateId === "film-foto-letterhead"
          ? "proposal-cover-letter--film-foto"
          : "proposal-cover-letter--moma-bauhaus";
  const recipientBlockClass = viewModel.recipientContactLines.length
    ? " proposal-cover-letter--has-recipient-block"
    : "";

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
      ${renderProposalLetterheadRecipientBlock(viewModel)}
      ${renderProposalLetterheadSubjectRow(viewModel)}
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
      ${renderProposalLetterheadRecipientBlock(viewModel)}
      ${renderProposalLetterheadSubjectRow(viewModel, "re:")}
      <span class="proposal-cover-letter__dot" aria-hidden="true"></span>
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
  </main>`;
  }

  if (args.templateId === "moma-bauhaus-letterhead") {
    const senderLines = uniqueExportNonEmptyLines([
      viewModel.candidateName,
      viewModel.secondaryTitle,
      viewModel.candidateRole,
      viewModel.candidateLocationLine,
      viewModel.candidateEmail,
      viewModel.candidatePhone,
    ]);
    const recipientLines = uniqueExportNonEmptyLines([
      viewModel.recipientName,
      viewModel.recipientRole,
      viewModel.recipientCompany,
      ...viewModel.recipientContactLines,
    ]);
    const displayTitle =
      viewModel.secondaryTitle ||
      viewModel.candidateName ||
      viewModel.recipientCompany;
    const subtitle =
      viewModel.subject || viewModel.candidateRole || viewModel.shortRoleTitle;
    const footerLeft = joinExportNonEmpty([
      viewModel.candidateEmail,
      viewModel.candidatePhone,
    ]);
    const footerRight = joinExportNonEmpty([
      viewModel.candidateWebsite,
      viewModel.candidateLocationLine,
    ]);

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
          ? `<div class="proposal-cover-letter__bauhaus-meta">${viewModel.date ? renderExportParagraph(viewModel.date, "proposal-cover-letter__bauhaus-meta-item") : ""}${viewModel.subject ? renderExportParagraph(`Re: ${viewModel.subject}`, "proposal-cover-letter__bauhaus-meta-item") : ""}</div>`
          : ""
      }
      <span class="proposal-cover-letter__bauhaus-frame" aria-hidden="true"></span>
      ${renderExportParagraph(footerLeft, "proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--left")}
      ${renderExportParagraph(footerRight, "proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--right")}
      <section class="proposal-cover-letter__body" data-block="body">${bodyMarkup}</section>
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
      ${viewModel.candidatePhone ? `<div class="proposal-cover-letter__info-block proposal-cover-letter__info-block--phone"><p class="proposal-cover-letter__info-label">phone</p>${renderExportParagraph(viewModel.candidatePhone, "")}</div>` : ""}
      ${viewModel.candidateWebsite ? `<div><p class="proposal-cover-letter__info-label">portfolio</p>${renderExportParagraph(viewModel.candidateWebsite, "")}</div>` : ""}
      ${viewModel.recipientCompany ? `<div><p class="proposal-cover-letter__info-label">company</p>${renderExportParagraph(viewModel.recipientCompany, "")}</div>` : ""}
    </section>
    ${renderProposalLetterheadMetaRow(viewModel)}
    ${renderProposalLetterheadRecipientBlock(viewModel)}
    ${renderProposalLetterheadSubjectRow(viewModel)}
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
  if (letterheadTemplateId) {
    return buildHtmlDocument({
      bodyClassName: joinClassNames([
        "proposal-export",
        `proposal--${args.mode}`,
        `proposal-template--${String(profile.id).replaceAll("_", "-")}`,
        `proposal-shell--${profile.shell}`,
      ]),
      bodyMarkup: renderProposalLetterheadExportPage({
        data: args.data,
        locale,
        signatureRender,
        templateId: letterheadTemplateId,
      }),
      documentKind: "proposal",
      lang: args.data.locale,
      mode: args.mode,
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
    bodyMarkup:
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
          ${renderProposalBlocks(args.data.body, locale, signatureRender)}
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
              ${renderProposalBlocks(args.data.body, locale, signatureRender)}
            </div>
          </section>
        </section>
      </section>
    </main>`,
    documentKind: "proposal",
    lang: args.data.locale,
    mode: args.mode,
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
