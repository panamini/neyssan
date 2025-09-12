// my-app/convex/lib/parsing/languageNormalizer.ts
/**
 * Lightweight language normalizer.
 *
 * Responsibilities:
 * - Split a freeform language string (commas, newlines, slashes, semicolons) into tokens.
 * - Map common variants / localized names to canonical English names.
 * - Deduplicate and return a stable list in order of appearance.
 *
 * This is intentionally small and dependency-free so it can run in Node/Browser
 * without optional packages. It focuses on UX-friendly canonical names rather
 * than strict ISO codes; later we can add ISO mapping if needed.
 */

const NORMALIZATION_MAP: Record<string, string> = {
  // English
  english: "English",
  en: "English",

  // French
  french: "French",
  français: "French",
  francais: "French",
  fr: "French",

  // Spanish
  spanish: "Spanish",
  español: "Spanish",
  espanol: "Spanish",
  es: "Spanish",

  // German
  german: "German",
  deutsch: "German",
  de: "German",

  // Italian
  italian: "Italian",
  italiano: "Italian",
  it: "Italian",

  // Portuguese
  portuguese: "Portuguese",
  português: "Portuguese",
  portugues: "Portuguese",
  pt: "Portuguese",

  // Chinese
  chinese: "Chinese",
  mandarin: "Chinese",
  zh: "Chinese",

  // Japanese
  japanese: "Japanese",
  ja: "Japanese",

  // Korean
  korean: "Korean",
  ko: "Korean",

  // Russian
  russian: "Russian",
  ru: "Russian",

  // Arabic
  arabic: "Arabic",
  ar: "Arabic",

  // Hindi
  hindi: "Hindi",
  hi: "Hindi",
};

function normalizeToken(token: string): string | null {
  if (!token) return null;
  const cleaned = token
    .toLowerCase()
    .replace(/[().\u2019'"]/g, "")
    .trim();
  if (!cleaned) return null;
  if (NORMALIZATION_MAP[cleaned]) return NORMALIZATION_MAP[cleaned];
  // Try to match by prefix (e.g., 'engl' -> English)
  for (const key of Object.keys(NORMALIZATION_MAP)) {
    if (cleaned.startsWith(key)) return NORMALIZATION_MAP[key];
  }
  // Fallback: capitalize first letter (best-effort)
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parse a freeform languages string into a deduplicated, canonicalized list.
 * Accepts inputs like:
 *  - "English, Français, Español"
 *  - "Deutsch\nItaliano"
 *  - "English / Spanish; French"
 */
export function normalizeLanguagesFromTextDetailed(text: string | null | undefined): { normalized: string[]; raw: string[] } {
  if (!text) return { normalized: [], raw: [] };
  // Split on commas, slashes, semicolons, newlines, and pipes
  const rawTokens = text.split(/[,\/;|\n]+/g).map((t) => t.trim()).filter(Boolean);
  const normalizedResult: string[] = [];
  const rawResult: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    const parts = tok.split(/\s+or\s+|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const normalized = normalizeToken(part);
      if (!normalized) continue;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        normalizedResult.push(normalized);
        rawResult.push(part);
      }
    }
  }
  return { normalized: normalizedResult, raw: rawResult };
}

export function normalizeLanguagesFromText(text: string | null | undefined): string[] {
  return normalizeLanguagesFromTextDetailed(text).normalized;
}

/**
 * Helper: join normalized languages to a readable string for UI consumption.
 */
export function joinNormalizedLanguages(langs: string[]): string {
  return langs.join(", ");
}

export default {
  normalizeLanguagesFromText,
  joinNormalizedLanguages,
};