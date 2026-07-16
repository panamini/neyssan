import type { PremiumCoverLetterContextClass } from "../../convex/lib/proposals/premiumCoverLetter";
import type { CoverLetterFinalSendabilityResult } from "./cover-letter-final-sendability-shadow";

export type CoverLetterEvalCellOutcome =
  | "human_review_pending"
  | "safety_veto"
  | "editorial_veto";

export type CoverLetterEvalCellDiagnostic = Readonly<{
  version: "cover_letter_eval_cell_diagnostic_v1";
  evidenceAvailability:
    | "candidate_evidence_present"
    | "candidate_evidence_absent";
  pipelineOutcome: CoverLetterEvalCellOutcome;
  outputAssessment:
    | "reviewable"
    | "not_available_due_to_safety"
    | "editorial_hard_block";
  sendability: CoverLetterFinalSendabilityResult | null;
  failure: Readonly<{
    status: "finalization_failed";
    errorClass: string;
    failureStage: string | null;
    failureIssues: readonly string[];
  }> | null;
}>;

const ALLOWED_ERROR_CLASSES = new Set([
  "proposal_finalization_error",
  "insufficient_candidate_evidence",
  "error",
  "unknown_error",
]);
const ALLOWED_FAILURE_STAGES = new Set([
  "cleaned_body_selection",
  "substantive_body_assertion",
  "finalization",
  "validation",
]);
const ALLOWED_FAILURE_ISSUES = new Set([
  "adjacent_direct_fit",
  "candidate_backed_evidence_missing",
  "candidate_evidence_missing",
  "candidate_name_mismatch",
  "factual_inventory",
  "generic_tone",
  "greeting_leakage",
  "non_repairable_validation",
  "weak_employer_argument",
]);

function allowlistedDiagnosticToken(
  value: unknown,
  allowlist: ReadonlySet<string>,
): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return allowlist.has(normalized) ? normalized : "redacted";
}

function optionalAllowlistedDiagnosticToken(
  value: unknown,
  allowlist: ReadonlySet<string>,
): string | null {
  return value === null || value === undefined
    ? null
    : allowlistedDiagnosticToken(value, allowlist);
}

function failureDiagnostic(
  failureReceipt: unknown,
): NonNullable<CoverLetterEvalCellDiagnostic["failure"]> {
  const receipt =
    typeof failureReceipt === "object" && failureReceipt !== null
      ? (failureReceipt as Readonly<Record<string, unknown>>)
      : {};
  const diagnostics =
    typeof receipt.diagnostics === "object" && receipt.diagnostics !== null
      ? (receipt.diagnostics as Readonly<Record<string, unknown>>)
      : {};
  const failureIssues = Array.isArray(diagnostics.failureIssues)
    ? diagnostics.failureIssues.map((issue) =>
        allowlistedDiagnosticToken(issue, ALLOWED_FAILURE_ISSUES),
      )
    : [];
  return {
    status: "finalization_failed",
    errorClass: allowlistedDiagnosticToken(
      diagnostics.errorClass,
      ALLOWED_ERROR_CLASSES,
    ),
    failureStage: optionalAllowlistedDiagnosticToken(
      diagnostics.failureStage,
      ALLOWED_FAILURE_STAGES,
    ),
    failureIssues,
  };
}

export function buildCoverLetterEvalCellDiagnostic(args: {
  expectedContextClass: PremiumCoverLetterContextClass;
  outcome: CoverLetterEvalCellOutcome;
  sendability: CoverLetterFinalSendabilityResult | null;
  failureReceipt: unknown | null;
}): CoverLetterEvalCellDiagnostic {
  if (args.outcome === "safety_veto") {
    if (args.sendability !== null) {
      throw new Error("safety_veto cannot include sendability output.");
    }
    if (!args.failureReceipt) {
      throw new Error("safety_veto requires a failure receipt.");
    }
    if (
      typeof args.failureReceipt !== "object" ||
      args.failureReceipt === null ||
      !("status" in args.failureReceipt) ||
      args.failureReceipt.status !== "finalization_failed"
    ) {
      throw new Error("safety_veto requires a finalization_failed receipt.");
    }
  } else {
    if (!args.sendability) {
      throw new Error(`${args.outcome} requires sendability output.`);
    }
    if (args.failureReceipt) {
      throw new Error(`${args.outcome} cannot include a failure receipt.`);
    }
  }
  if (
    args.outcome === "editorial_veto" &&
    args.sendability?.verdict !== "HARD_BLOCKED"
  ) {
    throw new Error("editorial_veto requires HARD_BLOCKED sendability.");
  }
  if (
    args.outcome === "human_review_pending" &&
    args.sendability?.verdict === "HARD_BLOCKED"
  ) {
    throw new Error(
      "human_review_pending cannot include HARD_BLOCKED sendability.",
    );
  }

  return {
    version: "cover_letter_eval_cell_diagnostic_v1",
    evidenceAvailability:
      args.expectedContextClass === "no_cv"
        ? "candidate_evidence_absent"
        : "candidate_evidence_present",
    pipelineOutcome: args.outcome,
    outputAssessment:
      args.outcome === "safety_veto"
        ? "not_available_due_to_safety"
        : args.outcome === "editorial_veto"
          ? "editorial_hard_block"
          : "reviewable",
    sendability: args.sendability,
    failure: args.failureReceipt
      ? failureDiagnostic(args.failureReceipt)
      : null,
  };
}
