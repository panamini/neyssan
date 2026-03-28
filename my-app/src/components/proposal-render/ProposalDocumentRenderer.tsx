import React from "react";
import type { FormValues } from "../ProposalInputForm.schemas";
import {
  getProposalTemplateDefinition,
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import type { ProposalDocumentTypography } from "../../lib/proposal-document-typography";

type ProposalDocumentRendererProps = {
  content: string;
  proposalType?: FormValues["proposalType"] | null;
  templateId?: ProposalTemplateId | null;
  railTitle?: string | null;
  railMeta?: string | null;
  documentTitle?: string | null;
  documentMeta?: string | null;
  documentTypography: ProposalDocumentTypography;
  /** Explicit page width in px. When provided, syncs mm vars immediately on change
   *  without waiting for the ResizeObserver callback. */
  pageWidth?: number;
};

type ParsedProposalDocument = {
  kind: "letter" | "message" | "proposal";
  salutation: string | null;
  paragraphs: string[];
  signOff: string | null;
  signatureName: string | null;
  rawBody: string;
};

type AutoFitLevel = "0" | "1" | "2" | "3" | "4" | "5" | "6";
const AUTO_FIT_LEVELS: AutoFitLevel[] = ["0", "1", "2", "3", "4", "5", "6"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const SALUTATION_PATTERN =
  /^(dear\b|hello\b|hi\b|greetings\b|madame\b|monsieur\b|madame,\s*monsieur\b|bonjour\b)/i;
const SIGNOFF_PATTERN =
  /^(sincerely|kind regards|best regards|warm regards|regards|cordialement|bien cordialement|avec mes salutations)[,!]?$/i;
const SIGNATURE_NAME_PATTERN = /^[\p{L}][\p{L}\s.'’\-]{1,56}$/u;

function stripInlineProposalMarkdown(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function compactProposalParagraph(value: string): string {
  return value
    .split("\n")
    .map((line) => stripInlineProposalMarkdown(line))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySignatureName(value: string): boolean {
  const normalized = stripInlineProposalMarkdown(value);
  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount < 1 || wordCount > 5) {
    return false;
  }

  return SIGNATURE_NAME_PATTERN.test(normalized);
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
  let signOff: string | null = null;
  let signatureName: string | null = null;

  const candidateSalutation = stripInlineProposalMarkdown(rawLines[start] ?? "");
  if (candidateSalutation && SALUTATION_PATTERN.test(candidateSalutation)) {
    salutation = candidateSalutation;
    start += 1;
  }

  while (start <= end && !stripInlineProposalMarkdown(rawLines[start])) {
    start += 1;
  }

  const trailingLine = stripInlineProposalMarkdown(rawLines[end] ?? "");
  if (trailingLine && isLikelySignatureName(trailingLine)) {
    signatureName = trailingLine;
    end -= 1;
  }

  while (end >= start && !stripInlineProposalMarkdown(rawLines[end])) {
    end -= 1;
  }

  const trailingSignOff = stripInlineProposalMarkdown(rawLines[end] ?? "");
  if (trailingSignOff && SIGNOFF_PATTERN.test(trailingSignOff)) {
    signOff = trailingSignOff;
    end -= 1;
  } else if (!signatureName && trailingSignOff && isLikelySignatureName(trailingSignOff)) {
    signatureName = trailingSignOff;
    end -= 1;
  }

  const body = rawLines.slice(start, end + 1).join("\n");
  const paragraphs = body
    .split(/\n\s*\n/)
    .map(compactProposalParagraph)
    .filter(Boolean);

  return {
    kind: inferredKind,
    salutation,
    paragraphs,
    signOff,
    signatureName,
    rawBody: body.trim(),
  };
}

export function ProposalDocumentRenderer({
  content,
  proposalType,
  templateId,
  railTitle,
  railMeta,
  documentTitle,
  documentMeta,
  documentTypography,
  pageWidth,
}: ProposalDocumentRendererProps): JSX.Element {
  const resolvedTemplateId = resolveProposalTemplateId(templateId);
  const templateDefinition = getProposalTemplateDefinition(resolvedTemplateId);
  const resolvedRailTitle = railTitle ?? documentTitle;
  const resolvedRailMeta = railMeta ?? documentMeta;
  const parsedDocument = React.useMemo(
    () => parseProposalDocumentContent(content, proposalType),
    [content, proposalType],
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
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.offsetWidth;
      if (w <= 0) return;
      const mmPx = w / 210;
      el.style.setProperty("--proposal-inline-mm", `${mmPx}px`);
      el.style.setProperty("--proposal-block-mm", `${mmPx}px`);
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
    el.style.setProperty("--proposal-inline-mm", `${mmPx}px`);
    el.style.setProperty("--proposal-block-mm", `${mmPx}px`);
  }, [pageWidth]);

  React.useLayoutEffect(() => {
    const page = pageRef.current;
    const body = bodyRef.current;
    if (!page || !body) {
      return undefined;
    }

    let frame: number | null = null;

    const applyFit = () => {
      for (const fit of AUTO_FIT_LEVELS) {
        page.dataset.fit = fit;

        const nextPageRect = page.getBoundingClientRect();
        const nextBodyRect = body.getBoundingClientRect();
        if (
          nextBodyRect.bottom <= nextPageRect.bottom + 1 ||
          fit === AUTO_FIT_LEVELS[AUTO_FIT_LEVELS.length - 1]
        ) {
          const overflow = nextBodyRect.bottom - nextPageRect.bottom;
          if (overflow > 1) {
            const mmPx = Math.max(1, nextPageRect.width / 210);
            const overflowMm = overflow / mmPx;
            const contentHeight = Math.max(1, nextBodyRect.height);
            const fineScale = clamp(
              (contentHeight - overflow - 2) / contentHeight,
              0.84,
              1,
            );
            page.style.setProperty(
              "--proposal-fit-fine-scale",
              String(fineScale),
            );
            page.style.setProperty(
              "--proposal-fit-fine-body-start-adjust-mm",
              String(clamp(overflowMm * 1.1, 0, 10)),
            );
            page.style.setProperty(
              "--proposal-fit-fine-bottom-margin-adjust-mm",
              String(clamp(overflowMm * 0.4, 0, 5)),
            );
          } else {
            page.style.setProperty("--proposal-fit-fine-scale", "1");
            page.style.setProperty(
              "--proposal-fit-fine-body-start-adjust-mm",
              "0",
            );
            page.style.setProperty(
              "--proposal-fit-fine-bottom-margin-adjust-mm",
              "0",
            );
          }
          break;
        }
      }
    };

    const scheduleFit = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyFit();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(page);
    resizeObserver.observe(body);
    if (rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }

    void document.fonts?.ready.then(() => {
      scheduleFit();
    });
    document.fonts?.addEventListener?.("loadingdone", scheduleFit);

    scheduleFit();

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", scheduleFit);
    };
  }, [content, pageWidth, parsedDocument.kind, resolvedTemplateId]);

  return (
    <div
      ref={rootRef}
      className={[
        "dasti-proposal-document",
        `dasti-proposal-document--${resolvedTemplateId.replace(/_/g, "-")}`,
        `dasti-proposal-document--${parsedDocument.kind}`,
      ].join(" ")}
      data-proposal-template={resolvedTemplateId}
      style={
        {
          "--proposal-template-left-zone-mm": String(
            templateDefinition.leftZoneMm,
          ),
          "--proposal-template-top-offset-mm": String(
            templateDefinition.topOffsetMm,
          ),
          "--proposal-template-body-start-mm": String(
            templateDefinition.bodyStartMm,
          ),
          "--proposal-template-bottom-margin-mm": String(
            templateDefinition.bottomMarginMm,
          ),
          "--proposal-template-right-margin-mm": String(
            templateDefinition.rightMarginMm,
          ),
          "--proposal-document-reading-measure-max": `${templateDefinition.readingMeasureCh}ch`,
          "--proposal-document-title-scale": String(
            templateDefinition.titleScaleMm,
          ),
          "--proposal-document-font-family": documentTypography.fontFamily,
          "--proposal-document-font-size": documentTypography.fontSize,
          "--proposal-document-font-weight": documentTypography.fontWeight,
          "--proposal-document-letter-spacing":
            documentTypography.letterSpacing ?? "0em",
          "--proposal-document-line-height": String(documentTypography.lineHeight),
        } as React.CSSProperties
      }
    >
      <div ref={pageRef} className="dasti-proposal-document__page" data-fit="0">
        <aside className="dasti-proposal-document__rail">
          <p className="dasti-proposal-document__eyebrow">
            {templateDefinition.shortLabel}
          </p>
          {resolvedRailTitle ? (
            <h4 className="dasti-proposal-document__title">{resolvedRailTitle}</h4>
          ) : null}
          {resolvedRailMeta ? (
            <p className="dasti-proposal-document__meta">{resolvedRailMeta}</p>
          ) : null}
        </aside>

        <div ref={bodyRef} className="dasti-proposal-document__body">
          {parsedDocument.salutation ? (
            <p className="dasti-proposal-document__salutation">
              {parsedDocument.salutation}
            </p>
          ) : null}

          {parsedDocument.paragraphs.length > 0 ? (
            parsedDocument.paragraphs.map((paragraph, index) => (
              <p
                key={`${index}-${paragraph.slice(0, 32)}`}
                className="dasti-proposal-document__paragraph"
              >
                {paragraph}
              </p>
            ))
          ) : (
            <div className="dasti-proposal-document__raw-body">
              {stripInlineProposalMarkdown(parsedDocument.rawBody || content)}
            </div>
          )}

          {parsedDocument.signOff || parsedDocument.signatureName ? (
            <div className="dasti-proposal-document__closing">
              {parsedDocument.signOff ? (
                <p className="dasti-proposal-document__signoff">
                  {parsedDocument.signOff}
                </p>
              ) : null}
              {parsedDocument.signatureName ? (
                <p className="dasti-proposal-document__signature">
                  {parsedDocument.signatureName}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { parseProposalDocumentContent };
