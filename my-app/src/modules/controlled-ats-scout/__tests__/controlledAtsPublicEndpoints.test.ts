import { describe, expect, it, vi } from "vitest";
import {
  fetchControlledAtsPayloadEnvelopeFromUrl,
  fetchControlledAtsPublicEndpoint,
  type ControlledAtsFetchImpl,
} from "../publicEndpointFetcher";
import {
  assertControlledAtsResolvedEndpoint,
  inferControlledAtsPublicSourceFromUrl,
  resolveControlledAtsPublicEndpointFromUrl,
} from "../sourceResolver";

const T = Date.UTC(2026, 5, 11);

function jsonResponse(
  body: unknown,
  overrides: Partial<{
    status: number;
    contentType: string | null;
  }> = {},
) {
  const text = JSON.stringify(body);
  return {
    status: overrides.status ?? 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? overrides.contentType ?? "application/json" : null),
    },
    text: async () => text,
  };
}

function textResponse(
  body: string,
  overrides: Partial<{
    status: number;
    contentType: string | null;
  }> = {},
) {
  return {
    status: overrides.status ?? 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? overrides.contentType ?? "application/json" : null),
    },
    text: async () => body,
  };
}

describe("controlled ATS public endpoint resolver", () => {
  it("resolves Greenhouse board URL to boards-api endpoint with content=true", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://boards.greenhouse.io/acme/jobs/123");

    expect(endpoint).toMatchObject({
      vendor: "greenhouse",
      sourceUrl: "https://boards.greenhouse.io/acme",
      endpointUrl: "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
      method: "GET",
      authKind: "none",
      rateLimitKey: "greenhouse:acme",
      pagination: { kind: "none", limit: 0, maxPages: 1 },
      version: 1,
    });
  });

  it("resolves Greenhouse API URL idempotently", () => {
    expect(resolveControlledAtsPublicEndpointFromUrl("https://boards-api.greenhouse.io/v1/boards/acme/jobs").endpointUrl).toBe(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
    );
  });

  it("resolves Lever global jobs URL to api.lever.co endpoint", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://jobs.lever.co/acme/posting-1");

    expect(endpoint.endpointUrl).toBe("https://api.lever.co/v0/postings/acme?mode=json&limit=100&skip=0");
    expect(endpoint.rateLimitKey).toBe("lever:global:acme");
    expect(endpoint.pagination).toEqual({ kind: "lever_skip_limit", limit: 100, maxPages: 20 });
  });

  it("resolves Lever EU jobs URL to api.eu.lever.co endpoint", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://jobs.eu.lever.co/acme/posting-1");

    expect(endpoint.endpointUrl).toBe("https://api.eu.lever.co/v0/postings/acme?mode=json&limit=100&skip=0");
    expect(endpoint.rateLimitKey).toBe("lever:eu:acme");
  });

  it("resolves Lever API URLs to matching global and EU endpoints", () => {
    expect(resolveControlledAtsPublicEndpointFromUrl("https://api.lever.co/v0/postings/acme").endpointUrl).toBe(
      "https://api.lever.co/v0/postings/acme?mode=json&limit=100&skip=0",
    );
    expect(resolveControlledAtsPublicEndpointFromUrl("https://api.eu.lever.co/v0/postings/acme").endpointUrl).toBe(
      "https://api.eu.lever.co/v0/postings/acme?mode=json&limit=100&skip=0",
    );
  });

  it("resolves SmartRecruiters career URL to public postings endpoint", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://careers.smartrecruiters.com/AcmeCorp/jobs");

    expect(endpoint.endpointUrl).toBe("https://api.smartrecruiters.com/v1/companies/AcmeCorp/postings?limit=100&offset=0");
    expect(endpoint.sourceUrl).toBe("https://careers.smartrecruiters.com/AcmeCorp");
    expect(endpoint.pagination).toEqual({ kind: "smartrecruiters_offset_limit", limit: 100, maxPages: 20 });
  });

  it("resolves SmartRecruiters API URL idempotently", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl(
      "https://api.smartrecruiters.com/v1/companies/AcmeCorp/postings?limit=5&offset=20",
    );

    expect(endpoint.endpointUrl).toBe("https://api.smartrecruiters.com/v1/companies/AcmeCorp/postings?limit=100&offset=0");
  });

  it("resolves Recruitee company host to /api/offers/", () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://acme.recruitee.com/o/senior-product-engineer");

    expect(endpoint).toMatchObject({
      vendor: "recruitee",
      sourceUrl: "https://acme.recruitee.com",
      endpointUrl: "https://acme.recruitee.com/api/offers/",
      rateLimitKey: "recruitee:acme",
    });
  });

  it("rejects forbidden and unsupported source URLs", () => {
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://www.linkedin.com/jobs/view/1")).toThrow(/forbidden/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://www.upwork.com/jobs/~1")).toThrow(/forbidden/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://www.indeed.com/viewjob?jk=1")).toThrow(/forbidden/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://example.com/careers")).toThrow(/unsupported/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://docs.recruitee.com")).toThrow(/unsupported/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("https://www.recruitee.com")).toThrow(/unsupported/i);
    expect(() => resolveControlledAtsPublicEndpointFromUrl("http://boards.greenhouse.io/acme")).toThrow(/https/i);
  });

  it("infers public source vendors without throwing", () => {
    expect(inferControlledAtsPublicSourceFromUrl("https://boards.greenhouse.io/acme")).toBe("greenhouse");
    expect(inferControlledAtsPublicSourceFromUrl("https://jobs.lever.co/acme")).toBe("lever");
    expect(inferControlledAtsPublicSourceFromUrl("https://careers.smartrecruiters.com/acme")).toBe("smartrecruiters");
    expect(inferControlledAtsPublicSourceFromUrl("https://acme.recruitee.com")).toBe("recruitee");
    expect(inferControlledAtsPublicSourceFromUrl("https://example.com/careers")).toBeUndefined();
  });

  it("resolver output is deterministic and does not mutate inputs", () => {
    const input = "https://jobs.lever.co/acme?b=2&a=1";
    const first = resolveControlledAtsPublicEndpointFromUrl(input);
    const second = resolveControlledAtsPublicEndpointFromUrl(input);

    expect(first).toEqual(second);
    expect(input).toBe("https://jobs.lever.co/acme?b=2&a=1");
    expect(() => assertControlledAtsResolvedEndpoint(first)).not.toThrow();
  });
});

