import {
  DEFAULT_UI_LOCALE,
  getLocaleDirection,
  normalizeLocaleId,
} from "./locale-registry";

export type SupportedExportLocale = "en" | "fr";

const NBSP = "\u00A0";

const SECTION_LABELS: Record<
  SupportedExportLocale,
  Record<string, string>
> = {
  en: {
    contact: "Contact",
    details: "Details",
    skills: "Skills",
    languages: "Languages",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    achievements: "Achievements",
    interests: "Interests",
    sender: "Sender",
    recipient: "Recipient",
    subject: "Subject",
  },
  fr: {
    contact: "Contact",
    details: "Détails",
    skills: "Compétences",
    languages: "Langues",
    experience: "Expérience",
    projects: "Projets",
    education: "Formation",
    achievements: "Réalisations",
    interests: "Centres d’intérêt",
    sender: "Expéditeur",
    recipient: "Destinataire",
    subject: "Objet",
  },
};

const STRUCTURED_LABELS: Record<
  string,
  Record<SupportedExportLocale, string>
> = {
  email: { en: "Email", fr: "E-mail" },
  phone: { en: "Phone", fr: "Téléphone" },
  location: { en: "Location", fr: "Lieu" },
  linkedin: { en: "LinkedIn", fr: "LinkedIn" },
  website: { en: "Website", fr: "Site web" },
  github: { en: "GitHub", fr: "GitHub" },
  portfolio: { en: "Portfolio", fr: "Portfolio" },
  "working proficiency": { en: "Working proficiency", fr: "Maîtrise professionnelle" },
};

export function normalizeExportLocale(
  locale?: string | null,
): SupportedExportLocale | null {
  const normalized = String(locale ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("fr")) {
    return "fr";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return null;
}

export function normalizeExportDocumentLanguage(
  locale?: string | null,
): string | null {
  return normalizeLocaleId(locale);
}

export function getExportHtmlLang(
  locale?: string | null,
): string {
  return normalizeLocaleId(locale) ?? DEFAULT_UI_LOCALE;
}

export function getExportHtmlDir(
  locale?: string | null,
): "ltr" | "rtl" {
  return getLocaleDirection(locale);
}

export function getLocalizedExportLabel(
  key: string,
  locale?: string | null,
): string {
  const resolvedLocale = normalizeExportLocale(locale) ?? "en";
  return SECTION_LABELS[resolvedLocale][key] ?? key;
}

export function localizeStructuredLabel(
  label: string,
  locale?: string | null,
): string {
  const normalizedLabel = label.trim().toLowerCase();
  const resolvedLocale = normalizeExportLocale(locale) ?? "en";
  return STRUCTURED_LABELS[normalizedLabel]?.[resolvedLocale] ?? label;
}

function normalizeFrenchTypography(value: string): string {
  let output = value;

  output = output.replace(/[ \u00A0]+([,.])/g, "$1");
  output = output.replace(/(\S)[ \u00A0]*([:;?!])/g, `$1${NBSP}$2`);
  output = output.replace(/"([^"\n]+)"/g, `«${NBSP}$1${NBSP}»`);
  output = output.replace(
    /(\d+(?:[.,]\d+)?)[ \u00A0]*(mm|cm|m|km|kg|g|h|°c|€)\b/gi,
    (_match, numeric, unit) => {
      const normalizedNumeric = String(numeric).replace(".", ",");
      return `${normalizedNumeric}${NBSP}${unit}`;
    },
  );

  return output;
}

function normalizeEnglishTypography(value: string): string {
  let output = value;

  output = output.replace(/\u00A0([:;?!])/g, "$1");
  output = output.replace(/«\u00A0?([^»]+)\u00A0?»/g, "“$1”");
  output = output.replace(/"([^"\n]+)"/g, "“$1”");
  output = output.replace(
    /(\d+(?:[.,]\d+)?)[ \u00A0]*(mm|cm|m|km|kg|g|h|°c)\b/gi,
    "$1 $2",
  );

  return output;
}

export function normalizeLocaleTypography(
  value: string,
  locale?: string | null,
): string {
  if (!value) {
    return "";
  }

  const resolvedLocale = normalizeExportLocale(locale);
  if (resolvedLocale === "fr") {
    return normalizeFrenchTypography(value);
  }

  if (resolvedLocale === "en") {
    return normalizeEnglishTypography(value);
  }

  return value;
}
