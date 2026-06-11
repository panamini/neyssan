import { buildStableHash } from "../application-harness/fingerprints";
import {
  assertControlledAtsAdapterRegistry,
  assertControlledAtsDoesNotUseForbiddenVendor,
  assertControlledAtsJobLead,
  assertControlledAtsPayloadEnvelope,
  canonicalizeControlledAtsUrl,
  compareControlledAtsText,
} from "./scoutRules";
import type {
  BuildControlledAtsJobLeadInputV1,
  ControlledAtsAdapterRegistryV1,
  ControlledAtsAdapterV1,
  ControlledAtsJobLeadV1,
  ControlledAtsNormalizationResultV1,
  ControlledAtsPayloadEnvelopeV1,
  ControlledAtsRejectedRecordV1,
  ControlledAtsScoutContentV1,
  ControlledAtsSourceKindV1,
  ControlledAtsVendorV1,
  ControlledAtsWorkplaceTypeV1,
} from "./schema";

const HASH_NAMESPACE = "controlled-ats-scout";
const JOB_LEAD_ID_PREFIX = "controlled-ats-job-lead:";

const SUPPORTED_SOURCE_KINDS: readonly ControlledAtsSourceKindV1[] = [
  "manual_fixture",
  "public_job_board_payload",
  "public_job_detail_payload",
] as const;

const CONTROLLED_ATS_ADAPTERS: readonly ControlledAtsAdapterV1[] = [
  {
    vendor: "ashby",
    title: "Ashby payload normalizer",
    description: "Normalizes caller-supplied Ashby job payload fixtures into deterministic lead records.",
    supportedSourceKinds: SUPPORTED_SOURCE_KINDS,
    version: 1,
  },
  {
    vendor: "greenhouse",
    title: "Greenhouse payload normalizer",
    description: "Normalizes caller-supplied Greenhouse job payload fixtures into deterministic lead records.",
    supportedSourceKinds: SUPPORTED_SOURCE_KINDS,
    version: 1,
  },
  {
    vendor: "lever",
    title: "Lever payload normalizer",
    description: "Normalizes caller-supplied Lever job payload fixtures into deterministic lead records.",
    supportedSourceKinds: SUPPORTED_SOURCE_KINDS,
    version: 1,
  },
  {
    vendor: "recruitee",
    title: "Recruitee payload normalizer",
    description: "Normalizes caller-supplied Recruitee job payload fixtures into deterministic lead records.",
    supportedSourceKinds: SUPPORTED_SOURCE_KINDS,
    version: 1,
  },
  {
    vendor: "smartrecruiters",
    title: "SmartRecruiters payload normalizer",
    description: "Normalizes caller-supplied SmartRecruiters job payload fixtures into deterministic lead records.",
    supportedSourceKinds: SUPPORTED_SOURCE_KINDS,
    version: 1,
  },
] as const;

type RawRecordResult = Readonly<{
  records?: readonly unknown[];
  rejected?: ControlledAtsRejectedRecordV1;
}>;

type PreparedUrlResult = Readonly<{
  value?: string;
  rejected?: ControlledAtsRejectedRecordV1;
}>;

type NormalizedRecordResult =
  | Readonly<{ kind: "lead"; input: BuildControlledAtsJobLeadInputV1 }>
  | Readonly<{ kind: "rejected"; rejected: ControlledAtsRejectedRecordV1 }>;

export function buildControlledAtsAdapterRegistry(): ControlledAtsAdapterRegistryV1 {
  const adapters = CONTROLLED_ATS_ADAPTERS.map(cloneAdapter).sort((left, right) =>
    compareControlledAtsText(left.vendor, right.vendor),
  );
  const registry: ControlledAtsAdapterRegistryV1 = {
    adapters,
    vendors: adapters.map((adapter) => adapter.vendor),
    version: 1,
  };

  assertControlledAtsAdapterRegistry(registry);
  return registry;
}

export function buildControlledAtsAdapterRegistryHash(
  registry: ControlledAtsAdapterRegistryV1,
): Promise<string> {
  assertControlledAtsAdapterRegistry(registry);
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "adapter-registry",
    version: 1,
    registry,
  });
}

