import { buildStableHash } from "../application-harness/fingerprints";
import { buildCoverLetterArtifactContentHash } from "../cover-letter-artifact/buildCoverLetterArtifact";
import { buildResumeVariantArtifactContentHash } from "../resume-variant-artifact/buildResumeVariantArtifact";
import type { ResumeVariantArtifactStatusV1 } from "../resume-variant-artifact/schema";
import {
  deriveApplicationPackageBlockedReason,
  deriveApplicationPackageStatus,
  isCoverLetterArtifactStatusForApplicationPackage,
  isResumeVariantArtifactStatusForApplicationPackage,
  sortApplicationPackageWarnings,
  warningForCoverLetterArtifactStatus,
  warningForResumeVariantArtifactStatus,
} from "./packageRules";
import type {
  ApplicationPackageArtifactRefV1,
  ApplicationPackageContentV1,
  ApplicationPackageItemStatusV1,
  ApplicationPackageItemV1,
  ApplicationPackageProvenanceV1,
  ApplicationPackageStatusV1,
  ApplicationPackageV1,
  BuildApplicationPackageInputV1,
} from "./schema";

const HASH_NAMESPACE = "application-package";
const PACKAGE_ID_PREFIX = "application-package:";

type RollupKey =
  | "sourceFactIds"
  | "allowedClaimIds"
  | "evidenceMatchIds"
  | "demandIds"
  | "riskFlagIds"
  | "reviewItemIds";

type StableApplicationPackageHashInput = Readonly<{
  userId: string;
  applicationContextId: string;
  resumeVariantArtifactId: string;
  resumeVariantArtifactStatus: ResumeVariantArtifactStatusV1;
  coverLetterArtifactId: string;
  coverLetterArtifactStatus: BuildApplicationPackageInputV1["coverLetterArtifact"]["status"];
}>;

type StableApplicationPackageForHash = Omit<ApplicationPackageV1, "id" | "createdAt" | "updatedAt">;

export async function buildApplicationPackage(
  input: BuildApplicationPackageInputV1,
): Promise<ApplicationPackageV1> {
  assertApplicationPackageInput(input);

  const status = deriveApplicationPackageStatus(
    input.resumeVariantArtifact.status,
    input.coverLetterArtifact.status,
  );
  const applicationPackage: ApplicationPackageV1 = {
    id: `${PACKAGE_ID_PREFIX}${await buildApplicationPackageHash(input)}`,
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    status,
    artifacts: await buildApplicationPackageArtifactRefs(input),
    items: await buildApplicationPackageItems(input),
    warnings: buildApplicationPackageWarnings(input, status),
    blockedReason: deriveApplicationPackageBlockedReason(
      input.resumeVariantArtifact.status,
      input.coverLetterArtifact.status,
    ),
    provenance: buildApplicationPackageProvenance(input),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: 1,
  };

  assertApplicationPackageProvenanceBacked(applicationPackage, input);
  assertApplicationPackageDoesNotContainGeneratedText(applicationPackage);

  return applicationPackage;
}

export function buildApplicationPackageHash(input: BuildApplicationPackageInputV1): Promise<string> {
  assertApplicationPackageInput(input);
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "application-package-input",
    version: 1,
    input: buildStablePackageHashInput(input),
  });
}

export function buildApplicationPackageContentHash(
  applicationPackage: ApplicationPackageV1,
): Promise<string> {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "application-package-content",
    version: 1,
    applicationPackage: buildStablePackageForHash(applicationPackage),
  });
}

export function buildApplicationPackageContent(
  applicationPackage: ApplicationPackageV1,
): ApplicationPackageContentV1 {
  return { kind: "application_package", package: applicationPackage, version: 1 };
}

