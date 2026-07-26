import { chmod, mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { CoverLetterBodyParts } from "../../convex/lib/proposals/premiumCoverLetter";
import type {
  ProposalDocumentLanguageCode,
  ProposalOutputLanguage,
} from "../../convex/lib/proposals/proposalOutput";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  revealCompletedCoverLetterBlindReviews,
  type CompletedCoverLetterBlindReview,
  type CoverLetterBlindReviewPack,
  type CoverLetterBlindReviewRevealMap,
} from "./cover-letter-blind-review";
import type { CoverLetterBenchmarkCase } from "./cases/cover-letter/cases";
import type { CoverLetterEvalArtifact } from "./cover-letter-eval-artifact";
import type { CoverLetterEvalRunManifestEntry } from "./cover-letter-eval-run-manifest";
import { evaluateCoverLetterFinalSendability } from "./cover-letter-final-sendability-shadow";
import {
  buildCoverLetterSafeArmDiagnostic,
  validateCoverLetterSafeArmDiagnostic,
  type CoverLetterSafeArmDiagnostic,
  type CoverLetterSafeArmDiagnosticInput,
} from "./cover-letter-safe-arm-diagnostic";

export const COVER_LETTER_SAFE_ARM_DIAGNOSTIC_BUNDLE_VERSION =
  "cover_letter_safe_arm_diagnostic_bundle_v1" as const;
export const COVER_LETTER_SAFE_ARM_DIAGNOSTIC_EXTRACTOR_VERSION =
  "cover_letter_safe_arm_diagnostic_extractor_v1" as const;

export type CoverLetterSafeArmDiagnosticBundle = Readonly<{
  version: typeof COVER_LETTER_SAFE_ARM_DIAGNOSTIC_BUNDLE_VERSION;
  cohortId: string;
  runId: string;
  sourceRef: string;
  packHash: string;
  revealMapHash: string;
  extractorHash: string;
  entries: readonly CoverLetterSafeArmDiagnostic[];
  bundleHash: string;
}>;

export type CoverLetterSafeArmDiagnosticExtractionSource = Readonly<{
  caseId: string;
  outputLanguage: ProposalOutputLanguage;
  artifact: CoverLetterEvalArtifact;
  bodyParts: CoverLetterBodyParts;
  finalVisibleContent: string;
  runManifest?: CoverLetterEvalRunManifestEntry;
}>;

const VALIDATION_ERROR =
  "safe arm diagnostic bundle validation failed." as const;
const HASH_RE = /^[a-f0-9]{64}$/u;
const SOURCE_REF_RE = /^(?:[a-f0-9]{7,40}|[a-f0-9]{64})$/u;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

const LANGUAGE_CODE_BY_OUTPUT_LANGUAGE = {
  English: "en",
  French: "fr",
  Spanish: "es",
  German: "de",
  Italian: "it",
  Portuguese: "pt",
  Polish: "pl",
  Dutch: "nl",
  Greek: "el",
  Hungarian: "hu",
  Lithuanian: "lt",
  Estonian: "et",
  Russian: "ru",
  Arabic: "ar",
} as const satisfies Record<
  ProposalOutputLanguage,
  ProposalDocumentLanguageCode
>;

function fail(): never {
  throw new TypeError(VALIDATION_ERROR);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail();
  }
}

function token(value: unknown): string {
  return typeof value === "string" && TOKEN_RE.test(value) ? value : fail();
}

function hash(value: unknown): string {
  return typeof value === "string" && HASH_RE.test(value) ? value : fail();
}

function sourceRef(value: unknown): string {
  return typeof value === "string" && SOURCE_REF_RE.test(value)
    ? value
    : fail();
}

export async function buildCoverLetterSafeArmDiagnosticExtractorHash(): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "extractor-contract",
    version: 1,
    extractorVersion: COVER_LETTER_SAFE_ARM_DIAGNOSTIC_EXTRACTOR_VERSION,
    sources: {
      finalizer: "accepted_artifact_provenance_and_finalization_trace",
      qualityShadow: "accepted_artifact_quality_projection",
      structure:
        "final_visible_sendability_counts_and_exact_final_body_part_presence",
      language: "requested_output_language_exhaustive_mapping",
      promptContract: "run_manifest_hash_projection_without_prompt_text",
    },
  });
}