export function buildControlledAtsScoutContent(
  registry: ControlledAtsAdapterRegistryV1,
): ControlledAtsScoutContentV1 {
  assertControlledAtsAdapterRegistry(registry);
  return {
    kind: "controlled_ats_scout_adapters",
    registry: cloneRegistry(registry),
    version: 1,
  };
}

export async function normalizeControlledAtsPayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertControlledAtsPayloadEnvelope(envelope);

  if (envelope.vendor === "greenhouse") return normalizeGreenhousePayload(envelope);
  if (envelope.vendor === "lever") return normalizeLeverPayload(envelope);
  if (envelope.vendor === "recruitee") return normalizeRecruiteePayload(envelope);
  if (envelope.vendor === "smartrecruiters") return normalizeSmartRecruitersPayload(envelope);
  return normalizeAshbyPayload(envelope);
}

export async function normalizeGreenhousePayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertVendorEnvelope(envelope, "greenhouse");
  const recordsResult = greenhouseRecords(envelope.payload);
  if (recordsResult.rejected) return emptyResult(envelope, [recordsResult.rejected]);

  return normalizeRecords(envelope, recordsResult.records ?? [], normalizeGreenhouseRecord);
}

export async function normalizeLeverPayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertVendorEnvelope(envelope, "lever");
  const recordsResult = leverRecords(envelope.payload);
  if (recordsResult.rejected) return emptyResult(envelope, [recordsResult.rejected]);

  return normalizeRecords(envelope, recordsResult.records ?? [], normalizeLeverRecord);
}

export async function normalizeAshbyPayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertVendorEnvelope(envelope, "ashby");
  const recordsResult = ashbyRecords(envelope.payload);
  if (recordsResult.rejected) return emptyResult(envelope, [recordsResult.rejected]);

  return normalizeRecords(envelope, recordsResult.records ?? [], normalizeAshbyRecord);
}

export async function normalizeSmartRecruitersPayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertVendorEnvelope(envelope, "smartrecruiters");
  const recordsResult = smartRecruitersRecords(envelope.payload);
  if (recordsResult.rejected) return emptyResult(envelope, [recordsResult.rejected]);

  return normalizeRecords(envelope, recordsResult.records ?? [], normalizeSmartRecruitersRecord);
}

export async function normalizeRecruiteePayload(
  envelope: ControlledAtsPayloadEnvelopeV1,
): Promise<ControlledAtsNormalizationResultV1> {
  assertVendorEnvelope(envelope, "recruitee");
  const recordsResult = recruiteeRecords(envelope.payload);
  if (recordsResult.rejected) return emptyResult(envelope, [recordsResult.rejected]);

  return normalizeRecords(envelope, recordsResult.records ?? [], normalizeRecruiteeRecord);
}

export function buildControlledAtsRawPayloadHash(payload: unknown): Promise<string> {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "raw-payload",
    version: 1,
    payload,
  });
}

export async function buildControlledAtsJobLeadHash(
  input: BuildControlledAtsJobLeadInputV1 | ControlledAtsJobLeadV1,
): Promise<string> {
  const descriptionHash = input.descriptionHash ?? (
    input.descriptionText !== undefined
      ? await buildControlledAtsDescriptionHash(input.descriptionText)
      : undefined
  );

  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "job-lead",
    version: 1,
    input: {
      vendor: input.vendor,
      sourceKind: input.sourceKind,
      canonicalUrl: input.canonicalUrl,
      externalJobId: input.externalJobId,
      companyName: input.companyName,
      title: input.title,
      department: input.department,
      team: input.team,
      location: input.location,
      workplaceType: input.workplaceType,
      status: input.status,
      descriptionHash,
      applyUrl: input.applyUrl,
      postedAt: input.postedAt,
      compensation: cloneCompensation(input.compensation),
      rawPayloadHash: input.rawPayloadHash,
    },
  });
}

