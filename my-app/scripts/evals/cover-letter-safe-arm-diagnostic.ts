import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import type { PremiumCoverLetterQualityShadowIssueCode } from "../../convex/lib/proposals/premiumCoverLetter";
import type { ProposalDocumentLanguageCode } from "../../convex/lib/proposals/proposalOutput";

export const COVER_LETTER_SAFE_ARM_DIAGNOSTIC_VERSION =
  "cover_letter_safe_arm_diagnostic_v1" as const;

export type CoverLetterSafeArmDiagnosticProvenance =
  | "RETAINED"
  | "RECOMPUTED_DETERMINISTICALLY"
  | "MISSING_NOT_RECONSTRUCTABLE";

type Hash = string;
type NullableHash = Hash | null;

const PROVENANCE_VALUES = [
  "RETAINED",
  "RECOMPUTED_DETERMINISTICALLY",
  "MISSING_NOT_RECONSTRUCTABLE",
] as const satisfies readonly CoverLetterSafeArmDiagnosticProvenance[];

const FINALIZER_PATH_CODES = [
  "legacy_thin",
  "structured_success",
  "structured_repaired_success",
  "missing",
] as const;
const FINALIZER_REPAIR_CODES = [
  "bridge_sentence_removed",
  "last_grounded_sentence_removed",
  "structured_repair_applied",
  "quality_repair_attempted",
  "quality_repair_accepted",
  "quality_repair_rejected",
] as const;
const FINALIZER_REPAIR_CODES_BY_PATH = {
  legacy_thin: [
    "bridge_sentence_removed",
    "last_grounded_sentence_removed",
    "quality_repair_attempted",
    "quality_repair_rejected",
  ],
  structured_success: ["quality_repair_attempted", "quality_repair_rejected"],
  structured_repaired_success: [
    "bridge_sentence_removed",
    "last_grounded_sentence_removed",
    "structured_repair_applied",
    "quality_repair_attempted",
    "quality_repair_accepted",
  ],
  missing: [],
} as const satisfies Record<
  (typeof FINALIZER_PATH_CODES)[number],
  readonly (typeof FINALIZER_REPAIR_CODES)[number][]
>;
export const COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES = [
  "meta_prose",
  "factual_inventory",
  "generic_tone",
  "weak_employer_argument",
  "low_value_job_echo",
  "low_specificity",
  "too_verbose",
] as const satisfies readonly PremiumCoverLetterQualityShadowIssueCode[];
export const COVER_LETTER_SAFE_ARM_LANGUAGE_CODES = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "pl",
  "nl",
  "el",
  "hu",
  "lt",
  "et",
  "ru",
  "ar",
] as const satisfies readonly ProposalDocumentLanguageCode[];
const STRUCTURE_CODES = [
  "paragraph_count_available",
  "body_paragraph_count_available",
  "close_present",
  "bridge_present",
  "proof_present",
  "counts_unavailable",
] as const;

type FinalizerPathCode = (typeof FINALIZER_PATH_CODES)[number];
type FinalizerRepairCode = (typeof FINALIZER_REPAIR_CODES)[number];
type QualityShadowCode =
  (typeof COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES)[number];
type StructureCode = (typeof STRUCTURE_CODES)[number];

