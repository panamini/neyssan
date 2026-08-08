import { describe, expect, it } from "vitest";

import {
  asNonEmptyRecord,
  buildAuthoritativeResumeEnvelope,
  isMistralPayloadSelectable,
} from "../../lib/parsing/mistralPayloadTrust";

describe("buildAuthoritativeResumeEnvelope", () => {
  it("marks a non-fallback Mistral v3 route payload as trusted", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          profile: { name: "Jane Doe" },
          summary: {
            text: "Product leader with ten years of experience delivering complex customer platforms.",
          },
        },
      },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
        summary: {
          text: "Product leader with ten years of experience delivering complex customer platforms.",
        },
      },
    });
  });

  it("marks the payload untrusted when fallback was used or the precomputed payload is absent", () => {
    expect(
      buildAuthoritativeResumeEnvelope({
        diagnostics: {
          ocr_engine: "mistral",
          mistral_runtime: "local_fallback",
          mistral_fallback: true,
        },
      }),
    ).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: true,
      normalized: null,
    });

    expect(
      buildAuthoritativeResumeEnvelope({
        diagnostics: {
          ocr_engine: "mistral",
          mistral_runtime: "mistral",
          mistral_fallback: false,
        },
      }),
    ).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: false,
      normalized: null,
    });
  });

  it("rejects a local fallback runtime even when its boolean flag is false", () => {
    const payload = {
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "local_fallback",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          profile: { name: "Jane Doe" },
          rawSections: [{ label: "BODY", content: "x".repeat(200) }],
        },
      },
    };

    expect(buildAuthoritativeResumeEnvelope(payload)).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: true,
      normalized: null,
    });
    expect(
      isMistralPayloadSelectable(payload, { ocrChars: 200, rawSectionsLen: 1 }),
    ).toBe(false);
  });

  it("accepts top-level normalized content from the live route payload when result.normalized is absent", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_request_path: "/mistral-ocr/parse",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      normalized: {
        profile: { name: "Jane Doe" },
        skills: [{ name: "Product strategy" }, { name: "Roadmapping" }],
      },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
        skills: [{ name: "Product strategy" }, { name: "Roadmapping" }],
      },
    });
  });

  it("does not trust a template-like payload with identity data but no substantive resume content", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          profile: {
            name: "Robert Cooper",
            email: "robert@example.com",
          },
          experience: [{}],
          education: [{}],
          skills: [],
        },
      },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: false,
      normalized: {
        profile: {
          name: "Robert Cooper",
          email: "robert@example.com",
        },
        experience: [{}],
        education: [{}],
        skills: [],
      },
    });
  });

  it("trusts a substantive anonymized resume without identity fields", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          profile: {},
          experience: [
            {
              company: "Acme",
              position: "Operations Lead",
              startDate: "2015-01-01",
              endDate: "2025-01-01",
              responsibilities:
                "Led cross-functional delivery and improved processing reliability across the organization.",
            },
          ],
        },
      },
    });

    expect(envelope?.trusted).toBe(true);
    expect(envelope?.fallbackToLegacy).toBe(false);
  });

  it("trusts a detailed narrative-only experience when OCR misses its headings", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          experience: [
            {
              responsibilities:
                "Led cross-functional delivery, reduced processing delays, and improved operational reliability across multiple teams.",
            },
          ],
        },
      },
    });

    expect(envelope?.trusted).toBe(true);
  });

  it("rejects common experience field labels as template placeholders", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          experience: [{ company: "Company", position: "Position" }],
        },
      },
    });

    expect(envelope?.trusted).toBe(false);
  });

  it.each([
    [
      "awards",
      { name: "National Research Award", issuer: "Engineering Council" },
    ],
    [
      "publications",
      {
        title: "Reliable distributed systems in constrained environments",
        publisher: "Systems Journal",
      },
    ],
    [
      "volunteering",
      {
        organization: "Community Technology Network",
        role: "Volunteer Coordinator",
      },
    ],
    [
      "affiliations",
      { text: "Association of Operations Professionals — Board Member" },
    ],
  ])("trusts a substantive %s section", (sectionName, entry) => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: {
        normalized: {
          [sectionName]: [entry],
        },
      },
    });

    expect(envelope?.trusted).toBe(true);
  });

  it("does not trust a non-object normalized payload", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: { normalized: ["legacy output"] },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: false,
      normalized: null,
    });
  });

  it("does not trust an empty normalized object", () => {
    expect(asNonEmptyRecord({})).toBeNull();

    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
      },
      result: { normalized: {} },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: false,
      normalized: null,
    });
  });

  it("does not select a fallback payload even when it has OCR text and sections", () => {
    expect(
      isMistralPayloadSelectable(
        {
          diagnostics: {
            ocr_engine: "mistral",
            mistral_runtime: "local_fallback",
            mistral_fallback: true,
          },
          result: {
            normalized: {
              rawText: "x".repeat(200),
              rawSections: [{ label: "BODY", content: "x".repeat(200) }],
            },
          },
        },
        { ocrChars: 200, rawSectionsLen: 1 },
      ),
    ).toBe(false);
  });
});
