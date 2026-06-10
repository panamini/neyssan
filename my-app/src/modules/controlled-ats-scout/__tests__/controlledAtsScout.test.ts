import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import {
  buildControlledAtsAdapterRegistry,
  buildControlledAtsAdapterRegistryHash,
  buildControlledAtsJobLead,
  buildControlledAtsJobLeadHash,
  buildControlledAtsRawPayloadHash,
  buildControlledAtsScoutContent,
  dedupeControlledAtsJobLeads,
  normalizeAshbyPayload,
  normalizeControlledAtsPayload,
  normalizeGreenhousePayload,
  normalizeLeverPayload,
  normalizeRecruiteePayload,
  normalizeSmartRecruitersPayload,
} from "../adapters";
import {
  assertControlledAtsAdapterRegistry,
  assertControlledAtsDoesNotUseForbiddenVendor,
  assertControlledAtsScoutDoesNotContainGeneratedText,
  canonicalizeControlledAtsUrl,
  inferControlledAtsVendorFromUrl,
} from "../scoutRules";
import type {
  BuildControlledAtsJobLeadInputV1,
  ControlledAtsAdapterRegistryV1,
  ControlledAtsPayloadEnvelopeV1,
} from "../schema";

const T = Date.UTC(2026, 5, 10);
const SOURCE_KIND = "manual_fixture" as const;

function envelope(
  overrides: Partial<ControlledAtsPayloadEnvelopeV1> = {},
): ControlledAtsPayloadEnvelopeV1 {
  return {
    vendor: "greenhouse",
    sourceKind: SOURCE_KIND,
    sourceUrl: "https://boards.greenhouse.io/acme",
    payload: {
      jobs: [
        {
          id: 123,
          title: "Senior TypeScript Engineer",
          absolute_url: "https://boards.greenhouse.io/acme/jobs/123?gh_jid=123#app",
          location: { name: "Remote" },
          departments: [{ name: "Engineering" }],
          content: "Build reliable TypeScript systems.\nKeep this text exact.",
          updated_at: "2026-06-01T12:00:00.000Z",
        },
      ],
    },
    createdAt: T,
    updatedAt: T + 1,
    version: 1,
    ...overrides,
  };
}

function leadInput(overrides: Partial<BuildControlledAtsJobLeadInputV1> = {}): BuildControlledAtsJobLeadInputV1 {
  return {
    vendor: "greenhouse",
    sourceKind: SOURCE_KIND,
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/123",
    canonicalUrl: "https://boards.greenhouse.io/acme/jobs/123",
    externalJobId: "123",
    title: "Senior TypeScript Engineer",
    department: "Engineering",
    location: "Remote",
    workplaceType: "remote",
    status: "unknown",
    descriptionText: "Build reliable TypeScript systems.",
    rawPayloadHash: "raw-hash-a",
    createdAt: T,
    updatedAt: T + 1,
    ...overrides,
  };
}