export type CoverLetterSafeArmDiagnosticInput = Readonly<{
  version: typeof COVER_LETTER_SAFE_ARM_DIAGNOSTIC_VERSION;
  identity: Readonly<{
    runId: string;
    fixtureId: string;
    opaqueArmId: string;
    artifactHash: NullableHash;
    sourceRef: string;
    promptContractHash: NullableHash;
    finalizerVersion: string | null;
    finalizerHash: NullableHash;
    extractorHash: NullableHash;
  }>;
  provenance: Readonly<{
    artifactHash: CoverLetterSafeArmDiagnosticProvenance;
    promptContractHash: CoverLetterSafeArmDiagnosticProvenance;
    finalizer: CoverLetterSafeArmDiagnosticProvenance;
    extractor: CoverLetterSafeArmDiagnosticProvenance;
    finalizerSignals: CoverLetterSafeArmDiagnosticProvenance;
    qualityShadow: CoverLetterSafeArmDiagnosticProvenance;
    structure: CoverLetterSafeArmDiagnosticProvenance;
    language: CoverLetterSafeArmDiagnosticProvenance;
    promptMarker: CoverLetterSafeArmDiagnosticProvenance;
  }>;
  signals: Readonly<{
    finalizer: Readonly<{
      pathCode: FinalizerPathCode;
      repairCodes: readonly FinalizerRepairCode[];
      finalizerPassed: boolean | null;
    }>;
    qualityShadow: Readonly<{
      preCodes: readonly QualityShadowCode[];
      postCodes: readonly QualityShadowCode[];
      prePassed: boolean | null;
      postPassed: boolean | null;
      preScore: number | null;
      postScore: number | null;
    }>;
    structure: Readonly<{
      paragraphCount: number | null;
      bodyParagraphCount: number | null;
      closeCount: number | null;
      bridgeCount: number | null;
      proofCount: number | null;
      codes: readonly StructureCode[];
    }>;
    languageCode:
      | (typeof COVER_LETTER_SAFE_ARM_LANGUAGE_CODES)[number]
      | "unknown";
    promptMarker: Readonly<{
      markerCode: "present" | "absent" | "unavailable";
      hashStatus: "verified" | "missing" | "invalid";
    }>;
  }>;
}>;

export type CoverLetterSafeArmDiagnostic = CoverLetterSafeArmDiagnosticInput &
  Readonly<{
    diagnosticHash: Hash;
  }>;

const VALIDATION_ERROR = "safe arm diagnostic validation failed.";
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const HASH_RE = /^[a-f0-9]{64}$/u;
const SOURCE_REF_RE = /^(?:[a-f0-9]{7,40}|[a-f0-9]{64})$/u;
const OPAQUE_ARM_ID_RE = /^arm-[a-f0-9]{64}$/u;
const MAX_COUNT = 10_000;

function fail(): never {
  throw new TypeError(VALIDATION_ERROR);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
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

function nullableToken(value: unknown): string | null {
  return value === null ? null : token(value);
}

function hash(value: unknown): Hash {
  return typeof value === "string" && HASH_RE.test(value) ? value : fail();
}

function nullableHash(value: unknown): NullableHash {
  return value === null ? null : hash(value);
}

function sourceRef(value: unknown): string {
  return typeof value === "string" && SOURCE_REF_RE.test(value)
    ? value
    : fail();
}

function opaqueArmId(value: unknown): string {
  return typeof value === "string" && OPAQUE_ARM_ID_RE.test(value)
    ? value
    : fail();
}

function nullableBoolean(value: unknown): boolean | null {
  return value === null || typeof value === "boolean" ? value : fail();
}

function boundedCount(value: unknown): number | null {
  return value === null ||
    (Number.isSafeInteger(value) &&
      (value as number) >= 0 &&
      (value as number) <= MAX_COUNT)
    ? (value as number | null)
    : fail();
}

function boundedScore(value: unknown): number | null {
  return value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100)
    ? (value as number | null)
    : fail();
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] {
  return typeof value === "string" && values.includes(value) ? value : fail();
}

function sortedUniqueAllowlistedTokens<const T extends readonly string[]>(
  value: unknown,
  values: T,
  requireCanonical: boolean,
): T[number][] {
  if (!Array.isArray(value)) fail();
  const normalized = value.map((item) => oneOf(item, values));
  const canonical = [...new Set(normalized)].sort();
  if (
    requireCanonical &&
    (normalized.length !== canonical.length ||
      normalized.some((item, index) => item !== canonical[index]))
  ) {
    fail();
  }
  return requireCanonical ? normalized : canonical;
}

function provenance(value: unknown): CoverLetterSafeArmDiagnosticProvenance {
  return oneOf(value, PROVENANCE_VALUES);
}

