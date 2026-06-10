import { buildStableHash } from "../application-harness/fingerprints";
import type {
  ControlledAtsPayloadEnvelopeV1,
  ControlledAtsPublicFetchRejectedV1,
  ControlledAtsPublicFetchResultV1,
  ControlledAtsResolvedEndpointV1,
} from "./schema";
import { assertControlledAtsPayloadEnvelope } from "./scoutRules";
import {
  assertControlledAtsResolvedEndpoint,
  resolveControlledAtsPublicEndpointFromUrl,
} from "./sourceResolver";

export type ControlledAtsFetchImpl = (
  input: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
    redirect: "manual";
    signal?: AbortSignal;
  },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

type PageFetchResult = Readonly<{
  payload: unknown;
  status: number;
  contentType?: string;
  rawText: string;
}>;

type MergedFetchResult = Readonly<{
  payload: unknown;
  status: number;
  contentType?: string;
  rawText: string;
}>;

type SmartRecruitersPageState = {
  pages: PageFetchResult[];
  mergedContent: unknown[];
  firstPayload?: Record<string, unknown>;
};

export async function fetchControlledAtsPublicEndpoint(
  endpoint: ControlledAtsResolvedEndpointV1,
  options: Readonly<{
    fetchImpl: ControlledAtsFetchImpl;
    now?: () => number;
  }>,
): Promise<ControlledAtsPublicFetchResultV1> {
  assertControlledAtsResolvedEndpoint(endpoint);
  if (endpoint.authKind !== "none") throw rejected("endpoint_requires_auth", endpoint);
  if (endpoint.method !== "GET") throw rejected("unsupported_endpoint_host", endpoint);

  const headers = headersRecord(endpoint);
  if (hasAuthHeader(headers)) throw rejected("endpoint_requires_auth", endpoint);

  const fetched = await fetchEndpointPayload(endpoint, options.fetchImpl, headers);

  return {
    endpoint,
    payload: fetched.payload,
    status: fetched.status,
    contentType: fetched.contentType,
    rawResponseHash: await buildStableHash({
      namespace: "controlled-ats-scout",
      type: "public-endpoint-response",
      version: 1,
      rawText: fetched.rawText,
    }),
    fetchedAt: options.now?.() ?? Date.now(),
    version: 1,
  };
}

export async function fetchControlledAtsPayloadEnvelopeFromUrl(
  inputUrl: string,
  options: Readonly<{
    fetchImpl: ControlledAtsFetchImpl;
    now?: () => number;
  }>,
): Promise<ControlledAtsPayloadEnvelopeV1> {
  const endpoint = resolveControlledAtsPublicEndpointFromUrl(inputUrl);
  const result = await fetchControlledAtsPublicEndpoint(endpoint, options);
  const envelope: ControlledAtsPayloadEnvelopeV1 = {
    vendor: endpoint.vendor,
    sourceKind: endpoint.sourceKind,
    sourceUrl: endpoint.sourceUrl,
    payload: result.payload,
    createdAt: result.fetchedAt,
    updatedAt: result.fetchedAt,
    version: 1,
  };
  assertControlledAtsPayloadEnvelope(envelope);
  return envelope;
}

function headersRecord(endpoint: ControlledAtsResolvedEndpointV1): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of endpoint.headers) {
    headers[header.name.toLowerCase()] = header.value;
  }
  return headers;
}

function hasAuthHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((name) => name.toLowerCase() === "authorization" || name.toLowerCase() === "cookie");
}

async function fetchEndpointPayload(
  endpoint: ControlledAtsResolvedEndpointV1,
  fetchImpl: ControlledAtsFetchImpl,
  headers: Record<string, string>,
): Promise<MergedFetchResult> {
  if (endpoint.pagination?.kind === "lever_skip_limit") {
    return fetchLeverPages(endpoint, fetchImpl, headers);
  }
  if (endpoint.pagination?.kind === "smartrecruiters_offset_limit") {
    return fetchSmartRecruitersPages(endpoint, fetchImpl, headers);
  }
  const page = await fetchEndpointPage(endpoint, endpoint.endpointUrl, fetchImpl, headers);
  return { ...page, rawText: page.rawText };
}

async function fetchLeverPages(
  endpoint: ControlledAtsResolvedEndpointV1,
  fetchImpl: ControlledAtsFetchImpl,
  headers: Record<string, string>,
): Promise<MergedFetchResult> {
  const limit = endpoint.pagination?.limit ?? 100;
  const maxPages = endpoint.pagination?.maxPages ?? 1;
  const mergedPayload: unknown[] = [];
  const pages: PageFetchResult[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchEndpointPage(endpoint, withQueryParam(endpoint.endpointUrl, "skip", pageIndex * limit), fetchImpl, headers);
    const pagePayload = Array.isArray(page.payload) ? page.payload : undefined;
    if (!pagePayload) throw rejected("endpoint_invalid_json", endpoint, { status: page.status, contentType: page.contentType });
    pages.push(page);
    mergedPayload.push(...pagePayload);
    if (pagePayload.length < limit) break;
  }

  return mergePages(pages, mergedPayload);
}

