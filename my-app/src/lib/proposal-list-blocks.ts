import {
  parseLegacyProposalDocument,
  type ProposalDocumentBlock,
} from "./proposal-document";

export type ProposalPlainTextBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

export function parseProposalPlainTextBlocks(
  content: string | null | undefined,
): ProposalPlainTextBlock[] {
  return parseLegacyProposalDocument({ content, proposalType: "freelance_proposal" })
    .blocks.map((block: ProposalDocumentBlock): ProposalPlainTextBlock | null => {
      if (block.type === "paragraph") {
        return { type: "paragraph", text: block.text };
      }
      if (block.type === "list") {
        return {
          type: "list",
          items: block.items.map((item) => item.text).filter(Boolean),
        };
      }
      return null;
    })
    .filter((block): block is ProposalPlainTextBlock => Boolean(block));
}
