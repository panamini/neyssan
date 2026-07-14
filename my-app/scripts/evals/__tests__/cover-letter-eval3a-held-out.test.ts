import { execFileSync } from "node:child_process";
import { lstat, mkdtemp, readFile, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  CoverLetterBlindReviewPack,
  CoverLetterBlindReviewRevealMap,
} from "../cover-letter-blind-review";
import type { CoverLetterHumanReviewResult } from "../benchmark-cover-letter-writers";
import {
  QUALITY_EVAL3A_COHORT_ID,
  QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
  QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
  QUALITY_EVAL3A_LIVE_MAX_USD,
  QUALITY_EVAL3A_WRITER_MODELS,
  assertCoverLetterEval3aFinalizationDiagnosticLiveGate,
  assertCoverLetterEval3aLiveGate,
  buildCoverLetterEval3aFinalizationDiagnosticApprovalPhrase,
  buildCoverLetterEval3aFinalizationDiagnosticPlan,
  buildCoverLetterEval3aPlan,
  getCoverLetterEval3aHeldOutCases,
  runCoverLetterEval3aHeldOut,
  writeCoverLetterEval3aPrivateArtifacts,
} from "../cover-letter-eval3a-held-out";

type InjectedDiagnosticRecord = {
  status: "finalization_failed" | "human_review_pending";
  caseId: string;
  writerModel: "gpt-5.5";
  error?: string;
  generation: { content: string };
  artifact: {
    artifactHash: string;
    diagnostics: {
      finalization: {
        acceptanceMode: string;
        errorClass: "proposal_finalization_error" | "none";
        failureStage: "substantive_body_assertion" | null;
        selectedBodyCandidate: "conservative";
        substantiveBodyPassed: boolean;
        removedBridgeSentenceCount: number;
        removedLastGroundedSentence: boolean;
      };
    };
  };
  debug: { rawGeneratedBody: string };
  letter: string;
};

function asHumanReviewResult(
  record: InjectedDiagnosticRecord,
): CoverLetterHumanReviewResult {
  return record as unknown as CoverLetterHumanReviewResult;
}

async function runInjectedFinalizationDiagnostic(args: {
  status: InjectedDiagnosticRecord["status"];
  runSuffix: string;
}) {
  const root = await mkdtemp(path.join(tmpdir(), "eval3a-one-cell-"));
  const outputDirectory = path.join(root, "output");
  const plan = await buildCoverLetterEval3aFinalizationDiagnosticPlan();
  const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const runId = `quality-eval-3a-finalization-diagnostic-${args.runSuffix}`;
  const approvalPhrase =
    buildCoverLetterEval3aFinalizationDiagnosticApprovalPhrase({
      sourceRef,
      planHash: plan.planHash,
      runId,
    });
  const rawProviderSentinel = "RAW_DIAGNOSTIC_OUTPUT_MUST_NOT_BE_SERIALIZED";
  const originalLiveOptIn = process.env.COVER_LETTER_EVAL_LIVE;
  process.env.COVER_LETTER_EVAL_LIVE = "1";
  let generatedRecordCount = 0;

  try {
    const result = await runCoverLetterEval3aHeldOut({
      mode: plan.runMode,
      approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: plan.plannedProviderCalls,
      maxRepairs: plan.maxRepairs,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory,
      runId,
      sourceRef,
      apiKey: "offline-injected-record",
      generateRecord: async ({ benchmarkCase, writerModel, budget }) => {
        generatedRecordCount += 1;
        expect(benchmarkCase.id).toBe("blind-fr-customer-success-direct");
        expect(writerModel).toBe("gpt-5.5");
        return budget.beginWriterAttempt().runProviderCall(async () =>
          asHumanReviewResult({
            status: args.status,
            caseId: benchmarkCase.id,
            writerModel,
            ...(args.status === "finalization_failed"
              ? {
                  error:
                    "Production cover-letter finalization rejected the generated artifact (proposal_finalization_error).",
                }
              : {}),
            generation: { content: rawProviderSentinel },
            artifact: {
              artifactHash: "d".repeat(64),
              diagnostics: {
                finalization: {
                  acceptanceMode: "strict",
                  errorClass:
                    args.status === "finalization_failed"
                      ? "proposal_finalization_error"
                      : "none",
                  failureStage:
                    args.status === "finalization_failed"
                      ? "substantive_body_assertion"
                      : null,
                  selectedBodyCandidate: "conservative",
                  substantiveBodyPassed: args.status === "human_review_pending",
                  removedBridgeSentenceCount: 1,
                  removedLastGroundedSentence: false,
                },
              },
            },
            debug: { rawGeneratedBody: rawProviderSentinel },
            letter: rawProviderSentinel,
          }),
        );
      },
    });
    const ledgerPath = path.join(
      outputDirectory,
      "private-evidence",
      "eval3a-run-failure.json",
    );
    const serializedLedger = await readFile(ledgerPath, "utf8");
    expect(serializedLedger).not.toContain(rawProviderSentinel);
    expect(serializedLedger).not.toMatch(
      /"(?:generation|letter|debug|rawGeneratedBody|prompt)"/u,
    );
    for (const filePath of [
      path.join(outputDirectory, "private-review", "blind-review-pack.json"),
      path.join(
        outputDirectory,
        "private-reveal",
        "blind-review-reveal-map.json",
      ),
    ]) {
      await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    }
    return {
      result,
      generatedRecordCount,
      ledger: JSON.parse(serializedLedger),
    };
  } finally {
    if (originalLiveOptIn === undefined) {
      delete process.env.COVER_LETTER_EVAL_LIVE;
    } else {
      process.env.COVER_LETTER_EVAL_LIVE = originalLiveOptIn;
    }
  }
}

