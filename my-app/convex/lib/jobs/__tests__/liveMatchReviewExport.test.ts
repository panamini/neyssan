import { describe, expect, it } from "vitest";

import {
  buildLiveMatchReviewRecord,
  summarizeLiveMatchReviewRecords,
  type LiveMatchReviewRecord,
} from "../liveMatchReviewExport";
import type { JobMatchReview } from "../structuredMatchRead";

const matchReview: JobMatchReview = {
  verdict: "possible_lead",
  score: 67,
  confidence: 0.72,
  one_liner:
    "Partial match for alex@example.com +1 (415) 555-2671 123e4567-e89b-12d3-a456-426614174000.",
  why_this_may_interest_you: [
    "Customer service overlaps.",
    "Report writing overlaps.",
    "raw resume paragraph should not survive.",
  ],
  watch_out: ["Guard card/license unclear."],
  suggested_next_step: "apply_if_requirement_true",
  missing_or_unclear_requirements: [
    {
      requirement: "guard card/license preferred",
      severity: "unclear",
      reason: "Credential is preferred but not explicit.",
    },
  ],
  evidence: [
    {
      job_signal: "customer service",
      profile_signal: "Full CV body should not be exported.",
      explanation: "Used only by internal scorer.",
    },
  ],
};

describe("live match review export", () => {
  it("projects safe human-review records with matchReview fields and blank labels", () => {
    const record = buildLiveMatchReviewRecord({
      jobId: "job_live_1",
      jobTitle: "Security Guard",
      company: "Northwind",
      profileLabel: "Default Resume",
      tier: "partial",
      matchReview,
      visibleRequirements: [
        "Customer service",
        "Report writing",
        "rawDescription source blob should not survive.",
      ],
      hardGateMissingCount: 0,
    });

    expect(record).toMatchObject({
      jobId: "job_live_1",
      jobTitle: "Security Guard",
      company: "Northwind",
      profileLabel: "Default Resume",
      tier: "partial",
      verdict: "possible_lead",
      score: 67,
      suggested_next_step: "apply_if_requirement_true",
      hard_gate_status: "none",
      human_label: null,
      failure_types: [],
      reviewer_notes: "",
    });
    expect(record.why_this_may_interest_you).toHaveLength(3);
    expect(record.watch_out).toEqual(["Guard card/license unclear."]);
    expect(record.visible_requirements_summary).toEqual([
      "Customer service",
      "Report writing",
      "[redacted] [redacted] should not survive.",
    ]);
  });

  it("redacts email phone UUID and raw source markers from visible fields", () => {
    const record = buildLiveMatchReviewRecord({
      jobId: "job_live_2",
      jobTitle:
        "Ops role alex@example.com +1 (415) 555-2671 123e4567-e89b-12d3-a456-426614174000",
      company: "raw_text employer",
      profileLabel: "full resume default",
      tier: "strong",
      matchReview,
      visibleRequirements: ["source blob requirement"],
      hardGateMissingCount: 1,
    });

    const serialized = JSON.stringify(record);

    expect(serialized).not.toContain("alex@example.com");
    expect(serialized).not.toContain("555-2671");
    expect(serialized).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(serialized).not.toMatch(/raw_text|rawDescription|full resume|raw resume/i);
    expect(record.hard_gate_status).toBe("present");
  });

  it("summarizes labeled review records into KPI counters", () => {
    const reviewed: LiveMatchReviewRecord[] = [
      {
        ...buildLiveMatchReviewRecord({
          jobId: "job_1",
          jobTitle: "Retail Associate",
          tier: "strong",
          matchReview,
        }),
        human_label: "makes_sense",
      },
      {
        ...buildLiveMatchReviewRecord({
          jobId: "job_2",
          jobTitle: "Frontend Engineer",
          tier: "weak",
          matchReview: { ...matchReview, verdict: "probably_skip", score: 0 },
        }),
        human_label: "too_harsh",
        failure_types: ["false_zero", "too_harsh", "bad_next_step"],
        reviewer_notes: "sparse_same_family: title family looked plausible.",
      },
    ];

    expect(summarizeLiveMatchReviewRecords(reviewed)).toEqual({
      reviewed_count: 2,
      makes_sense_count: 1,
      makes_sense_rate: 0.5,
      too_harsh_count: 1,
      too_generous_count: 0,
      wrong_reason_count: 0,
      credential_wrong_count: 0,
      unsafe_or_leaky_count: 0,
      false_zero_count: 1,
      dangerous_overmatch_count: 0,
      credential_hallucination_count: 0,
      preferred_as_blocker_count: 0,
      raw_evidence_leak_count: 0,
      verdict_reason_contradiction_count: 0,
      bad_next_step_count: 1,
      no_signal_misclassified_count: 0,
      unclear_copy_count: 0,
      sparse_same_family_too_harsh_count: 1,
    });
  });
});
