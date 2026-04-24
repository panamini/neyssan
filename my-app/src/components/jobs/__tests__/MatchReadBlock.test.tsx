import React from "react";
import { render, screen } from "@testing-library/react";
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

    expect(
      screen.getByText("No scoring profile data available"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The attached resume is available, but it has no usable skills or keywords for match scoring yet.",
      ),
    ).toBeInTheDocument();
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

    expect(screen.getByText("Insufficient profile data")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The attached resume only has placeholder or minimal content, so match scoring is not reliable yet.",
      ),
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
    expect(screen.queryByText("Insufficient profile data")).toBeNull();
    expect(screen.getByText("Weak · 0%")).toBeInTheDocument();
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

    expect(screen.getByText("Missing")).toBeInTheDocument();
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
