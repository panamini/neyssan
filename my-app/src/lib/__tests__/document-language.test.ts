import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_LANGUAGE,
  DOCUMENT_LANGUAGE_OPTIONS,
  buildDocumentLanguageContext,
  normalizeDocumentLanguage,
  resolveGeneratedLanguage,
} from "../document-language";

describe("document language scaffold", () => {
  it("keeps UI locale and generated document language separate", () => {
    const context = buildDocumentLanguageContext({
      uiLocale: "fr",
      documentLanguage: "en",
      jobDetectedLanguage: "fr",
    });

    expect(context).toEqual({
      uiLocale: "fr",
      documentLanguage: "en",
      jobDetectedLanguage: "fr",
      generatedLanguage: "en",
    });
  });

  it("uses detected job language for auto documents without following UI locale", () => {
    expect(
      resolveGeneratedLanguage({
        documentLanguage: DEFAULT_DOCUMENT_LANGUAGE,
        jobDetectedLanguage: "es",
        uiLocale: "fr",
      }),
    ).toBe("es");

    expect(
      resolveGeneratedLanguage({
        documentLanguage: DEFAULT_DOCUMENT_LANGUAGE,
        jobDetectedLanguage: null,
        uiLocale: "fr",
      }),
    ).toBe("en");
  });

  it("normalizes only prepared document languages", () => {
    expect(normalizeDocumentLanguage("pt-BR")).toBe("pt");
    expect(normalizeDocumentLanguage("ar")).toBe("ar");
    expect(normalizeDocumentLanguage("ga")).toBe(DEFAULT_DOCUMENT_LANGUAGE);
  });

  it("exposes prepared document language options separately from UI languages", () => {
    const optionIds = DOCUMENT_LANGUAGE_OPTIONS.map((option) => option.id);

    expect(optionIds).toEqual(
      expect.arrayContaining(["auto", "en", "fr", "es", "de", "ar"]),
    );
    expect(optionIds).not.toContain("ga");
  });
});
