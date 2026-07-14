import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluatePremiumCoverLetterQualityShadow,
  isCoverLetterPremiumPromptV2Enabled,
  isCoverLetterQualityRepairV1Enabled,
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  type CoverLetterBodyParts,
  type PremiumCoverLetterQualityShadowResult,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  finalizePremiumCoverLetterPayloadForPersistence,
  inspectProposalFinalization,
} from "../../convex/generateProposalMutation";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  buildCoverLetterEvalFrozenConfig,
  generatePremiumCoverLetterBenchmarkLetter,
  resolveCoverLetterBenchmarkProductionInputs,
  resolveQualityEval2DSharedWriterPrompt,
} from "./benchmark-cover-letter-writers";
import {
  coverLetterBlindReviewCases,
  type CoverLetterBenchmarkCase,
} from "./cases/cover-letter/cases";
import {
  QUALITY_EVAL_2D_CASE_ID,
  QUALITY_EVAL_2D_WRITER_MODELS,
  type CoverLetterQualitativeSampleCell,
  type CoverLetterQualitativeSampleWriterModel,
} from "./cover-letter-qualitative-sample";

const QUALITY_EVAL_2E_COHORT_ID =
  "quality-eval-2e-final-artifact-attribution-shadow-v1";

const SECTION_ORDER = [
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
] as const satisfies readonly (keyof CoverLetterBodyParts)[];

type SectionName = (typeof SECTION_ORDER)[number];
type VariantLabel = "A" | "B";
type FinalizerVariant = "recorded_path" | "structured_path";
type SectionRetentionStatus = "retained_exact" | "retained_partial" | "removed";

type QualityShadowProjection = Readonly<{
  passed: boolean;
  score: number;
  issues: readonly string[];
}>;

type ArtifactSummary = Readonly<{
  content: string;
  contentHash: string;
  wordCount: number;
  paragraphCount: number;
  bodyWordCount: number;
  bodyParagraphCount: number;
  structurePreserved: boolean;
  qualityShadow: QualityShadowProjection | null;
}>;

type SectionVariantAttribution = Readonly<{
  status: SectionRetentionStatus;
  retainedSentenceCount: number;
  sourceSentenceCount: number;
  reason:
    | "full_section_present"
    | "some_source_sentences_present"
    | "source_section_not_present"
    | "rendered_from_validated_structured_body_parts";
}>;

export type CoverLetterFinalArtifactShadowReplay = Readonly<{
  version: "cover_letter_final_artifact_shadow_replay_v1";
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  cellOrdinal: number;
  provider: CoverLetterQualitativeSampleCell["provider"];
  requestedModel: CoverLetterQualitativeSampleWriterModel;
  returnedModel: string | null;
  recordedInputIdentity: Readonly<{
    promptHash: string;
    schemaHash: string;
    configHash: string;
    artifactHash: string | null;
    provenanceHash: string | null;
  }>;
  localWriterCallCount: 1;
  providerCallCount: 0;
  baseline: ArtifactSummary &
    Readonly<{
      byteIdentical: true;
      selectedBodyCandidate: string | null;
      acceptanceMode: string;
    }>;
  candidate: ArtifactSummary;
  sections: readonly Readonly<{
    section: SectionName;
    sourceText: string;
    sourceTextHash: string;
    production: SectionVariantAttribution;
    candidate: SectionVariantAttribution;
  }>[];
  qualityShadowFallback: Readonly<{
    conditionTriggered: boolean;
    visibleStructureLoss: boolean;
    projectionMatchesPreFinalizerBodyParts: boolean;
    signatureObserved: boolean;
    diagnostic: "structure_loss" | "none";
    finalArtifactBodyParagraphCount: number;
    preFinalizerBodyPartsProjection: QualityShadowProjection;
    persistedProjection: QualityShadowProjection | null;
  }>;
}>;

type BlindVariant = Readonly<{
  label: VariantLabel;
  letter: string;
  wordCount: number;
  paragraphCount: number;
}>;

export type CoverLetterFinalArtifactShadowPack = Readonly<{
  version: "cover_letter_final_artifact_shadow_pack_v1";
  cohortId: typeof QUALITY_EVAL_2E_COHORT_ID;
  runId: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  instructions: readonly string[];
  entries: readonly Readonly<{
    pairLabel: string;
    outputLanguage: string;
    job: Readonly<{ title: string; description: string }>;
    profileEvidence: CoverLetterBenchmarkCase["personalizationContext"];
    variantA: BlindVariant;
    variantB: BlindVariant;
    contentHandling: "synthetic_untrusted_text";
  }>[];
  packHash: string;
}>;

export type CoverLetterFinalArtifactShadowRevealMap = Readonly<{
  version: "cover_letter_final_artifact_shadow_reveal_v1";
  cohortId: typeof QUALITY_EVAL_2E_COHORT_ID;
  runId: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  packHash: string;
  blindingSecret: string;
  entries: readonly Readonly<{
    pairLabel: string;
    provider: CoverLetterQualitativeSampleCell["provider"];
    requestedModel: CoverLetterQualitativeSampleWriterModel;
    returnedModel: string | null;
    variantA: FinalizerVariant;
    variantB: FinalizerVariant;
    promptHash: string;
    schemaHash: string;
    configHash: string;
    artifactHash: string | null;
    provenanceHash: string | null;
  }>[];
  revealMapHash: string;
}>;

