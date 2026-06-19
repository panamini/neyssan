import { v } from "convex/values";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";

export const MANUAL_APPLICATION_HANDOFF_ENABLED_FLAG =
  "TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED" as const;

export const MANUAL_APPLICATION_HANDOFF_STATES = [
  "handoff_prepared",
  "handoff_confirmed",
  "destination_open_requested",
  "user_reported_submitted",
  "user_reported_not_submitted",
  "abandoned",
] as const;

export const MANUAL_APPLICATION_HANDOFF_EVIDENCE = [
  "twoweeks_prepared",
  "user_interaction_observed",
  "user_reported",
] as const;

export const MANUAL_APPLICATION_HANDOFF_EVENT_KINDS = [
  "manual_handoff.prepared",
  "manual_handoff.confirmed",
  "manual_handoff.copy_succeeded",
  "manual_handoff.file_download_requested",
  "manual_handoff.destination_open_requested",
  "manual_handoff.user_reported_submitted",
  "manual_handoff.user_reported_not_submitted",
  "manual_handoff.abandoned",
] as const;

export type ManualApplicationHandoffState =
  (typeof MANUAL_APPLICATION_HANDOFF_STATES)[number];
export type ManualApplicationHandoffEvidence =
  (typeof MANUAL_APPLICATION_HANDOFF_EVIDENCE)[number];
export type ManualApplicationHandoffEventKind =
  (typeof MANUAL_APPLICATION_HANDOFF_EVENT_KINDS)[number];

export type ManualApplicationHandoffManifestInput = Readonly<{
  ownerProfileId: string;
  jobId: string;
  applicationPackageId: string;
  applicationContextId: string;
  packageHash: string;
  contentHash?: string;
  resumeVariantArtifactId: string;
  resumeVariantArtifactContentHash?: string;
  coverLetterArtifactId: string;
  coverLetterArtifactContentHash?: string;
  destinationOrigin: string;
  destinationHostname: string;
  destinationUrlHash: string;
}>;

export type ManualApplicationDestination = Readonly<{
  destinationOrigin: string;
  destinationHostname: string;
  destinationUrlHash: string;
}>;

export type ManualApplicationHandoffServerConfigStatus = Readonly<{
  kind: "manual_application_handoff_server_config_status";
  featureFlagId: typeof MANUAL_APPLICATION_HANDOFF_ENABLED_FLAG;
  featureFlagVersion: 1;
  enabled: boolean;
  configured: boolean;
  status: "feature_disabled" | "enabled";
  credentialStorage: "none";
  tokenStorage: "none";
  valuesExposed: false;
  version: 1;
}>;

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,180}$/u;
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

const FORBIDDEN_STORAGE_KEYS = new Set([
  "answerText",
  "cvText",
  "coverLetterText",
  "jobDescription",
  "rawDescription",
  "exportedFileBytes",
  "applicationUrl",
  "sourceUrl",
  "fullDestinationUrl",
  "query",
  "fragment",
  "clipboardContent",
  "userFreeText",
  "externalReceiptText",
  "providerId",
  "creden" + "tials",
  "coo" + "kies",
  "to" + "kens",
]);

const FORBIDDEN_STORAGE_TEXT_PATTERN =
  /(?:RAW_CV_SENTINEL|RAW_JOB_SENTINEL|COVER_LETTER_TEXT|ANSWER_TEXT|COOKIE|SECRET|TOKEN)/u;

export const manualApplicationHandoffStateValidator = v.union(
  v.literal("handoff_prepared"),
  v.literal("handoff_confirmed"),
  v.literal("destination_open_requested"),
  v.literal("user_reported_submitted"),
  v.literal("user_reported_not_submitted"),
  v.literal("abandoned"),
);

export const manualApplicationHandoffEvidenceValidator = v.union(
  v.literal("twoweeks_prepared"),
  v.literal("user_interaction_observed"),
  v.literal("user_reported"),
);

