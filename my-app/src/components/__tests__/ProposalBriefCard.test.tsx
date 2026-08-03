import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import {
  ProposalBriefCard,
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

  it("shows one calm brief status instead of repeating review state copy", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Operations Associate"
          jobDescription="Raw job text"
          summaryText="Operations role summary"
          parseStatus="parsed"
          trustState="needs_review"
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Review needed").length).toBeGreaterThan(0);
    expect(screen.queryByText("Check fields")).not.toBeInTheDocument();
    expect(screen.queryByText("Review state")).not.toBeInTheDocument();
    expect(screen.queryByText(/Review state:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("can hide the embedded header when the brief is shown inside another page header", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Operations Associate"
          jobDescription="Raw job text"
          summaryText="Operations role summary"
          sourceUrl="https://www.linkedin.com/jobs/view/alpha"
          sourcePlatform="linkedin"
          showHeader={false}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("heading", { name: "Operations Associate" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Open original job offer on LinkedIn",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Operations role summary")).toBeInTheDocument();
  });

  it("renders review cards with current suggested values and keeps review actions", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Security Guard"
          jobDescription="Raw job text"
          summaryText="Heuristic summary"
          visibleSummaryText="Mistral summary"
          requirements={["Heuristic requirement"]}
          visibleRequirements={["Mistral requirement"]}
          keywords={["location", "miami", "status"]}
          visibleKeywords={["security guard", "loss prevention"]}
          reviewItems={[
            {
              id: "must_haves",
              fieldKey: "mustHaves",
              label: "Requirements",
              reviewStatus: "pending",
              suggestedValue: ["Mistral requirement"],
              sourceText: "Mistral requirement",
            },
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["security guard", "loss prevention"],
              sourceText: "security guard\nloss prevention",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mistral summary")).toBeInTheDocument();
    expect(screen.getByText("Mistral requirement")).toBeInTheDocument();
    expect(screen.getAllByText(/security guard/).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/location miami status/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("At Texas Roadhouse, we are a people-first company."),
    ).not.toBeInTheDocument();

    const keywordsCard =
      screen
        .getAllByText("Keywords")
        .map((label) => label.closest(".dasti-brief-card__review-item"))
        .find((card) => card !== null) ?? null;
    expect(keywordsCard).not.toBeNull();
    const card = within(keywordsCard as HTMLElement);
    expect(keywordsCard).toHaveAttribute("data-state", "uncertain");
    expect(card.getByLabelText("Needs your review")).toHaveClass(
      "dasti-brief-card__section-status--uncertain",
    );
    expect(
      card.queryByRole("button", { name: "Keep" }),
    ).not.toBeInTheDocument();
    expect(card.queryByText("Check")).not.toBeInTheDocument();
    expect(
      card.getByRole("button", { name: "Edit Keywords" }),
    ).toBeInTheDocument();
  });

  it("marks approved review cards with validated state instead of pending warning", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Security Guard"
          jobDescription="Raw job text"
          reviewItems={[
            {
              id: "summary",
              fieldKey: "summary",
              label: "Summary",
              reviewStatus: "approved",
              suggestedValue: "Approved job summary",
              approvedValue: "Approved job summary",
              sourceText: "Approved job summary",
            },
          ]}
        />
      </MemoryRouter>,
    );

    const summaryCard = screen
      .getByText("Summary")
      .closest(".dasti-brief-card__review-item");
    expect(summaryCard).not.toBeNull();
    expect(summaryCard).toHaveAttribute("data-state", "validated");

    const card = within(summaryCard as HTMLElement);
    expect(card.getByLabelText("Validated")).toHaveClass(
      "dasti-brief-card__section-status--validated",
    );
    expect(
      card.queryByRole("button", { name: "Keep" }),
    ).not.toBeInTheDocument();
    expect(card.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("renders LLM-backed summary requirements and keywords review cards", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Host"
          jobDescription="Raw job text"
          visibleSummaryText="Host at Texas Roadhouse; greets guests."
          visibleRequirements={["Guest service", "Teamwork"]}
          visibleKeywords={["guest service", "wait management"]}
          reviewItems={[
            {
              id: "summary",
              fieldKey: "summary",
              label: "Summary",
              reviewStatus: "pending",
              suggestedValue: "Host at Texas Roadhouse; greets guests.",
              sourceText: "Host at Texas Roadhouse; greets guests.",
            },
            {
              id: "must_haves",
              fieldKey: "mustHaves",
              label: "Requirements",
              reviewStatus: "pending",
              suggestedValue: ["Guest service", "Teamwork"],
              sourceText: "Guest service\nTeamwork",
            },
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["guest service", "wait management"],
              sourceText: "guest service\nwait management",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Extracted summary")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Host at Texas Roadhouse; greets guests."),
    ).toHaveLength(1);
    expect(screen.getAllByText("Guest service").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/guest service/).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Keep" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Check")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Requirements" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Keywords" }),
    ).toBeInTheDocument();
  });

  it("renders unavailable state instead of heuristic extraction or review cards", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Host"
          jobDescription="Raw source stays visible here."
          summaryText="Heuristic summary"
          visibleSummaryText="Heuristic visible summary"
          requirements={["Heuristic requirement"]}
          visibleRequirements={["Heuristic visible requirement"]}
          keywords={["location", "status", "compensation"]}
          visibleKeywords={["location", "status", "compensation"]}
          extractionUnavailable={true}
          onSaveField={vi.fn()}
          reviewItems={[
            {
              id: "responsibilities",
              fieldKey: "responsibilities",
              label: "Responsibilities",
              reviewStatus: "pending",
              suggestedValue: [
                "At Texas Roadhouse, we are a people-first company.",
              ],
              sourceText: "At Texas Roadhouse, we are a people-first company.",
            },
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["location", "status", "compensation"],
              sourceText: "location status compensation",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("EXTRACTION. PAUSED.")).toBeInTheDocument();
    expect(screen.getByText(/Job read is out of order/i)).toBeInTheDocument();
    expect(screen.getByText(/Posting stays intact/i)).toBeInTheDocument();
    expect(screen.getByText("Imported Posting")).toBeInTheDocument();
    expect(screen.getByText("Original text stays intact.")).toBeInTheDocument();
    expect(
      screen.queryByText("Raw source stays visible here."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Posting" }));
    expect(
      screen.getByText("Raw source stays visible here."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Heuristic summary")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Heuristic visible requirement"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("location, status, compensation"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("location status compensation"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(
      screen.queryByText("At Texas Roadhouse, we are a people-first company."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Keep" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Keywords" }),
    ).not.toBeInTheDocument();
  });

  it("shows reviewable heuristic content without claiming validation", () => {
    const confirm = vi.fn();
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests and manage the queue."
          visibleSummaryText="Coordinates guest arrivals."
          visibleRequirements={["Guest service"]}
          visibleKeywords={["hospitality"]}
          trustState="needs_review"
          reviewItems={[
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["hospitality"],
              sourceText: "hospitality",
            },
          ]}
          onApproveReviewItem={confirm}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Quick check before tailoring"),
    ).toBeInTheDocument();
    expect(screen.getByText("Coordinates guest arrivals.")).toBeInTheDocument();
    expect(screen.getByText("Guest service")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Keywords" }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "keywords" }),
    );
  });

  it("keeps a rejected Confirm item pending so the user can retry", async () => {
    const confirm = vi.fn().mockRejectedValue(new Error("Approval failed"));
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests and manage the queue."
          visibleKeywords={["hospitality"]}
          trustState="needs_review"
          reviewItems={[
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["hospitality"],
              sourceText: "hospitality",
            },
          ]}
          onApproveReviewItem={confirm}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Keywords" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Keywords" }),
      ).toBeInTheDocument();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("keeps a rejected review edit open so the user can retry", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests and manage the queue."
          visibleKeywords={["hospitality"]}
          trustState="needs_review"
          reviewItems={[
            {
              id: "keywords",
              fieldKey: "keywords",
              label: "Keywords",
              reviewStatus: "pending",
              suggestedValue: ["hospitality"],
              sourceText: "hospitality",
            },
          ]}
          onSaveReviewItem={save}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Keywords" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hospitality\nguest service" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Keywords" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Keywords" }),
      ).toBeInTheDocument();
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "keywords" }),
      ["hospitality", "guest service"],
    );
  });

  it("does not apply a late Confirm completion to the next job", async () => {
    let resolveConfirm: (() => void) | undefined;
    const confirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const firstItem = {
      id: "llm_visible_keywords",
      fieldKey: "keywords",
      label: "Keywords",
      reviewStatus: "pending",
      suggestedValue: ["hospitality"],
      sourceText: "hospitality",
    };
    const { rerender } = render(
      <MemoryRouter>
        <ProposalBriefCard
          jobId="job-a"
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests."
          visibleKeywords={["hospitality"]}
          trustState="needs_review"
          reviewItems={[firstItem]}
          onApproveReviewItem={confirm}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Keywords" }));
    rerender(
      <MemoryRouter>
        <ProposalBriefCard
          jobId="job-b"
          sourceJobTitle="Retail Associate"
          jobDescription="Help customers."
          visibleKeywords={["retail"]}
          trustState="needs_review"
          reviewItems={[
            {
              ...firstItem,
              suggestedValue: ["retail"],
              sourceText: "retail",
            },
          ]}
          onApproveReviewItem={confirm}
        />
      </MemoryRouter>,
    );

    await act(async () => {
      resolveConfirm?.();
      await Promise.resolve();
    });

    expect(screen.getByText("retail")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm Keywords" }),
    ).toBeInTheDocument();
  });

  it("keeps Requirements editable after the user clears the section", () => {
    const saveField = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests."
          visibleRequirements={["Guest service"]}
          reviewItems={[]}
          onSaveField={saveField}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Requirements" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Requirements" }));
    expect(saveField).toHaveBeenCalledWith("mustHaves", []);

    rerender(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests."
          visibleRequirements={[]}
          reviewItems={[]}
          onSaveField={saveField}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Edit Requirements" }),
    ).toBeInTheDocument();
  });

  it("keeps Keywords editable after the user clears the section", () => {
    const saveField = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests."
          visibleKeywords={["hospitality"]}
          reviewItems={[]}
          onSaveField={saveField}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Keywords" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Keywords" }));
    expect(saveField).toHaveBeenCalledWith("keywords", []);

    rerender(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Welcome guests."
          visibleKeywords={[]}
          reviewItems={[]}
          onSaveField={saveField}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Edit Keywords" }),
    ).toBeInTheDocument();
  });

  it("renders each authoritative section once and prefers an approved summary edit", () => {
    render(
      <MemoryRouter>
        <ProposalBriefCard
          sourceJobTitle="Front Desk Host"
          jobDescription="Original posting"
          visibleSummaryText="Machine summary"
          visibleRequirements={["Guest service"]}
          visibleKeywords={["hospitality"]}
          reviewItems={[
            {
              id: "summary",
              fieldKey: "summary",
              label: "Summary",
              reviewStatus: "approved",
              suggestedValue: "Machine summary",
              approvedValue: "Human summary",
              sourceText: "Original source excerpt",
            },
          ]}
          onSaveReviewItem={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Summary")).toHaveLength(1);
    expect(screen.getByText("Human summary")).toBeInTheDocument();
    expect(screen.queryByText("Machine summary")).not.toBeInTheDocument();
    expect(screen.getAllByText("Requirements")).toHaveLength(1);
    expect(screen.getAllByText("Keywords")).toHaveLength(1);
  });
});