export async function buildApplicationPackageItems(
  input: BuildApplicationPackageInputV1,
): Promise<readonly ApplicationPackageItemV1[]> {
  assertApplicationPackageInput(input);
  const status = deriveApplicationPackageStatus(
    input.resumeVariantArtifact.status,
    input.coverLetterArtifact.status,
  );
  const warnings = buildApplicationPackageWarnings(input, status);
  const provenance = buildApplicationPackageProvenance(input);
  const packageItemScope = await buildApplicationPackageItemScope(input);
  const resumeVariantArtifactContentHash = await buildResumeVariantArtifactContentHash(
    input.resumeVariantArtifact,
  );
  const coverLetterArtifactContentHash = await buildCoverLetterArtifactContentHash(input.coverLetterArtifact);

  const items: ApplicationPackageItemV1[] = [
    {
      id: `application-package-item:${packageItemScope}:resume-variant-artifact`,
      kind: "resume_variant",
      artifactId: input.resumeVariantArtifact.id,
      artifactContentHash: resumeVariantArtifactContentHash,
      status: mapResumeVariantArtifactItemStatus(input.resumeVariantArtifact.status),
      label: "Resume variant artifact included.",
      note: "Package references the resume variant artifact without duplicating resume text.",
      sourceFactIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.sourceFactIds),
      allowedClaimIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.allowedClaimIds),
      evidenceMatchIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.evidenceMatchIds),
      demandIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.demandIds),
      riskFlagIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.riskFlagIds),
      reviewItemIds: sortUniqueStrings(input.resumeVariantArtifact.provenance.reviewItemIds),
      version: 1,
    },
    {
      id: `application-package-item:${packageItemScope}:cover-letter-artifact`,
      kind: "cover_letter",
      artifactId: input.coverLetterArtifact.id,
      artifactContentHash: coverLetterArtifactContentHash,
      status: mapCoverLetterArtifactItemStatus(input.coverLetterArtifact.status),
      label: "Cover-letter artifact included.",
      note: "Package references the cover-letter artifact without duplicating cover-letter text.",
      sourceFactIds: sortUniqueStrings(input.coverLetterArtifact.provenance.sourceFactIds),
      allowedClaimIds: sortUniqueStrings(input.coverLetterArtifact.provenance.allowedClaimIds),
      evidenceMatchIds: sortUniqueStrings(input.coverLetterArtifact.provenance.evidenceMatchIds),
      demandIds: sortUniqueStrings(input.coverLetterArtifact.provenance.demandIds),
      riskFlagIds: sortUniqueStrings(input.coverLetterArtifact.provenance.riskFlagIds),
      reviewItemIds: sortUniqueStrings(input.coverLetterArtifact.provenance.reviewItemIds),
      version: 1,
    },
  ];

  if (hasAnyProvenance(provenance)) {
    items.push({
      id: `application-package-item:${packageItemScope}:supporting-provenance`,
      kind: "supporting_provenance",
      status: "notice",
      label: "Package includes source-backed provenance.",
      note: "Provenance IDs are unioned from the resume variant and cover-letter artifacts.",
      sourceFactIds: provenance.sourceFactIds,
      allowedClaimIds: provenance.allowedClaimIds,
      evidenceMatchIds: provenance.evidenceMatchIds,
      demandIds: provenance.demandIds,
      riskFlagIds: provenance.riskFlagIds,
      reviewItemIds: provenance.reviewItemIds,
      version: 1,
    });
  }

  for (const warning of warnings) {
    items.push({
      id: `application-package-item:${packageItemScope}:warning:${warning}`,
      kind: "warning",
      status: "notice",
      label: labelForApplicationPackageWarning(warning),
      note: noteForApplicationPackageWarning(warning),
      sourceFactIds: [],
      allowedClaimIds: [],
      evidenceMatchIds: [],
      demandIds: [],
      riskFlagIds: [],
      reviewItemIds: [],
      version: 1,
    });
  }

  if (status === "blocked") {
    const blockedReason = deriveApplicationPackageBlockedReason(
      input.resumeVariantArtifact.status,
      input.coverLetterArtifact.status,
    );
    items.push({
      id: `application-package-item:${packageItemScope}:blocker:${blockedReason ?? "unknown"}`,
      kind: "blocker",
      status: "blocked",
      label: labelForApplicationPackageWarning(blockedReason ?? "application_package_blocked"),
      note: "Package is blocked until upstream artifact blockers are resolved.",
      sourceFactIds: [],
      allowedClaimIds: [],
      evidenceMatchIds: [],
      demandIds: [],
      riskFlagIds: [],
      reviewItemIds: [],
      version: 1,
    });
  }

  return items;
}