describe("QUALITY-EVAL-3A held-out contract", () => {
  it("uses the exact five non-development cases and two frozen writer models", () => {
    const cases = getCoverLetterEval3aHeldOutCases();
    expect(cases.map((benchmarkCase) => benchmarkCase.id)).toEqual(
      QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
    );
    expect(
      cases.every(
        (benchmarkCase) =>
          benchmarkCase.reviewMetadata?.cohortId === QUALITY_EVAL3A_COHORT_ID,
      ),
    ).toBe(true);
    expect(
      QUALITY_EVAL3A_HELD_OUT_CASE_IDS.some((caseId) =>
        QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS.includes(caseId),
      ),
    ).toBe(false);
    expect(QUALITY_EVAL3A_WRITER_MODELS).toEqual(["gpt-5.5", "gpt-5.6-sol"]);
  });

  it("computes the exact offline call and conservative cost contract", async () => {
    const plan = await buildCoverLetterEval3aPlan();

    expect(plan.version).toBe("cover_letter_eval3a_plan_v2");
    expect(plan.status).toBe("READY_FOR_APPROVAL");
    expect(plan.plannedProviderCalls).toBe(10);
    expect(plan.providerMaxRetries).toBe(0);
    expect(plan.maxRepairs).toBe(0);
    expect(plan.llmEvaluator).toBe("none");
    expect(plan.budget.maxUsd).toBe(QUALITY_EVAL3A_LIVE_MAX_USD);
    expect(plan.budget.minimumSafeReservationUsd).toBeLessThanOrEqual(
      QUALITY_EVAL3A_LIVE_MAX_USD,
    );
    expect(plan.approvalPhrase).toContain("10 appels provider maximum");
    expect(plan.approvalPhrase).toContain("budget USD 2.00");
    expect(plan.approvalPhrase).toContain(plan.planHash);
    expect(plan.approvalPhraseVersion).toBe(
      "quality_eval3a_approval_phrase_v2",
    );
    expect(plan.verdictContract).toEqual({
      version: "cover_letter_eval3a_human_verdict_v1",
      positiveRequires: [
        "zero_candidate_safety_veto_failures",
        "candidate_primary_pass_total_strictly_exceeds_control",
        "candidate_commercial_acceptability_passes_not_below_control",
      ],
      tieOrIncompleteOutcome: "NOT_POSITIVE",
      productionActivation: "OUT_OF_SCOPE",
    });
    expect(plan.planHash).toBe(
      "3e6881e9c3a9430f919f4fa2d66485e7e97030a32c03b652eb3d505ea4ac38e2",
    );
  });

  it("rejects live execution unless every approval and budget field is exact", async () => {
    const plan = await buildCoverLetterEval3aPlan();
    const exactGate = {
      plan,
      approvalPhrase: plan.approvalPhrase,
      sourceRef: "c".repeat(40),
      currentHeadSourceRef: "c".repeat(40),
      explicitLiveProviderOptIn: true,
      environmentLiveProviderOptIn: true,
      maxCalls: plan.plannedProviderCalls,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
    } as const;

    expect(() => assertCoverLetterEval3aLiveGate(exactGate)).not.toThrow();
    expect(() =>
      assertCoverLetterEval3aLiveGate({
        ...exactGate,
        approvalPhrase: `${plan.approvalPhrase} `,
      }),
    ).toThrow(/approval phrase/iu);
    expect(() =>
      assertCoverLetterEval3aLiveGate({
        ...exactGate,
        maxCalls: plan.plannedProviderCalls + 1,
      }),
    ).toThrow(/maxCalls=10/iu);
    expect(() =>
      assertCoverLetterEval3aLiveGate({
        ...exactGate,
        environmentLiveProviderOptIn: false,
      }),
    ).toThrow(/COVER_LETTER_EVAL_LIVE=1/iu);
    expect(() =>
      assertCoverLetterEval3aLiveGate({
        ...exactGate,
        currentHeadSourceRef: "d".repeat(40),
      }),
    ).toThrow(/sourceRef.*HEAD/iu);
  });

  it("rejects a stale full-run sourceRef before the injected provider path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eval3a-stale-source-"));
    const plan = await buildCoverLetterEval3aPlan();
    const originalLiveOptIn = process.env.COVER_LETTER_EVAL_LIVE;
    process.env.COVER_LETTER_EVAL_LIVE = "1";
    let generatedRecordCount = 0;

    try {
      await expect(
        runCoverLetterEval3aHeldOut({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: plan.plannedProviderCalls,
          maxRepairs: plan.maxRepairs,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: path.join(root, "output"),
          runId: "eval3a-stale-source-test",
          sourceRef: "a".repeat(40),
          apiKey: "offline-injected-record",
          generateRecord: async () => {
            generatedRecordCount += 1;
            throw new Error("injected provider path must not be reached");
          },
        }),
      ).rejects.toThrow(/sourceRef.*HEAD/iu);
      expect(generatedRecordCount).toBe(0);
    } finally {
      if (originalLiveOptIn === undefined) {
        delete process.env.COVER_LETTER_EVAL_LIVE;
      } else {
        process.env.COVER_LETTER_EVAL_LIVE = originalLiveOptIn;
      }
    }
  });

  it("freezes the exact one-cell finalization diagnostic gate offline", async () => {
    const plan = await buildCoverLetterEval3aFinalizationDiagnosticPlan();
    expect(plan).toMatchObject({
      status: "READY_FOR_APPROVAL",
      runMode: "finalization_failure_diagnostic_v1",
      caseId: "blind-fr-customer-success-direct",
      writerModel: "gpt-5.5",
      plannedProviderCalls: 1,
      providerMaxRetries: 0,
      maxRepairs: 0,
      llmEvaluator: "none",
      budget: {
        maxUsd: 0.15,
        declaredMaxUsdPerCall: 0.135595,
        minimumSafeReservationUsd: 0.135595,
      },
      outputs: {
        failureLedgerVersion: "cover_letter_eval3a_failure_ledger_v2",
        reviewerPack: false,
        revealMap: false,
      },
      approvalPhraseVersion:
        "quality_eval3a_finalization_diagnostic_approval_phrase_v1",
    });
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/u);

    const sourceRef = "c".repeat(40);
    const runId = "quality-eval-3a-finalization-diagnostic-gate-test";
    const exactGate = {
      plan,
      approvalPhrase:
        buildCoverLetterEval3aFinalizationDiagnosticApprovalPhrase({
          sourceRef,
          planHash: plan.planHash,
          runId,
        }),
      sourceRef,
      currentHeadSourceRef: sourceRef,
      runId,
      explicitLiveProviderOptIn: true,
      environmentLiveProviderOptIn: true,
      maxCalls: plan.plannedProviderCalls,
      maxRepairs: plan.maxRepairs,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
    } as const;
    expect(() =>
      assertCoverLetterEval3aFinalizationDiagnosticLiveGate(exactGate),
    ).not.toThrow();
    expect(() =>
      assertCoverLetterEval3aFinalizationDiagnosticLiveGate({
        ...exactGate,
        maxCalls: 2,
      }),
    ).toThrow(/exact one-cell approval and budget contract/iu);
    expect(() =>
      assertCoverLetterEval3aFinalizationDiagnosticLiveGate({
        ...exactGate,
        environmentLiveProviderOptIn: false,
      }),
    ).toThrow(/both explicit and environment live opt-in/iu);
    expect(() =>
      assertCoverLetterEval3aFinalizationDiagnosticLiveGate({
        ...exactGate,
        currentHeadSourceRef: "d".repeat(40),
      }),
    ).toThrow(/exact one-cell approval and budget contract/iu);
    expect(() =>
      assertCoverLetterEval3aFinalizationDiagnosticLiveGate({
        ...exactGate,
        runId: "quality-eval-3a-finalization-diagnostic-other-run",
      }),
    ).toThrow(/exact one-cell approval and budget contract/iu);
  });

  it("rejects unknown modes before any gate or provider path", async () => {
    await expect(
      runCoverLetterEval3aHeldOut({
        mode: "unsupported-diagnostic-mode",
        approvalPhrase: "unused",
        explicitLiveProviderOptIn: false,
        maxCalls: 1,
        maxRepairs: 0,
        maxUsd: 0.15,
        declaredMaxUsdPerCall: 0.135595,
        outputDirectory: "unused",
        runId: "unused",
        sourceRef: "e".repeat(40),
        apiKey: "unused",
      }),
    ).rejects.toThrow(/unsupported run mode/iu);
  });
});

