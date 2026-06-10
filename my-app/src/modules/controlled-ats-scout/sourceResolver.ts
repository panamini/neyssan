import type {
  ControlledAtsResolvedEndpointV1,
  ControlledAtsVendorV1,
} from "./schema";
import {
  assertControlledAtsDoesNotUseForbiddenVendor,
  isControlledAtsVendor,
  isControlledAtsSourceKind,
} from "./scoutRules";

const ACCEPT_JSON_HEADER = [{ name: "accept", value: "application/json" }] as const;
const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const LEVER_LIMIT = 100;
const SMARTRECRUITERS_LIMIT = 100;
const MAX_PAGES = 20;
const RECRUITEE_REJECTED_SUBDOMAINS = new Set(["", "www", "docs", "app"]);

export function resolveControlledAtsPublicEndpointFromUrl(inputUrl: string): ControlledAtsResolvedEndpointV1 {
  const parsed = parseHttpsUrl(inputUrl);
  assertControlledAtsDoesNotUseForbiddenVendor(parsed.toString());

  const host = parsed.hostname.toLowerCase();
  if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io" || host === "boards-api.greenhouse.io") {
    return greenhouseEndpoint(inputUrl, parsed);
  }
  if (host === "jobs.lever.co" || host === "api.lever.co" || host === "jobs.eu.lever.co" || host === "api.eu.lever.co") {
    return leverEndpoint(inputUrl, parsed);
  }
  if (host === "careers.smartrecruiters.com" || host === "api.smartrecruiters.com") {
    return smartRecruitersEndpoint(inputUrl, parsed);
  }
  if (host.endsWith(".recruitee.com")) {
    return recruiteeEndpoint(inputUrl, parsed);
  }

  throw new TypeError("Controlled ATS public endpoint resolver received unsupported source URL");
}

export function inferControlledAtsPublicSourceFromUrl(inputUrl: string): ControlledAtsVendorV1 | undefined {
  try {
    return resolveControlledAtsPublicEndpointFromUrl(inputUrl).vendor;
  } catch {
    return undefined;
  }
}

export function assertControlledAtsResolvedEndpoint(endpoint: ControlledAtsResolvedEndpointV1): void {
  if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint)) {
    throw new TypeError("ControlledAtsResolvedEndpoint must be an object");
  }
  assertResolvedEndpointIdentity(endpoint);
  assertResolvedEndpointTransport(endpoint);
  assertResolvedEndpointLimits(endpoint);
  assertResolvedEndpointHost(endpoint);
}

function assertResolvedEndpointIdentity(endpoint: ControlledAtsResolvedEndpointV1): void {
  if (!isControlledAtsVendor(endpoint.vendor)) throw new TypeError("ControlledAtsResolvedEndpoint requires supported vendor");
  if (!isControlledAtsSourceKind(endpoint.sourceKind)) {
    throw new TypeError("ControlledAtsResolvedEndpoint requires supported sourceKind");
  }
  if (endpoint.sourceKind !== "public_job_board_payload") {
    throw new TypeError("ControlledAtsResolvedEndpoint sourceKind must be public_job_board_payload");
  }
  if (!isNonEmptyString(endpoint.inputUrl)) throw new TypeError("ControlledAtsResolvedEndpoint requires inputUrl");
  if (!isNonEmptyString(endpoint.sourceUrl)) throw new TypeError("ControlledAtsResolvedEndpoint requires sourceUrl");
  if (!isNonEmptyString(endpoint.endpointUrl)) throw new TypeError("ControlledAtsResolvedEndpoint requires endpointUrl");
  if (!isNonEmptyString(endpoint.rateLimitKey)) throw new TypeError("ControlledAtsResolvedEndpoint requires rateLimitKey");
  if (endpoint.version !== 1) throw new TypeError("ControlledAtsResolvedEndpoint version must be 1");
}

function assertResolvedEndpointTransport(endpoint: ControlledAtsResolvedEndpointV1): void {
  if (endpoint.method !== "GET") throw new TypeError("ControlledAtsResolvedEndpoint method must be GET");
  if (!Array.isArray(endpoint.headers)) throw new TypeError("ControlledAtsResolvedEndpoint requires headers");
  for (const header of endpoint.headers) {
    if (!isHeaderRecord(header)) throw new TypeError("ControlledAtsResolvedEndpoint header shape is invalid");
  }
  if (endpoint.authKind !== "none") throw new TypeError("ControlledAtsResolvedEndpoint authKind must be none");
}

function assertResolvedEndpointLimits(endpoint: ControlledAtsResolvedEndpointV1): void {
  if (!isPositiveFiniteNumber(endpoint.maxResponseBytes)) {
    throw new TypeError("ControlledAtsResolvedEndpoint requires maxResponseBytes");
  }
  if (!isPositiveFiniteNumber(endpoint.timeoutMs)) throw new TypeError("ControlledAtsResolvedEndpoint requires timeoutMs");
}

function assertResolvedEndpointHost(endpoint: ControlledAtsResolvedEndpointV1): void {
  const endpointHost = parseHttpsUrl(endpoint.endpointUrl).hostname.toLowerCase();
  if (!isEndpointHostAllowed(endpoint.vendor, endpointHost)) {
    throw new TypeError("ControlledAtsResolvedEndpoint host does not match vendor");
  }
}

