import { randomUUID } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import type { CoverLetterBenchmarkCase } from "./cases/cover-letter/cases";
import {
  buildCoverLetterEvalTransportMetadata,
  type CoverLetterEvalTransportInput,
  type CoverLetterEvalTransportMetadata,
  type CoverLetterEvalPricedWriterModel,
  type CoverLetterEvalSdkVersions,
  type CoverLetterEvalTokenUsage,
} from "./cover-letter-eval-run-manifest";

export const QUALITY_EVAL_2D_COHORT_ID = "quality-eval-2d-five-model-sample-v1";
export const QUALITY_EVAL_2D_CASE_ID = "blind-en-clean-engaging-direct";
export const QUALITY_EVAL_2D_WRITER_MODELS = [
  "gpt-5.5",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "mistral-medium-latest",
] as const satisfies readonly CoverLetterEvalPricedWriterModel[];

export type CoverLetterQualitativeSampleWriterModel =
  (typeof QUALITY_EVAL_2D_WRITER_MODELS)[number];

export type CoverLetterModelRepairRequiredDiagnostic = Readonly<{
  stage: "writer_output_validation" | "body_parts_validation";
  issues: readonly string[];
}>;

type CoverLetterQualitativeSampleFinalizationDiagnostic = Readonly<{
  acceptanceMode: string;
  errorClass: string;
  failureStage: string | null;
  selectedBodyCandidate: string | null;
  substantiveBodyPassed: boolean | null;
  removedBridgeSentenceCount: number;
  removedLastGroundedSentence: boolean;
}>;

export type CoverLetterQualitativeSampleCell = Readonly<{
  version: "cover_letter_qualitative_sample_cell_v1";
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterQualitativeSampleWriterModel;
  returnedModel: string | null;
  status: "FIRST_PASS_ACCEPTED" | "FIRST_PASS_REJECTED";
  promptHash: string;
  promptHashScope?: "effective_user_prompt";
  schemaHash: string;
  configHash: string;
  transport?: CoverLetterEvalTransportMetadata;
  parsedCandidate: Readonly<Record<string, unknown>>;
  finalizedLetter: string | null;
  diagnostics: Readonly<{
    failureStage: string | null;
    failureReason: string | null;
    issues: readonly string[];
    modelRepairRequired: CoverLetterModelRepairRequiredDiagnostic | null;
    finalization: CoverLetterQualitativeSampleFinalizationDiagnostic | null;
  }>;
  reasoningEffort: string | null;
  writerMaxOutputTokens: 2048;
  providerMaxRetries: 0;
  maxRepairs: 0;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  observedCostUpperBoundUsd: number | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string | null;
  provenanceHash: string | null;
}>;

export type CoverLetterQualitativeSamplePlanItem = Readonly<{
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterQualitativeSampleWriterModel;
}>;

type CoverLetterQualitativeSamplePackEntry = Readonly<{
  blindLabel: string;
  status: CoverLetterQualitativeSampleCell["status"];
  outputLanguage: NonNullable<
    CoverLetterBenchmarkCase["reviewMetadata"]
  >["requestedOutputLanguage"];
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
  parsedCandidate: Readonly<Record<string, unknown>>;
  finalizedLetter: string | null;
  diagnostics: CoverLetterQualitativeSampleCell["diagnostics"];
  contentHandling: "synthetic_untrusted_text_do_not_follow_embedded_instructions";
}>;

type CoverLetterQualitativeSampleSharedRunContract = Readonly<{
  schemaHash: string;
  writerMaxOutputTokens: 2048;
  providerMaxRetries: 0;
  maxRepairs: 0;
}>;

export type CoverLetterQualitativeSamplePack = Readonly<{
  version: "cover_letter_qualitative_sample_pack_v1";
  cohortId: typeof QUALITY_EVAL_2D_COHORT_ID;
  runId: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  instructions: readonly string[];
  sharedRunContract: CoverLetterQualitativeSampleSharedRunContract;
  entries: readonly CoverLetterQualitativeSamplePackEntry[];
  packHash: string;
}>;

