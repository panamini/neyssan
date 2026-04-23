import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalBriefCard } from "../ProposalBriefCard";

describe("ProposalBriefCard", () => {
  it("renders linked documents before raw source and saves summary edits", async () => {
    const onSaveField = vi.fn().mockResolvedValue(undefined);
    const onSaveReviewItem = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ProposalBriefCard
          documentTitle="Operations Associate"
          jobDescription="Coordinate internal workflows and keep teams aligned."
          sourceUrl="https://www.linkedin.com/jobs/view/alpha"
          sourcePlatform="linkedin"
          summaryText="Support recurring operations and unblock coordination work."
          parseStatus="parsed"
          trustState="needs_review"
          linkedDocumentCount={1}
          linkedProposals={[
            {
              id: "proposal_1",
              title: "Operations Associate cover letter",
              status: "saved",
              updatedAt: 1711003000000,
            },
          ]}
          reviewItems={[
            {
              id: "review_1",
              fieldKey: "responsibilities",
              label: "Responsibilities",
              reviewStatus: "pending",
              suggestedValue: ["Run recurring workflows"],
              sourceText: "Coordinate internal workflows and keep teams aligned.",
            },
          ]}
          onSaveField={onSaveField}
          onSaveReviewItem={onSaveReviewItem}
        />
      </MemoryRouter>,
    );

    const linkedDocuments = screen.getByText("Linked documents");
    const rawSource = screen.getByText("Raw source");
    expect(
      linkedDocuments.compareDocumentPosition(rawSource) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated summary copy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    await waitFor(() => {
      expect(onSaveField).toHaveBeenCalledWith("summary", "Updated summary copy.");
    });
    expect(onSaveReviewItem).not.toHaveBeenCalled();
  });
});
