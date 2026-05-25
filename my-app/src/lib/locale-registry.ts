export type LocaleMode = "ui" | "document" | "marketing";

export type LocaleMeta = {
  nativeName: string;
  dir: "ltr" | "rtl";
  ui: boolean;
  documents: boolean;
  marketing: boolean;
  qaStatus: "none" | "machine-draft" | "human-reviewed" | "production";
};

export const LOCALE_REGISTRY = {
  en: {
    nativeName: "English",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: true,
    qaStatus: "production",
  },
  fr: {
    nativeName: "Francais",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: true,
    qaStatus: "production",
  },
  es: {
    nativeName: "Espanol",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: true,
    qaStatus: "production",
  },
  de: {
    nativeName: "Deutsch",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: true,
    qaStatus: "machine-draft",
  },
  it: {
    nativeName: "Italiano",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  pt: {
    nativeName: "Portugues",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  pl: {
    nativeName: "Polski",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  nl: {
    nativeName: "Nederlands",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  el: {
    nativeName: "Ellinika",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  hu: {
    nativeName: "Magyar",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  lt: {
    nativeName: "Lietuviu",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  et: {
    nativeName: "Eesti",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  ru: {
    nativeName: "Russkiy",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  ar: {
    nativeName: "Al-Arabiyyah",
    dir: "rtl",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
} as const satisfies Record<string, LocaleMeta>;

export type LocaleId = keyof typeof LOCALE_REGISTRY;
export type UiLocale = Extract<LocaleId, "en" | "fr" | "es">;
export type UiLocalePreference = "auto" | UiLocale;
export type DocumentLanguage = LocaleId;
export type MarketingLocale = Extract<LocaleId, "en" | "fr" | "es" | "de">;

export const DEFAULT_UI_LOCALE: UiLocale = "en";

export const ENABLED_UI_LOCALES = Object.keys(LOCALE_REGISTRY).filter(
  (locale): locale is UiLocale =>
    LOCALE_REGISTRY[locale as LocaleId].ui &&
    LOCALE_REGISTRY[locale as LocaleId].qaStatus === "production",
);

export const ENABLED_DOCUMENT_LANGUAGES = Object.keys(LOCALE_REGISTRY).filter(
  (locale): locale is DocumentLanguage =>
    LOCALE_REGISTRY[locale as LocaleId].documents,
);

export const ENABLED_MARKETING_LOCALES = Object.keys(LOCALE_REGISTRY).filter(
  (locale): locale is MarketingLocale =>
    LOCALE_REGISTRY[locale as LocaleId].marketing,
);

export function normalizeLocaleId(value: string | null | undefined): LocaleId | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return normalized in LOCALE_REGISTRY ? (normalized as LocaleId) : null;
}

export function normalizeUiLocale(
  value?: string | readonly string[] | null,
): UiLocale {
  const candidates =
    Array.isArray(value) || (value && typeof value !== "string")
      ? Array.from(value)
      : [value ?? ""];

  for (const candidate of candidates) {
    const normalized = normalizeLocaleId(candidate);
    if (normalized && ENABLED_UI_LOCALES.includes(normalized as UiLocale)) {
      return normalized as UiLocale;
    }
  }

  return DEFAULT_UI_LOCALE;
}

export function detectBrowserUiLocale(): UiLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_UI_LOCALE;
  }

  const browserLanguages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  return normalizeUiLocale(browserLanguages);
}

export function getLocaleDirection(locale: string | null | undefined): "ltr" | "rtl" {
  const normalized = normalizeLocaleId(locale);
  return normalized ? LOCALE_REGISTRY[normalized].dir : "ltr";
}

export function resolveUiLocale(preference: UiLocalePreference): UiLocale {
  return preference === "auto" ? detectBrowserUiLocale() : preference;
}

export function syncDocumentLocale(locale: string | null | undefined): void {
  if (typeof document === "undefined") return;

  const normalized = normalizeLocaleId(locale) ?? DEFAULT_UI_LOCALE;
  document.documentElement.lang = normalized;
  document.documentElement.dir = getLocaleDirection(normalized);
}
