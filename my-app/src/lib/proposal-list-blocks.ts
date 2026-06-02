import { stripInlineProposalMarkdown } from "./proposal-closing";

export type ProposalPlainTextBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

const PROPOSAL_BULLET_LINE_PATTERN = /^\s{0,3}(?:[-*•])\s+(.+?)\s*$/u;

function cleanProposalListText(value: string): string {
  return stripInlineProposalMarkdown(value).replace(/\s+/g, " ").trim();
}

export function parseProposalPlainTextBlocks(
  content: string | null | undefined,
): ProposalPlainTextBlock[] {
  const normalized = (content ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const blocks: ProposalPlainTextBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = cleanProposalListText(paragraphLines.join(" "));
    paragraphLines = [];
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
  };

  const flushList = () => {
    const items = listItems.map(cleanProposalListText).filter(Boolean);
    listItems = [];
    if (items.length > 0) {
      blocks.push({ type: "list", items });
    }
  };

  normalized.split("\n").forEach((line) => {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const bulletMatch = line.match(PROPOSAL_BULLET_LINE_PATTERN);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1] ?? "");
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return blocks;
}