async function fetchSmartRecruitersPages(
  endpoint: ControlledAtsResolvedEndpointV1,
  fetchImpl: ControlledAtsFetchImpl,
  headers: Record<string, string>,
): Promise<MergedFetchResult> {
  const limit = endpoint.pagination?.limit ?? 100;
  const maxPages = endpoint.pagination?.maxPages ?? 1;
  const state = await collectSmartRecruitersPages(endpoint, fetchImpl, headers, limit, maxPages);
  return mergePages(state.pages, smartRecruitersMergedPayload(state, limit));
}

async function fetchEndpointPage(
  endpoint: ControlledAtsResolvedEndpointV1,
  endpointUrl: string,
  fetchImpl: ControlledAtsFetchImpl,
  headers: Record<string, string>,
): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), endpoint.timeoutMs);

  try {
    const response = await fetchImpl(endpointUrl, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw rejected("endpoint_redirect_rejected", endpoint, { endpointUrl, status: response.status });
    }
    if (response.status !== 200) {
      throw rejected("endpoint_http_status", endpoint, { endpointUrl, status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? undefined;
    if (contentType !== undefined && !contentType.toLowerCase().includes("application/json")) {
      throw rejected("endpoint_non_json_response", endpoint, { endpointUrl, status: response.status, contentType });
    }

    const rawText = await response.text();
    if (rawText.length > endpoint.maxResponseBytes) {
      throw rejected("endpoint_response_too_large", endpoint, { endpointUrl, status: response.status, contentType });
    }

    try {
      return {
        payload: JSON.parse(rawText),
        status: response.status,
        contentType,
        rawText,
      };
    } catch {
      throw rejected("endpoint_invalid_json", endpoint, { endpointUrl, status: response.status, contentType });
    }
  } finally {
    clearTimeout(timer);
  }
}

function mergePages(pages: readonly PageFetchResult[], payload: unknown): MergedFetchResult {
  const firstPage = pages[0];
  return {
    payload,
    status: firstPage?.status ?? 200,
    contentType: firstPage?.contentType,
    rawText: pages.map((page) => page.rawText).join("\n"),
  };
}

function withQueryParam(url: string, key: string, value: string | number): string {
  const parsed = new URL(url);
  parsed.searchParams.set(key, String(value));
  return parsed.toString();
}

async function collectSmartRecruitersPages(
  endpoint: ControlledAtsResolvedEndpointV1,
  fetchImpl: ControlledAtsFetchImpl,
  headers: Record<string, string>,
  limit: number,
  maxPages: number,
  pageIndex = 0,
  state: SmartRecruitersPageState = { pages: [], mergedContent: [] },
): Promise<SmartRecruitersPageState> {
  if (pageIndex >= maxPages) return state;

  const offset = pageIndex * limit;
  const page = await fetchEndpointPage(endpoint, withQueryParam(endpoint.endpointUrl, "offset", offset), fetchImpl, headers);
  const pagePayload = smartRecruitersPagePayload(endpoint, page);
  addSmartRecruitersPage(state, page, pagePayload);

  if (!shouldFetchNextSmartRecruitersPage(pagePayload, offset, limit)) return state;
  return collectSmartRecruitersPages(endpoint, fetchImpl, headers, limit, maxPages, pageIndex + 1, state);
}

function addSmartRecruitersPage(
  state: SmartRecruitersPageState,
  page: PageFetchResult,
  pagePayload: Record<string, unknown> & { content: unknown[] },
): void {
  state.firstPayload ??= pagePayload;
  state.pages.push(page);
  state.mergedContent.push(...pagePayload.content);
}

function smartRecruitersMergedPayload(
  state: SmartRecruitersPageState,
  limit: number,
): Record<string, unknown> {
  return {
    ...(state.firstPayload ?? {}),
    content: state.mergedContent,
    offset: 0,
    limit,
    totalFound: state.firstPayload?.totalFound,
  };
}

function smartRecruitersPagePayload(
  endpoint: ControlledAtsResolvedEndpointV1,
  page: PageFetchResult,
): Record<string, unknown> & { content: unknown[] } {
  const payload = page.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw rejected("endpoint_invalid_json", endpoint, { status: page.status, contentType: page.contentType });
  }

  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.content)) {
    throw rejected("endpoint_invalid_json", endpoint, { status: page.status, contentType: page.contentType });
  }

  return record as Record<string, unknown> & { content: unknown[] };
}

function shouldFetchNextSmartRecruitersPage(
  payload: Readonly<{ content: readonly unknown[]; totalFound?: unknown }>,
  offset: number,
  limit: number,
): boolean {
  if (payload.content.length < limit) return false;
  if (typeof payload.totalFound !== "number" || !Number.isFinite(payload.totalFound)) return true;
  return offset + payload.content.length < payload.totalFound;
}

function rejected(
  reason: ControlledAtsPublicFetchRejectedV1["reason"],
  endpoint: ControlledAtsResolvedEndpointV1,
  overrides: Partial<ControlledAtsPublicFetchRejectedV1> = {},
): ControlledAtsPublicFetchRejectedV1 {
  return {
    reason,
    inputUrl: endpoint.inputUrl,
    endpointUrl: endpoint.endpointUrl,
    vendor: endpoint.vendor,
    version: 1,
    ...overrides,
  };
}