function assertIdentityConsistency(
  identity: CoverLetterSafeArmDiagnosticInput["identity"],
  provenance: CoverLetterSafeArmDiagnosticInput["provenance"],
  promptMarker: CoverLetterSafeArmDiagnosticInput["signals"]["promptMarker"],
): void {
  if (
    (identity.artifactHash === null) !==
    (provenance.artifactHash === "MISSING_NOT_RECONSTRUCTABLE")
  ) {
    fail();
  }
  if (
    (identity.promptContractHash === null) !==
    (provenance.promptContractHash === "MISSING_NOT_RECONSTRUCTABLE")
  ) {
    fail();
  }
  if (
    (identity.finalizerVersion === null) !==
      (identity.finalizerHash === null) ||
    (identity.finalizerVersion === null) !==
      (provenance.finalizer === "MISSING_NOT_RECONSTRUCTABLE")
  ) {
    fail();
  }
  if (
    (identity.extractorHash === null) !==
    (provenance.extractor === "MISSING_NOT_RECONSTRUCTABLE")
  ) {
    fail();
  }
  if (
    promptMarker.hashStatus === "verified" &&
    identity.promptContractHash === null
  ) {
    fail();
  }
  if (
    identity.promptContractHash === null &&
    promptMarker.hashStatus !== "missing"
  ) {
    fail();
  }
}

function assertFinalizerConsistency(
  finalizer: CoverLetterSafeArmDiagnosticInput["signals"]["finalizer"],
): void {
  if (
    finalizer.pathCode === "missing" &&
    (finalizer.finalizerPassed !== null || finalizer.repairCodes.length !== 0)
  ) {
    fail();
  }
  if (finalizer.pathCode !== "missing" && finalizer.finalizerPassed !== true) {
    fail();
  }
  const allowedRepairCodes = FINALIZER_REPAIR_CODES_BY_PATH[finalizer.pathCode];
  if (
    finalizer.repairCodes.some((code) => !allowedRepairCodes.includes(code))
  ) {
    fail();
  }
}

function assertQualityShadowConsistency(
  qualityShadow: CoverLetterSafeArmDiagnosticInput["signals"]["qualityShadow"],
): void {
  const qualityShadowSignals = [
    [qualityShadow.preCodes, qualityShadow.prePassed],
    [qualityShadow.postCodes, qualityShadow.postPassed],
  ] as const;
  for (const [codes, passed] of qualityShadowSignals) {
    if (passed !== null && passed !== (codes.length === 0)) {
      fail();
    }
  }
}

function assertSignalProvenanceConsistency(
  provenance: CoverLetterSafeArmDiagnosticInput["provenance"],
  signals: CoverLetterSafeArmDiagnosticInput["signals"],
): void {
  const finalizerSignalsMissing =
    signals.finalizer.pathCode === "missing" &&
    signals.finalizer.repairCodes.length === 0 &&
    signals.finalizer.finalizerPassed === null;
  const qualityShadowMissing =
    signals.qualityShadow.preCodes.length === 0 &&
    signals.qualityShadow.postCodes.length === 0 &&
    signals.qualityShadow.prePassed === null &&
    signals.qualityShadow.postPassed === null &&
    signals.qualityShadow.preScore === null &&
    signals.qualityShadow.postScore === null;
  const structureMissing =
    signals.structure.paragraphCount === null &&
    signals.structure.bodyParagraphCount === null &&
    signals.structure.closeCount === null &&
    signals.structure.bridgeCount === null &&
    signals.structure.proofCount === null &&
    signals.structure.codes.length === 1 &&
    signals.structure.codes[0] === "counts_unavailable";
  const languageMissing = signals.languageCode === "unknown";
  const promptMarkerMissing =
    signals.promptMarker.markerCode === "unavailable" &&
    signals.promptMarker.hashStatus === "missing";

  const signalProvenance: readonly [
    CoverLetterSafeArmDiagnosticProvenance,
    boolean,
  ][] = [
    [provenance.finalizerSignals, finalizerSignalsMissing],
    [provenance.qualityShadow, qualityShadowMissing],
    [provenance.structure, structureMissing],
    [provenance.language, languageMissing],
    [provenance.promptMarker, promptMarkerMissing],
  ];
  for (const [signalProvenanceValue, signalMissing] of signalProvenance) {
    if (
      (signalProvenanceValue === "MISSING_NOT_RECONSTRUCTABLE") !==
      signalMissing
    ) {
      fail();
    }
  }
  if (
    signals.promptMarker.markerCode === "unavailable" &&
    !promptMarkerMissing
  ) {
    fail();
  }
}