export function buildApplicationPackageWarnings(
  input: BuildApplicationPackageInputV1,
  _status: ApplicationPackageStatusV1,
): readonly string[] {
  assertApplicationPackageInput(input);
  return sortApplicationPackageWarnings([
    warningForResumeVariantArtifactStatus(input.resumeVariantArtifact.status),
    warningForCoverLetterArtifactStatus(input.coverLetterArtifact.status),
  ].filter((value): value is string => Boolean(value)));
}

export function assertApplicationPackageInput(input: BuildApplicationPackageInputV1): void {
  if (!isPlainRecord(input)) throw new TypeError("ApplicationPackage input must be an object");
  if (!isNonEmptyString(input.userId)) throw new TypeError("ApplicationPackage input requires userId");
  if (!isNonEmptyString(input.applicationContextId)) {
    throw new TypeError("ApplicationPackage input requires applicationContextId");
  }
  if (!isPlainRecord(input.resumeVariantArtifact) || !isNonEmptyString(input.resumeVariantArtifact.id)) {
    throw new TypeError("ApplicationPackage input requires ResumeVariantArtifact");
  }
  if (!isPlainRecord(input.coverLetterArtifact) || !isNonEmptyString(input.coverLetterArtifact.id)) {
    throw new TypeError("ApplicationPackage input requires CoverLetterArtifact");
  }
  if (input.userId !== input.resumeVariantArtifact.userId) {
    throw new TypeError("ApplicationPackage input userId must match ResumeVariantArtifact");
  }
  if (input.userId !== input.coverLetterArtifact.userId) {
    throw new TypeError("ApplicationPackage input userId must match CoverLetterArtifact");
  }
  if (input.applicationContextId !== input.resumeVariantArtifact.applicationContextId) {
    throw new TypeError("ApplicationPackage input applicationContextId must match ResumeVariantArtifact");
  }
  if (input.applicationContextId !== input.coverLetterArtifact.applicationContextId) {
    throw new TypeError("ApplicationPackage input applicationContextId must match CoverLetterArtifact");
  }
  if (!isResumeVariantArtifactStatusForApplicationPackage(input.resumeVariantArtifact.status)) {
    throw new TypeError("ApplicationPackage input requires a known ResumeVariantArtifact status");
  }
  if (!isCoverLetterArtifactStatusForApplicationPackage(input.coverLetterArtifact.status)) {
    throw new TypeError("ApplicationPackage input requires a known CoverLetterArtifact status");
  }
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError("ApplicationPackage input requires numeric timestamps");
  }
  assertApplicationPackageArtifactProvenanceInput(input);
}

export function assertApplicationPackageProvenanceBacked(
  applicationPackage: ApplicationPackageV1,
  input: BuildApplicationPackageInputV1,
): void {
  const expected = buildApplicationPackageProvenance(input);
  if (applicationPackage.provenance.applicationContextId !== input.applicationContextId) {
    throw new TypeError("ApplicationPackage provenance applicationContextId mismatch");
  }
  if (applicationPackage.provenance.resumeVariantArtifactId !== input.resumeVariantArtifact.id) {
    throw new TypeError("ApplicationPackage provenance ResumeVariantArtifact id mismatch");
  }
  if (applicationPackage.provenance.coverLetterArtifactId !== input.coverLetterArtifact.id) {
    throw new TypeError("ApplicationPackage provenance CoverLetterArtifact id mismatch");
  }
  for (const key of ROLLUP_KEYS) {
    assertSameStringArray(applicationPackage.provenance[key], expected[key], key);
  }
}

export function assertApplicationPackageDoesNotContainGeneratedText(
  applicationPackage: ApplicationPackageV1,
): void {
  const values = [
    applicationPackage.blockedReason,
    ...applicationPackage.warnings,
    ...applicationPackage.items.flatMap((item) => [item.label, item.note]),
  ].filter((value): value is string => typeof value === "string");

  for (const value of values) {
    if (isForbiddenResumeOrCoverLetterText(value)) {
      throw new Error("ApplicationPackage contains generated resume or cover-letter text");
    }
  }
}

