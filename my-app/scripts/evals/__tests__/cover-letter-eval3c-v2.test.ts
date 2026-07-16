import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PremiumCoverLetterAttemptResult } from "../../../convex/lib/proposals/premiumCoverLetter";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import {
  benchmarkCoverLetterCaseForHumanReview,
  type CoverLetterBenchmarkFailureRecord,
  type CoverLetterHumanReviewRecord,
} from "../benchmark-cover-letter-writers";
import type { CoverLetterBenchmarkCase } from "../cases/cover-letter/cases";
import {
  buildCoverLetterEvalArtifactHash,
  type CoverLetterEvalArtifact,
} from "../cover-letter-eval-artifact";
import { buildCoverLetterEvalFailureAttemptMetadata } from "../cover-letter-eval-failure-receipt";
import { calculateCoverLetterEvalObservedCostUpperBound } from "../cover-letter-eval-run-manifest";
import {
  QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY,
  QUALITY_EVAL3C_V2_INITIAL_VARIANTS,
  buildCoverLetterEval3cV2FollowUpPlan,
  buildCoverLetterEval3cV2Plan,
  evaluateCoverLetterEval3cV2BlindReviews,
  runCoverLetterEval3cV2FollowUpCell,
  runCoverLetterEval3cV2InitialScreen,
  selectCoverLetterEval3cV2AdaptiveAction,
  type CoverLetterEval3cV2BlindDecision,
  type CoverLetterEval3cV2BlindReviewPack,
  type CoverLetterEval3cV2ExecutionCommitment,
  type CoverLetterEval3cV2Plan,
  type CoverLetterEval3cV2ReviewSubmission,
  type CoverLetterEval3cV2RevealMap,
} from "../cover-letter-eval3c-v2";

const SOURCE_REF = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const RUN_ID = "quality-eval-3c-v2-test-run";
const LETTER = [
  "Dear Hiring Manager,",
  "",
  "Customer success work is most useful when onboarding, account health, and business reviews operate as one retention system.",
  "",
  "At Lumio Health, I improved 90-day retention by 18% by redesigning onboarding checkpoints while managing 40+ enterprise accounts. I also built a health-score dashboard used to prioritize at-risk accounts.",
  "",
  "For a role focused on enterprise account health and retention, that combination would help keep risk visible and follow-through clear.",
  "",
  "I would bring the same disciplined, data-led approach to your enterprise accounts.",
  "",
  "Sincerely,",
  "Priya Sharma",
].join("\n");
const HARD_BLOCKED_LETTER = [
  "Dear Hiring Manager,",
  "",
  "I improved retention and managed enterprise accounts.",
  "",
  "I would be glad to discuss the position further.",
  "",
  "Sincerely,",
  "Priya Sharma",
].join("\n");
const bodyParts = {
  opening:
    "I improved weekly QA reporting and issue handoffs for support escalations.",
  proofBlock:
    "I kept field notes and follow-up records clear across shifts so teams could act on the same context.",
  employerValueBlock:
    "That operating discipline would support a customer-success team that values reliable follow-through.",
  closeLine: "I would welcome the opportunity to discuss the role further.",
};
const content = [
  "Dear Hiring Manager,",
  "",
  bodyParts.opening,
  "",
  bodyParts.proofBlock,
  "",
  bodyParts.employerValueBlock,
  "",
  bodyParts.closeLine,
  "",
  "Sincerely,",
  "Casey Reed",
].join("\n");
const payload = {
  content,
  sections: [{ type: "text" as const, content }],
  prompt: "offline prompt",
  brief: {
    language: "English" as const,
    preset: "signature" as const,
    contextClass: "cv_direct" as const,
    targetRole: "Customer Success Specialist",
    topEvidence: [],
    supportEvidence: [],
    requiredMoves: [],
    forbiddenMoves: [],
  },
  contextClass: "cv_direct" as const,
  bodyParts,
  mode: "direct" as const,
  evidenceUsed: ["fact_cv_support_reporting"],
  omittedWeakEvidence: [],
  qualityShadow: { passed: false, score: 4, issues: ["generic_tone"] },
  finalProvenance: {
    version: "premium_cover_letter_final_provenance_v1" as const,
    status: "validated_final_text" as const,
    origin: "provider_reported" as const,
    contextClass: "cv_direct" as const,
    candidateFactIds: ["fact_cv_support_reporting"],
    verifiedCandidateFactIds: ["fact_cv_support_reporting"],
    candidateFacts: [
      {
        id: "fact_cv_support_reporting",
        section: "opening" as const,
        text: "Completed weekly QA reports and issue handoffs.",
        source: "cv" as const,
        metrics: [],
        entities: [],
      },
    ],
    sections: Object.fromEntries(
      Object.entries(bodyParts).map(([section, text]) => [
        section,
        {
          section,
          text,
          claimIds: [`claim_${section}`],
          factIds: [],
          demandIds: [],
          candidateFactIds: [],
          verifiedCandidateFactIds: [],
        },
      ]),
    ),
  },
} as unknown as PremiumCoverLetterAttemptResult;
const failedPayload = {
  content: "unfinalized synthetic output",
  sections: [{ type: "text", content: "unfinalized synthetic output" }],
  prompt: "offline failure prompt",
} as unknown as PremiumCoverLetterAttemptResult;

const temporaryDirectories: string[] = [];

async function outputDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join("/tmp", "eval3c-v2-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function syntheticResult(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: "gpt-5.6-luna" | "gpt-5.6-sol";
  reasoningEffort: "none" | "low" | "medium";
  finalContent?: string;
}): Promise<CoverLetterHumanReviewRecord> {
  const result = (await benchmarkCoverLetterCaseForHumanReview({
    benchmarkCase: args.benchmarkCase,
    writerModel: args.writerModel,
    reasoningEffort: args.reasoningEffort,
    apiKey: "offline-test-key",
    generateLetter: async () => payload,
  })) as CoverLetterHumanReviewRecord;
  const { artifactHash: _artifactHash, ...artifact } = result.artifact;
  const finalContent = args.finalContent ?? LETTER;
  const updated = {
    ...artifact,
    finalContent,
    sections: [{ type: "text" as const, content: finalContent }],
  };
  const artifactHash = await buildCoverLetterEvalArtifactHash(updated);
  const tokenUsage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
  return {
    ...result,
    letter: finalContent,
    artifact: { ...updated, artifactHash },
    runManifest: result.runManifest
      ? {
          ...result.runManifest,
          returnedModel: `${args.writerModel}-2026-07-09`,
          tokenUsage,
          observedCostUpperBoundUsd:
            calculateCoverLetterEvalObservedCostUpperBound({
              writerModel: args.writerModel,
              tokenUsage,
            }),
          artifactHash,
        }
      : result.runManifest,
  };
}

async function syntheticFailure(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: "gpt-5.6-luna" | "gpt-5.6-sol";
  reasoningEffort: "none" | "low" | "medium";
}): Promise<CoverLetterBenchmarkFailureRecord> {
  const result = await benchmarkCoverLetterCaseForHumanReview({
    benchmarkCase: args.benchmarkCase,
    writerModel: args.writerModel,
    reasoningEffort: args.reasoningEffort,
    apiKey: "offline-test-key",
    generateLetter: async () => failedPayload,
  });
  if (result.status !== "finalization_failed") {
    throw new Error("synthetic failure fixture did not fail finalization");
  }
  const attempt = result.attemptMetadata!;
  return {
    ...result,
    attemptMetadata: await buildCoverLetterEvalFailureAttemptMetadata({
      caseId: result.caseId,
      provider: "openai",
      requestedModel: args.writerModel,
      returnedModel: `${args.writerModel}-2026-07-09`,
      prompt: result.generation!.prompt,
      reasoningEffort: args.reasoningEffort,
      writerMaxOutputTokens: 2_048,
      providerMaxRetries: 0,
      tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      sdkVersions: attempt.sdkVersions,
      artifactHash: result.artifact!.artifactHash,
      provenanceHash: result.artifact!.provenanceHash,
    }),
  };
}

const ARTIFACT_IDENTITY_MUTATIONS = [
  "caseId",
  "outputLanguage",
  "preset",
  "hasCandidateContext",
  "provider",
  "model",
  "reasoningEffort",
  "providerMaxRetries",
  "writerMaxOutputTokens",
] as const;