export type CoverLetterFinalArtifactShadowDiagnostics = Readonly<{
  version: "cover_letter_final_artifact_shadow_diagnostics_v1";
  cohortId: typeof QUALITY_EVAL_2E_COHORT_ID;
  runId: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_2D_CASE_ID;
  packHash: string;
  providerCalls: 0;
  modelRepairs: 0;
  entries: readonly Readonly<{
    pairLabel: string;
    cellOrdinal: number;
    recordedVariant: VariantLabel;
    structuredVariant: VariantLabel;
    replay: Omit<
      CoverLetterFinalArtifactShadowReplay,
      "provider" | "requestedModel" | "returnedModel"
    >;
  }>[];
  diagnosticsHash: string;
}>;

export type CoverLetterFinalArtifactShadowArtifacts = Readonly<{
  pack: CoverLetterFinalArtifactShadowPack;
  revealMap: CoverLetterFinalArtifactShadowRevealMap;
  diagnostics: CoverLetterFinalArtifactShadowDiagnostics;
}>;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function utf8BytesEqual(left: string, right: string): boolean {
  return Buffer.from(left, "utf8").equals(Buffer.from(right, "utf8"));
}

function countWords(value: string): number {
  const compact = compactWhitespace(value);
  return compact ? compact.split(" ").length : 0;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(value: string): string[] {
  const compact = compactWhitespace(value);
  if (!compact) return [];
  return compact
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/gu)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractBodyParagraphs(args: {
  content: string;
  candidateName?: string;
}): string[] {
  const candidateName = compactWhitespace(args.candidateName ?? "");
  return splitParagraphs(args.content).filter((paragraph) => {
    const compact = compactWhitespace(paragraph);
    if (/^Dear Hiring Manager,?$/iu.test(compact)) return false;
    if (/^(?:Sincerely|Best regards|Kind regards),?/iu.test(compact)) {
      return false;
    }
    if (candidateName && compact === candidateName) return false;
    return true;
  });
}

function hasExactSectionStructure(args: {
  content: string;
  bodyParts: CoverLetterBodyParts;
  candidateName?: string;
}): boolean {
  const paragraphs = extractBodyParagraphs(args).map((paragraph) =>
    compactWhitespace(paragraph),
  );
  const sectionIndexes = SECTION_ORDER.map((section) => {
    const source = compactWhitespace(args.bodyParts[section]);
    const matchingIndexes = paragraphs.flatMap((paragraph, index) =>
      paragraph === source ? [index] : [],
    );
    return matchingIndexes.length === 1 ? matchingIndexes[0]! : -1;
  });
  return sectionIndexes.every(
    (index, position) =>
      index >= 0 && (position === 0 || index > sectionIndexes[position - 1]!),
  );
}

function projectQualityShadow(
  value: PremiumCoverLetterQualityShadowResult | undefined,
): QualityShadowProjection | null {
  if (!value) return null;
  return {
    passed: value.passed,
    score: value.score,
    issues: [...new Set(value.issues)].sort(),
  };
}

function qualityShadowProjectionsEqual(
  left: QualityShadowProjection | null,
  right: QualityShadowProjection | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function hashContent(type: string, content: unknown): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-final-artifact-attribution-shadow",
    type,
    version: 1,
    content,
  });
}

async function hashQualitativeSchema(): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "writer-schema",
    version: 1,
    schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  });
}

async function hashQualitativePrompt(prompt: string): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "writer-prompt",
    version: 1,
    prompt,
  });
}

async function hashQualitativeConfig(config: unknown): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "frozen-config",
    version: 1,
    config,
  });
}

function assertExactAcceptedCells(
  cells: readonly CoverLetterQualitativeSampleCell[],
): CoverLetterQualitativeSampleCell[] {
  const models = cells.map((cell) => cell.requestedModel);
  const modelSet = new Set(models);
  const exact =
    cells.length === QUALITY_EVAL_2D_WRITER_MODELS.length &&
    modelSet.size === QUALITY_EVAL_2D_WRITER_MODELS.length &&
    QUALITY_EVAL_2D_WRITER_MODELS.every((model) => modelSet.has(model));
  if (!exact) {
    throw new Error(
      `QUALITY-EVAL-2E requires the exact five QUALITY-EVAL-2D cells.`,
    );
  }
  for (const cell of cells) {
    if (
      cell.version !== "cover_letter_qualitative_sample_cell_v1" ||
      cell.caseId !== QUALITY_EVAL_2D_CASE_ID
    ) {
      throw new Error("QUALITY-EVAL-2E received an incompatible sample cell.");
    }
    if (cell.status !== "FIRST_PASS_ACCEPTED" || !cell.finalizedLetter) {
      throw new Error(
        "QUALITY-EVAL-2E requires five FIRST_PASS_ACCEPTED cells with recorded final letters.",
      );
    }
  }
  return QUALITY_EVAL_2D_WRITER_MODELS.map(
    (model) => cells.find((cell) => cell.requestedModel === model)!,
  );
}