export async function buildControlledAtsJobLead(
  input: BuildControlledAtsJobLeadInputV1,
): Promise<ControlledAtsJobLeadV1> {
  const descriptionHash = input.descriptionText !== undefined
    ? await buildControlledAtsDescriptionHash(input.descriptionText)
    : undefined;
  const leadHash = await buildControlledAtsJobLeadHash({ ...input, descriptionHash });
  const lead: ControlledAtsJobLeadV1 = {
    id: `${JOB_LEAD_ID_PREFIX}${leadHash}`,
    vendor: input.vendor,
    sourceKind: input.sourceKind,
    sourceUrl: cleanOptionalString(input.sourceUrl),
    canonicalUrl: cleanOptionalString(input.canonicalUrl),
    externalJobId: cleanOptionalString(input.externalJobId),
    companyName: cleanOptionalString(input.companyName),
    title: input.title.trim(),
    department: cleanOptionalString(input.department),
    team: cleanOptionalString(input.team),
    location: cleanOptionalString(input.location),
    workplaceType: input.workplaceType,
    status: input.status,
    descriptionText: input.descriptionText,
    descriptionHash,
    applyUrl: cleanOptionalString(input.applyUrl),
    postedAt: cleanOptionalString(input.postedAt),
    compensation: cloneCompensation(input.compensation),
    rawPayloadHash: input.rawPayloadHash,
    leadHash,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: 1,
  };

  assertControlledAtsJobLead(lead);
  return lead;
}

export function dedupeControlledAtsJobLeads(
  leads: readonly ControlledAtsJobLeadV1[],
): readonly ControlledAtsJobLeadV1[] {
  const sorted = leads.map(cloneLead).sort(compareLeads);
  const seen = new Set<string>();
  const deduped: ControlledAtsJobLeadV1[] = [];

  for (const lead of sorted) {
    assertControlledAtsJobLead(lead);
    const key = dedupeKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(lead);
  }

  return deduped;
}

async function normalizeRecords(
  envelope: ControlledAtsPayloadEnvelopeV1,
  records: readonly unknown[],
  normalizeRecord: (
    envelope: ControlledAtsPayloadEnvelopeV1,
    record: Record<string, unknown>,
    rawPayloadHash: string,
  ) => Promise<NormalizedRecordResult>,
): Promise<ControlledAtsNormalizationResultV1> {
  const leads: ControlledAtsJobLeadV1[] = [];
  const rejected: ControlledAtsRejectedRecordV1[] = [];

  for (const record of records) {
    const rawPayloadHash = await buildControlledAtsRawPayloadHash(record);
    if (!isPlainRecord(record)) {
      rejected.push(rejectedRecord("unsupported_record_shape", envelope, rawPayloadHash));
      continue;
    }

    const normalized = await normalizeRecord(envelope, record, rawPayloadHash);
    if (normalized.kind === "rejected") {
      rejected.push(normalized.rejected);
      continue;
    }
    leads.push(await buildControlledAtsJobLead(normalized.input));
  }

  return {
    vendor: envelope.vendor,
    sourceKind: envelope.sourceKind,
    leads: dedupeControlledAtsJobLeads(leads),
    rejected: rejected.sort(compareRejectedRecords),
    warnings: [],
    version: 1,
  };
}

async function normalizeGreenhouseRecord(
  envelope: ControlledAtsPayloadEnvelopeV1,
  record: Record<string, unknown>,
  rawPayloadHash: string,
): Promise<NormalizedRecordResult> {
  const title = stringField(record.title);
  if (!title) return rejectedResult("missing_title", envelope, rawPayloadHash);

  const url = prepareCanonicalUrl(envelope, stringField(record.absolute_url));
  if (url.rejected) return { kind: "rejected", rejected: url.rejected };

  return {
    kind: "lead",
    input: {
      vendor: "greenhouse",
      sourceKind: envelope.sourceKind,
      sourceUrl: envelope.sourceUrl,
      canonicalUrl: url.value,
      externalJobId: idField(record.id),
      title,
      department: firstDepartmentName(record.departments),
      location: locationName(record.location),
      workplaceType: inferWorkplaceType([locationName(record.location)]),
      status: "unknown",
      descriptionText: optionalRawString(record.content),
      rawPayloadHash,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    },
  };
}