async function mutateArtifactIdentity(args: {
  artifact: CoverLetterEvalArtifact;
  mutation: (typeof ARTIFACT_IDENTITY_MUTATIONS)[number];
}): Promise<CoverLetterEvalArtifact> {
  const { artifactHash: _artifactHash, ...projection } = args.artifact;
  const frozenConfig = {
    ...projection.frozenConfig,
    ...(args.mutation === "outputLanguage" ? { outputLanguage: "French" } : {}),
    ...(args.mutation === "preset" ? { preset: "signature" } : {}),
    ...(args.mutation === "hasCandidateContext"
      ? { hasCandidateContext: false }
      : {}),
    ...(args.mutation === "provider" ? { provider: "mistral" } : {}),
    ...(args.mutation === "model" ? { model: "gpt-5.6-sol" } : {}),
    ...(args.mutation === "reasoningEffort"
      ? { reasoningEffort: "medium" }
      : {}),
    ...(args.mutation === "providerMaxRetries"
      ? { providerMaxRetries: 1 }
      : {}),
    ...(args.mutation === "writerMaxOutputTokens"
      ? { writerMaxOutputTokens: 4_096 }
      : {}),
  } as CoverLetterEvalArtifact["frozenConfig"];
  const updated = {
    ...projection,
    ...(args.mutation === "caseId"
      ? { caseId: "blind-en-checklist-challenging" }
      : {}),
    frozenConfig,
  } as Omit<CoverLetterEvalArtifact, "artifactHash">;
  return {
    ...updated,
    artifactHash: await buildCoverLetterEvalArtifactHash(updated),
  };
}

async function initialArtifacts(
  suffix: string,
  editorialVetoModel?: "gpt-5.6-luna" | "gpt-5.6-sol",
  safetyVetoModel?: "gpt-5.6-luna" | "gpt-5.6-sol",
) {
  const runId = `${RUN_ID}-${suffix}`;
  const directory = await outputDirectory();
  const plan = await buildCoverLetterEval3cV2Plan({
    sourceRef: SOURCE_REF,
    runId,
    outputDirectory: directory,
  });
  const calls: string[] = [];
  const result = await runCoverLetterEval3cV2InitialScreen({
    approvalPhrase: plan.approvalPhrase,
    explicitLiveProviderOptIn: true,
    maxCalls: 2,
    maxRepairs: 0,
    maxUsd: plan.budget.maxUsd,
    declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
    outputDirectory: directory,
    runId,
    sourceRef: SOURCE_REF,
    apiKey: "offline-test-key",
    executionIdentity: {
      currentHeadSourceRef: SOURCE_REF,
      currentWorktreeStatus: "",
    },
    generateRecord: async ({
      benchmarkCase,
      writerModel,
      reasoningEffort,
      budget,
    }) =>
      budget.beginWriterAttempt().runProviderCall(async () => {
        calls.push(`${writerModel}@${reasoningEffort}`);
        if (writerModel === safetyVetoModel) {
          return syntheticFailure({
            benchmarkCase,
            writerModel,
            reasoningEffort,
          });
        }
        return syntheticResult({
          benchmarkCase,
          writerModel,
          reasoningEffort,
          ...(writerModel === editorialVetoModel
            ? { finalContent: HARD_BLOCKED_LETTER }
            : {}),
        });
      }),
  });
  const [pack, revealMap] = await Promise.all([
    readFile(result.paths.packJsonPath, "utf8").then(
      (value) => JSON.parse(value) as CoverLetterEval3cV2BlindReviewPack,
    ),
    readFile(result.paths.revealMapJsonPath, "utf8").then(
      (value) => JSON.parse(value) as CoverLetterEval3cV2RevealMap,
    ),
  ]);
  return {
    plan,
    pack,
    revealMap,
    executionCommitment: result.executionCommitment,
    calls,
  };
}

async function rehashRevealMap(
  revealMap: CoverLetterEval3cV2RevealMap,
  entries: CoverLetterEval3cV2RevealMap["entries"],
): Promise<CoverLetterEval3cV2RevealMap> {
  const { revealMapHash: _hash, ...body } = revealMap;
  const nextBody = { ...body, entries };
  return {
    ...nextBody,
    revealMapHash: await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "reveal-map",
      version: 1,
      value: nextBody,
    }),
  };
}

async function commitmentForRevealMap(args: {
  plan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  revealMap: CoverLetterEval3cV2RevealMap;
}): Promise<CoverLetterEval3cV2ExecutionCommitment> {
  const body = {
    version: "cover_letter_eval3c_execution_commitment_v2" as const,
    planHash: args.plan.planHash,
    packHash: args.pack.packHash,
    revealMapHash: args.revealMap.revealMapHash,
    entries: args.revealMap.entries
      .map((entry) => ({
        blindLabel: entry.blindLabel,
        variantId: entry.variantId,
        caseId: entry.caseId,
        writerProvider: entry.writerProvider,
        writerModel: entry.writerModel,
        reasoningEffort: entry.reasoningEffort,
        outcome: entry.outcome,
        artifactHash: entry.artifactHash,
        provenanceHash: entry.provenanceHash,
      }))
      .sort((left, right) => left.blindLabel.localeCompare(right.blindLabel)),
  };
  return {
    ...body,
    commitmentHash: await buildStableHash({
      namespace: "quality_eval3c_blind_adaptive_v2",
      type: "execution-commitment",
      version: 2,
      value: body,
    }),
  };
}

async function rehashPack(
  pack: CoverLetterEval3cV2BlindReviewPack,
  failureMatrix: CoverLetterEval3cV2BlindReviewPack["failureMatrix"],
): Promise<CoverLetterEval3cV2BlindReviewPack> {
  const { packHash: _hash, ...body } = pack;
  const nextBody = { ...body, failureMatrix };
  return {
    ...nextBody,
    packHash: await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "pack",
      version: 1,
      value: nextBody,
    }),
  };
}

function submission(args: {
  pack: CoverLetterEval3cV2BlindReviewPack;
  blindLabel: string;
  reviewerId: string;
  slot: "primary_1" | "primary_2" | "adjudicator";
  overrides?: Partial<
    Record<
      | "relevanceToOffer"
      | "factualGrounding"
      | "evidencePrioritization"
      | "credibility"
      | "persuasion"
      | "structure"
      | "substance"
      | "tone"
      | "economy"
      | "commercialAcceptability",
      "pass" | "fail"
    >
  >;
}): CoverLetterEval3cV2ReviewSubmission {
  return {
    reviewerId: args.reviewerId,
    slot: args.slot,
    review: {
      blindLabel: args.blindLabel,
      packHash: args.pack.packHash,
      reviewerLanguages: ["English"],
      reviewerLanguageCompetence: "native_or_professional_for_all",
      relevanceToOffer: "pass",
      factualGrounding: "pass",
      evidencePrioritization: "pass",
      credibility: "pass",
      persuasion: "pass",
      structure: "pass",
      substance: "pass",
      tone: "pass",
      economy: "pass",
      commercialAcceptability: "pass",
      strengths: ["Grounded."],
      mainWeakness: "None material.",
      smallestUsefulRevision: "No revision needed.",
      reviewerNotes: "",
      ...args.overrides,
    },
  };
}

