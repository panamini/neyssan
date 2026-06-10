import { buildStableHash } from "../application-harness/fingerprints";
import { buildResumeVariantArtifactContentHash } from "../resume-variant-artifact/buildResumeVariantArtifact";
import type { ResumeVariantArtifactStatusV1 } from "../resume-variant-artifact/schema";
import { isForbiddenResumeOrCoverLetterText, sortUniqueStrings } from "../resume-variant-plan/planRules";
import {
  countCoverLetterParagraphs,
  deriveCoverLetterArtifactStatus,
  isCoverLetterArtifactSourceKind,
  isCoverLetterArtifactTextFormat,
  isResumeVariantArtifactStatusForCoverLetter,
} from "./artifactRules";
import type {
  BuildCoverLetterArtifactInputV1,
  CoverLetterArtifactContentV1,
  CoverLetterArtifactProvenanceV1,
  CoverLetterArtifactSourceMetadataV1,
  CoverLetterArtifactStatusV1,
  CoverLetterArtifactTextV1,
  CoverLetterArtifactV1,
} from "./schema";

const HASH_NAMESPACE = "cover-letter-artifact";
const ARTIFACT_ID_PREFIX = "cover-letter-artifact:";
const SOURCE_METADATA_KEYS = ["sourceId", "proposalId", "generatorInputHash", "sourceLabel"] as const;

type StableCoverLetterArtifactHashInput = Readonly<{
  userId: string;
  applicationContextId: string;
  language?: string;
  market?: string;
  resumeVariantArtifactId: string;
  resumeVariantArtifactStatus: ResumeVariantArtifactStatusV1;
  sourceText: string;
  sourceKind: BuildCoverLetterArtifactInputV1["sourceKind"];
  format: BuildCoverLetterArtifactInputV1["format"];
  sourceMetadata?: CoverLetterArtifactSourceMetadataV1;
}>;

type StableCoverLetterArtifactForHash = Omit<CoverLetterArtifactV1, "id" | "createdAt" | "updatedAt">;

export async function buildCoverLetterArtifact(input: BuildCoverLetterArtifactInputV1): Promise<CoverLetterArtifactV1> {
  assertCoverLetterArtifactInput(input);
  const status = deriveCoverLetterArtifactStatus(input.resumeVariantArtifact.status, input.sourceText);
  const artifact: CoverLetterArtifactV1 = {
    id: `${ARTIFACT_ID_PREFIX}${await buildCoverLetterArtifactHash(input)}`,
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    language: input.language,
    market: input.market,
    status,
    text: await buildCoverLetterArtifactText(input),
    sourceMetadata: buildCoverLetterArtifactSourceMetadata(input.sourceMetadata),
    warnings: buildCoverLetterArtifactWarnings(input, status),
    blockedReason: status === "blocked" ? "resume_variant_artifact_blocked" : undefined,
    provenance: await buildCoverLetterArtifactProvenance(input),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: 1,
  };

  assertCoverLetterArtifactTextPreserved(artifact, input);
  assertCoverLetterArtifactProvenanceBacked(artifact, input);
  assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText(artifact);
  return artifact;
}

export function buildCoverLetterArtifactHash(input: BuildCoverLetterArtifactInputV1): Promise<string> {
  assertCoverLetterArtifactInput(input);
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "cover-letter-artifact-input",
    version: 1,
    input: buildStableArtifactHashInput(input),
  });
}

export function buildCoverLetterArtifactContentHash(artifact: CoverLetterArtifactV1): Promise<string> {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "cover-letter-artifact-content",
    version: 1,
    artifact: buildStableArtifactForHash(artifact),
  });
}

export function buildCoverLetterArtifactContent(artifact: CoverLetterArtifactV1): CoverLetterArtifactContentV1 {
  return { kind: "cover_letter_artifact", artifact, version: 1 };
}

