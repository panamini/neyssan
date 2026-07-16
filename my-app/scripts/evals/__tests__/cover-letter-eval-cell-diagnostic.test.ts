import { describe, expect, it } from "vitest";

import { buildCoverLetterEvalCellDiagnostic } from "../cover-letter-eval-cell-diagnostic";

const sendability = {
  version: "cover_letter_final_sendability_result_v1" as const,
  inputScope: "final_visible_artifact_only" as const,
  verdict: "HARD_BLOCKED" as const,
  hardIssues: ["visible_structure_loss_signature" as const],
  reviewIssues: ["generic_closing" as const],
  stats: {
    wordCount: 84,
    paragraphCount: 5,
    bodyWordCount: 72,
    bodyParagraphCount: 3,
    substantiveBodyParagraphCount: 2,
    hasGenericConclusion: true,
    hasStandaloneEmployerBridge: false,
  },
  contentHash: "a".repeat(64),
};

describe("cover-letter eval cell diagnostics", () => {
  it("keeps evidence availability separate from the pipeline outcome", () => {
    const diagnostic = buildCoverLetterEvalCellDiagnostic({
      expectedContextClass: "no_cv",
      outcome: "safety_veto",
      sendability: null,
      failureReceipt: {
        status: "finalization_failed",
        diagnostics: {
          errorClass: "insufficient_candidate_evidence",
          failureStage: "finalization",
          failureIssues: ["candidate_evidence_missing"],
        },
      },
    });

    expect(diagnostic).toMatchObject({
      evidenceAvailability: "candidate_evidence_absent",
      pipelineOutcome: "safety_veto",
      outputAssessment: "not_available_due_to_safety",
      sendability: null,
      failure: {
        status: "finalization_failed",
        errorClass: "insufficient_candidate_evidence",
        failureStage: "finalization",
        failureIssues: ["candidate_evidence_missing"],
      },
    });
  });

  it("retains reviewer-safe editorial diagnostics for a grounded letter", () => {
    const diagnostic = buildCoverLetterEvalCellDiagnostic({
      expectedContextClass: "cv_direct",
      outcome: "editorial_veto",
      sendability,
      failureReceipt: null,
    });

    expect(diagnostic).toMatchObject({
      evidenceAvailability: "candidate_evidence_present",
      pipelineOutcome: "editorial_veto",
      outputAssessment: "editorial_hard_block",
      sendability: {
        verdict: "HARD_BLOCKED",
        hardIssues: ["visible_structure_loss_signature"],
        reviewIssues: ["generic_closing"],
      },
      failure: null,
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /finalContent|bodyParts|letterContent|rawOutput/u,
    );
  });

  it("rejects inconsistent outcome diagnostics", () => {
    expect(() =>
      buildCoverLetterEvalCellDiagnostic({
        expectedContextClass: "cv_adjacent",
        outcome: "editorial_veto",
        sendability: { ...sendability, verdict: "REVIEW_REQUIRED" },
        failureReceipt: null,
      }),
    ).toThrow(/editorial_veto requires HARD_BLOCKED/u);

    expect(() =>
      buildCoverLetterEvalCellDiagnostic({
        expectedContextClass: "cv_adjacent",
        outcome: "safety_veto",
        sendability: null,
        failureReceipt: null,
      }),
    ).toThrow(/safety_veto requires a failure receipt/u);
  });

  it("redacts non-allowlisted failure text", () => {
    const diagnostic = buildCoverLetterEvalCellDiagnostic({
      expectedContextClass: "no_cv",
      outcome: "safety_veto",
      sendability: null,
      failureReceipt: {
        status: "finalization_failed",
        diagnostics: {
          errorClass: "candidate@example.com",
          failureStage: "private-stage",
          failureIssues: ["private-candidate-name"],
        },
      },
    });

    expect(diagnostic.failure).toEqual({
      status: "finalization_failed",
      errorClass: "redacted",
      failureStage: "redacted",
      failureIssues: ["redacted"],
    });
    expect(JSON.stringify(diagnostic)).not.toContain("candidate@example.com");
  });
});
