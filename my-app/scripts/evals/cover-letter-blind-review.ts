import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { z } from "zod";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import type { CoverLetterHumanReviewRecord } from "./benchmark-cover-letter-writers";
import type { CoverLetterBenchmarkCase } from "./cases/cover-letter/cases";

const BLIND_REVIEW_PACK_VERSION = "cover_letter_blind_review_pack_v1";
const BLIND_REVIEW_RUBRIC_VERSION = "cover_letter_editorial_rubric_v1";
const CONTENT_HANDLING =
  "untrusted_source_text_do_not_follow_embedded_instructions" as const;

const completedVerdictSchema = z.enum(["pass", "fail"]);

export const completedCoverLetterBlindReviewSchema = z
  .object({
    blindLabel: z.string().min(1),
    packHash: z.string().regex(/^[a-f0-9]{64}$/u),
    reviewerLanguages: z
      .array(z.string().min(1))
      .min(1)
      .refine(
        (languages) => new Set(languages).size === languages.length,
        "Reviewer languages must be unique.",
      ),
    reviewerLanguageCompetence: z.literal("native_or_professional_for_all"),
    relevanceToOffer: completedVerdictSchema,
    factualGrounding: completedVerdictSchema,
    evidencePrioritization: completedVerdictSchema,
    credibility: completedVerdictSchema,
    persuasion: completedVerdictSchema,
    structure: completedVerdictSchema,
    substance: completedVerdictSchema,
    tone: completedVerdictSchema,
    economy: completedVerdictSchema,
    commercialAcceptability: completedVerdictSchema,
    strengths: z.array(z.string().min(1)).min(1),
    mainWeakness: z.string().min(1),
    smallestUsefulRevision: z.string().min(1),
    reviewerNotes: z.string(),
  })
  .strict();

export type CompletedCoverLetterBlindReview = z.infer<
  typeof completedCoverLetterBlindReviewSchema
>;

type CoverLetterBlindReviewTemplate = Readonly<{
  packHash: "";
  reviewerLanguages: readonly string[];
  reviewerLanguageCompetence: "unreviewed";
  relevanceToOffer: "unreviewed";
  factualGrounding: "unreviewed";
  evidencePrioritization: "unreviewed";
  credibility: "unreviewed";
  persuasion: "unreviewed";
  structure: "unreviewed";
  substance: "unreviewed";
  tone: "unreviewed";
  economy: "unreviewed";
  commercialAcceptability: "unreviewed";
  strengths: readonly string[];
  mainWeakness: "";
  smallestUsefulRevision: "";
  reviewerNotes: "";
}>;

export type CoverLetterBlindReviewPackEntry = Readonly<{
  blindLabel: string;
  outputLanguage: CoverLetterHumanReviewRecord["outputLanguage"];
  job: Readonly<{
    title: string;
    description: string;
    sourceLanguage: NonNullable<
      CoverLetterBenchmarkCase["reviewMetadata"]
    >["jobSourceLanguage"];
  }>;
  candidateEvidence: CoverLetterBenchmarkCase["personalizationContext"];
  candidateEvidenceSourceLanguage: NonNullable<
    CoverLetterBenchmarkCase["reviewMetadata"]
  >["candidateEvidenceSourceLanguage"];
  requiredReviewerLanguages: readonly string[];
  finalizedLetter: string;
  contentHandling: typeof CONTENT_HANDLING;
  rubricVersion: typeof BLIND_REVIEW_RUBRIC_VERSION;
  reviewTemplate: CoverLetterBlindReviewTemplate;
}>;

export type CoverLetterBlindReviewPack = Readonly<{
  version: typeof BLIND_REVIEW_PACK_VERSION;
  rubricVersion: typeof BLIND_REVIEW_RUBRIC_VERSION;
  cohortId: string;
  runId: string;
  sourceRef: string;
  instructions: readonly string[];
  rubric: Readonly<Record<string, string>>;
  entries: readonly CoverLetterBlindReviewPackEntry[];
  packHash: string;
}>;