export async function buildCoverLetterArtifactText(input: BuildCoverLetterArtifactInputV1): Promise<CoverLetterArtifactTextV1> {
  assertCoverLetterArtifactInput(input);
  return {
    value: input.sourceText,
    format: input.format,
    sourceKind: input.sourceKind,
    textHash: await buildCoverLetterArtifactTextHash(input.sourceText, input.format, input.sourceKind),
    paragraphCount: countCoverLetterParagraphs(input.sourceText),
    characterCount: input.sourceText.length,
    version: 1,
  };
}

export function buildCoverLetterArtifactWarnings(
  input: BuildCoverLetterArtifactInputV1,
  status: CoverLetterArtifactStatusV1,
): readonly string[] {
  assertCoverLetterArtifactInput(input);
  return sortUniqueStrings([
    input.sourceText.trim().length === 0 ? "cover_letter_text_empty" : undefined,
    input.sourceKind === "unknown" ? "cover_letter_source_unknown" : undefined,
    input.resumeVariantArtifact.status === "blocked" ? "resume_variant_artifact_blocked" : undefined,
    input.resumeVariantArtifact.status === "needs_review" ? "resume_variant_artifact_needs_review" : undefined,
    input.resumeVariantArtifact.status === "draft" ? "resume_variant_artifact_draft" : undefined,
    status === "blocked" ? "resume_variant_artifact_blocked" : undefined,
  ].filter((value): value is string => Boolean(value)));
}

export function assertCoverLetterArtifactInput(input: BuildCoverLetterArtifactInputV1): void {
  if (!isPlainRecord(input)) throw new TypeError("CoverLetterArtifact input must be an object");
  if (!isNonEmptyString(input.userId)) throw new TypeError("CoverLetterArtifact input requires userId");
  if (!isNonEmptyString(input.applicationContextId)) throw new TypeError("CoverLetterArtifact input requires applicationContextId");
  if (!isPlainRecord(input.resumeVariantArtifact) || !isNonEmptyString(input.resumeVariantArtifact.id)) {
    throw new TypeError("CoverLetterArtifact input requires ResumeVariantArtifact");
  }
  if (input.userId !== input.resumeVariantArtifact.userId) throw new TypeError("CoverLetterArtifact input userId must match ResumeVariantArtifact");
  if (input.applicationContextId !== input.resumeVariantArtifact.applicationContextId) {
    throw new TypeError("CoverLetterArtifact input applicationContextId must match ResumeVariantArtifact");
  }
  if (!isResumeVariantArtifactStatusForCoverLetter(input.resumeVariantArtifact.status)) {
    throw new TypeError("CoverLetterArtifact input requires a known ResumeVariantArtifact status");
  }
  if (typeof input.sourceText !== "string") throw new TypeError("CoverLetterArtifact input sourceText must be a string");
  if (!isCoverLetterArtifactSourceKind(input.sourceKind)) throw new TypeError("CoverLetterArtifact input requires a known sourceKind");
  if (!isCoverLetterArtifactTextFormat(input.format)) throw new TypeError("CoverLetterArtifact input requires a known text format");
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) throw new TypeError("CoverLetterArtifact input requires numeric timestamps");
  assertCoverLetterArtifactSourceMetadataInput(input.sourceMetadata);
  assertResumeVariantArtifactProvenanceInput(input);
}

