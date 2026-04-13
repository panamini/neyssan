import { describe, expect, it } from "vitest";

import { buildAuthoritativeResumeEnvelope } from "../structuredUpload";

describe("buildAuthoritativeResumeEnvelope", () => {
  it("marks a precomputed non-fallback Mistral v3 payload as trusted", () => {
    const envelope = buildAuthoritativeResumeEnvelope({
      diagnostics: {
        ocr_engine: "mistral",
        mistral_runtime: "mistral",
        mistral_fallback: false,
        _mistral_resume_v3_canonical_payload: {
          normalized: {
            profile: { name: "Jane Doe" },
            summary: { text: "Summary text" },
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
});