async function normalizeLeverRecord(
  envelope: ControlledAtsPayloadEnvelopeV1,
  record: Record<string, unknown>,
  rawPayloadHash: string,
): Promise<NormalizedRecordResult> {
  const title = stringField(record.text);
  if (!title) return rejectedResult("missing_title", envelope, rawPayloadHash);

  const url = prepareCanonicalUrl(envelope, stringField(record.hostedUrl));
  if (url.rejected) return { kind: "rejected", rejected: url.rejected };

  const preparedApplyUrl = prepareOptionalUrl(envelope.vendor, stringField(record.applyUrl), envelope, rawPayloadHash);
  if (preparedApplyUrl.rejected) return { kind: "rejected", rejected: preparedApplyUrl.rejected };

  const categories = isPlainRecord(record.categories) ? record.categories : {};
  const location = stringField(categories.location);
  const team = stringField(categories.team);
  const department = stringField(categories.department);

  return {
    kind: "lead",
    input: {
      vendor: "lever",
      sourceKind: envelope.sourceKind,
      sourceUrl: envelope.sourceUrl,
      canonicalUrl: url.value,
      externalJobId: idField(record.id),
      title,
      department,
      team,
      location,
      workplaceType: inferWorkplaceType([location, team, department, stringField(categories.commitment)]),
      status: "unknown",
      descriptionText: optionalRawString(record.descriptionPlain),
      applyUrl: preparedApplyUrl.value,
      postedAt: timestampToIso(record.createdAt),
      rawPayloadHash,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    },
  };
}

async function normalizeAshbyRecord(
  envelope: ControlledAtsPayloadEnvelopeV1,
  record: Record<string, unknown>,
  rawPayloadHash: string,
): Promise<NormalizedRecordResult> {
  const title = stringField(record.title);
  if (!title) return rejectedResult("missing_title", envelope, rawPayloadHash);

  const url = prepareCanonicalUrl(envelope, stringField(record.jobUrl));
  if (url.rejected) return { kind: "rejected", rejected: url.rejected };

  const preparedApplyUrl = prepareOptionalUrl(envelope.vendor, stringField(record.applyUrl), envelope, rawPayloadHash);
  if (preparedApplyUrl.rejected) return { kind: "rejected", rejected: preparedApplyUrl.rejected };

  const location = stringField(record.location);
  const department = stringField(record.department);
  const team = stringField(record.team);

  return {
    kind: "lead",
    input: {
      vendor: "ashby",
      sourceKind: envelope.sourceKind,
      sourceUrl: envelope.sourceUrl,
      canonicalUrl: url.value,
      externalJobId: idField(record.id),
      title,
      department,
      team,
      location,
      workplaceType: inferWorkplaceType([location, department, team, stringField(record.employmentType)]),
      status: "unknown",
      descriptionText: optionalRawString(record.descriptionPlain),
      applyUrl: preparedApplyUrl.value,
      postedAt: stringField(record.publishedAt),
      rawPayloadHash,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    },
  };
}

async function normalizeSmartRecruitersRecord(
  envelope: ControlledAtsPayloadEnvelopeV1,
  record: Record<string, unknown>,
  rawPayloadHash: string,
): Promise<NormalizedRecordResult> {
  const title = stringField(record.name);
  if (!title) return rejectedResult("missing_title", envelope, rawPayloadHash);

  const canonicalCandidate = firstString([stringField(record.applyUrl)]);
  const url = prepareCanonicalUrl(envelope, canonicalCandidate);
  if (url.rejected) return { kind: "rejected", rejected: url.rejected };

  const company = isPlainRecord(record.company) ? record.company : {};
  const location = isPlainRecord(record.location) ? record.location : {};
  const department = isPlainRecord(record.department) ? record.department : {};
  const team = isPlainRecord(record.function) ? record.function : {};
  const employment = isPlainRecord(record.typeOfEmployment) ? record.typeOfEmployment : {};
  const locationText = joinNonEmpty([
    stringField(location.city),
    stringField(location.region),
    stringField(location.country),
  ], ", ");

  return {
    kind: "lead",
    input: {
      vendor: "smartrecruiters",
      sourceKind: envelope.sourceKind,
      sourceUrl: envelope.sourceUrl,
      canonicalUrl: url.value,
      externalJobId: firstString([idField(record.id), idField(record.uuid)]),
      companyName: stringField(company.name),
      title,
      department: stringField(department.label),
      team: stringField(team.label),
      location: locationText,
      workplaceType: location.remote === true ? "remote" : inferWorkplaceType([locationText, stringField(employment.label)]),
      status: smartRecruitersStatus(record.active),
      descriptionText: smartRecruitersDescription(record.jobAd),
      postedAt: stringField(record.releasedDate),
      rawPayloadHash,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    },
  };
}

