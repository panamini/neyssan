import {
  extractProposalClosingBlockFromParagraphs,
  sanitizeProposalClosingRef,
  stripInlineProposalMarkdown,
  type ProposalClosingRef,
} from "./proposal-closing";
import type { DocumentIconKey } from "./document-icons";

export const PROPOSAL_DOCUMENT_SCHEMA_VERSION = 1;

export type ProposalDocumentListMarker =
  | {
      type: "dot" | "dash";
    }
  | {
      type: "icon";
      iconKey: DocumentIconKey;
    };

export type ProposalInlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type ProposalRichText = {
  runs: ProposalInlineRun[];
};

export type ProposalDocumentListItem = {
  id: string;
  text: string;
  richText?: ProposalRichText;
  iconKey?: DocumentIconKey;
  marker?: ProposalDocumentListMarker | null;
};

export type ProposalDocumentBlock =
  | {
      id: string;
      type: "salutation";
      text: string;
      richText?: ProposalRichText;
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
      richText?: ProposalRichText;
    }
  | {
      id: string;
      type: "list";
      items: ProposalDocumentListItem[];
      marker?: ProposalDocumentListMarker | null;
    }
  | {
      id: string;
      type: "closing";
      signOff: string;
      signatureName: string;
      handwrittenSignatureEnabled?: boolean;
    };

export type ProposalDocumentKind = "letter" | "message" | "proposal";

export type ProposalDocument = {
  schemaVersion: typeof PROPOSAL_DOCUMENT_SCHEMA_VERSION;
  kind: ProposalDocumentKind;
  source: "legacy-string" | "structured";
  blocks: ProposalDocumentBlock[];
};

export type ProposalDocumentInput = ProposalDocument | null | undefined;

export type ProposalDocumentTextTarget =
  | { type: "text-block"; blockId: string }
  | { type: "list-item"; blockId: string; itemId: string };

export type ProposalInlineMark = "bold" | "italic" | "underline";

type ProposalTypeLike = "cover_letter" | "application_message" | "freelance_proposal" | string | null | undefined;

const SALUTATION_PATTERN =
  /^(dear\b|hello\b|hi\b|greetings\b|madame\b|monsieur\b|madame,\s*monsieur\b|bonjour\b)/i;
const PROPOSAL_BULLET_LINE_PATTERN = /^(\s{0,3})([-*•])\s+(.+?)\s*$/u;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripZeroWidthPlaceholders(value: string): string {
  return value.replace(/[\u200b\u200c\u200d\ufeff]/g, "");
}

export function normalizeEditableText(input: string): string {
  const withoutDangerousBlocks = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const withLineBreaks = withoutDangerousBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded =
    typeof document !== "undefined"
      ? (() => {
          const textarea = document.createElement("textarea");
          textarea.innerHTML = withLineBreaks;
          return textarea.value;
        })()
      : withLineBreaks
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, "\"")
          .replace(/&#39;/g, "'");

  return stripZeroWidthPlaceholders(decoded)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getProposalRichTextPlainText(
  richText: ProposalRichText | null | undefined,
): string {
  if (!richText?.runs) return "";
  return normalizeProposalDocumentEditText(
    richText.runs.map((run) => stripZeroWidthPlaceholders(run.text)).join(""),
  );
}

function normalizeProposalInlineRun(value: unknown): ProposalInlineRun | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ProposalInlineRun>;
  if (typeof candidate.text !== "string") return null;
  const text = stripZeroWidthPlaceholders(candidate.text);
  if (!text) return null;
  return {
    text,
    ...(candidate.bold ? { bold: true } : null),
    ...(candidate.italic ? { italic: true } : null),
    ...(candidate.underline ? { underline: true } : null),
  };
}

export function normalizeProposalRichText(
  value: unknown,
): ProposalRichText | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ProposalRichText>;
  if (!Array.isArray(candidate.runs)) return undefined;
  const runs = candidate.runs
    .map(normalizeProposalInlineRun)
    .filter((run): run is ProposalInlineRun => Boolean(run));
  return runs.length > 0 ? { runs } : undefined;
}

export function createProposalRichTextFromPlainText(
  text: string,
): ProposalRichText | undefined {
  const normalized = normalizeProposalDocumentEditText(text);
  return normalized ? { runs: [{ text: normalized }] } : undefined;
}

export function normalizeProposalDocumentEditText(input: string): string {
  const withoutDangerousBlocks = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const withLineBreaks = withoutDangerousBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded =
    typeof document !== "undefined"
      ? (() => {
          const textarea = document.createElement("textarea");
          textarea.innerHTML = withLineBreaks;
          return textarea.value;
        })()
      : withLineBreaks
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, "\"")
          .replace(/&#39;/g, "'");
  const normalized = stripZeroWidthPlaceholders(decoded)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized && /\n[ \t\f\v]*$/u.test(input.replace(/\r\n?/g, "\n"))) {
    return `${normalized}\n`;
  }
  return normalized;
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

