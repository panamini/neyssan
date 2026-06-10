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

  const response = await options.fetchImpl(endpoint.endpointUrl, {
    method: "GET",
    headers,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw rejected("endpoint_redirect_rejected", endpoint, { status: response.status });
  }
  if (response.status !== 200) {
    throw rejected("endpoint_http_status", endpoint, { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? undefined;
  const rawText = await response.text();
  if (rawText.length > endpoint.maxResponseBytes) {
    throw rejected("endpoint_response_too_large", endpoint, { status: response.status, contentType });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw rejected("endpoint_invalid_json", endpoint, { status: response.status, contentType });
  }

  if (contentType !== undefined && !contentType.toLowerCase().includes("application/json")) {
    throw rejected("endpoint_non_json_response", endpoint, { status: response.status, contentType });
  }

  return {
    endpoint,
    payload,
    status: response.status,
    contentType,
    rawResponseHash: await buildStableHash({
      namespace: "controlled-ats-scout",
      type: "public-endpoint-response",
      version: 1,
      rawText,
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