async function normalizeRecruiteeRecord(
  envelope: ControlledAtsPayloadEnvelopeV1,
  record: Record<string, unknown>,
  rawPayloadHash: string,
): Promise<NormalizedRecordResult> {
  const title = firstString([stringField(record.title), stringField(record.name)]);
  if (!title) return rejectedResult("missing_title", envelope, rawPayloadHash);

  const canonicalCandidate = firstString([
    stringField(record.careers_url),
    stringField(record.careersUrl),
    stringField(record.url),
    stringField(record.offer_url),
    stringField(record.offerUrl),
  ]);
  const canonicalUrl = prepareCanonicalUrl(envelope, canonicalCandidate);
  if (canonicalUrl.rejected) return { kind: "rejected", rejected: canonicalUrl.rejected };

  const applyCandidate = firstString([
    stringField(record.apply_url),
    stringField(record.applyUrl),
    stringField(record.careers_url),
    stringField(record.careersUrl),
  ]);
  const applyUrl = prepareOptionalUrl(envelope.vendor, applyCandidate, envelope, rawPayloadHash);
  if (applyUrl.rejected) return { kind: "rejected", rejected: applyUrl.rejected };

  const location = recruiteeLocation(record);

  return {
    kind: "lead",
    input: {
      vendor: "recruitee",
      sourceKind: envelope.sourceKind,
      sourceUrl: envelope.sourceUrl,
      canonicalUrl: canonicalUrl.value,
      externalJobId: firstString([idField(record.id), idField(record.guid), idField(record.slug)]),
      title,
      department: recruiteeDepartment(record.department),
      location,
      workplaceType: inferWorkplaceType([location]),
      status: recruiteeStatus(record.status),
      descriptionText: firstRawString([record.description, record.description_text, record.descriptionText]),
      applyUrl: applyUrl.value,
      postedAt: firstString([
        stringField(record.created_at),
        stringField(record.createdAt),
        stringField(record.published_at),
        stringField(record.publishedAt),
      ]),
      rawPayloadHash,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    },
  };
}

function greenhouseRecords(payload: unknown): RawRecordResult {
  if (!isPlainRecord(payload)) return { rejected: rejectedPayloadShape(payload) };
  if (Array.isArray(payload.jobs)) return { records: payload.jobs };
  if ("title" in payload || "id" in payload || "absolute_url" in payload) return { records: [payload] };
  return { rejected: rejectedPayloadShape(payload) };
}

function leverRecords(payload: unknown): RawRecordResult {
  if (!isPlainRecord(payload)) return { rejected: rejectedPayloadShape(payload) };
  if (Array.isArray(payload.postings)) return { records: payload.postings };
  if ("text" in payload || "id" in payload || "hostedUrl" in payload) return { records: [payload] };
  return { rejected: rejectedPayloadShape(payload) };
}

function ashbyRecords(payload: unknown): RawRecordResult {
  if (!isPlainRecord(payload)) return { rejected: rejectedPayloadShape(payload) };
  if (Array.isArray(payload.jobs)) return { records: payload.jobs };
  if ("title" in payload || "id" in payload || "jobUrl" in payload) return { records: [payload] };
  return { rejected: rejectedPayloadShape(payload) };
}

function smartRecruitersRecords(payload: unknown): RawRecordResult {
  if (!isPlainRecord(payload)) return { rejected: rejectedPayloadShape(payload) };
  if (Array.isArray(payload.content)) return { records: payload.content };
  if ("name" in payload || "id" in payload || "uuid" in payload || "jobAd" in payload) return { records: [payload] };
  return { rejected: rejectedPayloadShape(payload) };
}

function recruiteeRecords(payload: unknown): RawRecordResult {
  if (Array.isArray(payload)) return { records: payload };
  if (!isPlainRecord(payload)) return { rejected: rejectedPayloadShape(payload) };
  if (Array.isArray(payload.offers)) return { records: payload.offers };
  if ("title" in payload || "name" in payload || "id" in payload || "slug" in payload) return { records: [payload] };
  return { rejected: rejectedPayloadShape(payload) };
}