function resolveProposalDocumentKind(proposalType?: ProposalTypeLike): ProposalDocumentKind {
  if (proposalType === "freelance_proposal") return "proposal";
  if (proposalType === "application_message") return "message";
  return "letter";
}

function createBlockId(type: ProposalDocumentBlock["type"], index: number): string {
  return `${type}-${index + 1}`;
}

function createListItemId(listIndex: number, itemIndex: number): string {
  return `list-${listIndex + 1}-item-${itemIndex + 1}`;
}

function createSiblingId(
  existingIds: Set<string>,
  baseId: string,
  suffix: string,
): string {
  const cleanBase = cleanString(baseId) || "proposal-block";
  let candidate = `${cleanBase}-${suffix}`;
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${cleanBase}-${suffix}-${index}`;
    index += 1;
  }
  existingIds.add(candidate);
  return candidate;
}

function collectProposalDocumentIds(document: ProposalDocument): Set<string> {
  const ids = new Set<string>();
  document.blocks.forEach((block) => {
    ids.add(block.id);
    if (block.type === "list") {
      block.items.forEach((item) => ids.add(item.id));
    }
  });
  return ids;
}

function joinEditableText(left: string, right: string): string {
  const cleanLeft = normalizeEditableText(left);
  const cleanRight = normalizeEditableText(right);
  if (!cleanLeft) return cleanRight;
  if (!cleanRight) return cleanLeft;
  return `${cleanLeft}${cleanLeft.endsWith("\n") ? "" : " "}${cleanRight}`;
}

function getTargetRichText(
  text: string,
  richText: ProposalRichText | undefined,
): ProposalRichText | undefined {
  return normalizeProposalRichText(richText) ?? createProposalRichTextFromPlainText(text);
}

function normalizeAdjacentRuns(runs: ProposalInlineRun[]): ProposalInlineRun[] {
  const normalized: ProposalInlineRun[] = [];
  runs.forEach((run) => {
    const text = stripZeroWidthPlaceholders(run.text);
    if (!text) return;
    const previous = normalized[normalized.length - 1];
    if (
      previous &&
      Boolean(previous.bold) === Boolean(run.bold) &&
      Boolean(previous.italic) === Boolean(run.italic) &&
      Boolean(previous.underline) === Boolean(run.underline)
    ) {
      previous.text += text;
      return;
    }
    normalized.push({
      text,
      ...(run.bold ? { bold: true } : null),
      ...(run.italic ? { italic: true } : null),
      ...(run.underline ? { underline: true } : null),
    });
  });
  return normalized;
}

function sliceProposalRichText(
  richText: ProposalRichText | undefined,
  start: number,
  end: number,
): ProposalRichText | undefined {
  const normalized = normalizeProposalRichText(richText);
  if (!normalized) return undefined;

  let cursor = 0;
  const runs: ProposalInlineRun[] = [];
  normalized.runs.forEach((run) => {
    const runStart = cursor;
    const runEnd = runStart + run.text.length;
    cursor = runEnd;
    if (runEnd <= start || runStart >= end) return;

    const localStart = Math.max(0, start - runStart);
    const localEnd = Math.min(run.text.length, end - runStart);
    const text = run.text.slice(localStart, localEnd);
    if (!text) return;
    runs.push({ ...run, text });
  });

  const text = normalizeProposalDocumentEditText(
    runs.map((run) => run.text).join(""),
  );
  if (!text) return undefined;

  const rawText = runs.map((run) => run.text).join("");
  let remainingTrimStart = rawText.length - rawText.trimStart().length;
  const trimmedLength = rawText.trim().length;
  const trimmedRuns = runs
    .map((run) => {
      let nextText = run.text;
      if (remainingTrimStart > 0) {
        const trimCount = Math.min(remainingTrimStart, nextText.length);
        nextText = nextText.slice(trimCount);
        remainingTrimStart -= trimCount;
      }
      return { ...run, text: nextText };
    })
    .filter((run) => run.text);

  let seen = 0;
  const boundedRuns = trimmedRuns
    .map((run) => {
      if (seen >= trimmedLength) return { ...run, text: "" };
      const available = trimmedLength - seen;
      const nextText = run.text.slice(0, available);
      seen += nextText.length;
      return { ...run, text: nextText };
    })
    .filter((run) => run.text);

  const nextRuns = normalizeAdjacentRuns(boundedRuns);
  return nextRuns.length > 0 ? { runs: nextRuns } : undefined;
}

function joinProposalRichText(
  left: ProposalRichText | undefined,
  right: ProposalRichText | undefined,
): ProposalRichText | undefined {
  const leftRuns = normalizeProposalRichText(left)?.runs ?? [];
  const rightRuns = normalizeProposalRichText(right)?.runs ?? [];
  const separator = leftRuns.length > 0 && rightRuns.length > 0 ? [{ text: " " }] : [];
  const runs = normalizeAdjacentRuns([...leftRuns, ...separator, ...rightRuns]);
  return runs.length > 0 ? { runs } : undefined;
}

function applyInlineMarkToRichText(args: {
  text: string;
  richText?: ProposalRichText;
  mark: ProposalInlineMark;
  start: number;
  end: number;
}): ProposalRichText | undefined {
  const baseRichText = getTargetRichText(args.text, args.richText);
  if (!baseRichText) return undefined;

  const plainText = getProposalRichTextPlainText(baseRichText);
  const start = Math.max(0, Math.min(args.start, plainText.length));
  const end = Math.max(start, Math.min(args.end, plainText.length));
  if (start === end) return baseRichText;

  let cursor = 0;
  let selectedHasUnmarkedText = false;
  baseRichText.runs.forEach((run) => {
    const runStart = cursor;
    const runEnd = runStart + run.text.length;
    cursor = runEnd;
    if (runEnd <= start || runStart >= end) return;
    if (!run[args.mark]) {
      selectedHasUnmarkedText = true;
    }
  });

  const nextValue = selectedHasUnmarkedText;
  cursor = 0;
  const nextRuns: ProposalInlineRun[] = [];
  baseRichText.runs.forEach((run) => {
    const runStart = cursor;
    const runEnd = runStart + run.text.length;
    cursor = runEnd;

    if (runEnd <= start || runStart >= end) {
      nextRuns.push(run);
      return;
    }

    const localStart = Math.max(0, start - runStart);
    const localEnd = Math.min(run.text.length, end - runStart);
    if (localStart > 0) {
      nextRuns.push({ ...run, text: run.text.slice(0, localStart) });
    }
    nextRuns.push({
      ...run,
      text: run.text.slice(localStart, localEnd),
      [args.mark]: nextValue || undefined,
    });
    if (localEnd < run.text.length) {
      nextRuns.push({ ...run, text: run.text.slice(localEnd) });
    }
  });

  const runs = normalizeAdjacentRuns(nextRuns);
  return runs.length > 0 ? { runs } : undefined;
}

function removeListItemAt(
  block: Extract<ProposalDocumentBlock, { type: "list" }>,
  itemIndex: number,
): Extract<ProposalDocumentBlock, { type: "list" }> | null {
  const items = block.items.filter((_, index) => index !== itemIndex);
  if (items.length === 0) return null;
  return {
    ...block,
    items,
  };
}

function cleanProposalListText(value: string): string {
  return stripInlineProposalMarkdown(value).replace(/\s+/g, " ").trim();
}

function markerFromLegacyBulletMarker(marker: string): ProposalDocumentListMarker {
  return marker === "-" ? { type: "dash" } : { type: "dot" };
}

function serializeListMarker(marker: ProposalDocumentListMarker | null | undefined): "-" | "*" {
  if (marker?.type === "dash") return "-";
  return "*";
}

function appendBodyBlocksFromText(
  blocks: ProposalDocumentBlock[],
  content: string,
): void {
  let paragraphLines: string[] = [];
  let listItems: ProposalDocumentListItem[] = [];
  let listMarker: ProposalDocumentListMarker | null = null;

  const flushParagraph = () => {
    const text = compactProposalParagraph(paragraphLines.join("\n"));
    paragraphLines = [];
    if (text) {
      blocks.push({
        id: createBlockId("paragraph", blocks.length),
        type: "paragraph",
        text,
      });
    }
  };

  const flushList = () => {
    const items = listItems.filter((item) => item.text);
    listItems = [];
    if (items.length > 0) {
      blocks.push({
        id: createBlockId("list", blocks.length),
        type: "list",
        items,
        marker: listMarker,
      });
    }
    listMarker = null;
  };

  content.split("\n").forEach((line) => {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const bulletMatch = line.match(PROPOSAL_BULLET_LINE_PATTERN);
    if (bulletMatch) {
      flushParagraph();
      const marker = markerFromLegacyBulletMarker(bulletMatch[2] ?? "•");
      if (!listMarker) {
        listMarker = marker;
      }
      const text = cleanProposalListText(bulletMatch[3] ?? "");
      if (text) {
        listItems.push({
          id: createListItemId(blocks.length, listItems.length),
          text,
          marker,
        });
      }
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();
}

export function isValidProposalDocument(value: unknown): value is ProposalDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProposalDocument>;
  if (candidate.schemaVersion !== PROPOSAL_DOCUMENT_SCHEMA_VERSION) return false;
  if (
    candidate.kind !== "letter" &&
    candidate.kind !== "message" &&
    candidate.kind !== "proposal"
  ) {
    return false;
  }
  if (!Array.isArray(candidate.blocks)) return false;

  return candidate.blocks.every((block) => {
    if (!block || typeof block !== "object") return false;
    const typedBlock = block as Partial<ProposalDocumentBlock>;
    if (typeof typedBlock.id !== "string" || !typedBlock.id.trim()) return false;
    if (typedBlock.type === "salutation" || typedBlock.type === "paragraph") {
      return (
        typeof typedBlock.text === "string" &&
        (typedBlock.richText === undefined ||
          normalizeProposalRichText(typedBlock.richText) !== undefined)
      );
    }
    if (typedBlock.type === "list") {
      return (
        Array.isArray(typedBlock.items) &&
        typedBlock.items.every(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof (item).id === "string" &&
            typeof (item).text === "string" &&
            ((item).richText === undefined ||
              normalizeProposalRichText(
                (item).richText,
              ) !== undefined),
        )
      );
    }
    if (typedBlock.type === "closing") {
      return (
        typeof typedBlock.signOff === "string" &&
        typeof typedBlock.signatureName === "string"
      );
    }
    return false;
  });
}

export function normalizeProposalDocument(
  value: unknown,
): ProposalDocument | null {
  if (!isValidProposalDocument(value)) return null;

  return {
    schemaVersion: PROPOSAL_DOCUMENT_SCHEMA_VERSION,
    kind: value.kind,
    source: value.source === "structured" ? "structured" : "legacy-string",
    blocks: value.blocks
      .map((block, blockIndex): ProposalDocumentBlock | null => {
        if (block.type === "salutation" || block.type === "paragraph") {
          const richText = normalizeProposalRichText(block.richText);
          const text = richText
            ? getProposalRichTextPlainText(richText)
            : normalizeProposalDocumentEditText(block.text);
          return {
            id: cleanString(block.id) || createBlockId(block.type, blockIndex),
            type: block.type,
            text,
            ...(richText ? { richText } : null),
          };
        }
        if (block.type === "list") {
          const items = block.items
            .map((item, itemIndex) => {
              const richText = normalizeProposalRichText(item.richText);
              return {
                id:
                  cleanString(item.id) ||
                  createListItemId(blockIndex, itemIndex),
                text: richText
                  ? getProposalRichTextPlainText(richText)
                  : normalizeProposalDocumentEditText(item.text),
                ...(richText ? { richText } : null),
                ...(cleanString(item.iconKey)
                  ? { iconKey: cleanString(item.iconKey) }
                  : null),
                marker: item.marker ?? block.marker ?? null,
              };
            });
          if (items.length === 0) return null;
          return {
            id: cleanString(block.id) || createBlockId("list", blockIndex),
            type: "list",
            items,
            marker: block.marker ?? null,
          };
        }
        if (block.type === "closing") {
          const signOff = cleanString(block.signOff);
          const signatureName = cleanString(block.signatureName);
          if (!signOff && !signatureName) return null;
          return {
            id: cleanString(block.id) || createBlockId("closing", blockIndex),
            type: "closing",
            signOff,
            signatureName,
            ...(block.handwrittenSignatureEnabled
              ? { handwrittenSignatureEnabled: true }
              : null),
          };
        }
        return null;
      })
      .filter((block): block is ProposalDocumentBlock => Boolean(block)),
  };
}

export function parseLegacyProposalDocument(args: {
  content: string | null | undefined;
  proposalType?: ProposalTypeLike;
  closing?: ProposalClosingRef | null;
}): ProposalDocument {
  const kind = resolveProposalDocumentKind(args.proposalType);
  const normalized = (args.content ?? "").replace(/\r\n?/g, "\n").trim();
  const blocks: ProposalDocumentBlock[] = [];

  if (!normalized) {
    return {
      schemaVersion: PROPOSAL_DOCUMENT_SCHEMA_VERSION,
      kind,
      source: "legacy-string",
      blocks,
    };
  }

  if (kind === "proposal") {
    appendBodyBlocksFromText(blocks, normalized);
    return {
      schemaVersion: PROPOSAL_DOCUMENT_SCHEMA_VERSION,
      kind,
      source: "legacy-string",
      blocks,
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

  const candidateSalutation = stripInlineProposalMarkdown(rawLines[start] ?? "");
  if (candidateSalutation && SALUTATION_PATTERN.test(candidateSalutation)) {
    blocks.push({
      id: createBlockId("salutation", blocks.length),
      type: "salutation",
      text: candidateSalutation,
    });
    start += 1;
  }

  while (start <= end && !stripInlineProposalMarkdown(rawLines[start])) {
    start += 1;
  }

  const paragraphs = rawLines.slice(start, end + 1).join("\n").split(/\n\s*\n/).filter(Boolean);
  const extractedClosingBlock = extractProposalClosingBlockFromParagraphs(paragraphs);
  const structuredClosing = sanitizeProposalClosingRef(args.closing);

  if (extractedClosingBlock) {
    paragraphs.splice(extractedClosingBlock.startIndex);
  }

  appendBodyBlocksFromText(blocks, paragraphs.join("\n\n"));

  if (
    structuredClosing &&
    (structuredClosing.signOff ||
      (structuredClosing.enabled && structuredClosing.signatureName))
  ) {
    blocks.push({
      id: createBlockId("closing", blocks.length),
      type: "closing",
      signOff: structuredClosing.signOff,
      signatureName: structuredClosing.enabled
        ? structuredClosing.signatureName
        : "",
      ...(structuredClosing.enabled && structuredClosing.handwrittenSignatureEnabled
        ? { handwrittenSignatureEnabled: true }
        : null),
    });
  } else if (extractedClosingBlock) {
    blocks.push({
      id: createBlockId("closing", blocks.length),
      type: "closing",
      signOff: extractedClosingBlock.block.signOff ?? "",
      signatureName: extractedClosingBlock.block.signatureName ?? "",
    });
  }

  return {
    schemaVersion: PROPOSAL_DOCUMENT_SCHEMA_VERSION,
    kind,
    source: "legacy-string",
    blocks,
  };
}

export function resolveProposalDocument(args: {
  document?: ProposalDocumentInput;
  content: string | null | undefined;
  proposalType?: ProposalTypeLike;
  closing?: ProposalClosingRef | null;
}): ProposalDocument {
  return (
    normalizeProposalDocument(args.document) ??
    parseLegacyProposalDocument({
      content: args.content,
      proposalType: args.proposalType,
      closing: args.closing,
    })
  );
}

export function serializeProposalDocumentToLegacyString(
  document: ProposalDocumentInput,
): string {
  const normalized = normalizeProposalDocument(document);
  if (!normalized) return "";

  return normalized.blocks
    .map((block) => {
      if (block.type === "salutation" || block.type === "paragraph") {
        return normalizeEditableText(
          block.richText ? getProposalRichTextPlainText(block.richText) : block.text,
        );
      }
      if (block.type === "list") {
        return block.items
          .map((item) => {
            const text = normalizeEditableText(
              item.richText ? getProposalRichTextPlainText(item.richText) : item.text,
            );
            if (!text) return "";
            const marker = serializeListMarker(item.marker ?? block.marker);
            return `${marker} ${text}`;
          })
          .filter(Boolean)
          .join("\n");
      }
      const closingLines = [block.signOff, block.signatureName]
        .map(cleanString)
        .filter(Boolean);
      return closingLines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function getProposalDocumentBodyBlocks(
  document: ProposalDocumentInput,
): ProposalDocumentBlock[] {
  return normalizeProposalDocument(document)?.blocks ?? [];
}

export function updateProposalDocumentTextTarget(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
  value: string;
}): ProposalDocument {
  const nextText = normalizeProposalDocumentEditText(args.value);
  const target = args.target;
  return {
    ...args.document,
    source: "structured",
    blocks: args.document.blocks.map((block): ProposalDocumentBlock => {
      if (
        target.type === "text-block" &&
        block.id === target.blockId &&
        (block.type === "salutation" || block.type === "paragraph")
      ) {
        const { richText: _richText, ...rest } = block;
        return { ...rest, text: nextText };
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
              ? (({ richText: _richText, ...rest }) => ({
                  ...rest,
                  text: nextText,
                }))(item)
              : item,
          ),
        };
      }

      return block;
    }),
  };
}

export function updateProposalDocumentRichTextTarget(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
  richText: ProposalRichText | undefined;
}): ProposalDocument {
  const richText = normalizeProposalRichText(args.richText);
  const nextText = richText ? getProposalRichTextPlainText(richText) : "";
  const target = args.target;
  return {
    ...args.document,
    source: "structured",
    blocks: args.document.blocks.map((block): ProposalDocumentBlock => {
      if (
        target.type === "text-block" &&
        block.id === target.blockId &&
        (block.type === "salutation" || block.type === "paragraph")
      ) {
        const { richText: _richText, ...rest } = block;
        return {
          ...rest,
          text: nextText,
          ...(richText ? { richText } : null),
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
              ? (({ richText: _richText, ...rest }) => ({
                  ...rest,
                  text: nextText,
                  ...(richText ? { richText } : null),
                }))(item)
              : item,
          ),
        };
      }

      return block;
    }),
  };
}

export function applyProposalDocumentInlineMark(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
  mark: ProposalInlineMark;
  start: number;
  end: number;
}): ProposalDocument {
  const target = args.target;
  for (const block of args.document.blocks) {
    if (
      target.type === "text-block" &&
      block.id === target.blockId &&
      (block.type === "salutation" || block.type === "paragraph")
    ) {
      const richText = applyInlineMarkToRichText({
        text: block.text,
        richText: block.richText,
        mark: args.mark,
        start: args.start,
        end: args.end,
      });
      return updateProposalDocumentRichTextTarget({
        document: args.document,
        target,
        richText,
      });
    }

    if (
      target.type === "list-item" &&
      block.id === target.blockId &&
      block.type === "list"
    ) {
      const item = block.items.find((candidate) => candidate.id === target.itemId);
      if (!item) break;
      const richText = applyInlineMarkToRichText({
        text: item.text,
        richText: item.richText,
        mark: args.mark,
        start: args.start,
        end: args.end,
      });
      return updateProposalDocumentRichTextTarget({
        document: args.document,
        target,
        richText,
      });
    }
  }

  return args.document;
}

export function applyProposalDocumentInlineMarkToTextBlockRange(args: {
  document: ProposalDocument;
  startTarget: ProposalDocumentTextTarget;
  startOffset: number;
  endTarget: ProposalDocumentTextTarget;
  endOffset: number;
  mark: ProposalInlineMark;
}): ProposalDocument | null {
  if (
    args.startTarget.type !== "text-block" ||
    args.endTarget.type !== "text-block"
  ) {
    return null;
  }

  const startKey = args.startTarget.blockId;
  const endKey = args.endTarget.blockId;
  let nextDocument = args.document;
  let hasStarted = false;
  let hasEnded = false;
  let didApply = false;

  for (const block of args.document.blocks) {
    if (block.type !== "paragraph" && block.type !== "salutation") {
      continue;
    }

    if (block.id === startKey) {
      hasStarted = true;
    }

    if (!hasStarted || hasEnded) {
      continue;
    }

    const isStart = block.id === startKey;
    const isEnd = block.id === endKey;
    const start = isStart ? args.startOffset : 0;
    const end = isEnd ? args.endOffset : block.text.length;
    const boundedStart = Math.max(0, Math.min(start, block.text.length));
    const boundedEnd = Math.max(boundedStart, Math.min(end, block.text.length));

    if (boundedEnd > boundedStart) {
      const updatedDocument = applyProposalDocumentInlineMark({
        document: nextDocument,
        target: { type: "text-block", blockId: block.id },
        mark: args.mark,
        start: boundedStart,
        end: boundedEnd,
      });
      didApply = didApply || updatedDocument !== nextDocument;
      nextDocument = updatedDocument;
    }

    if (isEnd) {
      hasEnded = true;
    }
  }

  return hasStarted && hasEnded && didApply ? nextDocument : null;
}

export function splitProposalDocumentTarget(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
  offset: number;
}): ProposalDocument {
  const ids = collectProposalDocumentIds(args.document);
  const blocks: ProposalDocumentBlock[] = [];
  const target = args.target;

  args.document.blocks.forEach((block) => {
    if (
      target.type === "text-block" &&
      block.id === target.blockId &&
      block.type === "paragraph"
    ) {
      const offset = Math.max(0, Math.min(args.offset, block.text.length));
      const beforeRichText = sliceProposalRichText(block.richText, 0, offset);
      const afterRichText = sliceProposalRichText(
        block.richText,
        offset,
        block.text.length,
      );
      const before = beforeRichText
        ? getProposalRichTextPlainText(beforeRichText)
        : normalizeProposalDocumentEditText(block.text.slice(0, offset));
      const after = afterRichText
        ? getProposalRichTextPlainText(afterRichText)
        : normalizeProposalDocumentEditText(block.text.slice(offset));
      const { richText: _richText, ...plainBlock } = block;
      blocks.push({
        ...plainBlock,
        text: before,
        ...(beforeRichText ? { richText: beforeRichText } : null),
      });
      blocks.push({
        id: createSiblingId(ids, block.id, "paragraph"),
        type: "paragraph",
        text: after,
        ...(afterRichText ? { richText: afterRichText } : null),
      });
      return;
    }

    if (
      target.type === "list-item" &&
      block.id === target.blockId &&
      block.type === "list"
    ) {
      const itemIndex = block.items.findIndex(
        (item) => item.id === target.itemId,
      );
      if (itemIndex === -1) {
        blocks.push(block);
        return;
      }

      const item = block.items[itemIndex];
      const offset = Math.max(0, Math.min(args.offset, item.text.length));
      const beforeRichText = sliceProposalRichText(item.richText, 0, offset);
      const afterRichText = sliceProposalRichText(
        item.richText,
        offset,
        item.text.length,
      );
      const before = beforeRichText
        ? getProposalRichTextPlainText(beforeRichText)
        : normalizeProposalDocumentEditText(item.text.slice(0, offset));
      const after = afterRichText
        ? getProposalRichTextPlainText(afterRichText)
        : normalizeProposalDocumentEditText(item.text.slice(offset));
      const isEmptyItem = !normalizeProposalDocumentEditText(item.text);

      if (isEmptyItem) {
        const beforeItems = block.items.slice(0, itemIndex);
        const afterItems = block.items.slice(itemIndex + 1);
        if (beforeItems.length > 0) {
          blocks.push({ ...block, items: beforeItems });
        }
        blocks.push({
          id: createSiblingId(ids, block.id, "paragraph"),
          type: "paragraph",
          text: "",
        });
        if (afterItems.length > 0) {
          blocks.push({
            ...block,
            id: createSiblingId(ids, block.id, "continued"),
            items: afterItems,
          });
        }
        return;
      }

      blocks.push({
        ...block,
        items: block.items.flatMap((current, index) => {
          if (index !== itemIndex) return [current];
          const { richText: _richText, ...plainItem } = current;
          return [
            {
              ...plainItem,
              text: before,
              ...(beforeRichText ? { richText: beforeRichText } : null),
            },
            {
              id: createSiblingId(ids, current.id, "item"),
              text: after,
              marker: current.marker ?? block.marker ?? null,
              ...(afterRichText ? { richText: afterRichText } : null),
            },
          ];
        }),
      });
      return;
    }

    blocks.push(block);
  });

  return { ...args.document, source: "structured", blocks };
}

export function mergeProposalDocumentTargetBackward(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
}): ProposalDocument {
  const blocks = [...args.document.blocks];
  const target = args.target;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];

    if (
      target.type === "text-block" &&
      block.id === target.blockId &&
      block.type === "paragraph"
    ) {
      const previous = blocks[blockIndex - 1];
      if (!previous) return args.document;

      if (previous.type === "paragraph" || previous.type === "salutation") {
        const { richText: _richText, ...plainPrevious } = previous;
        const richText = joinProposalRichText(previous.richText, block.richText);
        const text = richText
          ? getProposalRichTextPlainText(richText)
          : joinEditableText(previous.text, block.text);
        blocks[blockIndex - 1] = {
          ...plainPrevious,
          text,
          ...(richText ? { richText } : null),
        };
        blocks.splice(blockIndex, 1);
        return { ...args.document, source: "structured", blocks };
      }

      if (previous.type === "list" && previous.items.length > 0) {
        const lastItemIndex = previous.items.length - 1;
        blocks[blockIndex - 1] = {
          ...previous,
          items: previous.items.map((item, index) => {
            if (index !== lastItemIndex) return item;
            const { richText: _richText, ...plainItem } = item;
            const richText = joinProposalRichText(item.richText, block.richText);
            const text = richText
              ? getProposalRichTextPlainText(richText)
              : joinEditableText(item.text, block.text);
            return {
              ...plainItem,
              text,
              ...(richText ? { richText } : null),
            };
          }),
        };
        blocks.splice(blockIndex, 1);
        return { ...args.document, source: "structured", blocks };
      }
    }

    if (
      target.type === "list-item" &&
      block.id === target.blockId &&
      block.type === "list"
    ) {
      const itemIndex = block.items.findIndex(
        (item) => item.id === target.itemId,
      );
      if (itemIndex === -1) return args.document;
      const item = block.items[itemIndex];

      if (!normalizeProposalDocumentEditText(item.text)) {
        const updated = removeListItemAt(block, itemIndex);
        if (updated) {
          blocks[blockIndex] = updated;
        } else {
          blocks.splice(blockIndex, 1, {
            id: createSiblingId(collectProposalDocumentIds(args.document), block.id, "paragraph"),
            type: "paragraph",
            text: "",
          });
        }
        return { ...args.document, source: "structured", blocks };
      }

      if (itemIndex > 0) {
        const previousItem = block.items[itemIndex - 1];
        blocks[blockIndex] = {
          ...block,
          items: block.items
            .map((current, index) => {
              if (index !== itemIndex - 1) return current;
              const { richText: _richText, ...plainCurrent } = current;
              const richText = joinProposalRichText(
                previousItem.richText,
                item.richText,
              );
              const text = richText
                ? getProposalRichTextPlainText(richText)
                : joinEditableText(previousItem.text, item.text);
              return {
                ...plainCurrent,
                text,
                ...(richText ? { richText } : null),
              };
            })
            .filter((_, index) => index !== itemIndex),
        };
        return { ...args.document, source: "structured", blocks };
      }

      const previous = blocks[blockIndex - 1];
      if (previous?.type === "paragraph" || previous?.type === "salutation") {
        const { richText: _richText, ...plainPrevious } = previous;
        const richText = joinProposalRichText(previous.richText, item.richText);
        const text = richText
          ? getProposalRichTextPlainText(richText)
          : joinEditableText(previous.text, item.text);
        blocks[blockIndex - 1] = {
          ...plainPrevious,
          text,
          ...(richText ? { richText } : null),
        };
        const updated = removeListItemAt(block, itemIndex);
        if (updated) {
          blocks[blockIndex] = updated;
        } else {
          blocks.splice(blockIndex, 1);
        }
        return { ...args.document, source: "structured", blocks };
      }
    }
  }

  return args.document;
}

export function mergeProposalDocumentTargetForward(args: {
  document: ProposalDocument;
  target: ProposalDocumentTextTarget;
}): ProposalDocument {
  const blocks = [...args.document.blocks];
  const target = args.target;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];

    if (
      target.type === "text-block" &&
      block.id === target.blockId &&
      (block.type === "paragraph" || block.type === "salutation")
    ) {
      const next = blocks[blockIndex + 1];
      if (!next) return args.document;

      if (next.type === "paragraph") {
        const { richText: _richText, ...plainBlock } = block;
        const richText = joinProposalRichText(block.richText, next.richText);
        const text = richText
          ? getProposalRichTextPlainText(richText)
          : joinEditableText(block.text, next.text);
        blocks[blockIndex] = {
          ...plainBlock,
          text,
          ...(richText ? { richText } : null),
        };
        blocks.splice(blockIndex + 1, 1);
        return { ...args.document, source: "structured", blocks };
      }

      if (next.type === "list" && next.items.length > 0) {
        const [firstItem, ...restItems] = next.items;
        const { richText: _richText, ...plainBlock } = block;
        const richText = joinProposalRichText(block.richText, firstItem.richText);
        const text = richText
          ? getProposalRichTextPlainText(richText)
          : joinEditableText(block.text, firstItem.text);
        blocks[blockIndex] = {
          ...plainBlock,
          text,
          ...(richText ? { richText } : null),
        };
        if (restItems.length > 0) {
          blocks[blockIndex + 1] = { ...next, items: restItems };
        } else {
          blocks.splice(blockIndex + 1, 1);
        }
        return { ...args.document, source: "structured", blocks };
      }
    }

    if (
      target.type === "list-item" &&
      block.id === target.blockId &&
      block.type === "list"
    ) {
      const itemIndex = block.items.findIndex(
        (item) => item.id === target.itemId,
      );
      if (itemIndex === -1) return args.document;

      if (itemIndex < block.items.length - 1) {
        const nextItem = block.items[itemIndex + 1];
        blocks[blockIndex] = {
          ...block,
          items: block.items
            .map((current, index) => {
              if (index !== itemIndex) return current;
              const { richText: _richText, ...plainCurrent } = current;
              const richText = joinProposalRichText(
                current.richText,
                nextItem.richText,
              );
              const text = richText
                ? getProposalRichTextPlainText(richText)
                : joinEditableText(current.text, nextItem.text);
              return {
                ...plainCurrent,
                text,
                ...(richText ? { richText } : null),
              };
            })
            .filter((_, index) => index !== itemIndex + 1),
        };
        return { ...args.document, source: "structured", blocks };
      }

      const next = blocks[blockIndex + 1];
      if (next?.type === "paragraph") {
        blocks[blockIndex] = {
          ...block,
          items: block.items.map((item, index) => {
            if (index !== itemIndex) return item;
            const { richText: _richText, ...plainItem } = item;
            const richText = joinProposalRichText(item.richText, next.richText);
            const text = richText
              ? getProposalRichTextPlainText(richText)
              : joinEditableText(item.text, next.text);
            return {
              ...plainItem,
              text,
              ...(richText ? { richText } : null),
            };
          }),
        };
        blocks.splice(blockIndex + 1, 1);
        return { ...args.document, source: "structured", blocks };
      }
    }
  }

  return args.document;
}