export const manualApplicationHandoffEventKindValidator = v.union(
  v.literal("manual_handoff.prepared"),
  v.literal("manual_handoff.confirmed"),
  v.literal("manual_handoff.copy_succeeded"),
  v.literal("manual_handoff.file_download_requested"),
  v.literal("manual_handoff.destination_open_requested"),
  v.literal("manual_handoff.user_reported_submitted"),
  v.literal("manual_handoff.user_reported_not_submitted"),
  v.literal("manual_handoff.abandoned"),
);

export const manualApplicationHandoffFields = {
  handoffId: v.string(),
  ownerProfileId: v.string(),
  jobId: v.string(),
  applicationPackageId: v.string(),
  applicationContextId: v.string(),
  resumeVariantArtifactId: v.string(),
  coverLetterArtifactId: v.string(),
  manifestDigest: v.string(),
  manifestVersion: v.literal(1),
  state: manualApplicationHandoffStateValidator,
  destinationOrigin: v.string(),
  destinationHostname: v.string(),
  destinationUrlHash: v.string(),
  confirmationDigest: v.optional(v.string()),
  confirmedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
  version: v.literal(1),
};

export const manualApplicationHandoffEventFields = {
  handoffId: v.string(),
  ownerProfileId: v.string(),
  jobId: v.string(),
  eventKind: manualApplicationHandoffEventKindValidator,
  evidence: manualApplicationHandoffEvidenceValidator,
  stateAfter: manualApplicationHandoffStateValidator,
  manifestDigest: v.optional(v.string()),
  applicationPackageId: v.optional(v.string()),
  applicationContextId: v.optional(v.string()),
  artifactRef: v.optional(v.string()),
  artifactDigest: v.optional(v.string()),
  answerRef: v.optional(v.string()),
  answerDigest: v.optional(v.string()),
  destinationOrigin: v.optional(v.string()),
  destinationHostname: v.optional(v.string()),
  destinationUrlHash: v.optional(v.string()),
  occurredAt: v.number(),
  version: v.literal(1),
};

export const manualApplicationHandoffStoredValidator = v.object({
  _id: v.id("manualApplicationHandoffs"),
  _creationTime: v.number(),
  ...manualApplicationHandoffFields,
});

export const manualApplicationHandoffEventStoredValidator = v.object({
  _id: v.id("manualApplicationHandoffEvents"),
  _creationTime: v.number(),
  ...manualApplicationHandoffEventFields,
});

