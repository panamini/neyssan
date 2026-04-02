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
  pageGapPx?: number;
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
    };

type AutoFitLevel = "0" | "1" | "2" | "3" | "4" | "5" | "6";
const AUTO_FIT_LEVELS: AutoFitLevel[] = ["0", "1", "2", "3", "4", "5", "6"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function buildProposalDocumentBlocks(
  parsedDocument: ParsedProposalDocument,
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

  if (parsedDocument.signOff || parsedDocument.signatureName) {
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
  pageGapPx = 0,
  onPageCountChange,
}: ProposalDocumentRendererProps): JSX.Element {
  const resolvedTemplateId = resolveProposalTemplateId(templateId);
  const templateDefinition = getProposalTemplateDefinition(resolvedTemplateId);
  const resolvedRailTitle = railTitle ?? documentTitle;
  const resolvedRailMeta = railMeta ?? documentMeta;
  const parsedDocument = React.useMemo(
    () => parseProposalDocumentContent(content, proposalType),
    [content, proposalType],
  );
  const documentBlocks = React.useMemo(
    () => buildProposalDocumentBlocks(parsedDocument),
    [parsedDocument],
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
      const firstPageLeadIn = Number.parseFloat(
        measurementBodyStyles.paddingTop || "0",
      );
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
  }, [documentBlocks, onPageCountChange, pageWidth, resolvedTemplateId]);

  React.useLayoutEffect(() => {
    const page = pageRef.current;
    const body = bodyRef.current;
    if (!page || !body || pageGroups.length > 1) {
      return undefined;
    }

    let frame: number | null = null;

    const applyFit = () => {
      for (const fit of AUTO_FIT_LEVELS) {
        page.dataset.fit = fit;

        const { pageRect: nextPageRect, bottomBoundary } =
          getPageBottomBoundary(page);
        const nextBodyRect = body.getBoundingClientRect();
        if (
          nextBodyRect.bottom <= bottomBoundary + 1 ||
          fit === AUTO_FIT_LEVELS[AUTO_FIT_LEVELS.length - 1]
        ) {
          const overflow = nextBodyRect.bottom - bottomBoundary;
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
  }, [content, pageGroups.length, pageWidth, parsedDocument.kind, resolvedTemplateId]);

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
              {block.signatureName ? (
                <p className="dasti-proposal-document__signature">
                  {block.signatureName}
                </p>
              ) : null}
            </div>
          );
      }
    },
    [],
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
          "--proposal-document-page-gap": `${pageGapPx}px`,
        } as React.CSSProperties
      }
    >
      <div className="dasti-proposal-document__measurement" aria-hidden="true">
        <div
          ref={measurementPageRef}
          className="dasti-proposal-document__page"
          data-fit="0"
        >
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

          <div ref={measurementBodyRef} className="dasti-proposal-document__body">
            {documentBlocks.length > 0 ? (
              documentBlocks.map((block) => renderDocumentBlock(block))
            ) : (
              <div
                className="dasti-proposal-document__raw-body"
                data-proposal-block
              >
                {stripInlineProposalMarkdown(parsedDocument.rawBody || content)}
              </div>
            )}
          </div>
        </div>
      </div>
      {resolvedPageGroups.map((pageGroup, pageIndex) => {
        const isContinuationPage = pageIndex > 0;
        const pageBlocks =
          pageGroup.length > 0
            ? pageGroup.map((blockIndex) => documentBlocks[blockIndex]).filter(Boolean)
            : [];

        return (
          <div
            key={`proposal-page-${pageIndex}`}
            ref={pageIndex === 0 && resolvedPageGroups.length === 1 ? pageRef : null}
            className={[
              "dasti-proposal-document__page",
              isContinuationPage ? "dasti-proposal-document__page--continuation" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-fit="0"
          >
        <aside className="dasti-proposal-document__rail">
          <p className="dasti-proposal-document__eyebrow">
            {templateDefinition.shortLabel}
          </p>
          {!isContinuationPage && resolvedRailTitle ? (
            <h4 className="dasti-proposal-document__title">{resolvedRailTitle}</h4>
          ) : null}
          {!isContinuationPage && resolvedRailMeta ? (
            <p className="dasti-proposal-document__meta">{resolvedRailMeta}</p>
          ) : null}
        </aside>

        <div
          ref={pageIndex === 0 && resolvedPageGroups.length === 1 ? bodyRef : null}
          className="dasti-proposal-document__body"
        >
          {pageBlocks.length > 0 ? (
            renderVisibleDocumentBlocks(pageBlocks)
          ) : pageIndex === 0 ? (
            <div className="dasti-proposal-document__raw-body">
              {stripInlineProposalMarkdown(parsedDocument.rawBody || content)}
            </div>
          ) : null}
        </div>
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