export function validateCoverLetterSafeArmDiagnosticRunIdentity(value: {
  runId: unknown;
  sourceRef: unknown;
}): Readonly<{ runId: string; sourceRef: string }> {
  if (!isRecord(value)) fail();
  exactKeys(value, ["runId", "sourceRef"]);
  return {
    runId: token(value.runId),
    sourceRef: sourceRef(value.sourceRef),
  };
}

async function buildPromptContractHash(
  source: CoverLetterSafeArmDiagnosticExtractionSource,
): Promise<string | null> {
  const manifest = source.runManifest;
  if (!manifest) return null;
  return buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "prompt-contract",
    version: 1,
    promptHash: manifest.promptHash,
    promptHashScope: manifest.promptHashScope,
    requestProjectionHash: manifest.transport.requestProjectionHash,
    systemPromptHash: manifest.transport.systemPromptHash,
    schemaTargetHash: manifest.transport.schemaTargetHash,
    schemaEnforcementMode: manifest.transport.schemaEnforcementMode,
    promptContract: manifest.transport.promptContract,
  });
}

async function buildFinalizerHash(
  source: CoverLetterSafeArmDiagnosticExtractionSource,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "finalizer-contract",
    version: 1,
    configVersion: source.artifact.configVersions.finalizer,
    productionContract: source.artifact.contractVersions.productionFinalizer,
  });
}

function finalizerPathCode(
  source: CoverLetterSafeArmDiagnosticExtractionSource,
): CoverLetterSafeArmDiagnosticInput["signals"]["finalizer"]["pathCode"] {
  switch (source.artifact.provenance?.status) {
    case "validated_after_structured_repair":
      return "structured_repaired_success";
    case "validated_final_text":
      return "structured_success";
    default:
      return "legacy_thin";
  }
}

function finalizerRepairCodes(
  source: CoverLetterSafeArmDiagnosticExtractionSource,
): CoverLetterSafeArmDiagnosticInput["signals"]["finalizer"]["repairCodes"] {
  const codes: Array<
    CoverLetterSafeArmDiagnosticInput["signals"]["finalizer"]["repairCodes"][number]
  > = [];
  const finalization = source.artifact.diagnostics.finalization;
  const qualityRepair = source.artifact.diagnostics.qualityRepair;
  if (finalization.removedBridgeSentenceCount > 0) {
    codes.push("bridge_sentence_removed");
  }
  if (finalization.removedLastGroundedSentence) {
    codes.push("last_grounded_sentence_removed");
  }
  if (finalizerPathCode(source) === "structured_repaired_success") {
    codes.push("structured_repair_applied");
  }
  if (qualityRepair?.attempted) {
    codes.push("quality_repair_attempted");
    codes.push(
      qualityRepair.outcome === "attempted_accepted"
        ? "quality_repair_accepted"
        : "quality_repair_rejected",
    );
  }
  return codes;
}

function projectQualityShadow(
  value: CoverLetterEvalArtifact["diagnostics"]["qualityShadow"] | undefined,
): Readonly<{
  codes: readonly string[];
  passed: boolean | null;
  score: number | null;
}> {
  return value
    ? {
        codes: value.issueClasses,
        passed: value.passed,
        score: value.score,
      }
    : { codes: [], passed: null, score: null };
}

function countNormalizedOccurrences(content: string, part: string): number {
  const normalizedContent = content.replace(/\s+/gu, " ").trim();
  const normalizedPart = part.replace(/\s+/gu, " ").trim();
  if (!normalizedPart) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= normalizedContent.length - normalizedPart.length) {
    const index = normalizedContent.indexOf(normalizedPart, offset);
    if (index < 0) break;
    count += 1;
    offset = index + normalizedPart.length;
  }
  return count;
}

