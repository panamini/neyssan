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

export type DocumentLanguageSource =
  | "document-preference"
  | "job-detected"
  | "ui-fallback"
  | "default";

export type DocumentLanguageGenerationMetadata = {
  requestedLanguage: DocumentLanguagePreference;
  resolvedLanguage: DocumentLanguage;
  languageSource: DocumentLanguageSource;
  jobDetectedLanguage: DocumentLanguage | null;
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
  ga: "Irish",
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

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce((count, marker) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

export function detectDocumentLanguageFromText(
  value: string | null | undefined,
): DocumentLanguage | null {
  const text = value?.toLowerCase().trim() ?? "";
  if (!text) return null;

  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";

  const markerSets: Array<{
    language: DocumentLanguage;
    markers: readonly string[];
  }> = [
    {
      language: "de",
      markers: [
        "wir suchen",
        "stelle",
        "bewerbung",
        "aufgaben",
        "kenntnisse",
        "erfahrung",
        "unternehmen",
        "team",
        "für",
      ],
    },
    {
      language: "fr",
      markers: [
        "nous recherchons",
        "poste",
        "candidature",
        "compétences",
        "expérience",
        "entreprise",
        "équipe",
      ],
    },
    {
      language: "es",
      markers: [
        "buscamos",
        "puesto",
        "solicitud",
        "experiencia",
        "habilidades",
        "empresa",
        "equipo",
      ],
    },
    {
      language: "en",
      markers: [
        "we are looking",
        "we're looking",
        "job",
        "role",
        "position",
        "experience",
        "skills",
        "team",
      ],
    },
  ];

  let best: { language: DocumentLanguage; hits: number } | null = null;
  for (const markerSet of markerSets) {
    const hits = countMarkerHits(text, markerSet.markers);
    if (!best || hits > best.hits) {
      best = { language: markerSet.language, hits };
    }
  }

  if (best && best.hits >= 2) {
    return best.language;
  }

  if (/[äöüß]/i.test(text)) return "de";
  if (/[éèêëàâäôöûüçœæ]/i.test(text)) return "fr";
  if (/[áéíóúñ¿¡]/i.test(text)) return "es";

  return null;
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
    return args.jobDetectedLanguage ?? args.uiLocale ?? DEFAULT_UI_LOCALE;
  }

  return args.documentLanguage;
}

export function resolveDocumentLanguageGenerationMetadata(args: {
  uiLocale: UiLocale;
  documentLanguage?: DocumentLanguagePreference | null;
  jobText?: string | null;
  jobDetectedLanguage?: string | null;
}): DocumentLanguageGenerationMetadata {
  const requestedLanguage = normalizeDocumentLanguage(
    args.documentLanguage ?? DEFAULT_DOCUMENT_LANGUAGE,
  );
  const explicitJobDetectedLanguage = isDocumentLanguage(
    args.jobDetectedLanguage,
  )
    ? normalizeLocaleId(args.jobDetectedLanguage)
    : null;
  const jobDetectedLanguage =
    explicitJobDetectedLanguage ??
    detectDocumentLanguageFromText(args.jobText ?? null);

  if (requestedLanguage !== "auto") {
    return {
      requestedLanguage,
      resolvedLanguage: requestedLanguage,
      languageSource: "document-preference",
      jobDetectedLanguage,
    };
  }

  if (jobDetectedLanguage) {
    return {
      requestedLanguage,
      resolvedLanguage: jobDetectedLanguage,
      languageSource: "job-detected",
      jobDetectedLanguage,
    };
  }

  if (ENABLED_DOCUMENT_LANGUAGES.includes(args.uiLocale)) {
    return {
      requestedLanguage,
      resolvedLanguage: args.uiLocale,
      languageSource: "ui-fallback",
      jobDetectedLanguage,
    };
  }

  return {
    requestedLanguage,
    resolvedLanguage: DEFAULT_UI_LOCALE,
    languageSource: "default",
    jobDetectedLanguage,
  };
}

export function buildDocumentLanguageContext(args: {
  uiLocale: UiLocale;
  documentLanguage?: DocumentLanguagePreference | null;
  jobDetectedLanguage?: string | null;
  jobText?: string | null;
}): DocumentLanguageContext {
  const documentLanguage = normalizeDocumentLanguage(
    args.documentLanguage ?? DEFAULT_DOCUMENT_LANGUAGE,
  );
  const metadata = resolveDocumentLanguageGenerationMetadata({
    uiLocale: args.uiLocale,
    documentLanguage,
    jobDetectedLanguage: args.jobDetectedLanguage,
    jobText: args.jobText,
  });

  return {
    uiLocale: args.uiLocale,
    documentLanguage,
    jobDetectedLanguage: metadata.jobDetectedLanguage,
    generatedLanguage: metadata.resolvedLanguage,
  };
}