export function collectApplicationPackageSourceFactIds(
  applicationPackage: ApplicationPackageV1,
): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.sourceFactIds);
}

export function collectApplicationPackageAllowedClaimIds(
  applicationPackage: ApplicationPackageV1,
): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.allowedClaimIds);
}

export function collectApplicationPackageEvidenceMatchIds(
  applicationPackage: ApplicationPackageV1,
): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.evidenceMatchIds);
}

export function collectApplicationPackageDemandIds(applicationPackage: ApplicationPackageV1): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.demandIds);
}

export function collectApplicationPackageRiskFlagIds(
  applicationPackage: ApplicationPackageV1,
): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.riskFlagIds);
}

export function collectApplicationPackageReviewItemIds(
  applicationPackage: ApplicationPackageV1,
): readonly string[] {
  return sortUniqueStrings(applicationPackage.provenance.reviewItemIds);
}

function buildApplicationPackageArtifactRefs(
  input: BuildApplicationPackageInputV1,
): Promise<readonly ApplicationPackageArtifactRefV1[]> {
  return Promise.all([
    buildResumeVariantArtifactContentHash(input.resumeVariantArtifact),
    buildCoverLetterArtifactContentHash(input.coverLetterArtifact),
  ]).then(([resumeVariantArtifactContentHash, coverLetterArtifactContentHash]) => [
    {
      id: input.resumeVariantArtifact.id,
      kind: "resume_variant_artifact",
      contentHash: resumeVariantArtifactContentHash,
      status: input.resumeVariantArtifact.status,
      version: 1,
    },
    {
      id: input.coverLetterArtifact.id,
      kind: "cover_letter_artifact",
      contentHash: coverLetterArtifactContentHash,
      status: input.coverLetterArtifact.status,
      version: 1,
    },
  ]);
}

function buildApplicationPackageProvenance(
  input: BuildApplicationPackageInputV1,
): ApplicationPackageProvenanceV1 {
  return {
    applicationContextId: input.applicationContextId,
    resumeVariantArtifactId: input.resumeVariantArtifact.id,
    coverLetterArtifactId: input.coverLetterArtifact.id,
    sourceFactIds: unionProvenanceIds(input, "sourceFactIds"),
    allowedClaimIds: unionProvenanceIds(input, "allowedClaimIds"),
    evidenceMatchIds: unionProvenanceIds(input, "evidenceMatchIds"),
    demandIds: unionProvenanceIds(input, "demandIds"),
    riskFlagIds: unionProvenanceIds(input, "riskFlagIds"),
    reviewItemIds: unionProvenanceIds(input, "reviewItemIds"),
    version: 1,
  };
}

function buildStablePackageHashInput(input: BuildApplicationPackageInputV1): StableApplicationPackageHashInput {
  return {
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    resumeVariantArtifactId: input.resumeVariantArtifact.id,
    resumeVariantArtifactStatus: input.resumeVariantArtifact.status,
    coverLetterArtifactId: input.coverLetterArtifact.id,
    coverLetterArtifactStatus: input.coverLetterArtifact.status,
  };
}

function buildStablePackageForHash(
  applicationPackage: ApplicationPackageV1,
): StableApplicationPackageForHash {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...stablePackage } = applicationPackage;
  return stablePackage;
}

function mapResumeVariantArtifactItemStatus(
  status: ResumeVariantArtifactStatusV1,
): ApplicationPackageItemStatusV1 {
  if (status === "blocked") return "blocked";
  if (status === "draft" || status === "needs_review") return "needs_review";
  return "included";
}

function mapCoverLetterArtifactItemStatus(
  status: BuildApplicationPackageInputV1["coverLetterArtifact"]["status"],
): ApplicationPackageItemStatusV1 {
  if (status === "blocked") return "blocked";
  if (status === "draft" || status === "needs_review") return "needs_review";
  return "included";
}

