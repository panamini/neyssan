import { describe, expect, it } from "vitest";

import {
  resolveProposalBriefCardDisplayContent,
  resolveProposalBriefCardTitle,
} from "../ProposalBriefCard";

describe("resolveProposalBriefCardTitle", () => {
  it("prefers the output document title over the source job title", () => {
    expect(
      resolveProposalBriefCardTitle({
        sourceJobTitle: "Operations Associate",
        outputDocumentTitle: "Operations Associate cover letter",
      }),
    ).toBe("Operations Associate cover letter");
  });

  it("falls back to the source job title when no output document title exists", () => {
    expect(
      resolveProposalBriefCardTitle({
        sourceJobTitle: "Operations Associate",
        outputDocumentTitle: null,
      }),
    ).toBe("Operations Associate");
  });

  it("falls back to Untitled Proposal when neither title is present", () => {
    expect(
      resolveProposalBriefCardTitle({
        sourceJobTitle: null,
        outputDocumentTitle: null,
      }),
    ).toBe("Untitled Proposal");
  });

  it("resolves visible display props when provided", () => {
    expect(
      resolveProposalBriefCardDisplayContent({
        summaryText: "Heuristic summary",
        visibleSummaryText: "LLM visible summary",
        requirements: ["Heuristic requirement"],
        visibleRequirements: ["LLM visible requirement"],
        keywords: ["heuristic"],
        visibleKeywords: ["llm keyword"],
      }),
    ).toEqual({
      summaryText: "LLM visible summary",
      requirements: ["LLM visible requirement"],
      keywords: ["llm keyword"],
    });
  });

  it("falls back to current props when visible display props are omitted", () => {
    expect(
      resolveProposalBriefCardDisplayContent({
        summaryText: "Heuristic summary",
        requirements: ["Heuristic requirement"],
        keywords: ["heuristic"],
      }),
    ).toEqual({
      summaryText: "Heuristic summary",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    });
  });
});