function assertDiagnosticConsistency(
  input: CoverLetterSafeArmDiagnosticInput,
): void {
  assertIdentityConsistency(
    input.identity,
    input.provenance,
    input.signals.promptMarker,
  );
  assertFinalizerConsistency(input.signals.finalizer);
  assertQualityShadowConsistency(input.signals.qualityShadow);
  assertSignalProvenanceConsistency(input.provenance, input.signals);
}

function normalizeInput(
  value: unknown,
  options: Readonly<{ requireCanonicalArrays: boolean }> = {
    requireCanonicalArrays: false,
  },
): CoverLetterSafeArmDiagnosticInput {
  if (!isRecord(value)) fail();
  exactKeys(value, ["version", "identity", "provenance", "signals"]);
  if (value.version !== COVER_LETTER_SAFE_ARM_DIAGNOSTIC_VERSION) fail();

  const identity = value.identity;
  if (!isRecord(identity)) fail();
  exactKeys(identity, [
    "runId",
    "fixtureId",
    "opaqueArmId",
    "artifactHash",
    "sourceRef",
    "promptContractHash",
    "finalizerVersion",
    "finalizerHash",
    "extractorHash",
  ]);

  const provenanceValue = value.provenance;
  if (!isRecord(provenanceValue)) fail();
  exactKeys(provenanceValue, [
    "artifactHash",
    "promptContractHash",
    "finalizer",
    "extractor",
    "finalizerSignals",
    "qualityShadow",
    "structure",
    "language",
    "promptMarker",
  ]);

  const signals = value.signals;
  if (!isRecord(signals)) fail();
  exactKeys(signals, [
    "finalizer",
    "qualityShadow",
    "structure",
    "languageCode",
    "promptMarker",
  ]);

  const finalizer = signals.finalizer;
  if (!isRecord(finalizer)) fail();
  exactKeys(finalizer, ["pathCode", "repairCodes", "finalizerPassed"]);

  const qualityShadow = signals.qualityShadow;
  if (!isRecord(qualityShadow)) fail();
  exactKeys(qualityShadow, [
    "preCodes",
    "postCodes",
    "prePassed",
    "postPassed",
    "preScore",
    "postScore",
  ]);

  const structure = signals.structure;
  if (!isRecord(structure)) fail();
  exactKeys(structure, [
    "paragraphCount",
    "bodyParagraphCount",
    "closeCount",
    "bridgeCount",
    "proofCount",
    "codes",
  ]);

  const promptMarker = signals.promptMarker;
  if (!isRecord(promptMarker)) fail();
  exactKeys(promptMarker, ["markerCode", "hashStatus"]);

  const input: CoverLetterSafeArmDiagnosticInput = {
    version: COVER_LETTER_SAFE_ARM_DIAGNOSTIC_VERSION,
    identity: {
      runId: token(identity.runId),
      fixtureId: token(identity.fixtureId),
      opaqueArmId: opaqueArmId(identity.opaqueArmId),
      artifactHash: nullableHash(identity.artifactHash),
      sourceRef: sourceRef(identity.sourceRef),
      promptContractHash: nullableHash(identity.promptContractHash),
      finalizerVersion: nullableToken(identity.finalizerVersion),
      finalizerHash: nullableHash(identity.finalizerHash),
      extractorHash: nullableHash(identity.extractorHash),
    },
    provenance: {
      artifactHash: provenance(provenanceValue.artifactHash),
      promptContractHash: provenance(provenanceValue.promptContractHash),
      finalizer: provenance(provenanceValue.finalizer),
      extractor: provenance(provenanceValue.extractor),
      finalizerSignals: provenance(provenanceValue.finalizerSignals),
      qualityShadow: provenance(provenanceValue.qualityShadow),
      structure: provenance(provenanceValue.structure),
      language: provenance(provenanceValue.language),
      promptMarker: provenance(provenanceValue.promptMarker),
    },
    signals: {
      finalizer: {
        pathCode: oneOf(finalizer.pathCode, FINALIZER_PATH_CODES),
        repairCodes: sortedUniqueAllowlistedTokens(
          finalizer.repairCodes,
          FINALIZER_REPAIR_CODES,
          options.requireCanonicalArrays,
        ),
        finalizerPassed: nullableBoolean(finalizer.finalizerPassed),
      },
      qualityShadow: {
        preCodes: sortedUniqueAllowlistedTokens(
          qualityShadow.preCodes,
          COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES,
          options.requireCanonicalArrays,
        ),
        postCodes: sortedUniqueAllowlistedTokens(
          qualityShadow.postCodes,
          COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES,
          options.requireCanonicalArrays,
        ),
        prePassed: nullableBoolean(qualityShadow.prePassed),
        postPassed: nullableBoolean(qualityShadow.postPassed),
        preScore: boundedScore(qualityShadow.preScore),
        postScore: boundedScore(qualityShadow.postScore),
      },
      structure: {
        paragraphCount: boundedCount(structure.paragraphCount),
        bodyParagraphCount: boundedCount(structure.bodyParagraphCount),
        closeCount: boundedCount(structure.closeCount),
        bridgeCount: boundedCount(structure.bridgeCount),
        proofCount: boundedCount(structure.proofCount),
        codes: sortedUniqueAllowlistedTokens(
          structure.codes,
          STRUCTURE_CODES,
          options.requireCanonicalArrays,
        ),
      },
      languageCode: oneOf(signals.languageCode, [
        ...COVER_LETTER_SAFE_ARM_LANGUAGE_CODES,
        "unknown",
      ]),
      promptMarker: {
        markerCode: oneOf(promptMarker.markerCode, [
          "present",
          "absent",
          "unavailable",
        ]),
        hashStatus: oneOf(promptMarker.hashStatus, [
          "verified",
          "missing",
          "invalid",
        ]),
      },
    },
  };
  assertDiagnosticConsistency(input);
  return input;
}