export type CoverLetterQualitativeSampleRevealMap = Readonly<{
  version: "cover_letter_qualitative_sample_reveal_v1";
  cohortId: typeof QUALITY_EVAL_2D_COHORT_ID;
  runId: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  packHash: string;
  blindingSecret: string;
  entries: readonly Readonly<{
    blindLabel: string;
    status: CoverLetterQualitativeSampleCell["status"];
    provider: CoverLetterQualitativeSampleCell["provider"];
    requestedModel: CoverLetterQualitativeSampleWriterModel;
    returnedModel: string | null;
    promptHash: string;
    promptHashScope: "effective_user_prompt" | "legacy_unspecified";
    schemaHash: string;
    configHash: string;
    transport: CoverLetterEvalTransportMetadata | null;
    tokenUsage: CoverLetterEvalTokenUsage | null;
    observedCostUpperBoundUsd: number | null;
    sdkVersions: CoverLetterEvalSdkVersions;
    artifactHash: string | null;
    provenanceHash: string | null;
  }>[];
  revealMapHash: string;
}>;

export type CoverLetterQualitativeSampleArtifacts = Readonly<{
  pack: CoverLetterQualitativeSamplePack;
  revealMap: CoverLetterQualitativeSampleRevealMap;
}>;

export function classifyCoverLetterQualitativeSampleOutcome(args: {
  accepted: boolean;
  modelRepairRequired: CoverLetterModelRepairRequiredDiagnostic | null;
  failureStage: string | null;
  resultStatus: string | null;
  artifactDecision: "accepted" | "rejected" | null;
}): "FIRST_PASS_ACCEPTED" | "FIRST_PASS_REJECTED" | "SYSTEMIC_FAILURE" {
  if (args.accepted) return "FIRST_PASS_ACCEPTED";
  if (
    args.modelRepairRequired !== null ||
    args.failureStage === "validation" ||
    (args.resultStatus === "finalization_failed" &&
      args.artifactDecision === "rejected")
  ) {
    return "FIRST_PASS_REJECTED";
  }
  return "SYSTEMIC_FAILURE";
}

function assertExactWriterSet(
  writerModels: readonly string[],
  label: string,
): asserts writerModels is readonly CoverLetterQualitativeSampleWriterModel[] {
  const actual = new Set(writerModels);
  const exact =
    writerModels.length === QUALITY_EVAL_2D_WRITER_MODELS.length &&
    actual.size === QUALITY_EVAL_2D_WRITER_MODELS.length &&
    QUALITY_EVAL_2D_WRITER_MODELS.every((writerModel) =>
      actual.has(writerModel),
    );
  if (!exact) {
    throw new Error(
      `${label} requires the exact five-model sample: ${QUALITY_EVAL_2D_WRITER_MODELS.join(", ")}.`,
    );
  }
}

function cloneParsedCandidate(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A parsed structured candidate object is required.");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("The parsed structured candidate is not serializable.");
  }
  const clone = JSON.parse(serialized) as unknown;
  if (!clone || typeof clone !== "object" || Array.isArray(clone)) {
    throw new Error("The parsed structured candidate must remain an object.");
  }
  return clone as Readonly<Record<string, unknown>>;
}

function normalizeIssues(issues: readonly string[]): string[] {
  return [
    ...new Set(issues.map((issue) => issue.trim()).filter(Boolean)),
  ].sort();
}

export function buildCoverLetterQualitativeSamplePlan(args: {
  cases: readonly CoverLetterBenchmarkCase[];
}): CoverLetterQualitativeSamplePlanItem[] {
  const matches = args.cases.filter(
    (benchmarkCase) => benchmarkCase.id === QUALITY_EVAL_2D_CASE_ID,
  );
  if (matches.length !== 1) {
    throw new Error(
      `QUALITY-EVAL-2D requires exactly one ${QUALITY_EVAL_2D_CASE_ID} case; found ${matches.length}.`,
    );
  }
  return QUALITY_EVAL_2D_WRITER_MODELS.map((writerModel) => ({
    benchmarkCase: matches[0]!,
    writerModel,
  }));
}

