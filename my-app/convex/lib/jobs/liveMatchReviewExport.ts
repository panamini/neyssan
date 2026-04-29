import type { JobMatchReview, JobMatchReviewVerdict } from "./structuredMatchRead";
import type { MatchReadTier } from "./matchRead";

export type HumanReviewLabel =
  | "makes_sense"
  | "too_harsh"
  | "too_generous"
  | "wrong_reason"
  | "credential_wrong"
  | "unsafe_or_leaky"
  | "not_enough_signal_correct"
  | "not_enough_signal_wrong";

export type MatchReviewFailureType =
  | "false_zero"
  | "dangerous_overmatch"
  | "credential_hallucination"
  | "preferred_as_blocker"
  | "generic_fragment_leak"
  | "raw_evidence_leak"
  | "verdict_reason_contradiction"
  | "bad_next_step"
  | "no_signal_misclassified"
  | "too_harsh"
  | "too_generous"
  | "unclear_copy";

export type LiveMatchReviewRecord = {
  jobId: string;
  jobTitle: string;
  company: string | null;
  profileLabel: string | null;
  tier: MatchReadTier;
  verdict: JobMatchReviewVerdict;
  score: number | null;
  one_liner: string | null;
  why_this_may_interest_you: string[];
  watch_out: string[];
  suggested_next_step: string | null;
  visible_requirements_summary: string[];
  hard_gate_status: "present" | "none" | "unknown";
  human_label: HumanReviewLabel | null;
  failure_types: MatchReviewFailureType[];
  reviewer_notes: string;
};

const MAX_SHORT_TEXT_CHARS = 140;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const PHONE_RE =
  /(?:\+?\d[\d\s().-]{7,}\d|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)/g;
const RAW_SOURCE_BLOB_RE =
  /\b(raw resume|raw cv|raw_text|rawDescription|source blob|full cv|full resume)\b/gi;

export function sanitizeLiveReviewText(value: unknown): string {
  return String(value ?? "")
    .replace(EMAIL_RE, "[redacted]")
    .replace(UUID_RE, "[redacted]")
    .replace(PHONE_RE, "[redacted]")
    .replace(RAW_SOURCE_BLOB_RE, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SHORT_TEXT_CHARS);
}

function sanitizeList(values: unknown[], limit: number, maxItemLength = MAX_SHORT_TEXT_CHARS) {
  return values
    .map((value) => sanitizeLiveReviewText(value).slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, limit);
}

export function buildLiveMatchReviewRecord(args: {
  jobId: string;
  jobTitle: string;
  company?: string | null;
  profileLabel?: string | null;
  tier: MatchReadTier;
  matchReview: JobMatchReview | null;
  visibleRequirements?: string[];
  hardGateMissingCount?: number | null;
}): LiveMatchReviewRecord {
  const review = args.matchReview;

  return {
    jobId: String(args.jobId),
    jobTitle: sanitizeLiveReviewText(args.jobTitle),
    company: args.company ? sanitizeLiveReviewText(args.company) : null,
    profileLabel: args.profileLabel ? sanitizeLiveReviewText(args.profileLabel) : null,
    tier: args.tier,
    verdict: review?.verdict ?? "not_enough_signal",
    score: typeof review?.score === "number" ? review.score : null,
    one_liner: review?.one_liner ? sanitizeLiveReviewText(review.one_liner) : null,
    why_this_may_interest_you: sanitizeList(
      review?.why_this_may_interest_you ?? [],
      3,
      80,
    ),
    watch_out: sanitizeList(review?.watch_out ?? [], 2, 100),
    suggested_next_step: review?.suggested_next_step
      ? sanitizeLiveReviewText(review.suggested_next_step)
      : null,
    visible_requirements_summary: sanitizeList(args.visibleRequirements ?? [], 5, 100),
    hard_gate_status:
      typeof args.hardGateMissingCount === "number"
        ? args.hardGateMissingCount > 0
          ? "present"
          : "none"
        : "unknown",
    human_label: null,
    failure_types: [],
    reviewer_notes: "",
  };
}

export function summarizeLiveMatchReviewRecords(records: LiveMatchReviewRecord[]) {
  const reviewed = records.filter((record) => record.human_label !== null);
  const countFailure = (failureType: MatchReviewFailureType) =>
    reviewed.filter((record) => record.failure_types.includes(failureType)).length;
  const countLabel = (label: HumanReviewLabel) =>
    reviewed.filter((record) => record.human_label === label).length;
  const makesSenseCount = reviewed.filter(
    (record) =>
      record.human_label === "makes_sense" ||
      record.human_label === "not_enough_signal_correct",
  ).length;
  const sparseSameFamilyTooHarshCount = reviewed.filter((record) => {
    const notes = record.reviewer_notes.toLowerCase();
    return (
      notes.includes("sparse_same_family") &&
      (record.human_label === "too_harsh" ||
        record.failure_types.includes("too_harsh"))
    );
  }).length;

  return {
    reviewed_count: reviewed.length,
    makes_sense_count: makesSenseCount,
    makes_sense_rate: reviewed.length > 0 ? makesSenseCount / reviewed.length : null,
    too_harsh_count: countLabel("too_harsh"),
    too_generous_count: countLabel("too_generous"),
    wrong_reason_count: countLabel("wrong_reason"),
    credential_wrong_count: countLabel("credential_wrong"),
    unsafe_or_leaky_count: countLabel("unsafe_or_leaky"),
    false_zero_count: countFailure("false_zero"),
    dangerous_overmatch_count: countFailure("dangerous_overmatch"),
    credential_hallucination_count: countFailure("credential_hallucination"),
    preferred_as_blocker_count: countFailure("preferred_as_blocker"),
    raw_evidence_leak_count: countFailure("raw_evidence_leak"),
    verdict_reason_contradiction_count: countFailure(
      "verdict_reason_contradiction",
    ),
    bad_next_step_count: countFailure("bad_next_step"),
    no_signal_misclassified_count: countFailure("no_signal_misclassified"),
    unclear_copy_count: countFailure("unclear_copy"),
    sparse_same_family_too_harsh_count: sparseSameFamilyTooHarshCount,
  };
}
