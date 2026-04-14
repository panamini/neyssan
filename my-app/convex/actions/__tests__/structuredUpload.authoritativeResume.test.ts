import { describe, expect, it } from "vitest";

import { buildAuthoritativeResumeEnvelope } from "../structuredUpload";

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
});