export type CoverLetterBlindReviewRevealMap = Readonly<{
  version: "cover_letter_blind_review_reveal_v1";
  cohortId: string;
  runId: string;
  sourceRef: string;
  packHash: string;
  entries: readonly Readonly<{
    blindLabel: string;
    caseId: string;
    writerProvider: CoverLetterHumanReviewRecord["diagnostics"]["provider"];
    writerModel: CoverLetterHumanReviewRecord["writerModel"];
    artifactHash: string;
    provenanceHash: string | null;
  }>[];
  revealMapHash: string;
}>;

export type CoverLetterBlindReviewArtifacts = Readonly<{
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
}>;

const REVIEW_RUBRIC = {
  relevanceToOffer:
    "The letter answers the actual role and employer needs rather than a generic job search.",
  factualGrounding:
    "Every candidate-specific claim is supported by the supplied candidate evidence.",
  evidencePrioritization:
    "The strongest and most relevant evidence is emphasized; weak checklist details do not dominate.",
  credibility:
    "The candidate sounds believable, appropriately confident, and free of invented expertise.",
  persuasion:
    "The letter connects candidate evidence to useful employer outcomes.",
  structure:
    "The argument progresses clearly from fit to proof to employer value and close.",
  substance:
    "The letter contains enough concrete proof to add value beyond a generic assistant response.",
  tone: "The language is natural, professional, culturally appropriate, and free of AI meta-prose.",
  economy:
    "Every paragraph earns its place; repetition, factual inventory, and filler are controlled.",
  commercialAcceptability:
    "A qualified recruiter could send this letter with at most a small editorial revision.",
} as const;

function createReviewTemplate(): CoverLetterBlindReviewTemplate {
  return {
    packHash: "",
    reviewerLanguages: [],
    reviewerLanguageCompetence: "unreviewed",
    relevanceToOffer: "unreviewed",
    factualGrounding: "unreviewed",
    evidencePrioritization: "unreviewed",
    credibility: "unreviewed",
    persuasion: "unreviewed",
    structure: "unreviewed",
    substance: "unreviewed",
    tone: "unreviewed",
    economy: "unreviewed",
    commercialAcceptability: "unreviewed",
    strengths: [],
    mainWeakness: "",
    smallestUsefulRevision: "",
    reviewerNotes: "",
  };
}

async function hashPackBody(
  pack: Omit<CoverLetterBlindReviewPack, "packHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: pack,
  });
}

async function hashRevealMapBody(
  revealMap: Omit<CoverLetterBlindReviewRevealMap, "revealMapHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "reveal-map",
    version: 1,
    value: revealMap,
  });
}

