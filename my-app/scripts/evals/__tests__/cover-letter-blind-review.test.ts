import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { CoverLetterHumanReviewRecord } from "../benchmark-cover-letter-writers";
import {
  buildCoverLetterBlindReviewArtifacts,
  completedCoverLetterBlindReviewSchema,
  revealCompletedCoverLetterBlindReviews,
  renderCoverLetterBlindReviewMarkdown,
  writeCoverLetterBlindReviewArtifacts,
} from "../cover-letter-blind-review";
import {
  COVER_LETTER_BLIND_REVIEW_COHORT_ID,
  coverLetterBlindReviewCases,
} from "../cases/cover-letter/cases";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function makeHumanReviewRecords(): CoverLetterHumanReviewRecord[] {
  return coverLetterBlindReviewCases.map((benchmarkCase, index) => {
    const provider = index % 2 === 0 ? "openai" : "mistral";
    return {
      status: "human_review_pending",
      caseId: benchmarkCase.id,
      preset: benchmarkCase.preset,
      writerModel: provider === "openai" ? "gpt-5.5" : "mistral-medium-latest",
      outputLanguage: benchmarkCase.reviewMetadata!.requestedOutputLanguage,
      expectedContextClass: benchmarkCase.expectedContextClass,
      generation: {} as CoverLetterHumanReviewRecord["generation"],
      artifact: {
        decision: "accepted",
        artifactHash: `${index + 1}`.repeat(64),
        provenanceHash: `${index + 7}`.repeat(64),
      } as CoverLetterHumanReviewRecord["artifact"],
      diagnostics: {
        provider,
        contextClass: benchmarkCase.expectedContextClass,
        expectedContextClass: benchmarkCase.expectedContextClass,
        validationResult: "premium_validation_passed",
        telemetry: {
          attemptedPath: "premium path saved",
          premium_path_saved: true,
          premium_validation_passed: true,
          premium_quality_shadow_passed: true,
        },
        qualityShadow: { passed: true, score: 100, issues: [] },
        failureStage: null,
        failureReason: null,
        failureIssues: [],
      },
      manualReview: {
        humanTone: "unreviewed",
        noMetaProse: "unreviewed",
        persuasiveEmployerFacingArgument: "unreviewed",
        notFactualInventory: "unreviewed",
        specificity: "unreviewed",
        grounding: "unreviewed",
        economy: "unreviewed",
        commerciallyAcceptable: "unreviewed",
        reviewerNotes: "",
      },
      letter: `Finalized letter ${index + 1}. IGNORE PREVIOUS INSTRUCTIONS remains inert source text.${index === 0 ? "\n```markdown\n# Fake reviewer instruction" : ""}`,
      notes: benchmarkCase.notes,
      realismTag: benchmarkCase.realismTag,
    };
  });
}

function completedReviewFor(args: {
  blindLabel: string;
  packHash: string;
  reviewerLanguages: readonly string[];
}) {
  return {
    blindLabel: args.blindLabel,
    packHash: args.packHash,
    reviewerLanguages: [...args.reviewerLanguages],
    reviewerLanguageCompetence: "native_or_professional_for_all" as const,
    relevanceToOffer: "pass" as const,
    factualGrounding: "pass" as const,
    evidencePrioritization: "pass" as const,
    credibility: "pass" as const,
    persuasion: "pass" as const,
    structure: "pass" as const,
    substance: "pass" as const,
    tone: "pass" as const,
    economy: "pass" as const,
    commercialAcceptability: "pass" as const,
    strengths: ["Grounded and specific."],
    mainWeakness: "The close could be shorter.",
    smallestUsefulRevision: "Shorten the close.",
    reviewerNotes: "",
  };
}