function prepareCanonicalUrl(
  envelope: ControlledAtsPayloadEnvelopeV1,
  recordUrl?: string,
): PreparedUrlResult {
  return prepareOptionalUrl(envelope.vendor, recordUrl, envelope);
}

function prepareOptionalUrl(
  vendor: ControlledAtsVendorV1,
  url: string | undefined,
  envelope: ControlledAtsPayloadEnvelopeV1,
  rawPayloadHash?: string,
): PreparedUrlResult {
  if (!url) return {};
  try {
    return { value: canonicalizeControlledAtsUrl(vendor, url) };
  } catch (error) {
    const reason = error instanceof TypeError && /forbidden/u.test(error.message)
      ? "forbidden_vendor_url"
      : "unsupported_url_vendor";
    return { rejected: rejectedRecord(reason, envelope, rawPayloadHash) };
  }
}

function assertVendorEnvelope(envelope: ControlledAtsPayloadEnvelopeV1, vendor: ControlledAtsVendorV1): void {
  assertControlledAtsPayloadEnvelope(envelope);
  assertControlledAtsDoesNotUseForbiddenVendor(envelope.vendor);
  if (envelope.vendor !== vendor) throw new TypeError(`Controlled ATS normalizer requires ${vendor} vendor`);
}

function emptyResult(
  envelope: ControlledAtsPayloadEnvelopeV1,
  rejected: readonly ControlledAtsRejectedRecordV1[],
): ControlledAtsNormalizationResultV1 {
  return {
    vendor: envelope.vendor,
    sourceKind: envelope.sourceKind,
    leads: [],
    rejected: [...rejected].sort(compareRejectedRecords),
    warnings: [],
    version: 1,
  };
}

function rejectedPayloadShape(payload: unknown): ControlledAtsRejectedRecordV1 {
  return {
    reason: "unsupported_payload_shape",
    rawPayloadHash: undefined,
    vendor: isPlainRecord(payload) && typeof payload.vendor === "string" ? payload.vendor : undefined,
    version: 1,
  };
}

function rejectedRecord(
  reason: string,
  envelope: ControlledAtsPayloadEnvelopeV1,
  rawPayloadHash?: string,
): ControlledAtsRejectedRecordV1 {
  return {
    reason,
    vendor: envelope.vendor,
    sourceUrl: envelope.sourceUrl,
    rawPayloadHash,
    version: 1,
  };
}

function rejectedResult(
  reason: string,
  envelope: ControlledAtsPayloadEnvelopeV1,
  rawPayloadHash?: string,
): NormalizedRecordResult {
  return { kind: "rejected", rejected: rejectedRecord(reason, envelope, rawPayloadHash) };
}

function buildControlledAtsDescriptionHash(descriptionText: string): Promise<string> {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "description",
    version: 1,
    descriptionText,
  });
}

function dedupeKey(lead: ControlledAtsJobLeadV1): string {
  if (lead.externalJobId) return `${lead.vendor}:external:${lead.externalJobId}`;
  if (lead.canonicalUrl) return `${lead.vendor}:url:${lead.canonicalUrl}`;
  return `${lead.vendor}:lead:${lead.leadHash}`;
}

function compareLeads(left: ControlledAtsJobLeadV1, right: ControlledAtsJobLeadV1): number {
  return (
    compareControlledAtsText(left.vendor, right.vendor) ||
    compareControlledAtsText(left.title, right.title) ||
    compareControlledAtsText(left.canonicalUrl ?? "", right.canonicalUrl ?? "") ||
    compareControlledAtsText(left.externalJobId ?? "", right.externalJobId ?? "") ||
    compareControlledAtsText(left.id, right.id)
  );
}

function compareRejectedRecords(left: ControlledAtsRejectedRecordV1, right: ControlledAtsRejectedRecordV1): number {
  return compareTextFields(
    [left.reason, left.vendor, left.sourceUrl, left.rawPayloadHash],
    [right.reason, right.vendor, right.sourceUrl, right.rawPayloadHash],
  );
}

function inferWorkplaceType(values: readonly (string | undefined)[]): ControlledAtsWorkplaceTypeV1 {
  const normalized = values.filter(Boolean).join(" ").normalize("NFKC").toLowerCase();
  if (/\bremote\b/u.test(normalized)) return "remote";
  if (/\bhybrid\b/u.test(normalized)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin[-\s]?office\b/u.test(normalized)) return "onsite";
  return "unknown";
}

