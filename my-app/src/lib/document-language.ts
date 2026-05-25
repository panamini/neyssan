import {
  DEFAULT_UI_LOCALE,
  ENABLED_DOCUMENT_LANGUAGES,
  type DocumentLanguage,
  type UiLocale,
  normalizeLocaleId,
} from "./locale-registry";

export type DocumentLanguagePreference = "auto" | DocumentLanguage;

export type DocumentLanguageContext = {
  uiLocale: UiLocale;
  documentLanguage: DocumentLanguagePreference;
  jobDetectedLanguage: DocumentLanguage | null;
  generatedLanguage: DocumentLanguage;
};

export const DEFAULT_DOCUMENT_LANGUAGE: DocumentLanguagePreference = "auto";

const DOCUMENT_LANGUAGE_STORAGE_KEY = "twoweeks:document-language";

function isDocumentLanguage(value: string | null | undefined): value is DocumentLanguage {
  const normalized = normalizeLocaleId(value);
  return Boolean(
    normalized && ENABLED_DOCUMENT_LANGUAGES.includes(normalized),
  );
}

export function normalizeDocumentLanguage(
  value: string | null | undefined,
): DocumentLanguagePreference {
  if (value === DEFAULT_DOCUMENT_LANGUAGE) {
    return DEFAULT_DOCUMENT_LANGUAGE;
  }

  const normalized = normalizeLocaleId(value);
  return normalized && isDocumentLanguage(normalized)
    ? normalized
    : DEFAULT_DOCUMENT_LANGUAGE;
}

export function readStoredDocumentLanguage(): DocumentLanguagePreference {
  if (typeof window === "undefined") {
    return DEFAULT_DOCUMENT_LANGUAGE;
  }

  return normalizeDocumentLanguage(
    window.localStorage.getItem(DOCUMENT_LANGUAGE_STORAGE_KEY),
  );
}

export function writeStoredDocumentLanguage(
  language: DocumentLanguagePreference,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DOCUMENT_LANGUAGE_STORAGE_KEY, language);
}

export function resolveGeneratedLanguage(args: {
  documentLanguage: DocumentLanguagePreference;
  jobDetectedLanguage: DocumentLanguage | null;
  uiLocale: UiLocale;
}): DocumentLanguage {
  if (args.documentLanguage === "auto") {
    return args.jobDetectedLanguage ?? DEFAULT_UI_LOCALE;
  }

  return args.documentLanguage;
}

export function buildDocumentLanguageContext(args: {
  uiLocale: UiLocale;
  documentLanguage?: DocumentLanguagePreference | null;
  jobDetectedLanguage?: string | null;
}): DocumentLanguageContext {
  const documentLanguage = normalizeDocumentLanguage(
    args.documentLanguage ?? DEFAULT_DOCUMENT_LANGUAGE,
  );
  const jobDetectedLanguage = isDocumentLanguage(args.jobDetectedLanguage)
    ? normalizeLocaleId(args.jobDetectedLanguage)
    : null;

  return {
    uiLocale: args.uiLocale,
    documentLanguage,
    jobDetectedLanguage,
    generatedLanguage: resolveGeneratedLanguage({
      uiLocale: args.uiLocale,
      documentLanguage,
      jobDetectedLanguage,
    }),
  };
}
