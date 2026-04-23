import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  ProposalBriefCard,
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

  it("keeps the richer brief content in default mode", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Operations Associate"
          jobDescription="Coordinate recurring launches and maintain documentation."
          summaryText="Operations Associate role focused on recurring launches."
          trustState="needs_review"
          linkedDocumentCount={1}
          linkedProposals={[
            {
              id: "proposal_alpha",
              title: "Operations Associate cover letter",
              status: "saved",
              updatedAt: 1710000000000,
            },
          ]}
          reviewItems={[
            {
              id: "review_1",
              fieldKey: "responsibilities",
              label: "Responsibilities",
              reviewStatus: "pending",
              suggestedValue: ["Coordinate recurring launches"],
              sourceText:
                "Coordinate recurring launches and maintain documentation.",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Review state")).toBeInTheDocument();
    expect(screen.getByText("Extracted summary")).toBeInTheDocument();
    expect(screen.getByText("Linked documents")).toBeInTheDocument();
    expect(screen.getByText("Raw source")).toBeInTheDocument();
  });
});
