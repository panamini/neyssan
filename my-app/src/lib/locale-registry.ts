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
    nativeName: "Français",
    dir: "ltr",
    ui: true,
    documents: true,
    marketing: true,
    qaStatus: "production",
  },
  es: {
    nativeName: "Español",
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
    nativeName: "Português",
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
  ga: {
    nativeName: "Gaeilge",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  el: {
    nativeName: "Ελληνικά",
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
    nativeName: "Lietuvių",
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
    nativeName: "Русский",
    dir: "ltr",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
  ar: {
    nativeName: "العربية",
    dir: "rtl",
    ui: false,
    documents: true,
    marketing: false,
    qaStatus: "none",
  },
} as const satisfies Record<string, LocaleMeta>;

export type LocaleId = keyof typeof LOCALE_REGISTRY;
export type UiLocale = Extract<
  {
    [Locale in LocaleId]: (typeof LOCALE_REGISTRY)[Locale]["ui"] extends true
      ? Locale
      : never;
  }[LocaleId],
  LocaleId
>;
export type ProductionUiLocale = Extract<UiLocale, "en" | "fr" | "es">;
export type UiLocalePreference = "auto" | UiLocale;
export type DocumentLanguage = LocaleId;
export type MarketingLocale = Extract<LocaleId, "en" | "fr" | "es" | "de">;

export const DEFAULT_UI_LOCALE: ProductionUiLocale = "en";

export const ENABLED_UI_LOCALES = Object.keys(LOCALE_REGISTRY).filter(
  (locale): locale is ProductionUiLocale =>
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
): ProductionUiLocale {
  const candidate =
    Array.isArray(value) || (value && typeof value !== "string")
      ? Array.from(value).find((entry) => String(entry ?? "").trim())
      : value;
  const normalized = normalizeLocaleId(candidate);

  if (normalized && ENABLED_UI_LOCALES.includes(normalized as ProductionUiLocale)) {
    return normalized as ProductionUiLocale;
  }

  return DEFAULT_UI_LOCALE;
}

export function detectBrowserUiLocale(): ProductionUiLocale {
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

export function resolveUiLocale(
  preference: UiLocalePreference,
): ProductionUiLocale {
  return preference === "auto" ? detectBrowserUiLocale() : normalizeUiLocale(preference);
}

export function syncDocumentLocale(locale: string | null | undefined): void {
  if (typeof document === "undefined") return;

  const normalized = normalizeLocaleId(locale) ?? DEFAULT_UI_LOCALE;
  document.documentElement.lang = normalized;
  document.documentElement.dir = getLocaleDirection(normalized);
}
