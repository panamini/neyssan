import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_LANGUAGE,
  DOCUMENT_LANGUAGE_OPTIONS,
  buildDocumentLanguageContext,
  detectDocumentLanguageFromText,
  normalizeDocumentLanguage,
  resolveDocumentLanguageGenerationMetadata,
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

  it("uses detected job language for auto documents before UI fallback", () => {
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
    ).toBe("fr");
  });

  it("resolves explicit document language independently from UI and job language", () => {
    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "fr",
        documentLanguage: "en",
        jobText: "We are looking for a team assistant with strong skills.",
      }),
    ).toEqual({
      requestedLanguage: "en",
      resolvedLanguage: "en",
      languageSource: "document-preference",
      jobDetectedLanguage: "en",
    });

    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "en",
        documentLanguage: "fr",
        jobText: "We are looking for a team assistant with strong skills.",
      }),
    ).toMatchObject({
      requestedLanguage: "fr",
      resolvedLanguage: "fr",
      languageSource: "document-preference",
      jobDetectedLanguage: "en",
    });
  });

  it("lets auto follow detected German job language before UI fallback", () => {
    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "en",
        documentLanguage: "auto",
        jobText:
          "Wir suchen Verstärkung für unser Team. Aufgaben und Kenntnisse im Vertrieb sind wichtig.",
      }),
    ).toMatchObject({
      requestedLanguage: "auto",
      resolvedLanguage: "de",
      languageSource: "job-detected",
      jobDetectedLanguage: "de",
    });
  });

  it("supports Russian and Arabic document generation while UI can stay English", () => {
    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "en",
        documentLanguage: "ru",
        jobText: "We are looking for a team assistant with strong skills.",
      }),
    ).toMatchObject({
      requestedLanguage: "ru",
      resolvedLanguage: "ru",
      languageSource: "document-preference",
      jobDetectedLanguage: "en",
    });

    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "en",
        documentLanguage: "ar",
        jobText: "We are looking for a team assistant with strong skills.",
      }),
    ).toMatchObject({
      requestedLanguage: "ar",
      resolvedLanguage: "ar",
      languageSource: "document-preference",
      jobDetectedLanguage: "en",
    });
  });

  it("detects Russian and Arabic job text for auto documents", () => {
    expect(detectDocumentLanguageFromText("Ищем опытного менеджера")).toBe(
      "ru",
    );
    expect(detectDocumentLanguageFromText("نبحث عن مدير مشروع")).toBe("ar");
  });

  it("normalizes only prepared document languages", () => {
    expect(normalizeDocumentLanguage("pt-BR")).toBe("pt");
    expect(normalizeDocumentLanguage("ar")).toBe("ar");
    expect(normalizeDocumentLanguage("ga")).toBe(DEFAULT_DOCUMENT_LANGUAGE);
  });

  it("keeps Russian document language available when Russian UI falls back to English", () => {
    expect(
      resolveDocumentLanguageGenerationMetadata({
        uiLocale: "en",
        documentLanguage: "ru",
        jobText: "We are looking for a team assistant with strong skills.",
      }),
    ).toMatchObject({
      requestedLanguage: "ru",
      resolvedLanguage: "ru",
      languageSource: "document-preference",
    });
  });

  it("exposes prepared document language options separately from UI languages", () => {
    const optionIds = DOCUMENT_LANGUAGE_OPTIONS.map((option) => option.id);

    expect(optionIds).toEqual(
      expect.arrayContaining(["auto", "en", "fr", "es", "de", "ar"]),
    );
    expect(optionIds).not.toContain("ga");
  });
});