export async function extractCoverLetterSafeArmDiagnostic(args: {
  runId: string;
  sourceRef: string;
  source: CoverLetterSafeArmDiagnosticExtractionSource;
  benchmarkCase: CoverLetterBenchmarkCase;
  opaqueArmId: string;
}): Promise<CoverLetterSafeArmDiagnostic> {
  if (
    args.source.artifact.decision !== "accepted" ||
    !args.source.artifact.finalContent ||
    args.source.artifact.finalContent !== args.source.finalVisibleContent ||
    args.source.artifact.caseId !== args.source.caseId ||
    (args.source.runManifest !== undefined &&
      (args.source.runManifest.caseId !== args.source.caseId ||
        args.source.runManifest.artifactHash !==
          args.source.artifact.artifactHash ||
        args.source.runManifest.provenanceHash !==
          args.source.artifact.provenanceHash))
  ) {
    fail();
  }
  const promptContractHash = await buildPromptContractHash(args.source);
  const qualityRepair = args.source.artifact.diagnostics.qualityRepair;
  const preQuality = projectQualityShadow(
    qualityRepair?.qualityBefore ??
      args.source.artifact.diagnostics.qualityShadow ??
      undefined,
  );
  const postQuality = projectQualityShadow(
    args.source.artifact.diagnostics.qualityShadow ?? undefined,
  );
  const sendability = await evaluateCoverLetterFinalSendability({
    content: args.source.finalVisibleContent,
    outputLanguage: args.source.outputLanguage,
    job: {
      title: args.benchmarkCase.jobTitle,
      description: args.benchmarkCase.jobDescription,
    },
    profileEvidence: args.benchmarkCase.personalizationContext,
  });
  const closeCount = countNormalizedOccurrences(
    args.source.finalVisibleContent,
    args.source.bodyParts.closeLine,
  );
  const bridgeCount = countNormalizedOccurrences(
    args.source.finalVisibleContent,
    args.source.bodyParts.employerValueBlock,
  );
  const proofCount = countNormalizedOccurrences(
    args.source.finalVisibleContent,
    args.source.bodyParts.proofBlock,
  );
  const extractorHash = await buildCoverLetterSafeArmDiagnosticExtractorHash();

  return buildCoverLetterSafeArmDiagnostic({
    version: "cover_letter_safe_arm_diagnostic_v1",
    identity: {
      runId: args.runId,
      fixtureId: args.source.caseId,
      opaqueArmId: args.opaqueArmId,
      artifactHash: args.source.artifact.artifactHash,
      sourceRef: args.sourceRef,
      promptContractHash,
      finalizerVersion:
        args.source.artifact.contractVersions.productionFinalizer,
      finalizerHash: await buildFinalizerHash(args.source),
      extractorHash,
    },
    provenance: {
      artifactHash: "RETAINED",
      promptContractHash: promptContractHash
        ? "RECOMPUTED_DETERMINISTICALLY"
        : "MISSING_NOT_RECONSTRUCTABLE",
      finalizer: "RECOMPUTED_DETERMINISTICALLY",
      extractor: "RECOMPUTED_DETERMINISTICALLY",
      finalizerSignals: "RETAINED",
      qualityShadow:
        preQuality.passed === null && postQuality.passed === null
          ? "MISSING_NOT_RECONSTRUCTABLE"
          : "RETAINED",
      structure: "RECOMPUTED_DETERMINISTICALLY",
      language: "RECOMPUTED_DETERMINISTICALLY",
      promptMarker: promptContractHash
        ? "RECOMPUTED_DETERMINISTICALLY"
        : "MISSING_NOT_RECONSTRUCTABLE",
    },
    signals: {
      finalizer: {
        pathCode: finalizerPathCode(args.source),
        repairCodes: finalizerRepairCodes(args.source),
        finalizerPassed: true,
      },
      qualityShadow: {
        preCodes: preQuality.codes,
        postCodes: postQuality.codes,
        prePassed: preQuality.passed,
        postPassed: postQuality.passed,
        preScore: preQuality.score,
        postScore: postQuality.score,
      },
      structure: {
        paragraphCount: sendability.stats.paragraphCount,
        bodyParagraphCount: sendability.stats.bodyParagraphCount,
        closeCount,
        bridgeCount,
        proofCount,
        codes: [
          "paragraph_count_available",
          "body_paragraph_count_available",
          ...(closeCount > 0 ? ["close_present" as const] : []),
          ...(bridgeCount > 0 ? ["bridge_present" as const] : []),
          ...(proofCount > 0 ? ["proof_present" as const] : []),
        ],
      },
      languageCode:
        LANGUAGE_CODE_BY_OUTPUT_LANGUAGE[args.source.outputLanguage],
      promptMarker: promptContractHash
        ? { markerCode: "present", hashStatus: "verified" }
        : { markerCode: "unavailable", hashStatus: "missing" },
    },
  });
}