function attributeSection(args: {
  sourceText: string;
  artifactContent: string;
  structuredVariant: boolean;
}): SectionVariantAttribution {
  const normalizedSource = compactWhitespace(args.sourceText).toLowerCase();
  const normalizedArtifact = compactWhitespace(
    args.artifactContent,
  ).toLowerCase();
  const sourceSentences = splitSentences(args.sourceText);
  const retainedSentenceCount = sourceSentences.filter((sentence) =>
    normalizedArtifact.includes(compactWhitespace(sentence).toLowerCase()),
  ).length;
  if (normalizedSource && normalizedArtifact.includes(normalizedSource)) {
    return {
      status: "retained_exact",
      retainedSentenceCount: sourceSentences.length,
      sourceSentenceCount: sourceSentences.length,
      reason: args.structuredVariant
        ? "rendered_from_validated_structured_body_parts"
        : "full_section_present",
    };
  }
  if (retainedSentenceCount > 0) {
    return {
      status: "retained_partial",
      retainedSentenceCount,
      sourceSentenceCount: sourceSentences.length,
      reason: "some_source_sentences_present",
    };
  }
  return {
    status: "removed",
    retainedSentenceCount: 0,
    sourceSentenceCount: sourceSentences.length,
    reason: "source_section_not_present",
  };
}

async function summarizeArtifact(args: {
  content: string;
  candidateName?: string;
  qualityShadow?: PremiumCoverLetterQualityShadowResult;
  structurePreserved: boolean;
}): Promise<ArtifactSummary> {
  const paragraphs = splitParagraphs(args.content);
  const bodyParagraphs = extractBodyParagraphs({
    content: args.content,
    candidateName: args.candidateName,
  });
  return {
    content: args.content,
    contentHash: await hashContent("final-artifact", args.content),
    wordCount: countWords(args.content),
    paragraphCount: paragraphs.length,
    bodyWordCount: countWords(bodyParagraphs.join(" ")),
    bodyParagraphCount: bodyParagraphs.length,
    structurePreserved: args.structurePreserved,
    qualityShadow: projectQualityShadow(args.qualityShadow),
  };
}