describe("controlled ATS public endpoint fetcher", () => {
  it("calls injected fetchImpl with GET, accept application/json, manual redirects, and timeout signal", async () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://boards.greenhouse.io/acme");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const fetchImpl = vi.fn<ControlledAtsFetchImpl>(async () => jsonResponse({ jobs: [] }));

    await fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl, now: () => T });

    expect(fetchImpl).toHaveBeenCalledWith(endpoint.endpointUrl, expect.objectContaining({
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    }));
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  it("rejects Authorization header if accidentally added", async () => {
    const endpoint = {
      ...resolveControlledAtsPublicEndpointFromUrl("https://boards.greenhouse.io/acme"),
      headers: [
        { name: "accept", value: "application/json" },
        { name: "authorization", value: "Bearer token" },
      ],
    };

    await expect(fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl: async () => jsonResponse({}) })).rejects.toMatchObject({
      reason: "endpoint_requires_auth",
    });
  });

  it("rejects redirect, auth status, non-json, invalid JSON, and oversized responses", async () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://boards.greenhouse.io/acme");

    await expect(fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl: async () => jsonResponse({}, { status: 301 }) })).rejects.toMatchObject({
      reason: "endpoint_redirect_rejected",
    });
    await expect(fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl: async () => jsonResponse({}, { status: 403 }) })).rejects.toMatchObject({
      reason: "endpoint_http_status",
      status: 403,
    });
    await expect(
      fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl: async () => jsonResponse({}, { contentType: "text/html" }) }),
    ).rejects.toMatchObject({ reason: "endpoint_non_json_response" });
    await expect(
      fetchControlledAtsPublicEndpoint(endpoint, {
        fetchImpl: async () => textResponse("<html>bad</html>", { contentType: "text/html" }),
      }),
    ).rejects.toMatchObject({ reason: "endpoint_non_json_response" });
    await expect(
      fetchControlledAtsPublicEndpoint(endpoint, {
        fetchImpl: async () => ({
          status: 200,
          headers: { get: () => "application/json" },
          text: async () => "{",
        }),
      }),
    ).rejects.toMatchObject({ reason: "endpoint_invalid_json" });
    await expect(
      fetchControlledAtsPublicEndpoint({ ...endpoint, maxResponseBytes: 2 }, { fetchImpl: async () => jsonResponse({ jobs: [] }) }),
    ).rejects.toMatchObject({ reason: "endpoint_response_too_large" });
  });

  it("returns fetched payload result with stable rawResponseHash", async () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://boards.greenhouse.io/acme");
    const options = { fetchImpl: async () => jsonResponse({ jobs: [{ id: 1, title: "Role" }] }), now: () => T };

    const first = await fetchControlledAtsPublicEndpoint(endpoint, options);
    const second = await fetchControlledAtsPublicEndpoint(endpoint, options);

    expect(first).toMatchObject({
      endpoint,
      payload: { jobs: [{ id: 1, title: "Role" }] },
      status: 200,
      contentType: "application/json",
      fetchedAt: T,
      version: 1,
    });
    expect(first.rawResponseHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.rawResponseHash).toBe(second.rawResponseHash);
  });

  it("fetches Lever skip pages and merges array payload", async () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://jobs.lever.co/acme");
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `job-${index}` }));
    const secondPage = [{ id: "job-100" }];
    const fetchImpl = vi.fn<ControlledAtsFetchImpl>(async (url) => (
      url.endsWith("skip=0") ? jsonResponse(firstPage) : jsonResponse(secondPage)
    ));

    const result = await fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl, now: () => T });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.lever.co/v0/postings/acme?mode=json&limit=100&skip=0",
      "https://api.lever.co/v0/postings/acme?mode=json&limit=100&skip=100",
    ]);
    expect(result.payload).toEqual([...firstPage, ...secondPage]);
  });

  it("fetches SmartRecruiters offset pages and merges content payload", async () => {
    const endpoint = resolveControlledAtsPublicEndpointFromUrl("https://careers.smartrecruiters.com/acme");
    const firstContent = Array.from({ length: 100 }, (_, index) => ({ id: `job-${index}` }));
    const secondContent = [{ id: "job-100" }];
    const fetchImpl = vi.fn<ControlledAtsFetchImpl>(async (url) => (
      url.endsWith("offset=0")
        ? jsonResponse({ limit: 100, offset: 0, totalFound: 101, content: firstContent, company: "Acme" })
        : jsonResponse({ limit: 100, offset: 100, totalFound: 101, content: secondContent, company: "Ignored" })
    ));

    const result = await fetchControlledAtsPublicEndpoint(endpoint, { fetchImpl, now: () => T });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.smartrecruiters.com/v1/companies/acme/postings?limit=100&offset=0",
      "https://api.smartrecruiters.com/v1/companies/acme/postings?limit=100&offset=100",
    ]);
    expect(result.payload).toEqual({
      limit: 100,
      offset: 0,
      totalFound: 101,
      content: [...firstContent, ...secondContent],
      company: "Acme",
    });
  });

  it("returns ControlledAtsPayloadEnvelopeV1 with injected timestamp", async () => {
    const envelope = await fetchControlledAtsPayloadEnvelopeFromUrl("https://boards.greenhouse.io/acme", {
      fetchImpl: async () => jsonResponse({ jobs: [] }),
      now: () => T,
    });

    expect(envelope).toEqual({
      vendor: "greenhouse",
      sourceKind: "public_job_board_payload",
      sourceUrl: "https://boards.greenhouse.io/acme",
      payload: { jobs: [] },
      createdAt: T,
      updatedAt: T,
      version: 1,
    });
  });
});