function labelForApplicationPackageWarning(warning: string): string {
  if (warning === "resume_variant_artifact_blocked") return "Resume variant artifact is blocked.";
  if (warning === "resume_variant_artifact_needs_review") return "Resume variant artifact needs review.";
  if (warning === "resume_variant_artifact_draft") return "Resume variant artifact is draft.";
  if (warning === "cover_letter_artifact_blocked") return "Cover-letter artifact is blocked.";
  if (warning === "cover_letter_artifact_needs_review") return "Cover-letter artifact needs review.";
  if (warning === "cover_letter_artifact_draft") return "Cover-letter artifact is draft.";
  return "Application package notice.";
}

function noteForApplicationPackageWarning(warning: string): string {
  if (warning.endsWith("_blocked")) return "Resolve the upstream blocker before package review.";
  if (warning.endsWith("_needs_review")) return "Review the upstream artifact before package review.";
  if (warning.endsWith("_draft")) return "Complete the upstream artifact before package review.";
  return "Review package metadata before continuing.";
}

const ROLLUP_KEYS: readonly RollupKey[] = [
  "sourceFactIds",
  "allowedClaimIds",
  "evidenceMatchIds",
  "demandIds",
  "riskFlagIds",
  "reviewItemIds",
] as const;

function unionProvenanceIds(input: BuildApplicationPackageInputV1, key: RollupKey): readonly string[] {
  return sortUniqueStrings([
    ...input.resumeVariantArtifact.provenance[key],
    ...input.coverLetterArtifact.provenance[key],
  ]);
}

function hasAnyProvenance(provenance: ApplicationPackageProvenanceV1): boolean {
  return ROLLUP_KEYS.some((key) => provenance[key].length > 0);
}

function assertApplicationPackageArtifactProvenanceInput(input: BuildApplicationPackageInputV1): void {
  if (!isPlainRecord(input.resumeVariantArtifact.provenance)) {
    throw new TypeError("ApplicationPackage input requires ResumeVariantArtifact provenance");
  }
  if (!isPlainRecord(input.coverLetterArtifact.provenance)) {
    throw new TypeError("ApplicationPackage input requires CoverLetterArtifact provenance");
  }
  if (input.resumeVariantArtifact.provenance.applicationContextId !== input.applicationContextId) {
    throw new TypeError("ApplicationPackage input ResumeVariantArtifact provenance applicationContextId mismatch");
  }
  if (input.coverLetterArtifact.provenance.applicationContextId !== input.applicationContextId) {
    throw new TypeError("ApplicationPackage input CoverLetterArtifact provenance applicationContextId mismatch");
  }
  if (input.coverLetterArtifact.provenance.resumeVariantArtifactId !== input.resumeVariantArtifact.id) {
    throw new TypeError("ApplicationPackage input CoverLetterArtifact provenance ResumeVariantArtifact id mismatch");
  }
  for (const key of ROLLUP_KEYS) {
    if (!isStringArray(input.resumeVariantArtifact.provenance[key])) {
      throw new TypeError(`ApplicationPackage input ResumeVariantArtifact provenance requires ${key}`);
    }
    if (!isStringArray(input.coverLetterArtifact.provenance[key])) {
      throw new TypeError(`ApplicationPackage input CoverLetterArtifact provenance requires ${key}`);
    }
  }
}

async function buildApplicationPackageItemScope(input: BuildApplicationPackageInputV1): Promise<string> {
  return buildApplicationPackageHash(input);
}

function isForbiddenResumeOrCoverLetterText(value: string): boolean {
  const normalized = value.normalize("NFKC").toLowerCase();
  return (
    /\bi am excited to apply\b/u.test(normalized) ||
    /\bdear hiring manager\b/u.test(normalized) ||
    /\bworld-class\b/u.test(normalized) ||
    /\bproven track record\b/u.test(normalized) ||
    /\b(increased|reduced|improved|boosted|grew|scaled)\b[^.]{0,120}\b\d+\s*%/u.test(normalized)
  );
}

function sortUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
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
    throw new TypeError(`ApplicationPackage provenance ${label} mismatch`);
  }
}
