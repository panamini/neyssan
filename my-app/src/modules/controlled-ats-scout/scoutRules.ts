import type {
  ControlledAtsAdapterRegistryV1,
  ControlledAtsAdapterV1,
  ControlledAtsCompensationIntervalV1,
  ControlledAtsCompensationV1,
  ControlledAtsForbiddenVendorV1,
  ControlledAtsJobLeadV1,
  ControlledAtsJobStatusV1,
  ControlledAtsPayloadEnvelopeV1,
  ControlledAtsSourceKindV1,
  ControlledAtsVendorV1,
  ControlledAtsWorkplaceTypeV1,
} from "./schema";

export const CONTROLLED_ATS_VENDORS: readonly ControlledAtsVendorV1[] = [
  "ashby",
  "greenhouse",
  "lever",
] as const;

export const CONTROLLED_ATS_FORBIDDEN_VENDORS: readonly ControlledAtsForbiddenVendorV1[] = [
  "linkedin",
  "upwork",
  "indeed",
  "generic_web",
  "unknown_scraper",
] as const;

export const CONTROLLED_ATS_SOURCE_KINDS: readonly ControlledAtsSourceKindV1[] = [
  "manual_fixture",
  "public_job_board_payload",
  "public_job_detail_payload",
] as const;

export const CONTROLLED_ATS_JOB_STATUSES: readonly ControlledAtsJobStatusV1[] = [
  "closed",
  "open",
  "unknown",
] as const;

export const CONTROLLED_ATS_WORKPLACE_TYPES: readonly ControlledAtsWorkplaceTypeV1[] = [
  "hybrid",
  "onsite",
  "remote",
  "unknown",
] as const;

export const CONTROLLED_ATS_COMPENSATION_INTERVALS: readonly ControlledAtsCompensationIntervalV1[] = [
  "day",
  "hour",
  "month",
  "unknown",
  "week",
  "year",
] as const;

const VENDOR_HOST_PATTERNS: Readonly<Record<ControlledAtsVendorV1, readonly string[]>> = {
  ashby: ["ashbyhq.com", "jobs.ashbyhq.com"],
  greenhouse: ["greenhouse.io", "boards.greenhouse.io", "job-boards.greenhouse.io"],
  lever: ["lever.co", "jobs.lever.co"],
} as const;

const FORBIDDEN_URL_HOST_PATTERNS: readonly string[] = [
  "linkedin.com",
  "www.linkedin.com",
  "upwork.com",
  "www.upwork.com",
  "indeed.com",
  "www.indeed.com",
] as const;

const SUPPLIED_PAYLOAD_KEYS = new Set(["payload", "descriptionText", "rawText"]);

const GENERATED_OR_FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /\bdear hiring manager\b/u,
  /\bi am excited to apply\b/u,
  /\bthank you for your consideration\b/u,
  /\bsincerely\b/u,
  /\bbest regards\b/u,
  /\bcover[-\s]?letter prose\b/u,
  /\bresume bullet\b/u,
  /\bresults-driven\b/u,
  /\bproven track record\b/u,
  /\b(increased|reduced|improved|boosted|grew|scaled)\b[^.]{0,120}\b\d+\s*%/u,
  /\bauto[-\s]?apply\b/u,
  /\bsubmit applications?\b/u,
  /\bbrowser automation\b/u,
  /\bruntime adapter\b/u,
  /\bruntime scout\b/u,
  /\bscrape\b/u,
  /\bscrapes\b/u,
  /\bscraping\b/u,
  /\bcrawl\b/u,
  /\bcrawls\b/u,
  /\bcrawler\b/u,
] as const;

export function isControlledAtsVendor(value: unknown): value is ControlledAtsVendorV1 {
  return includesString(CONTROLLED_ATS_VENDORS, value);
}

export function isControlledAtsSourceKind(value: unknown): value is ControlledAtsSourceKindV1 {
  return includesString(CONTROLLED_ATS_SOURCE_KINDS, value);
}