export function assertCoverLetterArtifactProvenanceBacked(artifact: CoverLetterArtifactV1, input: BuildCoverLetterArtifactInputV1): void {
  const expected = input.resumeVariantArtifact.provenance;
  if (artifact.provenance.applicationContextId !== input.applicationContextId) throw new TypeError("CoverLetterArtifact provenance applicationContextId mismatch");
  if (artifact.provenance.resumeVariantArtifactId !== input.resumeVariantArtifact.id) throw new TypeError("CoverLetterArtifact provenance ResumeVariantArtifact id mismatch");
  if (artifact.provenance.evidenceGraphId !== expected.evidenceGraphId) throw new TypeError("CoverLetterArtifact provenance EvidenceGraph id mismatch");
  if (artifact.provenance.evidenceGraphHash !== expected.evidenceGraphHash) throw new TypeError("CoverLetterArtifact provenance EvidenceGraph hash mismatch");
  if (artifact.provenance.resumeVariantPlanId !== expected.resumeVariantPlanId) throw new TypeError("CoverLetterArtifact provenance ResumeVariantPlan id mismatch");
  if (artifact.provenance.resumeVariantPlanHash !== expected.resumeVariantPlanHash) throw new TypeError("CoverLetterArtifact provenance ResumeVariantPlan hash mismatch");
  if (artifact.provenance.reviewCockpitId !== expected.reviewCockpitId) throw new TypeError("CoverLetterArtifact provenance ReviewCockpit id mismatch");
  assertSameStringArray(artifact.provenance.sourceFactIds, expected.sourceFactIds, "sourceFactIds");
  assertSameStringArray(artifact.provenance.allowedClaimIds, expected.allowedClaimIds, "allowedClaimIds");
  assertSameStringArray(artifact.provenance.evidenceMatchIds, expected.evidenceMatchIds, "evidenceMatchIds");
  assertSameStringArray(artifact.provenance.demandIds, expected.demandIds, "demandIds");
  assertSameStringArray(artifact.provenance.riskFlagIds, expected.riskFlagIds, "riskFlagIds");
  assertSameStringArray(artifact.provenance.reviewItemIds, expected.reviewItemIds, "reviewItemIds");
}

export function assertCoverLetterArtifactTextPreserved(artifact: CoverLetterArtifactV1, input: BuildCoverLetterArtifactInputV1): void {
  if (artifact.text.value !== input.sourceText) throw new TypeError("CoverLetterArtifact text must preserve sourceText exactly");
  if (artifact.text.characterCount !== input.sourceText.length) throw new TypeError("CoverLetterArtifact characterCount must match sourceText length");
}

export function assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText(artifact: CoverLetterArtifactV1): void {
  const values = [
    artifact.blockedReason,
    ...artifact.warnings,
    artifact.sourceMetadata?.sourceId,
    artifact.sourceMetadata?.proposalId,
    artifact.sourceMetadata?.generatorInputHash,
    artifact.sourceMetadata?.sourceLabel,
  ].filter((value): value is string => typeof value === "string");
  for (const value of values) {
    if (isForbiddenResumeOrCoverLetterText(value)) throw new Error("CoverLetterArtifact contains generated cover-letter text outside artifact.text.value");
  }
}

export function collectCoverLetterArtifactSourceFactIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.sourceFactIds);
}
export function collectCoverLetterArtifactAllowedClaimIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.allowedClaimIds);
}
export function collectCoverLetterArtifactEvidenceMatchIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.evidenceMatchIds);
}
export function collectCoverLetterArtifactDemandIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.demandIds);
}
export function collectCoverLetterArtifactRiskFlagIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.riskFlagIds);
}
export function collectCoverLetterArtifactReviewItemIds(artifact: CoverLetterArtifactV1): readonly string[] {
  return sortUniqueStrings(artifact.provenance.reviewItemIds);
}

export function buildCoverLetterArtifactTextHash(
  sourceText: string,
  format: BuildCoverLetterArtifactInputV1["format"],
  sourceKind: BuildCoverLetterArtifactInputV1["sourceKind"],
): Promise<string> {
  if (typeof sourceText !== "string") throw new TypeError("CoverLetterArtifact text hash requires sourceText to be a string");
  if (!isCoverLetterArtifactTextFormat(format)) throw new TypeError("CoverLetterArtifact text hash requires a known text format");
  if (!isCoverLetterArtifactSourceKind(sourceKind)) throw new TypeError("CoverLetterArtifact text hash requires a known sourceKind");
  return buildStableHash({ namespace: HASH_NAMESPACE, type: "cover-letter-artifact-text", version: 1, sourceText, format, sourceKind });
}

function buildStableArtifactHashInput(input: BuildCoverLetterArtifactInputV1): StableCoverLetterArtifactHashInput {
  return {
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    language: input.language,
    market: input.market,
    resumeVariantArtifactId: input.resumeVariantArtifact.id,
    resumeVariantArtifactStatus: input.resumeVariantArtifact.status,
    sourceText: input.sourceText,
    sourceKind: input.sourceKind,
    format: input.format,
    sourceMetadata: buildCoverLetterArtifactSourceMetadata(input.sourceMetadata),
  };
}

