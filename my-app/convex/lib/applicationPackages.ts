import { v } from "convex/values";

import { stableSerialize } from "../../src/modules/application-harness/fingerprints";
import { buildApplicationPackageContentHash } from "../../src/modules/application-package/buildApplicationPackage";
import { isApplicationPackageStatus } from "../../src/modules/application-package/packageRules";
import type {
  ApplicationPackageStatusV1,
  ApplicationPackageV1,
} from "../../src/modules/application-package/schema";

const APPLICATION_PACKAGE_ID_PREFIX = "application-package:";

const FORBIDDEN_TOP_LEVEL_STORAGE_FIELDS = [
  "text",
  "rawText",
  "raw_text",
  "content",
  "resumeText",
  "coverLetterText",
  "fullCvText",
  "fullJobText",
  "pdf",
  "docx",
  "exportOutput",
  "toolExecutionLogs",
  "approvalDecision",
  "rejectionDecision",
] as const;

type MutableApplicationPackageArtifactRefV1 = {
  id: string;
  kind: "resume_variant_artifact" | "cover_letter_artifact";
  contentHash?: string;
  status: string;
  version: 1;
};

type MutableApplicationPackageItemV1 = {
  id: string;
  kind:
    | "resume_variant"
    | "cover_letter"
    | "supporting_provenance"
    | "warning"
    | "blocker";
  artifactId?: string;
  artifactContentHash?: string;
  status: ApplicationPackageStatusV1 | "included" | "notice";
  label: string;
  note: string;
  sourceFactIds: string[];
  allowedClaimIds: string[];
  evidenceMatchIds: string[];
  demandIds: string[];
  riskFlagIds: string[];
  reviewItemIds: string[];
  version: 1;
};

type MutableApplicationPackageProvenanceV1 = {
  applicationContextId: string;
  resumeVariantArtifactId: string;
  coverLetterArtifactId: string;
  sourceFactIds: string[];
  allowedClaimIds: string[];
  evidenceMatchIds: string[];
  demandIds: string[];
  riskFlagIds: string[];
  reviewItemIds: string[];
  version: 1;
};

type MutableApplicationPackageV1 = {
  id: string;
  userId: string;
  applicationContextId: string;
  status: ApplicationPackageStatusV1;
  artifacts: MutableApplicationPackageArtifactRefV1[];
  items: MutableApplicationPackageItemV1[];
  warnings: string[];
  blockedReason?: string;
  provenance: MutableApplicationPackageProvenanceV1;
  createdAt: number;
  updatedAt: number;
  version: 1;
};