export function isControlledAtsJobStatus(value: unknown): value is ControlledAtsJobStatusV1 {
  return includesString(CONTROLLED_ATS_JOB_STATUSES, value);
}

export function isControlledAtsWorkplaceType(value: unknown): value is ControlledAtsWorkplaceTypeV1 {
  return includesString(CONTROLLED_ATS_WORKPLACE_TYPES, value);
}

export function canonicalizeControlledAtsUrl(vendor: ControlledAtsVendorV1, url: string): string {
  if (!isControlledAtsVendor(vendor)) {
    throw new TypeError("Controlled ATS URL canonicalization requires a supported vendor");
  }
  if (!isNonEmptyString(url)) {
    throw new TypeError("Controlled ATS URL canonicalization requires a URL");
  }

  const parsed = parseUrl(url);
  assertControlledAtsDoesNotUseForbiddenVendor(parsed.toString());

  const inferredVendor = inferControlledAtsVendorFromHost(parsed.hostname);
  if (!inferredVendor) {
    throw new TypeError("Controlled ATS URL uses unsupported host");
  }
  if (inferredVendor !== vendor) {
    throw new TypeError("Controlled ATS URL host does not match vendor");
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  const sortedParams = [...parsed.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    compareAscii(leftKey, rightKey) || compareAscii(leftValue, rightValue),
  );
  parsed.search = "";
  for (const [key, value] of sortedParams) {
    parsed.searchParams.append(key, value);
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/u, "");
  const query = parsed.searchParams.toString();

  return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
}

export function inferControlledAtsVendorFromUrl(url: string): ControlledAtsVendorV1 | undefined {
  if (!isNonEmptyString(url)) return undefined;
  try {
    return inferControlledAtsVendorFromHost(parseUrl(url).hostname);
  } catch {
    return undefined;
  }
}

export function assertControlledAtsPayloadEnvelope(envelope: ControlledAtsPayloadEnvelopeV1): void {
  const record = asPlainRecord(envelope, "ControlledAtsPayloadEnvelope must be an object");
  if (!isControlledAtsVendor(record.vendor)) {
    throw new TypeError("ControlledAtsPayloadEnvelope requires a supported vendor");
  }
  if (!isControlledAtsSourceKind(record.sourceKind)) {
    throw new TypeError("ControlledAtsPayloadEnvelope requires a supported sourceKind");
  }
  if (!Object.prototype.hasOwnProperty.call(record, "payload")) {
    throw new TypeError("ControlledAtsPayloadEnvelope requires payload");
  }
  if (record.sourceUrl !== undefined && !isNonEmptyString(record.sourceUrl)) {
    throw new TypeError("ControlledAtsPayloadEnvelope sourceUrl must be non-empty when present");
  }
  if (!isFiniteNumber(record.createdAt)) {
    throw new TypeError("ControlledAtsPayloadEnvelope requires finite createdAt");
  }
  if (!isFiniteNumber(record.updatedAt)) {
    throw new TypeError("ControlledAtsPayloadEnvelope requires finite updatedAt");
  }
  if (record.version !== 1) throw new TypeError("ControlledAtsPayloadEnvelope version must be 1");
}

export function assertControlledAtsJobLead(lead: ControlledAtsJobLeadV1): void {
  const record = asPlainRecord(lead, "ControlledAtsJobLead must be an object");
  if (!isNonEmptyString(record.id)) throw new TypeError("ControlledAtsJobLead requires id");
  if (!isControlledAtsVendor(record.vendor)) throw new TypeError("ControlledAtsJobLead requires supported vendor");
  if (!isControlledAtsSourceKind(record.sourceKind)) {
    throw new TypeError("ControlledAtsJobLead requires supported sourceKind");
  }
  if (!isNonEmptyString(record.title)) throw new TypeError("ControlledAtsJobLead requires title");
  if (!isControlledAtsWorkplaceType(record.workplaceType)) {
    throw new TypeError("ControlledAtsJobLead requires supported workplaceType");
  }
  if (!isControlledAtsJobStatus(record.status)) {
    throw new TypeError("ControlledAtsJobLead requires supported status");
  }
  if (record.compensation !== undefined) {
    assertControlledAtsCompensation(record.compensation as ControlledAtsCompensationV1);
  }
  if (!isNonEmptyString(record.rawPayloadHash)) throw new TypeError("ControlledAtsJobLead requires rawPayloadHash");
  if (!isNonEmptyString(record.leadHash)) throw new TypeError("ControlledAtsJobLead requires leadHash");
  if (record.id !== `controlled-ats-job-lead:${record.leadHash}`) {
    throw new TypeError("ControlledAtsJobLead id must derive from leadHash");
  }
  if (!isFiniteNumber(record.createdAt)) throw new TypeError("ControlledAtsJobLead requires finite createdAt");
  if (!isFiniteNumber(record.updatedAt)) throw new TypeError("ControlledAtsJobLead requires finite updatedAt");
  if (record.version !== 1) throw new TypeError("ControlledAtsJobLead version must be 1");
}

export function assertControlledAtsAdapterRegistry(registry: ControlledAtsAdapterRegistryV1): void {
  const record = asPlainRecord(registry, "ControlledAtsAdapterRegistry must be an object");
  if (!Array.isArray(record.adapters)) throw new TypeError("ControlledAtsAdapterRegistry requires adapters array");
  if (!Array.isArray(record.vendors)) throw new TypeError("ControlledAtsAdapterRegistry requires vendors array");
  if (record.version !== 1) throw new TypeError("ControlledAtsAdapterRegistry version must be 1");

  const vendors: ControlledAtsVendorV1[] = [];
  for (const adapter of record.adapters) {
    assertControlledAtsAdapter(adapter as ControlledAtsAdapterV1);
    vendors.push((adapter as ControlledAtsAdapterV1).vendor);
  }

  assertNoDuplicateStrings(vendors, "ControlledAtsAdapterRegistry duplicate vendor");
  assertSameStringArray(vendors, [...vendors].sort(compareAscii), "ControlledAtsAdapterRegistry adapters must be sorted");

  for (const vendor of record.vendors) {
    if (!isControlledAtsVendor(vendor)) throw new TypeError("ControlledAtsAdapterRegistry vendors must be supported");
  }
  assertNoDuplicateStrings(record.vendors as string[], "ControlledAtsAdapterRegistry duplicate vendor");
  assertSameStringArray(
    record.vendors as string[],
    [...(record.vendors as string[])].sort(compareAscii),
    "ControlledAtsAdapterRegistry vendors must be sorted",
  );
  assertSameStringArray(record.vendors as string[], vendors, "ControlledAtsAdapterRegistry vendors must match adapters");
  assertControlledAtsScoutDoesNotContainGeneratedText(registry);
}

export function assertControlledAtsDoesNotUseForbiddenVendor(vendorOrUrl: string): void {
  const normalized = vendorOrUrl.normalize("NFKC").trim().toLowerCase();
  if ((CONTROLLED_ATS_FORBIDDEN_VENDORS as readonly string[]).includes(normalized)) {
    throw new TypeError("Controlled ATS forbidden vendor");
  }

  try {
    const parsed = parseUrl(vendorOrUrl);
    if (hostMatchesAny(parsed.hostname, FORBIDDEN_URL_HOST_PATTERNS)) {
      throw new TypeError("Controlled ATS forbidden vendor URL");
    }
  } catch (error) {
    if (error instanceof TypeError && /forbidden/u.test(error.message)) throw error;
  }
}

export function assertControlledAtsScoutDoesNotContainGeneratedText(value: unknown): void {
  for (const candidate of collectGuardStrings(value)) {
    const normalized = candidate.normalize("NFKC").toLowerCase();
    if (GENERATED_OR_FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
      throw new TypeError("Controlled ATS Scout metadata contains generated or forbidden behavior text");
    }
  }
}

export function compareControlledAtsText(a: string, b: string): number {
  return compareAscii(a, b);
}

function assertControlledAtsAdapter(adapter: ControlledAtsAdapterV1): void {
  const record = asPlainRecord(adapter, "ControlledAtsAdapter must be an object");
  if (!isControlledAtsVendor(record.vendor)) throw new TypeError("ControlledAtsAdapter requires supported vendor");
  if (!isNonEmptyString(record.title)) throw new TypeError("ControlledAtsAdapter requires title");
  if (!isNonEmptyString(record.description)) throw new TypeError("ControlledAtsAdapter requires description");
  if (!Array.isArray(record.supportedSourceKinds)) {
    throw new TypeError("ControlledAtsAdapter requires supportedSourceKinds");
  }
  for (const sourceKind of record.supportedSourceKinds) {
    if (!isControlledAtsSourceKind(sourceKind)) {
      throw new TypeError("ControlledAtsAdapter sourceKind must be supported");
    }
  }
  if (record.version !== 1) throw new TypeError("ControlledAtsAdapter version must be 1");
}

function assertControlledAtsCompensation(compensation: ControlledAtsCompensationV1): void {
  const record = asPlainRecord(compensation, "ControlledAtsCompensation must be an object");
  assertOptionalNonEmptyString(record.currency, "ControlledAtsCompensation currency must be non-empty when present");
  assertOptionalFiniteNumber(record.minAmount, "ControlledAtsCompensation minAmount must be finite when present");
  assertOptionalFiniteNumber(record.maxAmount, "ControlledAtsCompensation maxAmount must be finite when present");
  assertOptionalCompensationInterval(record.interval);
  assertOptionalString(record.rawText, "ControlledAtsCompensation rawText must be a string when present");
  if (record.version !== 1) throw new TypeError("ControlledAtsCompensation version must be 1");
}

function inferControlledAtsVendorFromHost(host: string): ControlledAtsVendorV1 | undefined {
  const normalizedHost = host.toLowerCase();
  return CONTROLLED_ATS_VENDORS.find((vendor) => hostMatchesAny(normalizedHost, VENDOR_HOST_PATTERNS[vendor]));
}

function hostMatchesAny(host: string, patterns: readonly string[]): boolean {
  const normalizedHost = host.toLowerCase();
  return patterns.some((pattern) => normalizedHost === pattern || normalizedHost.endsWith(`.${pattern}`));
}

function parseUrl(value: string): URL {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new TypeError("Controlled ATS URL must be HTTP(S)");
    }
    return parsed;
  } catch (error) {
    if (error instanceof TypeError && /Controlled ATS/u.test(error.message)) throw error;
    throw new TypeError("Controlled ATS URL is invalid");
  }
}