export async function runCoverLetterQualitativeSampleCohort(args: {
  writerModels: readonly CoverLetterQualitativeSampleWriterModel[];
  sampleCell: (
    writerModel: CoverLetterQualitativeSampleWriterModel,
  ) => Promise<CoverLetterQualitativeSampleCell>;
  onCompletedCell?: (args: {
    cell: CoverLetterQualitativeSampleCell;
    index: number;
  }) => Promise<void>;
}): Promise<CoverLetterQualitativeSampleCell[]> {
  assertExactWriterSet(args.writerModels, "Qualitative sample execution");
  const cells: CoverLetterQualitativeSampleCell[] = [];
  for (const writerModel of QUALITY_EVAL_2D_WRITER_MODELS) {
    const cell = await args.sampleCell(writerModel);
    if (cell.requestedModel !== writerModel) {
      throw new Error(
        `Qualitative sample returned ${cell.requestedModel} for requested writer ${writerModel}.`,
      );
    }
    await args.onCompletedCell?.({ cell, index: cells.length });
    cells.push(cell);
  }
  return cells;
}

export async function buildCoverLetterQualitativeSampleCell(args: {
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterQualitativeSampleWriterModel;
  returnedModel: string | null;
  status: CoverLetterQualitativeSampleCell["status"];
  prompt: string;
  schema: Record<string, unknown>;
  transport: CoverLetterEvalTransportInput;
  frozenConfig: unknown;
  parsedCandidate: unknown;
  finalizedLetter: string | null;
  diagnostics: CoverLetterQualitativeSampleCell["diagnostics"];
  reasoningEffort: string | null;
  writerMaxOutputTokens: number;
  providerMaxRetries: number;
  maxRepairs: number;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  observedCostUpperBoundUsd: number | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string | null;
  provenanceHash: string | null;
}): Promise<CoverLetterQualitativeSampleCell> {
  if (args.caseId !== QUALITY_EVAL_2D_CASE_ID) {
    throw new Error(
      `Qualitative samples require the fixed synthetic case ${QUALITY_EVAL_2D_CASE_ID}.`,
    );
  }
  if (args.writerMaxOutputTokens !== 2_048) {
    throw new Error("Qualitative samples require writerMaxOutputTokens=2048.");
  }
  if (args.providerMaxRetries !== 0 || args.maxRepairs !== 0) {
    throw new Error("Qualitative samples require retries=0 and repairs=0.");
  }
  const finalizedLetter = args.finalizedLetter?.trim() || null;
  if ((args.status === "FIRST_PASS_ACCEPTED") !== (finalizedLetter !== null)) {
    throw new Error(
      "FIRST_PASS_ACCEPTED requires one finalized letter; FIRST_PASS_REJECTED must not claim one.",
    );
  }
  const issues = normalizeIssues(args.diagnostics.issues);
  return {
    version: "cover_letter_qualitative_sample_cell_v1",
    caseId: QUALITY_EVAL_2D_CASE_ID,
    provider: args.provider,
    requestedModel: args.requestedModel,
    returnedModel: args.returnedModel?.trim() || null,
    status: args.status,
    promptHash: await buildStableHash({
      namespace: "cover-letter-qualitative-sample",
      type: "writer-prompt",
      version: 1,
      prompt: args.prompt,
    }),
    promptHashScope: "effective_user_prompt",
    schemaHash: await buildStableHash({
      namespace: "cover-letter-qualitative-sample",
      type: "writer-schema",
      version: 1,
      schema: args.schema,
    }),
    transport: await buildCoverLetterEvalTransportMetadata(args.transport),
    configHash: await buildStableHash({
      namespace: "cover-letter-qualitative-sample",
      type: "frozen-config",
      version: 1,
      config: args.frozenConfig,
    }),
    parsedCandidate: cloneParsedCandidate(args.parsedCandidate),
    finalizedLetter,
    diagnostics: {
      failureStage: args.diagnostics.failureStage,
      failureReason: args.diagnostics.failureReason,
      issues,
      modelRepairRequired: args.diagnostics.modelRepairRequired
        ? {
            stage: args.diagnostics.modelRepairRequired.stage,
            issues: normalizeIssues(
              args.diagnostics.modelRepairRequired.issues,
            ),
          }
        : null,
      finalization: args.diagnostics.finalization
        ? { ...args.diagnostics.finalization }
        : null,
    },
    reasoningEffort: args.reasoningEffort,
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    maxRepairs: 0,
    tokenUsage: args.tokenUsage ? { ...args.tokenUsage } : null,
    observedCostUpperBoundUsd: args.observedCostUpperBoundUsd,
    sdkVersions: { ...args.sdkVersions },
    artifactHash: args.artifactHash,
    provenanceHash: args.provenanceHash,
  };
}