function greenhouseEndpoint(inputUrl: string, parsed: URL): ControlledAtsResolvedEndpointV1 {
  const boardToken = parsed.hostname.toLowerCase() === "boards-api.greenhouse.io"
    ? pathSegment(parsed, 2, ["v1", "boards"])
    : firstPathSegment(parsed);
  assertSafeToken(boardToken, "Greenhouse board token");

  return endpoint({
    vendor: "greenhouse",
    inputUrl,
    sourceUrl: `https://boards.greenhouse.io/${boardToken}`,
    endpointUrl: `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    rateLimitKey: `greenhouse:${boardToken}`,
    pagination: { kind: "none", limit: 0, maxPages: 1 },
  });
}

function leverEndpoint(inputUrl: string, parsed: URL): ControlledAtsResolvedEndpointV1 {
  const host = parsed.hostname.toLowerCase();
  const eu = host === "jobs.eu.lever.co" || host === "api.eu.lever.co";
  const site = host.startsWith("api.")
    ? pathSegment(parsed, 2, ["v0", "postings"])
    : firstPathSegment(parsed);
  assertSafeToken(site, "Lever site");
  const jobsHost = eu ? "jobs.eu.lever.co" : "jobs.lever.co";
  const apiHost = eu ? "api.eu.lever.co" : "api.lever.co";
  const region = eu ? "eu" : "global";

  return endpoint({
    vendor: "lever",
    inputUrl,
    sourceUrl: `https://${jobsHost}/${site}`,
    endpointUrl: `https://${apiHost}/v0/postings/${site}?mode=json&limit=${LEVER_LIMIT}&skip=0`,
    rateLimitKey: `lever:${region}:${site}`,
    pagination: { kind: "lever_skip_limit", limit: LEVER_LIMIT, maxPages: MAX_PAGES },
  });
}

function smartRecruitersEndpoint(inputUrl: string, parsed: URL): ControlledAtsResolvedEndpointV1 {
  const companyIdentifier = parsed.hostname.toLowerCase() === "api.smartrecruiters.com"
    ? pathSegment(parsed, 2, ["v1", "companies"])
    : firstPathSegment(parsed);
  assertSafeToken(companyIdentifier, "SmartRecruiters company identifier");

  return endpoint({
    vendor: "smartrecruiters",
    inputUrl,
    sourceUrl: `https://careers.smartrecruiters.com/${companyIdentifier}`,
    endpointUrl: `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings?limit=${SMARTRECRUITERS_LIMIT}&offset=0`,
    rateLimitKey: `smartrecruiters:${companyIdentifier}`,
    pagination: { kind: "smartrecruiters_offset_limit", limit: SMARTRECRUITERS_LIMIT, maxPages: MAX_PAGES },
  });
}

function recruiteeEndpoint(inputUrl: string, parsed: URL): ControlledAtsResolvedEndpointV1 {
  const host = parsed.hostname.toLowerCase();
  const subdomain = host.slice(0, -".recruitee.com".length);
  if (RECRUITEE_REJECTED_SUBDOMAINS.has(subdomain)) {
    throw new TypeError("Controlled ATS public endpoint resolver received unsupported source URL");
  }
  assertSafeToken(subdomain, "Recruitee subdomain");

  return endpoint({
    vendor: "recruitee",
    inputUrl,
    sourceUrl: `https://${subdomain}.recruitee.com`,
    endpointUrl: `https://${subdomain}.recruitee.com/api/offers/`,
    rateLimitKey: `recruitee:${subdomain}`,
    pagination: { kind: "none", limit: 0, maxPages: 1 },
  });
}

function endpoint(input: Omit<ControlledAtsResolvedEndpointV1, "sourceKind" | "method" | "headers" | "authKind" | "maxResponseBytes" | "timeoutMs" | "version">): ControlledAtsResolvedEndpointV1 {
  const resolved: ControlledAtsResolvedEndpointV1 = {
    ...input,
    sourceKind: "public_job_board_payload",
    method: "GET",
    headers: ACCEPT_JSON_HEADER,
    authKind: "none",
    maxResponseBytes: MAX_RESPONSE_BYTES,
    timeoutMs: TIMEOUT_MS,
    version: 1,
  };
  assertControlledAtsResolvedEndpoint(resolved);
  return resolved;
}

function parseHttpsUrl(value: string): URL {
  if (!isNonEmptyString(value)) throw new TypeError("Controlled ATS public endpoint resolver requires a URL");
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new TypeError("Controlled ATS public endpoint resolver received invalid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new TypeError("Controlled ATS public endpoint resolver requires HTTPS URL");
  }
  return parsed;
}

function firstPathSegment(parsed: URL): string {
  return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
}

function pathSegment(parsed: URL, index: number, expectedPrefix: readonly string[]): string {
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (expectedPrefix.some((segment, segmentIndex) => segments[segmentIndex] !== segment)) return "";
  return segments[index] ?? "";
}

function assertSafeToken(value: string, label: string): void {
  if (!isNonEmptyString(value) || /[\s/?#]/u.test(value)) {
    throw new TypeError(`Controlled ATS public endpoint resolver requires ${label}`);
  }
}

function isEndpointHostAllowed(vendor: ControlledAtsVendorV1, host: string): boolean {
  if (vendor === "greenhouse") return host === "boards-api.greenhouse.io";
  if (vendor === "lever") return host === "api.lever.co" || host === "api.eu.lever.co";
  if (vendor === "smartrecruiters") return host === "api.smartrecruiters.com";
  if (vendor === "recruitee") return host.endsWith(".recruitee.com") && !RECRUITEE_REJECTED_SUBDOMAINS.has(host.slice(0, -".recruitee.com".length));
  return false;
}

function isHeaderRecord(value: unknown): value is Readonly<{ name: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.name) && typeof record.value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