export type ApplicationPackageStorageRecordV1 = Readonly<{
  applicationPackageId: string;
  userId: string;
  applicationContextId: string;
  status: ApplicationPackageV1["status"];
  resumeVariantArtifactId: string;
  coverLetterArtifactId: string;
  resumeVariantArtifactStatus?: string;
  coverLetterArtifactStatus?: string;
  sourceFactIds: string[];
  allowedClaimIds: string[];
  evidenceMatchIds: string[];
  demandIds: string[];
  riskFlagIds: string[];
  reviewItemIds: string[];
  packageHash: string;
  contentHash?: string;
  package: MutableApplicationPackageV1;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export const applicationPackageStatusValidator = v.union(
  v.literal("draft"),
  v.literal("needs_review"),
  v.literal("blocked"),
  v.literal("ready_for_review"),
);

const applicationPackageArtifactKindValidator = v.union(
  v.literal("resume_variant_artifact"),
  v.literal("cover_letter_artifact"),
);

const applicationPackageItemKindValidator = v.union(
  v.literal("resume_variant"),
  v.literal("cover_letter"),
  v.literal("supporting_provenance"),
  v.literal("warning"),
  v.literal("blocker"),
);

const applicationPackageItemStatusValidator = v.union(
  applicationPackageStatusValidator,
  v.literal("included"),
  v.literal("notice"),
);

const applicationPackageArtifactRefValidator = v.object({
  id: v.string(),
  kind: applicationPackageArtifactKindValidator,
  contentHash: v.optional(v.string()),
  status: v.string(),
  version: v.literal(1),
});

const applicationPackageItemValidator = v.object({
  id: v.string(),
  kind: applicationPackageItemKindValidator,
  artifactId: v.optional(v.string()),
  artifactContentHash: v.optional(v.string()),
  status: applicationPackageItemStatusValidator,
  label: v.string(),
  note: v.string(),
  sourceFactIds: v.array(v.string()),
  allowedClaimIds: v.array(v.string()),
  evidenceMatchIds: v.array(v.string()),
  demandIds: v.array(v.string()),
  riskFlagIds: v.array(v.string()),
  reviewItemIds: v.array(v.string()),
  version: v.literal(1),
});

const applicationPackageProvenanceValidator = v.object({
  applicationContextId: v.string(),
  resumeVariantArtifactId: v.string(),
  coverLetterArtifactId: v.string(),
  sourceFactIds: v.array(v.string()),
  allowedClaimIds: v.array(v.string()),
  evidenceMatchIds: v.array(v.string()),
  demandIds: v.array(v.string()),
  riskFlagIds: v.array(v.string()),
  reviewItemIds: v.array(v.string()),
  version: v.literal(1),
});

export const applicationPackagePayloadValidator = v.object({
  id: v.string(),
  userId: v.string(),
  applicationContextId: v.string(),
  status: applicationPackageStatusValidator,
  artifacts: v.array(applicationPackageArtifactRefValidator),
  items: v.array(applicationPackageItemValidator),
  warnings: v.array(v.string()),
  blockedReason: v.optional(v.string()),
  provenance: applicationPackageProvenanceValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
});

export const applicationPackageFields = {
  applicationPackageId: v.string(),
  userId: v.string(),
  applicationContextId: v.string(),
  status: applicationPackageStatusValidator,
  resumeVariantArtifactId: v.string(),
  coverLetterArtifactId: v.string(),
  resumeVariantArtifactStatus: v.optional(v.string()),
  coverLetterArtifactStatus: v.optional(v.string()),
  sourceFactIds: v.array(v.string()),
  allowedClaimIds: v.array(v.string()),
  evidenceMatchIds: v.array(v.string()),
  demandIds: v.array(v.string()),
  riskFlagIds: v.array(v.string()),
  reviewItemIds: v.array(v.string()),
  packageHash: v.string(),
  contentHash: v.optional(v.string()),
  // ApplicationPackageV1 is intentionally preserved as a source-backed JSON payload.
  // Helpers below validate its storage shape before insert; no raw source/CV/job/export text
  // is projected into top-level storage fields.
  package: applicationPackagePayloadValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const applicationPackageStorageRecordValidator = v.object(applicationPackageFields);

export const applicationPackageStoredValidator = v.object({
  _id: v.id("applicationPackages"),
  _creationTime: v.number(),
  ...applicationPackageFields,
});

export function sanitizeApplicationPackageForStorage(
  input: ApplicationPackageV1,
): MutableApplicationPackageV1 {
  assertApplicationPackageShape(input);
  assertNoForbiddenTopLevelFields(input, "ApplicationPackage");

  const applicationPackage = cloneConvexCompatibleJson(
    input,
    "applicationPackage",
    new WeakSet<object>(),
  ) as MutableApplicationPackageV1;

  assertApplicationPackageShape(applicationPackage);
  assertNoForbiddenTopLevelFields(applicationPackage, "ApplicationPackage");

  return applicationPackage;
}

export function extractApplicationPackageIndexFields(
  input: ApplicationPackageV1,
): Omit<ApplicationPackageStorageRecordV1, "contentHash" | "package" | "version"> {
  const applicationPackage = sanitizeApplicationPackageForStorage(input);
  const resumeVariantArtifact = getPackageArtifact(
    applicationPackage,
    "resume_variant_artifact",
  );
  const coverLetterArtifact = getPackageArtifact(
    applicationPackage,
    "cover_letter_artifact",
  );
  const packageHash = getApplicationPackageHashFromId(applicationPackage.id);

  return {
    applicationPackageId: applicationPackage.id,
    userId: applicationPackage.userId,
    applicationContextId: applicationPackage.applicationContextId,
    status: applicationPackage.status,
    resumeVariantArtifactId: applicationPackage.provenance.resumeVariantArtifactId,
    coverLetterArtifactId: applicationPackage.provenance.coverLetterArtifactId,
    ...(resumeVariantArtifact.status
      ? { resumeVariantArtifactStatus: resumeVariantArtifact.status }
      : {}),
    ...(coverLetterArtifact.status
      ? { coverLetterArtifactStatus: coverLetterArtifact.status }
      : {}),
    sourceFactIds: [...applicationPackage.provenance.sourceFactIds],
    allowedClaimIds: [...applicationPackage.provenance.allowedClaimIds],
    evidenceMatchIds: [...applicationPackage.provenance.evidenceMatchIds],
    demandIds: [...applicationPackage.provenance.demandIds],
    riskFlagIds: [...applicationPackage.provenance.riskFlagIds],
    reviewItemIds: [...applicationPackage.provenance.reviewItemIds],
    packageHash,
    createdAt: applicationPackage.createdAt,
    updatedAt: applicationPackage.updatedAt,
  };
}

export function assertApplicationPackageStorageShape(
  input: ApplicationPackageStorageRecordV1,
): void {
  assertNoForbiddenTopLevelFields(input, "ApplicationPackage storage record");
  assertApplicationPackageShape(input.package);

  if (input.version !== 1) {
    throw new TypeError("ApplicationPackage storage record version must be 1");
  }
  if (input.applicationPackageId !== input.package.id) {
    throw new Error("ApplicationPackage storage applicationPackageId must match package.id");
  }
  if (input.userId !== input.package.userId) {
    throw new Error("ApplicationPackage storage userId must match package.userId");
  }
  if (input.applicationContextId !== input.package.applicationContextId) {
    throw new Error(
      "ApplicationPackage storage applicationContextId must match package.applicationContextId",
    );
  }
  if (input.status !== input.package.status) {
    throw new Error("ApplicationPackage storage status must match package.status");
  }
  if (input.resumeVariantArtifactId !== input.package.provenance.resumeVariantArtifactId) {
    throw new Error(
      "ApplicationPackage storage resumeVariantArtifactId must match package provenance",
    );
  }
  if (input.coverLetterArtifactId !== input.package.provenance.coverLetterArtifactId) {
    throw new Error(
      "ApplicationPackage storage coverLetterArtifactId must match package provenance",
    );
  }
  if (input.packageHash !== getApplicationPackageHashFromId(input.package.id)) {
    throw new Error("ApplicationPackage storage packageHash must match package id suffix");
  }

  assertSameStringArray(input.sourceFactIds, input.package.provenance.sourceFactIds, "sourceFactIds");
  assertSameStringArray(
    input.allowedClaimIds,
    input.package.provenance.allowedClaimIds,
    "allowedClaimIds",
  );
  assertSameStringArray(
    input.evidenceMatchIds,
    input.package.provenance.evidenceMatchIds,
    "evidenceMatchIds",
  );
  assertSameStringArray(input.demandIds, input.package.provenance.demandIds, "demandIds");
  assertSameStringArray(input.riskFlagIds, input.package.provenance.riskFlagIds, "riskFlagIds");
  assertSameStringArray(input.reviewItemIds, input.package.provenance.reviewItemIds, "reviewItemIds");
}

export async function buildApplicationPackageStorageRecord(
  input: ApplicationPackageV1,
): Promise<ApplicationPackageStorageRecordV1> {
  const applicationPackage = sanitizeApplicationPackageForStorage(input);
  const indexFields = extractApplicationPackageIndexFields(applicationPackage);
  const contentHash = await buildApplicationPackageContentHash(applicationPackage);
  const record: ApplicationPackageStorageRecordV1 = {
    ...indexFields,
    contentHash,
    package: applicationPackage,
    version: 1,
  };

  assertApplicationPackageStorageShape(record);

  return record;
}

export function assertSameApplicationPackagePayload(
  existing: Pick<ApplicationPackageStorageRecordV1, "package" | "packageHash" | "contentHash">,
  next: Pick<ApplicationPackageStorageRecordV1, "package" | "packageHash" | "contentHash">,
): void {
  if (existing.packageHash !== next.packageHash) {
    throw new Error("ApplicationPackage stable id collision with conflicting packageHash");
  }
  if (existing.contentHash !== next.contentHash) {
    throw new Error("ApplicationPackage stable id collision with conflicting contentHash");
  }
  if (stableSerialize(existing.package) !== stableSerialize(next.package)) {
    throw new Error("ApplicationPackage stable id collision with conflicting package payload");
  }
}

export function getApplicationPackageHashFromId(applicationPackageId: string): string {
  if (
    typeof applicationPackageId !== "string" ||
    !applicationPackageId.startsWith(APPLICATION_PACKAGE_ID_PREFIX)
  ) {
    throw new Error("ApplicationPackage id must use application-package:<hash>");
  }

  const packageHash = applicationPackageId.slice(APPLICATION_PACKAGE_ID_PREFIX.length);
  if (!packageHash) {
    throw new Error("ApplicationPackage id must include a non-empty hash suffix");
  }

  return packageHash;
}

function assertApplicationPackageShape(input: ApplicationPackageV1): void {
  if (!isPlainRecord(input)) {
    throw new TypeError("ApplicationPackage must be a plain object");
  }
  if (!isNonEmptyString(input.id)) {
    throw new TypeError("ApplicationPackage requires id");
  }
  getApplicationPackageHashFromId(input.id);
  if (!isNonEmptyString(input.userId)) {
    throw new TypeError("ApplicationPackage requires userId");
  }
  if (!isNonEmptyString(input.applicationContextId)) {
    throw new TypeError("ApplicationPackage requires applicationContextId");
  }
  if (!isApplicationPackageStatus(input.status)) {
    throw new TypeError("ApplicationPackage requires a known status");
  }
  if (!Array.isArray(input.artifacts) || input.artifacts.length < 2) {
    throw new TypeError("ApplicationPackage requires artifact references");
  }
  if (!Array.isArray(input.items)) {
    throw new TypeError("ApplicationPackage requires items");
  }
  if (!Array.isArray(input.warnings)) {
    throw new TypeError("ApplicationPackage requires warnings");
  }
  if (input.blockedReason !== undefined && typeof input.blockedReason !== "string") {
    throw new TypeError("ApplicationPackage blockedReason must be a string when present");
  }
  assertFiniteTimestamp(input.createdAt, "ApplicationPackage createdAt");
  assertFiniteTimestamp(input.updatedAt, "ApplicationPackage updatedAt");
  if (input.version !== 1) {
    throw new TypeError("ApplicationPackage version must be 1");
  }

  assertPackageProvenance(input);
  assertPackageArtifacts(input);
}

function assertPackageProvenance(input: ApplicationPackageV1): void {
  const provenance = input.provenance;
  if (!isPlainRecord(provenance)) {
    throw new TypeError("ApplicationPackage requires provenance");
  }
  if (provenance.applicationContextId !== input.applicationContextId) {
    throw new Error("ApplicationPackage provenance applicationContextId mismatch");
  }
  if (!isNonEmptyString(provenance.resumeVariantArtifactId)) {
    throw new TypeError("ApplicationPackage provenance requires resumeVariantArtifactId");
  }
  if (!isNonEmptyString(provenance.coverLetterArtifactId)) {
    throw new TypeError("ApplicationPackage provenance requires coverLetterArtifactId");
  }
  assertStringArray(provenance.sourceFactIds, "sourceFactIds");
  assertStringArray(provenance.allowedClaimIds, "allowedClaimIds");
  assertStringArray(provenance.evidenceMatchIds, "evidenceMatchIds");
  assertStringArray(provenance.demandIds, "demandIds");
  assertStringArray(provenance.riskFlagIds, "riskFlagIds");
  assertStringArray(provenance.reviewItemIds, "reviewItemIds");
  if (provenance.version !== 1) {
    throw new TypeError("ApplicationPackage provenance version must be 1");
  }
}

function assertPackageArtifacts(input: ApplicationPackageV1): void {
  const resumeVariantArtifact = getPackageArtifact(input, "resume_variant_artifact");
  const coverLetterArtifact = getPackageArtifact(input, "cover_letter_artifact");

  if (resumeVariantArtifact.id !== input.provenance.resumeVariantArtifactId) {
    throw new Error("ApplicationPackage resume artifact must match provenance");
  }
  if (coverLetterArtifact.id !== input.provenance.coverLetterArtifactId) {
    throw new Error("ApplicationPackage cover-letter artifact must match provenance");
  }
}

function getPackageArtifact(
  input: ApplicationPackageV1,
  kind: "resume_variant_artifact" | "cover_letter_artifact",
): ApplicationPackageV1["artifacts"][number] {
  const artifact = input.artifacts.find((candidate) => candidate.kind === kind);
  if (!artifact) {
    throw new TypeError(`ApplicationPackage requires ${kind}`);
  }
  if (!isNonEmptyString(artifact.id)) {
    throw new TypeError(`ApplicationPackage ${kind} requires id`);
  }
  if (artifact.kind !== kind) {
    throw new TypeError(`ApplicationPackage ${kind} kind mismatch`);
  }
  if (artifact.contentHash !== undefined && typeof artifact.contentHash !== "string") {
    throw new TypeError(`ApplicationPackage ${kind} contentHash must be a string when present`);
  }
  if (!isNonEmptyString(artifact.status)) {
    throw new TypeError(`ApplicationPackage ${kind} requires status`);
  }
  if (artifact.version !== 1) {
    throw new TypeError(`ApplicationPackage ${kind} version must be 1`);
  }
  return artifact;
}

function assertNoForbiddenTopLevelFields(value: object, label: string): void {
  for (const field of FORBIDDEN_TOP_LEVEL_STORAGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${label} must not store forbidden top-level field ${field}`);
    }
  }
}

function assertStringArray(value: unknown, label: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`ApplicationPackage provenance requires string[] ${label}`);
  }
}

function assertSameStringArray(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`ApplicationPackage storage ${label} must mirror package provenance`);
  }
}

function assertFiniteTimestamp(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function cloneConvexCompatibleJson(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must be a finite number`);
    }
    return value;
  }
  if (typeof value === "bigint") {
    throw new TypeError(`${path} must not contain bigint values`);
  }
  if (typeof value === "symbol") {
    throw new TypeError(`${path} must not contain symbols`);
  }
  if (typeof value === "function") {
    throw new TypeError(`${path} must not contain functions`);
  }
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} must be Convex-compatible JSON`);
  }
  if (value instanceof Date) {
    throw new TypeError(`${path} must not contain Date instances`);
  }
  if (value instanceof Map) {
    throw new TypeError(`${path} must not contain Map instances`);
  }
  if (value instanceof Set) {
    throw new TypeError(`${path} must not contain Set instances`);
  }
  if (value instanceof RegExp) {
    throw new TypeError(`${path} must not contain RegExp instances`);
  }
  if (typeof (value as { then?: unknown }).then === "function") {
    throw new TypeError(`${path} must not contain Promise instances`);
  }
  if (!Array.isArray(value) && !isPlainRecord(value)) {
    throw new TypeError(`${path} must contain only arrays and plain objects`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol keys`);
  }
  if (seen.has(value)) {
    throw new TypeError(`${path} must not contain circular references`);
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError(`${path} must not contain sparse arrays`);
        }
        if (item === undefined) {
          throw new TypeError(`${path}[${index}] must not contain undefined`);
        }
        return cloneConvexCompatibleJson(item, `${path}[${index}]`, seen);
      });
    }

    const record = value;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, cloneConvexCompatibleJson(record[key], `${path}.${key}`, seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
