import { lstat, mkdtemp, readFile, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  CoverLetterBlindReviewPack,
  CoverLetterBlindReviewRevealMap,
} from "../cover-letter-blind-review";
import {
  QUALITY_EVAL3A_COHORT_ID,
  QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
  QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
  QUALITY_EVAL3A_LIVE_MAX_USD,
  QUALITY_EVAL3A_WRITER_MODELS,
  assertCoverLetterEval3aLiveGate,
  buildCoverLetterEval3aPlan,
  getCoverLetterEval3aHeldOutCases,
  writeCoverLetterEval3aPrivateArtifacts,
} from "../cover-letter-eval3a-held-out";

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
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects live execution unless every approval and budget field is exact", async () => {
    const plan = await buildCoverLetterEval3aPlan();
    const exactGate = {
      plan,
      approvalPhrase: plan.approvalPhrase,
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
});