async function hashBundleBody(
  value: Omit<CoverLetterSafeArmDiagnosticBundle, "bundleHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "bundle",
    version: 1,
    value,
  });
}

export async function buildCoverLetterSafeArmDiagnosticBundle(args: {
  cohortId: string;
  runId: string;
  sourceRef: string;
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
  diagnostics: readonly CoverLetterSafeArmDiagnostic[];
}): Promise<CoverLetterSafeArmDiagnosticBundle> {
  if (
    args.pack.cohortId !== args.cohortId ||
    args.pack.runId !== args.runId ||
    args.pack.sourceRef !== args.sourceRef ||
    args.revealMap.cohortId !== args.cohortId ||
    args.revealMap.runId !== args.runId ||
    args.revealMap.sourceRef !== args.sourceRef ||
    args.revealMap.packHash !== args.pack.packHash
  ) {
    fail();
  }
  const entries = await Promise.all(
    args.diagnostics.map((diagnostic) =>
      validateCoverLetterSafeArmDiagnostic(diagnostic),
    ),
  );
  const diagnosticByOpaqueArmId = new Map(
    entries.map((diagnostic) => [diagnostic.identity.opaqueArmId, diagnostic]),
  );
  if (diagnosticByOpaqueArmId.size !== entries.length) fail();
  for (const reveal of args.revealMap.entries) {
    const diagnostic = reveal.opaqueArmId
      ? diagnosticByOpaqueArmId.get(reveal.opaqueArmId)
      : undefined;
    if (
      !diagnostic ||
      diagnostic.identity.runId !== args.runId ||
      diagnostic.identity.sourceRef !== args.sourceRef ||
      diagnostic.identity.fixtureId !== reveal.caseId ||
      diagnostic.identity.artifactHash !== reveal.artifactHash
    ) {
      fail();
    }
  }
  entries.sort((left, right) =>
    left.identity.opaqueArmId.localeCompare(right.identity.opaqueArmId),
  );
  if (
    entries.length !== args.revealMap.entries.length ||
    new Set(entries.map((entry) => entry.identity.opaqueArmId)).size !==
      entries.length
  ) {
    fail();
  }
  const extractorHashes = new Set(
    entries.map((entry) => entry.identity.extractorHash),
  );
  const expectedExtractorHash =
    await buildCoverLetterSafeArmDiagnosticExtractorHash();
  if (
    extractorHashes.size !== 1 ||
    entries[0]?.identity.extractorHash !== expectedExtractorHash
  ) {
    fail();
  }
  const body: Omit<CoverLetterSafeArmDiagnosticBundle, "bundleHash"> = {
    version: COVER_LETTER_SAFE_ARM_DIAGNOSTIC_BUNDLE_VERSION,
    cohortId: args.cohortId,
    runId: args.runId,
    sourceRef: args.sourceRef,
    packHash: args.pack.packHash,
    revealMapHash: args.revealMap.revealMapHash,
    extractorHash: entries[0].identity.extractorHash,
    entries,
  };
  return { ...body, bundleHash: await hashBundleBody(body) };
}

