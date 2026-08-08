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
          summary: { text: "Summary text" },
        },
      },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
        summary: { text: "Summary text" },
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
      },
    });

    expect(envelope).toEqual({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
      },
    });
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
