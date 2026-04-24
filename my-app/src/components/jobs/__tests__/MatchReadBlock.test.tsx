import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchReadBlock } from "../MatchReadBlock";

type MatchReadProps = React.ComponentProps<typeof MatchReadBlock>["matchRead"];

function buildMatchRead(overrides: Partial<MatchReadProps> = {}): MatchReadProps {
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
    method: "keyword-overlap",
    fallback: "none",
    ...overrides,
  };
}

describe("MatchReadBlock", () => {
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
    expect(screen.getByText("Strong · 100%")).toBeInTheDocument();
    expect(screen.getByText("Matched")).toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).toBeNull();
    expect(screen.queryByText("Airtable")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Match" }));
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
    expect(
      screen.queryByText("Complete your profile to see match"),
    ).toBeNull();
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

  it("shows weak overlap as a scored match, not as empty profile data", () => {
    render(
      <MatchReadBlock
        matchRead={buildMatchRead({
          tier: "weak",
          score: 0,
          scoreVisible: true,
          matched: [],
          missing: ["Airtable", "Program management"],
        })}
      />,
    );

    expect(screen.queryByText("No scoring profile data available")).toBeNull();
    expect(screen.queryByText("No resume signal")).toBeNull();
    expect(screen.queryByText("Resume too thin")).toBeNull();
    expect(screen.getByText("Weak · 0%")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Missing 2" }),
    );
    expect(screen.getByText("Program management")).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("button", { name: "Missing 1" }),
    );
    expect(screen.getAllByText("Missing").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Customer-facing experience"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Miami")).toBeNull();
    expect(screen.queryByText("Compensation")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("Equal opportunity employer")).toBeNull();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
  });
});