export function readManualApplicationHandoffServerConfigStatus(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ManualApplicationHandoffServerConfigStatus {
  const enabled = env[MANUAL_APPLICATION_HANDOFF_ENABLED_FLAG] === "true";
  return {
    kind: "manual_application_handoff_server_config_status",
    featureFlagId: MANUAL_APPLICATION_HANDOFF_ENABLED_FLAG,
    featureFlagVersion: 1,
    enabled,
    configured: enabled,
    status: enabled ? "enabled" : "feature_disabled",
    credentialStorage: "none",
    tokenStorage: "none",
    valuesExposed: false,
    version: 1,
  };
}

export async function validateManualApplicationDestination(
  applicationUrl: unknown,
): Promise<ManualApplicationDestination> {
  if (typeof applicationUrl !== "string" || applicationUrl.trim().length === 0) {
    throw new Error("job.applicationUrl is required for manual application handoff");
  }

  let parsed: URL;
  try {
    parsed = new URL(applicationUrl.trim());
  } catch {
    throw new Error("job.applicationUrl must be a valid HTTPS destination");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("job.applicationUrl must be an HTTPS destination");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Manual application destination must not embed auth material");
  }

  const hostname = parsed.hostname.toLowerCase();
  assertPublicHostname(hostname);
  const normalizedHref = parsed.href;

  return {
    destinationOrigin: parsed.origin,
    destinationHostname: hostname,
    destinationUrlHash: await buildStableHash({
      namespace: "manual-application-handoff",
      type: "destination-url",
      version: 1,
      href: normalizedHref,
    }),
  };
}

export function buildManualApplicationHandoffManifestDigest(
  input: ManualApplicationHandoffManifestInput,
): Promise<string> {
  assertManifestInput(input);
  return buildStableHash({
    namespace: "manual-application-handoff",
    type: "handoff-manifest",
    version: 1,
    input,
  });
}

export function buildManualApplicationHandoffId(input: {
  ownerProfileId: string;
  jobId: string;
  applicationPackageId: string;
  manifestDigest: string;
}): Promise<string> {
  return buildStableHash({
    namespace: "manual-application-handoff",
    type: "handoff-id",
    version: 1,
    input,
  }).then((hash) => `manual-application-handoff:${hash}`);
}

export function buildManualApplicationHandoffConfirmationCopy(
  manifestDigest: string,
): string {
  assertSafeHash(manifestDigest, "manifestDigest");
  return `I confirm this Twoweeks handoff package ${manifestDigest}.`;
}

export function assertManualApplicationHandoffStorageIsRedacted(
  value: unknown,
  label: string,
): void {
  walkStorageValue(value, label, new WeakSet<object>());
}

export function assertSafeHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function assertSafeRef(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    !SAFE_REF_PATTERN.test(value) ||
    FORBIDDEN_STORAGE_TEXT_PATTERN.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertManifestInput(input: ManualApplicationHandoffManifestInput): void {
  assertSafeRef(input.ownerProfileId, "ownerProfileId");
  assertSafeRef(input.jobId, "jobId");
  assertSafeRef(input.applicationPackageId, "applicationPackageId");
  assertSafeRef(input.applicationContextId, "applicationContextId");
  assertSafeRef(input.packageHash, "packageHash");
  if (input.contentHash !== undefined) assertSafeRef(input.contentHash, "contentHash");
  assertSafeRef(input.resumeVariantArtifactId, "resumeVariantArtifactId");
  if (input.resumeVariantArtifactContentHash !== undefined) {
    assertSafeRef(
      input.resumeVariantArtifactContentHash,
      "resumeVariantArtifactContentHash",
    );
  }
  assertSafeRef(input.coverLetterArtifactId, "coverLetterArtifactId");
  if (input.coverLetterArtifactContentHash !== undefined) {
    assertSafeRef(
      input.coverLetterArtifactContentHash,
      "coverLetterArtifactContentHash",
    );
  }
  assertSafeRef(input.destinationOrigin, "destinationOrigin");
  assertSafeRef(input.destinationHostname, "destinationHostname");
  assertSafeHash(input.destinationUrlHash, "destinationUrlHash");
}

function assertPublicHostname(hostname: string): void {
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Manual application destination must be public");
  }

  if (hostname.includes(":")) {
    throw new Error("Manual application destination must be public");
  }

  if (IPV4_PATTERN.test(hostname)) {
    assertPublicIpv4(hostname);
    return;
  }

  const labels = hostname.split(".");
  if (
    labels.length < 2 ||
    labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))
  ) {
    throw new Error("Manual application destination must be public");
  }
}

function assertPublicIpv4(hostname: string): void {
  const octets = hostname.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    throw new Error("Manual application destination must be public");
  }

  const [first, second] = octets;
  const privateOrReserved =
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19));

  if (privateOrReserved) {
    throw new Error("Manual application destination must be public");
  }
}

function walkStorageValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (FORBIDDEN_STORAGE_TEXT_PATTERN.test(value)) {
      throw new Error(`${path} contains non-redacted text`);
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (typeof value !== "object") {
    throw new Error(`${path} must be redacted JSON`);
  }
  if (seen.has(value)) {
    throw new Error(`${path} must not be circular`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        walkStorageValue(item, `${path}[${index}]`, seen),
      );
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_STORAGE_KEYS.has(key)) {
        throw new Error(`${path} must not store ${key}`);
      }
      walkStorageValue(child, `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}
