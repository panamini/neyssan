import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildLiveMatchReviewRecord } from "../../../convex/lib/jobs/liveMatchReviewExport";
import type { JobMatchReview } from "../../../convex/lib/jobs/structuredMatchRead";
import {
  buildLiveReviewNextSteps,
  formatLiveReviewSummary,
  parseDogfoodArgs,
  runLiveMatchReviewDogfood,
} from "../liveMatchReviewDogfood";

const matchReview: JobMatchReview = {
  verdict: "possible_lead",
  score: 64,
  confidence: 0.7,
  one_liner: "Matches the user profile.",
  why_this_may_interest_you: ["Relevant title family."],
  watch_out: ["Credential unclear."],
  suggested_next_step: "apply_if_requirement_true",
  missing_or_unclear_requirements: [],
  evidence: [],
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("liveMatchReviewDogfood", () => {
  it("parses export and summary flags for the runner", () => {
    expect(
      parseDogfoodArgs([
        "--limit",
        "5",
        "--out",
        "/tmp/match-review-live.json",
        "--labeled",
        "/tmp/match-review-live-labeled.json",
        "--summary-only",
      ]),
    ).toEqual({
      limit: 5,
      outPath: "/tmp/match-review-live.json",
      labeledPath: "/tmp/match-review-live-labeled.json",
      summaryOnly: true,
    });
  });

  it("formats the next manual steps for labeling and sparse same-family tracking", () => {
    expect(buildLiveReviewNextSteps("/tmp/match-review-live-labeled.json")).toEqual([
      "Label records in /tmp/match-review-live-labeled.json using human_label and failure_types.",
      "Track sparse same-family harshness with reviewer_notes containing sparse_same_family.",
      "Summarize afterward with: rtk ./node_modules/.bin/tsx scripts/evals/run-live-match-review-dogfood.ts --summary-only --labeled /tmp/match-review-live-labeled.json",
    ]);
    expect(
      formatLiveReviewSummary({
        reviewed_count: 1,
        makes_sense_count: 1,
        makes_sense_rate: 1,
        too_harsh_count: 0,
        too_generous_count: 0,
        wrong_reason_count: 0,
        credential_wrong_count: 0,
        unsafe_or_leaky_count: 0,
        false_zero_count: 0,
        dangerous_overmatch_count: 0,
        credential_hallucination_count: 0,
        preferred_as_blocker_count: 0,
        raw_evidence_leak_count: 0,
        verdict_reason_contradiction_count: 0,
        bad_next_step_count: 0,
        no_signal_misclassified_count: 0,
        unclear_copy_count: 0,
        sparse_same_family_too_harsh_count: 0,
      }),
    ).toContain("makes_sense_rate: 1");
  });

  it("summarizes a labeled file without touching live export paths", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "match-review-dogfood-"));
    tempDirs.push(tempDir);
    const labeledPath = join(tempDir, "labeled.json");
    const records = [
      {
        ...buildLiveMatchReviewRecord({
          jobId: "job_1",
          jobTitle: "Retail Associate",
          tier: "strong",
          matchReview,
        }),
        human_label: "makes_sense" as const,
        failure_types: [],
        reviewer_notes: "",
      },
      {
        ...buildLiveMatchReviewRecord({
          jobId: "job_2",
          jobTitle: "Security Guard",
          tier: "weak",
          matchReview: { ...matchReview, verdict: "probably_skip", score: 0 },
        }),
        human_label: "too_harsh" as const,
        failure_types: ["too_harsh" as const],
        reviewer_notes: "sparse_same_family",
      },
    ];

    writeFileSync(labeledPath, `${JSON.stringify(records, null, 2)}\n`);

    const result = await runLiveMatchReviewDogfood([
      "--summary-only",
      "--labeled",
      labeledPath,
    ]);

    expect(result.kind).toBe("summary");
    if (result.kind !== "summary") {
      return;
    }

    expect(result.labeledPath).toBe(labeledPath);
    expect(result.summary).toMatchObject({
      reviewed_count: 2,
      makes_sense_count: 1,
      too_harsh_count: 1,
      sparse_same_family_too_harsh_count: 1,
    });
  });
});