async function hashInput(
  input: CoverLetterSafeArmDiagnosticInput,
): Promise<Hash> {
  return buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "diagnostic",
    version: 1,
    value: input,
  });
}

export async function buildCoverLetterSafeArmDiagnostic(
  value: unknown,
): Promise<CoverLetterSafeArmDiagnostic> {
  const input = normalizeInput(value);
  return { ...input, diagnosticHash: await hashInput(input) };
}

export async function validateCoverLetterSafeArmDiagnostic(
  value: unknown,
): Promise<CoverLetterSafeArmDiagnostic> {
  if (!isRecord(value)) fail();
  exactKeys(value, [
    "version",
    "identity",
    "provenance",
    "signals",
    "diagnosticHash",
  ]);
  const { diagnosticHash, ...input } = value;
  const normalized = normalizeInput(input, { requireCanonicalArrays: true });
  if (diagnosticHash !== (await hashInput(normalized))) fail();
  return { ...normalized, diagnosticHash: hash(diagnosticHash) };
}

export function redactCoverLetterSafeArmDiagnosticInput(
  value: unknown,
): CoverLetterSafeArmDiagnosticInput | null {
  try {
    return normalizeInput(value);
  } catch {
    return null;
  }
}

export async function deriveCoverLetterOpaqueArmId(args: {
  runId: string;
  fixtureId: string;
  armKey: string;
}): Promise<string> {
  const normalizedRunId = token(args.runId);
  const normalizedFixtureId = token(args.fixtureId);
  const normalizedArmKey = token(args.armKey);
  const digest = await buildStableHash({
    namespace: "cover-letter-safe-arm-diagnostic",
    type: "opaque-arm-id",
    version: 1,
    runId: normalizedRunId,
    fixtureId: normalizedFixtureId,
    armKey: normalizedArmKey,
  });
  return `arm-${digest}`;
}