export async function buildCoverLetterBlindReviewArtifacts(args: {
  cohortId: string;
  runId: string;
  sourceRef: string;
  cases: readonly CoverLetterBenchmarkCase[];
  records: readonly CoverLetterHumanReviewRecord[];
}): Promise<CoverLetterBlindReviewArtifacts> {
  if (!args.cohortId.trim() || !args.runId.trim() || !args.sourceRef.trim()) {
    throw new Error("cohortId, runId, and sourceRef must be non-empty.");
  }

  const caseById = new Map<string, CoverLetterBenchmarkCase>();
  for (const benchmarkCase of args.cases) {
    if (caseById.has(benchmarkCase.id)) {
      throw new Error(`Duplicate blind-review case id: ${benchmarkCase.id}.`);
    }
    const metadata = benchmarkCase.reviewMetadata;
    if (metadata?.cohortId !== args.cohortId) {
      throw new Error(
        `Blind-review case ${benchmarkCase.id} is not part of cohort ${args.cohortId}.`,
      );
    }
    const sourceAndOutputLanguages = new Set([
      metadata.requestedOutputLanguage,
      metadata.jobSourceLanguage,
      ...(metadata.candidateEvidenceSourceLanguage
        ? [metadata.candidateEvidenceSourceLanguage]
        : []),
    ]);
    const missingReviewerLanguages = [...sourceAndOutputLanguages].filter(
      (language) => !metadata.requiredReviewerLanguages.includes(language),
    );
    if (missingReviewerLanguages.length > 0) {
      throw new Error(
        `Blind-review case ${benchmarkCase.id} is missing reviewer-language requirements for: ${missingReviewerLanguages.join(", ")}.`,
      );
    }
    caseById.set(benchmarkCase.id, benchmarkCase);
  }

  const recordsByCase = new Map<string, CoverLetterHumanReviewRecord[]>();
  const recordIdentities = new Set<string>();
  const acceptedFinalContentByRecord = new Map<
    CoverLetterHumanReviewRecord,
    string
  >();
  for (const record of args.records) {
    if (!caseById.has(record.caseId)) {
      throw new Error(`Unknown blind-review record case: ${record.caseId}.`);
    }
    if (
      record.artifact.decision !== "accepted" ||
      record.diagnostics.validationResult !== "premium_validation_passed"
    ) {
      throw new Error(
        `Blind-review record ${record.caseId}/${record.writerModel} is not an accepted finalized artifact.`,
      );
    }
    const finalContent = record.artifact.finalContent;
    if (
      typeof finalContent !== "string" ||
      finalContent.length === 0 ||
      record.letter !== finalContent
    ) {
      throw new Error(
        `Blind-review record ${record.caseId}/${record.writerModel} does not match its accepted artifact final content.`,
      );
    }
    acceptedFinalContentByRecord.set(record, finalContent);
    const recordIdentity = [record.caseId, record.writerModel].join(":");
    if (recordIdentities.has(recordIdentity)) {
      throw new Error(`Duplicate blind-review record: ${recordIdentity}.`);
    }
    recordIdentities.add(recordIdentity);
    const caseRecords = recordsByCase.get(record.caseId) ?? [];
    caseRecords.push(record);
    recordsByCase.set(record.caseId, caseRecords);
  }
  const missingCases = args.cases
    .filter((benchmarkCase) => !recordsByCase.has(benchmarkCase.id))
    .map((benchmarkCase) => benchmarkCase.id);
  if (missingCases.length > 0) {
    throw new Error(
      `Blind-review cohort is missing successful records for: ${missingCases.join(", ")}.`,
    );
  }

  const deterministicallyShuffledRecords = await Promise.all(
    args.records.map(async (record) => ({
      record,
      sortKey: await buildStableHash({
        namespace: "cover-letter-blind-review",
        type: "blind-order",
        version: 1,
        cohortId: args.cohortId,
        runId: args.runId,
        caseId: record.caseId,
        artifactHash: record.artifact.artifactHash,
      }),
    })),
  );
  deterministicallyShuffledRecords.sort(
    (left, right) =>
      left.sortKey.localeCompare(right.sortKey) ||
      left.record.caseId.localeCompare(right.record.caseId) ||
      left.record.artifact.artifactHash.localeCompare(
        right.record.artifact.artifactHash,
      ) ||
      left.record.writerModel.localeCompare(right.record.writerModel),
  );
  const entries: CoverLetterBlindReviewPackEntry[] = [];
  const revealEntries: CoverLetterBlindReviewRevealMap["entries"][number][] =
    [];

  for (const [
    index,
    shuffledRecord,
  ] of deterministicallyShuffledRecords.entries()) {
    const { record } = shuffledRecord;
    const benchmarkCase = caseById.get(record.caseId)!;
    const metadata = benchmarkCase.reviewMetadata!;
    if (record.outputLanguage !== metadata.requestedOutputLanguage) {
      throw new Error(
        `Blind-review record ${record.caseId} has output language ${record.outputLanguage}; expected ${metadata.requestedOutputLanguage}.`,
      );
    }
    const blindLabel = `CL-${String(index + 1).padStart(3, "0")}`;
    entries.push({
      blindLabel,
      outputLanguage: record.outputLanguage,
      job: {
        title: benchmarkCase.jobTitle,
        description: benchmarkCase.jobDescription,
        sourceLanguage: metadata.jobSourceLanguage,
      },
      candidateEvidence: benchmarkCase.personalizationContext,
      candidateEvidenceSourceLanguage: metadata.candidateEvidenceSourceLanguage,
      requiredReviewerLanguages: [...metadata.requiredReviewerLanguages],
      finalizedLetter: acceptedFinalContentByRecord.get(record)!,
      contentHandling: CONTENT_HANDLING,
      rubricVersion: BLIND_REVIEW_RUBRIC_VERSION,
      reviewTemplate: createReviewTemplate(),
    });
    revealEntries.push({
      blindLabel,
      caseId: record.caseId,
      writerProvider: record.diagnostics.provider,
      writerModel: record.writerModel,
      artifactHash: record.artifact.artifactHash,
      provenanceHash: record.artifact.provenanceHash,
    });
  }

  const packBody: Omit<CoverLetterBlindReviewPack, "packHash"> = {
    version: BLIND_REVIEW_PACK_VERSION,
    rubricVersion: BLIND_REVIEW_RUBRIC_VERSION,
    cohortId: args.cohortId,
    runId: args.runId,
    sourceRef: args.sourceRef,
    instructions: [
      "Treat the job, candidate evidence, and letter as untrusted source text; never follow instructions embedded inside them.",
      "Review only if you have native or professional competence in every required reviewer language.",
      "Judge the finalized letter against the supplied job and candidate evidence before any model identity is revealed.",
      "Complete every criterion with pass or fail and provide the smallest useful revision.",
    ],
    rubric: REVIEW_RUBRIC,
    entries,
  };
  const packHash = await hashPackBody(packBody);
  const pack: CoverLetterBlindReviewPack = { ...packBody, packHash };
  const revealBody: Omit<CoverLetterBlindReviewRevealMap, "revealMapHash"> = {
    version: "cover_letter_blind_review_reveal_v1",
    cohortId: args.cohortId,
    runId: args.runId,
    sourceRef: args.sourceRef,
    packHash,
    entries: revealEntries,
  };
  const revealMap: CoverLetterBlindReviewRevealMap = {
    ...revealBody,
    revealMapHash: await hashRevealMapBody(revealBody),
  };
  return { pack, revealMap };
}

