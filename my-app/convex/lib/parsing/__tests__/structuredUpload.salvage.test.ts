import { describe, it, expect } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("structuredUpload salvage (canonicalize fallback)", () => {
  it("synthesizes summary from raw when normalized JSON is empty (OCR-like)", () => {
    const result = {
      normalized: {
        rawText: "Scanned CV text — Jane Doe — Software Engineer",
        // empty structured arrays
        experience: [],
        education: [],
        skills: [],
        languages: [],
        achievements: [],
      },
      diagnostics: {
        engine: "ocr",
        pages: 2,
        total_chars: 1200,
        empty_reason: "pipeline_produced_empty_json",
      },
    } as any;

    const context = {
      rawText: result.normalized.rawText,
      mode: "ocr",
      parserUrl: "http://example/parse-cv",
    };

    const canonical = canonicalizeParserResult(result, context);
    const normalized = canonical.normalized ?? {} as any;
    expect(typeof normalized.summary?.text).toBe("string");
    expect(normalized.summary.text.length).toBeGreaterThan(0);
  });
});

