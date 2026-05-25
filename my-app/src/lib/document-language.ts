import React from "react";
import {
  DEFAULT_UI_LOCALE,
  ENABLED_DOCUMENT_LANGUAGES,
  LOCALE_REGISTRY,
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

const DOCUMENT_LANGUAGE_LABELS: Record<DocumentLanguage, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  nl: "Dutch",
  el: "Greek",
  hu: "Hungarian",
  lt: "Lithuanian",
  et: "Estonian",
  ru: "Russian",
  ar: "Arabic",
};

export const DOCUMENT_LANGUAGE_OPTIONS: Array<{
  id: DocumentLanguagePreference;
  label: string;
  nativeLabel: string;
}> = [
  { id: "auto", label: "Auto", nativeLabel: "Match job" },
  ...ENABLED_DOCUMENT_LANGUAGES.map((id) => ({
    id,
    label: DOCUMENT_LANGUAGE_LABELS[id] ?? id,
    nativeLabel: LOCALE_REGISTRY[id].nativeName,
  })),
];

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

export function useDocumentLanguagePreference(): {
  language: DocumentLanguagePreference;
  setLanguage: (language: DocumentLanguagePreference) => void;
} {
  const [language, setLanguageState] = React.useState<DocumentLanguagePreference>(
    readStoredDocumentLanguage,
  );

  const setLanguage = React.useCallback(
    (nextLanguage: DocumentLanguagePreference) => {
      const normalized = normalizeDocumentLanguage(nextLanguage);
      setLanguageState(normalized);
      writeStoredDocumentLanguage(normalized);
    },
    [],
  );

  return { language, setLanguage };
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
