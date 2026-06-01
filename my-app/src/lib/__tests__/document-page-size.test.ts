import { describe, expect, it } from "vitest";

import {
  DOCUMENT_PAGE_SIZES,
  documentPageSizeToPx,
  resolveDocumentPageSize,
  resolveDocumentPageSizePreference,
} from "../document-page-size";

describe("document-page-size", () => {
  it("defaults auto page-size resolution to A4", () => {
    expect(resolveDocumentPageSize({ preference: "auto" })).toEqual(
      expect.objectContaining({
        id: "a4",
        widthMm: 210,
        heightMm: 297,
      }),
    );
  });

  it("resolves US Letter from explicit preference and North American locales", () => {
    expect(resolveDocumentPageSize({ preference: "letter" }).id).toBe("letter");
    expect(resolveDocumentPageSize({ preference: "auto", locale: "en-US" }).id).toBe(
      "letter",
    );
    expect(resolveDocumentPageSize({ preference: "auto", locale: "en-CA" }).id).toBe(
      "letter",
    );
  });

  it("normalizes unknown preferences back to auto", () => {
    expect(resolveDocumentPageSizePreference("legal")).toBe("auto");
    expect(resolveDocumentPageSizePreference(null)).toBe("auto");
  });

  it("converts Letter millimeters to true CSS pixels", () => {
    const letterPx = documentPageSizeToPx(DOCUMENT_PAGE_SIZES.letter);

    expect(letterPx.widthPx).toBeCloseTo(215.9 * (96 / 25.4), 4);
    expect(letterPx.heightPx).toBeCloseTo(279.4 * (96 / 25.4), 4);
  });
});