describe("QUALITY-EVAL-3A private output boundary", () => {
  const pack = {
    version: "cover_letter_blind_review_pack_v1",
    rubricVersion: "cover_letter_editorial_rubric_v1",
    cohortId: QUALITY_EVAL3A_COHORT_ID,
    runId: "eval3a-test",
    sourceRef: "0503832f5671b995b0095841104afc2e33b065ee",
    instructions: [],
    rubric: {},
    entries: [],
    packHash: "a".repeat(64),
  } as CoverLetterBlindReviewPack;
  const revealMap = {
    version: "cover_letter_blind_review_reveal_v1",
    cohortId: QUALITY_EVAL3A_COHORT_ID,
    runId: "eval3a-test",
    sourceRef: "0503832f5671b995b0095841104afc2e33b065ee",
    packHash: pack.packHash,
    entries: [],
    revealMapHash: "b".repeat(64),
  } as CoverLetterBlindReviewRevealMap;

  it("writes reviewer-safe and reveal artifacts into separate private trees", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eval3a-private-output-"));
    const paths = await writeCoverLetterEval3aPrivateArtifacts({
      outputDirectory: path.join(root, "output"),
      pack,
      revealMap,
      ledger: { status: "completed", reservedCalls: 10 },
    });

    expect(paths.packJsonPath).toContain(
      `${path.sep}private-review${path.sep}`,
    );
    expect(paths.revealMapJsonPath).toContain(
      `${path.sep}private-reveal${path.sep}`,
    );
    expect(paths.ledgerJsonPath).toContain(
      `${path.sep}private-evidence${path.sep}`,
    );
    for (const filePath of Object.values(paths)) {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
    const reviewerJson = await readFile(paths.packJsonPath, "utf8");
    expect(reviewerJson).not.toMatch(/writerModel|writerProvider|gpt-5\.[56]/u);

    await expect(
      writeCoverLetterEval3aPrivateArtifacts({
        outputDirectory: path.join(root, "output"),
        pack,
        revealMap,
        ledger: { status: "must-not-overwrite" },
      }),
    ).rejects.toThrow(/refuses to overwrite/iu);
    expect(await readFile(paths.ledgerJsonPath, "utf8")).toContain(
      '"status": "completed"',
    );
  });

  it("rejects a symlinked output ancestor before writing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eval3a-symlink-output-"));
    const privateTarget = path.join(root, "private-target");
    const symlinkedOutput = path.join(root, "redirected-output");
    await writeCoverLetterEval3aPrivateArtifacts({
      outputDirectory: privateTarget,
      pack,
      revealMap,
      ledger: { status: "seed" },
    });
    await symlink(privateTarget, symlinkedOutput, "dir");

    await expect(
      writeCoverLetterEval3aPrivateArtifacts({
        outputDirectory: symlinkedOutput,
        pack,
        revealMap,
        ledger: { status: "should-not-write" },
      }),
    ).rejects.toThrow(/symlink output path/iu);
    expect((await lstat(symlinkedOutput)).isSymbolicLink()).toBe(true);
  });

  it("persists only the sanitized finalization diagnostic when a record fails closed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eval3a-failure-ledger-"));
    const outputDirectory = path.join(root, "output");
    const plan = await buildCoverLetterEval3aPlan();
    const rawProviderSentinel = "RAW_PROVIDER_OUTPUT_MUST_NOT_BE_SERIALIZED";
    const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const originalLiveOptIn = process.env.COVER_LETTER_EVAL_LIVE;
    process.env.COVER_LETTER_EVAL_LIVE = "1";

    try {
      await expect(
        runCoverLetterEval3aHeldOut({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: plan.plannedProviderCalls,
          maxRepairs: plan.maxRepairs,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory,
          runId: "eval3a-sanitized-failure-test",
          sourceRef,
          apiKey: "offline-injected-record",
          generateRecord: async () =>
            ({
              status: "finalization_failed",
              caseId: "blind-fr-customer-success-direct",
              writerModel: "gpt-5.5",
              error: rawProviderSentinel,
              generation: {
                content: rawProviderSentinel,
                prompt: "PRIVATE_PROMPT_MUST_NOT_BE_SERIALIZED",
              },
              artifact: {
                artifactHash: "c".repeat(64),
                diagnostics: {
                  finalization: {
                    acceptanceMode: "strict",
                    errorClass: "proposal_finalization_error",
                    failureStage: "substantive_body_assertion",
                    selectedBodyCandidate: "conservative",
                    substantiveBodyPassed: false,
                    removedBridgeSentenceCount: 1,
                    removedLastGroundedSentence: false,
                    rawGeneratedBody: rawProviderSentinel,
                  },
                },
              },
              debug: { rawGeneratedBody: rawProviderSentinel },
              letter: rawProviderSentinel,
            }) as any,
        }),
      ).rejects.toThrow(/failed closed/iu);
    } finally {
      if (originalLiveOptIn === undefined) {
        delete process.env.COVER_LETTER_EVAL_LIVE;
      } else {
        process.env.COVER_LETTER_EVAL_LIVE = originalLiveOptIn;
      }
    }

    const ledgerPath = path.join(
      outputDirectory,
      "private-evidence",
      "eval3a-run-failure.json",
    );
    const serializedLedger = await readFile(ledgerPath, "utf8");
    const ledger = JSON.parse(serializedLedger);

    expect(ledger).toMatchObject({
      version: "cover_letter_eval3a_failure_ledger_v2",
      status: "FAILED_CLOSED",
      completedRecordCount: 0,
      failureDiagnostic: {
        version: "cover_letter_eval3a_failure_diagnostic_v1",
        status: "finalization_failed",
        artifactHash: "c".repeat(64),
        finalization: {
          acceptanceMode: "strict",
          errorClass: "proposal_finalization_error",
          failureStage: "substantive_body_assertion",
          selectedBodyCandidate: "conservative",
          substantiveBodyPassed: false,
          removedBridgeSentenceCount: 1,
          removedLastGroundedSentence: false,
        },
      },
    });
    expect(Object.keys(ledger.failureDiagnostic).sort()).toEqual([
      "artifactHash",
      "finalization",
      "status",
      "version",
    ]);
    expect(Object.keys(ledger.failureDiagnostic.finalization).sort()).toEqual([
      "acceptanceMode",
      "errorClass",
      "failureStage",
      "removedBridgeSentenceCount",
      "removedLastGroundedSentence",
      "selectedBodyCandidate",
      "substantiveBodyPassed",
    ]);
    expect(serializedLedger).not.toContain(rawProviderSentinel);
    expect(serializedLedger).not.toContain(
      "PRIVATE_PROMPT_MUST_NOT_BE_SERIALIZED",
    );
    expect(serializedLedger).not.toMatch(
      /"(?:generation|letter|debug|rawGeneratedBody|prompt)"/u,
    );
  });

  it.each([
    {
      recordStatus: "finalization_failed" as const,
      runStatus: "DIAGNOSTIC_REPRODUCED",
      verdict: "REPRODUCED_FINALIZATION_FAILURE",
      errorClass: "proposal_finalization_error",
      runSuffix: "reproduced-test",
    },
    {
      recordStatus: "human_review_pending" as const,
      runStatus: "DIAGNOSTIC_NOT_REPRODUCED",
      verdict: "NOT_REPRODUCED_FINALIZATION_SUCCEEDED",
      errorClass: "none",
      runSuffix: "not-reproduced-test",
    },
  ])(
    "classifies $recordStatus honestly and stops after one cell",
    async ({ recordStatus, runStatus, verdict, errorClass, runSuffix }) => {
      const run = await runInjectedFinalizationDiagnostic({
        status: recordStatus,
        runSuffix,
      });

      expect(run.generatedRecordCount).toBe(1);
      expect(run.result).toMatchObject({
        status: runStatus,
        budget: {
          usage: {
            reservedCalls: 1,
            reservedRepairs: 0,
            reservedUsd: 0.135595,
          },
        },
      });
      expect(run.ledger).toMatchObject({
        version: "cover_letter_eval3a_failure_ledger_v2",
        status: "FAILED_CLOSED",
        diagnosticVerdict: verdict,
        recordStatus,
        failureDiagnostic: {
          status: recordStatus,
          finalization: { errorClass },
        },
      });
    },
  );
});