function firstDepartmentName(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    if (!isPlainRecord(item)) continue;
    const name = stringField(item.name);
    if (name) return name;
  }
  return undefined;
}

function locationName(value: unknown): string | undefined {
  if (typeof value === "string") return stringField(value);
  if (isPlainRecord(value)) return stringField(value.name);
  return undefined;
}

function recruiteeDepartment(value: unknown): string | undefined {
  if (typeof value === "string") return stringField(value);
  if (isPlainRecord(value)) return stringField(value.name);
  return undefined;
}

function recruiteeLocation(record: Record<string, unknown>): string | undefined {
  if (Array.isArray(record.locations)) {
    const firstLocation = record.locations.find(isPlainRecord);
    if (firstLocation) {
      const location = stringField(firstLocation.name);
      if (location) return location;
    }
  }
  if (typeof record.location === "string") return stringField(record.location);
  if (isPlainRecord(record.location)) return stringField(record.location.name);
  return undefined;
}

function smartRecruitersDescription(value: unknown): string | undefined {
  if (!isPlainRecord(value) || !isPlainRecord(value.sections)) return undefined;
  const texts = orderedSmartRecruitersSectionEntries(value.sections)
    .flatMap(([, section]) => (isPlainRecord(section) ? [optionalRawString(section.text)] : []))
    .filter((text): text is string => typeof text === "string" && text.length > 0);
  return texts.length > 0 ? texts.join("\n\n") : undefined;
}

function orderedSmartRecruitersSectionEntries(
  sections: Record<string, unknown>,
): readonly [string, unknown][] {
  const knownOrder = ["description", "qualifications", "additionalInformation"] as const;
  const knownEntries = knownOrder.flatMap((key) => (
    Object.prototype.hasOwnProperty.call(sections, key) ? [[key, sections[key]] as [string, unknown]] : []
  ));
  const unknownEntries = Object.entries(sections)
    .filter(([key]) => !(knownOrder as readonly string[]).includes(key))
    .sort(([left], [right]) => compareControlledAtsText(left, right));
  return [...knownEntries, ...unknownEntries];
}

function smartRecruitersStatus(value: unknown): "open" | "closed" | "unknown" {
  if (value === true) return "open";
  if (value === false) return "closed";
  return "unknown";
}

function recruiteeStatus(value: unknown): "open" | "closed" | "unknown" {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "open" || normalized === "published") return "open";
  if (normalized === "closed" || normalized === "archived") return "closed";
  return "unknown";
}

function firstString(values: readonly (string | undefined)[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function firstRawString(values: readonly unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function joinNonEmpty(values: readonly (string | undefined)[], separator: string): string | undefined {
  const joined = values.filter((value): value is string => typeof value === "string" && value.length > 0).join(separator);
  return joined.length > 0 ? joined : undefined;
}

function timestampToIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function idField(value: unknown): string | undefined {
  if (typeof value === "string") return cleanOptionalString(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return cleanOptionalString(value);
}

function optionalRawString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function cleanOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function compareTextFields(left: readonly (string | undefined)[], right: readonly (string | undefined)[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const result = compareControlledAtsText(left[index] ?? "", right[index] ?? "");
    if (result !== 0) return result;
  }
  return 0;
}

function cloneRegistry(registry: ControlledAtsAdapterRegistryV1): ControlledAtsAdapterRegistryV1 {
  return {
    adapters: registry.adapters.map(cloneAdapter),
    vendors: [...registry.vendors].sort(compareControlledAtsText),
    version: 1,
  };
}

function cloneAdapter(adapter: ControlledAtsAdapterV1): ControlledAtsAdapterV1 {
  return {
    ...adapter,
    supportedSourceKinds: [...adapter.supportedSourceKinds],
  };
}

function cloneLead(lead: ControlledAtsJobLeadV1): ControlledAtsJobLeadV1 {
  return {
    ...lead,
    compensation: cloneCompensation(lead.compensation),
  };
}

function cloneCompensation(
  compensation: BuildControlledAtsJobLeadInputV1["compensation"],
): BuildControlledAtsJobLeadInputV1["compensation"] {
  return compensation ? { ...compensation } : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