function buildStableArtifactForHash(artifact: CoverLetterArtifactV1): StableCoverLetterArtifactForHash {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...stableArtifact } = artifact;
  return stableArtifact;
}

async function buildCoverLetterArtifactProvenance(input: BuildCoverLetterArtifactInputV1): Promise<CoverLetterArtifactProvenanceV1> {
  const provenance = input.resumeVariantArtifact.provenance;
  return {
    applicationContextId: input.applicationContextId,
    resumeVariantArtifactId: input.resumeVariantArtifact.id,
    resumeVariantArtifactContentHash: await buildResumeVariantArtifactContentHash(input.resumeVariantArtifact),
    evidenceGraphId: provenance.evidenceGraphId,
    evidenceGraphHash: provenance.evidenceGraphHash,
    resumeVariantPlanId: provenance.resumeVariantPlanId,
    resumeVariantPlanHash: provenance.resumeVariantPlanHash,
    reviewCockpitId: provenance.reviewCockpitId,
    sourceFactIds: [...provenance.sourceFactIds],
    allowedClaimIds: [...provenance.allowedClaimIds],
    evidenceMatchIds: [...provenance.evidenceMatchIds],
    demandIds: [...provenance.demandIds],
    riskFlagIds: [...provenance.riskFlagIds],
    reviewItemIds: [...provenance.reviewItemIds],
    version: 1,
  };
}

function buildCoverLetterArtifactSourceMetadata(sourceMetadata: BuildCoverLetterArtifactInputV1["sourceMetadata"]): CoverLetterArtifactSourceMetadataV1 | undefined {
  if (sourceMetadata === undefined) return undefined;
  return {
    sourceId: sourceMetadata.sourceId,
    proposalId: sourceMetadata.proposalId,
    generatorInputHash: sourceMetadata.generatorInputHash,
    sourceLabel: sourceMetadata.sourceLabel,
    version: 1,
  };
}

function assertCoverLetterArtifactSourceMetadataInput(sourceMetadata: BuildCoverLetterArtifactInputV1["sourceMetadata"]): void {
  if (sourceMetadata === undefined) return;
  if (!isPlainRecord(sourceMetadata)) throw new TypeError("CoverLetterArtifact sourceMetadata must be an object");
  const allowedKeys = new Set<string>(SOURCE_METADATA_KEYS);
  for (const key of Object.keys(sourceMetadata)) {
    if (!allowedKeys.has(key)) throw new TypeError(`CoverLetterArtifact sourceMetadata contains unsupported field ${key}`);
  }
  for (const key of SOURCE_METADATA_KEYS) {
    const value = sourceMetadata[key];
    if (value !== undefined && typeof value !== "string") throw new TypeError(`CoverLetterArtifact sourceMetadata ${key} must be a string`);
  }
}

function assertResumeVariantArtifactProvenanceInput(input: BuildCoverLetterArtifactInputV1): void {
  const provenance = input.resumeVariantArtifact.provenance;
  if (!isPlainRecord(provenance)) throw new TypeError("CoverLetterArtifact input requires ResumeVariantArtifact provenance");
  if (provenance.applicationContextId !== input.applicationContextId) throw new TypeError("CoverLetterArtifact input provenance applicationContextId must match input");
  for (const key of ["evidenceGraphId", "evidenceGraphHash", "resumeVariantPlanId", "resumeVariantPlanHash", "reviewCockpitId"] as const) {
    if (!isNonEmptyString(provenance[key])) throw new TypeError(`CoverLetterArtifact input provenance requires ${key}`);
  }
  for (const key of ["sourceFactIds", "allowedClaimIds", "evidenceMatchIds", "demandIds", "riskFlagIds", "reviewItemIds"] as const) {
    if (!isStringArray(provenance[key])) throw new TypeError(`CoverLetterArtifact input provenance requires ${key}`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function assertSameStringArray(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(`CoverLetterArtifact provenance ${label} mismatch`);
  }
}