export async function validateCoverLetterSafeArmDiagnosticBundle(
  value: unknown,
): Promise<CoverLetterSafeArmDiagnosticBundle> {
  if (!isRecord(value)) fail();
  exactKeys(value, [
    "version",
    "cohortId",
    "runId",
    "sourceRef",
    "packHash",
    "revealMapHash",
    "extractorHash",
    "entries",
    "bundleHash",
  ]);
  if (value.version !== COVER_LETTER_SAFE_ARM_DIAGNOSTIC_BUNDLE_VERSION) fail();
  if (!Array.isArray(value.entries)) fail();
  const entries = await Promise.all(
    value.entries.map((entry) => validateCoverLetterSafeArmDiagnostic(entry)),
  );
  const expectedExtractorHash =
    await buildCoverLetterSafeArmDiagnosticExtractorHash();
  const runId = token(value.runId);
  const bundleSourceRef = sourceRef(value.sourceRef);
  const opaqueArmIds = entries.map((entry) => entry.identity.opaqueArmId);
  const canonicalOpaqueArmIds = [...opaqueArmIds].sort();
  if (
    new Set(opaqueArmIds).size !== opaqueArmIds.length ||
    opaqueArmIds.some(
      (opaqueArmId, index) => opaqueArmId !== canonicalOpaqueArmIds[index],
    ) ||
    entries.some(
      (entry) =>
        entry.identity.runId !== runId ||
        entry.identity.sourceRef !== bundleSourceRef ||
        entry.identity.extractorHash !== expectedExtractorHash,
    )
  ) {
    fail();
  }
  const body: Omit<CoverLetterSafeArmDiagnosticBundle, "bundleHash"> = {
    version: COVER_LETTER_SAFE_ARM_DIAGNOSTIC_BUNDLE_VERSION,
    cohortId: token(value.cohortId),
    runId,
    sourceRef: bundleSourceRef,
    packHash: hash(value.packHash),
    revealMapHash: hash(value.revealMapHash),
    extractorHash: hash(value.extractorHash),
    entries,
  };
  if (body.extractorHash !== expectedExtractorHash) fail();
  if (value.bundleHash !== (await hashBundleBody(body))) fail();
  return { ...body, bundleHash: hash(value.bundleHash) };
}

export async function writeCoverLetterSafeArmDiagnosticBundle(args: {
  outputDirectory: string;
  bundle: CoverLetterSafeArmDiagnosticBundle;
}): Promise<string> {
  const bundle = await validateCoverLetterSafeArmDiagnosticBundle(args.bundle);
  if (!args.outputDirectory.trim()) fail();
  const privateDirectory = path.join(
    path.resolve(args.outputDirectory),
    "private-reveal",
  );
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  await chmod(privateDirectory, 0o700);
  const bundlePath = path.join(privateDirectory, "safe-arm-diagnostics.json");
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(bundlePath, 0o600);
  return bundlePath;
}

export async function revealCompletedCoverLetterBlindReviewsWithSafeArmDiagnostics(args: {
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
  reviews: readonly unknown[];
  diagnosticBundle: unknown;
}): Promise<
  Array<{
    review: CompletedCoverLetterBlindReview;
    reveal: CoverLetterBlindReviewRevealMap["entries"][number];
    diagnostic: CoverLetterSafeArmDiagnostic;
  }>
> {
  const revealed = await revealCompletedCoverLetterBlindReviews(args);
  const bundle = await validateCoverLetterSafeArmDiagnosticBundle(
    args.diagnosticBundle,
  );
  if (
    bundle.cohortId !== args.pack.cohortId ||
    bundle.runId !== args.pack.runId ||
    bundle.sourceRef !== args.pack.sourceRef ||
    bundle.packHash !== args.pack.packHash ||
    bundle.revealMapHash !== args.revealMap.revealMapHash
  ) {
    fail();
  }
  const diagnosticByOpaqueArmId = new Map(
    bundle.entries.map((diagnostic) => [
      diagnostic.identity.opaqueArmId,
      diagnostic,
    ]),
  );
  if (diagnosticByOpaqueArmId.size !== revealed.length) fail();
  const consumedOpaqueArmIds = new Set<string>();
  const joined = revealed.map(({ review, reveal }) => {
    if (!reveal.opaqueArmId || consumedOpaqueArmIds.has(reveal.opaqueArmId)) {
      fail();
    }
    const diagnostic = diagnosticByOpaqueArmId.get(reveal.opaqueArmId);
    if (
      !diagnostic ||
      diagnostic.identity.runId !== args.pack.runId ||
      diagnostic.identity.sourceRef !== args.pack.sourceRef ||
      diagnostic.identity.fixtureId !== reveal.caseId ||
      diagnostic.identity.artifactHash !== reveal.artifactHash
    ) {
      fail();
    }
    consumedOpaqueArmIds.add(reveal.opaqueArmId);
    return { review, reveal, diagnostic };
  });
  if (consumedOpaqueArmIds.size !== diagnosticByOpaqueArmId.size) fail();
  return joined;
}