describe("controlled ATS scout adapters", () => {
  it("builds deterministic adapter registry", () => {
    const first = buildControlledAtsAdapterRegistry();
    const second = buildControlledAtsAdapterRegistry();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.adapters).not.toBe(second.adapters);
  });

  it("registry hash is stable", async () => {
    const first = buildControlledAtsAdapterRegistry();
    const second = buildControlledAtsAdapterRegistry();

    await expect(buildControlledAtsAdapterRegistryHash(first)).resolves.toBe(
      await buildControlledAtsAdapterRegistryHash(second),
    );
  });

  it('scout content helper returns kind: "controlled_ats_scout_adapters"', () => {
    const registry = buildControlledAtsAdapterRegistry();
    const content = buildControlledAtsScoutContent(registry);

    expect(content.kind).toBe("controlled_ats_scout_adapters");
    expect(content.registry).toEqual(registry);
    expect(content.version).toBe(1);
  });

  it("registry includes controlled ATS payload normalizers", () => {
    const registry = buildControlledAtsAdapterRegistry();

    expect(registry.vendors).toEqual(["ashby", "greenhouse", "lever", "recruitee", "smartrecruiters"]);
    expect(registry.adapters.map((adapter) => adapter.vendor)).toEqual([
      "ashby",
      "greenhouse",
      "lever",
      "recruitee",
      "smartrecruiters",
    ]);
  });

  it("registry rejects duplicate vendors", () => {
    const registry = buildControlledAtsAdapterRegistry();
    const duplicate: ControlledAtsAdapterRegistryV1 = {
      adapters: [registry.adapters[0], registry.adapters[0]],
      vendors: [registry.adapters[0].vendor, registry.adapters[0].vendor],
      version: 1,
    };

    expect(() => assertControlledAtsAdapterRegistry(duplicate)).toThrow(TypeError);
  });

  it("unsupported vendor is rejected", async () => {
    await expect(
      normalizeControlledAtsPayload({
        ...envelope(),
        vendor: "linkedin",
      } as unknown as ControlledAtsPayloadEnvelopeV1),
    ).rejects.toThrow(/supported vendor/u);
  });

  it("forbidden vendors are not registered", () => {
    const serialized = JSON.stringify(buildControlledAtsAdapterRegistry());

    expect(serialized).not.toMatch(/linkedin|upwork|indeed|generic_web|unknown_scraper/u);
  });

  it("forbidden LinkedIn URL is rejected", () => {
    expect(() => assertControlledAtsDoesNotUseForbiddenVendor("https://www.linkedin.com/jobs/view/1")).toThrow(
      /forbidden/u,
    );
  });

  it("forbidden Upwork URL is rejected", () => {
    expect(() => assertControlledAtsDoesNotUseForbiddenVendor("https://www.upwork.com/jobs/~1")).toThrow(
      /forbidden/u,
    );
  });

  it("forbidden Indeed URL is rejected", () => {
    expect(() => assertControlledAtsDoesNotUseForbiddenVendor("https://www.indeed.com/viewjob?jk=1")).toThrow(
      /forbidden/u,
    );
  });

  it("supported Greenhouse URL infers greenhouse", () => {
    expect(inferControlledAtsVendorFromUrl("https://boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
  });

  it("supported Lever URL infers lever", () => {
    expect(inferControlledAtsVendorFromUrl("https://jobs.lever.co/acme/123")).toBe("lever");
  });

  it("supported Ashby URL infers ashby", () => {
    expect(inferControlledAtsVendorFromUrl("https://jobs.ashbyhq.com/acme/123")).toBe("ashby");
  });

  it("supported SmartRecruiters URL infers smartrecruiters", () => {
    expect(inferControlledAtsVendorFromUrl("https://careers.smartrecruiters.com/acme/123")).toBe("smartrecruiters");
  });

  it("supported Recruitee URL infers recruitee", () => {
    expect(inferControlledAtsVendorFromUrl("https://acme.recruitee.com/o/senior-product-engineer")).toBe("recruitee");
  });

  it("unknown URL returns deterministic unsupported result", () => {
    expect(inferControlledAtsVendorFromUrl("https://example.com/jobs/123")).toBeUndefined();
    expect(() => canonicalizeControlledAtsUrl("greenhouse", "https://example.com/jobs/123")).toThrow(
      /unsupported/u,
    );
  });

  it("Greenhouse fixture normalizes to job lead", async () => {
    const result = await normalizeGreenhousePayload(envelope());

    expect(result.leads).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.leads[0]).toMatchObject({
      id: expect.stringMatching(/^controlled-ats-job-lead:[a-f0-9]{64}$/u),
      vendor: "greenhouse",
      externalJobId: "123",
      title: "Senior TypeScript Engineer",
      department: "Engineering",
      location: "Remote",
      workplaceType: "remote",
      version: 1,
    });
  });

  it("Lever fixture normalizes to job lead", async () => {
    const result = await normalizeLeverPayload({
      ...envelope({
        vendor: "lever",
        sourceUrl: "https://jobs.lever.co/acme",
        payload: {
          postings: [
            {
              id: "lever-1",
              text: "Staff Product Engineer",
              hostedUrl: "https://jobs.lever.co/acme/lever-1",
              applyUrl: "https://jobs.lever.co/acme/lever-1/apply",
              categories: {
                location: "Paris Hybrid",
                team: "Product",
                department: "Engineering",
              },
              descriptionPlain: "Own the product platform.",
              createdAt: T,
            },
          ],
        },
      }),
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      vendor: "lever",
      externalJobId: "lever-1",
      title: "Staff Product Engineer",
      team: "Product",
      department: "Engineering",
      workplaceType: "hybrid",
      postedAt: new Date(T).toISOString(),
    });
  });

  it("Ashby fixture normalizes to job lead", async () => {
    const result = await normalizeAshbyPayload({
      ...envelope({
        vendor: "ashby",
        sourceUrl: "https://jobs.ashbyhq.com/acme",
        payload: {
          jobs: [
            {
              id: "ashby-1",
              title: "Data Platform Engineer",
              jobUrl: "https://jobs.ashbyhq.com/acme/ashby-1",
              applyUrl: "https://jobs.ashbyhq.com/acme/ashby-1/application",
              location: "London Onsite",
              department: "Data",
              team: "Platform",
              descriptionPlain: "Maintain analytics pipelines.",
              publishedAt: "2026-06-05T08:00:00.000Z",
            },
          ],
        },
      }),
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      vendor: "ashby",
      externalJobId: "ashby-1",
      title: "Data Platform Engineer",
      workplaceType: "onsite",
      postedAt: "2026-06-05T08:00:00.000Z",
    });
  });

  it("SmartRecruiters list fixture normalizes to job lead", async () => {
    const result = await normalizeSmartRecruitersPayload({
      ...envelope({
        vendor: "smartrecruiters",
        sourceUrl: "https://careers.smartrecruiters.com/acme",
        payload: {
          limit: 10,
          offset: 0,
          totalFound: 1,
          content: [
            {
              id: "74983486",
              uuid: "34225731-e7cf-4584-b0b7-78098fe1a66b",
              name: "Senior Platform Engineer",
              company: { identifier: "acme", name: "Acme Inc" },
              releasedDate: "2026-06-01T12:00:00.000Z",
              location: {
                city: "Paris",
                region: "Ile-de-France",
                country: "FR",
                remote: true,
              },
              department: { label: "Engineering" },
              function: { label: "Platform" },
              typeOfEmployment: { label: "Full-time" },
              ref: "https://api.smartrecruiters.com/api-v1/companies/acme/postings/74983486",
            },
          ],
        },
      }),
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      vendor: "smartrecruiters",
      externalJobId: "74983486",
      title: "Senior Platform Engineer",
      companyName: "Acme Inc",
      department: "Engineering",
      team: "Platform",
      location: "Paris, Ile-de-France, FR",
      workplaceType: "remote",
      postedAt: "2026-06-01T12:00:00.000Z",
    });
  });

  it("SmartRecruiters detail fixture preserves sections and apply URL", async () => {
    const result = await normalizeSmartRecruitersPayload({
      ...envelope({
        vendor: "smartrecruiters",
        sourceKind: "public_job_detail_payload",
        sourceUrl: "https://careers.smartrecruiters.com/acme",
        payload: {
          id: "sr-detail-1",
          name: "Engineering Manager",
          applyUrl: "https://www.smartrecruiters.com/acme/engineering-manager",
          active: true,
          jobAd: {
            sections: {
              qualifications: { text: "Lead platform teams." },
              description: { text: "Own delivery systems." },
            },
          },
        },
      }),
    });

    expect(result.leads[0]).toMatchObject({
      vendor: "smartrecruiters",
      canonicalUrl: "https://www.smartrecruiters.com/acme/engineering-manager",
      status: "open",
    });
    expect(result.leads[0].descriptionText).toBe("Own delivery systems.\n\nLead platform teams.");
  });

  it("Recruitee fixture normalizes defensively to job lead", async () => {
    const result = await normalizeRecruiteePayload({
      ...envelope({
        vendor: "recruitee",
        sourceUrl: "https://acme.recruitee.com",
        payload: {
          offers: [
            {
              id: 123,
              slug: "senior-product-engineer",
              title: "Senior Product Engineer",
              careers_url: "https://acme.recruitee.com/o/senior-product-engineer",
              department: { name: "Product Engineering" },
              locations: [{ name: "Remote" }],
              description: "Build product systems.",
              created_at: "2026-06-01T12:00:00.000Z",
              status: "published",
            },
          ],
        },
      }),
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      vendor: "recruitee",
      externalJobId: "123",
      title: "Senior Product Engineer",
      canonicalUrl: "https://acme.recruitee.com/o/senior-product-engineer",
      department: "Product Engineering",
      location: "Remote",
      workplaceType: "remote",
      status: "open",
      descriptionText: "Build product systems.",
    });
  });

  it("missing title record is rejected without rejecting valid records", async () => {
    const result = await normalizeGreenhousePayload(envelope({
      payload: {
        jobs: [
          { id: "missing-title", title: " " },
          { id: "valid", title: "Valid Role", absolute_url: "https://boards.greenhouse.io/acme/jobs/valid" },
        ],
      },
    }));

    expect(result.leads.map((lead) => lead.externalJobId)).toEqual(["valid"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe("missing_title");
  });

  it("unsupported payload shape returns rejected result", async () => {
    const result = await normalizeControlledAtsPayload(envelope({ payload: { data: "not jobs" } }));

    expect(result.leads).toHaveLength(0);
    expect(result.rejected).toEqual([
      expect.objectContaining({ reason: "unsupported_payload_shape", version: 1 }),
    ]);
  });

  it("raw payload hash is deterministic", async () => {
    const first = await buildControlledAtsRawPayloadHash({ b: 2, a: 1 });
    const second = await buildControlledAtsRawPayloadHash({ a: 1, b: 2 });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("lead hash is deterministic", async () => {
    const first = await buildControlledAtsJobLeadHash(leadInput());
    const second = await buildControlledAtsJobLeadHash(leadInput());

    expect(first).toBe(second);
  });

  it("lead hash ignores createdAt / updatedAt", async () => {
    const first = await buildControlledAtsJobLeadHash(leadInput({ createdAt: T, updatedAt: T + 1 }));
    const second = await buildControlledAtsJobLeadHash(leadInput({ createdAt: T + 100, updatedAt: T + 200 }));

    expect(first).toBe(second);
  });

  it("changed title changes lead hash", async () => {
    await expect(buildControlledAtsJobLeadHash(leadInput({ title: "Changed Role" }))).resolves.not.toBe(
      await buildControlledAtsJobLeadHash(leadInput()),
    );
  });

  it("changed canonical URL changes lead hash", async () => {
    await expect(
      buildControlledAtsJobLeadHash(leadInput({ canonicalUrl: "https://boards.greenhouse.io/acme/jobs/456" })),
    ).resolves.not.toBe(await buildControlledAtsJobLeadHash(leadInput()));
  });

  it("description hash changes when supplied description changes", async () => {
    const first = await buildControlledAtsJobLead(leadInput({ descriptionText: "First description." }));
    const second = await buildControlledAtsJobLead(leadInput({ descriptionText: "Second description." }));

    expect(first.descriptionHash).not.toBe(second.descriptionHash);
    expect(first.leadHash).not.toBe(second.leadHash);
  });

  it("supplied description text is preserved exactly", async () => {
    const descriptionText = "Line one.\n\nLine two with  spaces.";
    const result = await normalizeGreenhousePayload(envelope({
      payload: { id: "single", title: "Single Role", content: descriptionText },
    }));

    expect(result.leads[0].descriptionText).toBe(descriptionText);
  });

  it("dedupe removes duplicate externalJobId deterministically", async () => {
    const duplicateA = await buildControlledAtsJobLead(leadInput({ title: "B Role", externalJobId: "same" }));
    const duplicateB = await buildControlledAtsJobLead(leadInput({ title: "A Role", externalJobId: "same" }));

    expect(dedupeControlledAtsJobLeads([duplicateA, duplicateB]).map((lead) => lead.title)).toEqual(["A Role"]);
  });

  it("dedupe removes duplicate canonicalUrl deterministically", async () => {
    const duplicateA = await buildControlledAtsJobLead(leadInput({ externalJobId: undefined, title: "B Role" }));
    const duplicateB = await buildControlledAtsJobLead(leadInput({ externalJobId: undefined, title: "A Role" }));

    expect(dedupeControlledAtsJobLeads([duplicateA, duplicateB]).map((lead) => lead.title)).toEqual(["A Role"]);
  });

  it("dedupe does not merge same-title distinct URLs", async () => {
    const first = await buildControlledAtsJobLead(leadInput({ externalJobId: undefined }));
    const second = await buildControlledAtsJobLead(leadInput({
      externalJobId: undefined,
      canonicalUrl: "https://boards.greenhouse.io/acme/jobs/456",
    }));

    expect(dedupeControlledAtsJobLeads([second, first])).toHaveLength(2);
  });

  it("does not use board sourceUrl as canonicalUrl for records without record URL", async () => {
    const result = await normalizeGreenhousePayload(envelope({
      sourceUrl: "https://boards.greenhouse.io/acme",
      payload: {
        jobs: [
          { title: "Engineer B", content: "Build platform services." },
          { title: "Engineer A", content: "Build product services." },
        ],
      },
    }));

    expect(result.leads.map((lead) => lead.title)).toEqual(["Engineer A", "Engineer B"]);
    expect(result.leads.map((lead) => lead.canonicalUrl)).toEqual([undefined, undefined]);
  });

  it("output order is deterministic", async () => {
    const result = await normalizeGreenhousePayload(envelope({
      payload: {
        jobs: [
          { id: "b", title: "Beta", absolute_url: "https://boards.greenhouse.io/acme/jobs/b" },
          { id: "a", title: "Alpha", absolute_url: "https://boards.greenhouse.io/acme/jobs/a" },
        ],
      },
    }));

    expect(result.leads.map((lead) => lead.title)).toEqual(["Alpha", "Beta"]);
  });

  it("helpers do not mutate inputs", async () => {
    const registry = buildControlledAtsAdapterRegistry();
    const payload = envelope();
    const leads = [await buildControlledAtsJobLead(leadInput())];
    const before = stableSerialize({ registry, payload, leads });

    assertControlledAtsAdapterRegistry(registry);
    await buildControlledAtsAdapterRegistryHash(registry);
    buildControlledAtsScoutContent(registry);
    await normalizeControlledAtsPayload(payload);
    dedupeControlledAtsJobLeads(leads);

    expect(stableSerialize({ registry, payload, leads })).toBe(before);
  });

  it("has no imports or calls from forbidden surfaces", () => {
    const sourceFiles = [
      "src/modules/controlled-ats-scout/schema.ts",
      "src/modules/controlled-ats-scout/adapters.ts",
      "src/modules/controlled-ats-scout/scoutRules.ts",
      "src/modules/controlled-ats-scout/sourceResolver.ts",
      "src/modules/controlled-ats-scout/publicEndpointFetcher.ts",
    ];
    const source = sourceFiles.map((sourceFile) => readFileSync(resolve(process.cwd(), sourceFile), "utf8")).join("\n");

    expect(source).not.toMatch(
      /from\s+["'][^"']*(convex|ui|route|premiumCoverLetter|proposal|cv-forge|pdf|docx|mcp|runtime|network|generation|prompt|mistral|openai|puppeteer|playwright|cheerio|jsdom)[^"']*["']/iu,
    );
    expect(source).not.toMatch(
      /\b(axios|nodeFetch|undici|runInternalTool|executeInternalTool|callInternalTool|dispatchInternalTool|invokeTool|registerToolHandler|performToolAction)\s*\(/u,
    );
    const nonFetcherSource = sourceFiles
      .filter((sourceFile) => !sourceFile.endsWith("publicEndpointFetcher.ts"))
      .map((sourceFile) => readFileSync(resolve(process.cwd(), sourceFile), "utf8"))
      .join("\n");
    expect(nonFetcherSource).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\b(scrape|scraping|crawler|browser automation|DOMParser|document\.querySelector)\b/iu);
  });

  it("has no helper names that imply runtime, crawl, scrape, apply, or submit", async () => {
    const adapters = await import("../adapters");
    const rules = await import("../scoutRules");
    const helperNames = [...Object.keys(adapters), ...Object.keys(rules)];

    expect(helperNames).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/crawl|scrape|run|execute|apply|submit/iu)]),
    );
  });

  it("generated-text guard rejects runtime/scraping/auto-apply language in adapter metadata", () => {
    const registry = buildControlledAtsAdapterRegistry();

    expect(() =>
      assertControlledAtsScoutDoesNotContainGeneratedText({
        ...registry,
        adapters: [
          {
            ...registry.adapters[0],
            description: "Runtime adapter that scrapes pages and can auto-apply to jobs.",
          },
        ],
      }),
    ).toThrow(/generated or forbidden/u);
  });

  it("generated-text guard does not reject caller-supplied job description prose", async () => {
    const lead = await buildControlledAtsJobLead(leadInput({
      descriptionText: "Dear Hiring Manager, this sentence is part of a caller-supplied job description.",
    }));

    expect(() => assertControlledAtsScoutDoesNotContainGeneratedText(lead)).not.toThrow();
  });
});