export async function replayCoverLetterFinalArtifactShadow(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  cells: readonly CoverLetterQualitativeSampleCell[];
}): Promise<CoverLetterFinalArtifactShadowReplay[]> {
  if (args.benchmarkCase.id !== QUALITY_EVAL_2D_CASE_ID) {
    throw new Error(
      `QUALITY-EVAL-2E requires case ${QUALITY_EVAL_2D_CASE_ID}.`,
    );
  }
  if (isCoverLetterQualityRepairV1Enabled()) {
    throw new Error("QUALITY-EVAL-2E requires quality repair to remain OFF.");
  }
  if (isCoverLetterPremiumPromptV2Enabled()) {
    throw new Error(
      "QUALITY-EVAL-2E requires premium prompt V2 to remain OFF.",
    );
  }

  const orderedCells = assertExactAcceptedCells(args.cells);
  const productionInputs = resolveCoverLetterBenchmarkProductionInputs({
    benchmarkCase: args.benchmarkCase,
  });
  const canonicalWriterPrompt = await resolveQualityEval2DSharedWriterPrompt({
    benchmarkCase: args.benchmarkCase,
    productionInputs,
  });
  const canonicalPromptHash = await hashQualitativePrompt(
    canonicalWriterPrompt,
  );
  const mistralCell = orderedCells.find(
    (cell) => cell.requestedModel === "mistral-medium-latest",
  )!;
  const declaredPromptContracts = orderedCells.flatMap((cell) =>
    cell.transport ? [cell.transport.promptContract] : [],
  );
  if (
    declaredPromptContracts.length !== 0 &&
    (declaredPromptContracts.length !== orderedCells.length ||
      new Set(declaredPromptContracts).size !== 1)
  ) {
    throw new Error(
      "QUALITY-EVAL-2E requires one consistent prompt contract across all five cells.",
    );
  }
  const declaredPromptContract = declaredPromptContracts[0];
  const usesCanonicalWriterPrompt = declaredPromptContract
    ? declaredPromptContract === "quality_eval_2d_shared_v1"
    : mistralCell.promptHash === canonicalPromptHash;
  const expectedSchemaHash = await hashQualitativeSchema();
  const replay: CoverLetterFinalArtifactShadowReplay[] = [];

  for (const [index, cell] of orderedCells.entries()) {
    const cellLabel = `sample-cell-${String(index + 1).padStart(3, "0")}`;
    if (cell.schemaHash !== expectedSchemaHash) {
      throw new Error(`${cellLabel} schema hash drifted.`);
    }
    const frozenConfig = await buildCoverLetterEvalFrozenConfig({
      writerModel: cell.requestedModel,
      benchmarkCase: args.benchmarkCase,
      productionInputs,
    });
    if (cell.configHash !== (await hashQualitativeConfig(frozenConfig))) {
      throw new Error(`${cellLabel} frozen configuration drifted.`);
    }

    let localWriterCallCount = 0;
    let modelRepairRequested = false;
    const generation = await generatePremiumCoverLetterBenchmarkLetter({
      benchmarkCase: args.benchmarkCase,
      writerModel: cell.requestedModel,
      apiKey: "",
      mistralApiKey: "",
      productionInputs,
      ...(usesCanonicalWriterPrompt
        ? { writerPromptOverride: canonicalWriterPrompt }
        : {}),
      onModelRepairRequired: () => {
        modelRepairRequested = true;
      },
      writerOverride: async () => {
        localWriterCallCount += 1;
        if (localWriterCallCount > 1) {
          throw new Error(`${cellLabel} attempted a model-assisted repair.`);
        }
        return cell.parsedCandidate;
      },
    });
    if (!generation || localWriterCallCount !== 1 || modelRepairRequested) {
      throw new Error(
        `${cellLabel} could not replay as one local writer pass.`,
      );
    }
    if (cell.promptHash !== (await hashQualitativePrompt(generation.prompt))) {
      throw new Error(`${cellLabel} writer prompt drifted.`);
    }

    const finalizationTrace = inspectProposalFinalization({
      content: generation.content,
      format: "cover_letter",
      outputLanguage: productionInputs.outputLanguage,
      candidateName: args.benchmarkCase.personalizationContext?.name,
      voicePreset: args.benchmarkCase.preset,
      noContextMode: !productionInputs.hasCandidateContext,
      requiresCandidateEvidence: productionInputs.hasCandidateContext,
    });
    const productionFinalized = finalizePremiumCoverLetterPayloadForPersistence(
      {
        payload: {
          content: generation.content,
          sections: generation.sections,
          bodyParts: generation.bodyParts,
          qualityShadow: generation.qualityShadow,
          qualityRepair: generation.qualityRepair,
          finalProvenance: generation.finalProvenance,
        },
        format: "cover_letter",
        outputLanguage: productionInputs.outputLanguage,
        candidateName: args.benchmarkCase.personalizationContext?.name,
        voicePreset: args.benchmarkCase.preset,
        hasCandidateContext: productionInputs.hasCandidateContext,
      },
    );
    const byteIdentical = utf8BytesEqual(
      productionFinalized.content,
      cell.finalizedLetter,
    );
    if (!byteIdentical) {
      throw new Error(
        `${cellLabel} production replay is not byte-identical to the recorded final letter.`,
      );
    }

    const candidateContent = generation.content;
    const sections = await Promise.all(
      SECTION_ORDER.map(async (section) => {
        const sourceText = generation.bodyParts[section];
        return {
          section,
          sourceText,
          sourceTextHash: await hashContent(`section-${section}`, sourceText),
          production: attributeSection({
            sourceText,
            artifactContent: productionFinalized.content,
            structuredVariant: false,
          }),
          candidate: attributeSection({
            sourceText,
            artifactContent: candidateContent,
            structuredVariant: true,
          }),
        };
      }),
    );
    const candidateStructurePreserved = hasExactSectionStructure({
      content: candidateContent,
      bodyParts: generation.bodyParts,
      candidateName: args.benchmarkCase.personalizationContext?.name,
    });
    const bodyParagraphCount = extractBodyParagraphs({
      content: productionFinalized.content,
      candidateName: args.benchmarkCase.personalizationContext?.name,
    }).length;
    const preFinalizerBodyPartsProjection = projectQualityShadow(
      evaluatePremiumCoverLetterQualityShadow({
        bodyParts: generation.bodyParts,
        content: productionFinalized.content,
      }),
    )!;
    const persistedProjection = projectQualityShadow(
      productionFinalized.qualityShadow,
    );
    const conditionTriggered = bodyParagraphCount < SECTION_ORDER.length;
    const visibleStructureLoss = sections.some(
      (section) => section.production.status !== "retained_exact",
    );
    const projectionMatchesPreFinalizerBodyParts =
      qualityShadowProjectionsEqual(
        preFinalizerBodyPartsProjection,
        persistedProjection,
      );

    replay.push({
      version: "cover_letter_final_artifact_shadow_replay_v1",
      caseId: QUALITY_EVAL_2D_CASE_ID,
      cellOrdinal: index + 1,
      provider: cell.provider,
      requestedModel: cell.requestedModel,
      returnedModel: cell.returnedModel,
      recordedInputIdentity: {
        promptHash: cell.promptHash,
        schemaHash: cell.schemaHash,
        configHash: cell.configHash,
        artifactHash: cell.artifactHash,
        provenanceHash: cell.provenanceHash,
      },
      localWriterCallCount: 1,
      providerCallCount: 0,
      baseline: {
        ...(await summarizeArtifact({
          content: productionFinalized.content,
          candidateName: args.benchmarkCase.personalizationContext?.name,
          qualityShadow: productionFinalized.qualityShadow,
          structurePreserved: hasExactSectionStructure({
            content: productionFinalized.content,
            bodyParts: generation.bodyParts,
            candidateName: args.benchmarkCase.personalizationContext?.name,
          }),
        })),
        byteIdentical,
        selectedBodyCandidate:
          finalizationTrace.cleanedBodySelection.selectedCandidate,
        acceptanceMode: finalizationTrace.acceptanceMode,
      },
      candidate: await summarizeArtifact({
        content: candidateContent,
        candidateName: args.benchmarkCase.personalizationContext?.name,
        qualityShadow: generation.qualityShadow,
        structurePreserved: candidateStructurePreserved,
      }),
      sections,
      qualityShadowFallback: {
        conditionTriggered,
        visibleStructureLoss,
        projectionMatchesPreFinalizerBodyParts,
        signatureObserved:
          conditionTriggered &&
          visibleStructureLoss &&
          projectionMatchesPreFinalizerBodyParts,
        diagnostic:
          conditionTriggered && visibleStructureLoss
            ? "structure_loss"
            : "none",
        finalArtifactBodyParagraphCount: bodyParagraphCount,
        preFinalizerBodyPartsProjection,
        persistedProjection,
      },
    });
  }
  return replay;
}

