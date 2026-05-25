import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchReadBlock } from "../MatchReadBlock";
import { resolveVisibleJobVerdict } from "../../../lib/jobs/visibleJobVerdict";

type MatchReadProps = React.ComponentProps<typeof MatchReadBlock>["matchRead"];
type MatchReviewProps = NonNullable<
  React.ComponentProps<typeof MatchReadBlock>["matchReview"]
>;

function buildMatchRead(
  overrides: Partial<MatchReadProps> = {},
): MatchReadProps {
  return {
    tier: "partial",
    score: 50,
    scoreVisible: true,
    confidence: "medium",
    matched: ["Airtable"],
    missing: ["Program management"],
    basedOn: {
      profileId: "cv_attached",
      profileLabel: "Your profile",
      jobId: "job_1",
    },
    computedAt: 1234,
    method: "llm",
    fallback: "none",
    ...overrides,
  };
}

function buildMatchReview(
  overrides: Partial<MatchReviewProps> = {},
): MatchReviewProps {
  return {
    verdict: "possible_lead",
    score: 68,
    confidence: 0.65,
    one_liner: "Partial match. A few checks left.",
    why_this_may_interest_you: [
      "Operations overlaps.",
      "Customer-facing work is relevant.",
      "Report writing overlaps.",
    ],
    watch_out: [
      "Guard card/license unclear.",
      "Weekend availability is a check.",
    ],
    suggested_next_step: "apply",
    missing_or_unclear_requirements: [],
    evidence: [],
    ...overrides,
  };
}

describe("MatchReadBlock", () => {
  it("resolves visible verdicts from review, then matchRead, then matchTier", () => {
    expect(
      resolveVisibleJobVerdict({
        matchReview: { verdict: "possible_lead", score: 68 },
        matchRead: { tier: "weak" },
        matchTier: "weak",
      }),
    ).toMatchObject({
      key: "worth_a_shot",
      label: "Worth a shot",
      tone: "worth",
    });
    expect(
      resolveVisibleJobVerdict({
        matchReview: null,
        matchRead: { tier: "weak" },
        matchTier: "partial",
      }),
    ).toMatchObject({
      key: "probably_skip",
      label: "Probably skip",
      tone: "skip",
    });
    expect(
      resolveVisibleJobVerdict({
        matchReview: null,
        matchRead: null,
        matchTier: "partial",
      }),
    ).toMatchObject({
      key: "worth_a_shot",
      label: "Worth a shot",
      tone: "worth",
    });
  });

  it("does not show the empty-profile message when attached resume scoring data exists", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead({
          tier: "strong",
          score: 100,
          matched: ["Airtable", "Program management"],
          missing: [],
        })}
      />,
    );

    expect(screen.queryByText("No scoring profile data available")).toBeNull();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).toBeNull();
    expect(screen.queryByText("Airtable")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See full breakdown" }));
    expect(screen.getByText("Airtable")).toBeInTheDocument();
    expect(screen.getByText("Program management")).toBeInTheDocument();
  });

  it("shows a scoring-data state when an attached resume resolves to empty profile input", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead({
          tier: "unknown",
          score: null,
          scoreVisible: false,
          matched: [],
          missing: ["Airtable", "Program management"],
          fallback: "profile_missing",
        })}
      />,
    );

    expect(screen.getByText("No resume signal")).toBeInTheDocument();
    expect(screen.getByText("Resume has no keywords yet.")).toBeInTheDocument();
    expect(screen.queryByText("Complete your profile to see match")).toBeNull();
  });

  it("shows a separate insufficient-profile state for placeholder resume input", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead({
          tier: "unknown",
          score: null,
          scoreVisible: false,
          matched: [],
          missing: ["Retail design"],
          fallback: "profile_insufficient",
        })}
      />,
    );

    expect(screen.getByText("Resume too thin")).toBeInTheDocument();
    expect(
      screen.getByText("Add summary, skills, or experience."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No scoring profile data available")).toBeNull();
  });

  it("does not render legacy keyword-overlap zero as a real match", () => {
    const onRefreshMatch = vi.fn();

    render(
      <MatchReadBlock
        onRefreshMatch={onRefreshMatch}
        matchRead={buildMatchRead({
          tier: "weak",
          score: 0,
          scoreVisible: true,
          matched: [],
          missing: ["Airtable", "Program management"],
          method: "keyword-overlap",
        })}
      />,
    );

    expect(screen.queryByText("No scoring profile data available")).toBeNull();
    expect(screen.queryByText("No resume signal")).toBeNull();
    expect(screen.queryByText("Resume too thin")).toBeNull();
    expect(screen.queryByText("Weak · 0%")).toBeNull();
    expect(screen.getByText("Match pending")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh match" }));
    expect(onRefreshMatch).toHaveBeenCalledTimes(1);
  });

  it("cleans visible missing requirements and hides junk tokens", () => {
    render(
      <MatchReadBlock
        visibleRequirements={["Customer-facing experience"]}
        jobCompany="Acme"
        jobLocation="Miami"
        matchRead={buildMatchRead({
          tier: "partial",
          score: 50,
          matched: ["Airtable"],
          missing: [
            "Miami",
            "Compensation",
            "Acme",
            "Equal opportunity employer",
            "Customer-facing experience",
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "See full breakdown" }));
    expect(screen.getAllByText("Missing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Customer-facing experience")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/Miami · match/)).toBeInTheDocument();
    expect(screen.queryByText("Compensation")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("Equal opportunity employer")).toBeNull();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
  });

  it("renders a compact match review panel when the backend projection provides one", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead()}
        matchReview={buildMatchReview()}
      />,
    );

    expect(
      screen.getByText("Partial match. A few checks left."),
    ).toBeInTheDocument();
    expect(screen.getByText("Operations overlaps.")).toBeInTheDocument();
    expect(screen.getByText(/Guard card\/license unclear/)).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
    expect(screen.getByText("Gaps")).toBeInTheDocument();
    expect(screen.queryByText("Location")).toBeNull();
    expect(screen.queryByText("Gap")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("Possible lead · 68%")).toBeNull();
    expect(screen.queryByText("Partial · 50%")).toBeNull();
  });

  it("renders single match review notes as paragraphs instead of lists", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead()}
        matchReview={buildMatchReview({
          why_this_may_interest_you: ["Operations overlap."],
          watch_out: ["License unclear."],
        })}
      />,
    );

    expect(screen.getByText("Operations overlap.").tagName).toBe("SPAN");
    expect(screen.getByText(/License unclear/).tagName).toBe("SPAN");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("falls back to matchRead when a review is probably skip with no score", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead()}
        matchReview={buildMatchReview({
          verdict: "probably_skip",
          score: 0,
          one_liner: "Probably skip: little overlap shows up.",
          why_this_may_interest_you: [],
          watch_out: [],
          suggested_next_step: "skip",
        })}
      />,
    );

    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText("Probably skip · 0%")).toBeNull();
    expect(screen.queryByText("Operations overlaps.")).toBeNull();
  });

  it("keeps probably skip verdict copy decisive and leaves nuance below", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead({
          tier: "weak",
          matched: [],
          missing: ["Program management"],
        })}
        matchReview={buildMatchReview({
          verdict: "probably_skip",
          score: 18,
          one_liner: "Weak match. Limited overlap.",
          why_this_may_interest_you: [],
          watch_out: ["Limited overlap."],
          suggested_next_step: "review_manually",
        })}
      />,
    );

    expect(
      screen.getByText("Weak match. Limited overlap."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Probably skip — review.")).toBeNull();
    expect(screen.queryByText("Probably skip.")).toBeNull();
  });
});
