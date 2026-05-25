import { describe, expect, it } from "vitest";
import {
  ENABLED_DOCUMENT_LANGUAGES,
  ENABLED_MARKETING_LOCALES,
  ENABLED_UI_LOCALES,
  LOCALE_REGISTRY,
  getLocaleDirection,
  normalizeUiLocale,
} from "../locale-registry";

describe("locale registry", () => {
  it("exposes only production UI locales while keeping future locales in the registry", () => {
    expect(ENABLED_UI_LOCALES).toEqual(["en", "fr", "es"]);
    expect(ENABLED_DOCUMENT_LANGUAGES).toEqual(
      expect.arrayContaining([
        "en",
        "fr",
        "es",
        "de",
        "it",
        "pt",
        "pl",
        "nl",
        "el",
        "hu",
        "lt",
        "et",
        "ru",
        "ar",
      ]),
    );
    expect(ENABLED_MARKETING_LOCALES).toEqual(["en", "fr", "es", "de"]);

    expect(LOCALE_REGISTRY.de.ui).toBe(true);
    expect(LOCALE_REGISTRY.de.qaStatus).not.toBe("production");
    expect(LOCALE_REGISTRY.ar.dir).toBe("rtl");
    expect(ENABLED_UI_LOCALES).not.toContain("ar");
  });

  it("normalizes browser UI languages to English, French, or Spanish only", () => {
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("fr-CA")).toBe("fr");
    expect(normalizeUiLocale("es-MX")).toBe("es");
    expect(normalizeUiLocale("de-DE")).toBe("en");
    expect(normalizeUiLocale("ar")).toBe("en");
    expect(normalizeUiLocale(["pt-BR", "fr-FR"])).toBe("fr");
  });

  it("returns the registry direction for prepared locales", () => {
    expect(getLocaleDirection("en")).toBe("ltr");
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("unsupported")).toBe("ltr");
  });
});
