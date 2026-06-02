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

export type ProposalDocumentListItem = {
  id: string;
  text: string;
  iconKey?: DocumentIconKey;
  marker?: ProposalDocumentListMarker | null;
};

export type ProposalDocumentBlock =
  | {
      id: string;
      type: "salutation";
      text: string;
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
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

type ProposalTypeLike = "cover_letter" | "application_message" | "freelance_proposal" | string | null | undefined;

const SALUTATION_PATTERN =
  /^(dear\b|hello\b|hi\b|greetings\b|madame\b|monsieur\b|madame,\s*monsieur\b|bonjour\b)/i;
const PROPOSAL_BULLET_LINE_PATTERN = /^(\s{0,3})([-*•])\s+(.+?)\s*$/u;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

  return decoded
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
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
      return typeof typedBlock.text === "string";
    }
    if (typedBlock.type === "list") {
      return (
        Array.isArray(typedBlock.items) &&
        typedBlock.items.every(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof (item as ProposalDocumentListItem).id === "string" &&
            typeof (item as ProposalDocumentListItem).text === "string",
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
          return {
            id: cleanString(block.id) || createBlockId(block.type, blockIndex),
            type: block.type,
            text: normalizeEditableText(block.text),
          };
        }
        if (block.type === "list") {
          const items = block.items
            .map((item, itemIndex) => ({
              id:
                cleanString(item.id) ||
                createListItemId(blockIndex, itemIndex),
              text: normalizeEditableText(item.text),
              ...(cleanString(item.iconKey)
                ? { iconKey: cleanString(item.iconKey) as DocumentIconKey }
                : null),
              marker: item.marker ?? block.marker ?? null,
            }))
            .filter((item) => item.text);
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
        return normalizeEditableText(block.text);
      }
      if (block.type === "list") {
        return block.items
          .map((item) => {
            const marker = serializeListMarker(item.marker ?? block.marker);
            return `${marker} ${normalizeEditableText(item.text)}`;
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