function assertReplaySet(
  replay: readonly CoverLetterFinalArtifactShadowReplay[],
): void {
  const models = new Set(replay.map((entry) => entry.requestedModel));
  if (
    replay.length !== QUALITY_EVAL_2D_WRITER_MODELS.length ||
    models.size !== QUALITY_EVAL_2D_WRITER_MODELS.length ||
    !QUALITY_EVAL_2D_WRITER_MODELS.every((model) => models.has(model))
  ) {
    throw new Error("Shadow artifacts require the exact five-cell replay.");
  }
  if (replay.some((entry) => !entry.baseline.byteIdentical)) {
    throw new Error("Shadow artifacts require byte-identical baselines.");
  }
}

async function hashPackBody(
  value: Omit<CoverLetterFinalArtifactShadowPack, "packHash">,
): Promise<string> {
  return hashContent("blind-pack", value);
}

async function hashRevealBody(
  value: Omit<CoverLetterFinalArtifactShadowRevealMap, "revealMapHash">,
): Promise<string> {
  return hashContent("reveal-map", value);
}

async function hashDiagnosticsBody(
  value: Omit<CoverLetterFinalArtifactShadowDiagnostics, "diagnosticsHash">,
): Promise<string> {
  return hashContent("diagnostics", value);
}

export async function buildCoverLetterFinalArtifactShadowArtifacts(args: {
  runId: string;
  sourceRef: string;
  benchmarkCase: CoverLetterBenchmarkCase;
  replay: readonly CoverLetterFinalArtifactShadowReplay[];
  blindingSecret?: string;
}): Promise<CoverLetterFinalArtifactShadowArtifacts> {
  if (!args.runId.trim() || !args.sourceRef.trim()) {
    throw new Error("QUALITY-EVAL-2E requires non-empty runId and sourceRef.");
  }
  if (args.benchmarkCase.id !== QUALITY_EVAL_2D_CASE_ID) {
    throw new Error("QUALITY-EVAL-2E received an unexpected benchmark case.");
  }
  assertReplaySet(args.replay);
  const metadata = args.benchmarkCase.reviewMetadata;
  if (!metadata) {
    throw new Error("QUALITY-EVAL-2E requires blind-review metadata.");
  }
  const blindingSecret = args.blindingSecret ?? randomUUID();
  if (blindingSecret.trim().length < 32) {
    throw new Error(
      "QUALITY-EVAL-2E blinding requires a private high-entropy secret.",
    );
  }

  const shuffled = await Promise.all(
    args.replay.map(async (entry) => ({
      entry,
      sortKey: await hashContent("blind-pair-order", {
        blindingSecret,
        runId: args.runId,
        configHash: entry.recordedInputIdentity.configHash,
        artifactHash: entry.recordedInputIdentity.artifactHash,
      }),
    })),
  );
  shuffled.sort(
    (left, right) =>
      left.sortKey.localeCompare(right.sortKey) ||
      left.entry.cellOrdinal - right.entry.cellOrdinal,
  );
  const sideOrder = await Promise.all(
    args.replay.map(async (entry) => ({
      cellOrdinal: entry.cellOrdinal,
      sortKey: await hashContent("blind-side-order", {
        blindingSecret,
        runId: args.runId,
        configHash: entry.recordedInputIdentity.configHash,
        artifactHash: entry.recordedInputIdentity.artifactHash,
      }),
    })),
  );
  sideOrder.sort(
    (left, right) =>
      left.sortKey.localeCompare(right.sortKey) ||
      left.cellOrdinal - right.cellOrdinal,
  );
  const recordedOnSideA = new Set(
    sideOrder
      .slice(0, Math.floor(sideOrder.length / 2))
      .map((entry) => entry.cellOrdinal),
  );

  const packEntries: Array<
    CoverLetterFinalArtifactShadowPack["entries"][number]
  > = [];
  const revealEntries: Array<
    CoverLetterFinalArtifactShadowRevealMap["entries"][number]
  > = [];
  const diagnosticsEntries: Array<
    CoverLetterFinalArtifactShadowDiagnostics["entries"][number]
  > = [];
  for (const [index, { entry }] of shuffled.entries()) {
    const pairLabel = `PAIR-${String(index + 1).padStart(3, "0")}`;
    const recordedVariant: VariantLabel = recordedOnSideA.has(entry.cellOrdinal)
      ? "A"
      : "B";
    const structuredVariant: VariantLabel = recordedVariant === "A" ? "B" : "A";
    const toBlindVariant = (
      label: VariantLabel,
      artifact: ArtifactSummary,
    ): BlindVariant => ({
      label,
      letter: artifact.content,
      wordCount: artifact.wordCount,
      paragraphCount: artifact.paragraphCount,
    });
    const variantA =
      recordedVariant === "A"
        ? toBlindVariant("A", entry.baseline)
        : toBlindVariant("A", entry.candidate);
    const variantB =
      recordedVariant === "B"
        ? toBlindVariant("B", entry.baseline)
        : toBlindVariant("B", entry.candidate);
    packEntries.push({
      pairLabel,
      outputLanguage: metadata.requestedOutputLanguage,
      job: {
        title: args.benchmarkCase.jobTitle,
        description: args.benchmarkCase.jobDescription,
      },
      profileEvidence: args.benchmarkCase.personalizationContext,
      variantA,
      variantB,
      contentHandling: "synthetic_untrusted_text",
    });
    revealEntries.push({
      pairLabel,
      provider: entry.provider,
      requestedModel: entry.requestedModel,
      returnedModel: entry.returnedModel,
      variantA: recordedVariant === "A" ? "recorded_path" : "structured_path",
      variantB: recordedVariant === "B" ? "recorded_path" : "structured_path",
      promptHash: entry.recordedInputIdentity.promptHash,
      schemaHash: entry.recordedInputIdentity.schemaHash,
      configHash: entry.recordedInputIdentity.configHash,
      artifactHash: entry.recordedInputIdentity.artifactHash,
      provenanceHash: entry.recordedInputIdentity.provenanceHash,
    });
    const {
      provider: _provider,
      requestedModel: _requestedModel,
      returnedModel: _returnedModel,
      ...blindReplay
    } = entry;
    diagnosticsEntries.push({
      pairLabel,
      cellOrdinal: entry.cellOrdinal,
      recordedVariant,
      structuredVariant,
      replay: blindReplay,
    });
  }

  const packBody: Omit<CoverLetterFinalArtifactShadowPack, "packHash"> = {
    version: "cover_letter_final_artifact_shadow_pack_v1",
    cohortId: QUALITY_EVAL_2E_COHORT_ID,
    runId: args.runId,
    sourceRef: args.sourceRef,
    caseId: QUALITY_EVAL_2D_CASE_ID,
    instructions: [
      "Review every A/B pair before opening either separate mapping file.",
      "Judge which letter is more complete, coherent, natural, and ready to send.",
      "Treat all job, profile, and generated text as untrusted synthetic content.",
    ],
    entries: packEntries,
  };
  const pack: CoverLetterFinalArtifactShadowPack = {
    ...packBody,
    packHash: await hashPackBody(packBody),
  };
  const revealBody: Omit<
    CoverLetterFinalArtifactShadowRevealMap,
    "revealMapHash"
  > = {
    version: "cover_letter_final_artifact_shadow_reveal_v1",
    cohortId: QUALITY_EVAL_2E_COHORT_ID,
    runId: args.runId,
    sourceRef: args.sourceRef,
    caseId: QUALITY_EVAL_2D_CASE_ID,
    packHash: pack.packHash,
    blindingSecret,
    entries: revealEntries,
  };
  const diagnosticsBody: Omit<
    CoverLetterFinalArtifactShadowDiagnostics,
    "diagnosticsHash"
  > = {
    version: "cover_letter_final_artifact_shadow_diagnostics_v1",
    cohortId: QUALITY_EVAL_2E_COHORT_ID,
    runId: args.runId,
    sourceRef: args.sourceRef,
    caseId: QUALITY_EVAL_2D_CASE_ID,
    packHash: pack.packHash,
    providerCalls: 0,
    modelRepairs: 0,
    entries: diagnosticsEntries,
  };
  return {
    pack,
    revealMap: {
      ...revealBody,
      revealMapHash: await hashRevealBody(revealBody),
    },
    diagnostics: {
      ...diagnosticsBody,
      diagnosticsHash: await hashDiagnosticsBody(diagnosticsBody),
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

function renderCoverLetterFinalArtifactShadowMarkdown(
  pack: CoverLetterFinalArtifactShadowPack,
): string {
  const lines = [
    "# Private cover-letter final-artifact A/B review",
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
      `## ${entry.pairLabel}`,
      "",
      "### Job",
      "",
      ...renderFencedBlock(`${entry.job.title}\n\n${entry.job.description}`),
      "",
      "### Profile evidence",
      "",
      ...renderFencedBlock(
        JSON.stringify(entry.profileEvidence, null, 2),
        "json",
      ),
      "",
      "### Variant A",
      "",
      ...renderFencedBlock(entry.variantA.letter),
      "",
      "### Variant B",
      "",
      ...renderFencedBlock(entry.variantB.letter),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function writePrivateFileAtomic(args: {
  directory: string;
  fileName: string;
  content: string;
}): Promise<string> {
  const directory = await ensurePrivateDirectory(args.directory);
  const filePath = path.join(directory, args.fileName);
  const temporaryPath = path.join(
    directory,
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

async function ensurePrivateDirectory(directory: string): Promise<string> {
  const safeDirectory = await resolveNonSymlinkDirectoryTree({
    absolutePath: directory,
    mustExist: false,
    label: "output",
  });
  await mkdir(safeDirectory, { recursive: true, mode: 0o700 });
  const directoryStats = await lstat(safeDirectory);
  if (!directoryStats.isDirectory()) {
    throw new Error(
      `QUALITY-EVAL-2E refuses a non-directory or symlink output path: ${safeDirectory}.`,
    );
  }
  await chmod(safeDirectory, 0o700);
  return safeDirectory;
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function resolveNonSymlinkDirectoryTree(args: {
  absolutePath: string;
  mustExist: boolean;
  label: "input" | "output";
}): Promise<string> {
  const root = path.parse(args.absolutePath).root;
  const segments = args.absolutePath
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);
  let canonicalPath = root;
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = path.join(canonicalPath, segments[index]!);
    let candidateStats;
    try {
      candidateStats = await lstat(candidate);
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }
      if (args.mustExist) {
        throw new Error(
          `QUALITY-EVAL-2E ${args.label} directory must already exist: ${args.absolutePath}.`,
        );
      }
      return path.join(canonicalPath, ...segments.slice(index));
    }
    if (candidateStats.isSymbolicLink()) {
      const parentStats = await lstat(canonicalPath);
      const isTrustedSystemAlias =
        candidateStats.uid === 0 &&
        parentStats.uid === 0 &&
        (parentStats.mode & 0o022) === 0;
      if (isTrustedSystemAlias) {
        const resolvedCandidate = await realpath(candidate);
        const resolvedStats = await lstat(resolvedCandidate);
        if (resolvedStats.isDirectory()) {
          canonicalPath = resolvedCandidate;
          continue;
        }
      }
    }
    if (!candidateStats.isDirectory()) {
      throw new Error(
        `QUALITY-EVAL-2E refuses a non-directory or symlink ${args.label} path: ${candidate}.`,
      );
    }
    canonicalPath = await realpath(candidate);
  }
  return canonicalPath;
}

async function preparePrivateDirectories(
  directories: readonly string[],
): Promise<void> {
  const safeDirectories: string[] = [];
  for (const directory of directories) {
    safeDirectories.push(
      await resolveNonSymlinkDirectoryTree({
        absolutePath: directory,
        mustExist: false,
        label: "output",
      }),
    );
  }
  for (const directory of safeDirectories) {
    await ensurePrivateDirectory(directory);
  }
}

export async function writeCoverLetterFinalArtifactShadowArtifacts(args: {
  inputDirectory: string;
  outputDirectory: string;
  pack: CoverLetterFinalArtifactShadowPack;
  revealMap: CoverLetterFinalArtifactShadowRevealMap;
  diagnostics: CoverLetterFinalArtifactShadowDiagnostics;
}): Promise<{
  packJsonPath: string;
  packMarkdownPath: string;
  diagnosticsJsonPath: string;
  revealMapJsonPath: string;
}> {
  if (!args.inputDirectory.trim() || !args.outputDirectory.trim()) {
    throw new Error(
      "QUALITY-EVAL-2E requires explicit input and output directories.",
    );
  }
  const requestedInputDirectory = path.resolve(args.inputDirectory);
  const requestedOutputDirectory = path.resolve(args.outputDirectory);
  const inputDirectory = await resolveNonSymlinkDirectoryTree({
    absolutePath: requestedInputDirectory,
    mustExist: true,
    label: "input",
  });
  const outputDirectory = await resolveNonSymlinkDirectoryTree({
    absolutePath: requestedOutputDirectory,
    mustExist: false,
    label: "output",
  });
  const isSameOrDescendant = (parent: string, candidate: string): boolean => {
    const relative = path.relative(parent, candidate);
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  };
  if (
    isSameOrDescendant(inputDirectory, outputDirectory) ||
    isSameOrDescendant(outputDirectory, inputDirectory)
  ) {
    throw new Error(
      "QUALITY-EVAL-2E input and output directory trees must not overlap.",
    );
  }
  const reviewDirectory = path.join(outputDirectory, "private-review");
  const evidenceDirectory = path.join(outputDirectory, "private-evidence");
  const revealDirectory = path.join(outputDirectory, "private-reveal");
  await preparePrivateDirectories([
    outputDirectory,
    reviewDirectory,
    evidenceDirectory,
    revealDirectory,
  ]);
  return {
    packJsonPath: await writePrivateFileAtomic({
      directory: reviewDirectory,
      fileName: "final-artifact-shadow-pack.json",
      content: `${JSON.stringify(args.pack, null, 2)}\n`,
    }),
    packMarkdownPath: await writePrivateFileAtomic({
      directory: reviewDirectory,
      fileName: "final-artifact-shadow-pack.md",
      content: renderCoverLetterFinalArtifactShadowMarkdown(args.pack),
    }),
    diagnosticsJsonPath: await writePrivateFileAtomic({
      directory: evidenceDirectory,
      fileName: "final-artifact-shadow-diagnostics.json",
      content: `${JSON.stringify(args.diagnostics, null, 2)}\n`,
    }),
    revealMapJsonPath: await writePrivateFileAtomic({
      directory: revealDirectory,
      fileName: "final-artifact-shadow-reveal-map.json",
      content: `${JSON.stringify(args.revealMap, null, 2)}\n`,
    }),
  };
}

function assertLoadedCell(
  value: unknown,
  fileName: string,
): asserts value is CoverLetterQualitativeSampleCell {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fileName} is not a qualitative sample cell object.`);
  }
  const candidate = value as Partial<CoverLetterQualitativeSampleCell>;
  if (
    candidate.version !== "cover_letter_qualitative_sample_cell_v1" ||
    candidate.caseId !== QUALITY_EVAL_2D_CASE_ID ||
    typeof candidate.requestedModel !== "string"
  ) {
    throw new Error(`${fileName} is not a compatible qualitative sample cell.`);
  }
}

export async function loadCoverLetterFinalArtifactShadowCells(args: {
  inputDirectory: string;
}): Promise<CoverLetterQualitativeSampleCell[]> {
  if (!args.inputDirectory.trim()) {
    throw new Error("QUALITY-EVAL-2E requires an explicit input directory.");
  }
  const inputDirectory = path.resolve(args.inputDirectory);
  const inputDirectoryStats = await lstat(inputDirectory);
  if (
    !inputDirectoryStats.isDirectory() ||
    (inputDirectoryStats.mode & 0o777) !== 0o700
  ) {
    throw new Error(
      "QUALITY-EVAL-2E input directory must be a private 0700 directory.",
    );
  }
  const expectedNames = QUALITY_EVAL_2D_WRITER_MODELS.map(
    (_, index) => `sample-cell-${String(index + 1).padStart(3, "0")}.json`,
  );
  const actualNames = (await readdir(inputDirectory)).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      "QUALITY-EVAL-2E input must contain the exact five private sample-cell JSON files.",
    );
  }
  const cells = await Promise.all(
    expectedNames.map(async (fileName) => {
      const filePath = path.join(inputDirectory, fileName);
      const fileStats = await lstat(filePath);
      if (!fileStats.isFile() || (fileStats.mode & 0o777) !== 0o600) {
        throw new Error(
          `${fileName} must be a regular private 0600 evidence file.`,
        );
      }
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      assertLoadedCell(parsed, fileName);
      return parsed;
    }),
  );
  return assertExactAcceptedCells(cells);
}

type CliOptions = Readonly<{
  inputDirectory: string;
  outputDirectory: string;
  runId: string;
  sourceRef: string;
}>;

function parseCliOptions(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(
        "Usage: --input-directory <path> --output-directory <path> --run-id <id> --source-ref <ref>",
      );
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate QUALITY-EVAL-2E option: ${flag}.`);
    }
    values.set(flag, value);
  }
  const allowed = new Set([
    "--input-directory",
    "--output-directory",
    "--run-id",
    "--source-ref",
  ]);
  for (const flag of values.keys()) {
    if (!allowed.has(flag)) {
      throw new Error(`Unknown QUALITY-EVAL-2E option: ${flag}.`);
    }
  }
  const inputDirectory = values.get("--input-directory");
  const outputDirectory = values.get("--output-directory");
  const runId = values.get("--run-id");
  const sourceRef = values.get("--source-ref");
  if (!inputDirectory || !outputDirectory || !runId || !sourceRef) {
    throw new Error(
      "Usage: --input-directory <path> --output-directory <path> --run-id <id> --source-ref <ref>",
    );
  }
  return { inputDirectory, outputDirectory, runId, sourceRef };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const benchmarkCase = coverLetterBlindReviewCases.find(
    (candidate) => candidate.id === QUALITY_EVAL_2D_CASE_ID,
  );
  if (!benchmarkCase) {
    throw new Error(`Missing benchmark case ${QUALITY_EVAL_2D_CASE_ID}.`);
  }
  const cells = await loadCoverLetterFinalArtifactShadowCells({
    inputDirectory: options.inputDirectory,
  });
  const replay = await replayCoverLetterFinalArtifactShadow({
    benchmarkCase,
    cells,
  });
  const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
    runId: options.runId,
    sourceRef: options.sourceRef,
    benchmarkCase,
    replay,
  });
  const written = await writeCoverLetterFinalArtifactShadowArtifacts({
    inputDirectory: options.inputDirectory,
    outputDirectory: options.outputDirectory,
    ...artifacts,
  });
  console.log("cover-letter final-artifact attribution shadow: READY");
  console.log(
    JSON.stringify({
      replayedCells: replay.length,
      providerCalls: 0,
      modelRepairs: 0,
      ...written,
    }),
  );
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(
      "Cover-letter final-artifact attribution shadow failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