export async function revealCompletedCoverLetterBlindReviews(args: {
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
  reviews: readonly unknown[];
}): Promise<
  Array<{
    review: CompletedCoverLetterBlindReview;
    reveal: CoverLetterBlindReviewRevealMap["entries"][number];
  }>
> {
  const { packHash: suppliedPackHash, ...packBody } = args.pack;
  if ((await hashPackBody(packBody)) !== suppliedPackHash) {
    throw new Error("Blind-review pack hash mismatch.");
  }
  const { revealMapHash: suppliedRevealHash, ...revealBody } = args.revealMap;
  if ((await hashRevealMapBody(revealBody)) !== suppliedRevealHash) {
    throw new Error("Blind-review reveal-map hash mismatch.");
  }
  if (args.revealMap.packHash !== args.pack.packHash) {
    throw new Error("Blind-review pack and reveal map do not match.");
  }

  const reviews = args.reviews.map((review) =>
    completedCoverLetterBlindReviewSchema.parse(review),
  );
  const expectedLabels = new Set(
    args.pack.entries.map((entry) => entry.blindLabel),
  );
  const reviewByLabel = new Map<string, CompletedCoverLetterBlindReview>();
  for (const review of reviews) {
    if (review.packHash !== args.pack.packHash) {
      throw new Error(
        `Blind review ${review.blindLabel} belongs to a different pack hash.`,
      );
    }
    if (!expectedLabels.has(review.blindLabel)) {
      throw new Error(`Unknown blind-review label: ${review.blindLabel}.`);
    }
    if (reviewByLabel.has(review.blindLabel)) {
      throw new Error(`Duplicate blind review: ${review.blindLabel}.`);
    }
    reviewByLabel.set(review.blindLabel, review);
  }
  const missingLabels = [...expectedLabels].filter(
    (blindLabel) => !reviewByLabel.has(blindLabel),
  );
  if (missingLabels.length > 0) {
    throw new Error(`Blind reviews are missing: ${missingLabels.join(", ")}.`);
  }

  const packEntryByLabel = new Map(
    args.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const revealByLabel = new Map(
    args.revealMap.entries.map((entry) => [entry.blindLabel, entry]),
  );
  if (revealByLabel.size !== expectedLabels.size) {
    throw new Error(
      "Blind-review reveal map has an incomplete or duplicate set.",
    );
  }

  return [...expectedLabels].sort().map((blindLabel) => {
    const review = reviewByLabel.get(blindLabel)!;
    const packEntry = packEntryByLabel.get(blindLabel)!;
    const reveal = revealByLabel.get(blindLabel);
    if (!reveal) {
      throw new Error(`Blind-review reveal map is missing ${blindLabel}.`);
    }
    const missingReviewerLanguages = packEntry.requiredReviewerLanguages.filter(
      (language) => !review.reviewerLanguages.includes(language),
    );
    if (missingReviewerLanguages.length > 0) {
      throw new Error(
        `Blind review ${blindLabel} is missing required reviewer languages: ${missingReviewerLanguages.join(", ")}.`,
      );
    }
    return { review, reveal };
  });
}

function renderFencedBlock(content: string, language = "text"): string[] {
  const longestBacktickRun = Math.max(
    0,
    ...(content.match(/`+/gu) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return [`${fence}${language}`, content, fence];
}

export function renderCoverLetterBlindReviewMarkdown(
  pack: CoverLetterBlindReviewPack,
): string {
  const lines = [
    "# Cover-letter blind human review",
    "",
    `Cohort: ${pack.cohortId}`,
    `Run: ${pack.runId}`,
    `Source: ${pack.sourceRef}`,
    `Pack hash: ${pack.packHash}`,
    `Rubric: ${pack.rubricVersion}`,
    "",
    "## Reviewer instructions",
    "",
    ...pack.instructions.map((instruction) => `- ${instruction}`),
    "",
    "## Rubric",
    "",
    ...Object.entries(pack.rubric)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([criterion, definition]) => `- \`${criterion}\`: ${definition}`),
  ];

  for (const entry of pack.entries) {
    lines.push(
      "",
      `## ${entry.blindLabel}`,
      "",
      `Output language: ${entry.outputLanguage}`,
      `Required reviewer language: ${entry.requiredReviewerLanguages.join(", ")}`,
      `Job source language: ${entry.job.sourceLanguage}`,
      `Candidate-evidence source language: ${entry.candidateEvidenceSourceLanguage ?? "none"}`,
      "",
      "### Job",
      "",
      ...renderFencedBlock(`${entry.job.title}\n\n${entry.job.description}`),
      "",
      "### Candidate evidence",
      "",
      ...renderFencedBlock(
        JSON.stringify(entry.candidateEvidence, null, 2),
        "json",
      ),
      "",
      "### Finalized letter",
      "",
      ...renderFencedBlock(entry.finalizedLetter),
      "",
      "### Review template",
      "",
      ...renderFencedBlock(
        JSON.stringify(
          {
            ...entry.reviewTemplate,
            blindLabel: entry.blindLabel,
            packHash: pack.packHash,
          },
          null,
          2,
        ),
        "json",
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function writeCoverLetterBlindReviewArtifacts(args: {
  outputDirectory: string;
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
}): Promise<{
  packJsonPath: string;
  revealMapJsonPath: string;
  packMarkdownPath: string;
}> {
  if (!args.outputDirectory.trim()) {
    throw new Error("An explicit blind-review output directory is required.");
  }
  const outputDirectory = path.resolve(args.outputDirectory);
  const reviewerDirectory = path.join(outputDirectory, "reviewer");
  const privateDirectory = path.join(outputDirectory, "private-reveal");
  await Promise.all([
    mkdir(reviewerDirectory, { recursive: true }),
    mkdir(privateDirectory, { recursive: true }),
  ]);
  const packJsonPath = path.join(reviewerDirectory, "blind-review-pack.json");
  const revealMapJsonPath = path.join(
    privateDirectory,
    "blind-review-reveal-map.json",
  );
  const packMarkdownPath = path.join(reviewerDirectory, "blind-review-pack.md");
  await Promise.all([
    writeFile(packJsonPath, `${JSON.stringify(args.pack, null, 2)}\n`, "utf8"),
    writeFile(
      revealMapJsonPath,
      `${JSON.stringify(args.revealMap, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      packMarkdownPath,
      renderCoverLetterBlindReviewMarkdown(args.pack),
      "utf8",
    ),
  ]);
  return { packJsonPath, revealMapJsonPath, packMarkdownPath };
}