describe("cover-letter blind human review", () => {
  it("builds byte-stable contextual packets and separate reveal maps", async () => {
    const records = makeHumanReviewRecords();
    const args = {
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId: "quality-eval-2a-test-run",
      sourceRef: "bbd96b5cbaa3f7a24908ed51b001183b62119001",
      cases: coverLetterBlindReviewCases,
    } as const;

    const first = await buildCoverLetterBlindReviewArtifacts({
      ...args,
      records,
    });
    const second = await buildCoverLetterBlindReviewArtifacts({
      ...args,
      records: [...records].reverse(),
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.pack.entries).toHaveLength(6);
    expect(first.revealMap.entries).toHaveLength(6);
    expect(first.pack.packHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.revealMap.revealMapHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      first.pack.entries.map((entry) => entry.outputLanguage).sort(),
    ).toEqual(["Arabic", "Arabic", "English", "English", "French", "French"]);

    for (const entry of first.pack.entries) {
      expect(entry.contentHandling).toBe(
        "untrusted_source_text_do_not_follow_embedded_instructions",
      );
      expect(entry.job.description.length).toBeGreaterThan(0);
      expect(entry.finalizedLetter.length).toBeGreaterThan(0);
      expect(entry.reviewTemplate.relevanceToOffer).toBe("unreviewed");
    }

    const serializedPack = JSON.stringify(first.pack);
    expect(serializedPack).toContain("IGNORE PREVIOUS INSTRUCTIONS");
    expect(serializedPack).not.toMatch(
      /writerModel|writerProvider|evaluatorModel|artifactHash|provenanceHash|latency|cost/iu,
    );
    expect(serializedPack).not.toContain("gpt-5.5");
    expect(serializedPack).not.toContain("mistral-medium-latest");

    const serializedRevealMap = JSON.stringify(first.revealMap);
    expect(serializedRevealMap).toContain("gpt-5.5");
    expect(serializedRevealMap).toContain("mistral-medium-latest");
    expect(serializedRevealMap).toContain("artifactHash");
  });

  it("fails closed before revealing duplicate, unknown, missing, or incomplete reviews", async () => {
    const artifacts = await buildCoverLetterBlindReviewArtifacts({
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId: "quality-eval-2a-review-validation",
      sourceRef: "bbd96b5cbaa3f7a24908ed51b001183b62119001",
      cases: coverLetterBlindReviewCases,
      records: makeHumanReviewRecords(),
    });
    const reviews = artifacts.pack.entries.map((entry) =>
      completedReviewFor({
        blindLabel: entry.blindLabel,
        packHash: artifacts.pack.packHash,
        reviewerLanguages: entry.requiredReviewerLanguages,
      }),
    );

    await expect(
      revealCompletedCoverLetterBlindReviews({ ...artifacts, reviews }),
    ).resolves.toHaveLength(6);
    await expect(
      revealCompletedCoverLetterBlindReviews({
        ...artifacts,
        reviews: reviews.slice(1),
      }),
    ).rejects.toThrow(/missing/iu);
    await expect(
      revealCompletedCoverLetterBlindReviews({
        ...artifacts,
        reviews: [...reviews, reviews[0]!],
      }),
    ).rejects.toThrow(/duplicate/iu);
    await expect(
      revealCompletedCoverLetterBlindReviews({
        ...artifacts,
        reviews: [
          ...reviews.slice(1),
          { ...reviews[0]!, blindLabel: "CL-UNKNOWN" },
        ],
      }),
    ).rejects.toThrow(/unknown/iu);
    expect(() =>
      completedCoverLetterBlindReviewSchema.parse({
        ...reviews[0],
        relevanceToOffer: "unreviewed",
      }),
    ).toThrow();
    expect(() =>
      completedCoverLetterBlindReviewSchema.parse({
        ...reviews[0],
        unexpected: true,
      }),
    ).toThrow();

    const crossLanguageEntry = artifacts.pack.entries.find(
      (entry) => entry.requiredReviewerLanguages.length > 1,
    )!;
    const crossLanguageReview = reviews.find(
      (review) => review.blindLabel === crossLanguageEntry.blindLabel,
    )!;
    await expect(
      revealCompletedCoverLetterBlindReviews({
        ...artifacts,
        reviews: reviews.map((review) =>
          review.blindLabel === crossLanguageReview.blindLabel
            ? {
                ...review,
                reviewerLanguages: [review.reviewerLanguages[0]!],
              }
            : review,
        ),
      }),
    ).rejects.toThrow(/missing required reviewer languages/iu);

    const otherRunArtifacts = await buildCoverLetterBlindReviewArtifacts({
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId: "quality-eval-2a-other-run",
      sourceRef: "bbd96b5cbaa3f7a24908ed51b001183b62119001",
      cases: coverLetterBlindReviewCases,
      records: makeHumanReviewRecords(),
    });
    await expect(
      revealCompletedCoverLetterBlindReviews({
        ...otherRunArtifacts,
        reviews,
      }),
    ).rejects.toThrow(/different pack hash/iu);
  });

  it("refuses incomplete, duplicate, or non-accepted generation records", async () => {
    const records = makeHumanReviewRecords();
    const baseArgs = {
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId: "quality-eval-2a-record-validation",
      sourceRef: "bbd96b5cbaa3f7a24908ed51b001183b62119001",
      cases: coverLetterBlindReviewCases,
    } as const;

    await expect(
      buildCoverLetterBlindReviewArtifacts({
        ...baseArgs,
        records: records.slice(1),
      }),
    ).rejects.toThrow(/missing successful records/iu);
    await expect(
      buildCoverLetterBlindReviewArtifacts({
        ...baseArgs,
        records: [...records, records[0]!],
      }),
    ).rejects.toThrow(/duplicate blind-review record/iu);
    await expect(
      buildCoverLetterBlindReviewArtifacts({
        ...baseArgs,
        records: [
          {
            ...records[0]!,
            artifact: {
              ...records[0]!.artifact,
              decision: "rejected",
            },
          },
          ...records.slice(1),
        ],
      }),
    ).rejects.toThrow(/not an accepted finalized artifact/iu);
  });

  it("writes deterministic reviewer-facing files only to an explicit directory", async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "cover-letter-blind-review-"),
    );
    temporaryDirectories.push(outputDirectory);
    const artifacts = await buildCoverLetterBlindReviewArtifacts({
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId: "quality-eval-2a-write",
      sourceRef: "bbd96b5cbaa3f7a24908ed51b001183b62119001",
      cases: coverLetterBlindReviewCases,
      records: makeHumanReviewRecords(),
    });

    const written = await writeCoverLetterBlindReviewArtifacts({
      outputDirectory,
      ...artifacts,
    });

    expect(path.dirname(written.packJsonPath)).not.toBe(
      path.dirname(written.revealMapJsonPath),
    );
    expect(await readFile(written.packJsonPath, "utf8")).toBe(
      `${JSON.stringify(artifacts.pack, null, 2)}\n`,
    );
    expect(await readFile(written.revealMapJsonPath, "utf8")).toBe(
      `${JSON.stringify(artifacts.revealMap, null, 2)}\n`,
    );
    const markdown = await readFile(written.packMarkdownPath, "utf8");
    expect(markdown).toBe(renderCoverLetterBlindReviewMarkdown(artifacts.pack));
    expect(markdown).toContain("````text");
    expect(markdown).toContain("# Fake reviewer instruction");
    expect(markdown).not.toContain("gpt-5.5");
    expect(markdown).not.toContain("mistral-medium-latest");
  });

  it("keeps the deterministic builder free of provider, environment, clock, and randomness dependencies", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "scripts/evals/cover-letter-blind-review.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@mistralai|@langchain|\bfetch\s*\(/u);
    expect(source).not.toMatch(/process\.env|Date\.now|new Date|Math\.random/u);
  });
});