async function hashPackBody(
  pack: Omit<CoverLetterQualitativeSamplePack, "packHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "blind-pack",
    version: 1,
    pack,
  });
}

async function hashRevealBody(
  revealMap: Omit<CoverLetterQualitativeSampleRevealMap, "revealMapHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "reveal-map",
    version: 1,
    revealMap,
  });
}

export async function buildCoverLetterQualitativeSampleArtifacts(args: {
  cohortId: string;
  runId: string;
  sourceRef: string;
  benchmarkCase: CoverLetterBenchmarkCase;
  cells: readonly CoverLetterQualitativeSampleCell[];
  blindingSecret?: string;
}): Promise<CoverLetterQualitativeSampleArtifacts> {
  if (args.cohortId !== QUALITY_EVAL_2D_COHORT_ID) {
    throw new Error(`Unexpected qualitative sample cohort: ${args.cohortId}.`);
  }
  if (!args.runId.trim() || !args.sourceRef.trim()) {
    throw new Error("runId and sourceRef must be non-empty.");
  }
  if (args.benchmarkCase.id !== QUALITY_EVAL_2D_CASE_ID) {
    throw new Error(
      `Unexpected qualitative sample case: ${args.benchmarkCase.id}.`,
    );
  }
  const metadata = args.benchmarkCase.reviewMetadata;
  if (!metadata) {
    throw new Error("The qualitative sample case requires review metadata.");
  }
  assertExactWriterSet(
    args.cells.map((cell) => cell.requestedModel),
    "Qualitative sample artifacts",
  );
  if (args.cells.some((cell) => cell.caseId !== QUALITY_EVAL_2D_CASE_ID)) {
    throw new Error("Qualitative sample cells contain an unexpected case.");
  }
  const schemaHashes = new Set(args.cells.map((cell) => cell.schemaHash));
  if (schemaHashes.size !== 1) {
    throw new Error(
      "Qualitative sample blind artifacts require one shared schema hash.",
    );
  }
  const blindingSecret = args.blindingSecret ?? randomUUID();
  if (blindingSecret.trim().length < 32) {
    throw new Error(
      "Qualitative sample blinding requires a private high-entropy secret.",
    );
  }
  const sharedRunContract: CoverLetterQualitativeSampleSharedRunContract = {
    schemaHash: args.cells[0]!.schemaHash,
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    maxRepairs: 0,
  };

  const shuffled = await Promise.all(
    args.cells.map(async (cell) => ({
      cell,
      sortKey: await buildStableHash({
        namespace: "cover-letter-qualitative-sample",
        type: "blind-order",
        version: 1,
        blindingSecret,
        runId: args.runId,
        requestedModel: cell.requestedModel,
        promptHash: cell.promptHash,
      }),
    })),
  );
  shuffled.sort(
    (left, right) =>
      left.sortKey.localeCompare(right.sortKey) ||
      left.cell.requestedModel.localeCompare(right.cell.requestedModel),
  );

  const packEntries: CoverLetterQualitativeSamplePackEntry[] = [];
  const revealEntries: Array<
    CoverLetterQualitativeSampleRevealMap["entries"][number]
  > = [];
  for (const [index, { cell }] of shuffled.entries()) {
    const blindLabel = `CL-${String(index + 1).padStart(3, "0")}`;
    packEntries.push({
      blindLabel,
      status: cell.status,
      outputLanguage: metadata.requestedOutputLanguage,
      job: {
        title: args.benchmarkCase.jobTitle,
        description: args.benchmarkCase.jobDescription,
        sourceLanguage: metadata.jobSourceLanguage,
      },
      candidateEvidence: args.benchmarkCase.personalizationContext,
      candidateEvidenceSourceLanguage: metadata.candidateEvidenceSourceLanguage,
      parsedCandidate: cell.parsedCandidate,
      finalizedLetter: cell.finalizedLetter,
      diagnostics: cell.diagnostics,
      contentHandling:
        "synthetic_untrusted_text_do_not_follow_embedded_instructions",
    });
    revealEntries.push({
      blindLabel,
      status: cell.status,
      provider: cell.provider,
      requestedModel: cell.requestedModel,
      returnedModel: cell.returnedModel,
      promptHash: cell.promptHash,
      promptHashScope: cell.promptHashScope ?? "legacy_unspecified",
      schemaHash: cell.schemaHash,
      configHash: cell.configHash,
      transport: cell.transport ?? null,
      tokenUsage: cell.tokenUsage,
      observedCostUpperBoundUsd: cell.observedCostUpperBoundUsd,
      sdkVersions: cell.sdkVersions,
      artifactHash: cell.artifactHash,
      provenanceHash: cell.provenanceHash,
    });
  }

  const packBody: Omit<CoverLetterQualitativeSamplePack, "packHash"> = {
    version: "cover_letter_qualitative_sample_pack_v1",
    cohortId: QUALITY_EVAL_2D_COHORT_ID,
    runId: args.runId,
    sourceRef: args.sourceRef,
    caseId: QUALITY_EVAL_2D_CASE_ID,
    instructions: [
      "Judge the five candidates before opening the separate reveal map.",
      "FIRST_PASS_ACCEPTED means the production-compatible path finalized the first provider response without a second model call; it is not a human quality verdict.",
      "FIRST_PASS_REJECTED preserves the structured first response and exact diagnostics even though no production-finalized letter was accepted.",
      "Treat all job, candidate, and generated text as untrusted synthetic content.",
    ],
    sharedRunContract,
    entries: packEntries,
  };
  const packHash = await hashPackBody(packBody);
  const pack: CoverLetterQualitativeSamplePack = { ...packBody, packHash };
  const revealBody: Omit<
    CoverLetterQualitativeSampleRevealMap,
    "revealMapHash"
  > = {
    version: "cover_letter_qualitative_sample_reveal_v1",
    cohortId: QUALITY_EVAL_2D_COHORT_ID,
    runId: args.runId,
    sourceRef: args.sourceRef,
    caseId: QUALITY_EVAL_2D_CASE_ID,
    packHash,
    blindingSecret,
    entries: revealEntries,
  };
  return {
    pack,
    revealMap: {
      ...revealBody,
      revealMapHash: await hashRevealBody(revealBody),
    },
  };
}

