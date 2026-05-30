import React from "react";
import type { FormValues } from "../ProposalInputForm.schemas";
import {
  getProposalTemplateDefinition,
  isProposalLetterheadTemplateId,
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import type { ProposalDocumentTypography } from "../../lib/proposal-document-typography";
import { VOLK_REGISTER_GRID } from "../../features/verbati/volkGrid";
import type { ProposalApplicantHeaderData } from "../../lib/proposal-personalization";
import {
  parseProposalRecipientDetails,
  resolveProposalLetterheadShortTitle,
  resolveProposalHeaderVisibility,
  resolveProposalRecipientLines,
  type ProposalHeaderVisibility,
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

type ProposalDocumentRendererProps = {
  content: string;
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
  pageGapPx?: number;
  stylePreset?: VerbatiStylePreset | null;
  documentThemeVars?: React.CSSProperties | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  emptyBodyPlaceholder?: string | null;
  onPageCountChange?: (count: number) => void;
};

type ParsedProposalDocument = {
  kind: "letter" | "message" | "proposal";
  salutation: string | null;
  paragraphs: string[];
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
      type: "closing";
      signOff: string | null;
      signatureName: string | null;
      handwrittenSignatureEnabled?: boolean;
    };

type VolkRegisterMetaEntry = {
  value: string;
  key: string;
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
  candidateLocationLine: string;
  candidatePhone: string;
  candidateEmail: string;
  candidateWebsite: string;
  recipientName: string;
  recipientCompany: string;
  recipientRole: string;
  recipientAddress: string;
  recipientEmail: string;
  recipientCity: string;
  recipientContactLines: string[];
  recipientHeadingLines: string[];
  date: string;
  subject: string;
  secondaryTitle: string;
  metaRole: string;
  shortRoleTitle: string;
};

type ProposalCoverLetterTemplateProps = {
  bodyRef?: React.Ref<HTMLDivElement> | null;
  bodyContent: React.ReactNode;
  isContinuationPage: boolean;
  viewModel: ProposalLetterheadViewModel;
};

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
    location: candidateShortLocationLine,
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
  const recipientContactLines = uniqueNonEmptyLines(
    [recipientAddress, recipientCity, recipientEmail],
    [recipientName, recipientCompany, recipientRole],
  );
  const recipientHeadingLines = visibility.showRecipient
    ? uniqueNonEmptyLines([
        recipientFields.name,
        recipientFields.company,
        recipientFields.city,
        recipientFields.role,
        recipientFields.address,
        recipientFields.email,
      ])
    : [];
  const subject = visibility.showSubject ? args.documentTitle?.trim() ?? "" : "";
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
    candidateLocationLine: resolvedContactParts.location,
    candidatePhone: resolvedContactParts.phone,
    candidateEmail: resolvedContactParts.email,
    candidateWebsite: joinNonEmpty([
      resolvedContactParts.linkedin,
      resolvedContactParts.website,
    ]),
    recipientName,
    recipientCompany,
    recipientRole,
    recipientAddress,
    recipientEmail,
    recipientCity,
    recipientContactLines,
    recipientHeadingLines,
    date: visibility.showDate ? args.letterDate?.trim() ?? "" : "",
    subject,
    secondaryTitle,
    metaRole,
    shortRoleTitle,
  };
}

