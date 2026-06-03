import React from "react";
import type { FormValues } from "../ProposalInputForm.schemas";
import {
  isProposalLetterheadTemplateId,
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import type { ProposalDocumentTypography } from "../../lib/proposal-document-typography";
import { VOLK_REGISTER_GRID } from "../../features/verbati/volkGrid";
import type { ProposalApplicantHeaderData } from "../../lib/proposal-personalization";
import {
  getProposalRecipientExtraLines,
  parseProposalRecipientDetails,
  resolveProposalLetterheadShortTitle,
  resolveProposalHeaderVisibility,
  resolveProposalRecipientLines,
  type ProposalHeaderVisibility,
  type ProposalRecipientFields,
} from "../../lib/proposal-header";
import {
  buildProposalContactLineFromParts,
  parseProposalContactLine,
} from "../../lib/proposal-heading-state";
import {
  extractProposalClosingBlockFromParagraphs,
  formatProposalSignatureName,
  resolveProposalClosingRef,
  stripInlineProposalMarkdown,
  type ProposalClosingRef,
} from "../../lib/proposal-closing";
import { normalizeProposalPreviewTokens } from "../../lib/layout/documentTokenNormalizer";
import {
  serializeProposalPreviewVars,
  serializeProposalMeasurementRuntimeVars,
  serializeProposalRuntimeVars,
} from "../../lib/layout/documentTokenSerializers";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import {
  resolveProposalSignatureRender,
  type ProposalSignatureSettings,
} from "../../lib/proposal-signature-settings";
import {
  resolveDocumentPageSize,
  type DocumentPageSize,
} from "../../lib/document-page-size";
import {
  Eye,
  TrashSimple,
  Upload,
} from "../../lib/icons";
import {
  DOCUMENT_DECORATION_UPLOAD_ACCEPT,
  getDocumentDecorationPlacementMm,
  getRenderableDocumentDecoration,
  moveDocumentDecorationByDeltaMm,
  normalizeDocumentDecoration,
  readDocumentDecorationUpload,
  removeDocumentDecorationAsset,
  resolveTemplateDocumentDecoration,
  resizeDocumentDecorationByDeltaMm,
  type DocumentDecoration,
} from "../../lib/document-decoration";
import {
  DEFAULT_DOCUMENT_ICON_SETTINGS,
  getDocumentIcon,
  getDocumentIconColorCss,
  normalizeDocumentIconSettings,
  parseDocumentIconTextSegments,
  resolveDefaultListMarkerIconKey,
  type DocumentIconKey,
  type DocumentIconSettings,
} from "../../lib/document-icons";
import { DocumentIconPicker } from "../document-icons/DocumentIconPicker";
import {
  parseProposalPlainTextBlocks,
  type ProposalPlainTextBlock,
} from "../../lib/proposal-list-blocks";
import {
  normalizeEditableText,
  resolveProposalDocument,
  type ProposalDocument,
  type ProposalDocumentListMarker,
} from "../../lib/proposal-document";

type ProposalDocumentRendererProps = {
  content: string;
  proposalDocument?: ProposalDocument | null;
  proposalType?: FormValues["proposalType"] | null;
  templateId?: ProposalTemplateId | null;
  railTitle?: string | null;
  railMeta?: string | null;
  contactLine?: string | null;
  letterDate?: string | null;
  recipientDetails?: string | null;
  documentTitle?: string | null;
  documentMeta?: string | null;
  applicantHeader?: ProposalApplicantHeaderData | null;
  headerVisibility?: ProposalHeaderVisibility | null;
  documentTypography: ProposalDocumentTypography;
  /** Explicit page width in px. When provided, syncs mm vars immediately on change
   *  without waiting for the ResizeObserver callback. */
  pageWidth?: number;
  pageSize?: DocumentPageSize | null;
  pageGapPx?: number;
  stylePreset?: VerbatiStylePreset | null;
  documentThemeVars?: React.CSSProperties | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  documentDecoration?: DocumentDecoration | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentDecorationMode?: "readonly" | "design";
  onDocumentDecorationChange?: (decoration: DocumentDecoration) => void;
  onDocumentDecorationCommit?: (decoration: DocumentDecoration) => void;
  onProposalDocumentChange?: (document: ProposalDocument) => void;
  onRailTitleChange?: (value: string) => void;
  onRailMetaChange?: (value: string) => void;
  onContactLineChange?: (value: string) => void;
  onLetterDateChange?: (value: string) => void;
  onRecipientDetailsChange?: (value: string) => void;
  onDocumentTitleChange?: (value: string) => void;
  emptyBodyPlaceholder?: string | null;
  onPageCountChange?: (count: number) => void;
};

type ParsedProposalDocument = {
  kind: "letter" | "message" | "proposal";
  salutation: string | null;
  paragraphs: string[];
  bodyBlocks: ProposalPlainTextBlock[];
  signOff: string | null;
  signatureName: string | null;
  rawBody: string;
};

type ProposalDocumentBlock =
  | {
      id: string;
      type: "salutation";
      text: string;
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
      paragraphId: string;
      continuation: boolean;
    }
  | {
      id: string;
      type: "list";
      items: Array<{
        id: string;
        text: string;
        iconKey?: DocumentIconKey;
        marker?: ProposalDocumentListMarker | null;
      }>;
      marker?: ProposalDocumentListMarker | null;
    }
  | {
      id: string;
      type: "closing";
      signOff: string | null;
      signatureName: string | null;
      handwrittenSignatureEnabled?: boolean;
    };

type VolkRegisterMetaEntry = {
  value: string;
  key: string;
};

type EditorialContactGroup = {
  label: string;
  lines: string[];
};

type StructuredHeaderValues = {
  date: string;
  subject: string;
  toLines: string[];
  recipientDetailLines: string[];
};

type ProposalLetterheadViewModel = {
  candidateName: string;
  candidateRole: string;
  candidateCompany: string;
  candidateContactLine: string;
  candidateDirectorContactLine: string;
  candidateDirectorContactMark: "T" | "@";
  candidateDirectorContactLines: string[];
  candidateDirectorContactGroups: Array<{ mark: "T" | "@"; lines: string[] }>;
  candidateVolkSenderLine: string;
  candidateFilmSenderLine: string;
  candidateFilmAddressLine: string;
  candidateJoellaWordmark: string;
  candidateJoellaFooterLine: string;
  candidateBayerFooterLine: string;
  candidateTwoweeksNameLines: string[];
  candidateTwoweeksIdentityLines: string[];
  candidateTwoweeksFooterLine: string;
  candidateTwoweeksContactLines: string[];
  candidateLocationLine: string;
  candidatePhone: string;
  candidateEmail: string;
  candidateWebsite: string;
  candidateSocialLines: string[];
  candidateWebsiteLines: string[];
  recipientName: string;
  recipientCompany: string;
  recipientRole: string;
  recipientAddress: string;
  recipientEmail: string;
  recipientCity: string;
  recipientExtraLines: string[];
  recipientEditorialName: string;
  recipientEditorialCompany: string;
  recipientEditorialRole: string;
  recipientEditorialAddress: string;
  recipientEditorialEmail: string;
  recipientEditorialCity: string;
  recipientEditorialExtraLines: string[];
  recipientContactLines: string[];
  recipientHeadingLines: string[];
  joellaLetterBlock: {
    senderLines: string[];
    dateLine: string;
    recipientLines: string[];
    subjectLine: string;
  };
  date: string;
  subject: string;
  secondaryTitle: string;
  metaRole: string;
  shortRoleTitle: string;
  showSender: boolean;
};

type ProposalEditableTextProps = React.HTMLAttributes<HTMLElement> & {
  contentEditable?: "plaintext-only";
  suppressContentEditableWarning?: boolean;
  "data-proposal-editable-text"?: string;
};

type ProposalCoverLetterEditableFields = {
  senderName?: ProposalEditableTextProps | null;
  senderRole?: ProposalEditableTextProps | null;
  senderContact?: ProposalEditableTextProps | null;
  date?: ProposalEditableTextProps | null;
  recipient?: ProposalEditableTextProps | null;
  subject?: ProposalEditableTextProps | null;
};

type ProposalCoverLetterTemplateProps = {
  bodyRef?: React.Ref<HTMLDivElement> | null;
  bodyContent: React.ReactNode;
  editableFields?: ProposalCoverLetterEditableFields | null;
  isContinuationPage: boolean;
  viewModel: ProposalLetterheadViewModel;
};

type ProposalEditableTextBehavior = {
  multiline?: boolean;
};

const BAUHAUS_WORDMARK_MAX_COMPACT_CHARS = 8;

function resolveLineHeightPx(styles: CSSStyleDeclaration) {
  const parsedLineHeight = Number.parseFloat(styles.lineHeight || "");
  if (Number.isFinite(parsedLineHeight) && parsedLineHeight > 0) {
    return parsedLineHeight;
  }

  const fontSize = Number.parseFloat(styles.fontSize || "0");
  return fontSize > 0 ? fontSize * 1.35 : 0;
}

function getPageBottomBoundary(page: HTMLElement) {
  const pageRect = page.getBoundingClientRect();
  const pageStyles = window.getComputedStyle(page);
  const pagePaddingBottom = Number.parseFloat(pageStyles.paddingBottom || "0");

  return {
    pageRect,
    pagePaddingBottom,
    bottomBoundary: pageRect.bottom - pagePaddingBottom,
  };
}

function arePageGroupsEqual(a: number[][], b: number[][]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((group, groupIndex) => {
    const next = b[groupIndex];
    if (!next || next.length !== group.length) {
      return false;
    }

    return group.every((value, valueIndex) => next[valueIndex] === value);
  });
}

const SALUTATION_PATTERN =
  /^(dear\b|hello\b|hi\b|greetings\b|madame\b|monsieur\b|madame,\s*monsieur\b|bonjour\b)/i;

function compactProposalParagraph(value: string): string {
  return value
    .split("\n")
    .map((line) => stripInlineProposalMarkdown(line))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVolkRegisterMetaEntries(args: {
  letterDate?: string | null;
  recipientDetails?: string | null;
  headerVisibility?: ProposalHeaderVisibility | null;
}): VolkRegisterMetaEntry[] {
  const visibility = resolveProposalHeaderVisibility(args.headerVisibility);
  const { primary, secondaryLines } = resolveProposalRecipientLines(
    args.recipientDetails,
  );
  const mergedTail = visibility.showRecipientDetails
    ? secondaryLines.join(" · ")
    : "";

  return [
    {
      key: "date",
      value:
        visibility.showDate && args.letterDate?.trim()
          ? `date: ${args.letterDate.trim()}`
          : "",
    },
    {
      key: "to",
      value: visibility.showRecipient && primary ? `to: ${primary}` : "",
    },
    {
      key: "recipient_details",
      value: mergedTail,
    },
  ].filter((entry) => entry.value.length > 0);
}

function buildVolkRegisterSenderLine(
  applicantHeader?: ProposalApplicantHeaderData | null,
): string {
  return [
    applicantHeader?.phone?.trim() ?? "",
    applicantHeader?.email?.trim() ?? "",
    applicantHeader?.website?.trim() ?? "",
    applicantHeader?.linkedin?.trim() ?? "",
  ]
    .filter((value) => value.length > 0)
    .join(" · ");
}

function normalizeDocumentContactLine(
  value: string | null | undefined,
): string {
  return String(value ?? "")
    .split(/\s*(?:,|·|•|\|)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function joinNonEmpty(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function countCompactWordmarkChars(value: string): number {
  return Array.from(value.replace(/\s+/g, "")).length;
}

function firstWordmarkToken(value: string): string {
  return value.trim().split(/\s+/u)[0] ?? "";
}

function resolveBauhausWordmark(args: {
  candidateCompany: string;
  candidateName: string;
  recipientCompany: string;
}): string {
  const fullTitle =
    args.candidateCompany || args.candidateName || args.recipientCompany;

  if (
    !fullTitle ||
    countCompactWordmarkChars(fullTitle) <= BAUHAUS_WORDMARK_MAX_COMPACT_CHARS
  ) {
    return fullTitle;
  }

  if (args.candidateCompany && args.candidateName) {
    return firstWordmarkToken(args.candidateName);
  }

  return firstWordmarkToken(fullTitle);
}

function normalizeJoellaDisplayText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function lowercaseEnglishMonthNames(value: string): string {
  return value.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    (month) => month.toLowerCase(),
  );
}

function splitJoellaSubjectLine(value: string): {
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

function resolveJoellaWordmark(args: {
  candidateCompany: string;
  candidateName: string;
}): string {
  return normalizeJoellaDisplayText(args.candidateCompany || args.candidateName);
}

function uniqueNonEmptyLines(
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

function normalizeEditorialWordmark(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function buildEditorialSenderGroups(
  viewModel: ProposalLetterheadViewModel,
): EditorialContactGroup[] {
  return [
    viewModel.candidateName
      ? {
          label: viewModel.candidateName,
          lines: uniqueNonEmptyLines([viewModel.candidateRole]),
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
    (group): group is EditorialContactGroup =>
      Boolean(group && (group.label || group.lines.length > 0)),
  );
}

function buildEditorialRecipientGroups(
  viewModel: ProposalLetterheadViewModel,
): EditorialContactGroup[] {
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
    (group): group is EditorialContactGroup =>
      Boolean(group && (group.label || group.lines.length > 0)),
  );
}

function commitEditableTextProps(
  editableField: ProposalEditableTextProps | null | undefined,
  value: string,
): void {
  editableField?.onBlur?.({
    currentTarget: {
      textContent: value,
    },
  } as React.FocusEvent<HTMLElement>);
}

function collectEditableValueLines(
  root: HTMLElement | null | undefined,
  selector: string,
): string[] {
  return Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? [])
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);
}

function getClipboardPlainText(
  event: React.ClipboardEvent<HTMLElement>,
): string {
  const plainText = event.clipboardData.getData("text/plain");
  if (plainText) {
    return normalizeEditableText(plainText);
  }
  return normalizeEditableText(event.clipboardData.getData("text/html"));
}

function insertPlainTextIntoEditableTarget(
  target: HTMLElement,
  text: string,
): string {
  const selection = window.getSelection?.();
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (range && target.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else {
    target.textContent = text;
  }

  return normalizeEditableText(target.textContent ?? "");
}

function getEditableValueLineProps(
  editableField: ProposalEditableTextProps | null | undefined,
  onCommit: () => void,
): ProposalEditableTextProps | null {
  if (!editableField) {
    return null;
  }

  const {
    onBlur: _onBlur,
    onInput: _onInput,
    onKeyDown: _onKeyDown,
    onPaste: _onPaste,
    ...props
  } = editableField;
  return {
    ...props,
    onInput: onCommit,
    onBlur: onCommit,
    onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      const pastedText = getClipboardPlainText(event);
      insertPlainTextIntoEditableTarget(event.currentTarget, pastedText);
      onCommit();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key === "Tab") {
        onCommit();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };
}

function getEditableCollectedLineProps(
  editableField: ProposalEditableTextProps | null | undefined,
  selector: string,
  ariaLabel: string,
  options: {
    staticPrefixLines?: string[];
    staticSuffixLines?: string[];
  } = {},
): ProposalEditableTextProps | null {
  if (!editableField) {
    return null;
  }

  const {
    onBlur: _onBlur,
    onInput: _onInput,
    onKeyDown: _onKeyDown,
    onPaste: _onPaste,
    ...props
  } = editableField;
  const commitCollectedLines = (target: HTMLElement) => {
    const currentText = target.textContent ?? "";
    if (currentText.includes("\n")) {
      commitEditableTextProps(editableField, normalizeEditableText(currentText));
      return;
    }

    const collectedLines = collectEditableValueLines(
      target.parentElement,
      selector,
    );
    commitEditableTextProps(
      editableField,
      [
        ...(options.staticPrefixLines ?? []),
        ...collectedLines,
        ...(options.staticSuffixLines ?? []),
      ].join("\n"),
    );
  };

  return {
    ...props,
    "aria-label": ariaLabel,
    onInput: (event: React.FormEvent<HTMLElement>) => {
      commitCollectedLines(event.currentTarget);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      commitCollectedLines(event.currentTarget);
    },
    onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      const pastedText = getClipboardPlainText(event);
      insertPlainTextIntoEditableTarget(event.currentTarget, pastedText);
      commitCollectedLines(event.currentTarget);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key === "Tab") {
        commitCollectedLines(event.currentTarget);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };
}

function ProposalCoverLetterEditorialContactGroups({
  editableField = null,
  editableGroupLabels = null,
  groups,
}: {
  editableField?: ProposalEditableTextProps | null;
  editableGroupLabels?: ReadonlySet<string> | null;
  groups: EditorialContactGroup[];
}): JSX.Element | null {
  const copyRef = React.useRef<HTMLDivElement>(null);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div ref={copyRef} className="proposal-cover-letter__editorial-contact-copy">
      {groups.map((group) => (
        <p key={`${group.label}-${group.lines.join("|")}`}>
          {group.label ? <b>{group.label}</b> : null}
          {group.lines.map((line) => {
            const valueEditable =
              editableField &&
              (!editableGroupLabels || editableGroupLabels.has(group.label));
            return (
              <React.Fragment key={line}>
                <br />
                {valueEditable ? (
                  <span
                    data-proposal-editable-contact-value="true"
                    {...(getEditableValueLineProps(editableField, () => {
                      const lines = collectEditableValueLines(
                        copyRef.current,
                        "[data-proposal-editable-contact-value='true']",
                      );
                      commitEditableTextProps(editableField, lines.join("\n"));
                    }) ?? {})}
                  >
                    {line}
                  </span>
                ) : (
                  line
                )}
              </React.Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function buildJoellaFooterLine(args: {
  location: string;
  email: string;
  phone: string;
}): string {
  return uniqueNonEmptyLines([args.location, args.email, args.phone])
    .map(normalizeJoellaDisplayText)
    .filter(Boolean)
    .join(" · ");
}

function buildBayerFooterLine(args: {
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueNonEmptyLines([
    args.phone,
    args.location,
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function splitTwoweeksNameLines(value: string): string[] {
  const line = value.trim();
  return line ? [line] : [];
}

function buildTwoweeksDigitalLine(args: {
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueNonEmptyLines([
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function normalizeTwoweeksDigitalIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function buildTwoweeksContactLines(args: {
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  website: string;
  other: string;
}): string[] {
  return uniqueNonEmptyLines([
    args.phone,
    normalizeTwoweeksDigitalIdentifier(args.email),
    normalizeTwoweeksDigitalIdentifier(args.linkedin),
    normalizeTwoweeksDigitalIdentifier(args.website),
    normalizeTwoweeksDigitalIdentifier(args.other),
    args.location,
  ]);
}

function buildJoellaHeaderContactLine(args: {
  phone: string;
  email: string;
  linkedin: string;
  website: string;
  other: string;
}): string {
  return uniqueNonEmptyLines([
    args.email,
    args.phone,
    args.linkedin,
    args.website,
    args.other,
  ]).join(" · ");
}

function buildJoellaSubjectLine(args: {
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

const JOELLA_RECIPIENT_KNOWN_LABELS = new Set([
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

function normalizeJoellaRecipientLineKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeJoellaRecipientRawLine(line: string): string {
  const match = line.match(/^([A-Za-z][A-Za-z -]{0,32})\s*:\s*(.+)$/);
  if (!match) {
    return line;
  }

  return JOELLA_RECIPIENT_KNOWN_LABELS.has(match[1].toLowerCase())
    ? match[2].trim()
    : line;
}

function buildJoellaRecipientBlockLines(args: {
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
    return uniqueNonEmptyLines(primaryLines);
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
      .map((value) => normalizeJoellaRecipientLineKey(value))
      .filter(Boolean),
  );
  const extraLines = String(args.recipientDetails ?? "")
    .split("\n")
    .map((line) => normalizeJoellaRecipientRawLine(line.trim()))
    .filter((line) => {
      if (!line) {
        return false;
      }
      return !fieldKeys.has(normalizeJoellaRecipientLineKey(line));
    });

  return uniqueNonEmptyLines([
    ...primaryLines,
    args.recipientFields.email,
    args.recipientFields.address,
    args.recipientFields.city,
    ...extraLines,
  ]);
}

function buildDirectorDigitalContactLines(
  parts: ReturnType<typeof parseProposalContactLine>,
): string[] {
  const values = uniqueNonEmptyLines([
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

function buildProposalLetterheadViewModel(args: {
  applicantHeader?: ProposalApplicantHeaderData | null;
  railTitle?: string | null;
  railMeta?: string | null;
  contactLine?: string | null;
  letterDate?: string | null;
  recipientDetails?: string | null;
  documentTitle?: string | null;
  documentMeta?: string | null;
  headerVisibility?: ProposalHeaderVisibility | null;
}): ProposalLetterheadViewModel {
  const visibility = resolveProposalHeaderVisibility(args.headerVisibility);
  const recipientFields = parseProposalRecipientDetails(args.recipientDetails);
  const candidateName =
    args.applicantHeader?.name?.trim() || args.railTitle?.trim() || "";
  const candidateRole =
    args.applicantHeader?.role?.trim() ||
    args.railMeta?.trim() ||
    args.documentMeta?.trim() ||
    "";
  const candidateCompany = args.applicantHeader?.company?.trim() ?? "";
  const candidatePhone = args.applicantHeader?.phone?.trim() ?? "";
  const candidateEmail = args.applicantHeader?.email?.trim() ?? "";
  const candidateWebsite = args.applicantHeader?.website?.trim() ?? "";
  const candidateLinkedin = args.applicantHeader?.linkedin?.trim() ?? "";
  const candidateLocationLine = args.applicantHeader?.location?.trim() ?? "";
  const explicitContactLine = normalizeDocumentContactLine(args.contactLine);
  const explicitContactParts = parseProposalContactLine(explicitContactLine);
  const resolvedContactParts = {
    email: candidateEmail || explicitContactParts.email,
    phone: candidatePhone || explicitContactParts.phone,
    location: candidateLocationLine || explicitContactParts.location,
    linkedin: candidateLinkedin || explicitContactParts.linkedin,
    website: candidateWebsite || explicitContactParts.website,
    other: explicitContactParts.other,
  };
  const candidateContactLine =
    buildProposalContactLineFromParts(resolvedContactParts) ||
    explicitContactLine;
  const candidateDirectorContactLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const candidateDigitalContactLines =
    buildDirectorDigitalContactLines(resolvedContactParts);
  const candidateDirectorContactMark = resolvedContactParts.phone ? "T" : "@";
  const candidateDirectorContactLines = resolvedContactParts.phone
    ? [resolvedContactParts.phone]
    : candidateDigitalContactLines.slice(0, 2);
  const candidateDirectorContactGroups = [
    resolvedContactParts.phone
      ? { mark: "T" as const, lines: [resolvedContactParts.phone] }
      : null,
    candidateDigitalContactLines.length
      ? { mark: "@" as const, lines: candidateDigitalContactLines }
      : null,
  ].filter(
    (group): group is { mark: "T" | "@"; lines: string[] } => Boolean(group),
  );
  const candidateShortLocationLine = resolveProposalLetterheadShortTitle({
    recipientFields,
    candidateLocation: resolvedContactParts.location,
    showRecipient: false,
  });
  const candidateVolkSenderLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
    phone: resolvedContactParts.phone,
    location: candidateShortLocationLine,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
  });
  const candidateFilmSenderLine = buildProposalContactLineFromParts({
    email: resolvedContactParts.email,
  });
  const candidateFilmAddressLine = resolvedContactParts.location;
  const explicitJoellaCandidateName =
    args.applicantHeader?.name?.trim() ||
    (args.railTitle?.trim() &&
    args.railTitle.trim() !== args.documentTitle?.trim()
      ? args.railTitle.trim()
      : "");
  const joellaSenderName = explicitJoellaCandidateName;
  const candidateJoellaWordmark = resolveJoellaWordmark({
    candidateCompany,
    candidateName: explicitJoellaCandidateName,
  });
  const candidateJoellaFooterLine = buildJoellaFooterLine({
    location: resolvedContactParts.location,
    email: resolvedContactParts.email,
    phone: resolvedContactParts.phone,
  });
  const candidateBayerFooterLine = buildBayerFooterLine({
    phone: resolvedContactParts.phone,
    location: resolvedContactParts.location,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const candidateTwoweeksNameLines = splitTwoweeksNameLines(candidateName);
  const candidateTwoweeksIdentityLines = uniqueNonEmptyLines([
    candidateRole,
    candidateCompany,
  ]);
  const candidateTwoweeksFooterLine = buildTwoweeksDigitalLine({
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const candidateTwoweeksContactLines = buildTwoweeksContactLines({
    phone: resolvedContactParts.phone,
    email: resolvedContactParts.email,
    location: resolvedContactParts.location,
    linkedin: resolvedContactParts.linkedin,
    website: resolvedContactParts.website,
    other: resolvedContactParts.other,
  });
  const recipientName = visibility.showRecipient
    ? recipientFields.name?.trim() ?? ""
    : "";
  const recipientCompany = visibility.showRecipient
    ? recipientFields.company?.trim() ?? ""
    : "";
  const recipientRole = visibility.showRecipient
    ? recipientFields.role?.trim() ?? ""
    : "";
  const recipientAddress =
    visibility.showRecipient && visibility.showRecipientDetails
      ? recipientFields.address?.trim() ?? ""
      : "";
  const recipientEmail =
    visibility.showRecipient && visibility.showRecipientDetails
      ? recipientFields.email?.trim() ?? ""
      : "";
  const recipientCity =
    visibility.showRecipient && visibility.showRecipientDetails
      ? recipientFields.city?.trim() ?? ""
      : "";
  const recipientExtraLines =
    visibility.showRecipient && visibility.showRecipientDetails
      ? getProposalRecipientExtraLines(args.recipientDetails, recipientFields)
      : [];
  const recipientEditorialName = recipientFields.name?.trim() ?? "";
  const recipientEditorialCompany = recipientFields.company?.trim() ?? "";
  const recipientEditorialRole = recipientFields.role?.trim() ?? "";
  const recipientEditorialAddress = recipientFields.address?.trim() ?? "";
  const recipientEditorialEmail = recipientFields.email?.trim() ?? "";
  const recipientEditorialCity = recipientFields.city?.trim() ?? "";
  const recipientEditorialExtraLines = getProposalRecipientExtraLines(
    args.recipientDetails,
    recipientFields,
  );
  const recipientContactLines = uniqueNonEmptyLines(
    [recipientEmail, recipientAddress, recipientCity, ...recipientExtraLines],
    [recipientName, recipientCompany, recipientRole],
  );
  const recipientHeadingLines = visibility.showRecipient
    ? uniqueNonEmptyLines([
        recipientFields.name,
        recipientFields.role,
        recipientFields.company,
        recipientFields.email,
        recipientFields.address,
        recipientFields.city,
        ...recipientExtraLines,
      ])
    : [];
  const subject = visibility.showSubject ? args.documentTitle?.trim() ?? "" : "";
  const joellaLetterBlock = {
    senderLines: visibility.showSender
      ? uniqueNonEmptyLines([
          joellaSenderName,
          candidateRole,
          candidateCompany,
          buildJoellaHeaderContactLine({
            phone: resolvedContactParts.phone,
            email: resolvedContactParts.email,
            linkedin: resolvedContactParts.linkedin,
            website: resolvedContactParts.website,
            other: resolvedContactParts.other,
          }),
          resolvedContactParts.location,
        ])
      : [],
    dateLine: visibility.showDate
      ? lowercaseEnglishMonthNames(args.letterDate?.trim() ?? "")
      : "",
    recipientLines: visibility.showRecipient
      ? buildJoellaRecipientBlockLines({
          recipientDetails: args.recipientDetails,
          recipientFields,
          showDetails: true,
        })
      : [],
    subjectLine: visibility.showSubject
      ? buildJoellaSubjectLine({
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
    candidateContactLine,
    candidateDirectorContactLine,
    candidateDirectorContactMark,
    candidateDirectorContactLines,
    candidateDirectorContactGroups,
    candidateVolkSenderLine,
    candidateFilmSenderLine,
    candidateFilmAddressLine,
    candidateJoellaWordmark,
    candidateJoellaFooterLine,
    candidateBayerFooterLine,
    candidateTwoweeksNameLines,
    candidateTwoweeksIdentityLines,
    candidateTwoweeksFooterLine,
    candidateTwoweeksContactLines,
    candidateLocationLine: resolvedContactParts.location,
    candidatePhone: resolvedContactParts.phone,
    candidateEmail: resolvedContactParts.email,
    candidateWebsite: joinNonEmpty([
      resolvedContactParts.linkedin,
      resolvedContactParts.website,
    ]),
    candidateSocialLines: uniqueNonEmptyLines([
      resolvedContactParts.linkedin,
      resolvedContactParts.other,
    ]),
    candidateWebsiteLines: uniqueNonEmptyLines([
      resolvedContactParts.website,
    ]),
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
    joellaLetterBlock,
    date: visibility.showDate ? args.letterDate?.trim() ?? "" : "",
    subject,
    secondaryTitle,
    metaRole,
    shortRoleTitle,
    showSender: visibility.showSender,
  };
}

function ProposalCoverLetterMetaRow({
  editableFields,
  viewModel,
}: {
  editableFields?: ProposalCoverLetterEditableFields | null;
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element {
  const roleOrCompany = viewModel.metaRole || viewModel.recipientCompany;
  const values = [
    viewModel.recipientName,
    roleOrCompany,
    viewModel.metaRole ? viewModel.recipientCompany : "",
    viewModel.date,
  ];
  const recipientMetaValueSelector =
    "[data-proposal-recipient-meta-value='true']";

  return (
    <div className="proposal-cover-letter__meta-row" aria-label="Letter metadata">
      {values.map((value, index) => {
        const isRecipientValue = index < 3 && Boolean(value);
        return (
          <p
            key={`meta-${index}`}
            className="proposal-cover-letter__meta-item"
            data-proposal-recipient-meta-value={
              isRecipientValue ? "true" : undefined
            }
            {...(isRecipientValue
              ? getEditableCollectedLineProps(
                  editableFields?.recipient,
                  recipientMetaValueSelector,
                  index === 0
                    ? "Edit recipient details"
                    : "Edit recipient detail line",
                  { staticSuffixLines: viewModel.recipientContactLines },
                ) ?? {}
              : index === 3
                ? editableFields?.date ?? {}
                : {})}
          >
            {value}
          </p>
        );
      })}
    </div>
  );
}

function ProposalCoverLetterSubjectRow({
  editableFields,
  viewModel,
  prefix = "Subject:",
}: {
  editableFields?: ProposalCoverLetterEditableFields | null;
  viewModel: ProposalLetterheadViewModel;
  prefix?: string;
}): JSX.Element | null {
  if (!viewModel.subject) {
    return null;
  }

  return (
    <div className="proposal-cover-letter__subject-row">
      <span className="proposal-cover-letter__subject-label">{prefix}</span>
      <span
        className="proposal-cover-letter__subject-value"
        {...(editableFields?.subject ?? {})}
      >
        {viewModel.subject}
      </span>
    </div>
  );
}

function ProposalCoverLetterRecipientBlock({
  editableFields,
  viewModel,
}: {
  editableFields?: ProposalCoverLetterEditableFields | null;
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element | null {
  if (viewModel.recipientContactLines.length === 0) {
    return null;
  }
  const recipientHeadingOnlyLines = uniqueNonEmptyLines([
    viewModel.recipientName,
    viewModel.recipientRole,
    viewModel.recipientCompany,
  ]);

  return (
    <section
      className="proposal-cover-letter__recipient-block"
      aria-label="Recipient contact details"
    >
      {viewModel.recipientContactLines.map((line, index) => (
        <p
          key={line}
          {...(getEditableCollectedLineProps(
            editableFields?.recipient,
            "p",
            index === 0 ? "Edit recipient details" : "Edit recipient detail line",
            { staticPrefixLines: recipientHeadingOnlyLines },
          ) ?? {})}
        >
          {line}
        </p>
      ))}
    </section>
  );
}

function ProposalCoverLetterRecipientSubjectStack({
  editableFields,
  prefix,
  viewModel,
}: {
  editableFields?: ProposalCoverLetterEditableFields | null;
  prefix?: string;
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element | null {
  if (viewModel.recipientContactLines.length === 0 && !viewModel.subject) {
    return null;
  }

  return (
    <div
      className="proposal-cover-letter__recipient-subject-stack"
      aria-label="Recipient and subject details"
    >
      <ProposalCoverLetterRecipientBlock
        editableFields={editableFields}
        viewModel={viewModel}
      />
      <ProposalCoverLetterSubjectRow
        editableFields={editableFields}
        viewModel={viewModel}
        prefix={prefix}
      />
    </div>
  );
}

function ProposalCoverLetterDirectorContactGrid({
  viewModel,
}: {
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element | null {
  if (viewModel.candidateDirectorContactGroups.length === 0) {
    return null;
  }

  return (
    <section
      className="proposal-cover-letter__contact-grid"
      aria-label="Sender contact details"
    >
      {viewModel.candidateDirectorContactGroups.map((group) => (
        <div
          className={[
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
            .join(" ")}
          key={group.mark}
        >
          <p className="proposal-cover-letter__contact-mark">{group.mark}</p>
          <div className="proposal-cover-letter__contact-lines">
            {group.lines.map((line) => (
              <p key={`${group.mark}-${line}`}>{line}</p>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProposalCoverLetterEditorialTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const wordmark = normalizeEditorialWordmark(
    viewModel.candidateCompany || viewModel.candidateName,
  );
  const subtitle = viewModel.candidateRole || viewModel.shortRoleTitle;
  const recipientGroups = buildEditorialRecipientGroups(viewModel);
  const senderGroups = buildEditorialSenderGroups(viewModel);
  const editableSenderContactLabels = React.useMemo(
    () => new Set(["Company", "Location", "Phone", "Email", "Social", "WWW"]),
    [],
  );

  return (
    <>
      {!isContinuationPage ? (
        <>
          <span
            className="proposal-cover-letter__editorial-top-ribbon"
            aria-hidden="true"
          />
          <span
            className="proposal-cover-letter__editorial-header-rule"
            aria-hidden="true"
          />

          {wordmark ? (
            <p
              className="proposal-cover-letter__editorial-wordmark"
              {...(editableFields?.senderName ?? {})}
            >
              {wordmark}
            </p>
          ) : null}
          {subtitle ? (
            <p
              className="proposal-cover-letter__editorial-subtitle"
              {...(editableFields?.senderRole ?? {})}
            >
              {subtitle}
            </p>
          ) : null}

          <span
            className="proposal-cover-letter__editorial-rail-rule"
            aria-hidden="true"
          />
          <span
            className="proposal-cover-letter__editorial-body-rule"
            aria-hidden="true"
          />
          {viewModel.subject ? (
            <p
              className="proposal-cover-letter__editorial-subject"
              {...(editableFields?.subject ?? {})}
            >
              {viewModel.subject}
            </p>
          ) : null}

          {viewModel.date ? (
            <>
              <p
                className="proposal-cover-letter__editorial-date"
                {...(editableFields?.date ?? {})}
              >
                {viewModel.date}
              </p>
              <span
                className="proposal-cover-letter__editorial-date-rule"
                aria-hidden="true"
              />
            </>
          ) : null}

          {recipientGroups.length > 0 ? (
            <section className="proposal-cover-letter__editorial-recipient">
              <p className="proposal-cover-letter__editorial-label">
                To
              </p>
              <span
                className="proposal-cover-letter__editorial-label-rule"
                aria-hidden="true"
              />
              <ProposalCoverLetterEditorialContactGroups
                editableField={editableFields?.recipient ?? null}
                groups={recipientGroups}
              />
            </section>
          ) : null}

          {senderGroups.length > 0 ? (
            <section className="proposal-cover-letter__editorial-sender">
              <p className="proposal-cover-letter__editorial-label">
                From
              </p>
              <span
                className="proposal-cover-letter__editorial-label-rule proposal-cover-letter__editorial-label-rule--sender"
                aria-hidden="true"
              />
              <ProposalCoverLetterEditorialContactGroups
                editableField={editableFields?.senderContact ?? null}
                editableGroupLabels={editableSenderContactLabels}
                groups={senderGroups}
              />
            </section>
          ) : null}
        </>
      ) : null}

      <section
        ref={bodyRef ?? undefined}
        className={[
          "proposal-cover-letter__editorial-body-flow",
          "proposal-cover-letter__body",
          !isContinuationPage && viewModel.subject
            ? "proposal-cover-letter__editorial-body-flow--subject-heading"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {bodyContent}
      </section>
    </>
  );
}

export function ProposalCoverLetterTwoweeksTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const showSenderRail =
    viewModel.showSender &&
    Boolean(
      viewModel.candidateTwoweeksNameLines.length ||
        viewModel.candidateTwoweeksIdentityLines.length ||
        viewModel.candidateTwoweeksContactLines.length,
  );
  const twoweeksRoleLine = viewModel.candidateTwoweeksIdentityLines[0] ?? "";
  const twoweeksCompanyLines = viewModel.candidateTwoweeksIdentityLines.slice(1);
  const twoweeksNameLine = viewModel.candidateTwoweeksNameLines.join(" ");
  const twoweeksContactGroups = [
    uniqueNonEmptyLines([
      viewModel.candidatePhone,
      normalizeTwoweeksDigitalIdentifier(viewModel.candidateEmail),
      ...viewModel.candidateSocialLines.map(normalizeTwoweeksDigitalIdentifier),
    ]),
    uniqueNonEmptyLines(
      viewModel.candidateWebsiteLines.map(normalizeTwoweeksDigitalIdentifier),
    ),
    uniqueNonEmptyLines([viewModel.candidateLocationLine]),
  ].filter((group) => group.length > 0);

  return (
    <>
      {!isContinuationPage ? (
        <>
          {showSenderRail ? (
            <aside
              className="proposal-cover-letter__twoweeks-rail"
              aria-label="Sender details"
            >
              {twoweeksNameLine || twoweeksRoleLine ? (
                <div className="proposal-cover-letter__twoweeks-name">
                  {twoweeksNameLine ? (
                    <p
                      className="proposal-cover-letter__twoweeks-name-value"
                      {...(editableFields?.senderName ?? {})}
                    >
                      {twoweeksNameLine}
                    </p>
                  ) : null}
                  {twoweeksRoleLine ? (
                    <p
                      className="proposal-cover-letter__twoweeks-role"
                      {...(editableFields?.senderRole ?? {})}
                    >
                      {twoweeksRoleLine}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {twoweeksCompanyLines.length > 0 ? (
                <div className="proposal-cover-letter__twoweeks-identity">
                  {twoweeksCompanyLines.map((line, index) => (
                    <React.Fragment key={`twoweeks-identity-${index}-${line}`}>
                      <p>{line}</p>
                      {index < twoweeksCompanyLines.length - 1 ? " " : null}
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
              {twoweeksContactGroups.length > 0 ? (
                <div className="proposal-cover-letter__twoweeks-contact">
                  {twoweeksContactGroups.map((group, groupIndex) => (
                    <div
                      className="proposal-cover-letter__twoweeks-contact-group"
                      key={`twoweeks-contact-group-${groupIndex}`}
                    >
                      {group.map((line, index) => (
                        <p
                          key={`twoweeks-contact-${groupIndex}-${index}-${line}`}
                          {...(getEditableCollectedLineProps(
                            editableFields?.senderContact,
                            ".proposal-cover-letter__twoweeks-contact-group p",
                            groupIndex === 0 && index === 0
                              ? "Edit sender contact details"
                              : "Edit sender contact detail line",
                          ) ?? {})}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </aside>
          ) : null}
          {viewModel.date ? (
            <p
              className="proposal-cover-letter__twoweeks-date"
              {...(editableFields?.date ?? {})}
            >
              {viewModel.date}
            </p>
          ) : null}
          {viewModel.recipientHeadingLines.length > 0 ? (
            <section
              className="proposal-cover-letter__twoweeks-recipient"
              aria-label="Recipient details"
            >
              {viewModel.recipientHeadingLines.map((line, index) => (
                <p
                  key={`twoweeks-recipient-${line}`}
                  {...(getEditableCollectedLineProps(
                    editableFields?.recipient,
                    "p",
                    index === 0
                      ? "Edit recipient details"
                      : "Edit recipient detail line",
                  ) ?? {})}
                >
                  {line}
                </p>
              ))}
            </section>
          ) : null}
          {viewModel.subject ? (
            <p className="proposal-cover-letter__twoweeks-subject">
              <span className="proposal-cover-letter__twoweeks-subject-label">
                Subject:
              </span>{" "}
              <span
                className="proposal-cover-letter__twoweeks-subject-value"
                {...(editableFields?.subject ?? {})}
              >
                {viewModel.subject}
              </span>
            </p>
          ) : null}
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterDirectorTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const hasSecondaryTitle = Boolean(viewModel.secondaryTitle);

  return (
    <>
      {!isContinuationPage ? (
        <>
          <header
            className={[
              "proposal-cover-letter__masthead",
              hasSecondaryTitle
                ? ""
                : "proposal-cover-letter__masthead--no-secondary",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {viewModel.candidateName ? (
              <p
                className="proposal-cover-letter__masthead-primary"
                {...(editableFields?.senderName ?? {})}
              >
                {viewModel.candidateName}
              </p>
            ) : null}
            {viewModel.secondaryTitle ? (
              <p className="proposal-cover-letter__masthead-secondary">
                {viewModel.secondaryTitle}
              </p>
            ) : null}
            {viewModel.candidateRole ? (
              <p
                className="proposal-cover-letter__masthead-role"
                {...(editableFields?.senderRole ?? {})}
              >
                {viewModel.candidateRole}
              </p>
            ) : null}
          </header>
          <section className="proposal-cover-letter__sender-block">
            <p className="proposal-cover-letter__sender-label">Sender</p>
            <div className="proposal-cover-letter__sender-lines">
              {viewModel.candidateName ? (
                <p>{viewModel.candidateName}</p>
              ) : null}
              {viewModel.candidateLocationLine ? (
                <p>{viewModel.candidateLocationLine}</p>
              ) : null}
            </div>
          </section>
          <ProposalCoverLetterDirectorContactGrid viewModel={viewModel} />
          <ProposalCoverLetterMetaRow
            editableFields={editableFields}
            viewModel={viewModel}
          />
          <ProposalCoverLetterRecipientSubjectStack
            editableFields={editableFields}
            viewModel={viewModel}
          />
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterVolkTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  return (
    <>
      {!isContinuationPage ? (
        <>
          <header className="proposal-cover-letter__volk-header">
            {viewModel.candidateName ? (
              <p
                className="proposal-cover-letter__volk-title"
                {...(editableFields?.senderName ?? {})}
              >
                {viewModel.candidateName}
              </p>
            ) : null}
            {viewModel.secondaryTitle ? (
              <p className="proposal-cover-letter__volk-title proposal-cover-letter__volk-title--right">
                {viewModel.secondaryTitle}
              </p>
            ) : null}
            {viewModel.candidateRole ? (
              <p
                className="proposal-cover-letter__volk-subtitle"
                {...(editableFields?.senderRole ?? {})}
              >
                {viewModel.candidateRole}
              </p>
            ) : null}
            {viewModel.candidateVolkSenderLine ? (
              <p className="proposal-cover-letter__volk-sender">
                sender:{" "}
                <span {...(editableFields?.senderContact ?? {})}>
                  {viewModel.candidateVolkSenderLine}
                </span>
              </p>
            ) : null}
          </header>
          <ProposalCoverLetterMetaRow
            editableFields={editableFields}
            viewModel={viewModel}
          />
          <ProposalCoverLetterRecipientSubjectStack
            editableFields={editableFields}
            viewModel={viewModel}
          />
          <span className="proposal-cover-letter__dot" aria-hidden="true" />
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterFilmFotoTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const filmKicker = viewModel.candidateRole || viewModel.secondaryTitle;
  const filmTitle = viewModel.candidateName || viewModel.secondaryTitle;

  return (
    <>
      {!isContinuationPage ? (
        <>
          <header className="proposal-cover-letter__film-header">
            {filmKicker ? (
              <p
                className="proposal-cover-letter__film-heading"
                {...(editableFields?.senderRole ?? {})}
              >
                {filmKicker}
              </p>
            ) : null}
            {filmTitle ? (
              <p
                className="proposal-cover-letter__film-title"
                {...(editableFields?.senderName ?? {})}
              >
                {filmTitle}
              </p>
            ) : null}
            <span className="proposal-cover-letter__film-rule" />
          </header>
          <section className="proposal-cover-letter__info-blocks">
            {viewModel.candidateFilmSenderLine ? (
              <div>
                <p className="proposal-cover-letter__info-label">sender</p>
                <p {...(editableFields?.senderContact ?? {})}>
                  {viewModel.candidateFilmSenderLine}
                </p>
              </div>
            ) : null}
            {viewModel.recipientCompany ? (
              <div>
                <p className="proposal-cover-letter__info-label">company</p>
                <p
                  {...(getEditableCollectedLineProps(
                    editableFields?.recipient,
                    "p:not(.proposal-cover-letter__info-label)",
                    "Edit recipient details",
                    {
                      staticPrefixLines: uniqueNonEmptyLines([
                        viewModel.recipientName,
                        viewModel.recipientRole,
                      ]),
                      staticSuffixLines: viewModel.recipientContactLines,
                    },
                  ) ?? {})}
                >
                  {viewModel.recipientCompany}
                </p>
              </div>
            ) : null}
            {viewModel.candidatePhone ? (
              <div className="proposal-cover-letter__info-block proposal-cover-letter__info-block--phone">
                <p className="proposal-cover-letter__info-label">phone</p>
                <p>{viewModel.candidatePhone}</p>
              </div>
            ) : null}
            {viewModel.candidateSocialLines.length > 0 ? (
              <div>
                <p className="proposal-cover-letter__info-label">social</p>
                {viewModel.candidateSocialLines.map((line) => (
                  <p key={`film-social-${line}`}>{line}</p>
                ))}
              </div>
            ) : null}
            {viewModel.candidateWebsiteLines.length > 0 ? (
              <div>
                <p className="proposal-cover-letter__info-label">www</p>
                {viewModel.candidateWebsiteLines.map((line) => (
                  <p key={`film-portfolio-${line}`}>{line}</p>
                ))}
              </div>
            ) : null}
          </section>
          <ProposalCoverLetterMetaRow
            editableFields={editableFields}
            viewModel={viewModel}
          />
          <ProposalCoverLetterRecipientSubjectStack
            editableFields={editableFields}
            viewModel={viewModel}
            prefix="subject:"
          />
          {viewModel.candidateFilmAddressLine ? (
            <p className="proposal-cover-letter__film-address-footer">
              {viewModel.candidateFilmAddressLine}
            </p>
          ) : null}
          <span className="proposal-cover-letter__dot" aria-hidden="true" />
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterMomaBauhausTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const senderLines = uniqueNonEmptyLines([
    viewModel.candidateName,
    viewModel.candidateCompany,
    viewModel.candidateRole,
    viewModel.candidateLocationLine,
  ]);
  const recipientLines = viewModel.recipientHeadingLines;
  const displayTitle = resolveBauhausWordmark({
    candidateCompany: viewModel.candidateCompany,
    candidateName: viewModel.candidateName,
    recipientCompany: viewModel.recipientCompany,
  });
  const subtitle = viewModel.candidateRole || viewModel.shortRoleTitle;
  const footerLeft = joinNonEmpty([
    viewModel.candidateEmail,
    viewModel.candidatePhone,
  ]);
  const footerRight = viewModel.candidateWebsite;

  return (
    <>
      {!isContinuationPage ? (
        <>
          {senderLines.length > 0 ? (
            <section
              className="proposal-cover-letter__bauhaus-sender"
              aria-label="Sender details"
            >
              {senderLines.map((line, index) => (
                <p
                  key={`sender-${line}`}
                  {...(getEditableCollectedLineProps(
                    editableFields?.senderContact,
                    "p",
                    index === 0
                      ? "Edit sender contact details"
                      : "Edit sender contact detail line",
                  ) ?? {})}
                >
                  {line}
                </p>
              ))}
            </section>
          ) : null}
          {recipientLines.length > 0 ? (
            <section
              className="proposal-cover-letter__bauhaus-recipient"
              aria-label="Recipient details"
            >
              {recipientLines.map((line, index) => (
                <p
                  key={`recipient-${line}`}
                  {...(getEditableCollectedLineProps(
                    editableFields?.recipient,
                    "p",
                    index === 0
                      ? "Edit recipient details"
                      : "Edit recipient detail line",
                  ) ?? {})}
                >
                  {line}
                </p>
              ))}
            </section>
          ) : null}
          {displayTitle || subtitle ? (
            <header className="proposal-cover-letter__bauhaus-header">
              {displayTitle ? (
                <p
                  className="proposal-cover-letter__bauhaus-logo"
                  {...(editableFields?.senderName ?? {})}
                >
                  {displayTitle}
                </p>
              ) : null}
              {subtitle ? (
                <p
                  className="proposal-cover-letter__bauhaus-subtitle"
                  {...(editableFields?.senderRole ?? {})}
                >
                  {subtitle}
                </p>
              ) : null}
            </header>
          ) : null}
          {(viewModel.date || viewModel.subject) ? (
            <div className="proposal-cover-letter__bauhaus-meta">
              {viewModel.date ? (
                <p
                  className="proposal-cover-letter__bauhaus-meta-item"
                  {...(editableFields?.date ?? {})}
                >
                  {viewModel.date}
                </p>
              ) : null}
              {viewModel.subject ? (
                <p className="proposal-cover-letter__bauhaus-meta-item proposal-cover-letter__bauhaus-meta-item--subject">
                  Subject:{" "}
                  <span {...(editableFields?.subject ?? {})}>
                    {viewModel.subject}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <span className="proposal-cover-letter__bauhaus-frame" aria-hidden="true" />
          {footerLeft ? (
            <p className="proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--left">
              {footerLeft}
            </p>
          ) : null}
          {footerRight ? (
            <p className="proposal-cover-letter__bauhaus-footer proposal-cover-letter__bauhaus-footer--right">
              {footerRight}
            </p>
          ) : null}
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterJoellaTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const joellaLetterBlockGroups = [
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

  return (
    <>
      {!isContinuationPage ? (
        <>
          <span className="proposal-cover-letter__joella-frame" aria-hidden="true" />
          <span className="proposal-cover-letter__joella-divider" aria-hidden="true" />
          {viewModel.candidateJoellaWordmark ? (
            <p
              className="proposal-cover-letter__joella-wordmark"
              {...(editableFields?.senderName ?? {})}
            >
              {viewModel.candidateJoellaWordmark}
            </p>
          ) : null}
          {viewModel.candidateJoellaFooterLine ? (
            <p
              className="proposal-cover-letter__joella-footer"
              {...(editableFields?.senderContact ?? {})}
            >
              {viewModel.candidateJoellaFooterLine}
            </p>
          ) : null}
        </>
      ) : null}
      <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
        {!isContinuationPage && joellaLetterBlockGroups.length > 0 ? (
          <section
            className="proposal-cover-letter__joella-letter-block"
            aria-label="Letter details"
          >
            {joellaLetterBlockGroups.map((group, groupIndex) => (
              <div
                key={`joella-letter-block-group-${groupIndex}`}
                className="proposal-cover-letter__joella-letter-block-group"
              >
                {group.lines.map((line, lineIndex) => (
                  <p
                    key={`joella-letter-block-${groupIndex}-${line}`}
                    className={[
                      lineIndex === 0 &&
                      (group.kind === "sender" || group.kind === "recipient")
                        ? "proposal-cover-letter__joella-letter-block-line--strong"
                        : "",
                      group.kind === "subject"
                        ? "proposal-cover-letter__joella-letter-block-line--subject"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {group.kind === "subject" ? (
                      <>
                        {splitJoellaSubjectLine(line).label}
                        <span
                          className="proposal-cover-letter__joella-letter-block-subject-value"
                          {...(editableFields?.subject ?? {})}
                        >
                          {splitJoellaSubjectLine(line).subject}
                        </span>
                      </>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            ))}
          </section>
        ) : null}
        {bodyContent}
      </div>
    </>
  );
}

export function ProposalCoverLetterBayerTemplate({
  bodyRef,
  bodyContent,
  editableFields,
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  const bayerName =
    viewModel.candidateName === viewModel.subject ? "" : viewModel.candidateName;
  const recipientAddressLine = joinNonEmpty([
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
  const flowClassName = [
    "proposal-cover-letter__bayer-flow",
    !isContinuationPage && viewModel.subject
      ? "proposal-cover-letter__bayer-flow--with-subject"
      : "proposal-cover-letter__bayer-flow--no-subject",
    isContinuationPage
      ? "proposal-cover-letter__bayer-flow--continuation"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {!isContinuationPage ? (
        <>
          {showSender ? (
            <header
              className={[
                "proposal-cover-letter__bayer-header",
                viewModel.candidateCompany
                  ? "proposal-cover-letter__bayer-header--has-company"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Sender details"
            >
              {bayerName ? (
                <p
                  className="proposal-cover-letter__bayer-name"
                  {...(editableFields?.senderName ?? {})}
                >
                  {bayerName}
                </p>
              ) : null}
              <span
                className="proposal-cover-letter__bayer-rule"
                aria-hidden="true"
              />
              {viewModel.candidateRole ? (
                <p
                  className="proposal-cover-letter__bayer-role"
                  {...(editableFields?.senderRole ?? {})}
                >
                  {viewModel.candidateRole}
                </p>
              ) : null}
              {viewModel.candidateCompany ? (
                <p className="proposal-cover-letter__bayer-company">
                  {viewModel.candidateCompany}
                </p>
              ) : null}
              {viewModel.candidateEmail ? (
                <p
                  className="proposal-cover-letter__bayer-email"
                  {...(editableFields?.senderContact ?? {})}
                >
                  {viewModel.candidateEmail}
                </p>
              ) : null}
            </header>
          ) : null}
          {recipientLines.length > 0 ? (
            <section
              className="proposal-cover-letter__bayer-recipient"
              aria-label="Recipient details"
            >
              <p className="proposal-cover-letter__bayer-label">TO</p>
              <div
                className="proposal-cover-letter__bayer-recipient-values"
              >
                {recipientLines.map((line, index) => (
                  <p
                    key={`bayer-recipient-${line.value}`}
                    className={line.className || undefined}
                    {...(getEditableCollectedLineProps(
                      editableFields?.recipient,
                      "p",
                      index === 0
                        ? "Edit recipient details"
                        : "Edit recipient detail line",
                    ) ?? {})}
                  >
                    {line.value}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          {viewModel.date ? (
            <section
              className="proposal-cover-letter__bayer-date"
              aria-label="Letter date"
            >
              <p className="proposal-cover-letter__bayer-label">DATE</p>
              <p
                className="proposal-cover-letter__bayer-date-value"
                {...(editableFields?.date ?? {})}
              >
                {viewModel.date}
              </p>
            </section>
          ) : null}
          {viewModel.candidateBayerFooterLine ? (
            <p className="proposal-cover-letter__bayer-footer">
              {viewModel.candidateBayerFooterLine}
            </p>
          ) : null}
        </>
      ) : null}
      <section className={flowClassName}>
        {!isContinuationPage && viewModel.subject ? (
          <section
            className="proposal-cover-letter__bayer-subject"
            aria-label="Letter subject"
          >
            <p className="proposal-cover-letter__bayer-label">SUBJECT</p>
            <p
              className="proposal-cover-letter__bayer-subject-value"
              {...(editableFields?.subject ?? {})}
            >
              {viewModel.subject}
            </p>
          </section>
        ) : null}
        <div ref={bodyRef ?? undefined} className="proposal-cover-letter__body">
          {bodyContent}
        </div>
      </section>
    </>
  );
}

function buildStructuredHeaderValues(args: {
  letterDate?: string | null;
  recipientDetails?: string | null;
  documentTitle?: string | null;
  headerVisibility?: ProposalHeaderVisibility | null;
}): StructuredHeaderValues | null {
  const visibility = resolveProposalHeaderVisibility(args.headerVisibility);
  const recipientFields = parseProposalRecipientDetails(args.recipientDetails);
  const date = visibility.showDate ? args.letterDate?.trim() ?? "" : "";
  const subject = visibility.showSubject
    ? args.documentTitle?.trim() ?? ""
    : "";
  const toLines = visibility.showRecipient
    ? [
        recipientFields.name,
        recipientFields.role,
        recipientFields.company,
      ].filter(Boolean)
    : [];
  const recipientDetailLines =
    visibility.showRecipient && visibility.showRecipientDetails
      ? [
          recipientFields.email,
          recipientFields.address,
          recipientFields.city,
          ...getProposalRecipientExtraLines(args.recipientDetails, recipientFields),
        ].filter(Boolean)
      : [];

  if (
    !date &&
    !subject &&
    toLines.length === 0 &&
    recipientDetailLines.length === 0
  ) {
    return null;
  }

  return { date, subject, toLines, recipientDetailLines };
}

function splitParagraphIntoPaginationFragments(paragraph: string): string[] {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const targetLength = 260;
  if (normalized.length <= targetLength) {
    return [normalized];
  }

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const sourceParts =
    sentenceParts.length > 1
      ? sentenceParts
      : normalized
          .split(/,\s+/)
          .map((part, index, parts) =>
            index < parts.length - 1 ? `${part},` : part,
          )
          .map((part) => part.trim())
          .filter(Boolean);

  if (sourceParts.length <= 1) {
    const words = normalized.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && next.length > targetLength) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  const fragments: string[] = [];
  let current = "";

  sourceParts.forEach((part) => {
    const next = current ? `${current} ${part}` : part;
    if (current && next.length > targetLength) {
      fragments.push(current);
      current = part;
    } else {
      current = next;
    }
  });

  if (current) {
    fragments.push(current);
  }

  return fragments;
}

function parseProposalDocumentContent(
  content: string,
  proposalType?: FormValues["proposalType"] | null,
): ParsedProposalDocument {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      kind: proposalType === "freelance_proposal" ? "proposal" : "letter",
      salutation: null,
      paragraphs: [],
      bodyBlocks: [],
      signOff: null,
      signatureName: null,
      rawBody: "",
    };
  }

  const inferredKind =
    proposalType === "freelance_proposal"
      ? "proposal"
      : proposalType === "application_message"
        ? "message"
        : "letter";

  if (inferredKind === "proposal") {
    const paragraphs = normalized
      .split(/\n\s*\n/)
      .map(compactProposalParagraph)
      .filter(Boolean);
    const bodyBlocks = parseProposalPlainTextBlocks(normalized);

    return {
      kind: "proposal",
      salutation: null,
      paragraphs,
      bodyBlocks,
      signOff: null,
      signatureName: null,
      rawBody: normalized,
    };
  }

  const rawLines = normalized.split("\n");
  let start = 0;
  let end = rawLines.length - 1;

  while (start <= end && !stripInlineProposalMarkdown(rawLines[start])) {
    start += 1;
  }

  while (end >= start && !stripInlineProposalMarkdown(rawLines[end])) {
    end -= 1;
  }

  let salutation: string | null = null;

  const candidateSalutation = stripInlineProposalMarkdown(
    rawLines[start] ?? "",
  );
  if (candidateSalutation && SALUTATION_PATTERN.test(candidateSalutation)) {
    salutation = candidateSalutation;
    start += 1;
  }

  while (start <= end && !stripInlineProposalMarkdown(rawLines[start])) {
    start += 1;
  }

  const paragraphs = rawLines
    .slice(start, end + 1)
    .join("\n")
    .split(/\n\s*\n/)
    .filter(Boolean);
  const extractedClosingBlock =
    extractProposalClosingBlockFromParagraphs(paragraphs);
  const closingBlock = extractedClosingBlock?.block ?? null;

  if (extractedClosingBlock) {
    paragraphs.splice(extractedClosingBlock.startIndex);
  }

  const body = paragraphs.join("\n\n");

  return {
    kind: inferredKind,
    salutation,
    paragraphs: paragraphs.map(compactProposalParagraph).filter(Boolean),
    bodyBlocks: parseProposalPlainTextBlocks(body),
    signOff: closingBlock?.signOff ?? null,
    signatureName: closingBlock?.signatureName ?? null,
    rawBody: body.trim(),
  };
}

function buildProposalDocumentBlocks(
  parsedDocument: ParsedProposalDocument,
  closing?: ProposalClosingRef | null,
): ProposalDocumentBlock[] {
  const blocks: ProposalDocumentBlock[] = [];

  if (parsedDocument.salutation) {
    blocks.push({
      id: "salutation",
      type: "salutation",
      text: parsedDocument.salutation,
    });
  }

  const bodyBlocks =
    parsedDocument.bodyBlocks.length > 0
      ? parsedDocument.bodyBlocks
      : parsedDocument.paragraphs.map((text) => ({ type: "paragraph", text }) as const);

  bodyBlocks.forEach((bodyBlock, index) => {
    if (bodyBlock.type === "list") {
      blocks.push({
        id: `list-${index}`,
        type: "list",
        items: bodyBlock.items.map((item, itemIndex) => ({
          id: `list-${index}-item-${itemIndex}`,
          text: item,
        })),
      });
      return;
    }

    splitParagraphIntoPaginationFragments(bodyBlock.text).forEach(
      (fragment, fragmentIndex) => {
        blocks.push({
          id: `paragraph-${index}-${fragmentIndex}`,
          type: "paragraph",
          text: fragment,
          paragraphId: `paragraph-${index}`,
          continuation: fragmentIndex > 0,
        });
      },
    );
  });

  if (closing) {
    const signOff = closing.signOff || null;
    const signatureName = closing.enabled ? closing.signatureName || null : null;
    if (signOff || signatureName) {
      blocks.push({
        id: "closing",
        type: "closing",
        signOff,
        signatureName,
        handwrittenSignatureEnabled: closing.enabled
          ? closing.handwrittenSignatureEnabled
          : false,
      });
    }
  } else if (parsedDocument.signOff || parsedDocument.signatureName) {
    blocks.push({
      id: "closing",
      type: "closing",
      signOff: parsedDocument.signOff,
      signatureName: parsedDocument.signatureName,
    });
  }

  return blocks;
}

function buildProposalDocumentBlocksFromStructuredDocument(
  proposalDocument: ProposalDocument,
  closing?: ProposalClosingRef | null,
): ProposalDocumentBlock[] {
  const blocks: ProposalDocumentBlock[] = [];

  proposalDocument.blocks.forEach((block, index) => {
    if (block.type === "salutation") {
      blocks.push({
        id: block.id || "salutation",
        type: "salutation",
        text: block.text,
      });
      return;
    }

    if (block.type === "list") {
      const items = block.items
        .map((item, itemIndex) => ({
          id: item.id || `${block.id || `list-${index}`}-item-${itemIndex}`,
          text: item.text,
          ...(item.iconKey ? { iconKey: item.iconKey } : null),
          marker: item.marker ?? block.marker ?? null,
        }))
        .filter((item) => item.text);
      if (items.length > 0) {
        blocks.push({
          id: block.id || `list-${index}`,
          type: "list",
          items,
          marker: block.marker ?? null,
        });
      }
      return;
    }

    if (block.type === "closing") {
      return;
    }

    splitParagraphIntoPaginationFragments(block.text).forEach(
      (fragment, fragmentIndex) => {
        blocks.push({
          id: `${block.id || `paragraph-${index}`}-${fragmentIndex}`,
          type: "paragraph",
          text: fragment,
          paragraphId: block.id || `paragraph-${index}`,
          continuation: fragmentIndex > 0,
        });
      },
    );
  });

  if (closing) {
    const signOff = closing.signOff || null;
    const signatureName = closing.enabled ? closing.signatureName || null : null;
    if (signOff || signatureName) {
      blocks.push({
        id: "closing",
        type: "closing",
        signOff,
        signatureName,
        handwrittenSignatureEnabled: closing.enabled
          ? closing.handwrittenSignatureEnabled
          : false,
      });
    }
  } else {
    const closingBlock = proposalDocument.blocks.find(
      (block): block is Extract<ProposalDocument["blocks"][number], { type: "closing" }> =>
        block.type === "closing",
    );
    if (closingBlock) {
      blocks.push({
        id: closingBlock.id || "closing",
        type: "closing",
        signOff: closingBlock.signOff || null,
        signatureName: closingBlock.signatureName || null,
        ...(closingBlock.handwrittenSignatureEnabled
          ? { handwrittenSignatureEnabled: true }
          : null),
      });
    }
  }

  return blocks;
}


function paginateMeasuredProposalBlocks(args: {
  blocks: Array<{
    height: number;
    gapBefore: number;
  }>;
  capacity: number;
  firstPageLeadIn?: number;
  continuationPageLeadIn?: number;
  pageBreakSafetyReserve?: number;
}): number[][] {
  const {
    blocks,
    capacity,
    firstPageLeadIn = 0,
    continuationPageLeadIn = firstPageLeadIn,
    pageBreakSafetyReserve = 0,
  } = args;

  if (blocks.length === 0) {
    return [[]];
  }

  const getPageLeadIn = (pageIndex: number) =>
    pageIndex === 0 ? firstPageLeadIn : continuationPageLeadIn;
  const effectiveCapacity = Math.max(0, capacity - pageBreakSafetyReserve);
  const pages: number[][] = [];
  let currentPage: number[] = [];
  let currentPageIndex = 0;
  let usedHeight = getPageLeadIn(currentPageIndex);

  blocks.forEach((block, index) => {
    const nextHeight =
      (currentPage.length === 0 ? 0 : block.gapBefore) + block.height;

    if (
      currentPage.length > 0 &&
      usedHeight + nextHeight > effectiveCapacity + 1
    ) {
      pages.push(currentPage);
      currentPageIndex += 1;
      currentPage = [index];
      usedHeight = getPageLeadIn(currentPageIndex) + block.height;
      return;
    }

    currentPage.push(index);
    usedHeight += nextHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

type DocumentDecorationInteractionState = {
  kind: "move" | "resize";
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  initialDecoration: DocumentDecoration;
  latestDecoration: DocumentDecoration;
  pageRect: DOMRect;
  pageWidthMm: number;
  pageHeightMm: number;
};

function getDecorationPointerClientPosition(
  event: React.PointerEvent<HTMLElement>,
): { clientX: number; clientY: number } | null {
  const nativeEvent = event.nativeEvent as MouseEvent;
  const clientX =
    Number.isFinite(event.clientX) ? event.clientX : nativeEvent.clientX;
  const clientY =
    Number.isFinite(event.clientY) ? event.clientY : nativeEvent.clientY;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  return { clientX, clientY };
}

function ProposalDocumentDecorationLayer({
  decoration,
  mode,
  pageSize,
  onChange,
  onCommit,
}: {
  decoration?: DocumentDecoration | null;
  mode: "readonly" | "design";
  pageSize: DocumentPageSize;
  onChange?: (decoration: DocumentDecoration) => void;
  onCommit?: (decoration: DocumentDecoration) => void;
}): JSX.Element | null {
  const resolvedDecoration = getRenderableDocumentDecoration(decoration);
  const interactionRef = React.useRef<DocumentDecorationInteractionState | null>(
    null,
  );
  const uploadInputId = React.useId();
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  if (!resolvedDecoration) {
    return null;
  }

  const isDesignMode = mode === "design";
  const pageSizeMm = {
    pageWidthMm: pageSize.widthMm,
    pageHeightMm: pageSize.heightMm,
  };
  const { xMm, yMm, sizeMm } = getDocumentDecorationPlacementMm(
    resolvedDecoration,
    pageSizeMm,
  );
  const hasToolbarRoomInlineEnd = xMm + sizeMm + 20 <= pageSize.widthMm;
  const toolbarPlacement = hasToolbarRoomInlineEnd
    ? "side"
    : yMm < 12
      ? "below"
      : "above";
  const toolbarAlignment = xMm < 10 ? "left" : "right";
  const commitDecorationAction = (nextDecoration: DocumentDecoration) => {
    const normalizedDecoration = normalizeDocumentDecoration(nextDecoration);
    onChange?.(normalizedDecoration);
    onCommit?.(normalizedDecoration);
  };
  const handleDecorationUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!file) return;
    void readDocumentDecorationUpload(file)
      .then((uploadedDecoration) => {
        commitDecorationAction({
          ...uploadedDecoration,
          sizePreset: resolvedDecoration.sizePreset,
          customSizeMm: resolvedDecoration.customSizeMm,
          fit: resolvedDecoration.fit,
          placementMode: resolvedDecoration.placementMode,
          xMm: resolvedDecoration.xMm,
          yMm: resolvedDecoration.yMm,
          visible: true,
        });
      })
      .catch(() => {
        // Drawer upload keeps the user-facing error state; the on-page chip stays silent.
      });
  };

  const beginInteraction = (
    event: React.PointerEvent<HTMLElement>,
    kind: "move" | "resize",
  ) => {
    if (!isDesignMode) return;
    const page = event.currentTarget.closest(
      ".dasti-proposal-document__page",
    ) as HTMLElement | null;
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) return;
    const pointerPosition = getDecorationPointerClientPosition(event);
    if (!pointerPosition) return;
    const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    event.preventDefault();
    if (pointerId !== null) {
      event.currentTarget.setPointerCapture?.(pointerId);
    }
    interactionRef.current = {
      kind,
      pointerId,
      startClientX: pointerPosition.clientX,
      startClientY: pointerPosition.clientY,
      initialDecoration: resolvedDecoration,
      latestDecoration: resolvedDecoration,
      pageRect,
      pageWidthMm: pageSize.widthMm,
      pageHeightMm: pageSize.heightMm,
    };
  };

  const updateInteraction = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    if (!interaction || interaction.pointerId !== pointerId) return;
    const pointerPosition = getDecorationPointerClientPosition(event);
    if (!pointerPosition) return;
    const deltaXMm =
      (pointerPosition.clientX - interaction.startClientX) *
      (interaction.pageWidthMm / interaction.pageRect.width);
    const deltaYMm =
      (pointerPosition.clientY - interaction.startClientY) *
      (interaction.pageHeightMm / interaction.pageRect.height);
    const nextDecoration =
      interaction.kind === "resize"
        ? resizeDocumentDecorationByDeltaMm(interaction.initialDecoration, {
            deltaXMm,
            deltaYMm,
            pageWidthMm: interaction.pageWidthMm,
            pageHeightMm: interaction.pageHeightMm,
          })
        : moveDocumentDecorationByDeltaMm(interaction.initialDecoration, {
            deltaXMm,
            deltaYMm,
            pageWidthMm: interaction.pageWidthMm,
            pageHeightMm: interaction.pageHeightMm,
          });

    interaction.latestDecoration = nextDecoration;
    onChange?.(nextDecoration);
  };

  const endInteraction = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    if (!interaction || interaction.pointerId !== pointerId) return;
    interactionRef.current = null;
    if (pointerId !== null) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }
    onCommit?.(interaction.latestDecoration);
  };

  return (
    <div
      className="dasti-proposal-document-decoration"
      data-design-mode={isDesignMode ? "true" : "false"}
      data-decoration-size-mm={sizeMm}
      data-toolbar-placement={isDesignMode ? toolbarPlacement : undefined}
      data-toolbar-align={isDesignMode ? toolbarAlignment : undefined}
      style={
        {
          left: `calc(var(--proposal-inline-mm) * ${xMm})`,
          top: `calc(var(--proposal-block-mm) * ${yMm})`,
          width: `calc(var(--proposal-inline-mm) * ${sizeMm})`,
          height: `calc(var(--proposal-block-mm) * ${sizeMm})`,
          "--proposal-decoration-object-fit": resolvedDecoration.fit,
        } as React.CSSProperties
      }
      onPointerDown={(event) => beginInteraction(event, "move")}
      onPointerMove={updateInteraction}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      <img
        src={resolvedDecoration.dataUrl}
        alt={resolvedDecoration.alt ?? ""}
        draggable={false}
      />
      {isDesignMode ? (
        <>
          <div
            className="dasti-proposal-document-decoration__toolbar"
            aria-label="Decoration image controls"
            data-toolbar-placement={toolbarPlacement}
            data-toolbar-align={toolbarAlignment}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="dasti-icon-button dasti-icon-button--compact dasti-proposal-document-decoration__action"
              aria-label="Hide decoration image"
              title="Hide image"
              disabled={!onChange}
              onClick={() => {
                commitDecorationAction({
                  ...resolvedDecoration,
                  visible: false,
                });
              }}
            >
              <Eye size={12} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dasti-icon-button dasti-icon-button--compact dasti-proposal-document-decoration__action"
              aria-label="Upload decoration image"
              title="Upload image"
              disabled={!onChange}
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload size={12} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dasti-icon-button dasti-icon-button--compact dasti-proposal-document-decoration__action dasti-proposal-document-decoration__action--danger"
              aria-label="Remove decoration image"
              title="Remove image"
              disabled={!onChange}
              onClick={() => {
                commitDecorationAction(
                  removeDocumentDecorationAsset(resolvedDecoration),
                );
              }}
            >
              <TrashSimple size={12} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <input
              ref={uploadInputRef}
              id={uploadInputId}
              className="dasti-proposal-document-decoration__upload-input"
              type="file"
              aria-label="Upload decoration image from page"
              accept={DOCUMENT_DECORATION_UPLOAD_ACCEPT}
              disabled={!onChange}
              onChange={handleDecorationUpload}
            />
          </div>
          <span
            className="dasti-proposal-document-decoration__resize-handle"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.stopPropagation();
              beginInteraction(event, "resize");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function buildVolkFallbackParagraphs(args: {
  documentTitle: string | null;
  railTitle: string | null;
}) {
  const role = args.documentTitle?.trim() || "the role";
  const sender = args.railTitle?.trim() || "the applicant";

  return [
    `Dear Hiring Team,`,
    `I am writing to express my interest in ${role}. My background combines structured delivery, careful written communication, and the ability to turn complex briefs into clear, dependable execution.`,
    `${sender} brings a practical approach to stakeholder coordination, editorial clarity, and proposal work. I focus on keeping communication concise, maintaining high standards of detail, and producing documents that read with confidence from the first line to the closing sign-off.`,
    `I would welcome the opportunity to discuss how this experience can support your team and contribute to the quality of your work.`,
    `Kind regards,\n${sender}`,
  ];
}

export function ProposalDocumentRenderer({
  content,
  proposalDocument,
  proposalType,
  templateId,
  railTitle,
  railMeta,
  contactLine,
  letterDate,
  recipientDetails,
  documentTitle,
  documentMeta,
  applicantHeader,
  headerVisibility,
  documentTypography,
  pageWidth,
  pageSize = null,
  pageGapPx = 0,
  stylePreset = null,
  documentThemeVars = null,
  signatureSettings = null,
  closing = null,
  documentDecoration = null,
  documentIconSettings = null,
  documentDecorationMode = "readonly",
  onDocumentDecorationChange,
  onDocumentDecorationCommit,
  onProposalDocumentChange,
  onRailTitleChange,
  onRailMetaChange,
  onContactLineChange,
  onLetterDateChange,
  onRecipientDetailsChange,
  onDocumentTitleChange,
  emptyBodyPlaceholder = null,
  onPageCountChange,
}: ProposalDocumentRendererProps): JSX.Element {
  const resolvedTemplateId = resolveProposalTemplateId(templateId);
  const resolvedDocumentDecoration = React.useMemo(
    () => resolveTemplateDocumentDecoration(documentDecoration, resolvedTemplateId),
    [documentDecoration, resolvedTemplateId],
  );
  const resolvedDocumentIconSettings = React.useMemo(
    () => normalizeDocumentIconSettings(documentIconSettings),
    [documentIconSettings],
  );
  const resolvedPageSize = React.useMemo(
    () => resolveDocumentPageSize({ pageSize }),
    [pageSize],
  );
  const canonicalPreviewTokens = React.useMemo(
    () =>
      normalizeProposalPreviewTokens({
        templateId: resolvedTemplateId,
        documentTypography,
        stylePreset,
        pageGapPx,
        pageSize: resolvedPageSize,
      }),
    [
      documentTypography,
      pageGapPx,
      resolvedPageSize,
      resolvedTemplateId,
      stylePreset,
    ],
  );
  const resolvedRailTitle =
    typeof railTitle === "string"
      ? railTitle.trim() || null
      : applicantHeader?.name || documentTitle || null;
  const resolvedRailMeta =
    typeof railMeta === "string"
      ? railMeta.trim() || null
      : applicantHeader?.role || documentMeta || null;
  const resolvedSenderEmail = applicantHeader?.email ?? documentMeta ?? null;
  const resolvedSenderLine =
    typeof contactLine === "string"
      ? normalizeDocumentContactLine(contactLine)
      : buildVolkRegisterSenderLine(applicantHeader) || resolvedSenderEmail || null;
  const resolvedHeaderVisibility = React.useMemo(
    () => resolveProposalHeaderVisibility(headerVisibility),
    [headerVisibility],
  );
  const parsedDocument = React.useMemo(
    () => parseProposalDocumentContent(content, proposalType),
    [content, proposalType],
  );
  const effectiveClosing = React.useMemo(
    () =>
      resolveProposalClosingRef({
        closing,
        content,
        proposalType,
        applicantName: applicantHeader?.name ?? resolvedRailTitle,
        defaultEnabled: false,
      }),
    [
      applicantHeader?.name,
      closing,
      content,
      proposalType,
      resolvedRailTitle,
    ],
  );
  const structuredDocument = React.useMemo(
    () =>
      resolveProposalDocument({
        document: proposalDocument,
        content,
        proposalType,
        closing: effectiveClosing,
      }),
    [content, effectiveClosing, proposalDocument, proposalType],
  );
  const documentBlocks = React.useMemo(
    () =>
      buildProposalDocumentBlocksFromStructuredDocument(
        structuredDocument,
        effectiveClosing,
      ),
    [effectiveClosing, structuredDocument],
  );
  const signatureRender = React.useMemo(
    () =>
      resolveProposalSignatureRender({
        settings: signatureSettings,
        bodyFontFamily: documentTypography.fontFamily,
      }),
    [documentTypography.fontFamily, signatureSettings],
  );
  const renderSignature = React.useCallback(
    (
      signatureName: string | null | undefined,
      handwrittenSignatureEnabled = false,
    ) => {
      if (!signatureName) {
        return null;
      }

      const formattedName = formatProposalSignatureName(signatureName);
      const typedSignatureFontFamily =
        signatureRender.kind === "text"
          ? signatureRender.fontFamily
          : documentTypography.fontFamily;
      const typedSignature = (
        <p
          className="dasti-proposal-document__signature"
          style={
            {
              "--proposal-signature-font-family": typedSignatureFontFamily,
            } as React.CSSProperties
          }
        >
          {formattedName}
        </p>
      );
      const signatureImageDataUrl =
        signatureRender.kind === "image"
          ? signatureRender.imageDataUrl
          : signatureRender.imageDataUrl;

      if (handwrittenSignatureEnabled && signatureImageDataUrl) {
        const imageSignature = (
          <img
            className="dasti-proposal-document__signature-image"
            src={signatureImageDataUrl}
            alt={formattedName}
          />
        );

        return (
          <>
            {imageSignature}
            {typedSignature}
          </>
        );
      }

      return typedSignature;
    },
    [documentTypography.fontFamily, signatureRender],
  );
  const listMarkerIcon = React.useMemo(() => {
    const iconKey = resolveDefaultListMarkerIconKey(resolvedDocumentIconSettings);
    return (
      getDocumentIcon(iconKey) ??
      getDocumentIcon(DEFAULT_DOCUMENT_ICON_SETTINGS.defaultListMarkerKey)
    );
  }, [resolvedDocumentIconSettings]);
  const listMarkerType = resolvedDocumentIconSettings.listMarkerType ?? "dot";
  const listMarkerStyle = React.useMemo(
    () =>
      ({
        "--proposal-document-list-icon-color": getDocumentIconColorCss(
          resolvedDocumentIconSettings.color,
        ),
        "--proposal-document-list-icon-size": `${resolvedDocumentIconSettings.sizePt}pt`,
      }) as React.CSSProperties,
    [resolvedDocumentIconSettings.color, resolvedDocumentIconSettings.sizePt],
  );
  const [activeListItemIconPicker, setActiveListItemIconPicker] =
    React.useState<{ blockId: string; itemId: string } | null>(null);

  // Override proposal mm units with concrete px values so font-size, grid,
  // and padding use the resolved physical page size instead of global fallbacks.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const measurementPageRef = React.useRef<HTMLDivElement>(null);
  const measurementBodyRef = React.useRef<HTMLDivElement>(null);
  const [pageGroups, setPageGroups] = React.useState<number[][]>(() =>
    documentBlocks.length > 0
      ? [documentBlocks.map((_, index) => index)]
      : [[]],
  );
  const lastReportedPageCountRef = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.offsetWidth;
      if (w <= 0) return;
      const mmPx = w / resolvedPageSize.widthMm;
      const runtimeVars = serializeProposalMeasurementRuntimeVars({
        inlineMmPx: mmPx,
        blockMmPx: mmPx,
      });
      Object.entries(runtimeVars).forEach(([name, value]) => {
        el.style.setProperty(name, value);
      });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [resolvedPageSize.widthMm]);

  // When an explicit pageWidth is passed (e.g. from zoom controls), sync mm
  // vars immediately — before the ResizeObserver callback fires — so that
  // layout-dependent CSS (font-size, grid, padding) is always correct.
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !pageWidth || pageWidth <= 0) return;
    const mmPx = pageWidth / resolvedPageSize.widthMm;
    const runtimeVars = serializeProposalMeasurementRuntimeVars({
      inlineMmPx: mmPx,
      blockMmPx: mmPx,
    });
    Object.entries(runtimeVars).forEach(([name, value]) => {
      el.style.setProperty(name, value);
    });
  }, [pageWidth, resolvedPageSize.widthMm]);

  React.useLayoutEffect(() => {
    const measurementPage = measurementPageRef.current;
    const measurementBody = measurementBodyRef.current;

    if (!measurementPage || !measurementBody) {
      return undefined;
    }

    let frame: number | null = null;
    const reportPageCount = (count: number) => {
      if (lastReportedPageCountRef.current === count) {
        return;
      }
      lastReportedPageCountRef.current = count;
      onPageCountChange?.(count);
    };

    const measurePages = () => {
      if (documentBlocks.length === 0) {
        setPageGroups((current) =>
          arePageGroupsEqual(current, [[]]) ? current : [[]],
        );
        reportPageCount(1);
        return;
      }

      const { bottomBoundary } = getPageBottomBoundary(measurementPage);
      const bodyRect = measurementBody.getBoundingClientRect();
      const measurementBodyStyles = window.getComputedStyle(measurementBody);
      const headerStackHeight =
        measurementBody
          .querySelector<HTMLElement>(".dasti-proposal-document__header-stack")
          ?.getBoundingClientRect().height ?? 0;
      const firstPageLeadIn =
        Number.parseFloat(measurementBodyStyles.paddingTop || "0") +
        headerStackHeight;
      const pageBreakSafetyReserve = Math.max(
        4,
        Math.round(resolveLineHeightPx(measurementBodyStyles) * 0.7),
      );
      const blockNodes = Array.from(
        measurementBody.querySelectorAll<HTMLElement>("[data-proposal-block]"),
      );

      if (blockNodes.length === 0) {
        return;
      }

      const availableBodyHeight = bottomBoundary - bodyRect.top;
      if (availableBodyHeight <= 0) {
        return;
      }

      let previousBottom = bodyRect.top;
      const measuredBlocks = blockNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const gapBefore = Math.max(0, rect.top - previousBottom);
        previousBottom = rect.bottom;
        return {
          height: rect.height,
          gapBefore,
        };
      });

      const nextPageGroups = paginateMeasuredProposalBlocks({
        blocks: measuredBlocks,
        capacity: availableBodyHeight,
        firstPageLeadIn,
        continuationPageLeadIn: 0,
        pageBreakSafetyReserve,
      });

      setPageGroups((current) =>
        arePageGroupsEqual(current, nextPageGroups) ? current : nextPageGroups,
      );
      reportPageCount(Math.max(1, nextPageGroups.length));
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;
        measurePages();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(measurementPage);
    resizeObserver.observe(measurementBody);
    if (rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }

    void document.fonts?.ready.then(() => {
      scheduleMeasure();
    });
    document.fonts?.addEventListener?.("loadingdone", scheduleMeasure);

    scheduleMeasure();

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", scheduleMeasure);
    };
  }, [
    documentBlocks,
    onPageCountChange,
    pageWidth,
    resolvedTemplateId,
    signatureRender,
  ]);

  const commitEditableDocumentText = React.useCallback(
    (
      target:
        | { type: "text-block"; blockId: string }
        | { type: "list-item"; blockId: string; itemId: string },
      value: string,
    ) => {
      if (!onProposalDocumentChange) return;

      const nextText = normalizeEditableText(value);
      const nextBlocks = structuredDocument.blocks.map(
        (block): ProposalDocument["blocks"][number] => {
          if (
            target.type === "text-block" &&
            block.id === target.blockId &&
            (block.type === "salutation" || block.type === "paragraph")
          ) {
            return {
              ...block,
              text: nextText,
            };
          }

          if (
            target.type === "list-item" &&
            block.id === target.blockId &&
            block.type === "list"
          ) {
            return {
              ...block,
              items: block.items.map((item) =>
                item.id === target.itemId
                  ? {
                      ...item,
                      text: nextText,
                    }
                  : item,
              ),
            };
          }

          return block;
        },
      );

      onProposalDocumentChange({
        ...structuredDocument,
        source: "structured",
        blocks: nextBlocks,
      });
    },
    [onProposalDocumentChange, structuredDocument],
  );
  const commitListItemIcon = React.useCallback(
    (target: { blockId: string; itemId: string }, iconKey: DocumentIconKey | null) => {
      if (!onProposalDocumentChange) return;

      const nextBlocks = structuredDocument.blocks.map(
        (block): ProposalDocument["blocks"][number] => {
          if (block.id !== target.blockId || block.type !== "list") {
            return block;
          }

          return {
            ...block,
            items: block.items.map((item) => {
              if (item.id !== target.itemId) return item;
              const { iconKey: _iconKey, ...rest } = item;
              return iconKey
                ? {
                    ...rest,
                    iconKey,
                  }
                : rest;
            }),
          };
        },
      );

      onProposalDocumentChange({
        ...structuredDocument,
        source: "structured",
        blocks: nextBlocks,
      });
    },
    [onProposalDocumentChange, structuredDocument],
  );
  const getEditableTextProps = React.useCallback(
    (
      editable: boolean,
      label: string,
      onCommit: (value: string) => void,
      behavior: ProposalEditableTextBehavior = {},
    ) =>
      editable
        ? {
            contentEditable: "plaintext-only" as const,
            suppressContentEditableWarning: true,
            role: "textbox",
            tabIndex: 0,
            spellCheck: true,
            "aria-label": label,
            "data-proposal-editable-text": "true",
            onInput: (event: React.FormEvent<HTMLElement>) => {
              onCommit(
                normalizeEditableText(event.currentTarget.textContent ?? ""),
              );
            },
            onBlur: (event: React.FocusEvent<HTMLElement>) => {
              const normalized = normalizeEditableText(
                event.currentTarget.textContent ?? "",
              );
              if ((event.currentTarget.textContent ?? "") !== normalized) {
                event.currentTarget.textContent = normalized;
              }
              onCommit(normalized);
            },
            onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
              event.preventDefault();
              const pastedText = getClipboardPlainText(event);
              const normalized = insertPlainTextIntoEditableTarget(
                event.currentTarget,
                pastedText,
              );
              event.currentTarget.textContent = normalized;
              onCommit(normalized);
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.blur();
                return;
              }

              if (event.key === "Tab") {
                onCommit(
                  normalizeEditableText(event.currentTarget.textContent ?? ""),
                );
                return;
              }

              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              if (behavior.multiline && event.shiftKey) {
                const normalized = insertPlainTextIntoEditableTarget(
                  event.currentTarget,
                  "\n",
                );
                onCommit(normalized);
                return;
              }

              event.currentTarget.blur();
            },
          }
        : null,
    [],
  );

  const renderDocumentBlock = React.useCallback(
    (
      block: ProposalDocumentBlock,
      options: { editable?: boolean } = {},
    ) => {
      const isTextEditable = Boolean(
        options.editable && onProposalDocumentChange,
      );
      const getEditableBlockTextProps = (
        target:
          | { type: "text-block"; blockId: string }
          | { type: "list-item"; blockId: string; itemId: string },
        label: string,
        behavior: ProposalEditableTextBehavior = {},
      ) =>
        getEditableTextProps(isTextEditable, label, (value) => {
          commitEditableDocumentText(target, value);
        }, behavior);
      const renderInlineText = (text: string) =>
        parseDocumentIconTextSegments(text).map((segment, index) => {
          if (segment.type === "text") return segment.text;
          const icon = getDocumentIcon(segment.iconKey);
          if (!icon) return "";
          return (
            <span
              key={`${segment.iconKey}-${index}`}
              className="dasti-proposal-document__inline-icon"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
          );
        });

      switch (block.type) {
        case "salutation":
          return (
            <p
              key={block.id}
              className="dasti-proposal-document__salutation"
              data-proposal-block
              {...(getEditableBlockTextProps(
                { type: "text-block", blockId: block.id },
                "Edit salutation",
              ) ?? {})}
            >
              {isTextEditable ? block.text : renderInlineText(block.text)}
            </p>
          );
        case "paragraph":
          return (
            <p
              key={block.id}
              className={[
                "dasti-proposal-document__paragraph",
                block.continuation
                  ? "dasti-proposal-document__paragraph--continuation"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-proposal-block
              {...(getEditableBlockTextProps(
                { type: "text-block", blockId: block.paragraphId },
                "Edit paragraph",
                { multiline: true },
              ) ?? {})}
            >
              {isTextEditable ? block.text : renderInlineText(block.text)}
            </p>
          );
        case "list":
          const blockMarkerType =
            block.marker?.type === "icon" ? "icon" : listMarkerType;
          const blockMarkerIcon =
            block.marker?.type === "icon"
              ? getDocumentIcon(block.marker.iconKey) ?? listMarkerIcon
              : listMarkerIcon;
          const hasItemIconOverride = block.items.some((item) =>
            Boolean(getDocumentIcon(item.iconKey)),
          );
          return (
            <ul
              key={block.id}
              className={[
                "dasti-proposal-document__list",
                `dasti-proposal-document__list--${blockMarkerType}`,
                blockMarkerType === "icon" || hasItemIconOverride
                  ? "dasti-proposal-document__list--document-icons"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={listMarkerStyle}
              data-proposal-block
            >
              {block.items.map((item, itemIndex) => {
                const itemIcon = getDocumentIcon(item.iconKey);
                const itemMarker = item.marker ?? block.marker ?? null;
                const itemMarkerType =
                  itemMarker?.type === "icon" || blockMarkerType === "icon"
                    ? "icon"
                    : itemMarker?.type ?? blockMarkerType;
                const markerIcon =
                  itemIcon ??
                  (itemMarkerType === "icon"
                    ? itemMarker?.type === "icon"
                      ? getDocumentIcon(itemMarker.iconKey) ?? blockMarkerIcon
                      : blockMarkerIcon
                    : null);
                const target = { blockId: block.id, itemId: item.id };
                const isPickerOpen =
                  activeListItemIconPicker?.blockId === block.id &&
                  activeListItemIconPicker.itemId === item.id;

                return (
                  <li
                    key={`${block.id}-${item.id || itemIndex}`}
                    data-proposal-list-item
                    data-proposal-list-item-editable={
                      isTextEditable ? "true" : undefined
                    }
                    data-has-item-icon={itemIcon ? "true" : undefined}
                  >
                    {isTextEditable ? (
                      <span className="dasti-proposal-document__list-marker dasti-proposal-document__list-marker--editable">
                        <button
                          type="button"
                          className="dasti-proposal-document__list-icon-trigger"
                          aria-label={`Choose icon for list item ${itemIndex + 1}`}
                          title="Choose icon"
                          aria-expanded={isPickerOpen}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            setActiveListItemIconPicker((current) =>
                              current?.blockId === block.id &&
                              current.itemId === item.id
                                ? null
                                : target,
                            )
                          }
                        >
                          {markerIcon ? (
                            <span
                              aria-hidden="true"
                              dangerouslySetInnerHTML={{
                                __html: markerIcon.svg,
                              }}
                            />
                          ) : (
                            <span aria-hidden="true">
                              {itemMarkerType === "dash" ? "-" : "•"}
                            </span>
                          )}
                        </button>
                        {isPickerOpen ? (
                          <div
                            className="dasti-proposal-document__list-icon-picker"
                            role="dialog"
                            aria-label={`Icon picker for list item ${itemIndex + 1}`}
                          >
                            <DocumentIconPicker
                              label="List item icon"
                              selectedIconKey={item.iconKey ?? null}
                              onChange={(iconKey) => {
                                commitListItemIcon(target, iconKey);
                                setActiveListItemIconPicker(null);
                              }}
                            />
                            <div className="dasti-proposal-document__list-icon-picker-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  commitListItemIcon(target, null);
                                  setActiveListItemIconPicker(null);
                                }}
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveListItemIconPicker(null)}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </span>
                    ) : markerIcon ? (
                      <span
                        className="dasti-proposal-document__list-marker"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{
                          __html: markerIcon.svg,
                        }}
                      />
                    ) : (
                      <span
                        className="dasti-proposal-document__list-marker"
                        aria-hidden="true"
                      >
                        {itemMarkerType === "dash" ? "-" : "•"}
                      </span>
                    )}
                    <span
                      {...(getEditableBlockTextProps(
                        {
                          type: "list-item",
                          blockId: block.id,
                          itemId: item.id,
                        },
                        "Edit list item",
                      ) ?? {})}
                    >
                      {isTextEditable ? item.text : renderInlineText(item.text)}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        case "closing":
          return (
            <div
              key={block.id}
              className="dasti-proposal-document__closing"
              data-proposal-block
            >
              {block.signOff ? (
                <p className="dasti-proposal-document__signoff">
                  {block.signOff}
                </p>
              ) : null}
              {renderSignature(
                block.signatureName,
                block.handwrittenSignatureEnabled,
              )}
            </div>
          );
      }
    },
    [
      activeListItemIconPicker,
      commitEditableDocumentText,
      commitListItemIcon,
      getEditableTextProps,
      listMarkerIcon?.svg,
      listMarkerStyle,
      listMarkerType,
      onProposalDocumentChange,
      renderSignature,
    ],
  );

  const renderVisibleDocumentBlocks = React.useCallback(
    (blocks: ProposalDocumentBlock[]) => {
      const elements: React.ReactNode[] = [];
      const isTextEditable = Boolean(onProposalDocumentChange);

      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];

        if (block.type === "paragraph") {
          let text = block.text;
          let lastIndex = index;

          while (lastIndex + 1 < blocks.length) {
            const next = blocks[lastIndex + 1];
            if (
              next.type !== "paragraph" ||
              next.paragraphId !== block.paragraphId
            ) {
              break;
            }

            text = `${text} ${next.text}`;
            lastIndex += 1;
          }

          elements.push(
            <p
              key={`visible-${block.id}`}
              className={[
                "dasti-proposal-document__paragraph",
                block.continuation
                  ? "dasti-proposal-document__paragraph--continuation"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              {...(getEditableTextProps(
                isTextEditable,
                "Edit paragraph",
                (value) => {
                  commitEditableDocumentText(
                    { type: "text-block", blockId: block.paragraphId },
                    value,
                  );
                },
                { multiline: true },
              ) ?? {})}
            >
              {text}
            </p>,
          );
          index = lastIndex;
          continue;
        }

        elements.push(renderDocumentBlock(block, { editable: true }));
      }

      return elements;
    },
    [commitEditableDocumentText, onProposalDocumentChange, renderDocumentBlock],
  );

  const resolvedPageGroups =
    pageGroups.length > 0
      ? pageGroups
      : documentBlocks.length > 0
        ? [documentBlocks.map((_, index) => index)]
        : [[]];
  const volkMetaEntries = React.useMemo(
    () =>
      buildVolkRegisterMetaEntries({
        letterDate,
        recipientDetails,
        headerVisibility: resolvedHeaderVisibility,
      }),
    [resolvedHeaderVisibility, letterDate, recipientDetails],
  );
  const volkMetaLefts = React.useMemo(() => VOLK_REGISTER_GRID.metaLefts, []);
  const structuredHeaderValues = React.useMemo(
    () =>
      buildStructuredHeaderValues({
        letterDate,
        recipientDetails,
        documentTitle,
        headerVisibility: resolvedHeaderVisibility,
      }),
    [documentTitle, letterDate, recipientDetails, resolvedHeaderVisibility],
  );
  const letterheadViewModel = React.useMemo(
    () =>
      buildProposalLetterheadViewModel({
        applicantHeader,
        railTitle: resolvedRailTitle,
        railMeta: resolvedRailMeta,
        contactLine: resolvedSenderLine,
        letterDate,
        recipientDetails,
        documentTitle,
        documentMeta,
        headerVisibility: resolvedHeaderVisibility,
      }),
    [
      applicantHeader,
      documentMeta,
      documentTitle,
      letterDate,
      recipientDetails,
      resolvedHeaderVisibility,
      resolvedRailMeta,
      resolvedRailTitle,
      resolvedSenderLine,
    ],
  );
  const volkFallbackParagraphs = React.useMemo(
    () =>
      buildVolkFallbackParagraphs({
        documentTitle: documentTitle ?? null,
        railTitle: resolvedRailTitle,
      }),
    [documentTitle, resolvedRailTitle],
  );
  const renderVolkBodyContent = React.useCallback(
    (args: {
      pageBlocks: ProposalDocumentBlock[];
      showFallback: boolean;
      measurement: boolean;
    }) => {
      const { pageBlocks, showFallback, measurement } = args;

      if (pageBlocks.length > 0) {
        return measurement
          ? pageBlocks.map((block) => renderDocumentBlock(block))
          : renderVisibleDocumentBlocks(pageBlocks);
      }

      if (!showFallback) {
        return null;
      }

      return volkFallbackParagraphs.map((paragraph, index) => {
        if (index === 0) {
          return (
            <p
              key={`volk-fallback-${index}`}
              className="dasti-proposal-document__salutation"
              data-proposal-block={measurement ? true : undefined}
            >
              {paragraph}
            </p>
          );
        }

        if (index === volkFallbackParagraphs.length - 1) {
          const [signOff, signatureName] = paragraph
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          return (
            <div
              key={`volk-fallback-${index}`}
              className="dasti-proposal-document__closing"
              data-proposal-block={measurement ? true : undefined}
            >
              <p className="dasti-proposal-document__signoff">{signOff}</p>
              {renderSignature(signatureName)}
            </div>
          );
        }

        return (
          <p
            key={`volk-fallback-${index}`}
            className="dasti-proposal-document__paragraph"
            data-proposal-block={measurement ? true : undefined}
          >
            {paragraph}
          </p>
        );
      });
    },
    [renderSignature, renderVisibleDocumentBlocks, volkFallbackParagraphs],
  );
  const renderGenericRail = React.useCallback(
    (_isContinuationPage: boolean) => (
      <aside className="dasti-proposal-document__rail" aria-hidden="true" />
    ),
    [],
  );
  const renderSenderHeader = React.useCallback(
    (editable: boolean) => (
      <div className="dasti-proposal-document__sender-header">
        {resolvedRailTitle ? (
          <p className="dasti-proposal-document__sender-label">
            <span className="dasti-proposal-document__sender-label-key">
              From:
            </span>{" "}
            <span
              className="dasti-proposal-document__sender-label-value"
              {...(getEditableTextProps(
                Boolean(editable && onRailTitleChange),
                "Edit sender name",
                (value) => onRailTitleChange?.(value),
              ) ?? {})}
            >
              {resolvedRailTitle}
            </span>
          </p>
        ) : null}
        {resolvedRailMeta ? (
          <p
            className="dasti-proposal-document__sender-role"
            {...(getEditableTextProps(
              Boolean(editable && onRailMetaChange),
              "Edit sender role",
              (value) => onRailMetaChange?.(value),
            ) ?? {})}
          >
            {resolvedRailMeta}
          </p>
        ) : null}
        {resolvedSenderLine ? (
          <p
            className="dasti-proposal-document__sender-contact"
            {...(getEditableTextProps(
              Boolean(editable && onContactLineChange),
              "Edit sender contact details",
              (value) => onContactLineChange?.(value),
            ) ?? {})}
          >
            {resolvedSenderLine}
          </p>
        ) : null}
      </div>
    ),
    [
      getEditableTextProps,
      onContactLineChange,
      onRailMetaChange,
      onRailTitleChange,
      resolvedRailMeta,
      resolvedRailTitle,
      resolvedSenderLine,
    ],
  );
  const renderStructuredHeader = React.useCallback((editable: boolean) => {
    if (!structuredHeaderValues) {
      return null;
    }

    return (
      <div className="dasti-proposal-document__structured-header">
        {structuredHeaderValues.date ? (
          <div className="dasti-proposal-document__structured-header-item">
            <p className="dasti-proposal-document__structured-header-label">
              Date
            </p>
            <p
              className="dasti-proposal-document__structured-header-value"
              {...(getEditableTextProps(
                Boolean(editable && onLetterDateChange),
                "Edit date",
                (value) => onLetterDateChange?.(value),
              ) ?? {})}
            >
              {structuredHeaderValues.date}
            </p>
          </div>
        ) : null}
        {structuredHeaderValues.toLines.length > 0 ? (
          <div className="dasti-proposal-document__structured-header-item">
            <p className="dasti-proposal-document__structured-header-label">
              To
            </p>
            {editable && onRecipientDetailsChange ? (
              <div
                className="dasti-proposal-document__structured-header-value dasti-proposal-document__structured-header-value--multiline"
                {...(getEditableTextProps(
                  true,
                  "Edit recipient details",
                  (value) => onRecipientDetailsChange?.(value),
                ) ?? {})}
              >
                {[
                  ...structuredHeaderValues.toLines,
                  ...structuredHeaderValues.recipientDetailLines,
                ].join("\n")}
              </div>
            ) : (
              <>
                {structuredHeaderValues.toLines.map((line, index) => (
                  <p
                    key={`recipient-line-${index}`}
                    className="dasti-proposal-document__structured-header-value"
                  >
                    {line}
                  </p>
                ))}
                {structuredHeaderValues.recipientDetailLines.length > 0 ? (
                  <p className="dasti-proposal-document__structured-header-value dasti-proposal-document__structured-header-value--multiline dasti-proposal-document__structured-header-value--secondary">
                    {structuredHeaderValues.recipientDetailLines.join("\n")}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        {structuredHeaderValues.subject ? (
          <div className="dasti-proposal-document__structured-header-item dasti-proposal-document__structured-header-item--subject">
            <p className="dasti-proposal-document__structured-header-label">
              Subject
            </p>
            <p
              className="dasti-proposal-document__structured-header-value"
              {...(getEditableTextProps(
                Boolean(editable && onDocumentTitleChange),
                "Edit subject",
                (value) => onDocumentTitleChange?.(value),
              ) ?? {})}
            >
              {structuredHeaderValues.subject}
            </p>
          </div>
        ) : null}
      </div>
    );
  }, [
    getEditableTextProps,
    onDocumentTitleChange,
    onLetterDateChange,
    onRecipientDetailsChange,
    structuredHeaderValues,
  ]);
  const renderClassicHeaderStack = React.useCallback(
    (editable: boolean) => (
      <div className="dasti-proposal-document__header-stack">
        {resolvedHeaderVisibility.showSender
          ? renderSenderHeader(editable)
          : null}
        {renderStructuredHeader(editable)}
      </div>
    ),
    [
      renderSenderHeader,
      renderStructuredHeader,
      resolvedHeaderVisibility.showSender,
    ],
  );
  const renderGenericDocumentShell = React.useCallback(
    (args: {
      bodyRef?: React.Ref<HTMLDivElement> | null;
      pageBlocks: ProposalDocumentBlock[];
      isContinuationPage: boolean;
      measurement: boolean;
    }) => (
      <>
        {renderGenericRail(args.isContinuationPage)}
        <div
          ref={args.bodyRef ?? undefined}
          className="dasti-proposal-document__body dasti-proposal-document__body--classic-letter"
        >
          {!args.isContinuationPage
            ? renderClassicHeaderStack(!args.measurement)
            : null}
          {args.pageBlocks.length > 0 ? (
            args.measurement ? (
              args.pageBlocks.map((block) => renderDocumentBlock(block))
            ) : (
              renderVisibleDocumentBlocks(args.pageBlocks)
            )
          ) : !args.isContinuationPage ? (
            <div
              className="dasti-proposal-document__raw-body"
              data-proposal-block={args.measurement ? true : undefined}
            >
              {stripInlineProposalMarkdown(parsedDocument.rawBody || content) ||
                emptyBodyPlaceholder}
            </div>
          ) : null}
        </div>
      </>
    ),
    [
      content,
      emptyBodyPlaceholder,
      parsedDocument.rawBody,
      renderDocumentBlock,
      renderClassicHeaderStack,
      renderGenericRail,
      renderVisibleDocumentBlocks,
    ],
  );
  const renderVolkRegisterShell = React.useCallback(
    (args: {
      bodyRef?: React.Ref<HTMLDivElement> | null;
      pageBlocks: ProposalDocumentBlock[];
      isContinuationPage: boolean;
      showFallback: boolean;
      measurement: boolean;
    }) => (
      <>
        {!args.isContinuationPage ? (
          <div className="dasti-proposal-document__volk-header">
            <p className="dasti-proposal-document__volk-title">
              {resolvedRailTitle ?? "candidate name"}
            </p>
            <p className="dasti-proposal-document__volk-subtitle">
              {resolvedRailMeta ?? "job role"}
            </p>
            <p className="dasti-proposal-document__volk-sender">
              {resolvedSenderLine || "phone · email · website"}
            </p>
          </div>
        ) : null}

        {!args.isContinuationPage ? (
          <>
            {volkMetaEntries.map((entry, index) => (
              <div
                key={entry.key}
                className="dasti-proposal-document__volk-register-item"
                style={{ left: volkMetaLefts[index] }}
              >
                <p className="dasti-proposal-document__volk-register-label">
                  {entry.value}
                </p>
              </div>
            ))}
            <div
              className="dasti-proposal-document__volk-dot"
              aria-hidden="true"
            />
            <p
              className="dasti-proposal-document__volk-tier-marker dasti-proposal-document__volk-tier-marker--two"
              aria-hidden="true"
            >
              2
            </p>
            <p
              className="dasti-proposal-document__volk-tier-marker dasti-proposal-document__volk-tier-marker--three"
              aria-hidden="true"
            >
              3
            </p>
          </>
        ) : null}

        <div className="dasti-proposal-document__volk-content">
          {!args.isContinuationPage && structuredHeaderValues?.subject ? (
            <div className="dasti-proposal-document__volk-subject-row">
              <span className="dasti-proposal-document__volk-subject-label">
                subject:
              </span>
              <span className="dasti-proposal-document__volk-subject-value">
                {structuredHeaderValues.subject}
              </span>
            </div>
          ) : null}

          <div
            ref={args.bodyRef ?? undefined}
            className="dasti-proposal-document__body dasti-proposal-document__body--volk-register"
          >
            {renderVolkBodyContent({
              pageBlocks: args.pageBlocks,
              showFallback: args.showFallback,
              measurement: args.measurement,
            })}
          </div>
        </div>
      </>
    ),
    [
      documentMeta,
      renderVolkBodyContent,
      structuredHeaderValues,
      volkMetaLefts,
      resolvedRailMeta,
      resolvedRailTitle,
      resolvedSenderLine,
      volkMetaEntries,
    ],
  );
  const renderLetterheadBodyContent = React.useCallback(
    (args: {
      pageBlocks: ProposalDocumentBlock[];
      isContinuationPage: boolean;
      measurement: boolean;
    }) => {
      const { pageBlocks, isContinuationPage, measurement } = args;

      if (pageBlocks.length > 0) {
        return measurement
          ? pageBlocks.map((block) => renderDocumentBlock(block))
          : renderVisibleDocumentBlocks(pageBlocks);
      }

      if (isContinuationPage) {
        return null;
      }

      const fallbackText =
        stripInlineProposalMarkdown(parsedDocument.rawBody || content) ||
        emptyBodyPlaceholder;

      return fallbackText ? (
        <div
          className="dasti-proposal-document__raw-body"
          data-proposal-block={measurement ? true : undefined}
        >
          {fallbackText}
        </div>
      ) : null;
    },
    [
      content,
      emptyBodyPlaceholder,
      parsedDocument.rawBody,
      renderDocumentBlock,
      renderVisibleDocumentBlocks,
    ],
  );
  const renderLetterheadShell = React.useCallback(
    (args: {
      bodyRef?: React.Ref<HTMLDivElement> | null;
      pageBlocks: ProposalDocumentBlock[];
      isContinuationPage: boolean;
      measurement: boolean;
    }) => {
      const bodyContent = renderLetterheadBodyContent({
        pageBlocks: args.pageBlocks,
        isContinuationPage: args.isContinuationPage,
        measurement: args.measurement,
      });
      const editableFields: ProposalCoverLetterEditableFields | null =
        args.measurement
          ? null
          : {
              senderName: getEditableTextProps(
                Boolean(onRailTitleChange),
                "Edit sender name",
                (value) => onRailTitleChange?.(value),
              ),
              senderRole: getEditableTextProps(
                Boolean(onRailMetaChange),
                "Edit sender role",
                (value) => onRailMetaChange?.(value),
              ),
              senderContact: getEditableTextProps(
                Boolean(onContactLineChange),
                "Edit sender contact details",
                (value) => onContactLineChange?.(value),
              ),
              date: getEditableTextProps(
                Boolean(onLetterDateChange),
                "Edit date",
                (value) => onLetterDateChange?.(value),
              ),
              recipient: getEditableTextProps(
                Boolean(onRecipientDetailsChange),
                "Edit recipient details",
                (value) => onRecipientDetailsChange?.(value),
              ),
              subject: getEditableTextProps(
                Boolean(onDocumentTitleChange),
                "Edit subject",
                (value) => onDocumentTitleChange?.(value),
              ),
            };
      const templateProps: ProposalCoverLetterTemplateProps = {
        bodyRef: args.bodyRef,
        bodyContent,
        editableFields,
        isContinuationPage: args.isContinuationPage,
        viewModel: letterheadViewModel,
      };

      switch (resolvedTemplateId) {
        case "editorial_wide":
          return <ProposalCoverLetterEditorialTemplate {...templateProps} />;
        case "twoweeks-letterhead":
          return <ProposalCoverLetterTwoweeksTemplate {...templateProps} />;
        case "director-letterhead":
          return <ProposalCoverLetterDirectorTemplate {...templateProps} />;
        case "volk-letterhead":
          return <ProposalCoverLetterVolkTemplate {...templateProps} />;
        case "film-foto-letterhead":
          return <ProposalCoverLetterFilmFotoTemplate {...templateProps} />;
        case "moma-bauhaus-letterhead":
          return <ProposalCoverLetterMomaBauhausTemplate {...templateProps} />;
        case "joella-frame-letterhead":
          return <ProposalCoverLetterJoellaTemplate {...templateProps} />;
        case "bayer-letterhead":
          return <ProposalCoverLetterBayerTemplate {...templateProps} />;
        default:
          return null;
      }
    },
    [
      getEditableTextProps,
      letterheadViewModel,
      onContactLineChange,
      onDocumentTitleChange,
      onLetterDateChange,
      onRailMetaChange,
      onRailTitleChange,
      onRecipientDetailsChange,
      renderLetterheadBodyContent,
      resolvedTemplateId,
    ],
  );

  return (
    <div
      ref={rootRef}
      className={[
        "dasti-proposal-document",
        `dasti-proposal-document--${resolvedTemplateId.replace(/_/g, "-")}`,
        resolvedTemplateId === "editorial_wide"
          ? "proposal-cover-letter--editorial"
          : "",
        resolvedTemplateId === "twoweeks-letterhead"
          ? "proposal-cover-letter--twoweeks"
          : "",
        resolvedTemplateId === "director-letterhead"
          ? "proposal-cover-letter--director"
          : "",
        resolvedTemplateId === "volk-letterhead"
          ? "proposal-cover-letter--volk"
          : "",
        resolvedTemplateId === "film-foto-letterhead"
          ? "proposal-cover-letter--film-foto"
          : "",
        resolvedTemplateId === "moma-bauhaus-letterhead"
          ? "proposal-cover-letter--moma-bauhaus"
          : "",
        resolvedTemplateId === "joella-frame-letterhead"
          ? "proposal-cover-letter--joella"
          : "",
        resolvedTemplateId === "bayer-letterhead"
          ? "proposal-cover-letter--bayer"
          : "",
        letterheadViewModel.recipientContactLines.length > 0
          ? "proposal-cover-letter--has-recipient-block"
          : "",
        `dasti-proposal-document--${parsedDocument.kind}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-proposal-template={resolvedTemplateId}
      style={
        {
          ...(documentThemeVars ?? {}),
          ...serializeProposalPreviewVars(canonicalPreviewTokens),
          ...serializeProposalRuntimeVars(canonicalPreviewTokens),
        } as React.CSSProperties
      }
    >
      <div className="dasti-proposal-document__measurement" aria-hidden="true">
        <div
          ref={measurementPageRef}
          className="dasti-proposal-document__page"
          data-fit="0"
        >
          {isProposalLetterheadTemplateId(resolvedTemplateId)
            ? renderLetterheadShell({
                bodyRef: measurementBodyRef,
                pageBlocks: documentBlocks,
                isContinuationPage: false,
                measurement: true,
              })
            : resolvedTemplateId === "volk_register"
            ? renderVolkRegisterShell({
                bodyRef: measurementBodyRef,
                pageBlocks: documentBlocks,
                isContinuationPage: false,
                showFallback: !emptyBodyPlaceholder,
                measurement: true,
              })
            : renderGenericDocumentShell({
                bodyRef: measurementBodyRef,
                pageBlocks: documentBlocks,
                isContinuationPage: false,
                measurement: true,
              })}
        </div>
      </div>
      {resolvedPageGroups.map((pageGroup, pageIndex) => {
        const isContinuationPage = pageIndex > 0;
        const pageBlocks =
          pageGroup.length > 0
            ? pageGroup
                .map((blockIndex) => documentBlocks[blockIndex])
                .filter(Boolean)
            : [];

        return (
          <div
            key={`proposal-page-${pageIndex}`}
            ref={
              pageIndex === 0 && resolvedPageGroups.length === 1
                ? pageRef
                : null
            }
            className={[
              "dasti-proposal-document__page",
              isContinuationPage
                ? "dasti-proposal-document__page--continuation"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-fit="0"
          >
            {isProposalLetterheadTemplateId(resolvedTemplateId)
              ? renderLetterheadShell({
                  bodyRef:
                    pageIndex === 0 && resolvedPageGroups.length === 1
                      ? bodyRef
                      : null,
                  pageBlocks,
                  isContinuationPage,
                  measurement: false,
                })
              : resolvedTemplateId === "volk_register"
              ? renderVolkRegisterShell({
                  bodyRef:
                    pageIndex === 0 && resolvedPageGroups.length === 1
                      ? bodyRef
                      : null,
                  pageBlocks,
                  isContinuationPage,
                  showFallback: pageIndex === 0 && !emptyBodyPlaceholder,
                  measurement: false,
                })
              : renderGenericDocumentShell({
                  bodyRef:
                    pageIndex === 0 && resolvedPageGroups.length === 1
                      ? bodyRef
                      : null,
                  pageBlocks,
                  isContinuationPage,
                  measurement: false,
                })}
            {pageIndex === 0 ? (
              <ProposalDocumentDecorationLayer
                decoration={resolvedDocumentDecoration}
                mode={documentDecorationMode}
                pageSize={resolvedPageSize}
                onChange={onDocumentDecorationChange}
                onCommit={onDocumentDecorationCommit}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export {
  buildProposalDocumentBlocks,
  paginateMeasuredProposalBlocks,
  parseProposalDocumentContent,
  splitParagraphIntoPaginationFragments,
};