function collectGuardStrings(value: unknown, key?: string): readonly string[] {
  if (key && SUPPLIED_PAYLOAD_KEYS.has(key)) return [];
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectGuardStrings(item));

  return Object.entries(value as Record<string, unknown>).flatMap(([entryKey, entryValue]) =>
    collectGuardStrings(entryValue, entryKey),
  );
}

function assertNoDuplicateStrings(values: readonly string[], message: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(message);
}

function assertSameStringArray(actual: readonly string[], expected: readonly string[], message: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(message);
  }
}

function compareAscii(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function includesString<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function assertOptionalNonEmptyString(value: unknown, message: string): void {
  if (value !== undefined && !isNonEmptyString(value)) throw new TypeError(message);
}

function assertOptionalString(value: unknown, message: string): void {
  if (value !== undefined && typeof value !== "string") throw new TypeError(message);
}

function assertOptionalFiniteNumber(value: unknown, message: string): void {
  if (value !== undefined && !isFiniteNumber(value)) throw new TypeError(message);
}

function assertOptionalCompensationInterval(value: unknown): void {
  if (value !== undefined && !includesString(CONTROLLED_ATS_COMPENSATION_INTERVALS, value)) {
    throw new TypeError("ControlledAtsCompensation interval must be supported when present");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(message);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(message);
  return value as Record<string, unknown>;
}