function primaryReviews(args: {
  pack: CoverLetterEval3cV2BlindReviewPack;
  overrides?: Readonly<
    Record<
      string,
      readonly [
        Parameters<typeof submission>[0]["overrides"],
        Parameters<typeof submission>[0]["overrides"],
      ]
    >
  >;
}): CoverLetterEval3cV2ReviewSubmission[] {
  return args.pack.entries.flatMap((entry, index) => {
    const overrides = args.overrides?.[entry.blindLabel] ?? [{}, {}];
    return [
      submission({
        pack: args.pack,
        blindLabel: entry.blindLabel,
        reviewerId: `reviewer-a-${index}`,
        slot: "primary_1",
        overrides: overrides[0],
      }),
      submission({
        pack: args.pack,
        blindLabel: entry.blindLabel,
        reviewerId: `reviewer-b-${index}`,
        slot: "primary_2",
        overrides: overrides[1],
      }),
    ];
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

beforeEach(() => vi.stubEnv("COVER_LETTER_EVAL_LIVE", "1"));

describe("QUALITY-EVAL-3C v2 protocol", () => {
  it("builds an exact neutral two-cell plan and rejects identity-bearing run IDs", async () => {
    const directory = await outputDirectory();
    const plan = await buildCoverLetterEval3cV2Plan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
      outputDirectory: directory,
    });
    expect(plan.initialVariants).toEqual(QUALITY_EVAL3C_V2_INITIAL_VARIANTS);
    expect(plan).toMatchObject({
      version: "cover_letter_eval3c_plan_v2",
      plannedProviderCalls: 2,
      providerMaxRetries: 0,
      maxRepairs: 0,
      llmEvaluator: "none",
    });
    expect(plan.approvalPhrase).toContain(plan.planHash);
    expect(plan.approvalPhrase).toContain(plan.outputBindingHash);
    let calls = 0;
    await expect(
      runCoverLetterEval3cV2InitialScreen({
        approvalPhrase: `${plan.approvalPhrase} stale`,
        explicitLiveProviderOptIn: true,
        maxCalls: 2,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory: directory,
        runId: plan.runId,
        sourceRef: plan.sourceRef,
        apiKey: "offline-test-key",
        executionIdentity: {
          currentHeadSourceRef: SOURCE_REF,
          currentWorktreeStatus: "",
        },
        generateRecord: async () => {
          calls += 1;
          throw new Error("provider must not run");
        },
      }),
    ).rejects.toThrow(/exact live gate/u);
    expect(calls).toBe(0);
    await expect(
      runCoverLetterEval3cV2InitialScreen({
        approvalPhrase: plan.approvalPhrase,
        explicitLiveProviderOptIn: true,
        maxCalls: 2,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory: await outputDirectory(),
        runId: plan.runId,
        sourceRef: plan.sourceRef,
        apiKey: "offline-test-key",
        executionIdentity: {
          currentHeadSourceRef: SOURCE_REF,
          currentWorktreeStatus: "",
        },
        generateRecord: async () => {
          calls += 1;
          throw new Error("provider must not run");
        },
      }),
    ).rejects.toThrow(/exact live gate/u);
    expect(calls).toBe(0);
    await expect(
      buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId: "quality-eval-3c-v2-luna-low",
        outputDirectory: directory,
      }),
    ).rejects.toThrow(/reviewer-neutral/u);
  });

  it("exposes an offline plan-only CLI entrypoint", async () => {
    const directory = await outputDirectory();
    const stdout = execFileSync(
      path.resolve("node_modules/.bin/tsx"),
      [
        "scripts/evals/cover-letter-eval3c-v2.ts",
        `--run-id=${RUN_ID}-cli`,
        `--source-ref=${SOURCE_REF}`,
        `--output-dir=${directory}`,
        "--plan-only",
      ],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          MISTRAL_API_KEY: "",
          COVER_LETTER_EVAL_LIVE: "0",
        },
      },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      version: "cover_letter_eval3c_plan_v2",
      runId: `${RUN_ID}-cli`,
      sourceRef: SOURCE_REF,
      plannedProviderCalls: 2,
    });
  });

  it("atomically reserves one initial execution per plan and target", async () => {
    const directory = await outputDirectory();
    const plan = await buildCoverLetterEval3cV2Plan({
      sourceRef: SOURCE_REF,
      runId: `${RUN_ID}-initial-concurrency`,
      outputDirectory: directory,
    });
    let calls = 0;
    const args = {
      approvalPhrase: plan.approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: 2,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory: directory,
      runId: plan.runId,
      sourceRef: SOURCE_REF,
      apiKey: "offline-test-key",
      executionIdentity: {
        currentHeadSourceRef: SOURCE_REF,
        currentWorktreeStatus: "",
      },
      generateRecord: async ({
        benchmarkCase,
        writerModel,
        reasoningEffort,
        budget,
      }: Parameters<
        NonNullable<
          Parameters<
            typeof runCoverLetterEval3cV2InitialScreen
          >[0]["generateRecord"]
        >
      >[0]) =>
        budget.beginWriterAttempt().runProviderCall(async () => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return syntheticResult({
            benchmarkCase,
            writerModel,
            reasoningEffort,
          });
        }),
    };
    const results = await Promise.allSettled([
      runCoverLetterEval3cV2InitialScreen(args),
      runCoverLetterEval3cV2InitialScreen(args),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      String(
        (
          results.find((result) => result.status === "rejected") as {
            reason: unknown;
          }
        ).reason,
      ),
    ).toMatch(/execution claim is already reserved/u);
    expect(calls).toBe(2);
  });

  it("rejects an empty initial API key before reserving the execution claim", async () => {
    const directory = await outputDirectory();
    const plan = await buildCoverLetterEval3cV2Plan({
      sourceRef: SOURCE_REF,
      runId: `${RUN_ID}-empty-key`,
      outputDirectory: directory,
    });
    let calls = 0;
    await expect(
      runCoverLetterEval3cV2InitialScreen({
        approvalPhrase: plan.approvalPhrase,
        explicitLiveProviderOptIn: true,
        maxCalls: 2,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory: directory,
        runId: plan.runId,
        sourceRef: SOURCE_REF,
        apiKey: " ",
        executionIdentity: {
          currentHeadSourceRef: SOURCE_REF,
          currentWorktreeStatus: "",
        },
        generateRecord: async () => {
          calls += 1;
          throw new Error("provider must not run");
        },
      }),
    ).rejects.toThrow(/requires an API key/u);
    expect(calls).toBe(0);
    await expect(
      readFile(
        path.join(
          directory,
          "private-evidence",
          "eval3c-v2-initial.claim.json",
        ),
        "utf8",
      ),
    ).rejects.toThrow();
  });

  it("preserves redacted evidence for completed initial cells when a later call fails", async () => {
    for (const firstOutcome of ["safety_veto", "editorial_veto"] as const) {
      const directory = await outputDirectory();
      const runId = `${RUN_ID}-initial-ledger-${firstOutcome.replace("_", "-")}`;
      const plan = await buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId,
        outputDirectory: directory,
      });
      let calls = 0;
      await expect(
        runCoverLetterEval3cV2InitialScreen({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: 2,
          maxRepairs: 0,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: directory,
          runId,
          sourceRef: SOURCE_REF,
          apiKey: "offline-test-key",
          executionIdentity: {
            currentHeadSourceRef: SOURCE_REF,
            currentWorktreeStatus: "",
          },
          generateRecord: async ({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            budget,
          }) =>
            budget.beginWriterAttempt().runProviderCall(async () => {
              calls += 1;
              if (calls === 2) {
                throw new Error("synthetic second provider failure");
              }
              return firstOutcome === "safety_veto"
                ? syntheticFailure({
                    benchmarkCase,
                    writerModel,
                    reasoningEffort,
                  })
                : syntheticResult({
                    benchmarkCase,
                    writerModel,
                    reasoningEffort,
                    finalContent: HARD_BLOCKED_LETTER,
                  });
            }),
        }),
      ).rejects.toThrow(/synthetic second provider failure/u);
      expect(calls).toBe(2);
      const ledger = JSON.parse(
        await readFile(
          path.join(directory, "private-evidence", "eval3c-v2-run-ledger.json"),
          "utf8",
        ),
      );
      expect(ledger).toMatchObject({
        version: "cover_letter_eval3c_failure_ledger_v2",
        status: "FAILED_CLOSED",
        completedCellCount: 1,
        completedCells: [
          {
            variantId: QUALITY_EVAL3C_V2_INITIAL_VARIANTS[0].variantId,
            outcome: firstOutcome,
            artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
            failureReceipt:
              firstOutcome === "safety_veto" ? expect.any(Object) : null,
            sendability:
              firstOutcome === "editorial_veto"
                ? expect.objectContaining({ verdict: "HARD_BLOCKED" })
                : null,
          },
        ],
      });
    }
  });

  it("creates hash-bound reviewer-neutral artifacts from exactly two offline cells", async () => {
    const { plan, pack, revealMap, executionCommitment, calls } =
      await initialArtifacts("neutral-pack");
    expect(calls).toEqual(["gpt-5.6-luna@low", "gpt-5.6-sol@low"]);
    expect(pack).toMatchObject({
      planHash: plan.planHash,
      acceptabilityPolicy: QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY,
      acceptabilityPolicyHash: plan.acceptabilityPolicyHash,
    });
    expect(pack.entries).toHaveLength(2);
    expect(revealMap.entries).toHaveLength(2);
    expect(revealMap.planHash).toBe(plan.planHash);
    expect(executionCommitment).toMatchObject({
      planHash: plan.planHash,
      packHash: pack.packHash,
      revealMapHash: revealMap.revealMapHash,
    });
    const { commitmentHash: _commitmentHash, ...commitmentBody } =
      executionCommitment;
    const forgedBody = {
      ...commitmentBody,
      version: "cover_letter_eval3c_execution_commitment_forged",
    };
    const forgedCommitment = {
      ...forgedBody,
      commitmentHash: await buildStableHash({
        namespace: "quality_eval3c_blind_adaptive_v2",
        type: "execution-commitment",
        version: 2,
        value: forgedBody,
      }),
    } as unknown as CoverLetterEval3cV2ExecutionCommitment;
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment: forgedCommitment,
        submissions: primaryReviews({ pack }),
      }),
    ).rejects.toThrow(/execution commitment is invalid/u);
    const reviewerArtifact = JSON.stringify(pack);
    for (const token of [
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "luna-low",
      "sol-low",
      "reasoningEffort",
      "variantId",
    ]) {
      expect(reviewerArtifact).not.toContain(token);
    }
    expect(reviewerArtifact).not.toMatch(/\bluna\b|\bsol\b/iu);
    expect(reviewerArtifact).not.toMatch(/"(?:none|low|medium)"/u);
  });

  it("rejects non-canonical initial plans before blind review processing", async () => {
    const { plan, pack, executionCommitment } =
      await initialArtifacts("canonical-plan");
    const submissions = primaryReviews({ pack });
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan: { ...plan, planHash: "0".repeat(64) },
        pack,
        executionCommitment,
        submissions,
      }),
    ).rejects.toThrow(/initial plan is not canonical/u);

    const forgedBase = {
      ...plan,
      initialVariants: [],
    } as unknown as CoverLetterEval3cV2Plan;
    const {
      approvalPhrase: _approvalPhrase,
      planHash: _planHash,
      ...forgedBody
    } = forgedBase;
    const forgedPlanHash = await buildStableHash({
      namespace: "quality_eval3c_blind_adaptive_v2",
      type: "initial-plan",
      version: 2,
      value: forgedBody,
    });
    const forgedPlan = {
      ...forgedBase,
      planHash: forgedPlanHash,
      approvalPhrase: plan.approvalPhrase.replace(
        plan.planHash,
        forgedPlanHash,
      ),
    } as CoverLetterEval3cV2Plan;
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan: forgedPlan,
        pack,
        executionCommitment,
        submissions,
      }),
    ).rejects.toThrow(/initial plan is not canonical/u);
  });

  it("rejects incomplete v1-compatible manifest hashes", async () => {
    for (const field of [
      "promptHash",
      "requestProjectionHash",
      "schemaTargetHash",
    ] as const) {
      const directory = await outputDirectory();
      const runId = `${RUN_ID}-manifest-${field.toLowerCase()}`;
      const plan = await buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId,
        outputDirectory: directory,
      });
      let calls = 0;
      await expect(
        runCoverLetterEval3cV2InitialScreen({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: 2,
          maxRepairs: 0,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: directory,
          runId,
          sourceRef: SOURCE_REF,
          apiKey: "offline-test-key",
          executionIdentity: {
            currentHeadSourceRef: SOURCE_REF,
            currentWorktreeStatus: "",
          },
          generateRecord: async ({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            budget,
          }) =>
            budget.beginWriterAttempt().runProviderCall(async () => {
              calls += 1;
              const record = await syntheticResult({
                benchmarkCase,
                writerModel,
                reasoningEffort,
              });
              const manifest = record.runManifest!;
              return {
                ...record,
                runManifest:
                  field === "promptHash"
                    ? { ...manifest, promptHash: "f".repeat(64) }
                    : {
                        ...manifest,
                        transport: {
                          ...manifest.transport,
                          [field]: "f".repeat(64),
                        },
                      },
              };
            }),
        }),
      ).rejects.toThrow(/success manifest is invalid/u);
      expect(calls).toBe(1);
    }
  });

  it("accepts canonical runtime success manifests and rejects forged full-field projections", async () => {
    const positive = await initialArtifacts("canonical-success-manifest");
    expect(positive.revealMap.entries).toHaveLength(2);
    expect(
      positive.revealMap.entries.every(
        (entry) => entry.outcome === "human_review_pending",
      ),
    ).toBe(true);

    for (const mutation of [
      "returnedModel",
      "tokenUsageIncoherent",
      "tokenUsageFractional",
      "tokenUsageOverflow",
      "tokenUsageExtra",
      "costNormal",
      "costNaN",
      "costInfinity",
      "sdkVersions",
      "sdkVersionsExtraUndefined",
      "topLevelExtraUndefined",
    ] as const) {
      const directory = await outputDirectory();
      const runId = `${RUN_ID}-success-full-${mutation.toLowerCase()}`;
      const plan = await buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId,
        outputDirectory: directory,
      });
      let calls = 0;
      await expect(
        runCoverLetterEval3cV2InitialScreen({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: 2,
          maxRepairs: 0,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: directory,
          runId,
          sourceRef: SOURCE_REF,
          apiKey: "offline-test-key",
          executionIdentity: {
            currentHeadSourceRef: SOURCE_REF,
            currentWorktreeStatus: "",
          },
          generateRecord: async ({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            budget,
          }) =>
            budget.beginWriterAttempt().runProviderCall(async () => {
              calls += 1;
              const record = await syntheticResult({
                benchmarkCase,
                writerModel,
                reasoningEffort,
              });
              const manifest = record.runManifest!;
              return {
                ...record,
                runManifest: {
                  ...manifest,
                  ...(mutation === "returnedModel"
                    ? { returnedModel: "gpt-5.6-terra-2026-07-09" }
                    : {}),
                  ...(mutation === "tokenUsageIncoherent"
                    ? {
                        tokenUsage: {
                          inputTokens: 10,
                          outputTokens: 5,
                          totalTokens: 999,
                        },
                      }
                    : {}),
                  ...(mutation === "tokenUsageFractional"
                    ? {
                        tokenUsage: {
                          inputTokens: 1.5,
                          outputTokens: 5,
                          totalTokens: 6.5,
                        },
                      }
                    : {}),
                  ...(mutation === "tokenUsageOverflow"
                    ? {
                        tokenUsage: {
                          inputTokens: Number.MAX_SAFE_INTEGER + 1,
                          outputTokens: 0,
                          totalTokens: Number.MAX_SAFE_INTEGER + 1,
                        },
                      }
                    : {}),
                  ...(mutation === "tokenUsageExtra"
                    ? {
                        tokenUsage: {
                          ...manifest.tokenUsage!,
                          extra: undefined,
                        },
                      }
                    : {}),
                  ...(mutation === "costNormal"
                    ? { observedCostUpperBoundUsd: 999 }
                    : {}),
                  ...(mutation === "costNaN"
                    ? { observedCostUpperBoundUsd: Number.NaN }
                    : {}),
                  ...(mutation === "costInfinity"
                    ? { observedCostUpperBoundUsd: Number.POSITIVE_INFINITY }
                    : {}),
                  ...(mutation === "sdkVersions"
                    ? {
                        sdkVersions: {
                          ...manifest.sdkVersions,
                          openai: "0.0.0-forged",
                        },
                      }
                    : {}),
                  ...(mutation === "sdkVersionsExtraUndefined"
                    ? {
                        sdkVersions: {
                          ...manifest.sdkVersions,
                          extra: undefined,
                        },
                      }
                    : {}),
                  ...(mutation === "topLevelExtraUndefined"
                    ? { extra: undefined }
                    : {}),
                },
              };
            }),
        }),
      ).rejects.toThrow(
        /(?:returned model|attempt token usage|success manifest) is invalid/u,
      );
      expect(calls).toBe(1);
    }
  });

  it("binds every artifact identity field for both success and failure records", async () => {
    for (const outcome of ["success", "failure"] as const) {
      for (const mutation of ARTIFACT_IDENTITY_MUTATIONS) {
        const directory = await outputDirectory();
        const runId = `${RUN_ID}-${outcome}-identity-${mutation.toLowerCase()}`;
        const plan = await buildCoverLetterEval3cV2Plan({
          sourceRef: SOURCE_REF,
          runId,
          outputDirectory: directory,
        });
        let calls = 0;
        await expect(
          runCoverLetterEval3cV2InitialScreen({
            approvalPhrase: plan.approvalPhrase,
            explicitLiveProviderOptIn: true,
            maxCalls: 2,
            maxRepairs: 0,
            maxUsd: plan.budget.maxUsd,
            declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
            outputDirectory: directory,
            runId,
            sourceRef: SOURCE_REF,
            apiKey: "offline-test-key",
            executionIdentity: {
              currentHeadSourceRef: SOURCE_REF,
              currentWorktreeStatus: "",
            },
            generateRecord: async ({
              benchmarkCase,
              writerModel,
              reasoningEffort,
              budget,
            }) =>
              budget.beginWriterAttempt().runProviderCall(async () => {
                calls += 1;
                if (outcome === "success") {
                  const record = await syntheticResult({
                    benchmarkCase,
                    writerModel,
                    reasoningEffort,
                  });
                  const artifact = await mutateArtifactIdentity({
                    artifact: record.artifact,
                    mutation,
                  });
                  return {
                    ...record,
                    artifact,
                    runManifest: {
                      ...record.runManifest!,
                      artifactHash: artifact.artifactHash,
                    },
                  };
                }
                const record = await syntheticFailure({
                  benchmarkCase,
                  writerModel,
                  reasoningEffort,
                });
                const artifact = await mutateArtifactIdentity({
                  artifact: record.artifact!,
                  mutation,
                });
                return {
                  ...record,
                  artifact,
                  attemptMetadata: {
                    ...record.attemptMetadata!,
                    artifactHash: artifact.artifactHash,
                  },
                };
              }),
          }),
        ).rejects.toThrow(/artifact identity is invalid/u);
        expect(calls).toBe(1);
      }
    }
  });

  it("rejects untrusted failure diagnostics, prompt hashes, and cross-cell metadata", async () => {
    const mutations = [
      "errorClass",
      "failureStage",
      "failureIssues",
      "missingGeneration",
      "missingArtifact",
      "missingAttempt",
      "emptyPrompt",
      "otherCell",
      "promptHash",
      "artifactIdentity",
    ] as const;
    for (const mutation of mutations) {
      const directory = await outputDirectory();
      const runId = `${RUN_ID}-failure-${mutation.toLowerCase()}`;
      const plan = await buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId,
        outputDirectory: directory,
      });
      let calls = 0;
      await expect(
        runCoverLetterEval3cV2InitialScreen({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: 2,
          maxRepairs: 0,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: directory,
          runId,
          sourceRef: SOURCE_REF,
          apiKey: "offline-test-key",
          executionIdentity: {
            currentHeadSourceRef: SOURCE_REF,
            currentWorktreeStatus: "",
          },
          generateRecord: async ({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            budget,
          }) =>
            budget.beginWriterAttempt().runProviderCall(async () => {
              calls += 1;
              const failure = await syntheticFailure({
                benchmarkCase,
                writerModel,
                reasoningEffort,
              });
              if (mutation === "errorClass" || mutation === "failureStage") {
                const { artifactHash: _hash, ...artifact } = failure.artifact!;
                const nextArtifact = {
                  ...artifact,
                  diagnostics: {
                    ...artifact.diagnostics,
                    finalization: {
                      ...artifact.diagnostics.finalization!,
                      ...(mutation === "errorClass"
                        ? { errorClass: "untrusted_error" }
                        : { failureStage: "provider_response" }),
                    },
                  },
                };
                return {
                  ...failure,
                  artifact: {
                    ...nextArtifact,
                    artifactHash:
                      await buildCoverLetterEvalArtifactHash(nextArtifact),
                  },
                };
              }
              if (mutation === "failureIssues") {
                return {
                  ...failure,
                  diagnostics: {
                    ...failure.diagnostics,
                    failureIssues: ["provider_raw_issue"],
                  },
                };
              }
              if (mutation === "missingGeneration") {
                const { generation: _generation, ...unprovenFailure } = failure;
                return unprovenFailure;
              }
              if (mutation === "missingArtifact") {
                const { artifact: _artifact, ...unprovenFailure } = failure;
                return unprovenFailure;
              }
              if (mutation === "missingAttempt") {
                const { attemptMetadata: _attempt, ...unprovenFailure } =
                  failure;
                return unprovenFailure;
              }
              if (mutation === "emptyPrompt") {
                return {
                  ...failure,
                  generation: {
                    ...failure.generation!,
                    prompt: "  ",
                  },
                };
              }
              const prompt =
                mutation === "promptHash" ? "synthetic failure prompt" : null;
              const reference = await syntheticResult({
                benchmarkCase,
                writerModel,
                reasoningEffort,
              });
              const attemptMetadata =
                await buildCoverLetterEvalFailureAttemptMetadata({
                  caseId:
                    mutation === "otherCell" ? "other-cell" : failure.caseId,
                  provider: "openai",
                  requestedModel:
                    mutation === "otherCell"
                      ? writerModel === "gpt-5.6-luna"
                        ? "gpt-5.6-sol"
                        : "gpt-5.6-luna"
                      : writerModel,
                  returnedModel: null,
                  prompt,
                  reasoningEffort,
                  writerMaxOutputTokens: 2_048,
                  providerMaxRetries: 0,
                  tokenUsage: null,
                  sdkVersions: reference.runManifest!.sdkVersions,
                  artifactHash: failure.artifact?.artifactHash ?? null,
                  provenanceHash: failure.artifact?.provenanceHash ?? null,
                });
              return {
                ...failure,
                ...(prompt
                  ? {
                      generation: {
                        ...(failure.generation ?? failedPayload),
                        prompt,
                      },
                    }
                  : {}),
                attemptMetadata: {
                  ...attemptMetadata,
                  ...(mutation === "promptHash"
                    ? { promptHash: "f".repeat(64) }
                    : {}),
                  ...(mutation === "artifactIdentity"
                    ? { artifactHash: "f".repeat(64) }
                    : {}),
                },
              };
            }),
        }),
      ).rejects.toThrow(
        /failure (?:artifact|attempt metadata) is (?:invalid|missing)/u,
      );
      expect(calls).toBe(1);
    }
  });

  it("accepts canonical runtime failure metadata and rejects forged full-field projections", async () => {
    const positive = await initialArtifacts(
      "canonical-failure-attempt",
      undefined,
      "gpt-5.6-luna",
    );
    expect(
      positive.revealMap.entries.find(
        (entry) => entry.writerModel === "gpt-5.6-luna",
      ),
    ).toMatchObject({ outcome: "safety_veto" });

    for (const mutation of [
      "returnedModel",
      "tokenUsageIncoherent",
      "observedCostUpperBoundUsd",
      "costNaN",
      "costPositiveInfinity",
      "costNegativeInfinity",
      "sdkVersions",
      "sdkVersionsExtraUndefined",
      "topLevelExtraUndefined",
    ] as const) {
      const directory = await outputDirectory();
      const runId = `${RUN_ID}-attempt-${mutation.toLowerCase()}`;
      const plan = await buildCoverLetterEval3cV2Plan({
        sourceRef: SOURCE_REF,
        runId,
        outputDirectory: directory,
      });
      let calls = 0;
      await expect(
        runCoverLetterEval3cV2InitialScreen({
          approvalPhrase: plan.approvalPhrase,
          explicitLiveProviderOptIn: true,
          maxCalls: 2,
          maxRepairs: 0,
          maxUsd: plan.budget.maxUsd,
          declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
          outputDirectory: directory,
          runId,
          sourceRef: SOURCE_REF,
          apiKey: "offline-test-key",
          executionIdentity: {
            currentHeadSourceRef: SOURCE_REF,
            currentWorktreeStatus: "",
          },
          generateRecord: async ({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            budget,
          }) =>
            budget.beginWriterAttempt().runProviderCall(async () => {
              calls += 1;
              const failure = await syntheticFailure({
                benchmarkCase,
                writerModel,
                reasoningEffort,
              });
              const attempt = failure.attemptMetadata!;
              return {
                ...failure,
                attemptMetadata: {
                  ...attempt,
                  ...(mutation === "returnedModel"
                    ? { returnedModel: "gpt-forged-cross-cell" }
                    : {}),
                  ...(mutation === "tokenUsageIncoherent"
                    ? {
                        tokenUsage: {
                          inputTokens: 10,
                          outputTokens: 5,
                          totalTokens: 999,
                        },
                      }
                    : {}),
                  ...(mutation === "observedCostUpperBoundUsd"
                    ? { observedCostUpperBoundUsd: 999 }
                    : {}),
                  ...(mutation === "costNaN"
                    ? { observedCostUpperBoundUsd: Number.NaN }
                    : {}),
                  ...(mutation === "costPositiveInfinity"
                    ? { observedCostUpperBoundUsd: Number.POSITIVE_INFINITY }
                    : {}),
                  ...(mutation === "costNegativeInfinity"
                    ? { observedCostUpperBoundUsd: Number.NEGATIVE_INFINITY }
                    : {}),
                  ...(mutation === "sdkVersions"
                    ? {
                        sdkVersions: {
                          ...attempt.sdkVersions,
                          openai: "0.0.0-forged",
                        },
                      }
                    : {}),
                  ...(mutation === "sdkVersionsExtraUndefined"
                    ? {
                        sdkVersions: {
                          ...attempt.sdkVersions,
                          extra: undefined,
                        },
                      }
                    : {}),
                  ...(mutation === "topLevelExtraUndefined"
                    ? { extra: undefined }
                    : {}),
                },
              };
            }),
        }),
      ).rejects.toThrow(
        /(?:returned model|token usage|attempt metadata) is invalid/u,
      );
      expect(calls).toBe(1);
    }
  });

  it("fails closed on missing reviews and requires a third reviewer only for material secondary disagreement", async () => {
    const { plan, pack, executionCommitment } =
      await initialArtifacts("review-contract");
    const reviews = primaryReviews({ pack });
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment,
        submissions: reviews.slice(0, -1),
      }),
    ).rejects.toThrow(/exactly two primary review slots/u);
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment,
        submissions: reviews.map((review, index) =>
          index === 1
            ? { ...review, reviewerId: reviews[0]!.reviewerId }
            : review,
        ),
      }),
    ).rejects.toThrow(/distinct reviewer IDs/u);
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment,
        submissions: reviews.map((review, index) =>
          index === 0
            ? {
                ...review,
                review: { ...review.review, packHash: "0".repeat(64) },
              }
            : review,
        ),
      }),
    ).rejects.toThrow(/different pack hash/u);
    const label = pack.entries[0]!.blindLabel;
    const splitReviews = primaryReviews({
      pack,
      overrides: { [label]: [{}, { persuasion: "fail" }] },
    });
    const pending = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: splitReviews,
    });
    expect(pending).toMatchObject({
      status: "ADJUDICATION_REQUIRED",
      adjudicationRequiredLabels: [label],
    });
    const complete = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: [
        ...splitReviews,
        submission({
          pack,
          blindLabel: label,
          reviewerId: "reviewer-c",
          slot: "adjudicator",
          overrides: { persuasion: "pass" },
        }),
      ],
    });
    expect(complete).toMatchObject({ status: "COMPLETE" });
    expect(complete.reviewSetHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(complete.decisionHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("requires no review for veto labels and rejects hash-valid incomplete reveal coverage", async () => {
    const { plan, pack, revealMap, executionCommitment } =
      await initialArtifacts("failure-matrix", "gpt-5.6-luna");
    expect(pack.entries).toHaveLength(1);
    expect(pack.failureMatrix).toEqual([
      expect.objectContaining({
        outcome: "editorial_veto",
        textIncluded: false,
      }),
    ]);
    const reviews = primaryReviews({ pack });
    const decision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: reviews,
    });
    expect(decision.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blindLabel: pack.failureMatrix[0]!.blindLabel,
          acceptability: "not_acceptable",
          primaryReviewerCount: 0,
        }),
      ]),
    );
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment,
        submissions: [
          ...reviews,
          submission({
            pack,
            blindLabel: pack.failureMatrix[0]!.blindLabel,
            reviewerId: "forbidden-veto-reviewer",
            slot: "primary_1",
          }),
        ],
      }),
    ).rejects.toThrow(/failure labels require no reviews/u);
    const malformedFailurePack = await rehashPack(
      pack,
      pack.failureMatrix.map((entry) => ({
        ...entry,
        outcome: "human_review_pending",
        textIncluded: true,
      })) as unknown as CoverLetterEval3cV2BlindReviewPack["failureMatrix"],
    );
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack: malformedFailurePack,
        executionCommitment,
        submissions: [],
      }),
    ).rejects.toThrow(/incomplete or duplicate plan-derived coverage/u);

    const incompleteReveal = await rehashRevealMap(
      revealMap,
      revealMap.entries.slice(0, 1),
    );
    await expect(
      selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision: decision,
        revealMap: incompleteReveal,
      }),
    ).rejects.toThrow(/reveal coverage is incomplete/u);
    const forgedEntries = [
      revealMap.entries.map((entry, index) =>
        index === 0 ? { ...entry, caseId: "forged-case" } : entry,
      ),
      revealMap.entries.map((entry, index) =>
        index === 0
          ? { ...entry, writerProvider: "forged-provider" as "openai" }
          : entry,
      ),
      revealMap.entries.map((entry, index) =>
        index === 0 ? { ...entry, artifactHash: "not-a-hash" } : entry,
      ),
    ];
    for (const entries of forgedEntries) {
      await expect(
        selectCoverLetterEval3cV2AdaptiveAction({
          plan,
          pack,
          executionCommitment,
          submissions: reviews,
          blindDecision: decision,
          revealMap: await rehashRevealMap(revealMap, entries),
        }),
      ).rejects.toThrow(/reveal entry contract is invalid/u);
    }
    expect(
      await selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision: decision,
        revealMap,
      }),
    ).toMatchObject({
      action: "stop",
      reason: "sol_acceptable_luna_not_acceptable",
    });
    const safety = await initialArtifacts(
      "safety-reveal",
      undefined,
      "gpt-5.6-luna",
    );
    expect(
      safety.revealMap.entries.find((entry) => entry.outcome === "safety_veto"),
    ).toMatchObject({ artifactHash: null, provenanceHash: null });
  });

  it("classifies commercial splits as near acceptable and recomputes reviews before reveal", async () => {
    const { plan, pack, revealMap, executionCommitment } =
      await initialArtifacts("selection");
    const lunaLabel = revealMap.entries.find(
      (entry) => entry.writerModel === "gpt-5.6-luna",
    )!.blindLabel;
    const reviews = primaryReviews({
      pack,
      overrides: {
        [lunaLabel]: [{}, { commercialAcceptability: "fail" }],
      },
    });
    const decision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: reviews,
    });
    expect(
      decision.entries.find((entry) => entry.blindLabel === lunaLabel),
    ).toMatchObject({ acceptability: "near_acceptable" });
    expect(
      await selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision: decision,
        revealMap,
      }),
    ).toMatchObject({
      action: "follow_up",
      writerModel: "gpt-5.6-luna",
      reasoningEffort: "medium",
    });
    const [firstReveal, secondReveal] = revealMap.entries;
    const permutedReveal = await rehashRevealMap(revealMap, [
      { ...secondReveal!, blindLabel: firstReveal!.blindLabel },
      { ...firstReveal!, blindLabel: secondReveal!.blindLabel },
    ]);
    await expect(
      selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision: decision,
        revealMap: permutedReveal,
      }),
    ).rejects.toThrow(/reveal does not match the execution commitment/u);
    const forgedCommitment = await commitmentForRevealMap({
      plan,
      pack,
      revealMap: permutedReveal,
    });
    await expect(
      selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment: forgedCommitment,
        submissions: reviews,
        blindDecision: decision,
        revealMap: permutedReveal,
      }),
    ).rejects.toThrow(/canonical complete blind decision/u);
    await expect(
      selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: primaryReviews({ pack }),
        blindDecision: decision,
        revealMap,
      }),
    ).rejects.toThrow(/canonical complete blind decision/u);
    await expect(
      selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision: {
          ...decision,
          decisionHash: "0".repeat(64),
        } as CoverLetterEval3cV2BlindDecision,
        revealMap,
      }),
    ).rejects.toThrow(/canonical complete blind decision/u);

    const solLabel = revealMap.entries.find(
      (entry) => entry.writerModel === "gpt-5.6-sol",
    )!.blindLabel;
    const bothNearReviews = primaryReviews({
      pack,
      overrides: {
        [lunaLabel]: [{ economy: "fail" }, { commercialAcceptability: "fail" }],
        [solLabel]: [{}, { commercialAcceptability: "fail" }],
      },
    });
    const bothNearDecision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: bothNearReviews,
    });
    expect(bothNearDecision.preferredNearLabel).toBe(solLabel);
    expect(
      await selectCoverLetterEval3cV2AdaptiveAction({
        plan,
        pack,
        executionCommitment,
        submissions: bothNearReviews,
        blindDecision: bothNearDecision,
        revealMap,
      }),
    ).toMatchObject({
      action: "follow_up",
      blindLabel: solLabel,
      writerModel: "gpt-5.6-sol",
      reasoningEffort: "medium",
      reason: "blind_near_tiebreak",
    });
    const tiedReviews = primaryReviews({
      pack,
      overrides: {
        [lunaLabel]: [{}, { commercialAcceptability: "fail" }],
        [solLabel]: [{}, { commercialAcceptability: "fail" }],
      },
    });
    const tiedDecision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack,
      executionCommitment,
      submissions: tiedReviews,
    });
    const metadataChangedDecision =
      await evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack,
        executionCommitment,
        submissions: tiedReviews.map((submission, index) => ({
          ...submission,
          reviewerId: `replacement-reviewer-${index}`,
          review: {
            ...(submission.review as Record<string, unknown>),
            reviewerNotes: `Arbitrary note ${index}`,
          },
        })),
      });
    expect(metadataChangedDecision.reviewSetHash).not.toBe(
      tiedDecision.reviewSetHash,
    );
    expect(metadataChangedDecision.preferredNearLabel).toBe(
      tiedDecision.preferredNearLabel,
    );
  });

  it("executes one separately approved follow-up and refuses stale or reused output", async () => {
    const {
      plan: initialPlan,
      pack,
      revealMap,
      executionCommitment,
    } = await initialArtifacts("follow-up");
    const lunaLabel = revealMap.entries.find(
      (entry) => entry.writerModel === "gpt-5.6-luna",
    )!.blindLabel;
    const reviews = primaryReviews({
      pack,
      overrides: {
        [lunaLabel]: [{}, { commercialAcceptability: "fail" }],
      },
    });
    const blindDecision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan: initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
    });
    const directory = await outputDirectory();
    const plan = await buildCoverLetterEval3cV2FollowUpPlan({
      initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
      blindDecision,
      revealMap,
      runId: `${RUN_ID}-follow-up-cell`,
      outputDirectory: directory,
    });
    expect(plan).toMatchObject({
      plannedProviderCalls: 1,
      maxRepairs: 0,
      heldOutAccess: "forbidden",
      selectedVariant: {
        writerModel: "gpt-5.6-luna",
        reasoningEffort: "medium",
      },
    });
    expect(plan.budget.maxUsd).toBeLessThanOrEqual(0.15);
    expect(plan.approvalPhrase).toContain(blindDecision.reviewSetHash);
    expect(plan.approvalPhrase).toContain(plan.outputBindingHash);
    const cliBundleDirectory = await outputDirectory();
    const cliBundlePath = path.join(cliBundleDirectory, "follow-up-input.json");
    await writeFile(
      cliBundlePath,
      JSON.stringify({
        initialPlan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision,
        revealMap,
      }),
      { encoding: "utf8", mode: 0o600 },
    );
    const cliFollowUpOutput = await outputDirectory();
    const cliFollowUpPlan = JSON.parse(
      execFileSync(
        path.resolve("node_modules/.bin/tsx"),
        [
          "scripts/evals/cover-letter-eval3c-v2.ts",
          `--run-id=${RUN_ID}-follow-up-cli`,
          `--output-dir=${cliFollowUpOutput}`,
          `--follow-up-input=${cliBundlePath}`,
          "--follow-up-plan-only",
        ],
        {
          cwd: path.resolve("."),
          encoding: "utf8",
          env: {
            ...process.env,
            OPENAI_API_KEY: "",
            MISTRAL_API_KEY: "",
            COVER_LETTER_EVAL_LIVE: "0",
          },
        },
      ),
    );
    expect(cliFollowUpPlan).toMatchObject({
      version: "cover_letter_eval3c_follow_up_plan_v2",
      runId: `${RUN_ID}-follow-up-cli`,
      sourceRef: SOURCE_REF,
      selectedVariant: plan.selectedVariant,
      plannedProviderCalls: 1,
    });
    let calls = 0;
    const args = {
      plan,
      initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
      blindDecision,
      revealMap,
      approvalPhrase: plan.approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: 1,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory: directory,
      apiKey: "offline-test-key",
      executionIdentity: {
        currentHeadSourceRef: SOURCE_REF,
        currentWorktreeStatus: "",
      },
      generateRecord: async ({
        benchmarkCase,
        writerModel,
        reasoningEffort,
        budget,
      }: Parameters<
        NonNullable<
          Parameters<
            typeof runCoverLetterEval3cV2FollowUpCell
          >[0]["generateRecord"]
        >
      >[0]) =>
        budget.beginWriterAttempt().runProviderCall(async () => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return syntheticResult({
            benchmarkCase,
            writerModel,
            reasoningEffort,
          });
        }),
    };
    const failureDirectory = await outputDirectory();
    const failurePlan = await buildCoverLetterEval3cV2FollowUpPlan({
      initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
      blindDecision,
      revealMap,
      runId: `${RUN_ID}-follow-up-failure`,
      outputDirectory: failureDirectory,
    });
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        plan: failurePlan,
        approvalPhrase: failurePlan.approvalPhrase,
        maxUsd: failurePlan.budget.maxUsd,
        declaredMaxUsdPerCall: failurePlan.budget.declaredMaxUsdPerCall,
        outputDirectory: failureDirectory,
        apiKey: " ",
      }),
    ).rejects.toThrow(/requires an API key/u);
    await expect(
      readFile(
        path.join(
          failureDirectory,
          "private-evidence",
          "eval3c-v2-follow-up.claim.json",
        ),
        "utf8",
      ),
    ).rejects.toThrow();
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        plan: failurePlan,
        approvalPhrase: failurePlan.approvalPhrase,
        maxUsd: failurePlan.budget.maxUsd,
        declaredMaxUsdPerCall: failurePlan.budget.declaredMaxUsdPerCall,
        outputDirectory: failureDirectory,
        generateRecord: async () => {
          throw new Error("synthetic provider failure");
        },
      }),
    ).rejects.toThrow(/synthetic provider failure/u);
    const failureLedgerText = await readFile(
      path.join(
        failureDirectory,
        "private-evidence",
        "eval3c-v2-follow-up-ledger.json",
      ),
      "utf8",
    );
    expect(failureLedgerText).not.toContain("synthetic provider failure");
    expect(JSON.parse(failureLedgerText)).toMatchObject({
      version: "cover_letter_eval3c_follow_up_failure_ledger_v2",
      status: "FAILED_CLOSED",
      initialPlanHash: initialPlan.planHash,
      planHash: failurePlan.planHash,
      packHash: pack.packHash,
      executionCommitmentHash: executionCommitment.commitmentHash,
      reviewSetHash: blindDecision.reviewSetHash,
      blindDecisionHash: blindDecision.decisionHash,
      revealMapHash: revealMap.revealMapHash,
      selectedVariant: failurePlan.selectedVariant,
      providerMaxRetries: 0,
      maxRepairs: 0,
      llmEvaluator: "none",
      heldOutAccess: "forbidden",
    });
    const postCellFailureDirectory = await outputDirectory();
    const postCellFailurePlan = await buildCoverLetterEval3cV2FollowUpPlan({
      initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
      blindDecision,
      revealMap,
      runId: `${RUN_ID}-follow-up-post-cell-failure`,
      outputDirectory: postCellFailureDirectory,
    });
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        plan: postCellFailurePlan,
        approvalPhrase: postCellFailurePlan.approvalPhrase,
        maxUsd: postCellFailurePlan.budget.maxUsd,
        declaredMaxUsdPerCall: postCellFailurePlan.budget.declaredMaxUsdPerCall,
        outputDirectory: postCellFailureDirectory,
        generateRecord: async ({
          benchmarkCase,
          writerModel,
          reasoningEffort,
          budget,
        }) =>
          budget.beginWriterAttempt().runProviderCall(async () => {
            const result = await syntheticResult({
              benchmarkCase,
              writerModel,
              reasoningEffort,
            });
            await writeFile(
              path.join(
                postCellFailureDirectory,
                "private-review",
                "blind-review-pack.json",
              ),
              "synthetic publication conflict",
              { encoding: "utf8", flag: "wx", mode: 0o600 },
            );
            return result;
          }),
      }),
    ).rejects.toThrow(/refuses to overwrite private evidence/u);
    const postCellFailureLedger = JSON.parse(
      await readFile(
        path.join(
          postCellFailureDirectory,
          "private-evidence",
          "eval3c-v2-follow-up-ledger.json",
        ),
        "utf8",
      ),
    );
    expect(postCellFailureLedger).toMatchObject({
      status: "FAILED_CLOSED",
      completedCellCount: 1,
      completedCells: [
        {
          variantId: postCellFailurePlan.selectedVariant.variantId,
          outcome: "human_review_pending",
          artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          failureReceipt: null,
          sendability: expect.any(Object),
        },
      ],
    });
    const vetoDirectory = await outputDirectory();
    const vetoPlan = await buildCoverLetterEval3cV2FollowUpPlan({
      initialPlan,
      pack,
      executionCommitment,
      submissions: reviews,
      blindDecision,
      revealMap,
      runId: `${RUN_ID}-follow-up-veto`,
      outputDirectory: vetoDirectory,
    });
    const vetoResult = await runCoverLetterEval3cV2FollowUpCell({
      ...args,
      plan: vetoPlan,
      approvalPhrase: vetoPlan.approvalPhrase,
      maxUsd: vetoPlan.budget.maxUsd,
      declaredMaxUsdPerCall: vetoPlan.budget.declaredMaxUsdPerCall,
      outputDirectory: vetoDirectory,
      generateRecord: async ({
        benchmarkCase,
        writerModel,
        reasoningEffort,
        budget,
      }) =>
        budget.beginWriterAttempt().runProviderCall(() =>
          syntheticResult({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            finalContent: HARD_BLOCKED_LETTER,
          }),
        ),
    });
    const vetoLedger = JSON.parse(
      await readFile(vetoResult.paths.ledgerJsonPath, "utf8"),
    );
    expect(vetoLedger).toMatchObject({
      status: "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS",
      outcome: "editorial_veto",
      sendability: { verdict: "HARD_BLOCKED" },
      failureReceipts: [],
      executionCommitment: vetoResult.executionCommitment,
    });
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        approvalPhrase: `${plan.approvalPhrase} stale`,
      }),
    ).rejects.toThrow(/exact follow-up live gate/u);
    expect(calls).toBe(0);
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        outputDirectory: await outputDirectory(),
      }),
    ).rejects.toThrow(/follow-up plan mismatch/u);
    expect(calls).toBe(0);
    const concurrent = await Promise.allSettled([
      runCoverLetterEval3cV2FollowUpCell(args),
      runCoverLetterEval3cV2FollowUpCell(args),
    ]);
    expect(
      concurrent.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      concurrent.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      String(
        (
          concurrent.find((result) => result.status === "rejected") as {
            reason: unknown;
          }
        ).reason,
      ),
    ).toMatch(/execution claim is already reserved/u);
    expect(calls).toBe(1);
    const fulfilled = concurrent.find(
      (result) => result.status === "fulfilled",
    ) as PromiseFulfilledResult<
      Awaited<ReturnType<typeof runCoverLetterEval3cV2FollowUpCell>>
    >;
    const [followUpPack, followUpRevealMap] = await Promise.all([
      readFile(fulfilled.value.paths.packJsonPath, "utf8").then(
        (value) => JSON.parse(value) as CoverLetterEval3cV2BlindReviewPack,
      ),
      readFile(fulfilled.value.paths.revealMapJsonPath, "utf8").then(
        (value) => JSON.parse(value) as CoverLetterEval3cV2RevealMap,
      ),
    ]);
    const followUpDecision = await evaluateCoverLetterEval3cV2BlindReviews({
      plan,
      pack: followUpPack,
      executionCommitment: fulfilled.value.executionCommitment,
      submissions: primaryReviews({ pack: followUpPack }),
      followUpRevealMap,
      followUpContext: {
        initialPlan,
        pack,
        executionCommitment,
        submissions: reviews,
        blindDecision,
        revealMap,
      },
    });
    expect(followUpDecision).toMatchObject({
      status: "COMPLETE",
      planHash: plan.planHash,
      packHash: followUpPack.packHash,
    });
    const {
      commitmentHash: _followUpCommitmentHash,
      ...followUpCommitmentBody
    } = fulfilled.value.executionCommitment;
    const forgedFollowUpCommitmentBody = {
      ...followUpCommitmentBody,
      entries: followUpCommitmentBody.entries.map((entry) => ({
        ...entry,
        outcome: "editorial_veto" as const,
      })),
    };
    const forgedFollowUpCommitment = {
      ...forgedFollowUpCommitmentBody,
      commitmentHash: await buildStableHash({
        namespace: "quality_eval3c_blind_adaptive_v2",
        type: "execution-commitment",
        version: 2,
        value: forgedFollowUpCommitmentBody,
      }),
    };
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan,
        pack: followUpPack,
        executionCommitment: forgedFollowUpCommitment,
        submissions: primaryReviews({ pack: followUpPack }),
        followUpRevealMap,
        followUpContext: {
          initialPlan,
          pack,
          executionCommitment,
          submissions: reviews,
          blindDecision,
          revealMap,
        },
      }),
    ).rejects.toThrow(/reveal does not match the execution commitment/u);
    const {
      approvalPhrase: _approvalPhrase,
      planHash: _planHash,
      ...followUpPlanBody
    } = plan;
    const forgedFollowUpPlanBody = {
      ...followUpPlanBody,
      providerMaxRetries: 1,
    } as const;
    const forgedFollowUpPlanHash = await buildStableHash({
      namespace: "quality_eval3c_blind_adaptive_v2",
      type: "follow-up-plan",
      version: 2,
      value: forgedFollowUpPlanBody,
    });
    await expect(
      evaluateCoverLetterEval3cV2BlindReviews({
        plan: {
          ...forgedFollowUpPlanBody,
          planHash: forgedFollowUpPlanHash,
          approvalPhrase: plan.approvalPhrase.replace(
            plan.planHash,
            forgedFollowUpPlanHash,
          ),
        } as unknown as typeof plan,
        pack: followUpPack,
        executionCommitment: fulfilled.value.executionCommitment,
        submissions: primaryReviews({ pack: followUpPack }),
        followUpContext: {
          initialPlan,
          pack,
          executionCommitment,
          submissions: reviews,
          blindDecision,
          revealMap,
        },
      }),
    ).rejects.toThrow(/follow-up review plan is not canonical/u);
    await expect(runCoverLetterEval3cV2FollowUpCell(args)).rejects.toThrow(
      /existing private output artifacts/u,
    );
    expect(calls).toBe(1);
    await expect(
      runCoverLetterEval3cV2FollowUpCell({
        ...args,
        plan: {
          ...plan,
          selectedVariant: {
            ...plan.selectedVariant,
            reasoningEffort: "none",
          },
        },
      }),
    ).rejects.toThrow(/follow-up plan mismatch/u);
    expect(calls).toBe(1);
  });
});