function ProposalCoverLetterMetaRow({
  viewModel,
}: {
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element {
  const values = [
    viewModel.recipientName,
    viewModel.recipientCompany,
    viewModel.metaRole,
    viewModel.date,
  ];

  return (
    <div className="proposal-cover-letter__meta-row" aria-label="Letter metadata">
      {values.map((value, index) => (
        <p key={`meta-${index}`} className="proposal-cover-letter__meta-item">
          {value}
        </p>
      ))}
    </div>
  );
}

function ProposalCoverLetterSubjectRow({
  viewModel,
  prefix = "Re:",
}: {
  viewModel: ProposalLetterheadViewModel;
  prefix?: string;
}): JSX.Element | null {
  if (!viewModel.subject) {
    return null;
  }

  return (
    <div className="proposal-cover-letter__subject-row">
      <span className="proposal-cover-letter__subject-label">{prefix}</span>
      <span className="proposal-cover-letter__subject-value">
        {viewModel.subject}
      </span>
    </div>
  );
}

function ProposalCoverLetterRecipientBlock({
  viewModel,
}: {
  viewModel: ProposalLetterheadViewModel;
}): JSX.Element | null {
  if (viewModel.recipientContactLines.length === 0) {
    return null;
  }

  return (
    <section
      className="proposal-cover-letter__recipient-block"
      aria-label="Recipient contact details"
    >
      {viewModel.recipientContactLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
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

export function ProposalCoverLetterDirectorTemplate({
  bodyRef,
  bodyContent,
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
              <p className="proposal-cover-letter__masthead-primary">
                {viewModel.candidateName}
              </p>
            ) : null}
            {viewModel.secondaryTitle ? (
              <p className="proposal-cover-letter__masthead-secondary">
                {viewModel.secondaryTitle}
              </p>
            ) : null}
            {viewModel.candidateRole ? (
              <p className="proposal-cover-letter__masthead-role">
                {viewModel.candidateRole}
              </p>
            ) : null}
          </header>
          <section className="proposal-cover-letter__sender-block">
            <p className="proposal-cover-letter__sender-label">Sender</p>
            <div className="proposal-cover-letter__sender-lines">
              {viewModel.candidateName ? <p>{viewModel.candidateName}</p> : null}
              {viewModel.candidateLocationLine ? (
                <p>{viewModel.candidateLocationLine}</p>
              ) : null}
            </div>
          </section>
          <ProposalCoverLetterDirectorContactGrid viewModel={viewModel} />
          <ProposalCoverLetterMetaRow viewModel={viewModel} />
          <ProposalCoverLetterRecipientBlock viewModel={viewModel} />
          <ProposalCoverLetterSubjectRow viewModel={viewModel} />
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
  isContinuationPage,
  viewModel,
}: ProposalCoverLetterTemplateProps): JSX.Element {
  return (
    <>
      {!isContinuationPage ? (
        <>
          <header className="proposal-cover-letter__volk-header">
            {viewModel.candidateName ? (
              <p className="proposal-cover-letter__volk-title">
                {viewModel.candidateName}
              </p>
            ) : null}
            {viewModel.secondaryTitle ? (
              <p className="proposal-cover-letter__volk-title proposal-cover-letter__volk-title--right">
                {viewModel.secondaryTitle}
              </p>
            ) : null}
            {viewModel.candidateRole ? (
              <p className="proposal-cover-letter__volk-subtitle">
                {viewModel.candidateRole}
              </p>
            ) : null}
            {viewModel.candidateVolkSenderLine ? (
              <p className="proposal-cover-letter__volk-sender">
                sender: {viewModel.candidateVolkSenderLine}
              </p>
            ) : null}
          </header>
          <ProposalCoverLetterMetaRow viewModel={viewModel} />
          <ProposalCoverLetterRecipientBlock viewModel={viewModel} />
          <ProposalCoverLetterSubjectRow viewModel={viewModel} prefix="re:" />
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
              <p className="proposal-cover-letter__film-heading">
                {filmKicker}
              </p>
            ) : null}
            {filmTitle ? (
              <p className="proposal-cover-letter__film-title">{filmTitle}</p>
            ) : null}
            <span className="proposal-cover-letter__film-rule" />
          </header>
          <section className="proposal-cover-letter__info-blocks">
            {viewModel.candidateFilmSenderLine ? (
              <div>
                <p className="proposal-cover-letter__info-label">sender</p>
                <p>{viewModel.candidateFilmSenderLine}</p>
              </div>
            ) : null}
            {viewModel.candidatePhone ? (
              <div className="proposal-cover-letter__info-block proposal-cover-letter__info-block--phone">
                <p className="proposal-cover-letter__info-label">phone</p>
                <p>{viewModel.candidatePhone}</p>
              </div>
            ) : null}
            {viewModel.candidateWebsite ? (
              <div>
                <p className="proposal-cover-letter__info-label">portfolio</p>
                <p>{viewModel.candidateWebsite}</p>
              </div>
            ) : null}
            {viewModel.recipientCompany ? (
              <div>
                <p className="proposal-cover-letter__info-label">company</p>
                <p>{viewModel.recipientCompany}</p>
              </div>
            ) : null}
          </section>
          <ProposalCoverLetterMetaRow viewModel={viewModel} />
          <ProposalCoverLetterRecipientBlock viewModel={viewModel} />
          <ProposalCoverLetterSubjectRow viewModel={viewModel} />
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
  const displayTitle =
    viewModel.candidateCompany ||
    viewModel.candidateName ||
    viewModel.recipientCompany;
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
              {senderLines.map((line) => (
                <p key={`sender-${line}`}>{line}</p>
              ))}
            </section>
          ) : null}
          {recipientLines.length > 0 ? (
            <section
              className="proposal-cover-letter__bauhaus-recipient"
              aria-label="Recipient details"
            >
              {recipientLines.map((line) => (
                <p key={`recipient-${line}`}>{line}</p>
              ))}
            </section>
          ) : null}
          {displayTitle || subtitle ? (
            <header className="proposal-cover-letter__bauhaus-header">
              {displayTitle ? (
                <p className="proposal-cover-letter__bauhaus-logo">
                  {displayTitle}
                </p>
              ) : null}
              {subtitle ? (
                <p className="proposal-cover-letter__bauhaus-subtitle">
                  {subtitle}
                </p>
              ) : null}
            </header>
          ) : null}
          {(viewModel.date || viewModel.subject) ? (
            <div className="proposal-cover-letter__bauhaus-meta">
              {viewModel.date ? (
                <p className="proposal-cover-letter__bauhaus-meta-item">
                  date: {viewModel.date}
                </p>
              ) : null}
              {viewModel.subject ? (
                <p className="proposal-cover-letter__bauhaus-meta-item">
                  RE: {viewModel.subject}
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
          recipientFields.address,
          recipientFields.email,
          recipientFields.city,
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

    return {
      kind: "proposal",
      salutation: null,
      paragraphs,
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

  parsedDocument.paragraphs.forEach((paragraph, index) => {
    splitParagraphIntoPaginationFragments(paragraph).forEach(
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
  pageGapPx = 0,
  stylePreset = null,
  documentThemeVars = null,
  signatureSettings = null,
  closing = null,
  emptyBodyPlaceholder = null,
  onPageCountChange,
}: ProposalDocumentRendererProps): JSX.Element {
  const resolvedTemplateId = resolveProposalTemplateId(templateId);
  const templateDefinition = getProposalTemplateDefinition(resolvedTemplateId);
  const canonicalPreviewTokens = React.useMemo(
    () =>
      normalizeProposalPreviewTokens({
        templateId: resolvedTemplateId,
        documentTypography,
        stylePreset,
        pageGapPx,
      }),
    [documentTypography, pageGapPx, resolvedTemplateId, stylePreset],
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
  const documentBlocks = React.useMemo(
    () => buildProposalDocumentBlocks(parsedDocument, effectiveClosing),
    [effectiveClosing, parsedDocument],
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

  // --proposal-inline-mm / --proposal-block-mm are defined on :root as
  // calc(100% / 210) / calc(100% / 297). When substituted into font-size,
  // `100%` resolves to the inherited font-size (~17px), not the container
  // width, producing a ~0.3px font-size. Override them here as concrete px
  // values so every CSS property (font-size, grid, padding) gets the right
  // scale regardless of context.
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
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.offsetWidth;
      if (w <= 0) return;
      const mmPx = w / 210;
      const runtimeVars = serializeProposalMeasurementRuntimeVars(mmPx);
      Object.entries(runtimeVars).forEach(([name, value]) => {
        el.style.setProperty(name, value);
      });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When an explicit pageWidth is passed (e.g. from zoom controls), sync mm
  // vars immediately — before the ResizeObserver callback fires — so that
  // layout-dependent CSS (font-size, grid, padding) is always correct.
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !pageWidth || pageWidth <= 0) return;
    const mmPx = pageWidth / 210;
    const runtimeVars = serializeProposalMeasurementRuntimeVars(mmPx);
    Object.entries(runtimeVars).forEach(([name, value]) => {
      el.style.setProperty(name, value);
    });
  }, [pageWidth]);

  React.useLayoutEffect(() => {
    const measurementPage = measurementPageRef.current;
    const measurementBody = measurementBodyRef.current;

    if (!measurementPage || !measurementBody) {
      return undefined;
    }

    let frame: number | null = null;

    const measurePages = () => {
      if (documentBlocks.length === 0) {
        setPageGroups((current) =>
          arePageGroupsEqual(current, [[]]) ? current : [[]],
        );
        onPageCountChange?.(1);
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
      onPageCountChange?.(Math.max(1, nextPageGroups.length));
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

  const renderDocumentBlock = React.useCallback(
    (block: ProposalDocumentBlock) => {
      switch (block.type) {
        case "salutation":
          return (
            <p
              key={block.id}
              className="dasti-proposal-document__salutation"
              data-proposal-block
            >
              {block.text}
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
            >
              {block.text}
            </p>
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
    [renderSignature],
  );

  const renderVisibleDocumentBlocks = React.useCallback(
    (blocks: ProposalDocumentBlock[]) => {
      const elements: React.ReactNode[] = [];

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
            >
              {text}
            </p>,
          );
          index = lastIndex;
          continue;
        }

        elements.push(renderDocumentBlock(block));
      }

      return elements;
    },
    [renderDocumentBlock],
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
    () => (
      <div className="dasti-proposal-document__sender-header">
        {resolvedRailTitle ? (
          <p className="dasti-proposal-document__sender-label">
            <span className="dasti-proposal-document__sender-label-key">
              From:
            </span>{" "}
            <span className="dasti-proposal-document__sender-label-value">
              {resolvedRailTitle}
            </span>
          </p>
        ) : null}
        {resolvedRailMeta ? (
          <p className="dasti-proposal-document__sender-role">
            {resolvedRailMeta}
          </p>
        ) : null}
        {resolvedSenderLine ? (
          <p className="dasti-proposal-document__sender-contact">
            {resolvedSenderLine}
          </p>
        ) : null}
      </div>
    ),
    [resolvedRailMeta, resolvedRailTitle, resolvedSenderLine],
  );
  const renderStructuredHeader = React.useCallback(() => {
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
            <p className="dasti-proposal-document__structured-header-value">
              {structuredHeaderValues.date}
            </p>
          </div>
        ) : null}
        {structuredHeaderValues.toLines.length > 0 ? (
          <div className="dasti-proposal-document__structured-header-item">
            <p className="dasti-proposal-document__structured-header-label">
              To
            </p>
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
          </div>
        ) : null}
        {structuredHeaderValues.subject ? (
          <div className="dasti-proposal-document__structured-header-item dasti-proposal-document__structured-header-item--subject">
            <p className="dasti-proposal-document__structured-header-label">
              Subject
            </p>
            <p className="dasti-proposal-document__structured-header-value">
              {structuredHeaderValues.subject}
            </p>
          </div>
        ) : null}
      </div>
    );
  }, [structuredHeaderValues]);
  const renderClassicHeaderStack = React.useCallback(
    () => (
      <div className="dasti-proposal-document__header-stack">
        {resolvedHeaderVisibility.showSender ? renderSenderHeader() : null}
        {renderStructuredHeader()}
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
          {!args.isContinuationPage ? renderClassicHeaderStack() : null}
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
      const templateProps: ProposalCoverLetterTemplateProps = {
        bodyRef: args.bodyRef,
        bodyContent,
        isContinuationPage: args.isContinuationPage,
        viewModel: letterheadViewModel,
      };

      switch (resolvedTemplateId) {
        case "director-letterhead":
          return <ProposalCoverLetterDirectorTemplate {...templateProps} />;
        case "volk-letterhead":
          return <ProposalCoverLetterVolkTemplate {...templateProps} />;
        case "film-foto-letterhead":
          return <ProposalCoverLetterFilmFotoTemplate {...templateProps} />;
        case "moma-bauhaus-letterhead":
          return <ProposalCoverLetterMomaBauhausTemplate {...templateProps} />;
        default:
          return null;
      }
    },
    [letterheadViewModel, renderLetterheadBodyContent, resolvedTemplateId],
  );

  return (
    <div
      ref={rootRef}
      className={[
        "dasti-proposal-document",
        `dasti-proposal-document--${resolvedTemplateId.replace(/_/g, "-")}`,
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