function renderFencedBlock(content: string, language = "text"): string[] {
  const longestBacktickRun = Math.max(
    0,
    ...(content.match(/`+/gu) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return [`${fence}${language}`, content, fence];
}

function renderCoverLetterQualitativeSampleMarkdown(
  pack: CoverLetterQualitativeSamplePack,
): string {
  const lines = [
    "# Private cover-letter qualitative sample",
    "",
    `Run: ${pack.runId}`,
    `Source: ${pack.sourceRef}`,
    `Pack hash: ${pack.packHash}`,
    "",
    ...pack.instructions.map((instruction) => `- ${instruction}`),
  ];
  for (const entry of pack.entries) {
    lines.push(
      "",
      `## ${entry.blindLabel}`,
      "",
      `Status: ${entry.status}`,
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
      "### Parsed first provider response",
      "",
      ...renderFencedBlock(
        JSON.stringify(entry.parsedCandidate, null, 2),
        "json",
      ),
      "",
      "### Production-finalized letter",
      "",
      ...renderFencedBlock(
        entry.finalizedLetter ??
          "No finalized letter: the first provider response was rejected and no model-assisted repair was permitted.",
      ),
      "",
      "### First-pass diagnostics",
      "",
      ...renderFencedBlock(JSON.stringify(entry.diagnostics, null, 2), "json"),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function writePrivateFileAtomic(args: {
  directory: string;
  fileName: string;
  content: string;
}): Promise<string> {
  await mkdir(args.directory, { recursive: true, mode: 0o700 });
  await chmod(args.directory, 0o700);
  const filePath = path.join(args.directory, args.fileName);
  const temporaryPath = path.join(
    args.directory,
    `.${args.fileName}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, args.content, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  await chmod(filePath, 0o600);
  return filePath;
}

export async function writeCoverLetterQualitativeSampleCellEvidence(args: {
  outputDirectory: string;
  index: number;
  cell: CoverLetterQualitativeSampleCell;
}): Promise<string> {
  if (!Number.isInteger(args.index) || args.index < 0 || args.index >= 5) {
    throw new Error("Qualitative sample cell index must be between 0 and 4.");
  }
  const expectedModel = QUALITY_EVAL_2D_WRITER_MODELS[args.index];
  if (args.cell.requestedModel !== expectedModel) {
    throw new Error(
      `Qualitative sample cell ${args.index + 1} expected ${expectedModel}; received ${args.cell.requestedModel}.`,
    );
  }
  const outputDirectory = path.resolve(args.outputDirectory);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  return writePrivateFileAtomic({
    directory: path.join(outputDirectory, "private-evidence"),
    fileName: `sample-cell-${String(args.index + 1).padStart(3, "0")}.json`,
    content: `${JSON.stringify(args.cell, null, 2)}\n`,
  });
}

export async function writeCoverLetterQualitativeSampleArtifacts(args: {
  outputDirectory: string;
  pack: CoverLetterQualitativeSamplePack;
  revealMap: CoverLetterQualitativeSampleRevealMap;
}): Promise<{
  packJsonPath: string;
  packMarkdownPath: string;
  revealMapJsonPath: string;
}> {
  if (!args.outputDirectory.trim()) {
    throw new Error(
      "An explicit qualitative sample output directory is required.",
    );
  }
  const outputDirectory = path.resolve(args.outputDirectory);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  const reviewDirectory = path.join(outputDirectory, "private-review");
  const revealDirectory = path.join(outputDirectory, "private-reveal");
  const packJsonPath = await writePrivateFileAtomic({
    directory: reviewDirectory,
    fileName: "qualitative-sample-pack.json",
    content: `${JSON.stringify(args.pack, null, 2)}\n`,
  });
  const packMarkdownPath = await writePrivateFileAtomic({
    directory: reviewDirectory,
    fileName: "qualitative-sample-pack.md",
    content: renderCoverLetterQualitativeSampleMarkdown(args.pack),
  });
  const revealMapJsonPath = await writePrivateFileAtomic({
    directory: revealDirectory,
    fileName: "qualitative-sample-reveal-map.json",
    content: `${JSON.stringify(args.revealMap, null, 2)}\n`,
  });
  return { packJsonPath, packMarkdownPath, revealMapJsonPath };
}
